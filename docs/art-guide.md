# Git Shelters art guide

The contract for anything visual in the game: the world, the rooms, the Forks, the interface and the brand. If a picture is not covered here, ask before drawing it. Also available as a [PDF](./art-guide.pdf).

<p align="center"><img src="./art/corridor.jpg" alt="The corridor" width="720" /></p>

## 1. Pillars

1. **A dollhouse cut open.** The bunker is a cross-section: rooms side by side, open at the front, seen from slightly above and to the right by a low-FOV perspective camera (28 degrees). Depth exists but the reading is frontal. Nothing important hides behind anything.
2. **Soft low-poly diorama.** Use three.js primitives, shared low-segment rounded boxes and a rounded extruded room rim with `DioramaMaterial` (Three Standard plus local diffuse lighting). Curves belong to silhouettes: hulls, cushions, containers and furniture edges. No imported models. Surface marks use one shared 1024 × 512 SVG atlas with cutout materials; keep UVs when batching. Basic materials are reserved for indicators and inexpensive vertex-colour light pools.
3. **Warm inside, violet where it glows.** Rooms are lit by warm lamps. Violet belongs to screens, LEDs, indicators and the interface. A violet lamp is a mistake.
4. **Lived in, not pretty.** Clutter tells the story: a mug, a cable bundle, boots by the bunk, a working wall clock. Everything looks scavenged, repaired, labelled by hand.
5. **Dry humour, no gore.** The apocalypse is a merge conflict. Danger is a blinking beacon and a hazard stripe, never blood.

## 2. Palette

The tokens live in `src/lib/palette.ts` and `src/app/globals.css`. Use them by name; do not invent hex values in components unless it is a one-off shade of an existing token.

| Token | Hex | Use |
|---|---|---|
| `bunkerBlack` | `#0B0713` | page and panel background, the earth |
| `inactivePlum` | `#2D2235` | unbuilt cells, inactive blocks, map regions |
| `phosphorViolet` | `#BD93F9` | interface text, borders, screens, LEDs, emissives |
| `violetDim` | `#8D46A3` | dim borders, glows, locked things |
| `amber` | `#E67E22` | calls to action, warnings, the active Main Branch lamp, the Maintainer's own dot |
| `lampWarm` | `#FFC98A` | every room lamp |
| `concrete` | `#45414F` | beams, pillars, shell |
| `concreteTan` | `#8B7E5A` | furniture, cabinets, small props |
| `oldWoodBrown` | `#5C3A21` | desks, bunks, crates |
| `steelBlue` | `#3A4A5A` | floors, drums, steel |
| `boneWhite` | `#E6DFC8` | body text, paper, mattresses, mugs |
| `fadedRed` | `#A14545` | danger, the chair, blankets |
| `mustardWarning` | `#D4A24C` | sparingly: a crate, a shirt |
| `glowYellow` | `#FFD66B` | the idle Main Branch lamp, a helmet |
| `coalBlack` | `#0F0F0F` | black objects |

The 404 Lands map adds `mapTones` in the same file: darkened tones of these tokens for the plateaus and props, plus two recorded exceptions. `clusterBlue` (`#8fb3d9`) is a light tone of `steelBlue` for the Cluster's LEDs: §9 asks for cold blue and LEDs may never be green. `beaconRed` (`#e05a5a`) is a lit `fadedRed` for the Outage beacons.

Rules: no green anywhere. Amber is the only warm accent in the interface. Text on the background is `boneWhite` for prose and `phosphorViolet` for anything the game says.

## 3. Light

- The overview uses cool hemisphere fill, a warm directional light and two analytical local sources in `DioramaMaterial`, evaluated per vertex and interpolated across surfaces. This is approximate diffuse lighting, not a baked lightmap or occlusion solution. Subdivide broad walls enough to keep gradients smooth. Procedural concrete noise runs only on the hull. Shared discs provide contact shade; additive pools are only a faint accent. `RoomLight` enables a few actual, unshadowed prop lights only in close-up.
- In close-up, the shell light and one or two prop lights strengthen the shader lighting. Keep amber sources near a visible fixture and violet near a screen, with short range and decay 2. Do not add shadow-casting point lights per room.
- Screens, LEDs and indicators glow through `emissive`, not through lights, except the Main Branch screen which also tints the desk with a small violet point light.
- A dark bunker is a feature. When `powered` is false, lamps drop to about 12% and emissives go to zero. Every room takes a `powered` prop and must read as dead without it.
- The green terminal is gone. Screens are violet phosphor on `#150a26`.

## 4. Space and scale

A cell is 4 wide, 3 high, 3 deep, centred at the origin; the floor is y = 0, the back wall's face is at **z = -1.25** (the shell's wall is 0.25 thick from z = -1.5). Anything on the wall sits at z ≥ -1.22 or it is inside the wall and invisible. Pillars stand at x = ±2.1; keep props inside x = ±1.85.

A Fork is about 1.45 tall. Waist height is 0.66 (desks), seat height 0.3 to 0.5, shelves from 1.4 up. A survivor's head must clear a bunk, a lamp shade and the bottom of any HTML read-out.

<p align="center"><img src="./art/main-branch.jpg" alt="The Main Branch" width="720" /></p>

## 5. A room's anatomy

Every interior exports three things and registers them in `src/components/scene/rooms/index.tsx`:

- **`LAYOUT`**: a walk lane (`{ z, xMin, xMax }`, usually z ≈ 1.1, the front strip) and a list of stations. The lane is furniture-free by contract; a Fork enters a station straight from the lane along z and leaves the same way. A station has a position (feet), a facing, an action (`sit`, `type`, `work`, `inspect`, `cook`, `crank`), a hold time, and for sitting a `seatY`.
- **A panel anchor**: where the room's HTML read-out is pinned (position, width, height). One world unit is 40 CSS pixels. The read-out is DOM over the canvas: it paints over everything, so keep stations out of its screen area or a Fork will vanish behind text.
- **The interior component**: `<RoomShell light lightIntensity powered>` and children. Read `MainBranchRoom.tsx` first; it is the reference for density.

Density target: one hero object (the terminal, the drum, the bunk, the bench, the shaft), two or three secondary objects, and five to ten pieces of clutter. Group related primitives so they move together.

Performance targets: 60 fps on integrated graphics, 30 fps on a midrange phone, and fewer than 300 draw calls for the isolated 30-room fixture. These are targets, not guarantees. `SceneInstances` shares repeated geometry across rooms and moving Fork pivots. Original meshes remain available for raycasting; meshes that animate their own visibility or material use `LIVE`. Contact shade draws before additive glow; arbitrary transparent meshes remain independent. `StaticBatch` first merges static room props by compatible material; `SceneInstances` then instances the repeated room templates. Forks skip the first merge so different outfits can still share instanced limb geometry. No realtime shadow maps.

Quality presets: **Low** disables postprocessing and dust/steam, uses a cheaper diffuse response in the overview, caps overview DPR at 1 and can adapt down to 0.75. Close-ups retain Standard material response and their local lights in every preset. **Medium** adds HDR bloom (threshold 1.15), ACES tone mapping, SMAA, vignette and faint grain. **High** adds half-resolution N8AO and mild, target-focused DOF only in close-up; close-up DPR is 1.5. The renderer uses ACES directly without post; the composer has its own ACES effect and performs the final colour conversion. Avoid applying tone mapping twice.

Use `/dev/scene-lab?rooms=30&quality=low` for 30 rooms / 36 Forks, `rooms=10` for ten rooms / twelve Forks, `room=main` for the terminal, `room=empty` for the build hologram, and `overview=1` to check the real overview camera and click transition with local fixture data. This route is development-only unless explicitly enabled with `SCENE_REVIEW_BUILD=1` for a local production benchmark. It does not expand gameplay slots or persist data. Run `node scripts/inspect-scene.mjs <url> <screenshot.png>` against a production build and record GPU, resolution, full-frame draw calls and frame times. Do not run compilation or other GPU tests concurrently. A desktop viewport emulating a phone does not validate phone GPU performance.

Surface detail: `public/textures/shelter-details.svg` is one shared 1024x512 atlas (eight padded tiles). `SurfaceDetail` uses two triangles per mark, cutout alpha and existing lights; instancing preserves UVs and shares repeated marks across rooms. Use it for wear, fabric seams, keepsakes, workshop markings and service panels. Assigned Forks strengthen warm pools and the violet hull indicator; empty rooms dim those accents, and power loss turns the indicator amber. Occupancy does not imply production or an upgrade tier.

**Production validation, 2026-10-13:** Intel Iris Xe / ANGLE D3D11, Chromium, 1920×1080 viewport, 600 frames after warm-up. Internal resolution stayed stable during each sample; no browser errors.

| Fixture / preset | Internal resolution | Mean frame time / FPS | p95 | Max | Frames >25 ms | Draw calls |
| --- | --- | --- | --- | --- | --- | --- |
| 30 rooms, 36 Forks / Low | 1920×1080 | 16.67 ms / 60.0 | 16.8 ms | 17.1 ms | 0 | 113 |
| 10 rooms, 12 Forks / Medium | 1440×810 | 25.17 ms / 39.7 | 33.4 ms | 33.8 ms | 306 | 89 |

The 60 fps desktop target is validated for Low on this GPU, not for Medium or High. Medium's postprocessing remains a measurable cost. Physical phone performance is still unmeasured; only the 390×844 layout was checked. Visual checks covered all three close-up presets, construction previews, and the overview-to-room click transition without browser errors. The reference still has richer indirect light, cast shadows and material wear; the runtime uses approximations to stay within budget.

**Fork silhouette follow-up, same day:** after refining the hair, hard hat and elbows, the 30-room Low fixture uses 116 draw calls. Two 600-frame samples measured 29.31 and 26.28 ms at 1440×810. A controlled old/new/old comparison in the same production build and browser (360 frames each, 20-second warm-up, same resolution) measured 22.78 / 24.03 / 22.87 ms; p95 was 33.4 / 33.5 / 33.4 ms. The new model added about 5% frame time in that comparison, while neither model reproduced the earlier 60 fps sample. Treat 60 fps as demonstrated in the earlier sample, not a stable guarantee; repeat under controlled system load before claiming it for this revision.

**Historical baseline — 2026-10-05:** Intel Iris Xe / D3D11, ten rooms and twelve Forks, 1920×1080 viewport with stable 1440×810 internal resolution. Over 600 frames after warm-up: mean 16.67 ms (~60 fps), p95 16.9 ms, max 17.8 ms, 180 draw calls per frame, no browser errors. This is a short measurement on one integrated GPU, not a guarantee for every notebook.

**Historical atlas pass — same date:** production build, same GPU, viewport, full bunker and 1440x810 internal resolution; 190 draw calls and no browser errors. The 600-frame checks did **not** reproduce 60 fps in this session (mean 39.25 ms in the first run). A diagnostic on/off/on draw comparison measured 25.28 / 25.08 / 31.72 ms, with 190 / 180 / 190 calls. The first pair showed little atlas cost, but the changing frame times make this inconclusive as a regression benchmark. The October 13 results above supersede this measurement for the current visual implementation.

<p align="center">
  <img src="./art/cache-storage.jpg" alt="Cache Storage" width="352" />
  <img src="./art/power-plant.jpg" alt="Power Plant" width="352" />
</p>
<p align="center">
  <img src="./art/dorm.jpg" alt="Dorm" width="352" />
  <img src="./art/workshop.jpg" alt="Workshop" width="352" />
</p>

## 6. The Forks

A Fork is voxels of 0.2: a large, softly bevelled head, continuous hair volume covering crown, temples and nape with a short fringe, torso, two arms with elbows, two legs with knees, hips at 2.2 voxels. Hair must read as one silhouette from the back, never as a slab over a bare head. Hard hats have a crown, brim and centre rib. Skin, shirt, trousers and an optional helmet come from the Fork's seed through `forkLook()`; shirts draw from the palette. Mood changes motion, not shape: speed, head pitch and bounce in `MOOD_MOTION`. When sitting, the model's origin drops so the hips land on `seatY`; check hand-to-keyboard contact in a screenshot, never by reasoning alone. Review front, side, back and three-quarter views at `/dev/scene-lab?forks=1`, then check the actual room and overview. Forks start at task stations, then alternate tasks and short walks, with seed offsets for breathing, blinking and arm motion. These animations do not change production or stats.

Do not add faces beyond the two eyes, and do not add animations that are not driven by the behaviour loop.

## 7. Interface

- One monospaced font everywhere. Uppercase with wide tracking for labels, sentence case for lines the game says, `>` as the prompt prefix.
- **Silkscreen is the one exception**, and only for three things: the "GIT SHELTERS" wordmark in the TopBar, the Bytes number and the packet countdown (the share card already used it). Nothing else.
- Panels are `bunkerBlack` at 90 to 95% with a one-pixel `phosphorViolet` border at 40 to 60%. No rounded corners, no shadows except the CRT's inner shadow, no hover glow on HUD surfaces (`[data-hud]`).
- The CRT (`.crt`) is for terminals only: the Main Branch screen and the intro. Scanlines, vignette, a slow flicker. Do not put it on ordinary panels.
- Notices that fade (`.hud-fade`) are for one-shot facts: a build result, a badge, a sync outcome. Persistent state lives in the TopBar and the lower band.
- Amber marks the thing you can do. Red marks the thing that went wrong. Violet is everything else. No green.

### 7.1 Three zones

| Zone | Desktop (≥ 1280 px) | 1024 to 1279 px | Below 1024 px | Phone (< 640 px) |
|---|---|---|---|---|
| **TopBar**: state | one 56 px row: mascot, wordmark, login and "REPO · THE OUTAGE"; gauges and FORECAST; sound, Bytes, sync, account | one compact row: wordmark, login, "BYTES" label and rates hidden, 136 px gauges | 52 px row (mascot, Bytes, sync, account) over a 56 px resource strip: 108 px | same, sound moves into the account menu, sync age hidden, 44 px targets |
| **Scene** | the bunker between the bars; the blocker shows in the room itself | same | same | two columns at a time, paged |
| **Lower band**: context and navigation | CrewLog 380×128, GameDock 3×92 px, PacketCard 320×128 | one compact row: one-line log, compact packet, 80 px dock items | the same compact row, down to 640 px | pager, one-line log, compact packet, dock full width on the bottom edge with `env(safe-area-inset-bottom)` |

The AlertBanner (44 px, under the TopBar) only appears while something is broken: blackout before an empty pantry. Pop-outs (forecast, account, sync note) open 8 px under the bar and the banner: 64 or 108 px on desktop, 116 or 160 px below 1024 px.

### 7.2 Components (`src/components/hud/`)

- **TopBar**, **ResourceGauge**: one `role="meter"` per resource with a readable label; 16 segments (6×8 px, 2 px gap) on desktop, 10 filling the phone strip, both drawn `aria-hidden`. Violet when fine, red text under 20%, outlined red at zero.
- **ForecastDrawer**: the 8-hour forecast from the same simulation the catch-up runs. 420 px drawer on desktop; on phones the whole resource strip is its button, beside the meters, never wrapping them.
- **AccountMenu**: public Repo, **Intro / credits** with the REPLAY tag, Settings, visual quality, Privacy, Terms, Log out; Sound on phones.
- **AlertBanner**: one line on what stopped and one amber action to the room that fixes it, or to build it with its catalog price.
- **CrewLog**: crew size and idle hands, then up to three `>` lines (mood, today's packet, the most useful tip). Below 1280 px it is one line that expands upward over the scene. FirstSteps takes its slot during onboarding; the two never show together.
- **GameDock**: Bunker, 404 Lands, Share. Crew and Badges are left out until they have real screens.
- **PacketCard**: resolved (countdown to 00:00 UTC) or pending (amber, "Open terminal"). No event loaded, no card.
- **In the scene** (`RoomOverlay`): one DOM overlay, never an `<Html>` per room. Hover draws a violet outline and a 252 px card; the room that blocks the economy gets an amber dashed outline and a "+ ASSIGN" chip. On phones the chip hides when its room is paged off screen.

### 7.3 Tokens and contrast

Components use the `--hud-*` tokens in `globals.css` through Tailwind (`bg-hud-bg`, `text-hud-violet`...), never inline hex.

| Token | Value | Use | Contrast on `--hud-bg` |
|---|---|---|---|
| `--hud-bg` | `#0B0713` | panels, bar | |
| `--hud-bone` at 60% | `#E6DFC8` | secondary text, the floor for 9 to 10 px labels | 5.71:1 |
| `--hud-violet` | `#BD93F9` | labels, borders, values | 8.26:1 |
| `--hud-amber` | `#E67E22` | actions only | 6.99:1 |
| `--hud-red-text` | `#C95F5F` | text for what went wrong | 5.01:1 |
| `--hud-red` | `#A14545` | danger borders only | |
| `--hud-violet-dim` | `#8D46A3` | dividers, locked; never small text | |
| `--hud-plum` | `#2D2235` | empty segments | |
| `--hud-alert-bg` | `#1C0E16` | the AlertBanner | |

### 7.4 Honest numbers

The HUD shows only what the game computes. Rates come from `ratesPerHour`, the drawer from `forecast`; when a case has no honest number the rate is left out. No invented capacity, no blackout timestamp, no lamp percentage. A missing balance or payload is omitted, never shown as 0 or "--". Worker counts are the real ones.

Where the brief and the canvas disagreed, the brief won:

- **FULL** replaces the rate whenever a store is full, even while the rate is positive or paused; screen readers still hear a drain.
- The forecast speaks of **8 hours** (`FORECAST_HOURS`), not an invented 3-hour deadline.
- The hover card shows the room's **actual** workers, not a fixed "1/1".
- The dock has **3** items, not 5.

### 7.5 Layout, motion and input

- **Camera**: the overview fits between the TopBar (`hudTop`) and the lower band, measured with a ResizeObserver and on resize. The expanding crew log overlays the scene and never moves the camera.
- **Phone pager**: pages of two columns, `[0,1]`, `[2,3]`, `[3,4]` (the last overlaps rather than framing a lone room). A swipe is more than 40 px sideways and more than 1.5 times its vertical travel; a press that moved more than 8 px is not a tap on a room or a Fork. The page holds for the session. Dots, previous/next and the arrow keys do the same.
- **Reduced motion**: the camera moves instantly; the HUD adds no animation of its own.
- **Keyboard**: the DOM follows the visual order at each breakpoint, so Tab reads the bar left to right (then the strip on phones), the banner, the lower band, and only then the scene's own controls (the staffing chip): the HUD layer comes before the canvas layer in the DOM, while z-index keeps it on top. Focus is always visible; Esc closes the drawer, the menu and the crew log.
- **Navigation**: HUD links (dock, packet card, alert banner, account menu, onboarding, back to the corridor) set `prefetch={false}`. A game page settles resources when it renders, so it runs only when the player actually navigates. The persistent renderer is unaffected.
- **Quality**: the picker lives in the AccountMenu, with the same `shelter-quality` localStorage key and event as before. The floating picker only appears on screens without the TopBar.

### 7.6 Visual QA fixture

`/dev/scene-lab?hud=normal` or `?hud=blackout` (development, or a build with `SCENE_REVIEW_BUILD=1`; the route is a 404 otherwise) renders the real TopBar, scene, lower band and room HUD over one persistent renderer, fed by synthetic values in `HudLab.tsx`. They are **fixture values, not a player's stats**: "GuiBarradas" as the reference login, 1,709 B, five rooms (Cache Storage, Power Plant, Dorm, Elevator, Workshop) around the Main Branch, four Forks.

- Normal: everyone on shift, cache 160, uptime 100%, payload 30, today's packet resolved, last sync 14 minutes earlier.
- Blackout: the Engineer idle, cache 12, uptime 0%, payload 30, packet pending, crew stressed, last sync 2 hours earlier.
- `&at=<ISO time>` pins the fixture clock for stable captures; `&seed=<n>` picks the bunker layout.

The fixture's data comes from no database, it writes nothing and it needs no login; the only server call is the SyncButton's read-only `getBackfillStatus`, which answers "unavailable" before any query when there is no session. Every form submit (every Server Action) is cancelled, the share upload is blocked (including inside its modal dialog), and every outgoing navigation is cancelled: room and corridor links open locally, other links go nowhere, and no HUD link prefetches. Image downloads still work. Screenshots live in `docs/screenshots/hud-v2/`:

| State | 1440×900 | 1920×1080 | 390×844 |
|---|---|---|---|
| Normal | [image](screenshots/hud-v2/desktop-normal.png) | [image](screenshots/hud-v2/wide-normal.png) | [image](screenshots/hud-v2/mobile-normal.png) |
| Blackout | [image](screenshots/hud-v2/desktop-blackout.png) | [image](screenshots/hud-v2/wide-blackout.png) | [image](screenshots/hud-v2/mobile-blackout.png) |
| Forecast open | [image](screenshots/hud-v2/desktop-forecast.png) | | [image](screenshots/hud-v2/mobile-forecast.png) |
| Account menu open | [image](screenshots/hud-v2/desktop-menu.png) | | [image](screenshots/hud-v2/mobile-menu.png) |

[Visual comparison, observed differences and verification limits](screenshots/hud-v2/README.md). Captured in isolated Chromium with synthetic HUD data; no production test users or gameplay writes. Mobile input was emulated, not tested on a physical phone.

## 8. Brand

The lockup (mascot plus wordmark), the wordmark and the mascot live in `public/brand/` as transparent PNGs, with the sources in `assets/`. Use the lockup on dark backgrounds only, never smaller than 320 pixels wide, with clear space equal to the mascot's height around it. The mascot on its own may be used as an icon; the pixel version (`mascot-pixel.png`, 56 pixels, rendered with `image-rendering: pixelated`) is for terminal moments like the intro.

<p align="center"><img src="./brand/mascot.png" alt="The mascot" width="160" /></p>

The brand is not under the code license. Do not restyle it, recolour it or put it next to other logos as if it endorsed them.

## 9. The world

<p align="center"><img src="./art/map.jpg" alt="The 404 Lands" width="720" /></p>

The 404 Lands are seven regions. Only The Outage is open in the alpha; the others are drawn locked, hatched, "no signal". When a region opens it gets a theme: wall tone, lamp colour, one or two signature props, and a hatch pattern on the map. The intended vibes, from the design document:

| Region | Vibe | Signature |
|---|---|---|
| The Outage | total blackout, emergency lighting | black walls, red beacons, sirens |
| The Static | white noise, ghost broadcasts | distorted CRTs, lo-fi melancholy |
| The Heap | memory never collected | piles of old hardware, nostalgia |
| The Cluster | feral data centers | server racks, cold blue, corporate decay |
| The Mainframe | ruins of the megaservers | beige terminals, magnetic tape, IBM seventies |
| The Sandbox | nothing behaves twice | walls that shift colour, controlled glitch |
| The Edge | where the maps stop | clean sci-fi minimalism, frontier |

### The 404 Lands map

`/map` is a night diorama of the seven regions (React Three Fiber, `src/components/map/`), with the SVG map (`WorldMap.tsx`) as the fallback when WebGL is missing or the context is lost. Heights, top and side tones and prop recipes live in `src/lib/regions/look.ts`; every prop, ring and light is seeded, so the map is the same on every machine. Three rules give it its identity:

- **In The Outage, every warm light is a Maintainer.** A bunker's beam and pool grow with its credited activity (the same `activityFromCreditAt` as the bunker lamps). After a week without credit it is a brown ember; with no credit at all (unknown, not idle) it shows a bare hatch and no age. The visitor's own bunker is amber with a tall beam, a sonar ring and the map's only `PointLight`. The tooltip says "active today", never "pushed": a backfill credits too.
- **A locked region is seen through bad signal.** `SignalFogEffect` rebuilds each pixel's terrain from depth and fogs it by a 500×300 region mask: blur, desaturation, a violet lift, lights bleeding through, static, scanline and drifting cloud cards. Open regions and a margin around them are cleared in the mask, so filtering never fogs them (unit-tested pixel by pixel). Hover thins a region's fog to peek.
- **Each region has a light signature**: red beacons and sirens (Outage), white CRT flicker and ghost broadcasts (Static), failing violet in the mounds (Heap), cold and violet LEDs (Cluster), slow violet screens (Mainframe), a colour cycle (Sandbox), one survey light (Edge).

Additive lights write no depth, so a beam in front of a locked region would be fogged with the ground behind it. Beams, packets and every light over open ground live on layer 1: the fog effect draws them over a copy of the terrain depth and adds them after the fog. A light inside a locked region stays on layer 0 so it blurs with its region. The map's fog is the one unconditional postprocessing pass in the game: **Low keeps a simplified fog without blur** (grading, static and cards), Medium blurs at half resolution, High adds a slight colour split inside the fog. Everything repeated is instanced; there is no shadow map, DPR is capped at 1.5 and the loop stops while the tab is hidden. Reduced motion slows the scene clock to 0.35× and turns off the camera drift.

Use `/map?review=1` (development, or a production build with `SCENE_REVIEW_BUILD=1`) for 30 synthetic Repos covering every activity bucket; it reads no database row and labels itself as fake. Screenshots: `docs/screenshots/map-3d/` (1440×900 and 390×844: normal, peeking a locked region, find my Repo, fog off, WebGL disabled).

**Measured 2026-10-14:** Intel Iris Xe, ANGLE D3D11, production build, `/map?review=1` (30 Repos), 1920×1080 internal resolution, 600 frames after a 20-second warm-up, quality preset through `INSPECT_QUALITY`. Low: **37 draw calls, 20.22 ms mean, 16.80 ms median, 33.60 ms p95** (78 frames over 33 ms); a second Low run measured 20.94 ms mean with the same median and p95 (91 frames over 33 ms). Medium: **43 draws, 24.28 ms mean, 17.10 ms median, 33.70 ms p95** (104 frames over 33 ms). The draw budget (≤ 60 with 30 bunkers) is met; the median frame is at 60 fps but **a steady 60 fps on Low is not**: about one frame in seven takes two vsyncs. Physical phones are unmeasured.

## 10. Do and do not

**Do**: reuse a palette token; add clutter; light with a warm lamp; test a pose with a screenshot; keep stations off the read-out; name a prop for what it is in the world.

**Do not**: import a model or add per-prop textures; use green; light a room violet; put a prop inside the wall; add an unconditional postprocessing pass (the map's signal fog is the recorded exception, §9) or per-room shadow map; reference any other game's assets, names or trade dress; add a face, a logo or a text mesh.

## 11. Checklist for a visual PR

- [ ] Palette tokens only.
- [ ] Wall props at z ≥ -1.22; nothing beyond x = ±1.85.
- [ ] Reads at corridor scale and at room scale (two screenshots attached).
- [ ] Reads with `powered` false.
- [ ] A Fork walked through it for a minute without crossing furniture.
- [ ] The HTML read-out does not cover a station.
- [ ] Sixty frames per second on an integrated GPU (headed Chrome, not headless).
- [ ] HUD changes: normal and blackout at 1440×900, 1920×1080 and 390×844 from the §7.6 fixture.

## 12. Procedural bunker identity

The identity belongs to the **GitHub account**, using the numeric `users.github_id`. A renamed login must keep the same bunker. Forks remain recruited residents; room purchases, resources and recruitment rules are unchanged. Invalid legacy IDs use the authored neutral scene, never a substitute hash of the login or database UUID.

`src/lib/visuals/` produces serializable recipes with cyrb53 and mulberry32. Palette, wear, furniture, residents, signatures, room slots and textures use independent streams. Version a changed domain without reseeding the others. Resident appearance is keyed by the resident's stable ID; sorting the roster cannot change outfits. The identity snapshot lives in `tests/unit/lib/visuals/__snapshots__/`.

The four harmonic palette families are rose, plum, clay and warm slate. Keep lamps amber/peach and CRTs violet. Furniture variants reuse normalized authored geometry. Rare signatures (aquarium, cat, flag) occur in about nine percent of identities. Slots carry placement tags, support relationships and rotated bounds; every room has 8–15 recognizable props and a visible light. The front walking lane stays clear. Keep the Main Branch chair off the HTML screen axis. Read-out boards are mandatory with fixed dimensions so a seed cannot hide or shrink the game's information panels.

Posters, notes, rugs and screens share a canvas atlas per bunker, disposed with the scene. Real commit/README excerpts and language themes are supported inputs, but are **not fetched for an account with no selected repository**. Missing input uses fictional terminal copy, never a fabricated commit. Owner and public views read the same credited-activity timestamp for lamp activity. This is presentation only.

`/seed-lab` renders 50 reproducible sample identities with one queued offscreen renderer; completed thumbnails are PNGs, and only the selected inspection opens a live scene. Batch and room-kind controls reproduce a sample. Download JSON to retain a problematic recipe. `/dev/scene-lab?seed=583231&rooms=30&quality=low` exercises the larger procedural fixture without creating game data.

The sharing flow renders a real 960×720 room into a WebGL render target. An authenticated upload stores only that PNG; `/api/u/[login]/card` composes a 1200×630 image with server-read balance, living residents and built rooms. The public profile uses that route as its `og:image`. Missing captures produce an explicit fallback. Apply `20261013234423_bunker_previews.sql` before enabling uploads in a deployment; the private bucket and owner policies are required. Account deletion removes the stored capture first. Silkscreen is bundled with its OFL license under `public/fonts/silkscreen/`.

Validation on 2026-10-13: 277 unit tests passed, including generator snapshots, placement invariants and sharing/authentication checks; the ten batching/instancing tests also passed after reindexing merged geometry. Chromium rendered 50 identities for each of the six room types (300 thumbnails), with no page errors and no remaining thumbnail canvas after each queue. Native inspection dialogs support Escape and contain keyboard focus.

On an Intel Iris Xe, ANGLE D3D11, Low, 1440×810 internal resolution, the 30-room / 36-resident fixture measured **166 draw calls, 39.72 ms mean and 50.20 ms p95** over 600 frames before the final read-out adjustment. The 10-room / 12-resident fixture measured **74 draws, 35.19 ms mean and 50.10 ms p95**. The final read-out pass registered about **162 draws**, but DPR changed during sampling and one frame stalled for 6.38 seconds; do not use that run as a steady-state FPS measurement. The draw-call budget is met, **the 60 FPS target is not**. A preceding comparison measured 36.97 ms for the procedural scene and 44.47 ms for the authored scene under the same protocol; machine load varies substantially, so do not present these as a controlled speedup. Physical mobile performance remains unverified. The Storage migration has not been applied to production or validated against local Postgres (Docker unavailable).
