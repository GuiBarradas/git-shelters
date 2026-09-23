import Link from "next/link";
import type { ReactNode } from "react";

export type Lang = "en" | "pt";

/** `?lang=pt` picks Portuguese; anything else is English. */
export function pickLang(value: string | undefined): Lang {
  return value === "pt" ? "pt" : "en";
}

const UI = {
  en: { updated: "Last updated", back: "back to your Repo", privacy: "Privacy", terms: "Terms", other: "Ler em português" },
  pt: { updated: "Última revisão", back: "voltar ao seu Repo", privacy: "Privacidade", terms: "Termos", other: "Read in English" },
} as const;

/** Shared frame for /legal/* pages: title, last-updated stamp, language switch, prose. */
export function LegalPage({
  title,
  updated,
  lang,
  path,
  children,
}: {
  title: string;
  updated: string;
  lang: Lang;
  /** The page's own path, for the language switch. */
  path: string;
  children: ReactNode;
}) {
  const t = UI[lang];
  const other = lang === "en" ? "pt" : "en";
  return (
    <main className="flex-1 w-full flex justify-center p-8">
      <article
        lang={lang === "pt" ? "pt-BR" : "en"}
        className="max-w-2xl w-full space-y-6 font-mono text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-[#BD93F9] [&_p]:text-[#E6DFC8]/85 [&_a]:underline [&_a]:underline-offset-4"
      >
        <header className="space-y-1">
          <div className="flex items-baseline justify-between gap-4 text-xs uppercase tracking-widest text-[#E6DFC8]/60">
            <span>
              {"// legal :: "}
              {title.toLowerCase()}
            </span>
            <Link href={`${path}?lang=${other}`} className="normal-case tracking-normal hover:text-[#E6DFC8]">
              {t.other}
            </Link>
          </div>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-xs text-[#E6DFC8]/50">
            {t.updated} {updated}
          </p>
        </header>
        {children}
        <footer className="pt-8 text-xs text-[#E6DFC8]/50">
          <Link href="/" className="hover:text-[#E6DFC8]">
            &larr; {t.back}
          </Link>
          {" · "}
          <Link href={`/legal/privacy?lang=${lang}`} className="hover:text-[#E6DFC8]">
            {t.privacy}
          </Link>
          {" · "}
          <Link href={`/legal/terms?lang=${lang}`} className="hover:text-[#E6DFC8]">
            {t.terms}
          </Link>
        </footer>
      </article>
    </main>
  );
}
