import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import { getPublicProfile } from "@/lib/api/public-profile";

type Props = { params: Promise<{ login: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { login } = await params;
  const profile = await getPublicProfile(login);
  return { title: profile ? `${profile.login}'s Repo · Git Shelters` : "404 Lands · Git Shelters" };
}

/**
 * Read-only public bunker (ADR 0001). Same scene as the home page, but
 * with `bytes={null}` so the build menu never opens for a visitor.
 */
export default async function ProfilePage({ params }: Props) {
  const { login } = await params;
  const profile = await getPublicProfile(login);
  if (!profile) notFound();

  const memberSince = new Date(profile.memberSince).toISOString().slice(0, 10);

  return (
    <main className="relative w-full h-dvh">
      <BunkerSceneClient rooms={profile.rooms} bytes={null} activeToday={false} />
      <div className="pointer-events-none absolute top-4 left-4 z-10 font-mono text-sm text-[#BD93F9]">
        <h1 className="text-base">{profile.login}&apos;s Repo</h1>
        <p className="text-[#E6DFC8]/70">
          {profile.bytes.toLocaleString("en-US")} B · maintainer since {memberSince}
        </p>
        <p className="pointer-events-auto mt-2 space-x-4">
          <Link href="/" className="inline-block hover:text-[#E6DFC8]">
            &larr; your Repo
          </Link>
          <Link href="/map" className="inline-block hover:text-[#E6DFC8]">
            world map
          </Link>
        </p>
        {profile.badges.length > 0 && (
          <ul className="pointer-events-auto mt-4 flex max-w-sm flex-wrap gap-2 text-xs">
            {profile.badges.map((b) => (
              <li
                key={b.badge}
                tabIndex={0}
                className={`group relative cursor-help border px-2 py-0.5 ${
                  b.kind === "achievement"
                    ? "border-[#BD93F9]/50 text-[#BD93F9]"
                    : b.kind === "region"
                      ? "border-[#A14545]/70 text-[#E6DFC8]/80"
                      : "border-[#E67E22]/60 text-[#E67E22]"
                }`}
              >
                {b.name}
                {/* the blurb, on hover or keyboard focus; no delay, no native tooltip */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-56 border border-[#E6DFC8]/30 bg-[#0B0713] px-2 py-1 font-normal normal-case text-[#E6DFC8]/85 group-hover:block group-focus-visible:block"
                >
                  {b.blurb}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
