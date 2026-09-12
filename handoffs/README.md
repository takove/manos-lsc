# Module handoff archive

These packages record independent module work against a frozen initial snapshot. They include source proposals, tests and evidence. The integrated source in the repository root is newer and authoritative.

| Package | Integration |
|---|---|
| [Evaluator](evaluator/HANDOFF.md) | Input validation, both-hand evidence, tracking gaps, temporal normalization and original DTW indices integrated; root UI adds neutral result and aligned playback |
| [Camera](camera/HANDOFF.md) | Detector validation, anatomical association and GPU/CPU recovery integrated; root app also owns request cancellation and capture lifecycle |
| [Avatar](avatar/HANDOFF.md) | Bounds/geometry guards and overlay alignment integrated; root adds shared comparison viewport and mobile label separation |

Historical warnings and intermediate failed logs are preserved as evidence; consult [the final verification](../VERIFICATION.md) for current results. Machine-specific paths were replaced with `<original-workspace>` placeholders. Camera package hashes were regenerated for the sanitized public files; evaluator hashes identify its archived source. Public-package hashes are in `MANIFEST.sha256`.

Do not run or apply these snapshots as a second application. Root Vitest intentionally tests `src/` only.
