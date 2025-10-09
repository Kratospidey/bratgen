import { Suspense } from "react";
import { LandingShell } from "./shell";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-zinc-500">loading brat studio…</div>}>
      <LandingShell />
    </Suspense>
  );
}
