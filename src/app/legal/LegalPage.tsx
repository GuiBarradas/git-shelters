import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for /legal/* pages: title, last-updated stamp, prose. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 w-full flex justify-center p-8">
      <article className="max-w-2xl w-full space-y-6 font-mono text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-[#BD93F9] [&_p]:text-[#E6DFC8]/85 [&_a]:underline [&_a]:underline-offset-4">
        <header className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-[#E6DFC8]/60">
            {"// legal :: "}
            {title.toLowerCase()}
          </div>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-xs text-[#E6DFC8]/50">Last updated {updated}</p>
        </header>
        {children}
        <footer className="pt-8 text-xs text-[#E6DFC8]/50">
          <Link href="/" className="hover:text-[#E6DFC8]">&larr; back to your Repo</Link>
          {" · "}
          <Link href="/legal/privacy" className="hover:text-[#E6DFC8]">Privacy</Link>
          {" · "}
          <Link href="/legal/terms" className="hover:text-[#E6DFC8]">Terms</Link>
        </footer>
      </article>
    </main>
  );
}
