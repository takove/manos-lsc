import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { evaluate } from "./scoring";
import type { Frame } from "./types";
const ref: Frame[] = JSON.parse(
  readFileSync("public/references/0000.json", "utf8"),
).frames;
const copy = (): Frame[] => structuredClone(ref);
describe("LSC attempt comparison", () => {
  it("scores the actual reference identically", () => {
    expect(evaluate(ref, ref).score).toBe(100);
  });
  it("abstains on empty capture", () =>
    expect(evaluate(ref, []).ok).toBe(false));
  it("abstains when hands cannot be seen", () =>
    expect(
      evaluate(
        ref,
        ref.map((f) => ({ ...f, l: [], r: [] })),
      ).ok,
    ).toBe(false));
  it("rejects non-finite coordinates", () => {
    const x = copy();
    x.forEach((f) => (f.p[11].x = NaN));
    expect(evaluate(ref, x).ok).toBe(false);
  });
  it("normalizes camera distance and horizontal/vertical translation", () => {
    const x = copy();
    x.forEach((f) =>
      [f.p, f.l, f.r].forEach((a) =>
        a.forEach((p) => {
          p.x = p.x * 0.7 + 0.1;
          p.y = p.y * 0.7 + 0.12;
        }),
      ),
    );
    expect(evaluate(ref, x).score).toBeGreaterThanOrEqual(98);
  });
  it("tolerates different sequence sampling rates", () =>
    expect(
      evaluate(
        ref,
        ref.filter((_, i) => i % 2 === 0),
      ).score,
    ).toBeGreaterThan(85));
  it("reduces location score when hands are lowered", () => {
    const x = copy();
    x.forEach((f) => [f.l, f.r].forEach((h) => h.forEach((p) => (p.y += 0.1))));
    const r = evaluate(ref, x);
    expect(r.metrics!.location).toBeLessThan(65);
    expect(r.feedback.some((s) => s.includes("subir"))).toBe(true);
  });
  it("does not reward a frozen frame as a dynamic sign", () => {
    const x = ref.map((f) => ({ ...structuredClone(ref[0]), t: f.t }));
    expect(evaluate(ref, x).score).toBeLessThan(60);
  });
  it("returns finite bounded scores for all lesson pairs", () => {
    for (const id of [
      "0030",
      "0000",
      "0032",
      "0031",
      "0038",
      "0039",
      "0005",
      "0026",
      "0024",
      "0001",
    ]) {
      const other = JSON.parse(
        readFileSync(`public/references/${id}.json`, "utf8"),
      ).frames;
      const r = evaluate(ref, other);
      if (r.ok) {
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });
});
