"use client";

import { useMemo, useState } from "react";
import { UploadPane } from "@/components/UploadPane";
import { SpotifyLinkForm } from "@/components/SpotifyLinkForm";
import { PlayerCanvas } from "@/components/PlayerCanvas";
import { LyricEditor } from "@/components/LyricEditor";
import { SegmentPicker } from "@/components/SegmentPicker";
import { AudioControls } from "@/components/AudioControls";
import { ExportPanel } from "@/components/ExportPanel";
import { UploadFormInput } from "@/lib/validation";
import { SegmentCandidate, SegmentSelectionResult, scoreCandidate, selectBestSegment } from "@bratgen/analysis";
import type { SpotifyMetadataResponse } from "@/lib/api";
import { Button, Card } from "@bratgen/ui";

export function LandingShell() {
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [lyrics, setLyrics] = useState<string>("");
  const [spotifyMetadata, setSpotifyMetadata] = useState<SpotifyMetadataResponse | null>(null);
  const [segment, setSegment] = useState<SegmentSelectionResult | null>(null);
  const [suggestions, setSuggestions] = useState<SegmentSelectionResult[]>([]);

  const onUpload = async (data: UploadFormInput) => {
    if (data.video) {
      const url = URL.createObjectURL(data.video);
      setVideoUrl(url);
    }
    if (data.audio) {
      // In a real system we would upload and analyze the file here.
      console.log("audio file uploaded", data.audio.name);
    }
  };

  const onSpotifyMetadata = (metadata: SpotifyMetadataResponse) => {
    setSpotifyMetadata(metadata);
    const usableDuration = Math.min(metadata.duration, 30);
    const offsetWindow = Math.max(metadata.duration - usableDuration, 0);
    const candidates: SegmentCandidate[] = Array.from({ length: 3 }).map((_, index) => {
      const start = offsetWindow * (index / 3);
      const end = start + usableDuration;
      return {
        start,
        end,
        energy: 0.6 + index * 0.15,
        loudness: -8 + index * 2,
        confidence: 0.7 + index * 0.1
      };
    });

    const best = selectBestSegment({ targetDuration: usableDuration, candidates });
    const scored: SegmentSelectionResult[] = candidates
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

  const lyricLines = useMemo(() => {
    return lyrics
      .split("\n")
      .filter(Boolean)
      .map((text, index) => ({
        text,
        time: (segment?.start ?? 0) + index * 2.5
      }));
  }, [lyrics, segment?.start]);

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
        <UploadPane onSubmit={onUpload} />
        <SpotifyLinkForm onMetadata={onSpotifyMetadata} />
        <SegmentPicker suggested={suggestions} onSelect={(segment) => setSegment(segment)} />
        <LyricEditor onChange={(value) => setLyrics(value)} />
        <AudioControls />
        <ExportPanel onExport={(options) => console.log("export", { options, segment, spotifyMetadata })} />
      </div>
    </div>
  );
}
