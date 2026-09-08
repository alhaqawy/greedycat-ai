"use client";

type Region = {
  name: string;
  label: string;
  className: string;
};

const regions: Region[] = [
  {
    name: "round",
    label: "رقم الجولة",
    className: "left-[8%] right-[8%] top-[4%] h-[8%]",
  },
  {
    name: "wheel",
    label: "العجلة / النتيجة",
    className: "left-[8%] right-[8%] top-[18%] h-[43%]",
  },
  {
    name: "bets",
    label: "مبالغ الخيارات",
    className: "left-[7%] right-[7%] top-[61%] h-[18%]",
  },
  {
    name: "history",
    label: "آخر النتائج",
    className: "left-[5%] right-[5%] bottom-[3%] h-[14%]",
  },
];

export default function GameFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-[3%] rounded-[18px] border-2 border-sky-400/80" />

      {regions.map((region) => (
        <div
          key={region.name}
          className={`absolute ${region.className} rounded-lg border border-sky-300/70 bg-sky-400/5`}
        >
          <span className="absolute right-2 top-1 rounded-md bg-black/65 px-2 py-1 text-[9px] font-bold text-white">
            {region.label}
          </span>
        </div>
      ))}

      <div className="absolute left-[3%] top-[3%] h-8 w-8 border-l-4 border-t-4 border-sky-400" />
      <div className="absolute right-[3%] top-[3%] h-8 w-8 border-r-4 border-t-4 border-sky-400" />
      <div className="absolute bottom-[3%] left-[3%] h-8 w-8 border-b-4 border-l-4 border-sky-400" />
      <div className="absolute bottom-[3%] right-[3%] h-8 w-8 border-b-4 border-r-4 border-sky-400" />
    </div>
  );
}
