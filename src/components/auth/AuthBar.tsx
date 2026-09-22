import { signInWithGithub, signOut } from "@/app/auth/actions";
import { SyncButton } from "@/components/auth/SyncButton";

type AuthBarProps = {
  /** GitHub login of the authenticated user, or null if anonymous. */
  githubLogin: string | null;
  /** Materialised balance from users.bytes; null when anonymous or unavailable. */
  bytes: number | null;
};

/**
 * Top-right corner authentication HUD.
 *
 * Renders either a "Connect GitHub" call-to-action (anonymous) or the
 * user's GitHub login + a logout button (authenticated). Both forms post
 * to Server Actions — no client-side auth client needed.
 *
 * Visual: minimal Pip-Boy-ish styling using palette hexes inline. Will be
 * replaced by a proper `<Button>` atom (GDD §22.3) once that exists.
 */
export function AuthBar({ githubLogin, bytes }: AuthBarProps) {
  if (githubLogin) {
    return (
      <div className="pointer-events-auto flex items-center gap-3 font-mono text-sm text-[#7FFF6A]">
        <a href={`/u/${githubLogin}`} className="hover:text-[#E6DFC8]" title="Your public Repo">
          {githubLogin}
        </a>
        <span
          className="border border-[#7FFF6A]/40 px-3 py-1 tabular-nums"
          title="Bytes"
        >
          {bytes === null ? "-- B" : `${bytes.toLocaleString("en-US")} B`}
        </span>
        <SyncButton />
        <form action={signOut}>
          <button
            type="submit"
            className="border border-[#7FFF6A] px-3 py-1 hover:bg-[#7FFF6A]/10 transition"
          >
            Logout
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={signInWithGithub}
      className="pointer-events-auto font-mono text-sm"
    >
      <button
        type="submit"
        className="border border-[#7FFF6A] px-4 py-2 text-[#7FFF6A] hover:bg-[#7FFF6A]/10 transition"
      >
        Connect GitHub
      </button>
    </form>
  );
}
