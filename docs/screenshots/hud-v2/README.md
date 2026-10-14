# HUD v2 visual review — 2026-10-14

Reference: the five artboards in `Git Shelters HUD.pdf`. These captures use the real components in `/dev/scene-lab?hud=normal|blackout`, synthetic stats, seed 1709, Medium quality, isolated Chromium/D3D11, and a fixed browser clock of 2026-10-14T02:22:48Z. They are not production player statistics. The map images are the existing read-only public SVG map, before PR 2.

| State | Desktop 1440×900 | Mobile 390×844 | Wide 1920×1080 |
|---|---|---|---|
| Normal | [image](desktop-normal.png) | [image](mobile-normal.png) | [image](wide-normal.png) |
| Blackout | [image](desktop-blackout.png) | [image](mobile-blackout.png) | [image](wide-blackout.png) |
| Blackout + forecast | [image](desktop-forecast.png) | [image](mobile-forecast.png) | |
| Account menu | [image](desktop-menu.png) | [image](mobile-menu.png) | |
| Map baseline | [image](desktop-map.png) | [image](mobile-map.png) | |

Side-by-side comparisons: [normal](compare-normal.jpg), [blackout forecast](compare-forecast.jpg), [mobile](compare-mobile.jpg), [account menu](compare-menu.jpg). The menu reference is a cropped artboard; the implementation is a full viewport.

## Differences observed

- The dock has three items, not the five drawn in the PDF: Crew and Badges have no screens. It is narrower on desktop, with larger thirds on mobile. This is the approved scope.
- Uptime at its cap and full Payload during a blackout say FULL, following the brief's priority rule, rather than +17%/h or paused as drawn. Accessible labels retain the rates.
- The forecast uses the actual eight-hour simulation. It does not invent a three-hour starvation deadline, a blackout start time, lamp percentage or fixed worker capacity. Zero forecast deltas show ±0. It includes the stopped-production warning and explanatory copy, so it is taller than the PDF.
- The crew log uses the real mood/echo/tip helpers. Copy, line wrapping, names and mood differ; there is no `restless` mood in the game. The fixture uses `stressed`. Long echo lines truncate on desktop; the full meaning remains available in the terminal.
- The procedural bunker seed, residents, props, clothing, camera angle and live animation phase differ from the static artboard. The scene remains the existing 3D art. The measured HUD insets frame it slightly lower/smaller than the PDF; mobile shows a sliver of the adjacent column. Its existing black terrain and background also differ from the flat violet artboard surround.
- The hover card reports actual workers and separates gross room production from bunker drain. It has an extra line, English copy, and no invented 1/1 capacity. The staffing chip sits at the upper edge of the room, rather than at its center.
- Desktop icons are newly drawn inline SVGs in the same line style, not pixel-identical to the PDF (notably Bunker, sound and alerts). The alert omits the decorative lightning icon. Sound starts muted, so its icon is crossed out.
- Resource gauges occupy the available width; label/value spacing differs slightly. Mobile includes resource capacities (160/160 and 30/30), which the artboard omits. Values and labels are smaller than the mobile artboard.
- The mobile pager adds previous/next buttons for keyboard/touch access. The lower band has 16px side margins instead of roughly 12px in the artboard, and the pager/log are slightly lower; the resolved packet remains a compact single row.
- The account menu is 320px wide instead of approximately 300px in the source artboard. Rows and separators are slightly taller. Mobile adds Sound. The screenshot uses the blackout state, so the menu begins below the alert; the source artboard shows normal-day placement. Intro / credits and REPLAY are present.
- The font is the project's existing mono plus bundled Silkscreen for the approved three uses. Weight, rasterization and tracking differ slightly from the PDF. No rounded panels or panel shadows were added.
- Development captures include Next.js's lower-left dev indicator. It is absent from production builds.
- The component-sheet artboard is represented by the real full/empty gauges, pending/resolved packet, blocker, hover card, forecast and account states above; no separate production component-gallery route was added.
- The map remains the old SVG in this PR by design; its 3D replacement belongs to the dependent PR.

## Verification

Browser: no JavaScript page errors or horizontal overflow at 1440×900, 1920×1080 and 390×844; exactly one main scene canvas. Hover card and room outline visible. Entering Power Plant and returning kept the same canvas node. Phone pager buttons, arrow keys and an emulated touch swipe changed pages; crew disclosure and Escape worked; Escape returned focus to Account. These mobile checks also ran with reduced motion enabled. The existing anonymous landing Playwright test passed with a 30s renderer wait for cold development compilation.

Not verified: physical phone/touch hardware, mobile GPU performance, audio output, production-account gameplay or mutating Supabase integration tests. The local Supabase target is production, so no test users were created or deleted. Screenshots are visual checks, not frame-rate measurements.
