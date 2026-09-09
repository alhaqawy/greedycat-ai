import { NextResponse } from "next/server";
import { sql } from "@/lib/db/neon";

const VALID_RESULTS = [
  "corn",
  "pepper",
  "tomato",
  "carrot",
  "shrimp",
  "fish",
  "cow",
  "chick",
] as const;

type ValidResult = (typeof VALID_RESULTS)[number];

function isValidResult(value: unknown): value is ValidResult {
  return (
    typeof value === "string" &&
    VALID_RESULTS.includes(value as ValidResult)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/*
 * Neon قد يفشل أحيانًا بسبب انقطاع اتصال مؤقت.
 * نعيد المحاولة تلقائيًا قبل إرجاع الخطأ للواجهة.
 */
async function withNeonRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      console.error(`Neon attempt ${attempt}/${retries} failed:`, error);

      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 700),
        );
      }
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const resultId =
      typeof body?.resultId === "string" &&
      body.resultId.trim()
        ? body.resultId.trim()
        : crypto.randomUUID();

    const result = body?.result;

    const sessionId =
      typeof body?.sessionId === "string" &&
      body.sessionId.trim()
        ? body.sessionId.trim()
        : crypto.randomUUID();

    if (!isValidResult(result)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid result",
        },
        { status: 400 },
      );
    }
    const prediction = body?.prediction;

    const hasPrediction =
      prediction &&
      isValidResult(prediction.predictedResult) &&
      isFiniteNumber(prediction.confidence) &&
      isFiniteNumber(prediction.patternLength) &&
      isFiniteNumber(prediction.matches) &&
      isFiniteNumber(prediction.samplesUsed);

    const hasSecondPrediction =
      hasPrediction &&
      isValidResult(prediction.secondPredictedResult) &&
      isFiniteNumber(prediction.secondConfidence);

    const predictionId = `prediction-${resultId}`;

    /*
     * النتيجة لها ID ثابت.
     * لذلك إعادة إرسال نفس الطلب لا تنشئ نتيجة مكررة.
     */
    const neonSave = await withNeonRetry(async () => {
      await sql`
        INSERT INTO greedycat_results (
          id,
          result,
          session_id
        )
        VALUES (
          ${resultId},
          ${result},
          ${sessionId}
        )
        ON CONFLICT (id) DO NOTHING
      `;

      let predictionSaved = false;
      let performanceSaved = false;

      /*
       * نحفظ التوقع المرتبط بهذه الجولة فقط إذا كان موجودًا.
       * ID ثابت يمنع التكرار عند إعادة المحاولة.
       */
      if (hasPrediction) {
        await sql`
          INSERT INTO greedycat_predictions (
            id,
            predicted_result,
            confidence,
            pattern_length,
            matches,
            samples_used,
            second_predicted_result,
            second_confidence
          )
          VALUES (
            ${predictionId},
            ${prediction.predictedResult},
            ${prediction.confidence},
            ${prediction.patternLength},
            ${prediction.matches},
            ${prediction.samplesUsed},
            ${
              hasSecondPrediction
                ? prediction.secondPredictedResult
                : null
            },
            ${
              hasSecondPrediction
                ? prediction.secondConfidence
                : null
            }
          )
          ON CONFLICT (id) DO NOTHING
        `;

        predictionSaved = true;

        const correct =
          prediction.predictedResult === result;

        const secondCorrect =
          hasSecondPrediction
            ? prediction.secondPredictedResult === result
            : null;

        const performanceId =
          `performance-${resultId}`;

        await sql`
          INSERT INTO greedycat_prediction_performance (
            id,
            prediction_id,
            actual_result,
            correct,
            second_correct
          )
          VALUES (
            ${performanceId},
            ${predictionId},
            ${result},
            ${correct},
            ${secondCorrect}
          )
          ON CONFLICT (id) DO NOTHING
        `;

        performanceSaved = true;
      }

      return {
        predictionSaved,
        performanceSaved,
      };
    });

    const predictionSaved = neonSave.predictionSaved;
    const performanceSaved = neonSave.performanceSaved;

    return NextResponse.json({
      success: true,
      resultId,
      result,
      sessionId,
      predictionSaved,
      performanceSaved,
    });
  } catch (error) {
    console.error(
      "GreedyCat result save failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save GreedyCat result",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        result,
        session_id,
        created_at
      FROM greedycat_results
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      results: rows,
    });
  } catch (error) {
    console.error(
      "GreedyCat results fetch failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch GreedyCat results",
      },
      { status: 500 },
    );
  }
}


/*
 * حذف نتيجة محددة من Neon.
 *
 * ترتيب الحذف:
 * 1) الأداء المرتبط
 * 2) التوقع المرتبط
 * 3) النتيجة نفسها
 *
 * استخدام نفس resultId يمنع حذف أي نتيجة أخرى.
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const resultId =
      typeof body?.resultId === "string"
        ? body.resultId.trim()
        : "";

    if (!resultId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing resultId",
        },
        { status: 400 },
      );
    }

    const predictionId = `prediction-${resultId}`;
    const performanceId = `performance-${resultId}`;

    await withNeonRetry(async () => {
      await sql`
        DELETE FROM greedycat_prediction_performance
        WHERE id = ${performanceId}
      `;

      await sql`
        DELETE FROM greedycat_predictions
        WHERE id = ${predictionId}
      `;

      await sql`
        DELETE FROM greedycat_results
        WHERE id = ${resultId}
      `;
    });

    return NextResponse.json({
      success: true,
      resultId,
    });
  } catch (error) {
    console.error(
      "GreedyCat result delete failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete GreedyCat result",
      },
      { status: 500 },
    );
  }
}
