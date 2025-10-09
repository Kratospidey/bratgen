import { NextResponse } from "next/server";
import { z } from "zod";
import { alignLyricsToAudio } from "@/app/api/_lib/lyrics";
import { getUpload, notFoundResponse, serverErrorResponse } from "@/app/api/_lib/storage";

export const runtime = "nodejs";

const payloadSchema = z.object({
  uploadId: z.string().uuid(),
  lyrics: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ message: issue?.message ?? "invalid request" }, { status: 400 });
    }
    const { uploadId, lyrics } = parsed.data;
    const upload = await getUpload(uploadId);
    if (!upload) {
      return notFoundResponse("upload not found");
    }
    const alignment = await alignLyricsToAudio({ upload, lyrics });
    return NextResponse.json({ alignment });
  } catch (error) {
    console.error("lyric alignment failed", error);
    return serverErrorResponse("failed to align lyrics");
  }
}
