# Art direction and asset sources

Aclone aims for a warm, weathered English countryside: natural ground materials, worn lanes, limestone cottages, slate roofs, leafy silhouettes and readable machinery. The original game's village, country-lane and castle screenshots were inspected as visual references; none of their pixels, textures or models ship with Aclone.

## Material textures

The four original materials in `public/textures/` were generated with the built-in OpenAI image-generation tool on 2026-09-29. No reference images were submitted to that tool. They are distributed under this project's GPL-3.0-or-later license. They are generated illustrations of surfaces, not measured physical scans. Master PNGs were exported as WebP at quality 88 without resizing; the shipped set totals about 2.7 MiB. The original full-resolution PNG masters are included in `art/materials/` and in source archives; they are kept out of the browser bundle. Edit those masters and export the runtime WebP files with `convert art/materials/stone.png -quality 88 public/textures/stone.webp` (ImageMagick, only needed when re-exporting art). Generation prompts are preserved below for contributors.

### meadow.webp

Use case: photorealistic-natural. Asset type: original seamless square game ground albedo texture, for a GPL open-source countryside driving game. Straight-down orthographic surface scan of English meadow turf: fine dense mixed olive and forest-green grasses, tiny clover leaves, occasional dry straw and earth visible underneath. Natural irregular variation across multiple scales, small detailed blades, subdued realistic greens, no neon, no large flowers. Completely fills the square edge to edge, visually seamless repeating edges, uniform flat overcast illumination, no perspective, no cast shadows, no vignette, no objects, no text or watermark. This is a flat material texture, not a landscape photograph. Fine surface detail readable close-up. Output one square image.

### gravel.webp

Original game material texture, square seamless repeating albedo. Top-down orthographic scan of a weathered English country lane: compact warm grey-brown limestone dust, small irregular pale grey gravel pebbles, fine sand and subtle muddy earth, occasional darker embedded stones. Realistic intricate fine detail with gentle broad mottling, no markings, no grass, no wheel tracks, no large rocks. Flat neutral overcast lighting, no shadows or perspective or vignette, edge-to-edge tileable surface, no text. One texture image for a countryside driving game.

### stone.webp

Original seamless square game albedo texture of old English cottage limestone masonry. Front-on orthographic flat surface: small irregular horizontal courses of warm grey and honey limestone blocks, subtly weathered grain, narrow recessed sandy lime mortar, muted natural pale stone. Stones roughly hand-cut with softly worn edges and varied widths, six to eight courses across image height. No dramatic shadows, uniform overcast illumination, no perspective, no vignette, no border, no objects or text. Realistic fine material detail, subtle colour variation. Edge-to-edge seamlessly repeating texture, one image.

### roof.webp

Original seamless square game albedo texture of weathered charcoal blue-grey slate roof tiles. Straight-on orthographic flat material scan, staggered horizontal courses of small rectangular natural slates, subtle chipped edges, mineral grain and faint weathering, fine seams. Muted dark blue-grey with restrained moss traces, no bright highlights. Flat uniform overcast illumination, no perspective, no cast shadows, no vignette, no text. Edge-to-edge repeating surface with seamless borders. One original material image for a countryside game.

## Renderer conventions

- `materials.ts` owns shared textures for the page lifetime. World and vehicle disposal must not destroy shared maps. All URLs use the configured public base, including `/aclone/`.
- Building UVs are measured in metres. Subtle bump relief comes from the albedo luminance; these are not calibrated height maps. Terrain samples the meadow every five metres and gravel every six, with a noisy transition at verges and shorelines. Roads remain aligned with the original village layout.
- `noise.ts` precomputes a small noise texture, avoiding expensive per-pixel trigonometry. `sky.ts` layers that noise into cloud cover and a solar halo.
- `scenery.ts` creates deterministic grass, leaf cards, trees, gardens and contact shade. Roads, building approaches and sports areas are kept clear. Alpha-tested foliage and instancing reduce sorting and draw overhead; scenery has no authoritative collision or economic effect.
- `tractor.ts` owns the original cab, bonnet, grille, lights, treaded wheels and driver. Batch the body and each animated axle separately. Normalize indexed/non-indexed geometry before merging.
- Textured opaque scenery batches by material properties and texture identity, not colour alone. Transparent windows remain separate. Contact shade remains visible when dynamic shadows are disabled. Multisample antialiasing is opt-in for detailed mode, so software fallback can reduce rendering cost without recreating the WebGL context.

## Reviewing visual changes

Run `npm run screenshots` against a disposable local server with `TEST_URL` set. It creates a pilot and a world, checks for console/page errors, and captures actual gameplay; see `scripts/screenshots.ts`. `SCREENSHOT_QUALITY=low`, `balanced`, or `high` selects performance, adaptive, or detailed respectively. Detailed mode keeps dynamic shadows enabled; a GPU is recommended. `SCREENSHOT_GPU=1` opts into desktop OpenGL/ANGLE hardware rendering for captures on a supported local machine; the default uses SwiftShader for reproducibility. The capture prints the actual graphics device so a fallback is visible. Set `SCREENSHOT_HERO_ONLY=1 SCREENSHOT_QUALITY=high` to additionally capture `scenery.png` using the H-key view and an orbit/zoom, skipping the trading and editor captures. Never substitute a concept render for a gameplay screenshot.

Check driving-height close-ups, distant terrain, road edges, building sides and roof UVs, all camera modes, changed terrain, and both root and subpath builds. The viewport canvas exposes `data-draw-calls` and `data-triangles` for diagnostics. Software-renderer timings are not representative of a hardware GPU, but controls must remain responsive in performance mode. The four textures should load once, not every world update.
