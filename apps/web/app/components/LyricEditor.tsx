"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Label, Button } from "@bratgen/ui";
import type { LyricAlignmentResponse } from "@/lib/api";

interface LyricEditorProps {
  initialLyrics?: string;
  alignment?: LyricAlignmentResponse | null;
  aligning?: boolean;
  onChange?: (lyrics: string) => void;
  onAlign?: () => void;
}

export function LyricEditor({ initialLyrics = "", alignment = null, aligning = false, onChange, onAlign }: LyricEditorProps) {
  const [lyrics, setLyrics] = useState(initialLyrics);

  useEffect(() => {
    setLyrics(initialLyrics);
  }, [initialLyrics]);

  const lines = useMemo(() => {
    return alignment?.lines ?? [];
  }, [alignment?.lines]);

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lyrics">lyrics</Label>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(event) => {
            setLyrics(event.target.value);
            onChange?.(event.target.value);
          }}
          className="h-40 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-brat focus:outline-none"
          placeholder="paste or edit the brat-style lyrics here"
        />
        <p className="text-xs text-zinc-500">
          {alignment
            ? `aligned with ${alignment.model} · ${(alignment.duration).toFixed(1)}s`
            : "auto timing uses whisper + beat grid once audio arrives."}
        </p>
      </div>
      <Button type="button" className="w-full" disabled={aligning} onClick={() => onAlign?.()}>
        {aligning ? "aligning…" : "auto timing (whisper + beats)"}
      </Button>
      {lines.length > 0 && (
        <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-black/30">
          {lines.map((line) => (
            <div key={`${line.text}-${line.start}`} className="flex items-center justify-between px-4 py-3 text-sm text-white">
              <div>
                <p className="font-semibold text-white">{line.text}</p>
                <p className="text-xs text-zinc-500">
                  {line.start.toFixed(2)}s → {line.end.toFixed(2)}s · conf {(line.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
