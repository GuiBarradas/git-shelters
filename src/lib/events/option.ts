import type { Json } from "@/lib/supabase/database.types";

/** One side of a Daily Event decision, as stored in the catalog jsonb. */
export type DailyEventOption = {
  label: string;
  outcome_text: string;
  bytes_delta: number;
};

/** Narrows catalog/outcome jsonb at the trust boundary; null if malformed. */
export function parseOption(json: Json | null | undefined): DailyEventOption | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const { label, outcome_text, bytes_delta } = json;
  return typeof label === "string" &&
    typeof outcome_text === "string" &&
    typeof bytes_delta === "number"
    ? { label, outcome_text, bytes_delta }
    : null;
}
