"use client";

import { Card } from "@bratgen/ui";
import { useEffect, useRef, useState } from "react";

interface PlayerCanvasProps {
  videoUrl?: string;
  lyrics?: Array<{ time: number; text: string }>;
  autoContrast?: boolean;
}

export function PlayerCanvas({ videoUrl, lyrics = [], autoContrast = true }: PlayerCanvasProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentLine, setCurrentLine] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || lyrics.length === 0) {
      return;
    }

    const onTimeUpdate = () => {
      const current = lyrics
        .filter((line) => line.time <= (video.currentTime ?? 0))
        .sort((a, b) => b.time - a.time)[0];
      setCurrentLine(current?.text ?? "");
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [lyrics]);

  return (
    <Card className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900">
      {videoUrl ? (
        <video ref={videoRef} src={videoUrl} controls className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-600">drop a clip to preview</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-8 text-center">
        <span
          className={`text-4xl font-semibold lowercase tracking-tight ${
            autoContrast ? "text-white text-outline" : "text-brat"
          }`}
        >
          {currentLine}
        </span>
      </div>
    </Card>
  );
}
