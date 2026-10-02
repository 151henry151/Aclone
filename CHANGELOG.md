# Changelog

All notable changes to Aclone are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.19.3] - 2026-10-02

### Fixed

- Move timed-task countdowns out of chat into a prominent centered card with large digits on desktop and mobile. Gathering, labour, crafting and harvesting share the display; gathering returns to its Gather prompt after completion, and starting a harvest closes its menu to reveal the countdown.

## [0.19.2] - 2026-10-02

### Fixed

- Give Jev a compact survival and economy briefing with live need deadlines, effective nutrition, stocked suppliers, actual job wages and blockers, and recent outcomes that survive context trimming. Reconsider plans earlier when food or drink is needed.
- Offer varied buy-and-eat errands, preserve carried meals and drinking water during optional sales and business errands, and let owners buy and deliver missing production inputs in one plan. Keep actual action descriptions ahead of personality hints so shortened choices remain understandable.

## [0.19.1] - 2026-10-02

### Fixed

- Show a direct Gather control when approaching logs, stone, gravel or topsoil, including available reserves, load size and gathering progress. Explain missing tools, full cargo and depleted grounds on desktop and mobile; the HUD and Resources menu use the same eligibility checks as the server.

## [0.19.0] - 2026-10-02

### Changed

- Rebuild robocrows as detailed industrial scouts with layered metal flight feathers, exposed supports, ducted lift fans, optical sensors and gripping claws. Keep the moving model compact and batch its mechanical detail to limit rendering cost.
- Replace the small retro spaceport rocket with a 32-metre industrial cargo launcher: segmented metal tanks, weathered panels, exposed feed pipes, five engine bells, hydraulic landing supports and a tall offset service tower. Enlarge the apron and matching collision volumes while keeping the terminal entrance and its name readable.

### Fixed

- Make the fishing dock support tractors and pedestrians with a sloped shore approach, shared deck height and a clickable Fishing dock target accessible with E/Ctrl. Add prominent floating Cast a line, Reel in and Stop fishing controls at the center of the game view on desktop and mobile, separate from chat and Activities.

## [0.18.0] - 2026-10-01

### Changed

- Give spaceports a metal-clad terminal and a dedicated landing apron with an original retro rocket, swept fins, landing legs, cockpit windows, a service gantry and illuminated pad markers. Keep the terminal entrance and pad perimeter accessible; rockets and gantries have matching collision and picking volumes.

## [0.17.1] - 2026-10-01

### Fixed

- Show a prominent centered Reel in control while fishing, with a waiting indicator and a highlighted bite prompt. Catch fish directly without reopening Activities on desktop or mobile.
- Show each building owner's display name even when that player is offline. Keep names current during ownership changes without exposing offline players' private state.

## [0.17.0] - 2026-10-01

### Added

- A compact phone/tablet HUD with on-demand chat and pilot status, map/bag/actions navigation, and prominent nearby-building, fishing and home-exit actions.
- Separate touch steering and throttle, boost, flight controls and press/release weapons. Camera dragging and pinch zoom support multiple pointers; input releases safely on interruption, cancellation or opening a panel.
- Mobile menu sheets with larger controls, swipeable tabs, readable forms, retained trade/admin drafts, safe-area spacing and virtual-keyboard-aware sizing. All existing gameplay and account menus remain available.

### Fixed

- Keep desktop HUD layout and keyboard/mouse controls while adapting compact layouts to portrait, landscape and touch tablets. Restore the ordinary HUD when resizing back to desktop.
- Restart a javelin charge on a fresh press so a cancelled touch cannot silently retain a fully charged throw. Tabbing through chat or menus no longer releases a weapon.
- Correct in-game help about offline survival: stocked housing is needed, and hunger/thirst damage continues while signed off.

## [0.16.0] - 2026-10-01

### Added

- Build a shoreline waterworks with a distinct pump house, rooftop tank and working machinery audio. A trained pump operator turns one fuel into twelve water every ten minutes, supplying homes, lodging and other industries.
- Require dry shoreline foundations and a submerged intake for all waterworks construction, including editor placement and NPC plans. Terrain or water-level changes that flood the building or dry the intake pause production without consuming fuel or wages.

### Changed

- Offer water at 5d from waterworks, with 5.60d local input bids and 6.75d lodging retail quotes. Upgrade only the previous default water quotes on unowned/public businesses; preserve every owned business and unrelated custom quote.
- Avoid sending duplicate guide sections to NPC chat models as the player manual grows, retaining controls and relevant help within the existing context budget.
- Show shoreline eligibility in the Build panel and explain an unusable intake in workplace status. NPCs survey valid coastal sites and can build, supply, staff and trade with waterworks through ordinary game actions.

## [0.15.3] - 2026-10-01

### Fixed

- Align default processor bids, supplier asks, retail prices and export/import quotes across every production chain. Factory prices cover default ingredients, one worker and sales tax, while local deliveries pay more than exporting intermediate goods. Include imported water in costs, add useful hospitality/garage restocking bids, and price fallback fertilizer above locally made compost.
- Upgrade existing unowned and treasury-run businesses to the new price lists once at startup. Preserve all human- and NPC-owned prices, along with stock, money and wages; later edits survive reloads.

- Validate NPC delivery agreements before replying, using current ownership, accessible stock, posted prices, buyer funding and storage. Employees no longer promise to withdraw their employer’s goods; replies distinguish a recorded request from an actual delivery.
- Explain blocked deliveries once to the requester without extra AI calls. Remember notices across restarts, preserve public/private channels, and give existing agreements specific reasons instead of a generic stock/funding error.

## [0.15.2] - 2026-10-01

### Fixed

- Preserve trade-list and dialog scroll positions after buying, selling and other successful actions.
- Keep edited quantities, investment/withdrawal choices, stock transfers and other gameplay form drafts across refreshes, tab switches and reopened dialogs within the browser session. Separate drafts by pilot, world, building and tab; untouched fields continue reflecting live defaults, and credentials/files are never retained.

## [0.15.1] - 2026-10-01

### Fixed

- NPC replies no longer wait for a successful gameplay decision or its retry cooldown. Addressed conversation preserves the current action plan and remains independently metered under shared limits.
- Keep Jev requests within a conservative wire-size bound by omitting redundant chat/journal data and local execution steps. Preserve all candidate actions, live needs and agreements; tolerate rounded probability totals for large choice sets.

## [0.15.0] - 2026-10-01

### Added

- Fifteen named AI neighbours with distinct personalities and economic preferences, bringing the optional population to nineteen. Jev chooses gameplay; Mabel keeps OpenAI conversation and everyone else uses Claude.
- Persistent, varied real-world playing habits: shorter daily visits and occasional long visits, with three times the duration for Toby, Rowan and Elias. Mabel remains present. New arrivals are staggered, and the AI panel shows expected return times.
- Local departure routines that eat, drink, buy provisions, stock a home or booked room and travel inside using ordinary actions. Unprepared residents return sooner for a short welfare visit; spending limits remain shared and unchanged.
- Durable agreements from conversation to Jev, including deliveries split into cargo-sized loads. Ownership, posted prices, funding and storage are checked; actual successful sales track progress across restarts.

### Changed

- Hunger, thirst and starvation damage continue offline for human and AI players. Stocked homes and unexpired booked rooms feed their occupants; running out can cause ordinary death and estate consequences. Offline ageing and passive property decay still pause.
- Chat and NPC replies allow up to 1,200 characters, with matching input/model limits and complete-sentence guidance. Oversized submissions are rejected rather than silently shortened.

### Fixed

- Keep residents visible while AI requests wait, fail or hit spending limits; backoff no longer disconnects their characters.
- Show saved wages separately from editable drafts, refresh business details from live state, and give NPCs explicit current gross/net wages instead of relying on default or remembered figures.
- Building Admin displays current buy/sell prices and loads the selected saved price into the editor, preserving drafts during live updates and refreshing after saving.
- AI residents hear unnamed public follow-ups for two minutes after your latest turn. Conversations follow the same player, switch when another person is named, and retain recent dialogue context without extra routing-model calls.
- Remove the generic “Done. Quietly competent.” notification for chat and routine actions; errors and specific action results remain visible.
- AI replies now follow the initiating chat channel: public mentions receive public replies, and private conversations stay private, regardless of the model's suggested recipient.
- Chat scrollback receives mouse and trackpad input instead of passing it through to camera zoom. Page Up/Page Down also scroll history while composing a message, without losing the draft or reading position.

## [0.14.0] - 2026-10-01

### Added

- Elias Vale, a fourth independently enabled neighbour with Jev gameplay, Claude conversation and his own persistent identity and memories.
- A shared adaptive planner for every resident: compare parish jobs and shortages, learn any skill, trade, gather, manage businesses, build and provision homes, rent rooms, fish, customize vehicles and explore the galaxy. Plans use ordinary player rules and record actual financial/health outcomes separately from estimated profit.
- Durable space journeys and atomic account/world/plan checkpoints, plus tests for trade receipts, construction, lodging, fishing and restart continuity.

### Changed

- Mabel, Toby and Rowan all use the same Jev action catalog; prior careers are personality preferences rather than restrictions. Mabel retains OpenAI conversation; the others retain Claude. Existing identities and memories persist.
- Conversation requests use a smaller speech-and-notebook tool, only when a human addresses the resident; gameplay and chat share the existing spending limits with separate accounting. Routine turns make no chat-model requests; completed questions are not replayed, and failures have durable backoff and a three-attempt limit.

### Fixed

- Suppress unsolicited NPC progress announcements in the controller while preserving addressed public replies and private conversations.
- Offer explicit renewal and production-boundary waits for factory jobs, and report a deferred conversation budget privately once per question.

## [0.13.0] - 2026-10-01

### Added

- Rowan Field, an independently enabled farmer whose gameplay decisions use TypeSafe Jev and whose conversations use Claude, with his own persistent identity, relationships and action journal.
- Seasonal farming choices covering paid training, farm employment, planting, irrigation, fertilizer, harvest wages, farm ownership, investment and selling produce. Decisions use current supplies, crop state and ordinary game rules.
- Separate billing reservations for Jev decisions and addressed Claude conversations under the existing shared NPC caps; autonomous farming does not call Claude. Invalid decisions and provider failures preserve normal recovery and private-chat isolation.
- Farmer configuration, Docker environment support, operator instructions and an opt-in live API smoke test.

### Fixed

- NPC wage observations now include completed harvest receipts, so residents can verify farm earnings as well as factory wages.

## [0.12.0] - 2026-10-01

### Added

- Optional second AI neighbour Toby Finch, a male baker powered by Claude, with independent identity, personality, persistent memory and ordinary school, employment, trade and chat actions alongside Mabel.
- Claude Messages integration, stable-prompt caching, separate provider labels and privacy guidance, and independent native/Compose configuration using a server-only Anthropic or Claude key.

### Changed

- Share the existing NPC spending caps across both providers while reserving and settling each call at its own persisted rates, including Claude cache writes and reads. Existing NPC histories and billing records migrate without a reset.

## [0.11.3] - 2026-10-01

### Fixed

- Renew an existing job safely when a worker accepts it again, without duplicate employees or wages. Make expired shifts and missing active staff explicit in AI workplace guidance so Mabel can distinguish holding a job from actually working.

## [0.11.2] - 2026-10-01

### Fixed

- Show current staffing efficiency immediately after a worker takes, renews, quits or lets a job expire, rather than displaying the previous production cycle's value. Add the next production-check countdown and explain that batches require stock, space and funded wages.

## [0.11.1] - 2026-10-01

### Changed

- Give Mabel the complete FAQ and economy fundamentals on every decision, with additional context for her work and player questions. Refine her neighbourly personality to acknowledge mistakes, explain practical next steps and distinguish promises from confirmed results.
- Increase the bounded NPC request allowance from 60,000 to 96,000 bytes for richer guidance and feedback, retaining the existing model, decision cadence and shared spending caps.

### Fixed

- Stop repeated NPC failures from causing rapid model retries and duplicate chat announcements. Persist bounded failed-step history and retry delays, reject recently failed plan steps, and keep direct human questions responsive without clearing the failed-action blocks.
- Finish NPC service visits immediately when already in range instead of requiring a new route beside a building; stationary visits no longer require starting the tractor engine.
- Explain automatic mill/factory production, worker-accepted jobs, active shifts and owner-funded wages to AI residents. Include live workplace diagnoses, custom recipes, next-cycle timing, capital shortfalls, storage constraints and recent personal wage receipts instead of leaving the agent to infer them from raw stock.
- Preserve attempted actions and their errors across chat and restart, and record employment, skills and affected building stock alongside action outcomes so residents can correct mistaken plans.

## [0.11.0] - 2026-10-01

### Changed

- Reduce live-game bandwidth with field-level building/player updates and recipient-only changes to private state, accounts and chat. Shared delta generation and compression keep multiplayer broadcasts economical while retaining the normal update rate on healthy connections.
- Bound each modern client's outstanding snapshots so slow connections catch up to current state instead of accumulating old updates. Driving controls send changes promptly, with fewer duplicate messages and no additional queued controls behind a blocked upload.
- Adapt movement buffering to sustained network jitter, returning to the existing 300 ms buffer on stable connections. A short input timeout still stops unattended acceleration when delivery stalls.
- Default dynamic shadows off, keeping contact shading, models, textures and local lighting. Retain an opt-in shadow switch outside performance mode. Cache static scenery transforms and unchanged HUD content, and avoid sorting every town light on every rendered frame.
- Build NPC navigation obstacles only near buildings and reuse bounded lightweight Lua worker runtimes, with fresh isolated Lua state and the same execution limits for every event.

### Fixed

- Keep bursts of delayed driving/acknowledgement packets out of the purchase/chat action allowance, preventing ordinary catch-up traffic from flooding the player with “Too many requests” errors. Separate action and total-traffic limits remain enforced.

### Added

- Scrollable recent chat (up to the server's 100-message history), keyboard scrolling and a jump-to-latest button. New messages preserve a reader's position, and private-message filtering remains in force.
- An FPS readout beside network ping, with player troubleshooting guidance to distinguish graphics load from network delay.
- Real compressed-WebSocket tests over a bandwidth/latency/jitter-limited TCP link, mixed fast/slow-client coverage, browser checks with parked neighbours, and selectable old/new protocol load probes.

## [0.10.0] - 2026-10-01

### Added

- Optional AI neighbour Mabel Reed: a persistent personality who chooses multi-step plans, drives and walks through normal physics, earns wages, manages supplies and trades under ordinary player rules. Private in-game chat and visible AI labels make her identity clear.
- A durable resident journal, searchable older memories and a compact working notebook, with transactional action progress and restart recovery. Chat notices explain memory storage and the OpenAI connection.
- Server-only OpenAI integration with bounded requests, shared persistent spending caps, empty-parish sleep, operator pause/resume and usage/memory inspection. Exactly one resident is configured for this prototype; the controller supports a bounded future population without increasing its shared allowance.
- A local game-help library for Mabel: always-available controls, automatic FAQ excerpts, searchable player/economy manuals and catalog defaults, with live world settings taking precedence. Read-only lookups preserve private reply routing and require no paid embeddings.
- Automated provider, memory, navigation, economy, privacy, budget, guide and browser regressions, backup/restore coverage, opt-in live gameplay/help checks, and operator/developer documentation.

### Fixed

- Keep private NPC replies private through a guide lookup, and bound recalled memory excerpts so long histories and help text fit within the request budget.
- Make NPC action schemas compatible with OpenAI's strict tool format; the live trial exposed unsupported union encoding that mocked API tests missed. Clarify building visits and casual labour so the resident uses safe service-range navigation and the correct wage action.

## [0.9.0] - 2026-09-30

### Added

- An enlarged parish map with named buildings and gathering grounds, the actual winding roads, race and Hornball landmarks, and live player positions. Click a building name to inspect it; zoom, drag or scroll to explore, use Find me to return to your position, and Fit parish to include custom properties.
- Clickable minimaps and keyboard-accessible map controls, with readable labels and scrolling on small screens. Map zoom, scroll position and controls survive routine server updates.

### Fixed

- M now opens and closes the parish map instead of opening the Parish Directory. The directory remains available from its own buttons and the game menu.

## [0.8.1] - 2026-09-30

### Fixed

- Rebuild evergreen trees with irregular woody branches, smaller needle-covered shoots, tapered trunks and varied silhouettes, replacing the visible stacked cones and round leaf clusters. Detailed and performance graphics share the same branch shapes, and the foliage still receives snow without turning autumn orange.

## [0.8.0] - 2026-09-30

### Added

- Original synthesized tractor engines with a diesel idle and smooth rev changes while driving. Nearby players' engines and horns fade with distance and pan with the view direction.
- Working sawmills, mills, workshops, furnaces and other processing buildings have distinct machinery sounds. Activity follows production inputs, output space and wage funding, with quieter unattended operation and sound during manual crafting.
- A visible Sound button and saved master-volume control in Pilot & preferences. Sound starts after a click or keypress and defaults on for browsers without an explicit mute preference.

### Fixed

- Share engine-running state with other players and play horns from accepted server actions, without duplicate local beeps or replaying old horns on arrival or reconnection. Silence vehicle and machinery loops on disconnect, space travel and hidden tabs.

## [0.7.0] - 2026-09-30

### Added

- A fictional star sky with varied brightness and colour, gentle twinkling, nightly rotation and seasonal drift. Clear skies cast faint starlight onto the landscape.
- Two nearby moons of different sizes, with textured surfaces, sun-facing phases on a continuous 28-game-day cycle, and moonlight that follows their altitude and illumination. Moving clouds obscure the stars and moons and attenuate their ground light.
- Drag vertically and horizontally in first-person view to look around and up at the sky.

### Changed

- Give headlights a stronger, wider beam with a longer reach. Streetlights retain their bright centre but use a much broader cone and slower brightness falloff to illuminate the gaps between lamps and verges beyond the road. House window lighting and the fixed light budget stay unchanged.
- Select nearby town lights around the camera's focus so low-quality mode lights the road near the tractor instead of spending its smaller budget behind the chase camera.
- Align seasonal sunrise, sunset and lunar illumination to the same tilted planetary sky model; night lighting reuses the existing directional shadow light.
- Balance night illumination for visibility on a normal display: starlight reveals nearby ground and silhouettes, and a clear full-moon night reveals grass texture with softer light in the shadows. Overcast nights remain much darker.

## [0.6.1] - 2026-09-30

### Changed

- Standardize default non-harbour selling prices to the item reference price. Harbour stores pays 3% more for deliveries and sells at a higher price, so there is no profitable buy-back loop within one store. Untouched saved defaults migrate once; custom quotes, cash and stock remain intact.

### Fixed

- Wheeled vehicles steer naturally while reversing, based on actual movement direction even while braking. Walking and aircraft controls retain their existing turn direction.
- Owners cannot trade with, take employment at, refresh shifts at, or start workplace tasks at their own property. The interface directs them to Stockroom and Building Admin instead.
- Purchasing your workplace clears your employment there. Legacy owner-employees and reserved self-paid harvest wages are removed; owners can still tend their own farm plots without wages.
- Seasonal capture fixtures now find the relocated cottage, farm and spaceport instead of using old coordinates.
- Run browser checks sequentially so competing software WebGL renderers do not cause input and connection timeouts on CI.

## [0.6.0] - 2026-09-30

### Changed

- Spread the starter town across roughly eight times its previous area, with winding connected lanes, branches and loops instead of a compact crossroad layout. Buildings, vehicles and characters retain their metre scale.
- Road textures, roadside vegetation, streetlights and the parish map now share the same street plan; terrain accommodates the expanded town while preserving the coast and terrain edits.
- Existing untouched starter lots move once on load, preserving ownership, prices, inventory and residents. Edited and player-built properties remain in place; occupied destinations are skipped, and pilots parked on newly occupied lots are placed outside the walls.

## [0.5.1] - 2026-09-30

### Fixed

- The “At home · Go outside” button now accepts clicks that overlap live world updates, allowing residents and guests to leave reliably. Nearby-building and fishing prompts also retain keyboard focus between unchanged updates.
- Focused buttons respond to Space and Enter instead of triggering the horn or chat shortcuts.

## [0.5.0] - 2026-09-30

### Added

- Player-built bed & breakfasts and hotels with three or eight prepaid rooms, configurable hourly rates, food service trading, protected personal pantries, offline meals and durable checkout.
- Eight processing businesses: composting yards, brick kilns, concrete works, furniture workshops, wineries, kitchens, tea blending houses and coffee roasteries. Their materials, professions, input/output recipes and construction costs connect gathering, farming and hospitality.
- Finite woodland, stone, gravel and topsoil gathering grounds, with saved depletion, gradual replenishment and forestry/excavation qualifications.
- Persistent snow accumulation and thaw, wet roads, thunderstorms with lightning, blizzards, and reduced ground-vehicle speed and grip in poor conditions.
- Occupied evening windows with varied bedtimes, all-night street lighting, real light on the ground, and dark countryside that needs headlights. Nearby lighting uses a fixed rendering budget.
- Evergreen, birch and broadleaf groves, varied tree sizes, distinctive guesthouses and industrial building silhouettes.
- Gravel drainage, compost fertilizer and topsoil restoration for farm plots; crop-specific frost and waterlogging responses and downstream uses for all six crops.

### Changed

- Residents left at home keep their chimneys active and consume stored food and drink after logout. Offline ageing and health loss still pause.
- Production shift lengths now follow each business's cycle duration while respecting the world owner's production-speed setting.
- Manual logging and quarry work move to gathering grounds, with tool requirements, cargo checks and persistent completion.

### Security

- Guest pantry contents are visible only in their owner's private snapshot. Other guests and property owners cannot withdraw them; occupied or stocked lodging cannot be demolished.

## [0.4.0] - 2026-09-29

### Added

- Balanced team deathmatch, capture-point and capture-the-flag rounds, protected respawns, ammunition refits, server-timed javelin charges, bouncing grenades, armed mines and optional treasury kill rewards.
- A seven-system galaxy route map, saved jump journeys, ship hangars and upgrades, shared station inventories, courier contracts, surveys, alien-ship discovery unlocks and stranded-pilot rescue.
- Four seasonal farm plots with six crops, planting windows, rain and irrigation, fertilizer, family rotation, frost effects, dated harvests and funded harvest shifts that finish safely after disconnecting.
- Four seasons, moving sunlight, sunrise and sunset, rain, snow, autumn foliage and winter coverage on ground and buildings. Ten-minute days and the 365-day calendar are aligned at default speed.
- Six stone and timber cottage styles, seven garage paint finishes, and chimney smoke driven by online occupants or nearby active workers.
- A detailed player guide, persistence and multiplayer regression coverage, and reproducible seasonal gameplay captures.

### Changed

- Farms produce scheduled crops instead of automatically adding wheat every production cycle. Existing stock is retained; planting and harvest care now determine future output.
- Bound smoke, precipitation and projectile rendering in shared pools; crop visuals update by growth stage without rebuilding the village.

### Fixed

- Prevent fast shots crossing safe-zone boundaries, friendly fire in arena teams, duplicate harvest collection, and repeated match-result rewards.
- Commit station stock and pilot cargo together, preserving both on failed writes and completing saved journeys after reconnecting.

## [0.3.4] - 2026-09-29

### Changed

- Re-proportion tractors around a full-size adult driver: lower and narrower glazing, a compact roof, matching mirrors and exhaust, corrected cockpit eye position and wheel rotation.
- Give buildings distinct metre-scale footprints and silhouettes: cottages, two-storey pubs and banks, awning-front shops, schools, barns, workshops, a mill wheel and a spaceport control tower. Door and window sizes stay consistent between buildings.
- Reduce oversized street lamps, fountain benches, grass and garden hedges; fit planting and fences to building footprints while retaining varied mature trees.

### Fixed

- Match building picking and movement collisions to rotated building volumes instead of one fixed-size box/circle. Pilots caught inside a changed footprint can move toward its edge.

## [0.3.3] - 2026-09-29

### Fixed

- Replace the faceted walking placeholder and blocky cab driver with one original, smoothly shaded human model: shaped face, hair and cap, cloth detail, articulated hands, trousers and boots. The cab driver has a seated pose with arms reaching the steering wheel.
- Animate walking with jointed arms and legs and planted-foot motion driven by displayed travel. Bring the walking camera closer, use human eye height, and hide the local figure in first-person views to prevent face clipping.
- Share character geometry between pilots and keep seated drivers batched into three material draws, with automated geometry, independent-animation, draw-budget and foot-clearance checks. Add reproducible in-game character captures and browser coverage for walking and returning to the tractor.

## [0.3.2] - 2026-09-29

### Fixed

- Smooth driving between server updates using timestamped movement history instead of repeatedly easing toward stationary snapshots. Camera direction, headlights and wheel animation now follow the same displayed motion.
- Remove the artificial 10 FPS software-rendering cap; software and performance modes now target up to 30 FPS, with consistent frame pacing. Actual frame rate still depends on hardware.
- Reset visual motion on large teleports, vehicle changes, world changes and long pauses, and stop at the last known position when updates run out.

## [0.3.1] - 2026-09-29

### Fixed

- Start the Lua execution deadline after the isolated worker has loaded its runtime, with a separate bounded startup deadline, to avoid false script timeouts on busy hosts.
- Pause failing automatic world scripts for 60 seconds after one chat notice. Successful editor reloads allow an immediate retry; stale failures from replaced scripts are discarded.
- Distinguish other pilots from landmarks with compact, rounded PILOT nameplates instead of oversized building-style signs.

## [0.3.0] - 2026-09-29

### Added

- Scenery view: press H to hide the HUD and H or Escape to restore it.
- Optional password sign-in for existing pilots, recovery email verification, expiring single-use password reset links, and sign-out across devices. SMTP is configured by the operator.
- Repeatable load probe with real WebSocket clients in a separate process and disconnect/restart regression coverage.

### Changed

- Rebuilt countryside graphics around original meadow, gravel, limestone and slate textures, softly worn road verges, leafy trees, garden fences, a village fountain, layered clouds and warmer lighting. Cottages have textured gables and industrial annexes.
- Redesigned tractors with glazed cabs, rounded bonnets, detailed grilles, mirrors, wheel hubs and animated chevron-tread tyres. Static bodies and wheels are batched separately.
- Added a detailed graphics setting alongside adaptive and performance modes. Performance mode retains material textures and contact shading; detailed mode retains dynamic shadows. Texture assets respect subpath hosting and are documented with their generation prompts.
- Protocol 2 sends changed world fields and players, shares serialized frames across recipients, and compresses WebSocket traffic. Legacy full-state clients remain supported.
- Disconnected pilots pause hunger, thirst, ageing and property decay. Production, wages, lessons and pending tasks continue, without erasing an absent player's estate.
- SQLite uses full synchronous durability and an indexed normalized pilot-name lookup. Existing saves migrate automatically.

### Fixed

- Replaced connections lose authority immediately, so a stale socket cannot keep playing after sign-in elsewhere or password recovery.
- Unclaimed starter businesses no longer decay out of existence while nobody is playing.

### Security

- Passwords use salted asynchronous scrypt; recovery tokens are stored hashed and expire. Verified email is required for recovery, and password resets revoke existing pilot keys and connections.
- Bounded password hashing, account-request throttling, reset-email cooldowns, connection limits and slow-client disconnection bound resource use.

## [0.2.1] - 2026-09-29

### Added

- Prefix client API, WebSocket, and uploaded-asset URLs with the Vite base so a production build can be mounted under a path such as `/aclone/`.
- Count pilot registrations by `X-Real-IP` when the connection comes from loopback, so a reverse proxy does not share one registration limit across every visitor.

## [0.2.0] - 2026-09-29

### Added

- First public development alpha, with original procedural countryside, tractors, a village and a browser interface.
- Persistent multiplayer worlds with validated input, public and private chat, authority checks, recoverable pilot identities and SQLite backups.
- Building trading, exact currency accounting, taxes, stockrooms, investments, funded production and wages, skills, tasks, construction, survival and home supplies.
- Data-defined vehicle slots, weapons and production chains; Hornball, circuit racing, fishing, robocrows and an original two-player Ultrakricket interpretation.
- Galaxy directory, world creation, local-to-galactic exchange, jump range, ships and station trading.
- Live owner editor for rules, terrain, building placement, zones and isolated Lua scripts, plus original asset uploads.
- GPL-3.0-or-later licensing, contributor guidelines, end-user guide, hosting and recovery instructions, developer documentation, CI and automated tests.
- Player-to-player property listings, persistent vehicle fleets, per-world vehicle physics and editable per-building production recipes.
- Original gameplay screenshots, a source-release packaging script, Docker/Compose deployment and a performance rendering mode.

### Fixed

- Reject invalid trade quantities without changing balances or stock.
- Accept negative sea levels when applying the default world settings.
- Preserve player state when a fishing join request fails validation.
- Run Lua using an isolated worker with the supported TypeScript registration API.
- Separate uploaded world assets from the production client bundle routes.
- Reject fractional cash/count settings and prevent purchasing seeded business capital for profit.

### Security

- Store pilot credentials as hashes, validate world actions and enforce owner authority on server-side edits.
- Save credit conversions and local cash changes atomically, isolate Lua workers, and bound uploads and request rates.

The local 0.1.0 bootstrap was not published. This first public version advances
to 0.2.0 for the implemented multiplayer and editor functionality. It is an alpha;
remaining specification work is documented in docs/STATUS.md.
