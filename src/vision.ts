import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type { Frame, Point } from "./types";

type Models = { hand: HandLandmarker; pose: PoseLandmarker };
type Delegate = "GPU" | "CPU";
type DetectionState = {
  timestamp: number;
  video?: HTMLVideoElement;
  mediaTime?: number;
  failed?: boolean;
};
let pending: Promise<Models> | null = null;
let active: Models | undefined;
let preferCPU = false;
const delegates = new WeakMap<Models, Delegate>();
const states = new WeakMap<Models, DetectionState>();

class VisionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "VisionError";
  }
}
function closeQuietly(model: { close(): void } | undefined) {
  // Cleanup must neither hide the original failure nor prevent CPU fallback.
  try {
    model?.close();
  } catch {
    /* A failed graph can also throw while closing. */
  }
}
export function loadVision(): Promise<Models> {
  if (!pending)
    pending = (async () => {
      const files = await FilesetResolver.forVisionTasks("/wasm");
      const choices: Delegate[] = preferCPU ? ["CPU"] : ["GPU", "CPU"];
      for (const delegate of choices) {
        let hand: HandLandmarker | undefined;
        let pose: PoseLandmarker | undefined;
        try {
          hand = await HandLandmarker.createFromOptions(files, {
            baseOptions: {
              modelAssetPath: "/models/hand_landmarker.task",
              delegate,
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.45,
            minHandPresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
          pose = await PoseLandmarker.createFromOptions(files, {
            baseOptions: {
              modelAssetPath: "/models/pose_landmarker_lite.task",
              delegate,
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
          const models = { hand, pose };
          delegates.set(models, delegate);
          active = models;
          return models;
        } catch (error) {
          closeQuietly(pose);
          closeQuietly(hand);
          if (delegate === "CPU") throw error;
        }
      }
      throw new Error("No delegate available");
    })().catch((error) => {
      pending = null;
      throw new VisionError(
        "No se pudo cargar el seguimiento. Comprueba la conexión y vuelve a intentarlo.",
        error,
      );
    });
  return pending;
}

function landmarks(value: Point[] | undefined, count: number): Point[] {
  // Keep canonical indices; never filter individual points or invent missing ones.
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    !Array.from(value).every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.z) &&
        (p.visibility === undefined ||
          (Number.isFinite(p.visibility) &&
            p.visibility >= 0 &&
            p.visibility <= 1)),
    ) ||
    !value.some((p) => p.x !== 0 || p.y !== 0)
  )
    return [];
  // Capture owns its frames even if a detector reuses result objects later.
  return value.map((p) => ({ ...p }));
}
function associate(
  pose: Point[],
  hands: Point[][],
  aspect: number,
): { l: Point[]; r: Point[] } {
  const empty = { l: [], r: [] } as { l: Point[]; r: Point[] };
  if (!pose.length || !hands.length) return empty;
  const distance = (a: Point, b: Point) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const visible = (p: Point) =>
    p.visibility !== undefined && p.visibility >= 0.5;
  // Visibility is required for anatomical anchors; handedness labels depend on
  // input mirroring and cannot resolve an occluded wrist reliably here.
  const anchors = [pose[15], pose[16]];
  const shoulders = [pose[11], pose[12]];
  const scale = shoulders.every(visible)
    ? distance(shoulders[0], shoulders[1])
    : 0;
  const maxDistance = Math.max(0.08, Math.min(0.25, scale * 0.6));
  const margin = Math.max(0.015, Math.min(0.04, scale * 0.08));
  const costs = hands.map((h) =>
    anchors.map((w) => (visible(w) ? distance(h[0], w) : Infinity)),
  );
  // Both wrists must be observable: with one hidden wrist, its hand may be
  // mistaken for the visible wrist during crossing. Abstain for that frame.
  if (!anchors.every(visible)) return empty;
  if (hands.length === 1) {
    const [left, right] = costs[0];
    if (Math.abs(left - right) <= margin) return empty;
    if (left < right && left <= maxDistance) empty.l = hands[0];
    if (right < left && right <= maxDistance) empty.r = hands[0];
    return empty;
  }
  // Enumerate feasible one-to-one assignments (including unmatched hands).
  // Match count wins, then distance; near ties abstain rather than swap identity.
  const options: { l: number; r: number; count: number; cost: number }[] = [];
  for (let l = -1; l < hands.length; l++)
    for (let r = -1; r < hands.length; r++) {
      if (l >= 0 && l === r) continue;
      if (
        (l >= 0 && costs[l][0] > maxDistance) ||
        (r >= 0 && costs[r][1] > maxDistance)
      )
        continue;
      options.push({
        l,
        r,
        count: Number(l >= 0) + Number(r >= 0),
        cost: (l < 0 ? 0 : costs[l][0]) + (r < 0 ? 0 : costs[r][1]),
      });
    }
  options.sort((a, b) => b.count - a.count || a.cost - b.cost);
  const best = options[0];
  const plausible = options.filter(
    (x) => x.count === best.count && x.cost - best.cost <= margin,
  );
  if (best.l >= 0 && plausible.every((x) => x.l === best.l))
    empty.l = hands[best.l];
  if (best.r >= 0 && plausible.every((x) => x.r === best.r))
    empty.r = hands[best.r];
  return empty;
}

export function detect(
  video: HTMLVideoElement,
  models: Awaited<ReturnType<typeof loadVision>>,
  t: number,
): Frame {
  if (!Number.isFinite(t) || t < 0 || t > Number.MAX_SAFE_INTEGER / 1000)
    throw new VisionError(
      "El tiempo del video no es válido. Apaga la cámara y vuelve a intentarlo.",
    );
  let state = states.get(models);
  if (!state) {
    state = { timestamp: -1 };
    states.set(models, state);
  }
  if (state.failed)
    throw new VisionError(
      "El seguimiento se interrumpió. Vuelve a activar la cámara para reiniciarlo.",
    );
  // MediaPipe VIDEO timestamps and Frame.t are milliseconds. Persist across
  // camera restarts because the cached graph retains its previous timestamp.
  const timestamp = Math.max(t, state.timestamp + 1);
  state.timestamp = timestamp;
  const width = video.videoWidth,
    height = video.videoHeight;
  const dimensions =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0;
  const aspect = dimensions ? width / height : 1;
  const empty: Frame = {
    p: [],
    l: [],
    r: [],
    t: timestamp,
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1,
  };
  if (
    !dimensions ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    video.readyState < 2 ||
    video.seeking ||
    video.ended ||
    video.paused
  )
    return empty;
  const mediaTime = video.currentTime;
  if (!Number.isFinite(mediaTime) || mediaTime < 0) return empty;
  // A stalled/unchanged decoded frame must not count as fresh signing evidence.
  if (state.video === video && state.mediaTime === mediaTime) return empty;
  state.video = video;
  state.mediaTime = mediaTime;
  try {
    const pose = landmarks(
      models.pose.detectForVideo(video, timestamp).landmarks?.[0],
      33,
    );
    const hands = (models.hand.detectForVideo(video, timestamp).landmarks ?? [])
      .slice(0, 2)
      .map((h) => landmarks(h, 21))
      .filter((h) => h.length > 0);
    return { p: pose, ...associate(pose, hands, aspect), t: timestamp, aspect };
  } catch (error) {
    state.failed = true;
    closeQuietly(models.pose);
    closeQuietly(models.hand);
    if (active === models) {
      if (delegates.get(models) === "GPU") preferCPU = true;
      active = undefined;
      pending = null;
    }
    throw new VisionError(
      "El seguimiento se interrumpió. Vuelve a activar la cámara para reiniciarlo.",
      error,
    );
  }
}
export function cameraError(error: unknown) {
  if (error instanceof VisionError) return error.message;
  const name =
    error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "No se pudo acceder a la cámara. Revisa el permiso del sitio y del sistema, y vuelve a intentarlo.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No encontré una cámara. Conecta una y vuelve a intentarlo.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "No se pudo leer la cámara. Puede estar ocupada o desconectada. Cierra otras apps que la usen y vuelve a intentarlo.";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError")
    return "La cámara no admite la configuración solicitada. Prueba otra cámara o una resolución menor.";
  if (name === "SecurityError")
    return "El navegador bloqueó la cámara por seguridad. Abre la aplicación en HTTPS y revisa los permisos.";
  if (name === "AbortError")
    return "Se interrumpió el inicio de la cámara. Vuelve a intentarlo.";
  if (name === "InvalidStateError")
    return "La página o el video todavía no están listos. Vuelve a la pestaña y activa la cámara de nuevo.";
  return "No se pudo iniciar la cámara o el seguimiento. Vuelve a intentarlo en Chrome o Edge.";
}
