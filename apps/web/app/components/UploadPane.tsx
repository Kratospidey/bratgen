"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button, Card, Label } from "@bratgen/ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadFormInput, uploadSchema } from "@/lib/validation";

interface UploadPaneProps {
  onSubmit: (data: UploadFormInput) => void;
}

export function UploadPane({ onSubmit }: UploadPaneProps) {
  const [videoName, setVideoName] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const {
    register,
    setValue,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<UploadFormInput>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { duration: 30 }
  });

  useEffect(() => {
    register("video");
    register("audio");
  }, [register]);

  const onDropVideo = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        setValue("video", acceptedFiles[0], { shouldValidate: true });
        setVideoName(acceptedFiles[0].name);
      }
    },
    [setValue]
  );

  const onDropAudio = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        setValue("audio", acceptedFiles[0], { shouldValidate: true });
        setAudioName(acceptedFiles[0].name);
      }
    },
    [setValue]
  );

  const videoDropzone = useDropzone({
    onDrop: onDropVideo,
    multiple: false,
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"]
    }
  });

  const audioDropzone = useDropzone({
    onDrop: onDropAudio,
    multiple: false,
    accept: {
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "audio/x-m4a": [".m4a"]
    }
  });

  return (
    <Card className="space-y-6">
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>video upload</Label>
            <div
              {...videoDropzone.getRootProps({
                className:
                  "flex h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 text-center text-sm text-zinc-400 transition hover:border-brat/60 hover:text-brat"
              })}
            >
              <input {...videoDropzone.getInputProps()} />
              <p className="font-semibold uppercase tracking-widest">drop mp4/mov</p>
              <p className="mt-2 text-xs text-zinc-500">max 200mb · 5-60s</p>
              {videoName && <p className="mt-4 text-xs text-brat">{videoName}</p>}
            </div>
            {errors.video && <p className="text-xs text-red-400">{errors.video.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>optional audio upload</Label>
            <div
              {...audioDropzone.getRootProps({
                className:
                  "flex h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 text-center text-sm text-zinc-400 transition hover:border-brat/60 hover:text-brat"
              })}
            >
              <input {...audioDropzone.getInputProps()} />
              <p className="font-semibold uppercase tracking-widest">drop wav/mp3</p>
              <p className="mt-2 text-xs text-zinc-500">for export fidelity & whisper timing</p>
              {audioName && <p className="mt-4 text-xs text-brat">{audioName}</p>}
            </div>
            {errors.audio && <p className="text-xs text-red-400">{errors.audio.message}</p>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="duration">target duration</Label>
            <input
              id="duration"
              type="range"
              min={5}
              max={60}
              step={1}
              className="w-full accent-brat"
              {...register("duration", { valueAsNumber: true })}
            />
            <p className="mt-1 text-xs text-zinc-400">{watch("duration")}s</p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">notes</Label>
            <textarea
              id="notes"
              className="h-16 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-brat focus:outline-none"
              placeholder="reference moments, lyric vibes, etc. (optional)"
            />
          </div>
        </div>
        <Button type="submit" className="w-full">start analysis</Button>
      </form>
    </Card>
  );
}
