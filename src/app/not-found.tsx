import Link from "next/link";

/**
 * App-wide 404. Rendered by notFound() (unknown or deleted profile) and by
 * any unmatched route. The joke writes itself: this is the 404 Lands.
 */
export default function NotFound() {
  return (
    <main className="flex-1 w-full h-dvh flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 border border-[#E6DFC8]/20 p-6">
        <div className="text-xs uppercase tracking-widest text-[#E6DFC8]/60">
          {"// gitnet :: no route"}
        </div>
        <h1 className="text-2xl font-mono">404 LANDS</h1>
        <p className="text-sm text-[#E6DFC8]/80 leading-relaxed">
          Nothing resolves here. No Repo, no Maintainer, no signal. Whatever
          you were looking for either never existed or walked into The Outage.
        </p>
        <Link
          href="/"
          className="inline-block border border-[#BD93F9] px-3 py-1 font-mono text-sm text-[#BD93F9] hover:bg-[#BD93F9]/10 transition"
        >
          &larr; back to your Repo
        </Link>
      </div>
    </main>
  );
}
