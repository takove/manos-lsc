import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Avatar, LandmarkOverlay, sharedAvatarViewport } from "./Avatar";
import type { Frame, Reference } from "./types";
import ref0000 from "../public/references/0000.json";
import ref0001 from "../public/references/0001.json";
import ref0005 from "../public/references/0005.json";
import ref0024 from "../public/references/0024.json";
import ref0026 from "../public/references/0026.json";
import ref0030 from "../public/references/0030.json";
import ref0031 from "../public/references/0031.json";
import ref0032 from "../public/references/0032.json";
import ref0038 from "../public/references/0038.json";
import ref0039 from "../public/references/0039.json";
const refs: Reference[] = [
  ref0000,
  ref0001,
  ref0005,
  ref0024,
  ref0026,
  ref0030,
  ref0031,
  ref0032,
  ref0038,
  ref0039,
];
const fixture = () => structuredClone(refs[0].frames[20]);
const render = (frame?: Frame) =>
  renderToStaticMarkup(<Avatar frame={frame} />);
describe("Avatar", () => {
  it("renders all 763 frozen frames at fixed zoom with finite attributes and unchanged input", () => {
    let count = 0;
    for (const r of refs)
      for (const frame of r.frames) {
        const original = JSON.stringify(frame),
          html = render(frame);
        expect(html).toContain('viewBox="0 -16 600 696"');
        expect(html).not.toMatch(/NaN|Infinity|undefined/);
        expect(JSON.stringify(frame)).toBe(original);
        count++;
      }
    expect(count).toBe(763);
  });
  it("normalizes tilted shoulders by Euclidean image distance", () => {
    const f = fixture();
    f.p[11] = { x: 0.5, y: 0.4, z: 0 };
    f.p[12] = { x: 0.5, y: 0.6, z: 0 };
    expect(render(f)).toContain('points="300,150 ');
    expect(render(f)).toContain('points="300,320 ');
  });
  it("only requires the pose points it actually draws", () => {
    const f = fixture();
    f.p = f.p.slice(0, 17);
    expect(render(f)).toContain("<svg");
  });
  it("abstains when anchors, aspect, or shoulder separation cannot define geometry", () => {
    for (const mutate of [
      (f: Frame) => {
        f.p = [];
      },
      (f: Frame) => {
        f.p[0].x = NaN;
      },
      (f: Frame) => {
        f.aspect = 0;
      },
      (f: Frame) => {
        f.aspect = Infinity;
      },
      (f: Frame) => {
        f.p[12] = { ...f.p[11] };
      },
    ]) {
      const f = fixture();
      mutate(f);
      expect(render(f)).toContain('role="status"');
      expect(render(f)).not.toContain("<svg");
    }
  });
  it("omits an invalid hand and arm while preserving the valid side", () => {
    const f = fixture();
    f.l[8].x = NaN;
    f.p[13].y = Infinity;
    const html = render(f);
    expect(html).not.toContain('data-hand="l"');
    expect(html).toContain('data-hand="r"');
    expect(html.match(/data-forearm=/g)).toHaveLength(1);
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("handles a missing point in a sparse hand without throwing", () => {
    const f = fixture();
    delete f.l[8];
    expect(render(f)).not.toContain('data-hand="l"');
    expect(renderToStaticMarkup(<LandmarkOverlay frame={f} />)).not.toMatch(
      /NaN|Infinity/,
    );
  });
  it("omits empty/all-zero hands but accepts a hand along the image boundary", () => {
    const f = fixture();
    f.l = [];
    f.r = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(render(f)).not.toContain("data-hand=");
    f.r = f.r.map((p, i) => ({ ...p, y: 0.3 + i * 0.01 }));
    expect(render(f)).toContain('data-hand="r"');
  });
  it("does not use face or relative z for expression or painter order", () => {
    const f = fixture(),
      before = render(f);
    f.f = [];
    for (const p of [...f.p, ...f.l, ...f.r]) p.z = NaN;
    expect(render(f)).toBe(before);
  });
  it("paints all forearms after sleeves, and both hands last", () => {
    const html = render(fixture());
    expect(html.lastIndexOf("data-upper-arm")).toBeLessThan(
      html.indexOf("data-forearm"),
    );
    expect(html.lastIndexOf("data-forearm")).toBeLessThan(
      html.indexOf("data-hand"),
    );
  });
  it("suppresses a duplicate unavailable ghost message", () => {
    expect(renderToStaticMarkup(<Avatar ghost />)).toBe("");
    expect(render()).toContain("Preparando");
  });
});
describe("LandmarkOverlay", () => {
  it("preserves unmirrored image coordinates and centered contain aspect", () => {
    const f = fixture(),
      html = renderToStaticMarkup(<LandmarkOverlay frame={f} />);
    expect(html).toContain(`viewBox="0 0 ${100 * f.aspect} 100"`);
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(html).toContain(
      `cx="${f.l[0].x * 100 * f.aspect}" cy="${f.l[0].y * 100}"`,
    );
    expect(html).not.toContain("scaleX");
  });
  it("skips bad hands and dimensions without invalid SVG output", () => {
    const f = fixture();
    f.l[0].y = Infinity;
    f.r = [];
    const html = renderToStaticMarkup(<LandmarkOverlay frame={f} />);
    expect(html).not.toContain("<circle");
    expect(html).not.toMatch(/NaN|Infinity/);
    f.aspect = NaN;
    expect(renderToStaticMarkup(<LandmarkOverlay frame={f} />)).toBe("");
  });
});

it("shares the same expanded viewport for a reference and outlying attempt", () => {
  const a = fixture(),
    b = fixture();
  b.l = b.l.map((p) => ({ ...p, x: p.x + 1 }));
  const viewport = sharedAvatarViewport([a, b]);
  expect(viewport[2]).toBeGreaterThan(600);
  const html = renderToStaticMarkup(
    <>
      <Avatar frame={a} viewport={viewport} />
      <Avatar frame={b} ghost viewport={viewport} />
    </>,
  );
  expect([...html.matchAll(/viewBox="([^"]+)"/g)].map((m) => m[1])).toEqual([
    viewport.join(" "),
    viewport.join(" "),
  ]);
});
