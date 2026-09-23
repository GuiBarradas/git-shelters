import type { Metadata } from "next";

import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Terms · Git Shelters" };

/** Short, honest terms for a free public alpha. Draft for legal review. */
export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="2026-09-23">
      <h2>The deal</h2>
      <p>
        Git Shelters is a free game in public alpha, run by one maintainer. You may play it,
        share your public profile and stop whenever you like. There is no payment, no
        subscription and nothing to buy.
      </p>

      <h2>Your account</h2>
      <p>
        One account per GitHub login. Bytes are earned from your own public GitHub activity.
        Fabricating activity to farm bytes (bot pushes, throwaway repositories, rewritten
        history) is against the spirit of the game; the anti-cheese filters may discard it and
        the maintainer may reset a balance that was clearly farmed.
      </p>

      <h2>Alpha means alpha</h2>
      <p>
        Balances, rooms and events may be rebalanced, migrated or reset between releases. We
        will say so in the changelog when it happens. The game is provided as is, without
        warranty, and may be unavailable at any time.
      </p>

      <h2>Content</h2>
      <p>
        The game&apos;s text, art and code belong to the maintainer, except where the public
        repository&apos;s license says otherwise. Your GitHub data stays yours; see the{" "}
        <a href="/legal/privacy">privacy notice</a> for what we read and how to delete it.
      </p>

      <h2>Music</h2>
      <p>
        The theme is &ldquo;Uncontained&rdquo; by Alana Jordan. The ambience tracks are &ldquo;The
        Shining Ambience&rdquo; by Mezhdunami and &ldquo;The Foyer Mirror&rdquo; by turning_pages. All
        three are used under the Pixabay Content License. Sound is off until you turn it on, and the
        choice stays in your browser.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the game grows. The date above is the last revision;
        continuing to play after a change means you accept it.
      </p>
    </LegalPage>
  );
}
