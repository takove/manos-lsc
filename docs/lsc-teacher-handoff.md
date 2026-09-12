# Handoff: complete interactive LSC teacher using existing components

Prepared 12 September 2026. Published as a forward-looking product handoff for Manos.

## Purpose and user intent

Luis wants a complete interactive Colombian Sign Language (LSC) teacher with an expressive 3D character, webcam interaction, meaningful recognition and correction, conversational practice, and learning progression. The character should demonstrate signing with the fidelity expected from the reference video discussed in the original project. The exact character asset and reference clip must be recovered before claiming visual fidelity.

The user explicitly clarified the implementation strategy: **use existing third-party libraries, datasets, models and applications, then connect them.** Reusing only the locally built practice app does not satisfy this direction. Do not silently replace the full teacher with a small similarity-scoring demo.

This document transfers the discussion, research, proposed architecture and estimates. It does not authorize launching sessions, replacing the application, spending, contacting anyone or deploying. No implementation was started as part of this handoff request.

## Read first

- [Full reuse audit](./reuse-audit.md): source-linked component inventory, license findings, preprocessing details and acceptance checks.
- Existing application: repository root, with integrated source in `src/`. Its status below is from the earlier discussion, not a fresh implementation audit. Read [the engineering handoff](./engineering-handoff.md) for the packaged implementation.
- Research evidence: repository-tree snapshots and source excerpts were inspected locally but are not included in this public package. The audit links to upstream sources. These inspections are not runtime results.
- Original project conversation and exact reference clip are not included in this public package. Recover the reference from the project owner before evaluating character fidelity.

## What happened and what must not get lost

The original parent task sought a finished result in one hour. A side discussion explored faster execution with independent feature sessions and integration after their work was ready. Later inspection identified major differences between the practice app and the full teacher. The user then asked whether third-party components could close those gaps, requested a reuse audit, asked for an ETA, and requested this handoff.

Previously reported practice-app limitations:

| Intended capability | Previously observed implementation |
|---|---|
| Expressive 3D teacher | 2D SVG movement guide; real signer video supplies details |
| Understand the learner's signing | Compares against an already-selected sign |
| Conversational teaching | Fixed sequence of five isolated expressions |
| Reliable correctness judgments | Experimental 2D similarity; different signs can score highly |
| Hands, body, face, orientation and timing | Partial hand-shape, position and movement scoring; facial grammar and calibrated 3D palm orientation missing |
| Precise correction | Rule-based movement suggestions |
| Curriculum and mastery | Ten signs, practice counts and best similarity; no validated passing or progression |
| Performance across learners | Recorded-footage and automated checks; weak evidence of cross-signer reliability |

Reinspect the current application before using this table as current state. Other work may have continued independently. Preserve that work.

## Audit conclusion

**A reuse-first architecture is justified. A plug-and-play complete LSC teacher was not found.** Actual signing-avatar code, LSC checkpoints and datasets exist. Their interfaces and supported vocabularies differ. The largest unresolved capability is reliable learner correction.

The audit inspected repository trees, published licenses, model-file presence, inference source and research descriptions. It did not execute model inference, measure accuracy, validate avatar signing with an LSC expert, or demonstrate an integrated teacher. Some source requests failed or were rate-limited; missing evidence was not treated as proof of absence.

## Recommended components, conditional on testing

| Role | Candidate and evidence | Integration requirement |
|---|---|---|
| Teacher avatar | [Performs](https://github.com/upf-gti/performs), MIT signing engine, manual/nonmanual animation, SiGML/BML and motion playback | Supplied dictionary is Dutch, not LSC. Supply reviewed LSC motions or authored descriptions; configure character rig and verify asset terms. Raw landmarks are not animation clips. |
| Webcam representation | MediaPipe-compatible pose, face and hand extraction | Match the chosen model's exact landmark order, coordinate space, missing points, handedness and timing. Pin versions after reproduction. |
| Initial dynamic recognition | [Lumiere](https://github.com/Tazana2/Lumiere), MIT app with actual `.h5` weights and LSTM code | Reproduce original model first, then adapt browser capture and inference. Limited label set; not validated corrective feedback. |
| Broader reference/training data | [LSC50](https://www.nature.com/articles/s41597-024-04172-5), 50 signs, five participants; dataset states CC BY 4.0 | Use signer-separated evaluation. Four video modalities account for 4,000 videos, approximately 1,000 simultaneous performances. |
| Training expansion | [lsc50-analysis](https://github.com/gomez2608/lsc50-analysis), Apache-2.0 pipeline | No bundled dataset/checkpoint; training and evaluation remain work. |
| Static recognition fallback | [Javeriana recognizer](https://github.com/jpablo-ortiz/Reconocimiento-LSC-Lengua-Senas-Colombiana), BSD-3-Clause, TensorFlow SavedModels | Principal model is static and uses 226 coordinates. Recover exact class order; source utility uses `os.listdir`. |

Lumiere's [inference source](https://github.com/Tazana2/Lumiere/blob/main/backend/prueba/views.py) expects **30 frames × 1,662 values**: 33 pose landmarks with visibility, 468 face landmarks and 21 landmarks for each hand. It loads `backend/prueba/tryfewer.h5`, whose presence was verified. Its labels are `hola`, `mi_nombre_es`, `como_estas`, `chao`, `buenas_noches`, `INSOR`, `por_favor`, `parado`. These are model labels, not eight validated lessons. Existing capture uses server-side OpenCV camera zero, so a deployed browser needs a capture/inference adapter.

Additional audit findings that prevent wasted work:

- [SignLinked showcase](https://github.com/GabrielFEmilio/signlinked-showcase) has only a license and two README files. Earlier advice overstated the available implementation.
- [LSC-SignLLM](https://github.com/soyjuandata/LSC-SignLLM) is documentation, not a working stack.
- [LSC-inference](https://github.com/AdrianCCRS/LSC-inference) includes real weights for 21 static letters; reuse licensing was unresolved.
- three-vrm is a custom-character option; Kalidokit is deprecated and requires precision checks for signing.
- SignBridge provides ASL/PSL scaffolding, not pretrained LSC or the requested expressive character.
- LSC54 is another data lead; its dataset terms must be verified separately from the article's license.
- CWASA, MMS-Player, SPOTER embeddings, OpenHands and Idiap SMILE have relevant pieces or research. None was established as a better complete LSC solution. Details and links are in the audit.

## Critical distinction: recognition versus correction

Keep these separate throughout the UI, API and evaluation:

1. **Recognition:** which supported sign the attempt resembles.
2. **Assessment:** whether this attempt satisfies the exercise's reviewed requirements.
3. **Correction:** which observable feature needs changing and what evidence supports that advice.

A high classifier probability cannot establish correct execution. A reference-distance score may reject a valid signer variation. Missing/occluded hands or ambiguous motion should permit abstention. An LLM may explain reviewed feedback and guide lessons, but should not invent biomechanical judgments from a label or confidence score.

## First implementation milestone: a bounded feasibility test

Planning allocation: **1–2 days**, assuming dependencies and reference samples can be obtained. This is a test of the proposed architecture, not an already verified delivery promise.

1. Reproduce a bundled LSC checkpoint with known samples. Verify preprocessing, model loading, output labels and timing. Log exact versions and checkpoint identity.
2. Demonstrate three representative LSC signs on the target 3D character. Choose signs supported by available reference material; do not assume Lumiere and LSC50 vocabularies overlap. Include challenging motion/hand configuration where supported.
3. Connect browser camera capture to inference with explicit session boundaries, reset behavior, missing-landmark handling and frame sampling.
4. Test unseen people, out-of-vocabulary attempts, idle movement and deliberately wrong handshape, orientation, location and movement. Record false acceptance, false rejection and abstention.
5. Have an LSC reviewer assess avatar legibility and feedback correctness. Reviewer access has not been secured in this handoff.
6. Measure camera-to-feedback latency on the intended browser/device, separating buffering, network and inference. Agree on acceptance thresholds before interpreting results; no numerical thresholds were settled in the discussion.

Deliver: a runnable isolated demonstration, exact reproduction instructions, a small results table, failures/limits, and a go/no-go recommendation for each component. If recognition fails, investigate the existing LSC50 training pipeline. If correction fails, preserve it as an unresolved product requirement rather than renaming recognition confidence as assessment.

## Parallel work proposal

The user preferred independent feature sessions with integration after completion. This is a proposed future organization, not a request to launch sessions from this document.

Before parallel work, one integrator should freeze a small contract: canonical sign IDs, landmark schema, time units, handedness, lesson/reference metadata, recognition outputs, assessment/abstention outputs and avatar playback controls. Provide the same fixtures to each session.

| Independent track | Owned deliverable | Boundary |
|---|---|---|
| Avatar | Performs adapter, character configuration, three reviewed reference motions | Consumes sign IDs and playback controls; does not change capture/model code |
| Recognition | Reproduced model, capture/preprocessing adapter and evaluation results | Emits timestamped predictions and quality flags; does not define mastery |
| Lessons and feedback | Reviewed lesson schema, practice flow, feedback presentation using fixtures | Does not infer correctness from mocked or raw confidence values |
| Integration/validation | Contract fixtures, final wiring and acceptance report | Merges only after independent deliverables satisfy their contracts |

Use isolated directories or worktrees and explicit file ownership. Mocked integration permits parallel progress but does not prove final compatibility. Avatar motion authoring and learner assessment can still depend on shared expert/reference availability. Fully independent work is not guaranteed without those inputs.

## ETA communicated to the user

These are **planning ranges**, assuming focused development and access to an LSC reviewer. They are not measurements, quotes, or commitments; the first feasibility test must revise them.

| Milestone | Estimated elapsed time from implementation start |
|---|---|
| Initial compatibility/feasibility test | 1–2 days |
| Working end-to-end prototype | 1–2 weeks |
| Usable teacher with 3D avatar, roughly 50 signs, webcam practice and basic feedback | 4–8 weeks total |
| Reliable detailed correction, if additional learner data and training are needed | 8–12+ weeks total |

The earlier **3–6 month estimate was withdrawn** because it preceded the component audit. The revised ranges are also provisional. In particular, the 4–8 week estimate describes a bounded vocabulary and basic-feedback release; it does not establish delivery of unrestricted conversation, all LSC, or validated comprehensive correction. Those remain part of the broader ambition and require explicit scope and evidence. Do not present the bounded release as silently satisfying every original requirement.

## Next owner checklist

- Read the audit and inspect current workspace state before touching the existing app.
- Preserve the third-party reuse strategy and the full-teacher goal.
- Recover the reference character/video and clarify target device only where needed for the feasibility test.
- Start with checkpoint reproduction and avatar input compatibility; avoid another broad component search unless a concrete candidate fails.
- Distinguish available files, successful runtime behavior, expert validation and real learner results in every status report.
- Follow workspace instructions, including Portless for local servers. Keep implementation isolated until integration is appropriate.
- Report the first measured feasibility result and revised ETA before treating the proposed stack as selected for production.
