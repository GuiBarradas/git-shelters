"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OpenState = { tone: "idle" | "ok" | "warn"; bytes: number; message: string; at: number };

/**
 * Opens a packet: marks it read and pays whatever it carries, once. The
 * RPC checks ownership; a second open is a no-op for the balance.
 */
export async function openNotice(_prev: OpenState, formData: FormData): Promise<OpenState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { tone: "warn", bytes: 0, message: "that packet is not addressed to you", at: Date.now() };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tone: "warn", bytes: 0, message: "not signed in", at: Date.now() };

  const { data, error } = await createAdminClient().rpc("open_notice", { p_user_id: user.id, p_notice_id: id });
  if (error) {
    if (!error.message.includes("notice_not_found")) {
      Sentry.captureException(error, { tags: { user_id: user.id, entrypoint: "open_notice" } });
    }
    return { tone: "warn", bytes: 0, message: "the packet would not open. Try again", at: Date.now() };
  }

  revalidatePath("/");
  const bytes = data ?? 0;
  return { tone: "ok", bytes, message: bytes > 0 ? `+${bytes} B collected` : "read", at: Date.now() };
}
