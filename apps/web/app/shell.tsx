"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadPane } from "@/components/UploadPane";
import { SpotifyLinkForm } from "@/components/SpotifyLinkForm";
import { PlayerCanvas, defaultLyricStyle, type LyricStyleConfig } from "@/components/PlayerCanvas";
import { LyricEditor } from "@/components/LyricEditor";
import { SegmentPicker } from "@/components/SegmentPicker";
import { AudioControls, type AudioMixConfig } from "@/components/AudioControls";
import { ExportPanel } from "@/components/ExportPanel";
import { ControlSection } from "@/components/ControlSection";
import { UploadFormInput } from "@/lib/validation";
import { SegmentSelectionResult, scoreCandidate, selectBestSegment } from "@bratgen/analysis";
import type {
  RenderJob,
  SpotifyMetadataResponse,
  AudioAnalysisResponse,
  LyricAlignmentResponse,
  RenderQueueSnapshot
} from "@/lib/api";
import { Button, Card } from "@bratgen/ui";
import type { StoredUploadSummary } from "@/lib/uploads";
import {
  analyzeAudio,
  alignLyrics,
  fetchRenderJob,
  queueRenderJob,
  fetchRenderQueue,
  cancelRenderJobRequest,
  retryRenderJobRequest
} from "@/lib/api";
import type { ExportOptions } from "@/components/ExportPanel";
import { LyricStylePanel } from "@/components/LyricStylePanel";
import { RenderQueuePanel } from "@/components/RenderQueuePanel";

export function LandingShell() {
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [lyrics, setLyrics] = useState<string>("");
  const [spotifyMetadata, setSpotifyMetadata] = useState<SpotifyMetadataResponse | null>(null);
  const [segment, setSegment] = useState<SegmentSelectionResult | null>(null);
  const [suggestions, setSuggestions] = useState<SegmentSelectionResult[]>([]);
  const [analysisSuggestions, setAnalysisSuggestions] = useState<SegmentSelectionResult[]>([]);
  const [upload, setUpload] = useState<StoredUploadSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isQueueingRender, setIsQueueingRender] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mixConfig, setMixConfig] = useState<AudioMixConfig>({
    includeMusic: true,
    includeOriginal: false,
    musicGain: 0,
    ducking: 8,
    fadeMs: 400,
    automationDepth: 2
  });
  const [alignment, setAlignment] = useState<LyricAlignmentResponse | null>(null);
  const [aligningLyrics, setAligningLyrics] = useState(false);
  const [lyricStyle, setLyricStyle] = useState<LyricStyleConfig>(defaultLyricStyle);
  const [queueSnapshot, setQueueSnapshot] = useState<RenderQueueSnapshot>({ jobs: [], health: null });
  const [queueRefreshing, setQueueRefreshing] = useState(false);

  const onUpload = async (data: UploadFormInput) => {
    if (!data.video) {
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const url = URL.createObjectURL(data.video);
      setVideoUrl(url);
      setRenderJob(null);
      setRenderError(null);

      const formData = new FormData();
      formData.append("duration", data.duration.toString());
      formData.append("video", data.video);
      if (data.audio) {
        formData.append("audio", data.audio);
      }

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "upload failed" }));
        throw new Error(payload.message ?? "upload failed");
      }

      const payload = (await response.json()) as { upload: StoredUploadSummary };
      setUpload(payload.upload);
      setAnalysis(null);
      setAlignment(null);
      setAnalysisError(null);
      setAnalysisSuggestions([]);
      void analyzeUpload(payload.upload.id, data.duration);
    } catch (error) {
      console.error("upload failed", error);
      setUploadError(error instanceof Error ? error.message : "failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  const onSpotifyMetadata = (metadata: SpotifyMetadataResponse) => {
    setSpotifyMetadata(metadata);
    const usableDuration = Math.min(metadata.duration, 30);
    const best = selectBestSegment({ targetDuration: usableDuration, candidates: metadata.candidates });
    const scored: SegmentSelectionResult[] = metadata.candidates
      .map((candidate) => ({
        start: candidate.start,
        end: candidate.end,
        score: scoreCandidate(candidate, { targetDuration: usableDuration }) ?? 0,
        source: "spotify"
      }))
      .sort((a, b) => b.score - a.score);

    setSuggestions(scored);
    if (best) {
      setSegment(best);
    }
  };

  const analyzeUpload = async (uploadId: string, clipDuration: number) => {
    try {
      const result = await analyzeAudio({ uploadId, targetDuration: Math.min(clipDuration, 30) });
      setAnalysis(result);
      if (result.segments?.length) {
        const scored = result.segments
          .map((candidate) => ({
            start: candidate.start,
            end: candidate.end,
            score: scoreCandidate(candidate, { targetDuration: Math.min(clipDuration, 30) }) ?? 0,
            source: "analysis" as const
          }))
          .sort((a, b) => b.score - a.score);
        setAnalysisSuggestions(scored);
        if (!segment && scored[0]) {
          setSegment(scored[0]);
        }
      }
    } catch (error) {
      console.error("analysis failed", error);
      setAnalysisError(error instanceof Error ? error.message : "analysis failed");
    }
  };

  useEffect(() => {
    if (!renderJob) {
      return;
    }
    if (renderJob.status === "completed" || renderJob.status === "failed") {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const updated = await fetchRenderJob(renderJob.id);
        if (!cancelled) {
          setRenderJob(updated);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("failed to poll render job", error);
        }
      }
    };

    const interval = setInterval(poll, 2000);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [renderJob]);

  const refreshQueue = useCallback(async () => {
    try {
      setQueueRefreshing(true);
      const snapshot = await fetchRenderQueue();
      setQueueSnapshot(snapshot);
    } catch (error) {
      console.error("failed to fetch queue", error);
    } finally {
      setQueueRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    const interval = setInterval(() => {
      void refreshQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  const onExport = async (options: ExportOptions) => {
    if (!upload) {
      setRenderError("upload a clip before exporting");
      return;
    }
    if (!segment) {
      setRenderError("select a song segment before exporting");
      return;
    }

    setRenderError(null);
    setIsQueueingRender(true);
    try {
      const automation = (() => {
        if (!analysis?.beats?.length || mixConfig.automationDepth <= 0) {
          return [] as Array<{ at: number; gainDb: number }>;
        }
        const start = segment.start;
        const end = segment.end;
        const baseGain = mixConfig.musicGain;
        const depth = mixConfig.automationDepth;
        const duration = Math.max(end - start, 0);
        const beats = analysis.beats
          .filter((beat) => beat >= start && beat <= end)
          .map((beat) => beat - start);
        if (!beats.length) {
          return [] as Array<{ at: number; gainDb: number }>;
        }
        const points: Array<{ at: number; gainDb: number }> = [{ at: 0, gainDb: baseGain }];
        for (const beat of beats) {
          const lead = Math.max(0, beat - 0.12);
          const trail = Math.min(duration, beat + 0.12);
          points.push({ at: lead, gainDb: baseGain - depth / 2 });
          points.push({ at: beat, gainDb: baseGain + depth });
          points.push({ at: trail, gainDb: baseGain - depth / 3 });
        }
        points.push({ at: duration, gainDb: baseGain });
        const sorted = points
          .sort((a, b) => a.at - b.at)
          .map((point, index, arr) => {
            const prev = arr[index - 1];
            if (prev && Math.abs(prev.at - point.at) < 0.02) {
              return { at: point.at, gainDb: (prev.gainDb + point.gainDb) / 2 };
            }
            return point;
          });
        return sorted;
      })();

      const currentMix = {
        ...mixConfig,
        includeMusic: options.includeMusic,
        includeOriginal: options.includeOriginal
      } satisfies AudioMixConfig;
      setMixConfig(currentMix);
      const job = await queueRenderJob({
        uploadId: upload.id,
        segment: { start: segment.start, end: segment.end },
        options: {
          resolution: options.resolution,
          aspect: options.aspect,
          includeMusic: currentMix.includeMusic,
          includeOriginal: currentMix.includeOriginal,
          musicGainDb: currentMix.musicGain,
          duckingDb: currentMix.ducking,
          fadeMs: currentMix.fadeMs,
          musicAutomation: automation.length ? automation : undefined
        }
      });
      setRenderJob(job);
      void refreshQueue();
    } catch (error) {
      console.error("failed to queue render", error);
      setRenderError(error instanceof Error ? error.message : "failed to queue render");
    } finally {
      setIsQueueingRender(false);
    }
  };

  const handleCancelJob = useCallback(
    async (id: string) => {
      try {
        await cancelRenderJobRequest(id);
        void refreshQueue();
      } catch (error) {
        console.error("cancel render failed", error);
      }
    },
    [refreshQueue]
  );

  const handleRetryJob = useCallback(
    async (id: string) => {
      try {
        await retryRenderJobRequest(id);
        void refreshQueue();
      } catch (error) {
        console.error("retry render failed", error);
      }
    },
    [refreshQueue]
  );

  const lyricLines = useMemo(() => {
    if (alignment) {
      return alignment.lines.map((line) => ({ text: line.text, start: line.start, end: line.end }));
    }
    return lyrics
      .split("\n")
      .filter(Boolean)
      .map((text, index) => ({
        text,
        start: (segment?.start ?? 0) + index * 2.5,
        end: (segment?.start ?? 0) + index * 2.5 + 2.5
      }));
  }, [alignment, lyrics, segment?.start]);

  const lyricWords = useMemo(() => {
    if (alignment?.words?.length) {
      return alignment.words;
    }
    return lyrics
      .split(" ")
      .filter(Boolean)
      .map((text, index) => ({
        text,
        start: (segment?.start ?? 0) + index * 0.4,
        end: (segment?.start ?? 0) + index * 0.4 + 0.35,
        confidence: 0.4
      }));
  }, [alignment?.words, lyrics, segment?.start]);

  const renderBusy = isQueueingRender || (renderJob?.status === "queued" || renderJob?.status === "processing");

  const handleAlignLyrics = async () => {
    if (!upload) {
      return;
    }
    setAligningLyrics(true);
    try {
      const response = await alignLyrics({ uploadId: upload.id, lyrics });
      setAlignment(response);
    } catch (error) {
      console.error("alignment failed", error);
    } finally {
      setAligningLyrics(false);
    }
  };

  const lockedDuration = segment ? Math.max(0, segment.end - segment.start) : null;
  const lyricLineCount = lyricLines.length;
  const queueFocus =
    renderJob ??
    queueSnapshot.jobs.find((job) => job.status === "processing" || job.status === "queued") ??
    queueSnapshot.jobs[0] ??
    null;

  const queueStatusLabel = (() => {
    if (!queueFocus) {
      return "queue idle";
    }
    switch (queueFocus.status) {
      case "processing":
        return `rendering ${(queueFocus.progress * 100).toFixed(0)}%`;
      case "queued":
        return "queued for render";
      case "completed":
        return "render complete";
      case "failed":
        return "render failed";
      case "cancelled":
        return "render cancelled";
      default:
        return queueFocus.status;
    }
  })();

  const queueStatusDetail = (() => {
    if (queueFocus) {
      if (queueFocus.status === "completed" && queueFocus.output) {
        return `${Math.max(1, Math.round(queueFocus.output.size / (1024 * 1024)))}mb ready to download`;
      }
      if (queueFocus.status === "failed") {
        return queueFocus.error ?? `job ${queueFocus.id.slice(0, 8)} failed`;
      }
      return `job ${queueFocus.id.slice(0, 8)} • attempts ${queueFocus.attempts}`;
    }
    if (queueSnapshot.health) {
      return `pending ${queueSnapshot.health.worker.waiting} • done ${queueSnapshot.health.worker.completed}`;
    }
    return "ready for export";
  })();

  return (
    <div className="grid gap-12 xl:grid-cols-[1.65fr,1fr]">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[42px] border border-white/10 bg-white/[0.05] p-10 shadow-[0_0_110px_rgba(203,255,0,0.08)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(203,255,0,0.18),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_60%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="mx-auto w-full max-w-[420px]">
              <PlayerCanvas
                videoUrl={videoUrl}
                lyrics={lyricLines}
                words={lyricWords}
                beats={analysis?.beats ?? []}
                autoContrast
                style={lyricStyle}
                className="border border-white/15 bg-black/70 shadow-[0_0_85px_rgba(0,0,0,0.45)]"
              />
            </div>
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-[0.45em] text-brat/80">live preview</p>
                <h2 className="text-3xl font-semibold text-white">brat studio playback</h2>
                <p className="text-sm text-zinc-200">
                  Tune lyrics, styling, and audio before you lock the render. The canvas updates instantly with every tweak.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[{
                  label: "segment",
                  value: lockedDuration ? `${lockedDuration.toFixed(1)}s locked` : "select clip",
                  detail: segment
                    ? `${segment.start.toFixed(1)}s → ${segment.end.toFixed(1)}s`
                    : "choose from spotify or beat suggestions"
                }, {
                  label: "lyrics",
                  value: lyricLineCount ? `${lyricLineCount} lines` : "lyrics pending",
                  detail: alignment
                    ? `aligned via ${alignment.model}`
                    : analysis?.beats?.length
                      ? `${analysis.beats.length} beat markers ready`
                      : "paste words & auto-align"
                }, {
                  label: "render",
                  value: queueStatusLabel,
                  detail: queueStatusDetail
                }].map(({ label, value, detail }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/45 p-4 text-sm text-zinc-200 shadow-[0_0_45px_rgba(0,0,0,0.35)]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                    <p className="mt-1 text-xs text-zinc-400">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <Card className="relative overflow-hidden space-y-6 bg-white/[0.06] p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(203,255,0,0.18),transparent_55%)]" />
          <div className="relative space-y-6">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.4em] text-brat/80">workflow</p>
              <h2 className="text-2xl font-semibold text-white">four steps to brat perfection</h2>
            </div>
            <ol className="grid gap-4 text-sm text-zinc-200 sm:grid-cols-2">
              <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">upload clip + optional stems.</li>
              <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">pull spotify analysis; lock the chorus.</li>
              <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">tune lyrics, timing, and brat styling.</li>
              <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">mix audio, export, download instantly.</li>
            </ol>
            <div className="flex flex-wrap gap-3">
              <Button className="px-6">watch demo</Button>
              <a
                href="https://github.com/bbchr/bratgen"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-brat/60"
              >
                docs
              </a>
            </div>
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <div className="space-y-5 rounded-[36px] border border-white/10 bg-white/[0.05] p-8 shadow-[0_0_95px_rgba(0,0,0,0.4)] backdrop-blur">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.45em] text-brat/80">control center</p>
            <h2 className="text-2xl font-semibold text-white">craft the edit</h2>
            <p className="text-sm text-zinc-300">
              Collapse or expand each stage of the process to keep the options focused while you work.
            </p>
          </div>
          <div className="space-y-4">
            <ControlSection
              id="workflow"
              title="source & analysis"
              eyebrow="step 01"
              description="Upload media, pull Spotify data, and audition suggested segments."
            >
              <UploadPane
                variant="section"
                onSubmit={onUpload}
                busy={isUploading}
                error={uploadError}
                lastUpload={upload}
              />
              <SpotifyLinkForm variant="section" onMetadata={onSpotifyMetadata} />
              <SegmentPicker
                variant="section"
                spotify={suggestions}
                analysis={analysisSuggestions}
                onSelect={(segment) => setSegment(segment)}
              />
            </ControlSection>
            <ControlSection
              title="lyrics & visuals"
              eyebrow="step 02"
              description="Write, align, and stylize the brat typography to taste."
            >
              <LyricEditor
                variant="section"
                initialLyrics={lyrics}
                alignment={alignment}
                aligning={aligningLyrics}
                onChange={(value) => {
                  setLyrics(value);
                  setAlignment(null);
                }}
                onAlign={handleAlignLyrics}
                onAlignmentChange={(next) => setAlignment(next)}
              />
              <LyricStylePanel variant="section" value={lyricStyle} onChange={(next) => setLyricStyle(next)} />
            </ControlSection>
            <ControlSection
              id="export"
              title="mix & export"
              eyebrow="step 03"
              description="Balance stems, queue renders, and monitor the server queue."
            >
              <AudioControls
                variant="section"
                analysis={analysis}
                value={mixConfig}
                onChange={(config) => setMixConfig(config)}
              />
              {analysisError && <p className="text-xs text-red-400">{analysisError}</p>}
              <ExportPanel
                variant="section"
                onExport={onExport}
                busy={renderBusy}
                job={renderJob}
                error={renderError}
                includeMusic={mixConfig.includeMusic}
                includeOriginal={mixConfig.includeOriginal}
                onMixChange={(value) => setMixConfig((current) => ({ ...current, ...value }))}
              />
              <RenderQueuePanel
                variant="section"
                jobs={queueSnapshot.jobs}
                health={queueSnapshot.health}
                refreshing={queueRefreshing}
                onCancel={handleCancelJob}
                onRetry={handleRetryJob}
              />
            </ControlSection>
          </div>
        </div>
      </div>
    </div>
  );
}
