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
      <div className="pointer-events-none absolute top-4 left-4 z-10 font-mono text-sm text-[#7FFF6A]">
        <h1 className="text-base">{profile.login}&apos;s Repo</h1>
        <p className="text-[#E6DFC8]/70">
          {profile.bytes.toLocaleString("en-US")} B · maintainer since {memberSince}
        </p>
        <Link href="/" className="pointer-events-auto mt-2 inline-block hover:text-[#E6DFC8]">
          &larr; your Repo
        </Link>
      </div>
    </main>
  );
}
