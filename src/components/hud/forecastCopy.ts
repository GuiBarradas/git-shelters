import type { ForecastWarning } from "@/lib/economy/forecast";

/**
 * Forecast warnings as the HUD says them. A plain module so both the
 * client ForecastDrawer and the server CrewLog read the same words.
 * Staffing gaps are things to do (amber); full racks are just facts.
 */
export const FORECAST_WARNINGS: Record<ForecastWarning, { text: string; tone: string }> = {
  cache_full: { text: "Cache reaches capacity. Extra meals will not be stored.", tone: "text-hud-bone/70" },
  payload_full: { text: "Payload reaches capacity. Extra rounds will not be stored.", tone: "text-hud-bone/70" },
  no_cooks: { text: "Cache Storage has no Cook. Assign a Fork inside the room.", tone: "text-hud-amber" },
  no_engineers: { text: "Power Plant has no Engineer. Assign a Fork inside the room.", tone: "text-hud-amber" },
  no_tinkerers: { text: "Workshop has no Tinkerer. Assign a Fork inside the room.", tone: "text-hud-amber" },
};
