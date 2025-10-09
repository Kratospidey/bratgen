import { NextResponse } from "next/server";
import { spotifyLinkSchema } from "@/lib/validation";
import ytDlp from "yt-dlp-exec";

export const runtime = "nodejs";

interface YtDlpSpotifyTrack {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  thumbnail?: string;
  thumbnails?: Array<{ url: string }>;
  webpage_url: string;
  url?: string;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = spotifyLinkSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "invalid link" }, { status: 400 });
    }

    const { url } = parsed.data;
    const metadata = (await ytDlp(url, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      simulate: true
    })) as YtDlpSpotifyTrack;

    const albumArt = metadata.thumbnail ?? metadata.thumbnails?.[0]?.url ?? null;

    return NextResponse.json({
      id: metadata.id,
      title: metadata.title,
      artist: metadata.uploader,
      duration: metadata.duration,
      albumArt,
      previewUrl: metadata.url ?? null
    });
  } catch (error) {
    console.error("spotify metadata fetch failed", error);
    return NextResponse.json({ message: "failed to fetch spotify metadata" }, { status: 500 });
  }
}
