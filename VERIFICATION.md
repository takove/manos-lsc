# Verification and readiness

Target deadline: **2026-09-12 15:30:48 Bogotá / 20:30:48 UTC**.

Final local verification completed at **15:11 Bogotá**, within the one-hour window.

## Ready locally

The ten-lesson software loop is implemented: authentic LSC demonstration, animated guide, camera tracking, live character mirror, timed/manual recording, visual comparison, feedback/retry, and local practice history. Learning, memory practice, and a five-expression guided encounter are available. The guided encounter is not free conversation recognition.

## Automated and browser checks

- 218 tests across evaluator/DTW, camera module, rendering, and integration regression fixtures passed after integrating the independent reviews.
- TypeScript and production Vite build pass.
- Asset integrity checks verify the local models, WASM runtime, fonts, videos, and all ten 33+21+21-point trajectories against SHA-256 hashes.
- All ten original video files load and decode in Chrome. Normal/half-speed playback, pause, replay, keyboard seeking, practice-mode hint reveal, modal Escape handling, and guided sequence navigation were exercised through the rendered UI.
- Mobile layout checked at 390×844; no horizontal viewport overflow. The long “¿Cómo estás?” label has its own area above the animated guide.
- The avatar checks cover all 763 supplied reference frames; lowered hands remain visible. The aligned reference/attempt overlay now uses original-frame DTW indices and a shared viewport, including outlying attempts.
- Late-arriving camera streams are stopped after cancellation. Modal focus is trapped and restored to the trigger; both behaviors passed browser fault checks.
- Denied camera access is simulated and displays a retryable permission message. Camera module fault tests cover loading failures, GPU-to-CPU fallback, stale/invalid video frames, graph recovery, hand association, and malformed detector output.

## Recorded-source camera tests

These tests use **published LSC50 footage routed into a browser MediaStream**. They exercise the real MediaPipe runtime and the actual capture/feedback UI. They are not live trials with independent learners, and no physical camera or microphone was activated for them.

The first low-resolution looping Gracias input completed the original loop with 55/100. A synchronized source completed the earlier loop at 84/100. After integrating stricter tracking-gap checks, the same distant 960×540 input was correctly rejected: both hands were unavailable for about 934 ms during the central movement. It would be misleading to treat that partial capture as evidence of a complete sign.

Full-resolution videos replace the lower-resolution lesson assets. A closer-framed Hola test uses the real 1920×1080 video, cropped to x=620, y=230, width=760, height=820. It adds no generated movement. The **final integrated tracker/evaluator completed that full UI loop at 93/100** (shape 94, location 92, movement 93). The corresponding closer-framed Gracias test completed at 83/100 (shape 76, location 89, movement 90). This establishes a working camera path with clear source footage; the number is an engineering similarity score, not a linguistic correctness rate.

A fresh browser extraction from the earlier Gracias video is saved in `verification/reextracted-gracias.json` for reproducible cross-detector diagnostics. Its origin differs from a real learner camera and is labeled accordingly.

## Important readiness boundary

**The software is usable; automated LSC grading is not validated.** Different signs can receive high visual similarity (e.g. Hola/Adiós reached 88 in the module stress tests). Two unseen-participant recordings scored only 34 and 21 against the selected single references. Adding three other participants' references improved those two comparisons to 62 and 49, which was not enough evidence to promote multi-reference matching into the product or choose a correctness threshold. The extra-reference experiment was not shipped as a grading feature.

Consequently, there is no passing score, “correct sign” badge, mastery claim, or automatic recognition of free-form signing. `ok` means that a numerical comparison was possible. Practice counts include usable attempts regardless of similarity. Face grammar, calibrated 3D palm orientation, occluded hands, and alternative dominant-hand forms are not fully evaluated. Use the original video for details, especially expressions and hand overlap.

A production teaching assessment still needs Deaf/LSC teacher review, learner trials, accepted regional/individual variants, and calibrated feedback. A trained full-language conversation tutor remains outside this one-hour implementation.

## Reproduce diagnostics

```sh
npm test
npm run build
npm run verify:assets
npm run verify:fixtures
```

`verification/evaluation-report.json` contains all ten self-comparisons, 90 directed cross-sign comparisons, the two held-out recordings, and the browser re-extraction. These fixtures demonstrate numerical behavior and limitations; they do not validate LSC pedagogy. Independent module reviews are preserved under `verification/reviews/`.

## Production smoke test

The built `dist/` app is served through Portless at https://manos.localhost. The production camera loop completed the closer-framed recorded Gracias sample at 83/100, displayed two aligned SVGs with identical viewports, and stopped every MediaStream track when requested. There were zero browser page errors and no external runtime resource requests. Test-only source instrumentation was removed before this production check.

The final production interface pass decoded all ten 1920×1080 videos and verified half-speed playback, pause, keyboard seeking, hint reveal, modal dismissal, the five-expression guided sequence, and mobile overflow. A paused-video time-update race found during this check was fixed so the selected frame stays stable. The production build, 218 tests, and 41 asset checks passed afterward. Logs are in `verification/production-ui.txt` and `verification/production-camera.txt`; the final desktop capture is `verification/desktop.png`.
