import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

export type PredictionPerformanceItem = {
  id: string;

  // Top-1 — التوقع الأساسي
  predictedResult: TrainingLabel;
  confidence: number;
  correct: boolean;

  // Top-2 — الخيار الثاني، اختياري للحفاظ على السجلات القديمة
  secondPredictedResult?: TrainingLabel;
  secondConfidence?: number;
  secondCorrect?: boolean;

  actualResult: TrainingLabel;
  patternLength: number;
  matches: number;
  samplesUsed: number;
  createdAt: string;
};

const DB_NAME = "greedycat-ai-performance";
const DB_VERSION = 1;
const STORE_NAME = "prediction_results";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });

        store.createIndex("createdAt", "createdAt", {
          unique: false,
        });

        store.createIndex("correct", "correct", {
          unique: false,
        });

        store.createIndex("patternLength", "patternLength", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ??
          new Error("تعذر فتح قاعدة أداء التوقعات."),
      );
  });
}

export async function savePredictionPerformance(
  data: {
    predictedResult: TrainingLabel;
    confidence: number;
    secondPredictedResult?: TrainingLabel;
    secondConfidence?: number;
    actualResult: TrainingLabel;
    patternLength: number;
    matches: number;
    samplesUsed: number;
  },
): Promise<PredictionPerformanceItem> {
  const db = await openDB();

  const item: PredictionPerformanceItem = {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,

    predictedResult: data.predictedResult,
    confidence: data.confidence,

    secondPredictedResult:
      data.secondPredictedResult,
    secondConfidence:
      data.secondConfidence,

    actualResult: data.actualResult,

    correct:
      data.predictedResult ===
      data.actualResult,

    secondCorrect:
      data.secondPredictedResult
        ? data.secondPredictedResult ===
          data.actualResult
        : undefined,

    patternLength: data.patternLength,
    matches: data.matches,
    samplesUsed: data.samplesUsed,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).add(item);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر حفظ أداء التوقع."),
      );
  });

  db.close();

  return item;
}

export async function getPredictionPerformance(): Promise<
  PredictionPerformanceItem[]
> {
  const db = await openDB();

  const items = await new Promise<
    PredictionPerformanceItem[]
  >((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly",
    );

    const request = transaction
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => {
      resolve(
        (
          request.result as PredictionPerformanceItem[]
        ).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        ),
      );
    };

    request.onerror = () =>
      reject(
        request.error ??
          new Error("تعذر قراءة أداء التوقعات."),
      );
  });

  db.close();

  return items;
}

export async function getPredictionPerformanceStats(): Promise<{
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}> {
  const items =
    await getPredictionPerformance();

  const correct = items.filter(
    (item) => item.correct,
  ).length;

  const incorrect =
    items.length - correct;

  return {
    total: items.length,
    correct,
    incorrect,
    accuracy:
      items.length > 0
        ? Number(
            (
              (correct / items.length) *
              100
            ).toFixed(1),
          )
        : 0,
  };
}

export async function getPatternLengthPerformance(): Promise<
  Record<
    number,
    {
      total: number;
      correct: number;
      incorrect: number;
      accuracy: number;
    }
  >
> {
  const items =
    await getPredictionPerformance();

  const result: Record<
    number,
    {
      total: number;
      correct: number;
      incorrect: number;
      accuracy: number;
    }
  > = {};

  for (const item of items) {
    const length = item.patternLength;

    if (!result[length]) {
      result[length] = {
        total: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
      };
    }

    result[length].total += 1;

    if (item.correct) {
      result[length].correct += 1;
    } else {
      result[length].incorrect += 1;
    }
  }

  for (const length of Object.keys(result)) {
    const item = result[Number(length)];

    if (!item) continue;

    item.accuracy =
      item.total > 0
        ? Number(
            (
              (item.correct / item.total) *
              100
            ).toFixed(1),
          )
        : 0;
  }

  return result;
}

export async function getTop2PredictionPerformanceStats(): Promise<{
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}> {
  const items =
    await getPredictionPerformance();

  // السجلات القديمة لا تحتوي Top-2، لذلك لا تدخل في إحصائية Top-2.
  const top2Items = items.filter(
    (item) =>
      item.secondPredictedResult !== undefined,
  );

  const correct = top2Items.filter(
    (item) => item.secondCorrect === true,
  ).length;

  const incorrect =
    top2Items.length - correct;

  return {
    total: top2Items.length,
    correct,
    incorrect,
    accuracy:
      top2Items.length > 0
        ? Number(
            (
              (correct / top2Items.length) *
              100
            ).toFixed(1),
          )
        : 0,
  };
}

export async function clearPredictionPerformance(): Promise<void> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).clear();

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("تعذر مسح أداء التوقعات."),
      );
  });

  db.close();
}
