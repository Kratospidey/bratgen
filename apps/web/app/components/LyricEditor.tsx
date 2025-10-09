"use client";

import { Card, Label, Button } from "@bratgen/ui";
import { useState } from "react";

interface LyricEditorProps {
  initialLyrics?: string;
  onChange?: (lyrics: string) => void;
}

export function LyricEditor({ initialLyrics = "", onChange }: LyricEditorProps) {
  const [lyrics, setLyrics] = useState(initialLyrics);

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
        <p className="text-xs text-zinc-500">auto timing uses whisper + beat grid once audio arrives.</p>
      </div>
      <Button type="button" className="w-full">
        auto timing (queue whisper)
      </Button>
    </Card>
  );
}
