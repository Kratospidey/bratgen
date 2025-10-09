"use client";

import { Card, Button, Label } from "@bratgen/ui";
import { useMemo, useState } from "react";
import type { RenderJob } from "@/lib/api";

interface ExportPanelProps {
  onExport?: (options: ExportOptions) => void;
  busy?: boolean;
  job?: RenderJob | null;
  error?: string | null;
}

export interface ExportOptions {
  resolution: "720p" | "1080p";
  aspect: "9:16" | "1:1" | "16:9";
  includeMusic: boolean;
  includeOriginal: boolean;
}

export function ExportPanel({ onExport, busy = false, job = null, error = null }: ExportPanelProps) {
  const [resolution, setResolution] = useState<ExportOptions["resolution"]>("1080p");
  const [aspect, setAspect] = useState<ExportOptions["aspect"]>("9:16");
  const [includeMusic, setIncludeMusic] = useState(true);
  const [includeOriginal, setIncludeOriginal] = useState(false);

  const jobStatus = useMemo(() => {
    if (!job) {
      return null;
    }
    switch (job.status) {
      case "queued":
        return "queued for render";
      case "processing":
        return "rendering…";
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
          checked={includeMusic}
          onChange={(event) => setIncludeMusic(event.target.checked)}
          className="h-4 w-4 accent-brat"
        />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
        <span className="text-zinc-300">include original clip audio</span>
        <input
          type="checkbox"
          checked={includeOriginal}
          onChange={(event) => setIncludeOriginal(event.target.checked)}
          className="h-4 w-4 accent-brat"
        />
      </div>
      <Button
        className="w-full"
        disabled={busy}
        onClick={() =>
          onExport?.({ resolution, aspect, includeMusic, includeOriginal })
        }
      >
        {busy ? "queuing…" : "queue server render"}
      </Button>
      {(error || jobStatus) && (
        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-zinc-300">
          {error && <p className="text-red-400">{error}</p>}
          {jobStatus && !error && <p>{jobStatus}</p>}
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
