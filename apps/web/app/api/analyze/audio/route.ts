import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeUploadAudio } from "@/app/api/_lib/analysis";
import { getUpload, notFoundResponse, serverErrorResponse } from "@/app/api/_lib/storage";

export const runtime = "nodejs";

const payloadSchema = z.object({
  uploadId: z.string().uuid(),
  targetDuration: z.number().min(5).max(120).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ message: issue?.message ?? "invalid request" }, { status: 400 });
    }
    const { uploadId, targetDuration = 30 } = parsed.data;
    const upload = await getUpload(uploadId);
    if (!upload) {
      return notFoundResponse("upload not found");
    }
    const analysis = await analyzeUploadAudio(upload, targetDuration);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("audio analysis failed", error);
    return serverErrorResponse("failed to analyze audio");
  }
}
