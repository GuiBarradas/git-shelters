import type { Metadata } from "next";

import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Privacy · Git Shelters" };

/**
 * Plain-language privacy notice. Every claim here is checked against the
 * code: if a new data source lands, this page changes in the same PR.
 * Draft for legal review before the Public Alpha announcement.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="2026-09-23">
      <h2>What we collect</h2>
      <p>
        When you connect GitHub, we receive your GitHub login, numeric user id and the email
        address GitHub shares with the sign-in. We then read your <em>public</em> GitHub events
        feed to count pushes. We never read repository contents, private repositories or
        anything that needs more than the public feed.
      </p>
      <p>
        Playing creates game data: a byte ledger, the rooms you build, your Forks, the Daily
        Events you resolve, the badges you earn, a sync cursor, when you were last seen and
        whether the intro has played. We also log a short list of product events on our own
        server (sign-up, session start and end, a room built, an event resolved, a badge
        earned), tied to your user id, to see whether the game works. Errors are reported to
        Sentry with a technical trace and your user id, never your email.
      </p>

      <h2>Why</h2>
      <p>
        To run the game. Your GitHub activity is the game&apos;s only input. We do not sell,
        share or use any of it for advertising.
      </p>

      <h2>Where it lives</h2>
      <p>
        Supabase (database and sign-in) and Vercel (hosting), both under the maintainer&apos;s
        accounts. Sentry receives error reports. No other third party receives your data.
      </p>

      <h2>What is public</h2>
      <p>
        Your public profile page shows your GitHub login, your byte balance, when you joined,
        the rooms in your bunker and the badges you earned. The world map shows the same facts
        as a dot in your region. Nothing else is visible to other players.
      </p>

      <h2>Cookies</h2>
      <p>
        Only the session cookie that keeps you signed in. There is no analytics cookie, no
        tracking pixel and no third-party script. Your browser also keeps one preference for
        us, whether sound is on, in its local storage; it never leaves your device.
      </p>

      <h2>Your rights (LGPD, GDPR)</h2>
      <p>
        From <a href="/settings">Settings</a> you can download everything we hold about you as
        JSON, including the product events, or delete your account. Deletion is immediate
        and permanent: it removes your sign-in, your ledger, your bunker, your badges, your
        event history and your product events. We keep a one-line audit entry (an internal id
        and a timestamp) as proof the deletion happened.
      </p>
      <p>
        Revoking Git Shelters in your GitHub settings stops any future reads of your public
        feed. It does not delete game data; use the delete button for that.
      </p>

      <h2>Contact</h2>
      <p>
        Questions and requests: open an issue on the public repository or write to the
        maintainer at the address listed there.
      </p>
    </LegalPage>
  );
}
