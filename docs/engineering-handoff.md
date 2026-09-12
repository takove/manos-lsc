# Engineering handoff

## Reproduce

Use Node.js 22.12+ and npm. Run from the repository root:

```sh
npm ci
npm run verify:assets
npm test
npm run build
npm run verify:fixtures
portless manos sh -c 'npm run preview -- --port "$PORT"'
```

Open https://manos.localhost. Portless is an external local development tool, not a project dependency. On a machine without it, `npm run dev -- --port 5173` serves http://localhost:5173; loopback is a browser secure-context exception for camera APIs. Public hosting needs HTTPS. This repository does not deploy automatically.

All 41 runtime/reference assets are committed. `npm run assets` restores MediaPipe models/WASM if needed; follow it with `npm run verify:assets`. Reference regeneration is described in SOURCES.md and is not necessary for running the app.

## Ownership and contracts

| File | Responsibility |
|---|---|
| `src/App.tsx` | Lesson/mode navigation, playback, camera lifecycle, capture, feedback, retry, local history |
| `src/types.ts` | Shared Point, Frame and Reference types |
| `src/vision.ts` | Local MediaPipe loading, GPU/CPU recovery, frame checks and anatomical hand association |
| `src/scoring.ts` | Evidence validation, temporal sampling, normalization, metrics and Spanish feedback |
| `src/dtw.ts` | Temporal alignment primitive with original-frame indices |
| `src/Avatar.tsx`, `src/Avatar.css` | Recorded/live 2D guide, shared comparison viewport and overlay |
| `public/references/` | Ten original-video derivatives and matching LSC50 landmark JSON |
| `scripts/` | Runtime asset restore, SHA-256 verification and evaluator diagnostics |

Coordinates remain anatomically labeled and unmirrored in data. CSS mirrors the live camera presentation. `Frame.t` is milliseconds; reference duration is seconds and reference fps is 24. A frame contains 33 body and 21 points per hand when available. Invalid/missing data must remain missing rather than becoming invented landmarks.

Camera capture requests video only. Cancellation invalidates pending requests and stops late-arriving streams. Background interruptions cancel attempts. Both hands and usable shoulders are required for numerical comparisons, including one-handed signs; conservative gap/association heuristics can cause abstention.

## Verification

The root test suite contains 218 cases. Archived handoff tests are deliberately excluded by `vitest.config.ts`: they target frozen module snapshots, not the integrated root. GitHub Actions runs root tests, the build, asset verification and diagnostic fixture generation on Node 22.

`verification/production-ui.txt` and `production-camera.txt` preserve the completed local production checks. `verification/browser-scripts/` contains Playwright callback bodies used for interface/lifecycle checks and recorded-video camera fixtures; these are manual harness inputs, not an installed end-to-end runner. Use an isolated page with the local app loaded. Execute the `verify-*.js` functions with a Playwright Page. Execute an `install-*-fixture.js` callback inside `page.evaluate` before camera activation; it replaces getUserMedia with a canvas MediaStream from the published reference, never the physical camera. Reload afterward to remove the override.

For live manual acceptance, activate a camera, frame both hands and shoulders, record a complete attempt, inspect aligned feedback, retry, change lessons, and turn the camera off. Check track shutdown and absence of camera uploads. Live learner/OS-device acceptance is still pending.

## Known limits

The evaluator is not a sign classifier. Hola/Adiós can score 88; two unseen-participant fixtures scored 34 and 21. Multiple-reference experimentation improved those two to 62 and 49, without establishing reliable grading. Facial grammar, calibrated 3D orientation, hand occlusion, and dominant-hand variants are not fully modeled. Single-reference similarity must not become a pass threshold.

Three video/landmark pairs have approximate frame alignment (see SOURCES.md). The animated face is static. Progress is local to the browser and has no account sync. On a public host, serve all root-relative assets under the site root or adapt paths deliberately before using a subdirectory.
