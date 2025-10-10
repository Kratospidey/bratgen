import { NextResponse } from "next/server";
import { badRequestResponse, createUpload, listUploads } from "@/app/api/_lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const uploads = await listUploads();
  return NextResponse.json({ uploads });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const maybeVideo = formData.get("video");
  if (!(maybeVideo instanceof File)) {
    return badRequestResponse("video file missing");
  }

  const durationRaw = formData.get("duration");
  const duration = typeof durationRaw === "string" ? Number(durationRaw) : NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    return badRequestResponse("invalid duration");
  }

  const maybeAudio = formData.get("audio");
  const audio = maybeAudio instanceof File ? maybeAudio : null;

  const upload = await createUpload({
    video: maybeVideo,
    audio,
    duration
  });

  return NextResponse.json({ upload });
}
