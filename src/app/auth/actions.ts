"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Initiates the GitHub OAuth flow.
 *
 * Supabase returns a URL we must redirect the user to (a github.com URL with
 * client_id, scopes, and our callback embedded). After the user authorizes,
 * GitHub redirects to Supabase, Supabase exchanges the code, and Supabase
 * finally redirects to our `/auth/callback` route — which writes session
 * cookies and lands the user back on the app.
 */
export async function signInWithGithub() {
  const supabase = await createClient();

  // Compute the absolute origin from request headers. In dev that's
  // http://localhost:3000; in prod that's the deployed Vercel URL.
  // Without this, the redirect loop assumes localhost and breaks in prod.
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? headerStore.get("host");
  const baseUrl = origin?.startsWith("http") ? origin : `https://${origin}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/auth/error?reason=signin_failed");
  }

  redirect(data.url);
}

/**
 * Signs the user out by clearing the Supabase session cookies, then
 * sends them home.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
