import {
  getAllTrainingSamples,
  type TrainingLabel,
} from "@/lib/storage/TrainingDataset";

export interface VisualTemplate {
  label: TrainingLabel;
  samples: number;
  feature: number[];
}

export interface TemplatePrediction {
  result: TrainingLabel | null;
  confidence: number;
  samplesUsed: number;
}

type ROI = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const FEATURE_SIZE = 24;
const GRID_SIZE = 6;

/*
 * Latest-result area.
 *
 * This is intentionally kept compatible with the existing
 * GreedyCat camera layout.
 */
const LATEST_RESULT_ROI: ROI = {
  left: 0.84,
  top: 0.935,
  width: 0.11,
  height: 0.055,
};

/*
 * A slightly larger ROI is used as a fallback.
 * This helps when the result tile is shifted by a few pixels
 * because of camera scaling or device aspect ratio.
 */
const LATEST_RESULT_FALLBACK_ROI: ROI = {
  left: 0.80,
  top: 0.91,
  width: 0.17,
  height: 0.09,
};

function loadImage(
  dataUrl: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("IMAGE_LOAD_FAILED"));

    image.src = dataUrl;
  });
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, value));
}

async function cropROI(
  dataUrl: string,
  roi: ROI,
): Promise<HTMLCanvasElement> {
  const image = await loadImage(dataUrl);

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error("INVALID_IMAGE_DIMENSIONS");
  }

  const sx = clamp(
    Math.floor(sourceWidth * roi.left),
    0,
    sourceWidth - 1,
  );

  const sy = clamp(
    Math.floor(sourceHeight * roi.top),
    0,
    sourceHeight - 1,
  );

  const sw = clamp(
    Math.floor(sourceWidth * roi.width),
    1,
    sourceWidth - sx,
  );

  const sh = clamp(
    Math.floor(sourceHeight * roi.height),
    1,
    sourceHeight - sy,
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = FEATURE_SIZE;
  canvas.height = FEATURE_SIZE;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CANVAS_CONTEXT_FAILED");
  }

  /*
   * Image smoothing makes the feature less sensitive to
   * small camera-resolution differences.
   */
  ctx.imageSmoothingEnabled = true;

  ctx.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    FEATURE_SIZE,
    FEATURE_SIZE,
  );

  return canvas;
}

/*
 * Feature representation:
 *
 * Each 4x4 block contains:
 * - average R
 * - average G
 * - average B
 * - average luminance
 * - average chroma strength
 *
 * This provides more useful information than raw pixels while
 * remaining lightweight enough for browser-side processing.
 */
function canvasToFeature(
  canvas: HTMLCanvasElement,
): number[] {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CANVAS_CONTEXT_FAILED");
  }

  const data = ctx.getImageData(
    0,
    0,
    FEATURE_SIZE,
    FEATURE_SIZE,
  ).data;

  const pixels: Array<
    [number, number, number, number, number]
  > = [];

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    const chroma = max - min;

    pixels.push([
      r,
      g,
      b,
      gray,
      chroma,
    ]);
  }

  const feature: number[] = [];
  const block =
    FEATURE_SIZE / GRID_SIZE;

  for (
    let gy = 0;
    gy < GRID_SIZE;
    gy++
  ) {
    for (
      let gx = 0;
      gx < GRID_SIZE;
      gx++
    ) {
      let r = 0;
      let g = 0;
      let b = 0;
      let gray = 0;
      let chroma = 0;
      let count = 0;

      const startY =
        Math.floor(gy * block);

      const endY =
        Math.floor((gy + 1) * block);

      const startX =
        Math.floor(gx * block);

      const endX =
        Math.floor((gx + 1) * block);

      for (
        let y = startY;
        y < endY;
        y++
      ) {
        for (
          let x = startX;
          x < endX;
          x++
        ) {
          const index =
            y * FEATURE_SIZE + x;

          const pixel =
            pixels[index];

          if (!pixel) {
            continue;
          }

          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
          gray += pixel[3];
          chroma += pixel[4];
          count++;
        }
      }

      if (count > 0) {
        feature.push(
          r / count,
          g / count,
          b / count,
          gray / count,
          chroma / count,
        );
      }
    }
  }

  return normalizeFeature(feature);
}

/*
 * Normalize the complete feature vector.
 *
 * This reduces the effect of exposure differences between
 * camera captures.
 */
function normalizeFeature(
  feature: number[],
): number[] {
  if (!feature.length) {
    return [];
  }

  let mean = 0;

  for (const value of feature) {
    mean += value;
  }

  mean /= feature.length;

  let variance = 0;

  for (const value of feature) {
    const diff = value - mean;
    variance += diff * diff;
  }

  variance /= feature.length;

  const standardDeviation =
    Math.sqrt(variance) || 1;

  return feature.map(
    (value) =>
      (value - mean) /
      standardDeviation,
  );
}

async function extractFeature(
  dataUrl: string,
  roi: ROI,
): Promise<number[]> {
  const canvas =
    await cropROI(dataUrl, roi);

  return canvasToFeature(canvas);
}

function distance(
  a: number[],
  b: number[],
): number {
  const length =
    Math.min(a.length, b.length);

  if (!length) {
    return Number.POSITIVE_INFINITY;
  }

  let total = 0;

  for (
    let i = 0;
    i < length;
    i++
  ) {
    const diff =
      (a[i] ?? 0) -
      (b[i] ?? 0);

    total += diff * diff;
  }

  return Math.sqrt(
    total / length,
  );
}

function buildCentroid(
  features: number[][],
): number[] {
  if (!features.length) {
    return [];
  }

  const size =
    features[0]?.length ?? 0;

  const centroid =
    new Array<number>(size).fill(0);

  for (const feature of features) {
    for (
      let i = 0;
      i < size;
      i++
    ) {
      centroid[i] +=
        feature[i] ?? 0;
    }
  }

  for (
    let i = 0;
    i < size;
    i++
  ) {
    centroid[i] /=
      features.length;
  }

  return centroid;
}

/*
 * Build visual templates exclusively from manually labelled
 * samples.
 *
 * Automatic predictions are deliberately NOT used as training
 * labels. This prevents the classifier from teaching itself
 * its own mistakes.
 */
export async function buildVisualTemplates(): Promise<
  VisualTemplate[]
> {
  const samples =
    await getAllTrainingSamples();

  const labeled =
    samples.filter(
      (sample) =>
        sample.label !== null &&
        Boolean(sample.imageData),
    );

  const groups =
    new Map<
      TrainingLabel,
      number[][]
    >();

  for (const sample of labeled) {
    try {
      const feature =
        await extractFeature(
          sample.imageData,
          LATEST_RESULT_ROI,
        );

      if (!feature.length) {
        continue;
      }

      const list =
        groups.get(
          sample.label!,
        ) ?? [];

      list.push(feature);

      groups.set(
        sample.label!,
        list,
      );
    } catch (error) {
      console.error(
        "[TemplateLearning] Feature extraction failed:",
        error,
      );
    }
  }

  const templates: VisualTemplate[] =
    [];

  for (
    const [label, features]
    of groups
  ) {
    if (!features.length) {
      continue;
    }

    templates.push({
      label,
      samples: features.length,
      feature:
        buildCentroid(features),
    });
  }

  return templates;
}

function calculateConfidence(
  bestDistance: number,
  secondBestDistance: number,
): number {
  if (
    !Number.isFinite(bestDistance)
  ) {
    return 0;
  }

  /*
   * Distance is expected to be relatively small for a good
   * visual match.
   */
  const similarity =
    Math.max(
      0,
      Math.min(
        100,
        (1 -
          Math.min(
            bestDistance,
            1,
          )) *
          100,
      ),
    );

  const separation =
    Number.isFinite(
      secondBestDistance,
    )
      ? Math.max(
          0,
          Math.min(
            1,
            (secondBestDistance -
              bestDistance) /
              Math.max(
                secondBestDistance,
                0.0001,
              ),
          ),
        )
      : 1;

  return Math.round(
    similarity * 0.70 +
      separation * 100 * 0.30,
  );
}

/**
 * Compare a new image against learned templates.
 *
 * The classifier is conservative:
 * - insufficient labelled data => unknown
 * - weak visual match => unknown
 * - ambiguous classes => unknown
 */
export async function predictFromTemplates(
  imageData: string,
): Promise<TemplatePrediction> {
  if (!imageData) {
    return {
      result: null,
      confidence: 0,
      samplesUsed: 0,
    };
  }

  const templates =
    await buildVisualTemplates();

  const samplesUsed =
    templates.reduce(
      (sum, template) =>
        sum + template.samples,
      0,
    );

  if (
    templates.length === 0 ||
    samplesUsed < 2
  ) {
    return {
      result: null,
      confidence: 0,
      samplesUsed,
    };
  }

  let historyFeature: number[];

  try {
    historyFeature =
      await extractFeature(
        imageData,
        LATEST_RESULT_ROI,
      );
  } catch (error) {
    console.error(
      "[TemplateLearning] Primary ROI failed:",
      error,
    );

    return {
      result: null,
      confidence: 0,
      samplesUsed,
    };
  }

  let bestLabel:
    | TrainingLabel
    | null = null;

  let bestDistance =
    Number.POSITIVE_INFINITY;

  let secondBestDistance =
    Number.POSITIVE_INFINITY;

  for (const template of templates) {
    const currentDistance =
      distance(
        historyFeature,
        template.feature,
      );

    if (
      currentDistance <
      bestDistance
    ) {
      secondBestDistance =
        bestDistance;

      bestDistance =
        currentDistance;

      bestLabel =
        template.label;
    } else if (
      currentDistance <
      secondBestDistance
    ) {
      secondBestDistance =
        currentDistance;
    }
  }

  if (!bestLabel) {
    return {
      result: null,
      confidence: 0,
      samplesUsed,
    };
  }

  let confidence =
    calculateConfidence(
      bestDistance,
      secondBestDistance,
    );

  /*
   * If the primary ROI produces a weak result, try the larger
   * fallback ROI. The fallback is accepted only if it is
   * meaningfully stronger.
   */
  if (confidence < 65) {
    try {
      const fallbackFeature =
        await extractFeature(
          imageData,
          LATEST_RESULT_FALLBACK_ROI,
        );

      let fallbackLabel:
        | TrainingLabel
        | null = null;

      let fallbackBest =
        Number.POSITIVE_INFINITY;

      let fallbackSecond =
        Number.POSITIVE_INFINITY;

      for (
        const template of templates
      ) {
        const currentDistance =
          distance(
            fallbackFeature,
            template.feature,
          );

        if (
          currentDistance <
          fallbackBest
        ) {
          fallbackSecond =
            fallbackBest;

          fallbackBest =
            currentDistance;

          fallbackLabel =
            template.label;
        } else if (
          currentDistance <
          fallbackSecond
        ) {
          fallbackSecond =
            currentDistance;
        }
      }

      const fallbackConfidence =
        calculateConfidence(
          fallbackBest,
          fallbackSecond,
        );

      if (
        fallbackLabel &&
        fallbackConfidence >
          confidence
      ) {
        bestLabel =
          fallbackLabel;

        bestDistance =
          fallbackBest;

        secondBestDistance =
          fallbackSecond;

        confidence =
          fallbackConfidence;
      }
    } catch (error) {
      console.debug(
        "[TemplateLearning] Fallback ROI failed:",
        error,
      );
    }
  }

  /*
   * Never convert a weak/ambiguous visual match into a result.
   */
  if (
    confidence < 65
  ) {
    return {
      result: null,
      confidence,
      samplesUsed,
    };
  }

  return {
    result: bestLabel,
    confidence,
    samplesUsed,
  };
}
