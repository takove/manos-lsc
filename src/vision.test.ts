import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Point } from "./types";

const factories = vi.hoisted(() => ({
  files: vi.fn(),
  hand: vi.fn(),
  pose: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: factories.files },
  HandLandmarker: { createFromOptions: factories.hand },
  PoseLandmarker: { createFromOptions: factories.pose },
}));
type Vision = typeof import("./vision");
let vision: Vision;
const point = (x = 0.5, y = 0.5, visibility = 1): Point => ({
  x,
  y,
  z: 0,
  visibility,
});
const hand = (x: number, y = 0.5) =>
  Array.from({ length: 21 }, (_, i) => point(x + i * 0.001, y + i * 0.002));
function pose(left = 0.25, right = 0.75) {
  const points = Array.from({ length: 33 }, () => point());
  points[11] = point(0.3, 0.3);
  points[12] = point(0.7, 0.3);
  points[15] = point(left);
  points[16] = point(right);
  return points;
}
function video(overrides: Partial<HTMLVideoElement> = {}) {
  return {
    videoWidth: 640,
    videoHeight: 640,
    readyState: 2,
    seeking: false,
    ended: false,
    paused: false,
    currentTime: 1,
    ...overrides,
  } as HTMLVideoElement;
}
function detector(points: Point[][] = []) {
  return {
    detectForVideo: vi.fn(() => ({ landmarks: points })),
    close: vi.fn(),
  };
}
function fixture(p = pose(), hands: Point[][] = [hand(0.25), hand(0.75)]) {
  const raw = { pose: detector([p]), hand: detector(hands) };
  return {
    raw,
    models: raw as unknown as Awaited<ReturnType<Vision["loadVision"]>>,
  };
}
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  factories.files.mockResolvedValue({});
  factories.hand.mockImplementation(async () => detector());
  factories.pose.mockImplementation(async () => detector());
  vision = await import("./vision");
});

describe("loadVision lifecycle", () => {
  it("shares one initialization and preserves frozen assets/options", async () => {
    const a = vision.loadVision(),
      b = vision.loadVision();
    expect(a).toBe(b);
    const result = await a;
    expect(await vision.loadVision()).toBe(result);
    expect(factories.files).toHaveBeenCalledWith("/wasm");
    expect(factories.hand).toHaveBeenCalledTimes(1);
    expect(factories.hand.mock.calls[0][1]).toMatchObject({
      baseOptions: {
        delegate: "GPU",
        modelAssetPath: "/models/hand_landmarker.task",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    expect(factories.pose.mock.calls[0][1]).toMatchObject({
      baseOptions: {
        delegate: "GPU",
        modelAssetPath: "/models/pose_landmarker_lite.task",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  });
  it("falls back when GPU hand creation fails", async () => {
    factories.hand.mockRejectedValueOnce(Error("GPU unavailable"));
    await vision.loadVision();
    expect(
      factories.hand.mock.calls.map((c) => c[1].baseOptions.delegate),
    ).toEqual(["GPU", "CPU"]);
    expect(factories.pose.mock.calls[0][1].baseOptions.delegate).toBe("CPU");
  });
  it("closes partially created GPU resources even when cleanup throws", async () => {
    const gpuHand = detector();
    gpuHand.close.mockImplementation(() => {
      throw Error("broken close");
    });
    factories.hand.mockResolvedValueOnce(gpuHand);
    factories.pose.mockRejectedValueOnce(Error("GPU pose failed"));
    await vision.loadVision();
    expect(gpuHand.close).toHaveBeenCalledTimes(1);
    expect(
      factories.pose.mock.calls.map((c) => c[1].baseOptions.delegate),
    ).toEqual(["GPU", "CPU"]);
  });
  it("retries after WASM initialization failure, with a Spanish error and cause", async () => {
    const cause = Error("fetch failed");
    factories.files.mockRejectedValueOnce(cause);
    await expect(vision.loadVision()).rejects.toMatchObject({
      message: expect.stringContaining("No se pudo cargar"),
      cause,
    });
    await expect(vision.loadVision()).resolves.toHaveProperty("hand");
    expect(factories.files).toHaveBeenCalledTimes(2);
  });
  it("cleans both partial attempts and permits retry after both delegates fail", async () => {
    const gpu = detector(),
      cpu = detector();
    factories.hand.mockResolvedValueOnce(gpu).mockResolvedValueOnce(cpu);
    factories.pose
      .mockRejectedValueOnce(Error("gpu"))
      .mockRejectedValueOnce(Error("cpu"));
    await expect(vision.loadVision()).rejects.toThrow("No se pudo cargar");
    expect(gpu.close).toHaveBeenCalledTimes(1);
    expect(cpu.close).toHaveBeenCalledTimes(1);
    await expect(vision.loadVision()).resolves.toHaveProperty("pose");
  });
  it("invalidates a runtime failure, closes both graphs and retries on CPU", async () => {
    const h = detector(),
      p = detector();
    factories.hand.mockResolvedValueOnce(h);
    factories.pose.mockResolvedValueOnce(p);
    const models = await vision.loadVision();
    h.detectForVideo.mockImplementation(() => {
      throw Error("lost context");
    });
    p.close.mockImplementation(() => {
      throw Error("cleanup");
    });
    expect(() => vision.detect(video(), models, 10)).toThrow(
      "El seguimiento se interrumpió",
    );
    expect(p.close).toHaveBeenCalledTimes(1);
    expect(h.close).toHaveBeenCalledTimes(1);
    const next = await vision.loadVision();
    expect(next).not.toBe(models);
    expect(factories.hand.mock.calls[1][1].baseOptions.delegate).toBe("CPU");
    expect(() => vision.detect(video(), models, 20)).toThrow("reiniciarlo");
    expect(await vision.loadVision()).toBe(next);
    expect(h.close).toHaveBeenCalledTimes(1);
  });
  it("permits another fresh CPU pair after a CPU runtime failure", async () => {
    factories.hand.mockRejectedValueOnce(Error("GPU unavailable"));
    const models = await vision.loadVision();
    vi.mocked(models.pose.detectForVideo).mockImplementation(() => {
      throw Error("CPU failed");
    });
    expect(() => vision.detect(video(), models, 10)).toThrow("reiniciarlo");
    await expect(vision.loadVision()).resolves.not.toBe(models);
  });
});

describe("valid frames and graph timestamps", () => {
  it.each([
    { videoWidth: 0 },
    { videoHeight: 0 },
    { videoWidth: NaN },
    { videoHeight: Infinity },
    { videoWidth: -2 },
    { readyState: 1 },
    { seeking: true },
    { ended: true },
    { paused: true },
    { currentTime: NaN },
    { currentTime: -1 },
  ])("skips unavailable frames without invoking models: %j", (props) => {
    const { raw, models } = fixture();
    const f = vision.detect(video(props), models, 20);
    expect(f.p).toEqual([]);
    expect(f.l).toEqual([]);
    expect(f.r).toEqual([]);
    expect(Number.isFinite(f.aspect) && f.aspect > 0).toBe(true);
    expect(raw.pose.detectForVideo).not.toHaveBeenCalled();
    expect(raw.hand.detectForVideo).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, -1, Number.MAX_VALUE])(
    "rejects invalid timestamp %s before inference",
    (t) => {
      const { raw, models } = fixture();
      expect(() => vision.detect(video(), models, t)).toThrow(
        "tiempo del video",
      );
      expect(raw.pose.detectForVideo).not.toHaveBeenCalled();
    },
  );
  it("uses strictly increasing matching millisecond timestamps across video restarts", () => {
    const { raw, models } = fixture();
    const a = vision.detect(video(), models, 100),
      b = vision.detect(video(), models, 100),
      c = vision.detect(video(), models, 0);
    expect([a.t, b.t, c.t]).toEqual([100, 101, 102]);
    expect(
      raw.pose.detectForVideo.mock.calls.map((c) => (c as unknown[])[1]),
    ).toEqual([100, 101, 102]);
    expect(
      raw.hand.detectForVideo.mock.calls.map((c) => (c as unknown[])[1]),
    ).toEqual([100, 101, 102]);
  });
  it("does not reuse a stalled decoded frame as fresh evidence, and resumes on new media time", () => {
    const { raw, models } = fixture();
    const v = video();
    expect(vision.detect(v, models, 1).p).toHaveLength(33);
    expect(vision.detect(v, models, 70).p).toEqual([]);
    v.currentTime += 0.1;
    expect(vision.detect(v, models, 140).p).toHaveLength(33);
    expect(raw.pose.detectForVideo).toHaveBeenCalledTimes(2);
  });
  it("keeps clock state independent for each model pair", () => {
    const a = fixture(),
      b = fixture();
    vision.detect(video(), a.models, 1000);
    expect(vision.detect(video(), b.models, 1).t).toBe(1);
  });
  it("owns copies of detector points so later inference cannot mutate captures", () => {
    const p = pose(),
      h = hand(0.25);
    const { models } = fixture(p, [h]);
    const f = vision.detect(video(), models, 0);
    p[15].x = 0.9;
    h[0].x = 0.9;
    expect(f.p[15].x).toBe(0.25);
    expect(f.l[0].x).toBe(0.25);
  });
});

describe("anatomical wrist association", () => {
  it("associates by pose identity, independent of detector order and screen side", () => {
    const { models } = fixture(pose(0.75, 0.25), [hand(0.25), hand(0.75)]);
    const f = vision.detect(video(), models, 0);
    expect(f.l[0].x).toBe(0.75);
    expect(f.r[0].x).toBe(0.25);
  });
  it("tracks crossed hands, abstains at overlap, and recovers after crossing", () => {
    const { raw, models } = fixture();
    const run = (left: number, right: number, t: number) => {
      raw.pose.detectForVideo.mockReturnValue({
        landmarks: [pose(left, right)],
      });
      raw.hand.detectForVideo.mockReturnValue({
        landmarks: [hand(right), hand(left)],
      });
      return vision.detect(video(), models, t);
    };
    expect(run(0.25, 0.75, 1).l[0].x).toBe(0.25);
    const overlap = run(0.5, 0.5, 2);
    expect(overlap.l).toEqual([]);
    expect(overlap.r).toEqual([]);
    const crossed = run(0.75, 0.25, 3);
    expect(crossed.l[0].x).toBe(0.75);
    expect(crossed.r[0].x).toBe(0.25);
  });
  it("abstains for a single hand equidistant from the two wrists", () => {
    const { models } = fixture(pose(0.48, 0.52), [hand(0.5)]);
    const f = vision.detect(video(), models, 0);
    expect(f.l).toEqual([]);
    expect(f.r).toEqual([]);
  });
  it.each([0, 0.49, undefined])(
    "does not guess when a wrist has missing/low visibility %s",
    (visibility) => {
      const p = pose();
      p[15].visibility = visibility;
      const { models } = fixture(p);
      const f = vision.detect(video(), models, 0);
      expect(f.l).toEqual([]);
      expect(f.r).toEqual([]);
    },
  );
  it("rejects a faraway hand rather than assigning to whichever wrist is nearer", () => {
    const { models } = fixture(pose(), [hand(0.1, 0.95)]);
    const f = vision.detect(video(), models, 0);
    expect(f.l).toEqual([]);
    expect(f.r).toEqual([]);
  });
  it("does not force a second faraway hand into a two-hand assignment", () => {
    const { models } = fixture(pose(), [hand(0.25), hand(0.95, 0.95)]);
    const f = vision.detect(video(), models, 0);
    expect(f.l).toHaveLength(21);
    expect(f.r).toEqual([]);
  });
  it("corrects horizontal distances for video aspect", () => {
    const p = pose();
    p[15] = point(0.55, 0.5);
    p[16] = point(0.5, 0.58);
    const { models } = fixture(p, [hand(0.5)]);
    const f = vision.detect(
      video({ videoWidth: 1920, videoHeight: 480 }),
      models,
      0,
    );
    expect(f.r).toHaveLength(21);
    expect(f.l).toEqual([]);
    expect(f.aspect).toBe(4);
  });
  it("does not compare z from independent detectors", () => {
    const p = pose();
    p[15].z = 100;
    const h = hand(0.25);
    h[0].z = -100;
    const { models } = fixture(p, [h]);
    expect(vision.detect(video(), models, 0).l).toHaveLength(21);
  });
  it.each(
    [
      [],
      pose().slice(0, 16),
      pose().map((p) => ({ ...p, x: NaN })),
      Array.from({ length: 33 }, () => point(0, 0)),
    ].map((p) => ({ p })),
  )(
    "handles missing/malformed pose without indexing absent wrists",
    ({ p }) => {
      const { models } = fixture(p);
      const f = vision.detect(video(), models, 0);
      expect(f.p).toEqual([]);
      expect(f.l).toEqual([]);
      expect(f.r).toEqual([]);
    },
  );
  it.each(
    [
      [],
      hand(0.25).slice(0, 20),
      hand(0.25).map((p) => ({ ...p, z: Infinity })),
      Array.from({ length: 21 }, () => point(0, 0)),
    ].map((h) => ({ h })),
  )("ignores malformed hand while preserving a valid other hand", ({ h }) => {
    const { models } = fixture(pose(), [h, hand(0.75)]);
    const f = vision.detect(video(), models, 0);
    expect(f.l).toEqual([]);
    expect(f.r).toHaveLength(21);
  });
  it("rejects sparse arrays without losing canonical indices or closing healthy graphs", () => {
    const p = pose();
    delete p[15];
    const { raw, models } = fixture(p);
    const f = vision.detect(video(), models, 0);
    expect(f.p).toEqual([]);
    expect(f.l).toEqual([]);
    expect(raw.pose.close).not.toHaveBeenCalled();
    expect(raw.hand.close).not.toHaveBeenCalled();
  });
  it("handles absent landmark result fields as missing detection", () => {
    const { raw, models } = fixture();
    raw.pose.detectForVideo.mockReturnValue({} as never);
    raw.hand.detectForVideo.mockReturnValue({} as never);
    expect(vision.detect(video(), models, 0)).toEqual({
      p: [],
      l: [],
      r: [],
      t: 0,
      aspect: 1,
    });
  });
});

describe("Spanish errors", () => {
  it.each([
    ["NotAllowedError", "permiso"],
    ["NotFoundError", "Conecta"],
    ["NotReadableError", "ocupada o desconectada"],
    ["OverconstrainedError", "configuración"],
    ["SecurityError", "HTTPS"],
    ["AbortError", "interrumpió"],
    ["InvalidStateError", "listos"],
  ])("supports cross-realm/plain DOM error names: %s", (name, message) => {
    expect(vision.cameraError({ name })).toContain(message);
  });
  it("does not expose arbitrary error messages", () => {
    expect(vision.cameraError(Error("private diagnostic"))).not.toContain(
      "private diagnostic",
    );
    expect(vision.cameraError(null)).toContain("No se pudo iniciar");
  });
  it("preserves safe tracking errors with their cause", () => {
    const { models } = fixture();
    try {
      vision.detect(video(), models, NaN);
    } catch (e) {
      expect(vision.cameraError(e)).toContain("tiempo del video");
    }
  });
});
