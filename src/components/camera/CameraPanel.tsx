"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleStop, Play, RotateCcw, ScanSearch } from "lucide-react";
import { useCamera } from "./CameraService";

export default function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [starting, setStarting] = useState(false);

  const {
    stream,
    isCameraReady,
    cameraError,
    automaticAnalysis,
    isAnalyzing,
    startCamera,
    stopCamera,
    analyzeNow,
    setAutomaticAnalysis,
  } = useCamera();

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !stream) return;

    video.srcObject = stream;

    void video.play().catch((error) => {
      console.error("Camera playback error:", error);
    });
  }, [stream]);

  const handleStart = async () => {
    setStarting(true);

    try {
      await startCamera();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[24px] border-[6px] border-[#102337] bg-black shadow-2xl">
        <div className="relative aspect-[9/16] overflow-hidden bg-[#071827]">
          {isCameraReady && stream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#102d45] to-[#071827] px-6 text-center text-white">
              <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-sky-500/20">
                <Camera size={42} className="text-sky-400" />
              </div>

              <h3 className="text-xl font-black">
                كاميرا GreedyCat AI
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                وجّه كاميرا الجوال إلى شاشة لعبة GreedyCat
                داخل إطار التحليل.
              </p>

              {cameraError && (
                <div className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-300">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {/* إطار التعرف */}
          <div className="pointer-events-none absolute inset-[5%]">
            <div className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-sky-400" />
            <div className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-sky-400" />
            <div className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4 border-sky-400" />
            <div className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4 border-sky-400" />

            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-bold text-white backdrop-blur">
              منطقة تحليل GreedyCat
            </div>
          </div>

          {/* حالة التحليل */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isCameraReady ? "bg-emerald-400" : "bg-slate-400"
                }`}
              />
              {isCameraReady ? "الكاميرا تعمل" : "الكاميرا متوقفة"}
            </div>

            {isAnalyzing && (
              <div className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                <ScanSearch size={14} />
                جاري التحليل
              </div>
            )}
          </div>

          {/* خط المسح */}
          {isAnalyzing && (
            <div className="pointer-events-none absolute left-[5%] right-[5%] top-1/2 h-[2px] animate-pulse bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,.9)]" />
          )}

          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/65 px-3 py-2 text-center text-xs font-bold text-white backdrop-blur">
            📷 سيتم التعرف على بيانات الجولة من الشاشة
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {!isCameraReady ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 sm:col-span-2"
          >
            <Play size={18} />
            {starting ? "جاري تشغيل الكاميرا..." : "تشغيل كاميرا الجوال"}
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-bold text-white transition hover:bg-red-600"
          >
            <CircleStop size={18} />
            إيقاف الكاميرا
          </button>
        )}

        <button
          onClick={() => void analyzeNow()}
          disabled={!isCameraReady || isAnalyzing}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanSearch size={18} />
          {isAnalyzing ? "جاري التحليل..." : "تحليل الآن"}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-slate-50 p-3">
        <div>
          <div className="text-sm font-bold text-slate-800">
            التحليل التلقائي
          </div>
          <div className="text-xs text-slate-500">
            التقاط وتحليل دوري كل 5 ثوانٍ
          </div>
        </div>

        <button
          onClick={() => setAutomaticAnalysis(!automaticAnalysis)}
          className={`relative h-7 w-14 rounded-full transition ${
            automaticAnalysis ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-label="تفعيل أو إيقاف التحليل التلقائي"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              automaticAnalysis ? "right-1" : "right-8"
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">النمط</div>
          <div className="mt-1 font-bold">
            {automaticAnalysis ? "تلقائي" : "يدوي"}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">الفاصل</div>
          <div className="mt-1 flex items-center gap-1 font-bold">
            <RotateCcw size={14} />
            5 ثوانٍ
          </div>
        </div>
      </div>
    </div>
  );
}
