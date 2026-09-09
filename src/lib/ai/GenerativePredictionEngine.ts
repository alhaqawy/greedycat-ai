import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

export type GenerativeCandidate = {
  result: TrainingLabel;
  score: number;
  support: number;
  source: "forecast" | "pattern" | "generation";
};

export type GenerativePredictionInput = {
  history: TrainingLabel[];
  forecastCandidates: GenerativeCandidate[];
  patternCandidates: GenerativeCandidate[];
};

export type GenerativePredictionOutput = {
  candidates: GenerativeCandidate[];
  selectedResult: TrainingLabel | null;
  confidence: number;
  reason: string;
};

const RESULTS: TrainingLabel[] = [
  "corn",
  "pepper",
  "tomato",
  "carrot",
  "shrimp",
  "fish",
  "cow",
  "chick",
];

const MIN_HISTORY = 3;
const MAX_CANDIDATES = 5;

/*
 * ============================================================
 * GENERATIVE MODEL
 * ============================================================
 *
 * لا يقوم هذا المحرك باختراع نتيجة مستقلة.
 *
 * وظيفته:
 *
 * Forecasting
 *     ↓
 * Pattern Evidence
 *     ↓
 * Candidate Generation
 *     ↓
 * Evidence Expansion
 *     ↓
 * Final Ranking
 *
 * كل نتيجة يجب أن تمتلك دعمًا تاريخيًا قبل دخول مرحلة
 * التوليد.
 */

/**
 * Normalize score values so that one source لا يطغى على
 * بقية المصادر بسبب اختلاف مقياس الدرجات.
 */
function normalizeScores(
  candidates: GenerativeCandidate[],
): GenerativeCandidate[] {
  if (!candidates.length) {
    return [];
  }

  const maxScore = Math.max(
    ...candidates.map((item) =>
      Math.max(item.score, 0),
    ),
  );

  if (maxScore <= 0) {
    return candidates.map((item) => ({
      ...item,
      score: 0,
    }));
  }

  return candidates.map((item) => ({
    ...item,
    score: item.score / maxScore,
  }));
}

/**
 * دمج الأدلة القادمة من Forecasting و Pattern Analysis.
 */
function mergeEvidence(
  forecastCandidates: GenerativeCandidate[],
  patternCandidates: GenerativeCandidate[],
): Map<TrainingLabel, GenerativeCandidate> {
  const evidence =
    new Map<TrainingLabel, GenerativeCandidate>();

  const add = (
    candidate: GenerativeCandidate,
    multiplier: number,
  ) => {
    const contribution =
      Math.max(candidate.score, 0) *
      multiplier;

    const existing =
      evidence.get(candidate.result);

    if (existing) {
      existing.score += contribution;
      existing.support += candidate.support;

      if (
        candidate.source === "forecast" &&
        existing.source !== "forecast"
      ) {
        existing.source = "forecast";
      }

      return;
    }

    evidence.set(candidate.result, {
      result: candidate.result,
      score: contribution,
      support: candidate.support,
      source: candidate.source,
    });
  };

  const normalizedForecast =
    normalizeScores(
      forecastCandidates,
    );

  const normalizedPatterns =
    normalizeScores(
      patternCandidates,
    );

  /*
   * Forecasting هو الدليل الأساسي.
   */
  for (const candidate of normalizedForecast) {
    add(candidate, 1.0);
  }

  /*
   * Pattern Analysis دليل داعم.
   */
  for (const candidate of normalizedPatterns) {
    add(candidate, 0.7);
  }

  return evidence;
}

/**
 * استخراج خصائص بسيطة من نهاية السجل.
 *
 * هذه ليست نتيجة جديدة؛ تستخدم فقط لتقدير قوة المرشح
 * الموجود أصلًا في الأدلة.
 */
function sequenceFeatures(
  history: TrainingLabel[],
): Map<TrainingLabel, number> {
  const features =
    new Map<TrainingLabel, number>();

  if (!history.length) {
    return features;
  }

  const recentWindow =
    history.slice(-12);

  for (const result of recentWindow) {
    features.set(
      result,
      (features.get(result) ?? 0) + 1,
    );
  }

  return features;
}

/**
 * Generative expansion:
 *
 * لا يضيف نتائج جديدة من RESULTS.
 * بل يعيد تقييم المرشحين المدعومين أصلًا باستخدام
 * السياق القريب من نهاية السجل.
 */
function generateCandidateWeights(
  history: TrainingLabel[],
  evidence: Map<
    TrainingLabel,
    GenerativeCandidate
  >,
): GenerativeCandidate[] {
  const features =
    sequenceFeatures(history);

  const generated: GenerativeCandidate[] = [];

  for (const candidate of evidence.values()) {
    const recentFrequency =
      features.get(candidate.result) ?? 0;

    /*
     * عامل سياقي محدود جدًا.
     *
     * الهدف منه تحسين ترتيب المرشحين، وليس تحويل
     * التكرار القريب إلى توقع مؤكد.
     */
    const contextFactor =
      recentFrequency > 0
        ? 1 +
          Math.min(
            recentFrequency,
            4,
          ) *
            0.025
        : 1;

    generated.push({
      result: candidate.result,
      score:
        candidate.score *
        contextFactor,
      support:
        candidate.support,
      source: "generation",
    });
  }

  return generated;
}

/**
 * Evidence Fusion داخل Generative Model.
 */
function fuseGeneratedEvidence(
  baseEvidence: Map<
    TrainingLabel,
    GenerativeCandidate
  >,
  generatedCandidates: GenerativeCandidate[],
): GenerativeCandidate[] {
  const fused =
    new Map<TrainingLabel, GenerativeCandidate>();

  for (const candidate of baseEvidence.values()) {
    fused.set(candidate.result, {
      result: candidate.result,
      score: candidate.score,
      support: candidate.support,
      source: candidate.source,
    });
  }

  for (const candidate of generatedCandidates) {
    const existing =
      fused.get(candidate.result);

    if (!existing) {
      continue;
    }

    /*
     * التوليد يمثل طبقة مساعدة فقط.
     */
    existing.score +=
      candidate.score * 0.25;

    existing.support = Math.max(
      existing.support,
      candidate.support,
    );
  }

  return Array.from(
    fused.values(),
  )
    .filter(
      (item) =>
        item.support > 0 &&
        RESULTS.includes(item.result),
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(0, MAX_CANDIDATES);
}

function calculateConfidence(
  candidates: GenerativeCandidate[],
): number {
  if (!candidates.length) {
    return 0;
  }

  const total =
    candidates.reduce(
      (sum, item) =>
        sum + Math.max(item.score, 0),
      0,
    );

  if (total <= 0) {
    return 0;
  }

  const best =
    candidates[0];

  if (!best) {
    return 0;
  }

  const second =
    candidates[1]?.score ?? 0;

  const distribution =
    best.score / total;

  const dominance =
    best.score /
    Math.max(
      best.score + second,
      0.0001,
    );

  const support =
    Math.min(
      best.support / 6,
      1,
    );

  /*
   * المزج يعطي أهمية للتوزيع + تفوق المرشح + الدعم.
   */
  return Math.round(
    Math.min(
      95,
      Math.max(
        0,
        distribution * 35 +
          dominance * 40 +
          support * 25,
      ),
    ),
  );
}

export function generatePredictions(
  input: GenerativePredictionInput,
): GenerativePredictionOutput {
  const {
    history,
    forecastCandidates,
    patternCandidates,
  } = input;

  if (history.length < MIN_HISTORY) {
    return {
      candidates: [],
      selectedResult: null,
      confidence: 0,
      reason:
        "Generative Model يحتاج إلى سجل نتائج كافٍ.",
    };
  }

  /*
   * 1. Evidence Fusion
   */
  const baseEvidence =
    mergeEvidence(
      forecastCandidates,
      patternCandidates,
    );

  if (!baseEvidence.size) {
    return {
      candidates: [],
      selectedResult: null,
      confidence: 0,
      reason:
        "Generative Model لم يجد أدلة مدعومة من Forecasting أو Pattern Analysis.",
    };
  }

  /*
   * 2. Candidate Generation
   */
  const generated =
    generateCandidateWeights(
      history,
      baseEvidence,
    );

  /*
   * 3. Final Evidence Fusion
   */
  const candidates =
    fuseGeneratedEvidence(
      baseEvidence,
      generated,
    );

  if (!candidates.length) {
    return {
      candidates: [],
      selectedResult: null,
      confidence: 0,
      reason:
        "لم يتم العثور على مرشحين مدعومين.",
    };
  }

  const selected =
    candidates[0];

  const confidence =
    calculateConfidence(
      candidates,
    );

  return {
    candidates,
    selectedResult:
      selected?.result ?? null,
    confidence,
    reason:
      `Generative Model: تم توليد وترتيب ${candidates.length} مرشحين اعتمادًا على Forecasting وتحليل الأنماط والسياق الأخير للسجل.`,
  };
}
