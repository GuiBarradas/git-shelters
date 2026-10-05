"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function NextPacket({ availableAt, observedAt }: { availableAt: string; observedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.parse(observedAt));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.max(0, Math.ceil((Date.parse(availableAt) - now) / 60_000));
  return minutes > 0 ? (
    <p className="text-[#BD93F9]">Next daily event in {Math.floor(minutes / 60)}h {minutes % 60}m.
      <span className="block text-[#E6DFC8]/60">Resets at <time dateTime={availableAt}>{availableAt.slice(0, 10)} · 00:00 UTC</time>.</span>
    </p>
  ) : (
    <button type="button" onClick={() => router.refresh()} className="min-h-11 border border-[#BD93F9] px-3 py-2 text-[#BD93F9]">A new daily event is ready · refresh</button>
  );
}
