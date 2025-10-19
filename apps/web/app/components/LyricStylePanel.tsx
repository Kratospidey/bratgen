"use client";

import { useMemo } from "react";
import { Card, Label } from "@bratgen/ui";
import { Switch } from "@headlessui/react";
import clsx from "clsx";
import { defaultLyricStyle, type LyricStyleConfig } from "@/components/PlayerCanvas";

interface LyricStylePanelProps {
  value?: Partial<LyricStyleConfig>;
  onChange?: (next: LyricStyleConfig) => void;
  variant?: "standalone" | "section";
  className?: string;
}

const weights: Array<LyricStyleConfig["weight"]> = ["semibold", "bold", "extrabold"];
const colorModes: Array<LyricStyleConfig["colorMode"]> = ["auto", "light", "dark"];
const wordReveals: Array<LyricStyleConfig["wordReveal"]> = ["fade", "slide"];

export function LyricStylePanel({ value, onChange, variant = "standalone", className }: LyricStylePanelProps) {
  const merged = useMemo(() => ({ ...defaultLyricStyle, ...(value ?? {}) }), [value]);

  const update = (patch: Partial<LyricStyleConfig>) => {
    const next: LyricStyleConfig = { ...merged, ...patch };
    onChange?.(next);
  };

  const content = (
    <>
      <div>
        <Label>lyric styling</Label>
        <p className="text-xs text-zinc-500">brat-style tweaks: outlines, jitter, uppercasing, reveal motion.</p>
      </div>
      <SliderField
        label="font size"
        min={2.0}
        max={4.5}
        step={0.1}
        value={merged.fontSize}
        onChange={(value) => update({ fontSize: value })}
      />
      <SliderField
        label="line height"
        min={0.8}
        max={1.2}
        step={0.02}
        value={merged.lineHeight}
        onChange={(value) => update({ lineHeight: value })}
      />
      <SliderField
        label="outline"
        min={0}
        max={4}
        step={0.2}
        value={merged.outlineWidth}
        onChange={(value) => update({ outlineWidth: value })}
      />
      <SliderField
        label="letter spacing"
        min={-0.2}
        max={0.2}
        step={0.01}
        value={merged.letterSpacing}
        onChange={(value) => update({ letterSpacing: value })}
      />
      <SliderField
        label="word jitter"
        min={0}
        max={4}
        step={0.2}
        value={merged.jitter}
        onChange={(value) => update({ jitter: value })}
      />
      <SliderField
        label="shadow intensity"
        min={0}
        max={1}
        step={0.05}
        value={merged.shadowIntensity}
        onChange={(value) => update({ shadowIntensity: value })}
      />
      <ToggleField
        label="uppercase"
        description="force all-caps"
        checked={merged.uppercase}
        onChange={(checked) => update({ uppercase: checked })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionField
          label="weight"
          options={weights}
          value={merged.weight}
          onSelect={(weight) => update({ weight })}
        />
        <OptionField
          label="reveal"
          options={wordReveals}
          value={merged.wordReveal}
          onSelect={(wordReveal) => update({ wordReveal })}
        />
      </div>
      <OptionField
        label="color"
        options={colorModes}
        value={merged.colorMode}
        onSelect={(colorMode) => update({ colorMode })}
      />
    </>
  );

  if (variant === "section") {
    return (
      <div
        className={clsx(
          "space-y-4 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_0_45px_rgba(203,255,0,0.04)]",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return <Card className={clsx("space-y-4", className)}>{content}</Card>;
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-brat"
      />
      <p className="text-xs text-zinc-500">{value.toFixed(2)}</p>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
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
        <span className={`${checked ? "translate-x-9" : "translate-x-1"} inline-block h-6 w-6 transform rounded-full bg-black transition`} />
      </Switch>
    </div>
  );
}

function OptionField<T extends string>({
  label,
  options,
  value,
  onSelect
}: {
  label: string;
  options: readonly T[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em] transition ${
              option === value ? "bg-brat text-black" : "bg-black/50 text-white/70"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
