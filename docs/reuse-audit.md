# Reuse audit: interactive Colombian Sign Language teacher

Audited 12 September 2026. Scope: existing third-party libraries, checkpoints, datasets, avatar engines, and learner assessment. This is a source and artifact audit, not a benchmark or a working integration. The existing application was not modified.

## Decision

Build around existing components. There is substantially more reusable material than a from-scratch estimate assumes: an expressive 3D signing engine, real LSC recognition weights, and public LSC motion data. However, these components do not share a single input/output contract. Reliable correction of a learner's signing remains unverified.

Recommended starting combination: **Performs for the teacher avatar; MediaPipe-compatible capture; Lumiere as the first dynamic LSC checkpoint to reproduce; LSC50 plus an existing training pipeline for broader vocabulary.** Keep recognition and correction as separate outputs. This recommendation is based on inspected source and repository artifacts; it is conditional on the acceptance checks below.

## Reuse inventory

| Component | Verified material | Fit and remaining work |
|---|---|---|
| [Performs](https://github.com/upf-gti/performs) | MIT code; SiGML/BML signing synthesis; manual and nonmanual animation; keyframe playback and motion retargeting; module and iframe integration | Best avatar engine candidate. Its supplied dictionary is Dutch, not LSC. Supply LSC motions or authored sign descriptions and configure the desired character rig. Raw landmark JSON is not a ready animation clip. Check asset terms separately from code. |
| [Lumiere](https://github.com/Tazana2/Lumiere) | MIT teaching application, LSTM implementation, actual `.h5` weights | Strongest small dynamic LSC recognition candidate. Reproduce its exact model and preprocessing before adapting it. No independently verified learner-correction capability. |
| [Javeriana LSC recognizer](https://github.com/jpablo-ortiz/Reconocimiento-LSC-Lengua-Senas-Colombiana) | BSD-3-Clause code, FastAPI/Angular application, bundled TensorFlow SavedModels and variables | Useful static-sign baseline. Inspected principal model uses 226 coordinates and dense layers; it is not a temporal recognizer. Class ordering must be recovered and fixed explicitly. |
| [LSC-inference](https://github.com/AdrianCCRS/LSC-inference) | Real ONNX, Keras and PyTorch artifacts; landmark and image model variants | Covers 21 static letters. Dynamic letters excluded. No license identified in the inspected repository; reuse permission unresolved. |
| [LSC50](https://www.nature.com/articles/s41597-024-04172-5) | 50 signs, five participants, videos, full-body/face/hand landmarks and IMU; [dataset](https://api.figshare.com/v2/articles/27383016) states CC BY 4.0 | Useful training and reference motion data. Four recording modalities account for the 4,000 videos: about 1,000 simultaneous sign performances, not 4,000 independent performances. No ready LSC50 model found in the official loader repository. |
| [lsc50-analysis](https://github.com/gomez2608/lsc50-analysis) | Apache-2.0 training/evaluation code, including signer-based evaluation | Reuse the training pipeline. README explicitly says datasets and checkpoints are not bundled. |
| [LSC54](https://pmc.ncbi.nlm.nih.gov/articles/PMC12557509/) and [SignCapture](https://github.com/juanesmz/SignCapture) | Published 54-sign dataset description, 22 participants, landmark capture tooling | Additional data candidate. Verify downloadable dataset terms separately: article licensing does not establish dataset licensing. Split participants/original recordings before augmentation. |
| [three-vrm](https://github.com/pixiv/three-vrm) | MIT VRM character rendering library | Good custom-character rendering alternative. Supplies neither an LSC dictionary nor learner assessment. |
| [Kalidokit](https://github.com/yeemachine/kalidokit) | Landmark-to-rig solvers; repository explicitly marks the library deprecated | Possible adapter reference. Pose solving needs world and image landmarks; hand solver constraints need checking against sign-specific finger positions. Not a turnkey precision signing system. |
| [CWASA](https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use) | Existing SiGML signing-avatar runtime | Alternative renderer. Published conditions distinguish share-alike pages from the unmodified underlying software, and direct customization requests to the maintainers. Less straightforward for a custom teacher character. |
| [MMS-Player](https://github.com/DFKI-SignLanguage/MMS-Player) | GPL-3.0 repository, avatar asset, motion-based sign synthesis pipeline | Alternative to investigate if offline motion production fits. Not a verified direct browser-webcam-to-avatar integration. |
| [SignBridge](https://github.com/mhmdtaha091/SignBridge) | MIT application, ASL/PSL model artifacts, sequence-comparison code | Reusable scaffolding and comparison baseline. Its models are not LSC; its procedural hand view is not the expressive full character requested. |
| [SPOTER embeddings](https://github.com/xmartlabs/spoter-embeddings) | Apache-2.0 training and ONNX/browser conversion code | Candidate recognizer/embedding pipeline. Inspected material did not establish a ready LSC checkpoint. Dataset restrictions remain separate from code licensing. |
| [OpenHands](https://github.com/AI4Bharat/OpenHands) | Apache-2.0 sign-recognition toolkit; project indicates it is no longer maintained | Possible reference baseline, not the default dependency. No pretrained LSC model verified. “CSL” in multilingual recognition material must not be assumed to mean Colombian Sign Language. |
| [Idiap SMILE](https://technology.idiap.ch/technologies/multimedia/smile/) | Published sign-assessment technology addressing shape, movement and fluency | Relevant assessment lead. Accessible reusable implementation, terms and LSC suitability were not established. Its published evaluation context is not an LSC product guarantee. |
| [SignLinked showcase](https://github.com/GabrielFEmilio/signlinked-showcase) | Repository tree has LICENSE and two README files | Cannot fork the demonstrated implementation from this repository. Earlier recommendation overstated its availability. |
| [LSC-SignLLM](https://github.com/soyjuandata/LSC-SignLLM) | Repository tree has README, license and gitignore | Architecture proposal, not an available recognition/avatar stack. |

Additional screened repositories included `ktatianab/lsc-recognizer`, `juan-kabbali/ColombianSignLanguageTranslator`, `mohaEs/SignCol`, and `sign/translate`. None provided a better verified complete LSC teacher in this inspection. This is not proof that no such project exists. Some source requests failed or were rate-limited, so inaccessible details remain unknown.

## Strongest recognition candidate: exact integration contract

[Lumiere's inference source](https://github.com/Tazana2/Lumiere/blob/main/backend/prueba/views.py) defines eight labels: `hola`, `mi_nombre_es`, `como_estas`, `chao`, `buenas_noches`, `INSOR`, `por_favor`, `parado`. These are eight model labels, not evidence of eight expert-approved lessons.

The model consumes 30 frames of 1,662 values: 33 pose landmarks with visibility, 468 face landmarks, and 21 landmarks per hand. It loads `tryfewer.h5`. Capture uses OpenCV camera zero on the server. A deployed browser version therefore needs client camera capture, exact preprocessing and sequence handling, and an inference adapter. A confidence threshold in this code is not evidence that wrong signs are reliably rejected.

The inspected Javeriana classifier uses a different representation. Its class utility enumerates `os.listdir`, so reproducing the training label order is an explicit integration requirement. Connecting the wrong mapping can produce plausible but incorrect labels.

## What still needs connecting

1. **Camera to model:** reproduce landmark ordering, coordinate conventions, missing-point handling, handedness, frame sampling and model runtime.
2. **Reference sign to avatar:** convert an expert reference into rigged motion or author its sign description. Check finger shape, palm orientation, contact, movement and facial expression. Rendering an attractive character does not validate the sign.
3. **Prediction to teaching feedback:** predict the intended sign separately from accepting the attempt. A classifier may recognize an imperfect attempt, and a motion-distance threshold may penalize a valid signer variation. Both need learner examples and expert judgments.
4. **Vocabulary to curriculum:** reconcile labels and regional variants, attach reviewed explanations and examples, and define what each exercise assesses. None of the inspected model packages establishes a complete curriculum.

## Bounded acceptance check before committing to the stack

Use the complete target product as the destination, but test the uncertain integrations on three representative signs first. This is an engineering test, not a reduction of the intended product.

- Load a bundled LSC checkpoint, reproduce its preprocessing and verify label mapping against known reference samples.
- Play the same signs on the desired 3D character and have an LSC signer check their legibility and correctness.
- Test unseen people and deliberately incorrect handshape, orientation, position and movement. Record false acceptance, false rejection and abstention; do not substitute the repository's reported accuracy for these measurements.
- Measure camera-to-feedback latency on the target browser/device. Report model runtime separately from capture, buffering and network time.

If these pass, proceed with adapters, curriculum and vocabulary expansion using the selected components. If recognition fails, evaluate the existing LSC50 training pipeline. If correction fails, the product must not describe recognition confidence as validated corrective feedback.

## Estimate correction and evidence limits

The earlier 3–6 month estimate was not supported by a component audit and should be withdrawn. This audit supports a reuse-first architecture; it does not justify replacing that estimate with another precise full-product deadline before the integration checks.

Repository trees, licenses as published, model-file presence, model source and research descriptions were inspected. Model inference, checkpoint accuracy, avatar sign quality and learner assessment were **not** executed or validated in this audit. No claim of a working integrated teacher is made.
