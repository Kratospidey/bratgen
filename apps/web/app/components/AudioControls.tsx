"use client";

import { useEffect, useMemo, useState } from "react";
import { area, curveNatural } from "d3-shape";
import { scaleLinear } from "d3-scale";
import useMeasure from "react-use-measure";
import { Card, Label } from "@bratgen/ui";
import { Switch } from "@headlessui/react";
import type { AudioAnalysisResponse } from "@/lib/api";

export interface AudioMixConfig {
  includeMusic: boolean;
  includeOriginal: boolean;
  musicGain: number;
  ducking: number;
  fadeMs: number;
  automationDepth: number;
}

interface AudioControlsProps {
  analysis?: AudioAnalysisResponse | null;
  value?: AudioMixConfig;
  onChange?: (config: AudioMixConfig) => void;
}

const defaultMix: AudioMixConfig = {
  includeMusic: true,
  includeOriginal: false,
  musicGain: 0,
  ducking: 8,
  fadeMs: 400,
  automationDepth: 2
};

export function AudioControls({ analysis, value, onChange }: AudioControlsProps) {
  const [internal, setInternal] = useState<AudioMixConfig>(value ?? defaultMix);

  const config = value ?? internal;

  useEffect(() => {
    if (value) {
      setInternal(value);
    }
  }, [value]);

  const [ref, bounds] = useMeasure();

  const waveformPath = useMemo(() => {
    if (!analysis?.waveform?.length || bounds.width === 0) {
      return null;
    }
    const x = scaleLinear().domain([0, analysis.waveform.length - 1]).range([0, bounds.width]);
    const y = scaleLinear().domain([0, 1]).range([bounds.height, 0]);
    const generator = area<number>()
      .x((_, index) => x(index))
      .y0(() => bounds.height)
      .y1((value) => y(value))
      .curve(curveNatural);
    return generator(analysis.waveform.map((value) => Math.min(1, value))) ?? null;
  }, [analysis?.waveform, bounds.height, bounds.width]);

  const beats = useMemo(() => {
    if (!analysis?.beats?.length || bounds.width === 0) {
      return [] as number[];
    }
    const scale = scaleLinear().domain([0, analysis.duration]).range([0, bounds.width]);
    return analysis.beats
      .filter((beat) => beat >= 0 && beat <= analysis.duration)
      .map((beat) => scale(beat));
  }, [analysis?.beats, analysis?.duration, bounds.width]);

  const update = (next: Partial<AudioMixConfig>) => {
    const merged = { ...config, ...next };
    if (!value) {
      setInternal(merged);
    }
    onChange?.(merged);
  };

  return (
    <Card className="space-y-4">
      <div>
        <Label>mix & dynamics</Label>
        <p className="text-xs text-zinc-500">duck chorus under vocal, trim fades, preview waveform + beat grid.</p>
      </div>
      <div ref={ref} className="relative h-28 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60">
        {waveformPath ? (
          <svg viewBox={`0 0 ${bounds.width} ${bounds.height}`} className="h-full w-full">
            <path d={waveformPath} className="fill-brat/40" />
            {beats.map((xPosition, index) => (
              <line
                key={`beat-${index}`}
                x1={xPosition}
                x2={xPosition}
                y1={0}
                y2={bounds.height}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">analysis pending…</div>
        )}
        {analysis && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-between px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <span>{analysis.tempo} bpm</span>
            <span>energy {(analysis.energy * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MixSwitch
          label="include spotify mix"
          description="streamed track blend"
          checked={config.includeMusic}
          onChange={(checked) => update({ includeMusic: checked })}
        />
        <MixSwitch
          label="include clip audio"
          description="retain original"
          checked={config.includeOriginal}
          onChange={(checked) => update({ includeOriginal: checked })}
        />
      </div>
      <SliderField
        label="music gain"
        min={-24}
        max={6}
        step={1}
        value={config.musicGain}
        onChange={(value) => update({ musicGain: value })}
        unit="dB"
      />
      <SliderField
        label="ducking"
        min={0}
        max={24}
        step={1}
        value={config.ducking}
        onChange={(value) => update({ ducking: value })}
        unit="dB"
      />
      <SliderField
        label="fade in/out"
        min={0}
        max={2000}
        step={100}
        value={config.fadeMs}
        onChange={(value) => update({ fadeMs: value })}
        unit="ms"
      />
      <SliderField
        label="beat accents"
        min={0}
        max={8}
        step={0.5}
        value={config.automationDepth}
        onChange={(value) => update({ automationDepth: value })}
        unit="dB"
      />
    </Card>
  );
}

interface MixSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function MixSwitch({ label, description, checked, onChange }: MixSwitchProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        className={`${checked ? "bg-brat" : "bg-zinc-700"} relative inline-flex h-8 w-16 items-center rounded-full transition`}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`${checked ? "translate-x-9" : "translate-x-1"} inline-block h-6 w-6 transform rounded-full bg-black transition`}
        />
      </Switch>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-brat"
      />
      <p className="mt-1 text-xs text-zinc-400">
        {value} {unit}
      </p>
    </div>
  );
}
