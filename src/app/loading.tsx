/**
 * Shown by the App Router while a route's server work is in flight, so a
 * click never lands on a frozen page. In-world: a terminal waking up.
 */
export default function Loading() {
  return (
    <main className="flex h-dvh w-full items-center justify-center">
      <p className="font-mono text-sm text-[#7FFF6A]/80">
        &gt; resolving route<span className="blink">_</span>
      </p>
    </main>
  );
}
