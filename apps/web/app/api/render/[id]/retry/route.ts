import { NextResponse } from "next/server";
import { getRenderJob, retryRenderJob } from "@/app/api/_lib/render-queue";
import { notFoundResponse, serverErrorResponse } from "@/app/api/_lib/storage";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const job = await getRenderJob(id);
    if (!job) {
      return notFoundResponse("render job not found");
    }
    await retryRenderJob(id);
    const updated = await getRenderJob(id);
    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("retry job failed", error);
    return serverErrorResponse("failed to retry job");
  }
}
