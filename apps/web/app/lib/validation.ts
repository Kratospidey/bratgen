import { z } from "zod";

export const spotifyLinkSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => /open\.spotify\.com\/track\//.test(value) || /^spotify:track:/.test(value), {
      message: "must be a spotify track link"
    })
});

export type SpotifyLinkInput = z.infer<typeof spotifyLinkSchema>;

export const uploadSchema = z.object({
  video: z
    .custom<File | null>()
    .refine((file): file is File => !!file, "video is required")
    .refine((file) => (file ? file.size <= 200 * 1024 * 1024 : false), "max 200mb"),
  audio: z.custom<File | null>().optional(),
  duration: z.number().min(5).max(60)
});

export type UploadFormInput = z.infer<typeof uploadSchema>;

export const renderRequestSchema = z.object({
  uploadId: z.string().uuid(),
  segment: z
    .object({
      start: z.number().min(0),
      end: z.number().positive()
    })
    .refine((value) => value.end > value.start, {
      message: "segment duration must be positive",
      path: ["end"]
    }),
  options: z.object({
    resolution: z.enum(["720p", "1080p"]),
    aspect: z.enum(["9:16", "1:1", "16:9"]),
    includeMusic: z.boolean(),
    includeOriginal: z.boolean(),
    musicGainDb: z.number().min(-24).max(12).optional(),
    duckingDb: z.number().min(0).max(24).optional(),
    fadeMs: z.number().min(0).max(4000).optional()
  })
});

export type RenderRequestInput = z.infer<typeof renderRequestSchema>;

export const audioAnalysisRequestSchema = z.object({
  uploadId: z.string().uuid(),
  targetDuration: z.number().min(5).max(120).optional()
});

export type AudioAnalysisInput = z.infer<typeof audioAnalysisRequestSchema>;

export const lyricAlignmentRequestSchema = z.object({
  uploadId: z.string().uuid(),
  lyrics: z.string().min(1)
});

export type LyricAlignmentInput = z.infer<typeof lyricAlignmentRequestSchema>;
