"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Button, Label } from "@bratgen/ui";
import type { SegmentSelectionResult } from "@bratgen/analysis";

interface SegmentPickerProps {
  spotify: SegmentSelectionResult[];
  analysis?: SegmentSelectionResult[];
  onSelect?: (segment: SegmentSelectionResult) => void;
}

interface SegmentOption {
  key: string;
  candidate: SegmentSelectionResult;
  source: "spotify" | "analysis";
}

export function SegmentPicker({ spotify, analysis = [], onSelect }: SegmentPickerProps) {
  const options = useMemo(() => {
    const merged: SegmentOption[] = [];
    for (const candidate of spotify) {
      merged.push({ key: `spotify-${candidate.start}-${candidate.end}`, candidate, source: "spotify" });
    }
    for (const candidate of analysis) {
      merged.push({ key: `analysis-${candidate.start}-${candidate.end}`, candidate, source: "analysis" });
    }
    return merged.sort((a, b) => b.candidate.score - a.candidate.score);
  }, [analysis, spotify]);

  const [selectedKey, setSelectedKey] = useState<string | null>(options[0]?.key ?? null);

  useEffect(() => {
    setSelectedKey(options[0]?.key ?? null);
  }, [options]);

  const grouped = useMemo(() => {
    return {
      spotify: options.filter((option) => option.source === "spotify"),
      analysis: options.filter((option) => option.source === "analysis")
    } satisfies Record<"spotify" | "analysis", SegmentOption[]>;
  }, [options]);

  return (
    <Card className="space-y-4" id="workflow">
      <div className="flex items-center justify-between">
        <div>
          <Label>segment picker</Label>
          <p className="text-xs text-zinc-500">spotify chorus candidates + local beat energy</p>
        </div>
        {selectedKey && (
          <Button
            type="button"
            className="text-xs"
            onClick={() => {
              const current = options.find((option) => option.key === selectedKey)?.candidate;
              if (current) {
                onSelect?.(current);
              }
            }}
          >
            lock segment
          </Button>
        )}
      </div>
      <div className="space-y-6">
        {(["spotify", "analysis"] as const).map((source) => {
          const list = grouped[source];
          if (!list.length) {
            return null;
          }
          return (
            <div key={source} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{source}</p>
              {list.map(({ key, candidate }) => (
                <button
                  key={key}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    selectedKey === key
                      ? "border-brat bg-brat/20"
                      : "border-white/10 bg-black/30 hover:border-brat/40"
                  }`}
                  onClick={() => {
                    setSelectedKey(key);
                    onSelect?.(candidate);
                  }}
                >
                  <p className="font-semibold text-white">
                    {candidate.start.toFixed(1)}s → {candidate.end.toFixed(1)}s
                  </p>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">score {candidate.score.toFixed(2)}</p>
                </button>
              ))}
            </div>
          );
        })}
        {options.length === 0 && <p className="text-xs text-zinc-500">analysis pending</p>}
      </div>
    </Card>
  );
}
