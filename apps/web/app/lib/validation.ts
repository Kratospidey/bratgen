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
