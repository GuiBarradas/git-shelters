import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { deleteOwnAccount } from "./actions";

export const metadata: Metadata = { title: "Settings · Git Shelters" };

/**
 * Account settings as a dedicated route (ADR 0003). Holds the two LGPD
 * controls the Public Alpha must ship (ADR 0007): export and delete.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const login = typeof user.user_metadata?.user_name === "string" ? user.user_metadata.user_name : "";
  const { error } = await searchParams;

  return (
    <main className="flex-1 w-full flex items-start justify-center p-8">
      <div className="max-w-md w-full space-y-8 font-mono text-sm">
        <header className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-[#E6DFC8]/60">
            {"// maintainer :: settings"}
          </div>
          <h1 className="text-2xl">{login}</h1>
          <Link href="/" className="inline-block text-[#BD93F9] hover:text-[#E6DFC8]">
            &larr; back to your Repo
          </Link>
        </header>

        <section className="space-y-3 border border-[#E6DFC8]/20 p-5">
          <h2 className="text-[#BD93F9]">Export your data</h2>
          <p className="text-[#E6DFC8]/80 leading-relaxed">
            Everything the bunker holds about you, as one JSON file: account, byte ledger,
            rooms, Daily Event history and sync state.
          </p>
          <a
            href="/api/account/export"
            className="inline-block border border-[#BD93F9] px-3 py-1 text-[#BD93F9] transition hover:bg-[#BD93F9]/10"
          >
            Download JSON
          </a>
        </section>

        <section className="space-y-3 border border-[#A14545]/60 p-5">
          <h2 className="text-[#A14545]">Delete your account</h2>
          <p className="text-[#E6DFC8]/80 leading-relaxed">
            Erases your Repo, every byte, every room and every decision. GitHub itself is
            untouched. This cannot be rolled back.
          </p>
          {error === "delete_failed" && (
            <p className="text-[#A14545]">
              The deletion failed on our side and has been logged. Try again in a moment.
            </p>
          )}
          <form action={deleteOwnAccount} className="space-y-3">
            <label className="block text-[#E6DFC8]/60">
              Type <span className="text-[#E6DFC8]">{login}</span> to confirm
              <input
                name="confirm"
                autoComplete="off"
                required
                pattern={login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}
                className="mt-1 block w-full border border-[#E6DFC8]/30 bg-transparent px-2 py-1 text-[#E6DFC8] outline-none focus:border-[#A14545]"
              />
            </label>
            <button
              type="submit"
              className="border border-[#A14545] px-3 py-1 text-[#A14545] transition hover:bg-[#A14545]/10"
            >
              Delete forever
            </button>
          </form>
        </section>

        <footer className="text-xs text-[#E6DFC8]/50">
          <Link href="/legal/privacy" className="hover:text-[#E6DFC8]">Privacy</Link>
          {" · "}
          <Link href="/legal/terms" className="hover:text-[#E6DFC8]">Terms</Link>
        </footer>
      </div>
    </main>
  );
}
