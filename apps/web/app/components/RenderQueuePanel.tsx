"use client";

import { useMemo } from "react";
import { Card, Label } from "@bratgen/ui";
import clsx from "clsx";
import type { RenderJob, RenderQueueHealth } from "@/lib/api";

interface RenderQueuePanelProps {
  jobs: RenderJob[];
  health: RenderQueueHealth | null;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  refreshing?: boolean;
  variant?: "standalone" | "section";
  className?: string;
}

export function RenderQueuePanel({
  jobs,
  health,
  onCancel,
  onRetry,
  refreshing = false,
  variant = "standalone",
  className
}: RenderQueuePanelProps) {
  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs]);

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Label>render queue</Label>
          <p className="text-xs text-zinc-500">monitor status, cancel or retry exports.</p>
        </div>
        {health && (
          <div className="text-right text-[10px] uppercase tracking-[0.3em] text-white/50">
            <p>{health.redis ? "redis" : "fallback"} · worker {health.worker.state}</p>
            <p>
              pending {health.worker.waiting} · done {health.worker.completed} · failed {health.worker.failed}
            </p>
          </div>
        )}
      </div>
      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {sorted.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white/90">
                {job.id.slice(0, 8)} · {job.status}
              </p>
              <p className="text-[11px] text-white/50">
                segment {job.segment.start.toFixed(1)}s → {job.segment.end.toFixed(1)}s · attempts {job.attempts}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={() => onRetry?.(job.id)}
                  disabled={refreshing}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  retry
                </button>
              )}
              {(job.status === "queued" || job.status === "processing") && (
                <button
                  type="button"
                  onClick={() => onCancel?.(job.id)}
                  disabled={refreshing}
                  className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  cancel
                </button>
              )}
              {job.status === "completed" && job.output && (
                <a href={job.output.downloadUrl} className="text-brat underline" target="_blank" rel="noreferrer">
                  download
                </a>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-xs text-white/50">
            queue empty
          </div>
        )}
      </div>
    </>
  );

  if (variant === "section") {
    return (
      <div
        className={clsx(
          "space-y-4 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_0_45px_rgba(203,255,0,0.04)]",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return <Card className={clsx("space-y-4", className)}>{content}</Card>;
}
