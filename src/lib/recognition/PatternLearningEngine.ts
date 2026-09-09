import {
  getActiveSessionId,
} from "@/lib/storage/AnalysisSessionStore";

import {
  getPatternResults,
} from "@/lib/storage/PatternHistoryStore";

import {
  getPatternLengthPerformance,
} from "@/lib/storage/PredictionPerformanceStore";

import type {
  TrainingLabel,
} from "@/lib/storage/TrainingDataset";

import {
  generatePredictions,
} from "@/lib/ai/GenerativePredictionEngine";

export type PatternPredictionOption = {
  result: TrainingLabel;
  confidence: number;
  score: number;
  matches: number;
  patternLengths: number[];
};

export type PatternPrediction = {
  /*
   * التوافق مع النظام القديم:
   * result = الخيار الأول.
   */
  result: TrainingLabel | null;

  /*
   * التوقع الأساسي الجديد:
   * أفضل خيارين مدعومين.
   */
  options: PatternPredictionOption[];

  confidence: number;
  samplesUsed: number;
  patternLength: number;
  matches: number;
  reason: string;
};

type Score = {
  result: TrainingLabel;
  score: number;
  matches: number;
  patternLengths: number[];
};

type PatternPerformance = {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

const PATTERN_LENGTHS = [6, 5, 4, 3];

const MIN_PATTERN_MATCHES = 2;

/*
 * عدد الاختبارات المطلوب قبل اعتبار
 * أداء الطول نفسه موثوقًا بشكل مباشر.
 */
const MIN_ADAPTIVE_TESTS = 8;

const MIN_ADAPTIVE_WEIGHT = 0.85;
const MAX_ADAPTIVE_WEIGHT = 1.15;

/*
 * ============================================================
 * INTERPOLATION
 * ============================================================
 *
 * إذا كان طول نمط معين لا يملك 8 اختبارات كافية،
 * نحاول تقدير قوة هذا الطول من أقرب أطوال لديها
 * بيانات كافية.
 *
 * مثال:
 *
 * نمط 2 = 40%
 * نمط 3 = لا توجد بيانات كافية
 * نمط 4 = 60%
 *
 * يتم تقدير نمط 3 بينهما بدل إعطائه وزنًا عشوائيًا.
 *
 * الاستيفاء هنا يقدّر "قوة الدليل" فقط،
 * ولا يخترع نتيجة جديدة.
 */

function accuracyToWeight(
  accuracy: number,
): number {
  const normalized =
    Math.max(
      0,
      Math.min(100, accuracy),
    ) / 100;

  const weight =
    1 +
    (normalized - 0.5) *
      0.6;

  return Math.min(
    MAX_ADAPTIVE_WEIGHT,
    Math.max(
      MIN_ADAPTIVE_WEIGHT,
      weight,
    ),
  );
}

function interpolatePerformanceWeight(
  patternLength: number,
  performance:
    Record<
      number,
      PatternPerformance
    >,
): number {
  const direct =
    performance[patternLength];

  /*
   * إذا كان الطول نفسه لديه 8 اختبارات
   * نستخدم أداءه الحقيقي مباشرة.
   */
  if (
    direct &&
    direct.total >=
      MIN_ADAPTIVE_TESTS
  ) {
    return accuracyToWeight(
      direct.accuracy,
    );
  }

  /*
   * البحث عن أقرب طول موثوق أصغر.
   */
  let lower:
    | {
        length: number;
        accuracy: number;
      }
    | undefined;

  let upper:
    | {
        length: number;
        accuracy: number;
      }
    | undefined;

  for (
    const [lengthText, item] of
      Object.entries(performance)
  ) {
    const length =
      Number(lengthText);

    if (
      !Number.isFinite(length) ||
      item.total <
        MIN_ADAPTIVE_TESTS
    ) {
      continue;
    }

    if (
      length <
        patternLength
    ) {
      if (
        !lower ||
        length >
          lower.length
      ) {
        lower = {
          length,
          accuracy:
            item.accuracy,
        };
      }
    }

    if (
      length >
        patternLength
    ) {
      if (
        !upper ||
        length <
          upper.length
      ) {
        upper = {
          length,
          accuracy:
            item.accuracy,
        };
      }
    }
  }

  /*
   * إذا وجدنا نقطتين:
   * نستعمل الاستيفاء الخطي.
   */
  if (lower && upper) {
    const progress =
      (
        patternLength -
        lower.length
      ) /
      (
        upper.length -
        lower.length
      );

    const interpolatedAccuracy =
      lower.accuracy +
      (
        upper.accuracy -
        lower.accuracy
      ) *
        progress;

    return accuracyToWeight(
      interpolatedAccuracy,
    );
  }

  /*
   * إذا وجدنا طولًا موثوقًا واحدًا فقط،
   * نستخدمه كمرجع قريب بدل تجاهل التعلم بالكامل.
   */
  const nearest =
    lower ?? upper;

  if (nearest) {
    return accuracyToWeight(
      nearest.accuracy,
    );
  }

  /*
   * لا توجد بيانات كافية.
   */
  return 1;
}

function adaptiveWeight(
  performance:
    | PatternPerformance
    | undefined,
): number {
  if (!performance) {
    return 1;
  }

  if (
    performance.total <
    MIN_ADAPTIVE_TESTS
  ) {
    return 1;
  }

  const smoothedAccuracy =
    (
      performance.correct + 4
    ) /
    (
      performance.total + 8
    );

  const weight =
    1 +
    (
      smoothedAccuracy - 0.5
    ) *
      0.6;

  return Math.min(
    MAX_ADAPTIVE_WEIGHT,
    Math.max(
      MIN_ADAPTIVE_WEIGHT,
      weight,
    ),
  );
}

function isSamePattern(
  sequence: TrainingLabel[],
  start: number,
  pattern: TrainingLabel[],
): boolean {
  if (
    start < 0 ||
    start + pattern.length >=
      sequence.length
  ) {
    return false;
  }

  for (
    let i = 0;
    i < pattern.length;
    i++
  ) {
    if (
      sequence[start + i] !==
      pattern[i]
    ) {
      return false;
    }
  }

  return true;
}

function findPatternScores(
  sequence: TrainingLabel[],
  currentPattern: TrainingLabel[],
  lengthWeight: number,
): Score[] {
  const scores =
    new Map<TrainingLabel, Score>();

  const patternLength =
    currentPattern.length;

  for (
    let start = 0;
    start + patternLength <
    sequence.length;
    start++
  ) {
    if (
      start + patternLength ===
      sequence.length
    ) {
      continue;
    }

    if (
      !isSamePattern(
        sequence,
        start,
        currentPattern,
      )
    ) {
      continue;
    }

    const next =
      sequence[
        start + patternLength
      ];

    if (!next) {
      continue;
    }

    const recency =
      0.75 +
      0.75 *
        (
          start /
          Math.max(
            sequence.length - 1,
            1,
          )
        );

    /*
     * Forecasting:
     *
     * كلما كان النمط أطول،
     * يصبح الدليل أكثر تحديدًا.
     */
    const baseLengthWeight =
      patternLength *
      patternLength;

    const weight =
      baseLengthWeight *
      recency *
      lengthWeight;

    const existing =
      scores.get(next);

    if (existing) {
      existing.score += weight;
      existing.matches += 1;

      if (
        !existing.patternLengths.includes(
          patternLength,
        )
      ) {
        existing.patternLengths.push(
          patternLength,
        );
      }
    } else {
      scores.set(next, {
        result: next,
        score: weight,
        matches: 1,
        patternLengths: [
          patternLength,
        ],
      });
    }
  }

  return Array.from(
    scores.values(),
  ).sort(
    (a, b) =>
      b.score - a.score,
  );
}

function collectPatternEvidence(
  sequence: TrainingLabel[],
  performance:
    Record<
      number,
      PatternPerformance
    >,
): {
  scores: Score[];
  bestPatternLength: number;
} {
  const combined =
    new Map<TrainingLabel, Score>();

  let bestPatternLength = 0;

  for (
    const patternLength of
      PATTERN_LENGTHS
  ) {
    if (
      sequence.length <=
      patternLength
    ) {
      continue;
    }

    const currentPattern =
      sequence.slice(
        -patternLength,
      );

    /*
     * أولًا نحاول استخدام أداء الطول نفسه.
     *
     * وإذا لم توجد بيانات كافية،
     * يستخدم Interpolation أقرب دليل موثوق.
     */
    const learnedWeight =
      performance[
        patternLength
      ] &&
      performance[
        patternLength
      ].total >=
        MIN_ADAPTIVE_TESTS
        ? adaptiveWeight(
            performance[
              patternLength
            ],
          )
        : interpolatePerformanceWeight(
            patternLength,
            performance,
          );

    const scores =
      findPatternScores(
        sequence,
        currentPattern,
        learnedWeight,
      );

    for (const item of scores) {
      const existing =
        combined.get(
          item.result,
        );

      if (existing) {
        existing.score +=
          item.score;

        existing.matches +=
          item.matches;

        for (
          const length of
            item.patternLengths
        ) {
          if (
            !existing.patternLengths.includes(
              length,
            )
          ) {
            existing.patternLengths.push(
              length,
            );
          }
        }
      } else {
        combined.set(
          item.result,
          {
            result: item.result,
            score: item.score,
            matches: item.matches,
            patternLengths: [
              ...item.patternLengths,
            ],
          },
        );
      }

      if (
        item.matches >=
          MIN_PATTERN_MATCHES &&
        patternLength >
          bestPatternLength
      ) {
        bestPatternLength =
          patternLength;
      }
    }
  }

  return {
    scores: Array.from(
      combined.values(),
    ).sort(
      (a, b) =>
        b.score - a.score,
    ),
    bestPatternLength,
  };
}

function confidenceFromScores(
  scores: Score[],
): number {
  if (!scores.length) {
    return 0;
  }

  const best = scores[0];

  if (!best) {
    return 0;
  }

  const second =
    scores[1]?.score ?? 0;

  const total =
    scores.reduce(
      (sum, item) =>
        sum + item.score,
      0,
    );

  if (total <= 0) {
    return 0;
  }

  const dominance =
    best.score /
    Math.max(
      best.score + second,
      0.0001,
    );

  const support =
    Math.min(
      best.matches / 6,
      1,
    );

  const distribution =
    best.score / total;

  return Math.round(
    Math.min(
      95,
      Math.max(
        0,
        dominance * 45 +
          support * 30 +
          distribution * 25,
      ),
    ),
  );
}

/*
 * ============================================================
 * FORECASTING ENGINE
 * ============================================================
 *
 * هذه هي نقطة التوقع الرئيسية.
 *
 * التاريخ الكامل
 * → الأنماط المتكررة
 * → أوزان التعلم
 * → Interpolation عند الحاجة
 * → Forecast
 */

export async function predictFromPatterns(
  sessionId?: string,
): Promise<PatternPrediction> {
  const [
    history,
    patternPerformance,
  ] = await Promise.all([
    getPatternResults(),
    getPatternLengthPerformance(),
  ]);

  const sequence =
    history.map(
      (item) => item.result,
    );

  if (sequence.length < 4) {
    return {
      result: null,
      options: [],
      confidence: 0,
      samplesUsed:
        sequence.length,
      patternLength: 0,
      matches: 0,
      reason:
        "نحتاج إلى 4 نتائج مؤكدة على الأقل لبداية تحليل الأنماط.",
    };
  }

  /*
   * Forecasting الأساسي:
   * البحث عن الأنماط المتكررة في التاريخ.
   */
  const {
    scores,
    bestPatternLength,
  } =
    collectPatternEvidence(
      sequence,
      patternPerformance,
    );

  const supported =
    scores.filter(
      (item) =>
        item.matches >=
        MIN_PATTERN_MATCHES,
    );

  const bestPattern =
    supported[0];

  if (bestPattern) {
    const baseConfidence =
      confidenceFromScores(
        supported,
      );

    const lengthBonus =
      bestPatternLength >= 6
        ? 5
        : bestPatternLength >= 5
          ? 4
          : bestPatternLength >= 4
            ? 3
            : 2;

    const forecastConfidence =
      Math.min(
        95,
        baseConfidence +
          lengthBonus,
      );

    /*
     * ========================================================
     * GENERATIVE MODEL → TOP-2
     * ========================================================
     */

    const forecastCandidates =
      supported.map(
        (item) => ({
          result: item.result,
          score: item.score,
          support: item.matches,
          source:
            "forecast" as const,
        }),
      );

    const patternCandidates =
      supported.map(
        (item) => ({
          result: item.result,
          score: item.score,
          support: item.matches,
          source:
            "pattern" as const,
        }),
      );

    const generative =
      generatePredictions({
        history: sequence,
        forecastCandidates,
        patternCandidates,
      });

    console.log(
      "🔎 TOP-2 DEBUG",
      {
        supported,
        generativeCandidates:
          generative.candidates,
      },
    );

    /*
     * Generative Model يعيد المرشحين المرتبين.
     *
     * نأخذ أفضل خيارين فقط.
     *
     * الخيار الثاني لا يظهر إلا إذا كان لديه
     * دعم تاريخي فعلي.
     */
    const generatedCandidates =
      generative.candidates
        .filter(
          (candidate) =>
            candidate.support >=
            MIN_PATTERN_MATCHES,
        )
        .slice(0, 2);

    /*
     * تحويل المرشحين إلى Prediction Options.
     */
    const maxScore =
      generatedCandidates[0]?.score ??
      0;

    const options =
      generatedCandidates.map(
        (candidate) => {
          const relativeConfidence =
            maxScore > 0
              ? Math.round(
                  (
                    candidate.score /
                    maxScore
                  ) * 100,
                )
              : 0;

          const confidence =
            Math.min(
              95,
              Math.max(
                1,
                Math.round(
                  forecastConfidence *
                    (
                      0.65 +
                      0.35 *
                        (
                          relativeConfidence /
                          100
                        )
                    ),
                ),
              ),
            );

          const sourcePattern =
            supported.find(
              (item) =>
                item.result ===
                candidate.result,
            );

          return {
            result:
              candidate.result,
            confidence,
            score:
              candidate.score,
            matches:
              candidate.support,
            patternLengths:
              sourcePattern
                ?.patternLengths ?? [],
          };
        },
      );

    /*
     * يجب وجود خيار أول مدعوم.
     */
    if (!options.length) {
      return {
        result: null,
        options: [],
        confidence: 0,
        samplesUsed:
          sequence.length,
        patternLength: 0,
        matches: 0,
        reason:
          "لا يوجد مرشح مدعوم بما يكفي لإعطاء توقع.",
      };
    }

    const firstOption =
      options[0];

    const finalPattern =
      supported.find(
        (item) =>
          item.result ===
          firstOption.result,
      ) ??
      bestPattern;

    const lengths =
      finalPattern.patternLengths
        .sort(
          (a, b) => b - a,
        )
        .join("، ");

    const learned =
      patternPerformance[
        bestPatternLength
      ];

    const learningText =
      learned &&
      learned.total >=
        MIN_ADAPTIVE_TESTS
        ? ` أداء هذا الطول تاريخيًا ${learned.accuracy}%.`
        : "";

    const interpolationText =
      !learned ||
      learned.total <
        MIN_ADAPTIVE_TESTS
        ? " تم دعم وزن هذا الطول بالاستيفاء من أقرب بيانات أداء موثوقة."
        : "";

    const optionText =
      options.length >= 2
        ? " تم العثور على خيارين مدعومين تاريخيًا."
        : " يوجد حاليًا خيار مدعوم واحد فقط؛ لم يتم اختراع خيار ثانٍ.";

    return {
      /*
       * التوافق مع ResultInputPanel وNeon:
       * result = الخيار الأول.
       */
      result:
        firstOption.result,

      options,

      confidence:
        firstOption.confidence,

      samplesUsed:
        sequence.length,

      patternLength:
        bestPatternLength,

      matches:
        firstOption.matches,

      reason:
        `Forecasting → Generative Model → Top-2: تطابق تاريخي للنمط بطول ${bestPatternLength} مع ${firstOption.matches} حالات مشابهة (الأطوال المدعومة: ${lengths}).${optionText} ${generative.reason}${learningText}${interpolationText}`,
    };
  }

  return {
    result: null,
    options: [],
    confidence: 0,
    samplesUsed:
      sequence.length,
    patternLength: 0,
    matches: 0,
    reason:
      "لا يوجد نمط تاريخي متكرر أو انتقال مدعوم بما يكفي لإعطاء توقع.",
  };
}
