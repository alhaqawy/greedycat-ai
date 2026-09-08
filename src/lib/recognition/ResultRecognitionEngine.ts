"use client";

export const GREEDYCAT_RESULTS = [
  {
    id: "corn",
    name: "ذرة",
    emoji: "🌽",
    multiplier: 5,
  },
  {
    id: "pepper",
    name: "فلفل",
    emoji: "🌶️",
    multiplier: 5,
  },
  {
    id: "tomato",
    name: "طماطم",
    emoji: "🍅",
    multiplier: 5,
  },
  {
    id: "carrot",
    name: "جزر",
    emoji: "🥕",
    multiplier: 5,
  },
  {
    id: "shrimp",
    name: "ربيان",
    emoji: "🦐",
    multiplier: 10,
  },
  {
    id: "fish",
    name: "سمك",
    emoji: "🐟",
    multiplier: 25,
  },
  {
    id: "cow",
    name: "بقر",
    emoji: "🐄",
    multiplier: 15,
  },
  {
    id: "chick",
    name: "كتكوت",
    emoji: "🐔",
    multiplier: 45,
  },
] as const;

export type GreedyCatResult =
  (typeof GREEDYCAT_RESULTS)[number]["id"];

export type ResultRecognition = {
  result: GreedyCatResult | null;
  name: string | null;
  emoji: string | null;
  confidence: number;
  success: boolean;
  method: "model" | "template" | "unknown";
  timestamp: string;
};

export type RecognitionInput = {
  image: HTMLCanvasElement | HTMLImageElement | ImageBitmap;
};

/*
 * هذه الطبقة هي الواجهة الموحدة لمحرك التعرف.
 *
 * حاليًا لا نسجل نتيجة إذا لم يكن هناك نموذج
 * بصري موثوق متاح.
 *
 * لاحقًا يمكن تركيب:
 * 1. TensorFlow.js
 * 2. نموذج تصنيف GreedyCat مدرب
 * 3. Template Matching
 * بدون تغيير بقية النظام.
 */
export async function recognizeResult(
  input: RecognitionInput
): Promise<ResultRecognition> {
  void input;

  return {
    result: null,
    name: null,
    emoji: null,
    confidence: 0,
    success: false,
    method: "unknown",
    timestamp: new Date().toISOString(),
  };
}

export function getResultById(
  id: GreedyCatResult
) {
  return GREEDYCAT_RESULTS.find(
    (item) => item.id === id
  ) ?? null;
}

export function isValidResult(
  value: string
): value is GreedyCatResult {
  return GREEDYCAT_RESULTS.some(
    (item) => item.id === value
  );
}
