"use client";

import { Card, Button, Label } from "@bratgen/ui";
import { SegmentSelectionResult } from "@bratgen/analysis";
import { useMemo, useState } from "react";

interface SegmentPickerProps {
  suggested: SegmentSelectionResult[];
  onSelect?: (segment: SegmentSelectionResult) => void;
}

export function SegmentPicker({ suggested, onSelect }: SegmentPickerProps) {
  const options = useMemo(
    () =>
      suggested.map((candidate, index) => ({
        key: `${candidate.start}-${candidate.end}-${index}`,
        candidate
      })),
    [suggested]
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(options[0]?.key ?? null);

  return (
    <Card className="space-y-4" id="workflow">
      <div className="flex items-center justify-between">
        <div>
          <Label>segment picker</Label>
          <p className="text-xs text-zinc-500">spotify chorus candidates + local peaks</p>
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
      <div className="space-y-3">
        {options.map(({ key, candidate }) => (
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
              {Math.round(candidate.start)}s → {Math.round(candidate.end)}s
            </p>
            <p className="text-xs uppercase tracking-widest text-zinc-500">score {candidate.score.toFixed(2)}</p>
          </button>
        ))}
        {options.length === 0 && <p className="text-xs text-zinc-500">analysis pending</p>}
      </div>
    </Card>
  );
}
