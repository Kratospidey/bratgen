"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, Label, Button } from "@bratgen/ui";
import type { LyricAlignmentResponse, AlignedLyric, AlignedLyricWord } from "@/lib/api";

interface LyricEditorProps {
  initialLyrics?: string;
  alignment?: LyricAlignmentResponse | null;
  aligning?: boolean;
  onChange?: (lyrics: string) => void;
  onAlign?: () => void;
  onAlignmentChange?: (alignment: LyricAlignmentResponse) => void;
}

export function LyricEditor({
  initialLyrics = "",
  alignment = null,
  aligning = false,
  onChange,
  onAlign,
  onAlignmentChange
}: LyricEditorProps) {
  const [lyrics, setLyrics] = useState(initialLyrics);
  const [manualLines, setManualLines] = useState<AlignedLyric[]>(alignment?.lines ?? []);
  const [manualWords, setManualWords] = useState<AlignedLyricWord[]>(alignment?.words ?? []);
  const wordsRef = useRef<AlignedLyricWord[]>(manualWords);

  useEffect(() => {
    setLyrics(initialLyrics);
  }, [initialLyrics]);

  useEffect(() => {
    setManualLines(alignment?.lines ?? []);
    setManualWords(alignment?.words ?? []);
  }, [alignment?.lines, alignment?.words]);

  useEffect(() => {
    wordsRef.current = manualWords;
  }, [manualWords]);

  const lines = useMemo(() => {
    return manualLines ?? alignment?.lines ?? [];
  }, [alignment?.lines, manualLines]);

  const emitAlignment = useCallback(
    (nextLines: AlignedLyric[], nextWords: AlignedLyricWord[]) => {
      if (!alignment) {
        return;
      }
      onAlignmentChange?.({
        ...alignment,
        lines: nextLines,
        words: nextWords
      });
    },
    [alignment, onAlignmentChange]
  );

  const adjustWordsForLine = useCallback(
    (words: AlignedLyricWord[], previous: AlignedLyric, next: AlignedLyric): AlignedLyricWord[] => {
      const prevSpan = Math.max(previous.end - previous.start, 0.1);
      const nextSpan = Math.max(next.end - next.start, 0.1);
      return words.map((word) => {
        if (word.start < previous.start - 0.05 || word.end > previous.end + 0.05) {
          return word;
        }
        const relativeStart = (word.start - previous.start) / prevSpan;
        const relativeDuration = Math.max((word.end - word.start) / prevSpan, 0.05);
        const start = next.start + Math.max(0, Math.min(1, relativeStart)) * nextSpan;
        const end = Math.min(next.end, start + relativeDuration * nextSpan);
        return { ...word, start, end };
      });
    },
    []
  );

  const updateLineTiming = useCallback(
    (index: number, next: Partial<AlignedLyric>) => {
      setManualLines((current) => {
        const target = current[index];
        if (!target) {
          return current;
        }
        const updated: AlignedLyric = {
          ...target,
          ...next,
          start: Math.max(0, next.start ?? target.start),
          end: Math.max(next.end ?? target.end, (next.start ?? target.start) + 0.2)
        };
        const nextLines = [...current];
        nextLines[index] = updated;
        const adjustedWords = adjustWordsForLine(wordsRef.current, target, updated);
        wordsRef.current = adjustedWords;
        setManualWords(adjustedWords);
        emitAlignment(nextLines, adjustedWords);
        return nextLines;
      });
    },
    [adjustWordsForLine, emitAlignment]
  );

  const resetManual = useCallback(() => {
    if (!alignment) {
      return;
    }
    setManualLines(alignment.lines);
    setManualWords(alignment.words);
    wordsRef.current = alignment.words;
    onAlignmentChange?.(alignment);
  }, [alignment, onAlignmentChange]);

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
      {alignment && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>timings: {alignment.model}</span>
          <button type="button" className="underline" onClick={resetManual}>
            reset overrides
          </button>
        </div>
      )}
      {lines.length > 0 && (
        <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-black/30">
          {lines.map((line, index) => (
            <div key={`${line.text}-${index}`} className="space-y-2 px-4 py-3 text-sm text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{line.text}</p>
                  <p className="text-xs text-zinc-500">
                    {line.start.toFixed(2)}s → {line.end.toFixed(2)}s · conf {(line.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="flex gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
                  <button type="button" onClick={() => updateLineTiming(index, { start: line.start - 0.1, end: line.end - 0.1 })}>
                    −0.1s
                  </button>
                  <button type="button" onClick={() => updateLineTiming(index, { start: line.start + 0.1, end: line.end + 0.1 })}>
                    +0.1s
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 text-xs text-zinc-300">
                <label className="flex flex-col gap-1">
                  <span>start</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={line.start.toFixed(2)}
                    onChange={(event) => updateLineTiming(index, { start: Number(event.target.value) })}
                    className="rounded-xl border border-white/10 bg-black/40 px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>end</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={line.end.toFixed(2)}
                    onChange={(event) => updateLineTiming(index, { end: Number(event.target.value) })}
                    className="rounded-xl border border-white/10 bg-black/40 px-2 py-1"
                  />
                </label>
              </div>
              <WordTimeline
                words={manualWords.filter((word) => word.start >= line.start - 0.05 && word.end <= line.end + 0.05)}
                start={line.start}
                end={line.end}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function WordTimeline({ words, start, end }: { words: AlignedLyricWord[]; start: number; end: number }) {
  const duration = end - start;
  if (!words.length || duration <= 0) {
    return null;
  }
  return (
    <div className="relative h-2 rounded-full bg-white/5">
      {words.map((word, index) => {
        const relativeStart = (word.start - start) / duration;
        const width = Math.max((word.end - word.start) / duration, 0.05);
        return (
          <div
            key={`${word.text}-${index}`}
            className="absolute top-0 h-full rounded-full bg-brat/70"
            style={{ left: `${Math.min(1, Math.max(0, relativeStart)) * 100}%`, width: `${Math.min(1, Math.max(width, 0.03)) * 100}%` }}
            title={`${word.text} (${(word.confidence * 100).toFixed(0)}%)`}
          />
        );
      })}
    </div>
  );
}
