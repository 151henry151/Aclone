# Texture provenance and generation prompts

## Source files

The four original materials in `public/textures/` were generated with the built-in OpenAI image-generation tool on 2026-09-29. No reference images were submitted to that tool. They are distributed under this project's GPL-3.0-or-later license. They are generated illustrations of surfaces, not measured physical scans. Master PNGs were exported as WebP at quality 88 without resizing; the shipped set totals about 2.7 MiB. The original full-resolution PNG masters are included in `art/materials/` and in source archives; they are kept out of the browser bundle. Edit those masters and export the runtime WebP files with `convert art/materials/stone.png -quality 88 public/textures/stone.webp` (ImageMagick, only needed when re-exporting art). Generation prompts are preserved below for contributors.

### meadow.webp

Use case: photorealistic-natural. Asset type: original seamless square game ground albedo texture, for a GPL open-source countryside driving game. Straight-down orthographic surface scan of English meadow turf: fine dense mixed olive and forest-green grasses, tiny clover leaves, occasional dry straw and earth visible underneath. Natural irregular variation across multiple scales, small detailed blades, subdued realistic greens, no neon, no large flowers. Completely fills the square edge to edge, visually seamless repeating edges, uniform flat overcast illumination, no perspective, no cast shadows, no vignette, no objects, no text or watermark. This is a flat material texture, not a landscape photograph. Fine surface detail readable close-up. Output one square image.

### gravel.webp

Original game material texture, square seamless repeating albedo. Top-down orthographic scan of a weathered English country lane: compact warm grey-brown limestone dust, small irregular pale grey gravel pebbles, fine sand and subtle muddy earth, occasional darker embedded stones. Realistic intricate fine detail with gentle broad mottling, no markings, no grass, no wheel tracks, no large rocks. Flat neutral overcast lighting, no shadows or perspective or vignette, edge-to-edge tileable surface, no text. One texture image for a countryside driving game.

### stone.webp

Original seamless square game albedo texture of old English cottage limestone masonry. Front-on orthographic flat surface: small irregular horizontal courses of warm grey and honey limestone blocks, subtly weathered grain, narrow recessed sandy lime mortar, muted natural pale stone. Stones roughly hand-cut with softly worn edges and varied widths, six to eight courses across image height. No dramatic shadows, uniform overcast illumination, no perspective, no vignette, no border, no objects or text. Realistic fine material detail, subtle colour variation. Edge-to-edge seamlessly repeating texture, one image.

### roof.webp

Original seamless square game albedo texture of weathered charcoal blue-grey slate roof tiles. Straight-on orthographic flat material scan, staggered horizontal courses of small rectangular natural slates, subtle chipped edges, mineral grain and faint weathering, fine seams. Muted dark blue-grey with restrained moss traces, no bright highlights. Flat uniform overcast illumination, no perspective, no cast shadows, no vignette, no text. Edge-to-edge repeating surface with seamless borders. One original material image for a countryside game.
