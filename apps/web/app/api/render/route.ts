import { NextResponse } from "next/server";
import { enqueueRenderJob, getRenderJob, getRenderQueueHealth, listPublicRenderJobs } from "@/app/api/_lib/render-queue";
import { getUpload } from "@/app/api/_lib/storage";
import { renderRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const [jobs, health] = await Promise.all([listPublicRenderJobs(), getRenderQueueHealth().catch(() => null)]);
  return NextResponse.json({ jobs, health });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = renderRequestSchema.safeParse(payload);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ message: issue?.message ?? "invalid render request" }, { status: 400 });
    }

    const { uploadId, segment, options } = parsed.data;
    const upload = await getUpload(uploadId);

    if (!upload) {
      return NextResponse.json({ message: "upload not found" }, { status: 404 });
    }

    if (options.includeMusic && !upload.files.audio) {
      return NextResponse.json({ message: "audio track required to include music" }, { status: 400 });
    }

    const manifest = await enqueueRenderJob({ uploadId, segment, options });
    const job = await getRenderJob(manifest.id);

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error("render queueing failed", error);
    return NextResponse.json({ message: "failed to queue render" }, { status: 500 });
  }
}
