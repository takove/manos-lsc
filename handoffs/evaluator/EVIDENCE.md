# Evaluator evidence

All scores below are uncalibrated 2D geometric similarity, not LSC correctness, accuracy, confidence, or a pass threshold. These are local numerical tests; no camera, new signer, or learner session was recorded.

## Per-sign perturbations

Cells show baseline → updated when changed. “Abstain” means no numeric score. All ten updated self-comparisons and translations score 100. Each missing-left-hand attempt abstains in both versions; the right-hand column exposes the prior omitted-hand defect.

| Reference | Self | Scale 0.75 | Reversed order | Stationary midpoint | Altered fingers | Right hand missing | Highest different-label score, updated |
|---|---:|---:|---:|---:|---:|---|---|
| Gracias | 100 | 99 → 100 | 81 → 76 | 27 → 26 | 75 → 73 | abstain | Nombre / 72 |
| Buenos días | 100 | 100 | 57 → 56 | 28 → 26 | 78 | abstain | ¿Cómo estás? / 67 |
| Nombre | 100 | 100 | 88 | 45 → 44 | 78 | abstain | ¿Cómo estás? / 73 |
| Bien | 100 | 100 | 87 | 28 | 79 | 100 → abstain | Tú / 80 |
| ¿Cómo estás? | 100 | 100 | 82 → 81 | 24 → 23 | 78 | abstain | Nombre / 73 |
| Hola | 100 | 100 | 87 → 88 | 55 | 80 | 100 → abstain | Adiós / 88 |
| Adiós | 100 | 100 | 89 → 88 | 19 | 80 | 100 → abstain | Hola / 88 |
| Por favor | 100 | 100 | 90 | 32 | 82 → 80 | 100 → abstain | Yo / 85 |
| Yo | 100 | 100 | 88 | 34 | 82 → 80 | 100 → abstain | Por favor / 85 |
| Tú | 100 | 100 | 90 → 89 | 20 | 80 | 100 → abstain | Hola / 82 |

## Controlled inputs

- Source: the ten frozen `public/references/*.json` files, each labeled LSC50 / participant 0000 / repetition 0000 / CC BY 4.0. These establish a reproducible fixture set. Native signer status and pedagogical validation are not established.
- Translation: x + 0.08, y − 0.04 for body and both hands. Uniform scale: x/y × 0.75 + 0.08. Additional tests use scale 1.25 and aspect × 1.5 with x ÷ 1.5. All updated scores remain 100.
- Reversal: reverse the geometric frames and restore increasing original timestamps. Reversing timestamps themselves now abstains. A reversed trajectory is a stress test, not an independently labeled LSC error.
- Stationary: repeat the midpoint geometry for the entire original timeline. All updated movement subscores are below 50; total scores range from 19 to 55.
- Altered fingers: preserve wrist and MCP positions; move other finger points to the middle MCP. This is an artificial landmark perturbation, not a real filmed fist or validated incorrect sign. Updated shape subscores are below 75, yet weighted totals remain 73–80.
- Right/left hand missing: replace that entire hand array with `[]` throughout the attempt. The updated evaluator requires both hands for capture evidence, including during a one-handed sign.
- Cross-sign: every reference compared with each of the nine other labeled fixtures: 90 directed comparisons. Full scores, metrics, feedback, coverage and original-index paths are in `evidence.json`.

## Height and feedback direction

Translating only both hands down by 0.16 image-height units preserves hand shape and relative movement while changing body-relative location. A higher total after the fix is expected when the previous wrist-only alignment had introduced spurious shape/movement errors.

| Reference | Total before → after | Updated shape / location / movement | Height advice |
|---|---:|---|---|
| Gracias | 65 → 81 | 100 / 39 / 97 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Buenos días | 62 → 80 | 100 / 38 / 96 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Nombre | 71 → 81 | 100 / 39 / 96 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Bien | 72 → 81 | 100 / 39 / 97 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| ¿Cómo estás? | 60 → 81 | 100 / 40 / 97 | Prueba subir un poco la mano derecha para acercarte a la altura del ejemplo. |
| Hola | 76 → 82 | 100 / 40 / 98 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Adiós | 73 → 81 | 100 / 39 / 97 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Por favor | 74 → 82 | 100 / 40 / 99 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Yo | 75 → 82 | 100 / 40 / 99 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |
| Tú | 76 → 81 | 100 / 40 / 97 | Prueba subir un poco la mano izquierda para acercarte a la altura del ejemplo. |

The tests also move both hands upward and only the anatomical right hand downward: advice respectively says “bajar” and “subir … mano derecha.” Screen mirroring must not relabel anatomical inputs.

## Remaining false-positive and abstention risks

- Different labels still score highly: Hola ↔ Adiós = 88; Por favor ↔ Yo = 85. This is not a validated classifier or reliable identity check.
- Reversed recordings still score up to 90. Unconstrained DTW and near-symmetric outward/returning motions can conceal order differences. The revision does not invent a linguistic reversal threshold.
- The existing arithmetic weights (shape 45%, location 30%, movement 25%) allow a weak metric to be offset by stronger ones. Use subscore feedback; do not turn any total into “correct,” “passed,” or mastery.
- Absolute speed and clock origin are intentionally normalized. Rhythmic distinctions, depth, facial expression, grammar, occlusion, handedness assignment errors, and camera perspective are not validated by this evaluator.
- Both-hand capture may abstain on an otherwise valid one-handed sign when the resting hand is outside the image. Long-gap rejection is intentionally conservative; false abstentions remain possible.
- Confidence is checked only on needed pose anchors. Finite z is required for contract integrity but is never scored; optional face points and unused lower-body anchors do not contribute to the score.
- The inherited pose-width > 0.08, visibility > 0.4, coverage ≥ 0.55, 8 reference / 10 attempt frames, feedback subscore 75, exponential scales and movement extent penalty are engineering heuristics. The new gap limit max(250 ms, 15% of sequence duration) is also unvalidated. None is clinically or pedagogically established.

## Reproduction and results

From a fresh copy of the frozen app with the handoff `src/` files applied:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --reporter=verbose
npm run build
```

Final result: **2 test files, 141 tests passed** in 2.32 seconds. Production typecheck and Vite build passed (1,585 modules). `final-tests.txt` and `build.txt` contain actual command output. `baseline-tests.txt` contains the original implementation’s fixture evidence before changes.

The app build is local verification only. No deployment, camera use, signer validation, or end-to-end browser verification was performed by this task.
