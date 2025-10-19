"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Input, Label } from "@bratgen/ui";
import Image from "next/image";
import clsx from "clsx";
import { fetchSpotifyMetadata } from "@/lib/api";

interface SpotifyLinkFormProps {
  onMetadata: (metadata: Awaited<ReturnType<typeof fetchSpotifyMetadata>>) => void;
  variant?: "standalone" | "section";
  className?: string;
}

export function SpotifyLinkForm({ onMetadata, variant = "standalone", className }: SpotifyLinkFormProps) {
  const [url, setUrl] = useState("");
  const mutation = useMutation({
    mutationFn: fetchSpotifyMetadata,
    onSuccess: (data) => {
      onMetadata(data);
    }
  });

  const content = (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(url);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="spotify-url">spotify track link</Label>
          <Input
            id="spotify-url"
            placeholder="https://open.spotify.com/track/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          {mutation.error && (
            <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
          )}
        </div>
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? "fetching" : "pull spotify analysis"}
        </Button>
      </form>
      {mutation.data && (
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          {mutation.data.albumArt && (
            <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10">
              <Image
                src={mutation.data.albumArt}
                alt="album art"
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-lg font-semibold text-white">{mutation.data.title}</p>
            <p className="text-sm text-zinc-400">{mutation.data.artist}</p>
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              {Math.round(mutation.data.duration)}s · spotify analysis ready
            </p>
          </div>
        </div>
      )}
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
