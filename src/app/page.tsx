"use client";

import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  Database,
  FileBarChart,
  History,
  Home,
  LineChart,
  Settings,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import ResultInputPanel from "@/components/pattern/ResultInputPanel";
import { predictFromPatterns } from "@/lib/recognition/PatternLearningEngine";
import {
  getPatternLengthPerformance,
  getPredictionPerformance,
} from "@/lib/storage/PredictionPerformanceStore";
import {
  getPatternResultStats,
  getPatternResults,
} from "@/lib/storage/PatternHistoryStore";
import type { TrainingLabel } from "@/lib/storage/TrainingDataset";

const RESULT_META: Record<
  TrainingLabel,
  { emoji: string; name: string }
> = {
  corn: { emoji: "🌽", name: "ذرة" },
  pepper: { emoji: "🌶️", name: "فلفل" },
  tomato: { emoji: "🍅", name: "طماط" },
  carrot: { emoji: "🥕", name: "جزر" },
  shrimp: { emoji: "🦐", name: "ربيان" },
  fish: { emoji: "🐟", name: "سمك" },
  cow: { emoji: "🐄", name: "بقر" },
  chick: { emoji: "🐔", name: "كتكوت" },
};

const menuItems = [
  [Home, "الرئيسية", true],
  [BarChart3, "التحليلات", false],
  [Target, "التوقعات", false],
  [Database, "البيانات", false],
  [Sparkles, "الأنماط", false],
  [Brain, "النماذج الذكية", false],
  [FileBarChart, "الاختبارات", false],
  [History, "النتائج", false],
  [Settings, "الإعدادات", false],
];

const schema = [
  [
    "pattern_results",
    "نتائج الأنماط",
    "id, result, created_at",
  ],
  [
    "predictions",
    "التوقعات",
    "id, predicted_item, confidence",
  ],
  [
    "prediction_results",
    "نتائج التوقعات",
    "id, prediction_id, actual_result",
  ],
  [
    "models",
    "النماذج",
    "id, name, version, accuracy",
  ],
  [
    "logs",
    "سجلات النظام",
    "id, type, message, created_at",
  ],
];

export default function HomePage() {
  const [results, setResults] = useState<
    {
      id: string;
      label: TrainingLabel;
      emoji: string;
      name: string;
    }[]
  >([]);

  const [prediction, setPrediction] = useState({
  result: null as TrainingLabel | null,
  options: [] as Array<{
    result: TrainingLabel;
    confidence: number;
    score: number;
    matches: number;
    patternLengths: number[];
  }>,
  confidence: 0,
  samplesUsed: 0,
  patternLength: 0,
  matches: 0,
  reason: "أدخل النتائج لبدء تحليل الأنماط.",
});

  const [stats, setStats] = useState<
    Record<TrainingLabel, number>
  >({
    corn: 0,
    pepper: 0,
    tomato: 0,
    carrot: 0,
    shrimp: 0,
    fish: 0,
    cow: 0,
    chick: 0,
  });

  const [automatic, setAutomatic] = useState(true);
  const [loading, setLoading] = useState(true);

  const [performance, setPerformance] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
    accuracy: 0,
  });

  const [predictionHistory, setPredictionHistory] = useState<
    Awaited<ReturnType<typeof getPredictionPerformance>>
  >([]);

  const [patternPerformance, setPatternPerformance] =
    useState<
      Record<
        number,
        {
          total: number;
          correct: number;
          incorrect: number;
          accuracy: number;
        }
      >
    >({});

  const refresh = useCallback(async () => {
    try {
      const [
        history,
        nextPrediction,
        resultStats,
        performanceStats,
        patternLengthStats,
      ] = await Promise.all([
        getPatternResults(),
        predictFromPatterns(),
        getPatternResultStats(),
        getPredictionPerformance(),
        getPatternLengthPerformance(),
      ]);

      const latest = history.slice(-12).reverse();

      setResults(
        latest.map((item) => ({
          id: item.id,
          label: item.result,
          emoji: RESULT_META[item.result].emoji,
          name: RESULT_META[item.result].name,
        })),
      );

      setPrediction(nextPrediction);
      setStats(resultStats);

      const correct = performanceStats.filter(
        (item) => item.correct,
      ).length;

      const total = performanceStats.length;

      setPerformance({
        total,
        correct,
        incorrect: total - correct,
        accuracy:
          total > 0
            ? Number(((correct / total) * 100).toFixed(1))
            : 0,
      });

      setPredictionHistory(
        [...performanceStats].reverse().slice(0, 12),
      );

      setPatternPerformance(patternLengthStats);
    } catch (error) {
      console.error("Loading pattern dashboard failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalResults = Object.values(stats).reduce(
    (sum, value) => sum + value,
    0,
  );

  const getPercentage = (value: number) => {
    if (!totalResults) return 0;
    return Number(
      ((value / totalResults) * 100).toFixed(1),
    );
  };

  const distribution = Object.entries(stats)
    .map(([label, count]) => ({
      label: label as TrainingLabel,
      count,
      percentage: getPercentage(count),
      ...RESULT_META[label as TrainingLabel],
    }))
    .sort((a, b) => b.count - a.count);

  const topDistribution = distribution.slice(0, 5);

  const predictionMeta = prediction.result
    ? RESULT_META[prediction.result]
    : null;

  const recentSequence = [...results]
    .reverse()
    .slice(-8);

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[#eef3f8] text-slate-900"
    >
      {/* HEADER */}
      <header className="fixed inset-x-0 top-0 z-50 h-14 bg-[#071827] text-white shadow-lg">
        <div className="mx-auto flex h-full w-full max-w-[1320px] items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-lg">
              🐱
            </div>

            <div className="leading-tight">
              <div className="text-base font-extrabold">
                GreedyCat{" "}
                <span className="text-sky-400">
                  AI
                </span>
              </div>

              <div className="text-[9px] text-slate-400">
                تحليل أذكى · توقع أقرب
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              المحرك يعمل
            </div>

            <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-500 text-xs font-bold">
              AI
            </div>
          </div>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="fixed bottom-0 right-0 top-14 z-40 hidden w-[175px] bg-[#0a1b2b] text-white min-[1500px]:block">
        <nav className="space-y-1 p-2">
          {menuItems.map(
            ([Icon, label, active]: any) => (
              <button
                key={label}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-gradient-to-l from-sky-500 to-blue-600"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ),
          )}
        </nav>

        <div className="absolute bottom-3 left-2 right-2 rounded-xl border border-yellow-500/30 bg-[#101d29] p-3 text-center">
          <div className="text-lg">👑</div>

          <div className="mt-1 text-xs font-bold text-yellow-400">
            الإصدار المميز
          </div>

          <div className="mt-1 text-[9px] leading-4 text-slate-400">
            تحليلات متقدمة · نماذج ذكية
          </div>
        </div>
      </aside>

      {/* CONTENT */}
      <section className="pt-14 min-[1500px]:pr-[175px]">
        <div className="mx-auto w-full max-w-[1320px] px-2 py-2 md:px-3 md:py-3">

          {/* TOP STATS */}
          <div className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              icon={<Database size={18} />}
              title="إجمالي النتائج"
              value={totalResults.toLocaleString("en-US")}
            />

            <Stat
              icon={<CheckCircle2 size={18} />}
              title="دقة المحرك"
              value={
                performance.total > 0
                  ? `${performance.accuracy}%`
                  : "لا توجد اختبارات"
              }
            />

            <Stat
              icon={<BarChart3 size={18} />}
              title="أطول نمط محلل"
              value={
                prediction.patternLength
                  ? `${prediction.patternLength} نتائج`
                  : "—"
              }
            />

            <Stat
              icon={<Target size={18} />}
              title="التوقع الحالي"
              value={
                predictionMeta
                  ? `${predictionMeta.emoji} ${predictionMeta.name} ${prediction.confidence}%`
                  : "بانتظار البيانات"
              }
            />
          </div>

          {/* MAIN GRID */}
          <div className="grid items-start gap-2 lg:grid-cols-[1.35fr_1fr_.78fr]">

            {/* RESULT INPUT */}
            <Card
              title="إدخال النتائج"
              icon={<Target size={17} />}
              badge="بدون كاميرا"
            >
              <ResultInputPanel
                onChanged={refresh}
              />

              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-blue-900">
                    التسلسل الحالي
                  </div>

                  <span className="text-[9px] font-bold text-blue-500">
                    {totalResults} نتيجة
                  </span>
                </div>

                {recentSequence.length ? (
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {recentSequence.map((item) => (
                      <div
                        key={item.id}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white text-xl shadow-sm"
                        title={item.name}
                      >
                        {item.emoji}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 text-center text-[10px] text-slate-400">
                    لم تتم إضافة نتائج بعد
                  </div>
                )}
              </div>
            </Card>

            {/* PREDICTION */}
            <Card
              title="التوقع القادم"
              icon={<Sparkles size={17} />}
              badge={
                prediction.options?.length
                  ? "تحليل جاهز"
                  : "بانتظار البيانات"
              }
            >
              <div className="rounded-xl bg-gradient-to-b from-slate-50 to-blue-50 p-3">
                {prediction.options?.length ? (
                  <div className="space-y-2">
                    {prediction.options.slice(0, 2).map((option, index) => {
                      const meta = RESULT_META[option.result];

                      return (
                        <div
                          key={`${option.result}-${index}`}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xl">
                              {index === 0 ? "🥇" : "🥈"}
                            </span>

                            <span className="text-xs font-black text-slate-500">
                              {index === 0 ? "الخيار الأول" : "الخيار الثاني"}
                            </span>
                          </div>

                          <div className="mt-1 text-4xl">
                            {meta.emoji}
                          </div>

                          <div className="mt-1 text-lg font-black">
                            {meta.name}
                          </div>

                          <div className="mt-2 rounded-lg bg-gradient-to-l from-blue-600 to-sky-500 py-1.5 text-lg font-black text-white">
                            {option.confidence}%
                          </div>

                          <div className="mt-1 text-[10px] text-slate-500">
                            ثقة الخيار
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                              <div className="text-[9px] text-slate-400">
                                التطابقات
                              </div>
                              <div className="text-xs font-black text-slate-700">
                                {option.matches}
                              </div>
                            </div>

                            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                              <div className="text-[9px] text-slate-400">
                                الأطوال
                              </div>
                              <div className="text-xs font-black text-slate-700">
                                {option.patternLengths.join(" / ")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="py-2 text-center text-5xl opacity-30">
                      🧠
                    </div>

                    <div className="mt-1 text-center text-lg font-black text-slate-400">
                      لا يوجد توقع بعد
                    </div>

                    <div className="mt-1 text-center text-[10px] text-slate-500">
                      أدخل 4 نتائج مؤكدة على الأقل
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <Info
                  title="أطول نمط"
                  value={
                    prediction.patternLength
                      ? `${prediction.patternLength}`
                      : "—"
                  }
                />

                <Info
                  title="التطابقات"
                  value={`${prediction.matches}`}
                />

                <Info
                  title="العينة"
                  value={`${prediction.samplesUsed}`}
                />

                <Info
                  title="اختبارات"
                  value={`${performance.total}`}
                />
              </div>

              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-center text-[10px] leading-5 text-slate-600">
                {prediction.reason}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Info
                  title="نجاح"
                  value={`${performance.correct}`}
                />

                <Info
                  title="فشل"
                  value={`${performance.incorrect}`}
                />

                <Info
                  title="الدقة"
                  value={`${performance.accuracy}%`}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border bg-white px-2 py-1 text-[9px] font-bold">
                  Patterns ✓
                </span>

                <span className="rounded-full border bg-white px-2 py-1 text-[9px] font-bold">
                  Sequence ✓
                </span>

                <span className="rounded-full border bg-white px-2 py-1 text-[9px] font-bold">
                  History ✓
                </span>
              </div>
            </Card>

            {/* SYSTEM */}
            <div className="space-y-2">
              <Card
                title="حالة النظام"
                icon={<Activity size={17} />}
              >
                <Status
                  name="الكاميرا"
                  value="غير مستخدمة"
                  neutral
                />

                <Status
                  name="التحليل التلقائي"
                  value={
                    automatic ? "مفعل" : "متوقف"
                  }
                />

                <Status
                  name="قاعدة النتائج"
                  value="متصل"
                />

                <Status
                  name="محرك الأنماط"
                  value={
                    totalResults >= 4
                      ? "جاهز"
                      : "بانتظار البيانات"
                  }
                />

                <button
                  onClick={() =>
                    setAutomatic((value) => !value)
                  }
                  className={`mt-2 w-full rounded-lg py-2 text-xs font-bold text-white ${
                    automatic
                      ? "bg-emerald-500"
                      : "bg-slate-500"
                  }`}
                >
                  {automatic
                    ? "التحليل التلقائي مفعل"
                    : "التحليل التلقائي متوقف"}
                </button>
              </Card>

              <Card
                title="تحليل سريع"
                icon={<Zap size={17} />}
              >
                <button
                  onClick={() => void refresh()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white"
                >
                  🔍 تحليل الآن
                </button>

                <div className="mt-2 rounded-lg bg-slate-50 p-2 text-center">
                  <div className="text-[9px] text-slate-500">
                    مصدر التحليل
                  </div>

                  <div className="mt-0.5 text-xs font-black">
                    تسلسل النتائج فقط
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* LATEST RESULTS */}
          <Card
            title="آخر النتائج"
            icon={<History size={17} />}
            className="mt-2"
          >
            {results.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className={`rounded-lg border p-2 text-center ${
                      index === 0
                        ? "border-blue-500 bg-blue-50"
                        : "bg-slate-50"
                    }`}
                  >
                    <div className="text-xl">
                      {result.emoji}
                    </div>

                    <div className="mt-0.5 text-[9px] font-bold">
                      {result.name}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-400">
                لا توجد نتائج مسجلة بعد
              </div>
            )}
          </Card>

          {/* PREDICTION HISTORY */}
          <Card
            title="سجل التنبؤات"
            icon={<History size={17} />}
            className="mt-2"
          >
            {predictionHistory.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                {predictionHistory.slice(0, 3).map((item) => {
                  const predicted =
                    RESULT_META[item.predictedResult];

                  const actual =
                    RESULT_META[item.actualResult];

                  return (
                    <div
                      key={item.id}
                      className={`flex min-h-[48px] items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 ${
                        item.correct
                          ? "border-emerald-100 bg-emerald-50"
                          : "border-red-100 bg-red-50"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-lg leading-none">
                          {predicted.emoji}
                        </span>

                        <div className="min-w-0">
                          <div className="truncate text-[9px] font-black">
                            {predicted.name}
                          </div>

                          <div className="text-[7px] text-slate-500">
                            نمط {item.patternLength} · {item.confidence}%
                          </div>
                        </div>
                      </div>

                      <div className="text-sm">
                        →
                      </div>

                      <div className="text-center">
                        <div className="text-lg leading-none">
                          {actual.emoji}
                        </div>

                        <div className="mt-0.5 text-[7px] text-slate-500">
                          فعلي
                        </div>
                      </div>

                      <div
                        className={`text-base font-black ${
                          item.correct
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.correct ? "✓" : "✕"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 py-3 text-center text-[10px] text-slate-400">
                لم يتم اختبار أي توقع بعد
              </div>
            )}

            <div className="mt-1.5 text-center text-[8px] text-slate-400">
              آخر 3 توقعات · السجل الكامل محفوظ
            </div>
          </Card>

          {/* LOWER INFORMATION */}
          <div className="mt-2 grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">

            {/* PERFORMANCE */}
            <Card
              title="أداء المحرك"
              icon={<Brain size={17} />}
            >
              <div className="grid grid-cols-2 gap-2">
                <Info
                  title="إجمالي الاختبارات"
                  value={`${performance.total}`}
                />

                <Info
                  title="الدقة"
                  value={`${performance.accuracy}%`}
                />

                <Info
                  title="نجاحات"
                  value={`${performance.correct}`}
                />

                <Info
                  title="إخفاقات"
                  value={`${performance.incorrect}`}
                />
              </div>

              <div className="mt-3 text-[10px] font-black text-slate-800">
                أداء أطوال الأنماط
              </div>

              <div className="mt-2 space-y-1">
                {[6, 5, 4, 3, 2, 1].map((length) => {
                  const item = patternPerformance[length];

                  const label =
                    length === 1
                      ? "انتقال"
                      : `نمط ${length}`;

                  const accuracy =
                    item?.accuracy ?? 0;

                  return (
                    <div
                      key={length}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                      <span className="w-12 shrink-0 text-[9px] font-bold">
                        {label}
                      </span>

                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${accuracy}%`,
                          }}
                        />
                      </div>

                      <span className="w-11 shrink-0 text-left text-[9px] font-black">
                        {item
                          ? `${accuracy}%`
                          : "—"}
                      </span>

                      <span className="w-7 shrink-0 text-left text-[8px] text-slate-400">
                        {item?.total ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 rounded-lg bg-blue-50 p-2 text-center text-[9px] leading-4 text-blue-700">
                يتم قياس كل طول نمط من خلال
                التوقعات التي تم اختبارها فعليًا.
              </div>
            </Card>

            {/* QUICK STATS */}
            <Card
              title="إحصائيات سريعة"
              icon={<LineChart size={17} />}
            >
              <div className="h-24 rounded-lg bg-slate-50 p-2">
                <div className="flex h-full items-end gap-1">
                  {distribution.map((item) => (
                    <div
                      key={item.label}
                      className="flex-1 rounded-t bg-blue-500"
                      style={{
                        height: `${Math.max(
                          item.percentage * 3,
                          item.count
                            ? 8
                            : 2,
                        )}%`,
                      }}
                      title={`${item.name}: ${item.percentage}%`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                {topDistribution
                  .slice(0, 3)
                  .map((item) => (
                    <Info
                      key={item.label}
                      title={item.name}
                      value={`${item.percentage}%`}
                    />
                  ))}
              </div>
            </Card>

            {/* DISTRIBUTION */}
            <Card
              title="توزيع النتائج"
              icon={<BarChart3 size={17} />}
            >
              <div className="space-y-1.5">
                {distribution.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                  >
                    <span className="w-7 text-center text-lg">
                      {item.emoji}
                    </span>

                    <span className="w-14 text-[10px] font-bold">
                      {item.name}
                    </span>

                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${item.percentage}%`,
                        }}
                      />
                    </div>

                    <span className="w-10 text-left text-[9px] font-bold">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* DATABASE */}
            <Card
              title="قاعدة البيانات"
              icon={<Database size={17} />}
            >
              <div className="grid grid-cols-1 gap-1.5">
                {schema.map(
                  ([table, ar, fields]) => (
                    <div
                      key={table}
                      className="rounded-lg border bg-slate-50 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <Database
                          size={12}
                          className="text-blue-600"
                        />

                        {table}

                        <span className="mr-auto text-[9px] font-normal text-slate-500">
                          {ar}
                        </span>
                      </div>

                      <div className="mt-0.5 truncate text-[8px] text-slate-400">
                        {fields}
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-center text-[9px] font-bold text-emerald-700">
                قاعدة بيانات الأنماط متصلة
              </div>
            </Card>
          </div>

          <div className="mt-2 pb-3 text-center text-[9px] text-slate-400">
            GreedyCat AI · Pattern Analysis Engine
            · يعتمد على النتائج المؤكدة فقط
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-2 rounded-xl border bg-white px-2.5 py-2 shadow-sm">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[9px] text-slate-500">
          {title}
        </div>

        <div className="mt-0.5 truncate text-sm font-black">
          {value}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  badge,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${className}`}
    >
      <div className="flex min-h-[40px] items-center justify-between bg-[#0a1b2b] px-3 py-2 text-white">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          {icon}
          {title}
        </div>

        {badge && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold">
            {badge}
          </span>
        )}
      </div>

      <div className="p-2.5">
        {children}
      </div>
    </section>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white p-1.5 shadow-sm">
      <div className="text-[9px] text-slate-500">
        {title}
      </div>

      <div className="text-xs font-bold">
        {value}
      </div>
    </div>
  );
}

function Status({
  name,
  value,
  neutral = false,
}: {
  name: string;
  value: string;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-[10px] font-semibold">
        {name}
      </span>

      <span
        className={`flex items-center gap-1 text-[9px] font-bold ${
          neutral
            ? "text-slate-500"
            : "text-emerald-600"
        }`}
      >
        <CheckCircle2 size={12} />
        {value}
      </span>
    </div>
  );
}
