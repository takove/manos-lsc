# Evaluator reliability handoff

Ready for integration. Changes stay inside this independent task directory. The shared snapshot, main app, package configuration, and shared types were not modified. No agents, cross-task messages, camera capture, external services, or deployment were used.

## Apply these files

Copy `src/` from this handoff over the integrator's app, preserving these exact relative paths:

- `src/scoring.ts`
- `src/dtw.ts`
- `src/scoring.evidence.test.ts` — reference fixtures, perturbations, regression assertions and machine-readable evidence output.
- `src/dtw.test.ts`

No other project files are needed. `SHA256SUMS.txt` identifies delivered source content. Existing exports `evaluate()`, `validPose()`, `position()`, `Evaluation`, `dtw()`, and `DtwResult` retain their signatures and types. No dependency changes.

## What changed

- Validate aspect, time, required pose anchors, all hand points, sparse arrays, missing arrays, collapsed hands, and nonfinite values before scoring. DTW rejects empty/ragged/nonfinite/overflowing vectors with infinity and an empty path instead of returning a misleading alignment.
- Require both hands for usable capture evidence. The old activity heuristic silently omitted one hand in six fixtures: deleting the right hand still scored 100. Those attempts now abstain. This intentionally also requires a resting hand during a one-handed sign.
- Preserve uniform scale invariance by removing the fixed minimum palm-size normalization clamp. Reject a collapsed palm rather than invent a scale. Translation, scale, and equivalent aspect-coordinate transforms now score 100 across all ten self-comparisons.
- Verify strictly increasing finite timestamps; sample by elapsed time when reducing to 48 frames. Coverage considers both frame count and elapsed time. Reject long tracking gaps, including gaps with no emitted frames, instead of joining unrelated visible fragments.
- Align both wrist position and finger geometry, and use that same path for shape, location and movement. Use the worse hand's error for each metric so a matching idle hand cannot hide the other hand's differences. Return indices into the original inputs, not filtered/sample indices.
- Height advice uses the anatomical hand with the largest location error and image y direction. Every completed comparison explicitly says the similarity does not confirm LSC correctness. Removed DTW's unsupported numeric “same sign” calibration claim.

The existing score weights/scales and most visibility/coverage heuristics are retained; this is a conservative reliability change, not a calibrated evaluator.

## Integration details requiring the main owner's attention

1. **`ok` means evaluable, not correct.** A stationary Gracias attempt produces `ok: true`, score 26, corrective feedback and an explicit limitation. In frozen `App.tsx:81`, `result.ok` chooses a check icon. Use a neutral comparison icon/status for evaluable results; do not use this boolean or a numeric cutoff as a correctness/mastery signal. Keeping scored low attempts in the practice count is consistent with the existing meaning of “attempts.” The evaluator cannot fix that UI without changing unowned `App.tsx`.
2. **Overlay timing:** returned `path` now maps original reference/attempt indices. The frozen overlay at `App.tsx:68` still pairs frames proportionally and ignores the DTW path. Use `result.path` when showing aligned comparison; otherwise the visualization may differ from the scored correspondence. Repeated pairs are valid DTW holds.
3. **Time units:** each fixture has fps 24 and `t = index × 1000 / 24`; durations are seconds (`frames.length / fps`). Frozen `vision.ts` stores the `performance.now()` timestamp from `App.tsx`, also milliseconds. Absolute origins and uniform duration differences are intentionally tolerated. `evaluate()` has no fps argument and cannot validate the separate `Reference.fps` metadata.
4. **MediaPipe hand visibility:** the installed 0.10.35 HandLandmarker conversion emits `visibility: 0` when the underlying visibility field is absent. This is not hand confidence. The evaluator accepts that default while still rejecting nonfinite visibility values; pose anchors retain their >0.4 visibility check. Tests protect this runtime detail. Finite z is required by the frozen Point contract but z never contributes to similarity.
5. **New gap heuristic:** abstain if successive visible timestamps (including sequence edges) are farther apart than `max(250 ms, 15% of sequence duration)`. This is an engineering choice against stitched captures, not a validated pedagogical threshold. Both-hand framing and gap checks can cause false abstentions.

## Validation and evidence

Executed in `<original-workspace>/lsc-evaluator-reliability/work/app`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --reporter=verbose
npm run build
```

- **141 tests passed, 2 files**, 2.32 seconds.
- **TypeScript and production Vite build passed**, 1,585 modules transformed.
- A snapshot comparison confirmed only the two owned implementation files and two new test files differ, excluding generated dependencies/build output.
- All ten real fixture self-comparisons score 100. Missing either hand abstains for all ten. Controlled scale/aspect/translation transformations preserve geometry. Tests include missing/nonfinite inputs, stationary and reversed attempts, 90 directed different-label comparisons, nonuniform sampling, long tracking outages, original path indices, and vertical feedback direction.

Read `EVIDENCE.md` for the small per-sign before/after table and limitations. `evidence.json` includes complete baseline/updated measurements. Actual logs: `baseline-tests.txt`, `final-tests.txt`, `build.txt`; `updated-tests.txt` records an intermediate fixture-only check.

**Remaining risk:** cross-label Hola/Adiós still scores 88; Por favor/Yo scores 85; reversal stress tests reach 90; synthetic altered fingers can total 80 despite a weak shape subscore. These are uncalibrated 2D similarities from one participant/repetition, not sign identity, pedagogical correctness, camera robustness, or learner validation. Native signer status is not established. No score cutoff should be presented as a pass.

Final handoff directory: `<original-workspace>/lsc-evaluator-reliability/outputs/handoff/`.
