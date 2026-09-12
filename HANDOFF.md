# Manos: project handoff

## Start here

Manos is a Spanish-language, browser-only practice app for ten Colombian Sign Language (LSC) expressions. The integrated app is in `src/`. It demonstrates authentic LSC50 recordings, animates an original 2D guide, tracks camera landmarks locally, compares timed attempts, and stores practice counts locally.

The initial local software loop was completed and verified on 12 September 2026. It is not a validated full-language tutor. There is no deployed public website, backend, authentication, or free-form conversation recognition.

| Read | Purpose |
|---|---|
| [README](README.md) | Install, run, and feature overview |
| [Engineering handoff](docs/engineering-handoff.md) | Architecture, contracts, verification, and next work |
| [Verification](VERIFICATION.md) | Integrated acceptance evidence and known limits |
| [Sources](SOURCES.md) | Dataset identifiers, transformations, revisions, attribution |
| [Module handoffs](handoffs/README.md) | Evaluator, camera, avatar source snapshots and evidence |
| [Reuse audit](docs/reuse-audit.md) | Broader research into existing recognition/avatar components |

## Accepted implementation decisions

- Real LSC data supplies all ten lessons. SignBridge contributes DTW and asset-loading code; its ASL/PSL classifiers are not used.
- The avatar follows recorded 2D landmarks. Use original video for facial expression, occlusion, and fine hand detail.
- `Evaluation.ok` means that comparison was possible. Scores and practice counts never certify correct LSC or mastery.
- Camera frames and attempt landmarks remain in the browser. Only practice summaries persist in localStorage.
- The five-expression guided encounter is a sequence of isolated exercises.

## Status of independent work

The evaluator, camera, and avatar improvements were integrated selectively. The main integration additionally fixed camera cancellation, neutral result presentation, original-frame DTW playback, shared avatar viewports, mobile label overlap, and paused-video seeking. Root `src/` is authoritative; archived source snapshots must not overwrite it wholesale.

The reuse audit explores a broader future product using components such as Performs and Lumiere. Those proposals were not implemented or validated by this delivery.

## Next acceptance gates

1. Review the references, avatar legibility, vocabulary labels, and instructions with an LSC teacher or Deaf signer.
2. Run consented live learner trials across people, dominant hands, browsers, lighting, and camera framing. Recorded-source browser tests are not learner trials.
3. Calibrate false acceptance, false rejection, and abstention against expert judgments before adding any correctness threshold.
4. For broader recognition or 3D animation, follow the bounded experiments in the reuse audit before choosing a stack.

## Public packaging

This repository includes source, dependency lockfile, local runtime/reference assets, screenshots, diagnostic fixtures, and the three module handoff packages. Private conversation URLs and machine-specific home paths were removed from public text. Handoff notes describe their historical state; the current integration status above supersedes pending integration instructions. No private conversation export, credentials, personal camera recording, dependency directory, or build cache is included.
