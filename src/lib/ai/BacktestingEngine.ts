import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

export type BacktestResult = {
  totalTests: number;
  patternAnalysis: Record<
    number,
    {
      uniquePatterns: number;
      repeatedPatterns: number;
      strongestPattern: {
        pattern: TrainingLabel[];
        occurrences: number;
      } | null;
    }
  >;
  forecastPredictions: number;
  forecastCorrect: number;
  forecastAccuracy: number;
  generativePredictions: number;
  generativeCorrect: number;
  generativeAccuracy: number;
  improvement: number;
  byPatternLength: Record<
    number,
    {
      available: number;
      predictions: number;
      correct: number;
      accuracy: number;
    }
  >;
};

const PATTERN_LENGTHS = [3, 4, 5, 6] as const;
const MIN_MATCHES = 2;

type Candidate = {
  result: TrainingLabel;
  score: number;
  matches: number;
};

function findCandidates(
  history: TrainingLabel[],
  patternLength: number,
): Candidate[] {
  if (history.length <= patternLength) {
    return [];
  }

  const pattern =
    history.slice(-patternLength);

  const candidates =
    new Map<TrainingLabel, Candidate>();

  for (
    let start = 0;
    start + patternLength < history.length;
    start++
  ) {
    let match = true;

    for (
      let i = 0;
      i < patternLength;
      i++
    ) {
      if (
        history[start + i] !==
        pattern[i]
      ) {
        match = false;
        break;
      }
    }

    if (!match) {
      continue;
    }

    const next =
      history[start + patternLength];

    if (!next) {
      continue;
    }

    const existing =
      candidates.get(next);

    const score =
      patternLength *
      patternLength;

    if (existing) {
      existing.matches++;
      existing.score += score;
    } else {
      candidates.set(next, {
        result: next,
        score,
        matches: 1,
      });
    }
  }

  return [...candidates.values()]
    .filter(
      (candidate) =>
        candidate.matches >=
        MIN_MATCHES,
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    );
}

function forecastForLength(
  history: TrainingLabel[],
  patternLength: number,
): Candidate | null {
  const candidates =
    findCandidates(
      history,
      patternLength,
    );

  return candidates[0] ?? null;
}

/**
 * Generative ranking.
 *
 * لا يضيف نتائج غير موجودة في الأدلة.
 * يعيد ترتيب المرشحين المدعومين فقط.
 */
function generativeForLength(
  history: TrainingLabel[],
  patternLength: number,
): Candidate | null {
  const candidates =
    findCandidates(
      history,
      patternLength,
    );

  if (!candidates.length) {
    return null;
  }

  const recent =
    history.slice(-12);

  const ranked =
    candidates.map(
      (candidate) => {
        const frequency =
          recent.filter(
            (result) =>
              result ===
              candidate.result,
          ).length;

        const contextFactor =
          1 +
          Math.min(
            frequency,
            4,
          ) *
            0.025;

        return {
          ...candidate,
          score:
            candidate.score *
            contextFactor,
        };
      },
    );

  ranked.sort(
    (a, b) =>
      b.score - a.score,
  );

  return ranked[0] ?? null;
}

function percentage(
  correct: number,
  total: number,
): number {
  if (!total) {
    return 0;
  }

  return Math.round(
    (correct / total) * 1000,
  ) / 10;
}


function analyzePatterns(
  sequence: TrainingLabel[],
): BacktestResult["patternAnalysis"] {
  const result: BacktestResult["patternAnalysis"] = {
    3: {
      uniquePatterns: 0,
      repeatedPatterns: 0,
      strongestPattern: null,
    },
    4: {
      uniquePatterns: 0,
      repeatedPatterns: 0,
      strongestPattern: null,
    },
    5: {
      uniquePatterns: 0,
      repeatedPatterns: 0,
      strongestPattern: null,
    },
    6: {
      uniquePatterns: 0,
      repeatedPatterns: 0,
      strongestPattern: null,
    },
  };

  for (const length of PATTERN_LENGTHS) {
    const counts =
      new Map<string, {
        pattern: TrainingLabel[];
        occurrences: number;
      }>();

    for (
      let i = 0;
      i + length <= sequence.length;
      i++
    ) {
      const pattern =
        sequence.slice(i, i + length);

      const key =
        pattern.join("|");

      const existing =
        counts.get(key);

      if (existing) {
        existing.occurrences++;
      } else {
        counts.set(key, {
          pattern,
          occurrences: 1,
        });
      }
    }

    const repeated =
      [...counts.values()]
        .filter(
          (item) =>
            item.occurrences >= 2,
        )
        .sort(
          (a, b) =>
            b.occurrences -
            a.occurrences,
        );

    result[length].uniquePatterns =
      counts.size;

    result[length].repeatedPatterns =
      repeated.length;

    result[length].strongestPattern =
      repeated[0] ?? null;
  }

  return result;
}

export function runBacktest(
  sequence: TrainingLabel[],
): BacktestResult {
  let forecastPredictions = 0;
  let forecastCorrect = 0;

  let generativePredictions = 0;
  let generativeCorrect = 0;

  const byPatternLength: BacktestResult["byPatternLength"] =
    {
      3: {
        available: 0,
        predictions: 0,
        correct: 0,
        accuracy: 0,
      },
      4: {
        available: 0,
        predictions: 0,
        correct: 0,
        accuracy: 0,
      },
      5: {
        available: 0,
        predictions: 0,
        correct: 0,
        accuracy: 0,
      },
      6: {
        available: 0,
        predictions: 0,
        correct: 0,
        accuracy: 0,
      },
    };

  /*
   * Walk-forward:
   *
   * كل نتيجة يتم إخفاؤها،
   * ثم نستخدم التاريخ السابق فقط.
   *
   * يبدأ من index = 3 لأن أقصر نمط لدينا هو 3.
   */
  for (
    let index = 3;
    index < sequence.length;
    index++
  ) {
    const history =
      sequence.slice(0, index);

    const actual =
      sequence[index];

    /*
     * كل Pattern Length يتم اختباره بشكل مستقل.
     */
    for (const length of PATTERN_LENGTHS) {
      if (history.length < length + 1) {
        continue;
      }

      const forecast =
        forecastForLength(
          history,
          length,
        );

      if (!forecast) {
        continue;
      }

      byPatternLength[length].available++;

      /*
       * Forecasting
       */
      forecastPredictions++;

      byPatternLength[length].predictions++;

      if (
        forecast.result === actual
      ) {
        forecastCorrect++;
        byPatternLength[length].correct++;
      }

      /*
       * Generative Model
       */
      const generated =
        generativeForLength(
          history,
          length,
        );

      if (generated) {
        generativePredictions++;

        if (
          generated.result === actual
        ) {
          generativeCorrect++;
        }
      }
    }
  }

  for (const length of PATTERN_LENGTHS) {
    const item =
      byPatternLength[length];

    item.accuracy =
      percentage(
        item.correct,
        item.predictions,
      );
  }

  const forecastAccuracy =
    percentage(
      forecastCorrect,
      forecastPredictions,
    );

  const generativeAccuracy =
    percentage(
      generativeCorrect,
      generativePredictions,
    );

  return {
    totalTests:
      Math.max(
        0,
        sequence.length - 3,
      ),

    patternAnalysis:
      analyzePatterns(sequence),
    forecastPredictions,
    forecastCorrect,
    forecastAccuracy,
    generativePredictions,
    generativeCorrect,
    generativeAccuracy,
    improvement:
      Math.round(
        (
          generativeAccuracy -
          forecastAccuracy
        ) * 10,
      ) / 10,
    byPatternLength,
  };
}
