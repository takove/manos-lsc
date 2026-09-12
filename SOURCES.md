# Sources and provenance

## Product brief

Private product brief reviewed on 2026-09-12; its conversation URL and contents are not redistributed. The actual stated goal is learning to communicate in sign language. The video attachment provided visual inspiration; no frames of that video are distributed in this app.

## LSC references

- Dataset: **LSC50: Colombian Sign Language Video and Inertial Measurement dataset**, Flórez-Sierra and collaborators, 2024.
- Dataset DOI: https://doi.org/10.6084/m9.figshare.27383016.v1
- Paper: https://doi.org/10.1038/s41597-024-04172-5
- Dataset API metadata: https://api.figshare.com/v2/articles/27383016
- License: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/ (verified in the Figshare API response).
- Data/code documentation: https://github.com/BiomecanicaUniandes/LSC50 (MIT for the companion code, not a replacement for the dataset's CC BY license).

All ten teaching references use participant **0000**, repetition **0000**. The paper says the dataset includes native and non-native signers; this app does not establish participant 0000's native-signer status. The class labels below are from Table 2 of the paper.

| Class | Spanish label | Original recording |
|---|---|---|
| 0030 | Hola | VIDEOS/COLOR_BODY/0030_0000_0000.avi |
| 0000 | Gracias | VIDEOS/COLOR_BODY/0000_0000_0000.avi |
| 0032 | Por favor | VIDEOS/COLOR_BODY/0032_0000_0000.avi |
| 0031 | Adiós | VIDEOS/COLOR_BODY/0031_0000_0000.avi |
| 0038 | Yo | VIDEOS/COLOR_BODY/0038_0000_0000.avi |
| 0039 | Tú | VIDEOS/COLOR_BODY/0039_0000_0000.avi |
| 0005 | Nombre | VIDEOS/COLOR_BODY/0005_0000_0000.avi |
| 0026 | ¿Cómo estás? | VIDEOS/COLOR_BODY/0026_0000_0000.avi |
| 0024 | Bien | VIDEOS/COLOR_BODY/0024_0000_0000.avi |
| 0001 | Buenos días | VIDEOS/COLOR_BODY/0001_0000_0000.avi |

Original archive files: `VIDEOS.zip` (Figshare file 50118645) and `LANDMARKS.zip` (50117670). Only selected entries were extracted via HTTP range requests. Videos were converted from 1920×1080 AVI, 24 FPS, to full-resolution 1920×1080 H.264 MP4 without audio, preserving duration. Corresponding 33-point body, 21-point left hand, and 21-point right hand CSVs were merged by row index, rounded to five decimal places, and saved in JSON at 24 FPS. Image coordinates are unmirrored; anatomical left/right remain unchanged. The source video frame count and each landmark table's row count are checked during preparation.

The character is an original SVG illustration animated by these coordinates. It is a visual adaptation, not an authoritative reference for the full facial grammar of LSC. The original signer video remains available for every lesson.

## Reused software

- **SignBridge**, https://github.com/mhmdtaha091/SignBridge — MIT. `src/dtw.ts` originates from `web/src/recognition/dtw.ts`; `scripts/fetch-models.mjs` originates from the matching SignBridge asset loader. Their license is reproduced in `LICENSE-SignBridge`. Modifications for this app are described in source and verification notes. No ASL/PSL classifier or model is used as an LSC classifier.
- **MediaPipe Tasks Vision**, https://ai.google.dev/edge/mediapipe/solutions/vision — on-device hand and pose landmark detection. Package and model versions are pinned in the lockfile and asset script.
- **React**, **Vite**, **Lucide** — versions pinned in `package-lock.json`.
- **DM Sans** and **Manrope** — Google Fonts, self-hosted; OFL license files in `public/fonts/`.

## Privacy

No camera images or landmark recordings are uploaded. The browser requests video only. Model processing is local. Only per-sign attempt count, best experimental similarity score, and last-practiced timestamp are written to localStorage. The latest attempt's landmarks exist in memory for the comparison view. There is no analytics or user account.

## Alignment qualification

The published body and hand tables have matching row counts. Three source videos contain slightly more frames than their landmark tables: Hola 135 video / 134 landmarks, Adiós 70 / 69, and Tú 81 / 79. The supplied CSV indices are contiguous and do not identify where the missing video frames belong. Animation uses the published row order at 24 FPS; frame-exact video/landmark alignment is therefore approximate for those three clips (a total difference of 42–83 ms). The original videos remain unaltered apart from compression.

Two additional landmark fixtures from participant 0001, repetition 0000 (Gracias and Hola) are included under `verification/` for held-out diagnostic comparisons. They use the same CC BY 4.0 dataset license and are not additional teaching references. `verification/reextracted-gracias.json` is a fresh MediaPipe extraction from the shipped Gracias video, used to diagnose old/new detector differences; it is not a learner validation sample.

## Inspected source revisions

SignBridge: `22000aae3e0cf9836178bd3c409a047b08f24d70`. LSC50 companion code: `4d35fba04786e4b6d3654894a222b9fa5662a3ad`. Inspected 2026-09-12.
