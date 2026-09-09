"use client";

import { useState } from "react";
import { useCamera } from "@/components/camera/CameraService";
import {
  saveTrainingSample,
  updateTrainingLabel,
  type TrainingLabel,
} from "@/lib/storage/TrainingDataset";

const LABELS: {
  id: TrainingLabel;
  name: string;
  emoji: string;
  multiplier: number;
}[] = [
  { id: "corn", name: "ذرة", emoji: "🌽", multiplier: 5 },
  { id: "pepper", name: "فلفل", emoji: "🌶️", multiplier: 5 },
  { id: "tomato", name: "طماط", emoji: "🍅", multiplier: 5 },
  { id: "carrot", name: "جزر", emoji: "🥕", multiplier: 5 },
  { id: "shrimp", name: "ربيان", emoji: "🦐", multiplier: 10 },
  { id: "fish", name: "سمك", emoji: "🐟", multiplier: 25 },
  { id: "cow", name: "بقر", emoji: "🐄", multiplier: 15 },
  { id: "chick", name: "كتكوت", emoji: "🐔", multiplier: 45 },
];

export default function DataCapturePanel() {
  const { lastCapture, lastRoundNumber, lastOCR } = useCamera();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const saveLabel = async (label: TrainingLabel) => {
    if (!lastCapture?.imageData || !lastRoundNumber) {
      setMessage("لا توجد لقطة صالحة للحفظ");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await saveTrainingSample({
        roundNumber: lastRoundNumber,
        label,
        imageData: lastCapture.imageData,
        ocrConfidence: lastOCR?.confidence ?? 0,
        rawOCR: lastOCR?.rawText ?? "",
      });

      setMessage("تم حفظ الجولة بنجاح");
    } catch (error) {
      if (error instanceof Error && error.message === "ROUND_ALREADY_EXISTS") {
        try {
          await updateTrainingLabel(lastRoundNumber, label);
          setMessage("تم تحديث تصنيف الجولة");
        } catch {
          setMessage("تعذر تحديث الجولة");
        }
      } else {
        console.error(error);
        setMessage("حدث خطأ أثناء حفظ البيانات");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-3 2xl:p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">تصنيف الجولة</h3>
          <p className="mt-1 text-sm text-white/50">
            احفظ النتيجة الفعلية لتكوين بيانات التدريب
          </p>
        </div>

        {lastRoundNumber && (
          <div className="rounded-xl bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/40">الجولة</span>{" "}
            <span className="font-bold text-white">{lastRoundNumber}</span>
          </div>
        )}
      </div>

      {lastCapture?.imageData ? (
        <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black">
          <img
            src={lastCapture.imageData}
            alt="آخر لقطة"
            className="max-h-40 w-full object-contain md:max-h-40 2xl:max-h-64"
          />
        </div>
      ) : (
        <div className="mb-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/40">
          سيتم عرض آخر لقطة هنا بعد التحليل
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        {LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={saving || !lastCapture?.imageData}
            onClick={() => saveLabel(item.id)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="text-xl md:text-2xl">{item.emoji}</div>

            <div className="mt-0.5 text-xs font-semibold text-white md:text-sm">
              {item.name}
            </div>

            <div className="text-xs text-white/40">
              ×{item.multiplier}
            </div>
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/70">
          {message}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/40">
        <div className="rounded-lg bg-white/[0.03] p-2">
          OCR: {lastOCR?.confidence?.toFixed(1) ?? "0"}%
        </div>

        <div className="rounded-lg bg-white/[0.03] p-2">
          الحالة: {saving ? "جارٍ الحفظ..." : "جاهز"}
        </div>
      </div>
    </div>
  );
}
