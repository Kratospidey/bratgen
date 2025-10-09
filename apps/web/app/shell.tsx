"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadPane } from "@/components/UploadPane";
import { SpotifyLinkForm } from "@/components/SpotifyLinkForm";
import { PlayerCanvas } from "@/components/PlayerCanvas";
import { LyricEditor } from "@/components/LyricEditor";
import { SegmentPicker } from "@/components/SegmentPicker";
import { AudioControls } from "@/components/AudioControls";
import { ExportPanel } from "@/components/ExportPanel";
import { UploadFormInput } from "@/lib/validation";
import { SegmentSelectionResult, scoreCandidate, selectBestSegment } from "@bratgen/analysis";
import type { RenderJob, SpotifyMetadataResponse } from "@/lib/api";
import { Button, Card } from "@bratgen/ui";
import type { StoredUploadSummary } from "@/lib/uploads";
import { fetchRenderJob, queueRenderJob } from "@/lib/api";
import type { ExportOptions } from "@/components/ExportPanel";

export function LandingShell() {
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [lyrics, setLyrics] = useState<string>("");
  const [spotifyMetadata, setSpotifyMetadata] = useState<SpotifyMetadataResponse | null>(null);
  const [segment, setSegment] = useState<SegmentSelectionResult | null>(null);
  const [suggestions, setSuggestions] = useState<SegmentSelectionResult[]>([]);
  const [upload, setUpload] = useState<StoredUploadSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isQueueingRender, setIsQueueingRender] = useState(false);

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
      const job = await queueRenderJob({
        uploadId: upload.id,
        segment: { start: segment.start, end: segment.end },
        options: {
          resolution: options.resolution,
          aspect: options.aspect,
          includeMusic: options.includeMusic,
          includeOriginal: options.includeOriginal,
          musicGainDb: 0
        }
      });
      setRenderJob(job);
    } catch (error) {
      console.error("failed to queue render", error);
      setRenderError(error instanceof Error ? error.message : "failed to queue render");
    } finally {
      setIsQueueingRender(false);
    }
  };

  const lyricLines = useMemo(() => {
    return lyrics
      .split("\n")
      .filter(Boolean)
      .map((text, index) => ({
        text,
        time: (segment?.start ?? 0) + index * 2.5
      }));
  }, [lyrics, segment?.start]);

  const renderBusy = isQueueingRender || (renderJob?.status === "queued" || renderJob?.status === "processing");

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr,1.2fr]">
      <div className="space-y-8">
        <PlayerCanvas videoUrl={videoUrl} lyrics={lyricLines} autoContrast />
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold text-white">workflow</h2>
          <ol className="space-y-2 text-sm text-zinc-400">
            <li>1. upload clip + optional audio.</li>
            <li>2. pull spotify analysis; lock chorus slice.</li>
            <li>3. tune lyrics + styling.</li>
            <li>4. set audio mix + export target.</li>
          </ol>
          <Button className="w-full">watch demo</Button>
        </Card>
      </div>
      <div className="space-y-8">
        <UploadPane onSubmit={onUpload} busy={isUploading} error={uploadError} lastUpload={upload} />
        <SpotifyLinkForm onMetadata={onSpotifyMetadata} />
        <SegmentPicker suggested={suggestions} onSelect={(segment) => setSegment(segment)} />
        <LyricEditor onChange={(value) => setLyrics(value)} />
        <AudioControls />
        <ExportPanel onExport={onExport} busy={renderBusy} job={renderJob} error={renderError} />
      </div>
    </div>
  );
}
