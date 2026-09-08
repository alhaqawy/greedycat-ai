"use client";

import { createWorker, PSM } from "tesseract.js";

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getWorker() {
  if (worker) return worker;

  if (!workerPromise) {
    workerPromise = (async () => {
      const instance = await createWorker("eng");

      await instance.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });

      worker = instance;
      return instance;
    })();
  }

  return workerPromise;
}

function cropRoundRegion(
  source: HTMLVideoElement | HTMLCanvasElement
): HTMLCanvasElement {
  const width =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.width;

  const height =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.height;

  const canvas = document.createElement("canvas");

  /*
   * منطقة رقم الجولة:
   * أعلى شاشة GreedyCat.
   *
   * نترك هامشًا حول الرقم حتى يتحمل
   * اختلاف بسيط في زاوية ومسافة الكاميرا.
   */
  const sx = Math.floor(width * 0.25);
  const sy = Math.floor(height * 0.035);
  const sw = Math.floor(width * 0.50);
  const sh = Math.floor(height * 0.10);

  canvas.width = sw * 3;
  canvas.height = sh * 3;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("تعذر إنشاء Canvas لمعالجة صورة الجولة");
  }

  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height
  );

  /*
   * تحسين الصورة قبل OCR.
   */
  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    const value = gray > 145 ? 255 : 0;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);

  return canvas;
}

function normalizeRoundNumber(text: string): number | null {
  const digits = text.replace(/\D/g, "");

  if (!digits) return null;

  const number = Number(digits);

  /*
   * رقم الجولة في GreedyCat يجب أن يكون
   * رقمًا موجبًا ومعقول الطول.
   */
  if (!Number.isInteger(number)) return null;

  if (digits.length < 4 || digits.length > 12) {
    return null;
  }

  return number;
}

export type RoundOCRResult = {
  roundNumber: number | null;
  rawText: string;
  confidence: number;
  success: boolean;
};

export async function recognizeRound(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<RoundOCRResult> {
  try {
    const ocrWorker = await getWorker();

    const cropped = cropRoundRegion(source);

    const result = await ocrWorker.recognize(cropped);

    const rawText = result.data.text.trim();
    const confidence = Number(result.data.confidence || 0);

    const roundNumber = normalizeRoundNumber(rawText);

    return {
      roundNumber,
      rawText,
      confidence,
      success:
        roundNumber !== null &&
        confidence >= 35,
    };
  } catch (error) {
    console.error("Round OCR error:", error);

    return {
      roundNumber: null,
      rawText: "",
      confidence: 0,
      success: false,
    };
  }
}

export async function terminateRoundOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }

  workerPromise = null;
}
