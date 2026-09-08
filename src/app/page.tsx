"use client";

import {
  Activity,
  BarChart3,
  Brain,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Database,
  FileBarChart,
  History,
  Home,
  LineChart,
  Menu,
  Moon,
  Play,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import CameraPanel from "@/components/camera/CameraPanel";
import DataCapturePanel from "@/components/dataset/DataCapturePanel";

const results = [
  { round: "988434", item: "🌶️", name: "فلفل", status: "current" },
  { round: "988433", item: "🌽", name: "ذرة", status: "success" },
  { round: "988432", item: "🍅", name: "طماط", status: "success" },
  { round: "988431", item: "🥕", name: "جزر", status: "success" },
  { round: "988430", item: "🌽", name: "ذرة", status: "success" },
  { round: "988429", item: "🐟", name: "سمك", status: "success" },
  { round: "988428", item: "🌶️", name: "فلفل", status: "success" },
  { round: "988427", item: "🦐", name: "ربيان", status: "success" },
];

const probabilities = [
  ["🌽", "ذرة", 31.4],
  ["🌶️", "فلفل", 18.7],
  ["🍅", "طماط", 14.2],
  ["🥕", "جزر", 11.6],
  ["🐟", "سمك", 9.8],
];

const schema = [
  ["rounds", "الجولات", "id, round_number, result, captured_at"],
  ["predictions", "التوقعات", "id, round_id, predicted_item, probability"],
  ["prediction_results", "نتائج التوقعات", "id, prediction_id, actual_result"],
  ["models", "النماذج", "id, name, version, accuracy"],
  ["logs", "سجلات النظام", "id, type, message, created_at"],
];

export default function HomePage() {
  const [automatic, setAutomatic] = useState(true);

  return (
    <main dir="rtl" className="min-h-screen bg-[#eef3f8] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 h-[72px] bg-[#071827] text-white shadow-xl">
        <div className="flex h-full items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-400 text-2xl">
              🐱
            </div>
            <div>
              <div className="text-xl font-extrabold">
                GreedyCat <span className="text-sky-400">AI</span>
              </div>
              <div className="text-xs text-slate-400">تحليل أذكى .. توقع أقرب</div>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              الخدمة تعمل
            </div>
            <div className="text-xl">🔔</div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-500 font-bold">
                S
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">المستخدم</div>
                <div className="text-xs text-slate-400">الحساب الرئيسي</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 right-0 top-[72px] z-40 hidden w-[225px] bg-[#0a1b2b] text-white lg:block">
        <nav className="space-y-1 p-3">
          {[
            [Home, "الرئيسية", true],
            [Camera, "الكاميرا المباشرة"],
            [BarChart3, "التحليلات"],
            [Target, "التوقعات"],
            [Database, "البيانات"],
            [Sparkles, "الأنماط"],
            [Brain, "النماذج الذكية"],
            [FileBarChart, "الاختبارات"],
            [History, "النتائج"],
            [Settings, "الإعدادات"],
          ].map(([Icon, label, active]: any) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-gradient-to-l from-sky-500 to-blue-600 shadow-lg"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-3 right-3 rounded-2xl border border-yellow-500/40 bg-[#101d29] p-4 text-center">
          <div className="mb-2 text-xl">👑</div>
          <div className="font-bold text-yellow-400">الإصدار المميز</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            تحليلات متقدمة
            <br />
            نماذج ذكاء اصطناعي
            <br />
            تحديثات مستمرة
          </div>
        </div>
      </aside>

      <section className="pt-[72px] lg:pr-[225px]">
        <div className="mx-auto max-w-[1500px] p-4 md:p-6">
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={<Database />} title="إجمالي الجولات" value="988,434" />
            <Stat icon={<CheckCircle2 />} title="نسبة النجاح" value="46.8%" />
            <Stat icon={<BarChart3 />} title="إجمالي التوقعات" value="1,240" />
            <Stat
              icon={<Target />}
              title="التوقع الحالي"
              value="🌽 ذرة 31.4%"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr_.78fr]">
            <Card title="الكاميرا المباشرة" icon={<Camera />} badge="يعمل الآن">
              <CameraPanel />
          <div className="mt-4"><DataCapturePanel /></div>
            </Card>

            <Card title="التوقع القادم" icon={<Target />} badge="جاهز">
              <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-blue-50 p-5 text-center">
                <div className="text-7xl">🌽</div>
                <div className="mt-2 text-3xl font-black">ذرة</div>
                <div className="mt-4 rounded-xl bg-gradient-to-l from-blue-600 to-sky-500 py-3 text-2xl font-black text-white">
                  31.4%
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  احتمال التوقع
                </div>
              </div>

              <h3 className="mt-5 font-bold">ترتيب الخيارات</h3>
              <div className="mt-2 space-y-2">
                {probabilities.map(([emoji, name, percent], i) => (
                  <div
                    key={name as string}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-2"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-xl">{emoji}</span>
                    <span className="flex-1 font-semibold">{name}</span>
                    <span className="font-bold">{percent}%</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                {["LSTM", "Markov", "Patterns"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border bg-white px-3 py-1 text-xs font-bold"
                  >
                    {x} ✓
                  </span>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <Info title="الجولة الحالية" value="988434" />
                <Info title="الجولة القادمة" value="988435" />
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-center text-sm">
                آخر تحديث: <b>12:03:04</b>
              </div>
            </Card>

            <div className="space-y-5">
              <Card title="حالة النظام" icon={<Activity />}>
                <Status name="الكاميرا" value="يعمل" />
                <Status
                  name="التحليل التلقائي"
                  value={automatic ? "مفعل" : "متوقف"}
                />
                <Status name="قاعدة البيانات" value="متصل" />
                <Status name="النماذج الذكية" value="جاهزة" />

                <button
                  onClick={() => setAutomatic(!automatic)}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white ${
                    automatic ? "bg-red-500" : "bg-emerald-500"
                  }`}
                >
                  {automatic ? <X size={18} /> : <Play size={18} />}
                  {automatic ? "إيقاف التحليل التلقائي" : "تشغيل التحليل التلقائي"}
                </button>

                <button className="mt-2 w-full rounded-xl border bg-white py-3 font-bold">
                  ⚙️ إعدادات الكاميرا
                </button>
              </Card>

              <Card title="مؤقت الجولة" icon={<Clock3 />}>
                <div className="text-center">
                  <div className="text-sm text-slate-500">الوقت المتبقي</div>
                  <div className="my-2 text-5xl font-black">00:15</div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[55%] rounded-full bg-emerald-500" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <Info title="الحالية" value="988434" />
                  <Info title="القادمة" value="988435" />
                </div>
              </Card>

              <Card title="إجراءات سريعة" icon={<Zap />}>
                <button className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white">
                  🔍 تحليل الآن
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="rounded-xl border bg-white py-2 text-sm font-bold">
                    📷 حفظ الصورة
                  </button>
                  <button className="rounded-xl border bg-white py-2 text-sm font-bold">
                    🧠 آخر نتيجة
                  </button>
                </div>
              </Card>
            </div>
          </div>

          <Card title="آخر النتائج" icon={<History />} className="mt-5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {results.map((r) => (
                <div
                  key={r.round}
                  className={`rounded-xl border p-3 text-center ${
                    r.status === "current"
                      ? "border-blue-500 bg-blue-50"
                      : "bg-slate-50"
                  }`}
                >
                  <div className="text-2xl">{r.item}</div>
                  <div className="mt-1 text-sm font-bold">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.round}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <Card title="إحصائيات سريعة" icon={<LineChart />}>
              <div className="h-36 rounded-xl bg-slate-50 p-3">
                <div className="flex h-full items-end gap-2">
                  {[35, 48, 42, 62, 55, 72, 66, 81, 74, 88, 78, 92].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-blue-500"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Info title="ذرة" value="44.0%" />
                <Info title="طماط" value="15.2%" />
                <Info title="فلفل" value="10.8%" />
              </div>
            </Card>

            <Card title="توزيع النتائج" icon={<BarChart3 />}>
              <div className="flex items-center justify-center gap-8">
                <div className="grid h-40 w-40 place-items-center rounded-full bg-[conic-gradient(#22c55e_0_24%,#ef4444_24_43%,#f59e0b_43_55%,#3b82f6_55_65%,#8b5cf6_65_100%)]">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white font-black">
                    100%
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["🟢", "ذرة", "23.4%"],
                    ["🔴", "فلفل", "18.7%"],
                    ["🟠", "طماط", "14.2%"],
                    ["🔵", "جزر", "11.6%"],
                    ["🟣", "سمك", "9.8%"],
                  ].map(([a, b, c]) => (
                    <div key={b} className="flex gap-2">
                      <span>{a}</span>
                      <span>{b}</span>
                      <b>{c}</b>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="قاعدة البيانات" icon={<Database />}>
              <div className="space-y-2">
                {schema.map(([table, ar, fields]) => (
                  <div
                    key={table}
                    className="rounded-xl border bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <Database size={16} className="text-blue-600" />
                      {table}
                      <span className="mr-auto text-xs text-slate-500">{ar}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{fields}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ icon, title, value }: any) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div>
        <div className="text-xs text-slate-500">{title}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
      </div>
    </div>
  );
}

function Card({ title, icon, badge, children, className = "" }: any) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between bg-[#0a1b2b] px-4 py-3 text-white">
        <div className="flex items-center gap-2 font-bold">
          {icon}
          {title}
        </div>
        {badge && (
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-sm">
      <div className="text-[11px] text-slate-500">{title}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function Status({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <span className="font-semibold">{name}</span>
      <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
        <CheckCircle2 size={16} />
        {value}
      </span>
    </div>
  );
}
