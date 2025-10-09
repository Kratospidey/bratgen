"use client";

import { Card, Button, Label } from "@bratgen/ui";
import { useEffect, useMemo, useState } from "react";
import type { RenderJob } from "@/lib/api";

interface ExportPanelProps {
  onExport?: (options: ExportOptions) => void;
  busy?: boolean;
  job?: RenderJob | null;
  error?: string | null;
  includeMusic?: boolean;
  includeOriginal?: boolean;
  onMixChange?: (value: { includeMusic: boolean; includeOriginal: boolean }) => void;
}

export interface ExportOptions {
  resolution: "720p" | "1080p";
  aspect: "9:16" | "1:1" | "16:9";
  includeMusic: boolean;
  includeOriginal: boolean;
}

export function ExportPanel({
  onExport,
  busy = false,
  job = null,
  error = null,
  includeMusic = true,
  includeOriginal = false,
  onMixChange
}: ExportPanelProps) {
  const [resolution, setResolution] = useState<ExportOptions["resolution"]>("1080p");
  const [aspect, setAspect] = useState<ExportOptions["aspect"]>("9:16");
  const [musicToggle, setMusicToggle] = useState(includeMusic);
  const [originalToggle, setOriginalToggle] = useState(includeOriginal);

  useEffect(() => {
    setMusicToggle(includeMusic);
  }, [includeMusic]);

  useEffect(() => {
    setOriginalToggle(includeOriginal);
  }, [includeOriginal]);

  const jobStatus = useMemo(() => {
    if (!job) {
      return null;
    }
    switch (job.status) {
      case "queued":
        return "queued for render";
      case "processing":
        return `rendering… ${(job.progress * 100).toFixed(0)}%`;
      case "completed":
        return "render complete";
      case "failed":
        return job.error ?? "render failed";
      default:
        return null;
    }
  }, [job]);

  return (
    <Card className="space-y-4" id="export">
      <div>
        <Label>export</Label>
        <p className="text-xs text-zinc-500">mp4 · h264 + aac 192kbps · max 60s</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>resolution</Label>
          <div className="mt-2 flex gap-2">
            {(["720p", "1080p"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setResolution(value)}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-widest transition ${
                  resolution === value ? "bg-brat text-black" : "bg-black/50 text-zinc-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>aspect</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["9:16", "1:1", "16:9"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setAspect(value)}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-widest transition ${
                  aspect === value ? "bg-brat text-black" : "bg-black/50 text-zinc-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
        <span className="text-zinc-300">include spotify mix</span>
        <input
          type="checkbox"
          checked={musicToggle}
          onChange={(event) => {
            const next = event.target.checked;
            setMusicToggle(next);
            onMixChange?.({ includeMusic: next, includeOriginal: originalToggle });
          }}
          className="h-4 w-4 accent-brat"
        />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
        <span className="text-zinc-300">include original clip audio</span>
        <input
          type="checkbox"
          checked={originalToggle}
          onChange={(event) => {
            const next = event.target.checked;
            setOriginalToggle(next);
            onMixChange?.({ includeMusic: musicToggle, includeOriginal: next });
          }}
          className="h-4 w-4 accent-brat"
        />
      </div>
      <Button
        className="w-full"
        disabled={busy}
        onClick={() =>
          onExport?.({ resolution, aspect, includeMusic: musicToggle, includeOriginal: originalToggle })
        }
      >
        {busy ? "queuing…" : "queue server render"}
      </Button>
      {(error || jobStatus) && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-zinc-300">
          {error && <p className="text-red-400">{error}</p>}
          {jobStatus && !error && <p>{jobStatus}</p>}
          {job?.status === "processing" && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-brat"
                style={{ width: `${Math.max(5, Math.round(job.progress * 100))}%` }}
              />
            </div>
          )}
          {job && <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">attempts {job.attempts}</p>}
          {job?.status === "completed" && job.output && (
            <a
              href={job.output.downloadUrl}
              className="mt-2 inline-flex items-center text-brat underline"
              target="_blank"
              rel="noreferrer"
            >
              download render ({Math.round(job.output.size / (1024 * 1024))} mb)
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
