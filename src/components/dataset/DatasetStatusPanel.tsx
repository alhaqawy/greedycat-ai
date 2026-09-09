"use client";

import { useEffect, useState } from "react";
import {
  getTrainingStats,
  type TrainingLabel,
} from "@/lib/storage/TrainingDataset";

const LABELS: {
  id: TrainingLabel;
  name: string;
  emoji: string;
}[] = [
  { id: "corn", name: "ذرة", emoji: "🌽" },
  { id: "pepper", name: "فلفل", emoji: "🌶️" },
  { id: "tomato", name: "طماط", emoji: "🍅" },
  { id: "carrot", name: "جزر", emoji: "🥕" },
  { id: "shrimp", name: "ربيان", emoji: "🦐" },
  { id: "fish", name: "سمك", emoji: "🐟" },
  { id: "cow", name: "بقر", emoji: "🐄" },
  { id: "chick", name: "كتكوت", emoji: "🐔" },
];

export default function DatasetStatusPanel() {
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getTrainingStats>
  > | null>(null);

  const loadStats = async () => {
    try {
      const result = await getTrainingStats();
      setStats(result);
    } catch (error) {
      console.error("Dataset stats error:", error);
    }
  };

  useEffect(() => {
    loadStats();

    const interval = window.setInterval(
      loadStats,
      3000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">
            بيانات التدريب
          </h3>

          <p className="mt-1 text-sm text-white/50">
            حالة العينات المستخدمة لتعليم محرك التعرف
          </p>
        </div>

        <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
          <div className="text-xs text-white/40">
            إجمالي العينات
          </div>

          <div className="text-lg font-bold text-white">
            {stats?.total ?? 0}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <div className="text-xs text-white/40">
            مصنفة
          </div>

          <div className="mt-1 text-xl font-bold text-white">
            {stats?.labeled ?? 0}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <div className="text-xs text-white/40">
            تحتاج تصنيف
          </div>

          <div className="mt-1 text-xl font-bold text-white">
            {stats?.unlabeled ?? 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LABELS.map((label) => {
          const count =
            stats?.distribution[label.id] ?? 0;

          return (
            <div
              key={label.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">
                  {label.emoji}
                </span>

                <span className="text-lg font-bold text-white">
                  {count}
                </span>
              </div>

              <div className="mt-1 text-xs text-white/50">
                {label.name}
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/50 transition-all"
                  style={{
                    width:
                      count > 0
                        ? `${Math.min(
                            100,
                            count * 10,
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-white/[0.03] p-3 text-center text-xs text-white/40">
        نحتاج عينات مصنفة ومتنوعة قبل اعتماد التعرف التلقائي.
      </div>
    </div>
  );
}
