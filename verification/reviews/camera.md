# Camera reliability handoff

Completed 2026-09-12 before the 20:05 UTC cutoff. Integration is left to the main task.

Handoff root: `<original-workspace>/lsc-camera-reliability/outputs/handoff/`

## Apply only these files

- `src/vision.ts` — replacement implementation.
- `src/vision.test.ts` — 55 deterministic Vitest cases, using existing dev dependencies.
- `tests/vision-browser.html` — optional private manual smoke-test page; copy into the app's Vite root only when running this check. It is not imported by the app or included in the standard single-page build.

`HANDOFF.md` and `evidence/` are integration notes and validation evidence. No node_modules, unchanged source, models, or compiled bundle are included. The shared snapshot and main app were not edited. Source and assets used for validation live only in this task's `work/snapshot/`.

## Implementation

The public `loadVision()`, `detect(video, models, t)`, and `cameraError(error)` signatures and `Frame`/`Point` types remain compatible. No shared types, App.tsx, package files, or global styles changed. Runtime paths remain `/wasm`, `/models/hand_landmarker.task`, and `/models/pose_landmarker_lite.task`.

Initialization still shares one pending promise and retains a successful model pair for warm camera restarts. GPU failure falls back to CPU. A partially created hand is closed when pose initialization fails; exceptions during cleanup no longer suppress fallback or replace the original cause. A failure resolving WASM or creating both delegate attempts clears the pending promise, allowing another `loadVision()` call. Initialization failures carry a Spanish user-facing error and preserve the underlying error as `cause`.

A thrown inference error marks that model pair unusable, attempts to close both graphs independently, and invalidates its cache entry. A user retry creates fresh models; if the failed managed pair used GPU, subsequent loads in this page prefer CPU. CPU initialization failure remains retryable. Reusing the old failed pair fails clearly without closing it repeatedly or invalidating a newer pair. This is recovery on the next `loadVision()` call, not an asynchronous delegate switch inside synchronous `detect()`.

`detect()` validates dimensions, readyState, playback/seeking/end state, and media time before calling MediaPipe. Unavailable, paused, or unchanged decoded frames return empty arrays rather than stale signing evidence. A missing aspect uses 1 so consumers never divide by zero. Nonfinite, negative, or impractically large input timestamps produce a Spanish error before inference. A per-model clock makes both detectors receive the same strictly increasing millisecond timestamp, including after video restarts or repeated/backward caller times. Returned Frame.t is the timestamp actually submitted. Normal requestAnimationFrame timestamps are retained unchanged; only invalid ordering is advanced by 1 ms.

Returned landmarks must contain exactly 33 pose or 21 hand points, with finite x/y/z and valid optional visibility. Missing points, sparse arrays, malformed groups, and all-zero placeholders become empty arrays without renumbering indices. Each valid point is copied so subsequent detector result reuse cannot mutate an already captured attempt. Finite coordinates outside [0,1] are retained because detector projections can extend beyond the image; no clamping or mirroring alters anatomical data.

Hand identity uses pose wrist indices 15/16 with aspect-corrected 2D distances, independently of detector order or left/right screen position. Both wrist anchors must have visibility >= 0.5; missing confidence or an occluded wrist causes hand assignment to abstain. Candidate associations have a bounded distance gate. Feasible one-to-one assignments are ranked by match count then distance, allowing a distant hand to remain unmatched. Near-equal competing assignments leave the uncertain side empty. Crossing with distinct anatomical wrists works; coincident wrists abstain and recover when separated. No cross-detector z comparison, selfie handedness fallback, temporal identity guessing, or landmark imputation is used.

Association thresholds are conservative engineering heuristics, not calibrated accuracy claims: distance cap `max(.08, min(.25, shoulderSpan * .6))` and ambiguity margin `max(.015, min(.04, shoulderSpan * .08))`, in image-height units. Shoulder span is used only if both shoulders have visibility >= .5. This intentionally trades hand coverage for fewer confident identity mistakes, particularly during occlusion/crossing.

`cameraError()` handles cross-realm/plain DOM error names as well as Error instances. Spanish messages cover permission denial, no device, unreadable/disconnected/busy camera, unsupported constraints, insecure/blocked access, interruption, not-ready state, initialization failure, and runtime tracking failure. Arbitrary backend error messages are not shown to the user.

## Validation

Run from the copied snapshot or the integrated app root:

```sh
npm ci --ignore-scripts
npm test -- src/vision.test.ts
npm run build
```

Final result: **55/55 tests passed; TypeScript and Vite production build passed.** See `evidence/vitest.log` and `evidence/build.log`. Tests cover concurrent/retry initialization, partial cleanup including throwing close(), GPU/CPU factory failures, runtime invalidation, CPU retry, invalid and stalled video inputs, independent graph clocks, captured-point ownership, crossing and ambiguous hands, low/missing confidence, distance/aspect gating, missing/malformed/sparse landmarks, and Spanish error reporting.

The first test run exposed malformed Vitest table fixtures (nested arrays expanded into callback arguments), not a runtime defect. Those fixtures were corrected before the passing run. A sparse-landmark regression test was then added; the final count is 55.

Private browser test used the real installed MediaPipe runtime and the existing pinned model fetch script:

```sh
npm run assets
VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=lsc-camera-check.localhost portless lsc-camera-check npx vite --host 127.0.0.1
```

Open `https://lsc-camera-check.localhost/tests/vision-browser.html` in an isolated Chromium page and click “Ejecutar prueba”. The page uses canvas.captureStream(25), not getUserMedia. Reload the page before repeating: it closes the cached models at the end and deliberately does not reuse them. This is a private smoke fixture, not a product flow.

Result: **PASS, 19 checks**, with five synthetic 320×240 frames processed by real models, empty landmarks as expected, finite 4:3 aspect, timestamps 100–104 despite reset caller times, safe paused/zero-dimension input, shared loading, and successful graph close. See `evidence/browser-result.json` and `evidence/browser-console.log`. This browser smoke exercised GPU initialization; CPU fallback is covered by deterministic fault fixtures, not a real CPU browser run. MediaPipe logged its OpenGL error-checking and NORM_RECT projection warnings without an inference exception. Initial server setup returned 502 because the indirect npm command did not forward Portless's port; the direct Vite command above resolved it without changing config. The favicon 404 is unrelated. The isolated browser and this task's dev server were closed after testing.

## Necessary App.tsx integration fixes (read-only audit)

Line numbers below refer to the frozen App.tsx, not the final integrated version.

1. **Finish capture timers even when frames stop** (line 42). Countdown, recording deadline, and final evaluation are all inside the `video.readyState >= 2` inference branch. Move time-based capture transitions outside that branch so a camera interruption cannot leave recording stuck. Do not let missed/stalled frames silently count as valid coverage. The hardened detect returns empty landmarks for such frames when called; the caller still skips detect when readyState is low. A stream-ended or sustained-stall path should cancel the attempt with a Spanish “intento incompleto” message rather than evaluating only the earlier healthy segment as if coverage were complete.

2. **Own and release each asynchronous camera request** (lines 30–45). Stop/cancel any previous active stream/RAF before starting another acquisition. Check generation and the video ref after every await, including video.play(), and before starting model work. On a stale request after model loading, explicitly stop that request's local `media` rather than returning without cleanup. Avoid detaching a newer stream: clear `video.srcObject` only if it still equals this local media, and clear `stream.current` only if it still equals this media. The existing generation checks handle normal cancellation but overlapping acquisitions can replace stream.current and leave an older stream unowned.

3. **Unify current-request failure cleanup** (lines 43/45). Along with stopping tracks, clear the owned stream reference, video.srcObject, live overlay, capture, and countdown; cancel the RAF. Apply state updates only for the active generation. A runtime failure now invalidates model cache within vision.ts, so the existing “Volver a intentar” path can obtain fresh models.

4. **Handle device loss and stalled playback** (lines 35–44). Listen for track ended / stream inactive and video error events, remove handlers during cleanup, and terminate an active attempt when the input cannot recover. Readiness guards alone prevent inference crashes but do not update the “Cámara activa” UI or resolve a no-frame recording. A bounded decoded-frame stall timeout helps with frozen streams that remain readyState >= 2. requestVideoFrameCallback can avoid redundant inference calls, with requestAnimationFrame fallback, but the capture deadline still needs an independent clock.

5. **Improve visibility guidance** (live hint currently checks only live.p.length). With uncertain wrists, p may be valid while l/r are empty by design. Prompt for both hands/wrists in the frame rather than always claiming the framing is sufficient.

6. **Provision existing assets explicitly.** The snapshot has an `assets` script but no predev/prebuild hooks, despite comments in fetch-models.mjs claiming them. The copied snapshot initially had no WASM/models. The integrator must run `npm run assets` or verify these same local runtime paths exist before real browser acceptance; a successful Vite build alone does not prove model availability.

No disposal API was added under the frozen interface. Successful models remain cached for the page lifetime across ordinary stop/start; stopping camera tracks still stops the camera. Do not call `models.hand.close()` / `models.pose.close()` on ordinary camera stop and then reuse loadVision's cached pair. If full model release on unmount/cancellation is required, the integrator should design an explicit cache-aware disposal contract separately. Resources allocated internally by a factory before it rejects are inaccessible to this module; cleanup can only close successfully returned task instances.

## Timing and evidence boundaries

Verified from snapshot reference 0030: fps = 24 frames/second, duration = 5.583333333333333 seconds, Frame.t begins 0, 41.666666666666664, and ends 5541.666666666667 milliseconds. App.tsx produces performance/requestAnimationFrame milliseconds and converts reference.duration to milliseconds for capture. Installed MediaPipe vision.d.ts documents detectForVideo timestamp in ms (HandLandmarker around line 982). No time-unit conversion was needed.

The official [HandLandmarker API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.handlandmarker) and [NormalizedLandmark API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.normalizedlandmark) were consulted; the latter defines visibility as the likelihood that a point is visible. This does not validate the chosen association thresholds.

No physical camera or microphone was activated. Actual permission prompts, OS privacy settings, unplug/reconnect behavior, lighting, signing-speed tracking, dropped frames under load, motion blur, left/right accuracy on diverse users, severe occlusion, and sustained GPU/CPU performance remain untested. Deterministic anatomical fixtures prove algorithm behavior with supplied correct wrist landmarks; they cannot prove MediaPipe's wrist identities are correct during real hand crossings. The synthetic smoke proves browser loading/inference/cleanup on blank animation, not signing accuracy or pedagogical validity.
