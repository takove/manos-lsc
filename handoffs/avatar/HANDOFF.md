# Avatar fidelity handoff

Completed 2026-09-12 19:51 UTC, ahead of the 20:05 UTC cutoff.

Integrate these three files, preserving their paths:

- `src/Avatar.tsx`
- `src/Avatar.css` (new; imported by Avatar.tsx)
- `src/Avatar.test.tsx` (new; uses the existing Vitest runner and frozen reference JSON)

The `Avatar({frame,ghost})` and `LandmarkOverlay({frame})` exports and canonical shared types are preserved. No main App.tsx, global CSS, package files, reference assets, shared snapshot, or main workspace was edited. All implementation and private harness work stayed in this task directory. No other tasks or agents were contacted. No camera, deployment, or publishing was used.

## Result

The previous fixed 600 × 510 view and positive CSS top offset clipped lowered hands and the bottom of the guide. The new fixed envelope (`0 -16 600 696`) contains all **763** frozen frames at one consistent zoom; its scoped CSS anchors the SVG to its actual parent bounds. Out-of-envelope input expands the view only as needed. Normalization now uses Euclidean shoulder distance after accounting for image aspect, rather than horizontal distance alone. Degenerate shoulders abstain instead of producing exaggerated geometry.

The renderer guards invalid/missing anchors, dimensions, sparse hands, all-zero hands, and nonfinite coordinates. Missing hands and arms are omitted independently; missing normalization anchors produce an explicit unavailable state. Ghosts do not duplicate that message. Optional face data and detector-relative z are not used. No coordinates are clamped, mirrored in data, interpolated, or retargeted to invented motion.

Forearms paint after sleeves, and both hands paint after the arms. Finger outlines and palm-relative stroke width improve separation of close fingers. Painter order is deliberately stable 2D ordering; it does **not** establish true hand-over-hand depth. The existing face, clothing, palette, and static friendly expression remain stylized.

The overlay is explicitly inset to the same centered contain rectangle as video. Both share the existing parent mirror; no additional flip is applied. Invalid hand/dimension data never becomes SVG attributes.

## Verification

Private working app: `<original-workspace>/lsc-avatar-fidelity/work/app`.

Commands run from that app:

```sh
npm test -- src/Avatar.test.tsx
npm run build
```

Results: **12 tests passed**, including all 763 reference frames; TypeScript and Vite production build passed. Tests cover tilted shoulders, partial pose arrays, invalid anchors/aspect, missing/sparse/zero hands, invalid limbs, ignored z/face input, painter order, ghost messages, unchanged input, and overlay coordinates.

The private browser harness was served through Portless at `https://lsc-avatar-fidelity.localhost/harness.html` using:

```sh
portless lsc-avatar-fidelity sh -c 'exec ./node_modules/.bin/vite --host 127.0.0.1 --port "$PORT"'
```

The frozen npm dev command ignores Portless's assigned PORT, so the private command above passes it explicitly without editing package configuration.

Browser verification used installed Chrome through Playwright, without a new framework or browser download:

- All **763 frames**, ten references: rendered SVG bounds contained by the fixed viewport, zero failures (`evidence/all-frame-bounds.json`).
- Five positions per reference, **50 rendered samples**, checked for bounds and stage alignment, zero failures or browser page errors (`evidence/render-checks.json`).
- Visually inspected both contact sheets covering those 50 samples, desktop before/after Gracias frame 20, and mobile Nombre frames 20/40. Mobile Hola frame 100 provides an active raised-hand example.
- Desktop viewport 1440 × 1100; mobile 375 × 900. Harness stages were 410 px and 390 px tall respectively.
- The three actual MP4s present in the snapshot (0000, 0001, 0005) were checked at frame 20 at both widths. SVG screen-coordinate mapping versus the mirrored video contain rectangle differed by less than **0.001 px** (`evidence/overlay-checks.json`). This establishes layout alignment, not detector or linguistic accuracy.
- No synthetic video or camera input was used. For the seven references without MP4s, the private harness displays only landmarks in the video area. JSON poses remain real frozen inputs.

Fixture timing was checked: fps = 24 frames/sec; t begins 0, 41.6667, 83.3333 milliseconds; duration is seconds. The frozen vision producer also forwards performance.now() milliseconds. These components only render the supplied frame and do not change timing.

## Integration issues and limits

**Main-task action required:** In the unchanged app at 375 px, the long `¿Cómo estás?` label overlaps the guide's hat and its subtitle reaches the face. See `evidence/integration-mobile-label-check.png`. The newly complete viewport moves the hat higher than the previous clipped rendering. Reserve a separate label area above the guide, or give the guide an explicit stage region below that label in App/global layout; test long labels and raised hands together. This task did not modify unowned layout. Do not consider the full mobile page visually accepted until this is resolved.

The complete viewport makes the guide smaller on desktop. This is the cost of preserving lowered hands at fixed zoom; the main layout can give it more vertical room. The existing decorative torso/shadow ends above the lowest wrists and remains a stylized upper-body illustration.

Outside the frozen reference envelope, separate Avatar/ghost instances can choose different expanded viewports. If accurate visual overlay comparison for such live attempts is required, the main task should coordinate a shared viewport in a future interface revision. Their current frozen export provides only one frame, so this task does not claim shared-scale alignment for arbitrary out-of-envelope pairs.

Remaining 2D limitations: overlapping hands/fingers cannot establish true depth; detector wrist discrepancies are retained rather than silently corrected; static face is not facial expression tracking. Native signer status and pedagogical correctness are not established. These changes improve rendering robustness and readability, not validated LSC accuracy.

The local-only harness and verification scripts remain under this task's `work/` directory. They are not integration source. Evidence screenshots and JSON checks are under this handoff's `evidence/` directory.

The private Portless server was stopped after verification; restart with the command above to inspect the harness.
