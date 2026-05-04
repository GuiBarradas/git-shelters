import { AuthBar } from "@/components/auth/AuthBar";
import { BunkerSceneClient } from "@/components/scene/BunkerSceneClient";
import { countCommitsToday, fetchUserEvents } from "@/lib/github/events";
import { palette } from "@/lib/palette";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Supabase populates user_metadata from the OAuth provider profile.
  // For GitHub, `user_name` is the @handle (e.g. "GuiBarradas").
  const githubLogin =
    typeof user?.user_metadata?.user_name === "string"
      ? user.user_metadata.user_name
      : null;

  // Spike: anonymous GitHub API + pure counter.
  // Will become a Vercel Cron + persisted byte_transactions in a future chunk.
  const commitsToday = githubLogin
    ? countCommitsToday(await fetchUserEvents(githubLogin), new Date())
    : 0;

  // Binary signal for the spike: any commit today turns the bunker "alive".
  // Refines later to a 3-zone gradient (idle / active / on fire).
  const cubeColor =
    commitsToday > 0 ? palette.radioactiveGreen : palette.concreteTan;

  return (
    <main className="relative flex-1 w-full h-full">
      <BunkerSceneClient cubeColor={cubeColor} />
      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <AuthBar githubLogin={githubLogin} />
      </div>
    </main>
  );
}
