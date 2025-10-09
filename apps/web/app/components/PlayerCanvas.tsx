"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@bratgen/ui";

interface PlayerCanvasProps {
  videoUrl?: string;
  lyrics?: Array<{ text: string; start: number; end: number }>;
  beats?: number[];
  autoContrast?: boolean;
}

export function PlayerCanvas({ videoUrl, lyrics = [], beats = [], autoContrast = true }: PlayerCanvasProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [isBright, setIsBright] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const onTimeUpdate = () => setNow(video.currentTime ?? 0);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  useEffect(() => {
    if (!lyrics.length) {
      setCurrentLineIndex(-1);
      return;
    }
    const index = lyrics.findIndex((line) => now >= line.start && now < line.end);
    setCurrentLineIndex(index);
  }, [lyrics, now]);

  useEffect(() => {
    if (!autoContrast) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let raf: number;

    const sample = () => {
      if (!context || video.readyState < 2) {
        raf = requestAnimationFrame(sample);
        return;
      }
      const width = canvas.width;
      const height = canvas.height;
      context.drawImage(video, 0, 0, width, height);
      const data = context.getImageData(0, height * 0.6, width, height * 0.4);
      let total = 0;
      const pixels = data.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        total += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const avg = total / (pixels.length / 4 || 1);
      setIsBright(avg > 130);
      raf = requestAnimationFrame(sample);
    };

    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [autoContrast, videoUrl]);

  const activeLyric = currentLineIndex >= 0 ? lyrics[currentLineIndex] : null;
  const upcoming = useMemo(() => {
    return lyrics.slice(Math.max(currentLineIndex, 0), currentLineIndex + 3);
  }, [currentLineIndex, lyrics]);

  const beatPositions = useMemo(() => {
    if (!beats.length || !videoRef.current?.duration) {
      return [] as number[];
    }
    return beats
      .filter((beat) => beat >= now && beat <= now + 4)
      .map((beat) => ((beat - now) / 4) * 100);
  }, [beats, now]);

  return (
    <Card className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900">
      {videoUrl ? (
        <video ref={videoRef} src={videoUrl} controls playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-600">drop a clip to preview</div>
      )}
      <canvas ref={canvasRef} className="hidden" width={320} height={180} />
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center space-y-2 px-6 text-center">
        <AnimatePresence mode="popLayout">
          {activeLyric && (
            <motion.span
              key={activeLyric.start}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`text-4xl font-semibold lowercase tracking-tight ${
                autoContrast ? (isBright ? "text-black drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]" : "text-white") : "text-brat"
              }`}
            >
              {activeLyric.text}
            </motion.span>
          )}
        </AnimatePresence>
        <div className="flex gap-4 text-sm text-white/60">
          {upcoming.slice(1).map((line) => (
            <span key={line.start} className="max-w-[12rem] truncate uppercase tracking-[0.3em]">
              {line.text}
            </span>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 overflow-hidden">
        <div className="relative h-full w-full bg-black/50">
          <motion.div
            className="absolute inset-y-0 left-0 bg-brat"
            animate={{ width: `${videoRef.current ? (now / (videoRef.current.duration || 1)) * 100 : 0}%` }}
            transition={{ ease: "linear", duration: 0.2 }}
          />
          {beatPositions.map((position, index) => (
            <div
              key={`beat-${index}`}
              className="absolute bottom-0 h-full w-[2px] bg-white/40"
              style={{ left: `${position}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
