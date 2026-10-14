import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import { isGithubLogin } from "@/lib/visuals/server";
import { downloadPreview } from "@/lib/visuals/share-card";

export const runtime = "nodejs";

const VIOLET = "#1b1029";
const PANEL = "#2a1a3d";
const CREAM = "#f3e8d0";
const MUTED = "#b9a8cf";
const ACCENT = "#e8b84a";
let fontData: Promise<ArrayBuffer> | undefined;
const loadFont = () => fontData ??= readFile(join(process.cwd(), "public/fonts/silkscreen/Silkscreen-Regular.ttf"))
  .then((font) => Uint8Array.from(font).buffer);
/** 1200 - 2x40 padding - 600 scene - 40 gap. */
const COLUMN = 480;

/**
 * Public share card (1200x630). Stats are read here with the service role
 * (ADR 0001), never taken from the client; the scene is the owner's own
 * upload from the private bunker-previews bucket, or an honest fallback.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  if (!isGithubLogin(login)) return new Response("not found", { status: 404 });

  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, github_login, bytes, deleted_at")
    .ilike("github_login", login)
    .maybeSingle();
  if (error) return unavailable();
  if (!user || user.deleted_at) return new Response("not found", { status: 404 });

  const [rooms, forks, scene] = await Promise.all([
    // The Main Branch (slot 0) is built in and never stored, so every row here was built.
    admin.from("rooms").select("slot", { count: "exact", head: true }).eq("user_id", user.id).gt("slot", 0),
    // forks only holds living residents.
    admin.from("forks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    downloadPreview(admin, user.id),
  ]);
  if (rooms.error || forks.error || rooms.count === null || forks.count === null) return unavailable();

  const stats: [string, number][] = [
    ["Bytes em saldo", user.bytes],
    ["Forks vivos", forks.count],
    ["Salas construídas", rooms.count],
  ];

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: VIOLET, color: CREAM, fontFamily: "Silkscreen", padding: 40, gap: 40 }}>
        {scene ? (
          // Satori renders the embedded PNG directly, without a browser image loader.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${Buffer.from(scene).toString("base64")}`}
            width={600}
            height={450}
            style={{ borderRadius: 16, border: `4px solid ${PANEL}`, alignSelf: "center" }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              width: 600,
              height: 450,
              alignSelf: "center",
              borderRadius: 16,
              border: `4px dashed ${MUTED}`,
              background: PANEL,
              gap: 12,
            }}
          >
            <div style={{ fontSize: 40, color: CREAM, maxWidth: 520, padding: "0 24px", textAlign: "center" }}>Seu bunker, sua identidade.</div>
            <div style={{ fontSize: 24, color: MUTED }}>Prévia ainda não capturada</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: COLUMN, gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 22, color: ACCENT, letterSpacing: 4 }}>GIT SHELTERS</div>
            <div style={{ fontSize: loginFontSize(user.github_login), color: CREAM, wordBreak: "break-all" }}>{`@${user.github_login}`}</div>
          </div>
          {stats.map(([label, value]) => {
            const text = value.toLocaleString("pt-BR");
            return (
              <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: text.length > 12 ? 32 : 48, color: CREAM }}>{text}</div>
                <div style={{ fontSize: 22, color: MUTED }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Silkscreen", data: await loadFont(), style: "normal", weight: 400 }],
      // A deleted account or replaced capture must not remain available from a shared cache.
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** GitHub logins run up to 39 chars; step the size down so "@login" fits the stats column. */
function loginFontSize(login: string) {
  return login.length > 30 ? 18 : login.length > 20 ? 24 : login.length > 13 ? 30 : 44;
}

function unavailable() {
  return new Response("unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
}
