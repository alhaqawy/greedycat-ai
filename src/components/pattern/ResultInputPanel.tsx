"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { predictFromPatterns } from "@/lib/recognition/PatternLearningEngine";
import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

import {
  addPatternResult,
  clearPatternHistory,
  getPatternResults,
  removePatternResultById,
} from "@/lib/storage/PatternHistoryStore";

import { savePredictionPerformance } from "@/lib/storage/PredictionPerformanceStore";
import {
  getActiveSessionId,
} from "@/lib/storage/AnalysisSessionStore";

const RESULTS: {
  label: TrainingLabel;
  emoji: string;
  name: string;
}[] = [
  { label: "corn", emoji: "🌽", name: "ذرة" },
  { label: "pepper", emoji: "🌶️", name: "فلفل" },
  { label: "tomato", emoji: "🍅", name: "طماط" },
  { label: "carrot", emoji: "🥕", name: "جزر" },
  { label: "shrimp", emoji: "🦐", name: "ربيان" },
  { label: "fish", emoji: "🐟", name: "سمك" },
  { label: "cow", emoji: "🐄", name: "بقر" },
  { label: "chick", emoji: "🐔", name: "كتكوت" },
];

export default function ResultInputPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const addResult = async (label: TrainingLabel) => {
    if (saving) return;

    setSaving(true);

    try {
      /*
       * الحصول على جلسة التحليل الحالية.
       *
       * إذا كانت هناك فترة توقف 5 دقائق أو أكثر،
       * يتم إنشاء Session جديدة تلقائيًا.
       */
      const sessionId = getActiveSessionId();

      const previousPrediction =
        await predictFromPatterns(sessionId);

      /*
       * نستخدم نفس resultId محليًا وفي Neon.
       * هذا يسمح بالتراجع عن نفس السجل السحابي بدقة.
       */
      const resultId = `result-${crypto.randomUUID()}`;

      /*
       * الحفظ المحلي أولًا.
       * لا ننتظر Neon حتى لا يتعطل إدخال النتيجة.
       */
      await addPatternResult(
        label,
        resultId,
        sessionId,
      );

      /*
       * تسجيل أداء التوقع محليًا.
       *
       * النظام الجديد يسجل أفضل خيارين في سجل واحد:
       * 🥇 Top-1
       * 🥈 Top-2
       *
       * إذا لم يوجد Top-2، يبقى الحقل اختياريًا.
       */
      const predictionOptions =
        previousPrediction.options?.slice(0, 2) ?? [];

      if (predictionOptions.length > 0) {
        const firstOption = predictionOptions[0];
        const secondOption = predictionOptions[1];

        await savePredictionPerformance({
          predictedResult: firstOption.result,
          confidence: firstOption.confidence,

          secondPredictedResult:
            secondOption?.result,

          secondConfidence:
            secondOption?.confidence,

          actualResult: label,

          patternLength:
            Math.max(
              ...(firstOption.patternLengths ?? []),
              previousPrediction.patternLength,
            ),

          matches: firstOption.matches,

          samplesUsed:
            previousPrediction.samplesUsed,
        });
      } else if (previousPrediction.result) {
        /*
         * توافق مع أي توقع قديم لا يحتوي options.
         */
        await savePredictionPerformance({
          predictedResult: previousPrediction.result,
          confidence: previousPrediction.confidence,
          actualResult: label,
          patternLength: previousPrediction.patternLength,
          matches: previousPrediction.matches,
          samplesUsed: previousPrediction.samplesUsed,
        });
      }

      /*
       * مزامنة النتيجة مع Neon.
       * فشل Neon لا يحذف النتيجة المحلية.
       */
      const response = await fetch("/api/greedycat/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          resultId,
          result: label,
          sessionId,
          prediction:
            previousPrediction.options?.length
              ? {
                  predictedResult:
                    previousPrediction.options[0].result,
                  confidence:
                    previousPrediction.options[0].confidence,

                  secondPredictedResult:
                    previousPrediction.options[1]?.result,

                  secondConfidence:
                    previousPrediction.options[1]?.confidence,

                  patternLength:
                    Math.max(
                      ...(previousPrediction.options[0]
                        .patternLengths ?? []),
                      previousPrediction.patternLength,
                    ),

                  matches:
                    previousPrediction.options[0].matches,

                  samplesUsed:
                    previousPrediction.samplesUsed,
                }
              : previousPrediction.result
                ? {
                    predictedResult:
                      previousPrediction.result,
                    confidence:
                      previousPrediction.confidence,
                    patternLength:
                      previousPrediction.patternLength,
                    matches:
                      previousPrediction.matches,
                    samplesUsed:
                      previousPrediction.samplesUsed,
                  }
                : null,
        }),
      });

      const text = await response.text();

      let data: {
        success?: boolean;
        error?: string;
        resultId?: string;
        result?: string;
        predictionSaved?: boolean;
        performanceSaved?: boolean;
      } | null = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      console.log("☁️ Neon response:", {
        status: response.status,
        ok: response.ok,
        data,
        responseText: text,
      });

      if (!response.ok || data?.success !== true) {
        console.error("Neon synchronization failed:", {
          status: response.status,
          response: text,
          data,
        });

        window.alert(
          `تم حفظ النتيجة في الجهاز، لكن لم تتم مزامنتها مع Neon.\n\n${
            data?.error || `HTTP ${response.status}`
          }`
        );
      } else {
        console.log("✅ Neon synchronization successful:", {
          resultId,
          result: label,
          predictionSaved: data?.predictionSaved,
          performanceSaved: data?.performanceSaved,
        });
      }

      onChanged?.();
    } catch (error) {
      console.error("Saving result failed:", error);

      window.alert(
        "تعذر إضافة النتيجة. تحقق من سجل المتصفح."
      );
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    if (saving) return;

    setSaving(true);

    try {
      /*
       * نحدد آخر نتيجة محليًا أولًا.
       */
      const sessionId = getActiveSessionId();

      const items =
        await getPatternResults(
          1,
          sessionId,
        );

      const last = items[0];

      if (!last) {
        return;
      }

      /*
       * السجلات القديمة التي أُنشئت قبل ربط resultId
       * لا يمكن حذفها من Neon بأمان، لذلك لا نحذفها محليًا.
       */
      if (!last.neonResultId) {
        window.alert(
          "هذه النتيجة قديمة ولا تحتوي على معرّف Neon. لم يتم حذفها حتى لا يحدث اختلاف بين السجل المحلي وNeon."
        );
        return;
      }

      /*
       * نحذف من Neon أولًا.
       * إذا فشل الحذف، تبقى النتيجة محليًا ويمكن المحاولة مرة أخرى.
       */
      const response = await fetch(
        "/api/greedycat/results",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            resultId: last.neonResultId,
          }),
        },
      );

      const text = await response.text();

      let data: {
        success?: boolean;
        error?: string;
      } | null = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok || data?.success !== true) {
        console.error("Neon deletion failed:", {
          status: response.status,
          response: text,
          data,
        });

        window.alert(
          `تعذر حذف النتيجة من Neon.\n\n${
            data?.error || `HTTP ${response.status}`
          }\n\nلم يتم حذفها من الجهاز.`
        );

        return;
      }

      /*
       * Neon حُذف بنجاح.
       * الآن نحذف نفس السجل محليًا.
       */
      await removePatternResultById(last.id);

      console.log("✅ Result deleted from Neon and local storage:", {
        localId: last.id,
        neonResultId: last.neonResultId,
        result: last.result,
      });

      onChanged?.();
    } catch (error) {
      console.error("Removing result failed:", error);

      window.alert(
        "تعذر التراجع عن النتيجة. لم يتم حذف السجل المحلي."
      );
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (saving) return;

    const confirmed = window.confirm(
      "هل تريد مسح سجل النتائج المحلي بالكامل؟\n\nلن يتم حذف السجل الموجود في Neon."
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      await clearPatternHistory();
      onChanged?.();
    } catch (error) {
      console.error("Clearing results failed:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 rounded-lg bg-slate-50 p-2 text-center">
        <div className="text-xs font-black text-slate-800">
          أدخل النتيجة الفعلية
        </div>

        <div className="mt-0.5 text-[9px] text-slate-500">
          كل نتيجة تدخلها تختبر التوقع السابق وتحدث التحليل تلقائيًا
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {RESULTS.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={saving}
            onClick={() => void addResult(item.label)}
            className="group rounded-xl border border-slate-200 bg-white px-1 py-2 shadow-sm transition active:scale-95 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
          >
            <div className="text-2xl leading-none">
              {item.emoji}
            </div>

            <div className="mt-1 truncate text-[9px] font-black text-slate-700">
              {item.name}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={saving}
          onClick={() => void undo()}
          className="flex items-center justify-center gap-1.5 rounded-lg border bg-white py-2 text-[10px] font-bold text-slate-700 disabled:opacity-50"
        >
          <RotateCcw size={13} />
          تراجع عن الأخيرة
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => void clear()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-[10px] font-bold text-red-600 disabled:opacity-50"
        >
          <Trash2 size={13} />
          مسح السجل
        </button>
      </div>
    </div>
  );
}
