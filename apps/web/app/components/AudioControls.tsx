"use client";

import { Card, Label } from "@bratgen/ui";
import { Switch } from "@headlessui/react";
import { useState } from "react";

interface AudioControlsProps {
  onChange?: (config: { muteOriginal: boolean; musicGain: number; ducking: boolean }) => void;
}

export function AudioControls({ onChange }: AudioControlsProps) {
  const [muteOriginal, setMuteOriginal] = useState(false);
  const [musicGain, setMusicGain] = useState(0);
  const [ducking, setDucking] = useState(true);

  return (
    <Card className="space-y-4">
      <div>
        <Label>audio mix</Label>
        <p className="text-xs text-zinc-500">mute clip audio, adjust music gain, enable -8dB ducking.</p>
      </div>
      <Switch
        checked={muteOriginal}
        onChange={(checked) => {
          setMuteOriginal(checked);
          onChange?.({ muteOriginal: checked, musicGain, ducking });
        }}
        className={`${
          muteOriginal ? "bg-brat" : "bg-zinc-700"
        } relative inline-flex h-8 w-16 items-center rounded-full transition`}
      >
        <span className="sr-only">Mute original audio</span>
        <span
          className={`${muteOriginal ? "translate-x-9" : "translate-x-1"} inline-block h-6 w-6 transform rounded-full bg-black transition`}
        />
        <span className="absolute left-2 text-[10px] uppercase tracking-widest text-black/70">mute</span>
      </Switch>
      <div>
        <Label htmlFor="music-gain">music gain</Label>
        <input
          id="music-gain"
          type="range"
          min={-24}
          max={6}
          step={1}
          className="w-full accent-brat"
          value={musicGain}
          onChange={(event) => {
            const next = Number(event.target.value);
            setMusicGain(next);
            onChange?.({ muteOriginal, musicGain: next, ducking });
          }}
        />
        <p className="mt-1 text-xs text-zinc-400">{musicGain} dB</p>
      </div>
      <Switch
        checked={ducking}
        onChange={(checked) => {
          setDucking(checked);
          onChange?.({ muteOriginal, musicGain, ducking: checked });
        }}
        className={`${
          ducking ? "bg-brat" : "bg-zinc-700"
        } relative inline-flex h-8 w-20 items-center rounded-full transition`}
      >
        <span className="sr-only">Enable ducking</span>
        <span
          className={`${ducking ? "translate-x-11" : "translate-x-1"} inline-block h-6 w-6 transform rounded-full bg-black transition`}
        />
        <span className="absolute left-2 text-[10px] uppercase tracking-widest text-black/70">duck</span>
      </Switch>
    </Card>
  );
}
