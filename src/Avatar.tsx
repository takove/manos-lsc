import type { Frame, Point } from "./types";
import "./Avatar.css";
const bones = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
// x/y alone determine this 2D rendering; detector-relative z is not depth.
const validPoint = (q: Point | undefined): q is Point =>
  !!q && Number.isFinite(q.x) && Number.isFinite(q.y);
const validAspect = (aspect: number) =>
  Number.isFinite(aspect) && Number.isFinite(aspect * 100) && aspect > 0;
const validHand = (h: Point[] | undefined): h is Point[] =>
  Array.isArray(h) &&
  h.length === 21 &&
  [...h].every(validPoint) &&
  h.some((q) => q.x !== 0 || q.y !== 0);

/** A shared camera prevents the reference and ghost from auto-scaling differently. */
export function sharedAvatarViewport(
  frames: (Frame | undefined)[],
): [number, number, number, number] {
  let minX = 0,
    minY = -16,
    maxX = 600,
    maxY = 680;
  for (const frame of frames) {
    if (
      !frame ||
      !validAspect(frame.aspect) ||
      !frame.p ||
      ![0, 11, 12].every((i) => validPoint(frame.p[i]))
    )
      continue;
    const p = frame.p,
      shoulder = Math.hypot(
        (p[11].x - p[12].x) * frame.aspect,
        p[11].y - p[12].y,
      );
    if (!Number.isFinite(shoulder) || shoulder < 0.02) continue;
    const scale = 170 / shoulder,
      cx = (p[11].x + p[12].x) / 2,
      cy = (p[11].y + p[12].y) / 2;
    const xy = (q: Point) => [
      (q.x - cx) * frame.aspect * scale + 300,
      (q.y - cy) * scale + 235,
    ];
    const nose = xy(p[0]);
    minX = Math.min(minX, nose[0] - 100);
    maxX = Math.max(maxX, nose[0] + 100);
    minY = Math.min(minY, nose[1] - 116);
    maxY = Math.max(maxY, nose[1] + 144);
    const points = [
      ...p.filter((_, i) => [11, 12, 13, 14, 15, 16].includes(i)),
      ...(validHand(frame.l) ? frame.l : []),
      ...(validHand(frame.r) ? frame.r : []),
    ].filter(validPoint);
    for (const q of points) {
      const [x, y] = xy(q);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x - 24);
      maxX = Math.max(maxX, x + 24);
      minY = Math.min(minY, y - 24);
      maxY = Math.max(maxY, y + 24);
    }
  }
  return [minX, minY, maxX - minX, maxY - minY];
}
export function Avatar({
  frame,
  ghost = false,
  viewport,
}: {
  frame?: Frame;
  ghost?: boolean;
  viewport?: [number, number, number, number];
}) {
  const unavailable = () =>
    ghost ? null : (
      <div className="avatar-loading lsc-avatar-loading" role="status">
        {frame
          ? "Movimiento no disponible en este fotograma."
          : "Preparando tu guía…"}
      </div>
    );
  if (!frame || !validAspect(frame.aspect) || !Array.isArray(frame.p))
    return unavailable();
  const p = frame.p;
  if (!validPoint(p[0]) || !validPoint(p[11]) || !validPoint(p[12]))
    return unavailable();
  // Euclidean shoulder distance in image-height units also handles tilted poses.
  const shoulder = Math.hypot(
    (p[11].x - p[12].x) * frame.aspect,
    p[11].y - p[12].y,
  );
  if (!Number.isFinite(shoulder) || shoulder < 0.02) return unavailable();
  const scale = 170 / shoulder;
  const center = (p[11].x + p[12].x) / 2,
    cy = (p[11].y + p[12].y) / 2;
  const xy = (q: Point) => [
    (q.x - center) * frame.aspect * scale + 300,
    (q.y - cy) * scale + 235,
  ];
  const points = (v: Point[]) => v.map((q) => xy(q).join(",")).join(" ");
  const nose = xy(p[0]);
  const headX = nose[0],
    headY = nose[1] - 6;
  const l = xy(p[11]),
    r = xy(p[12]);
  const hands = [frame.l, frame.r].map((h) => (validHand(h) ? h : []));
  const arms = [
    [11, 13, 15],
    [12, 14, 16],
  ].filter((b) => b.every((i) => validPoint(p[i])));
  // A fixed envelope keeps all 763 frozen reference frames at the same zoom.
  // Expand only for out-of-envelope input, preserving the measured geometry.
  const visible = [
    ...arms.flatMap((b) => b.map((i) => xy(p[i]))),
    ...hands.flatMap((h) => h.map(xy)),
  ];
  const minX = Math.min(0, headX - 100, ...visible.map((q) => q[0] - 24));
  const maxX = Math.max(600, headX + 100, ...visible.map((q) => q[0] + 24));
  const minY = Math.min(-16, headY - 110, ...visible.map((q) => q[1] - 24));
  const maxY = Math.max(680, headY + 150, ...visible.map((q) => q[1] + 24));
  if (
    ![minX, maxX, minY, maxY, maxX - minX, maxY - minY].every(Number.isFinite)
  )
    return unavailable();
  const hand = (h: Point[], key: string) =>
    h.length === 21 ? (
      <g key={key} data-hand={key}>
        <polygon
          points={points([h[0], h[1], h[5], h[9], h[13], h[17]])}
          fill="#d7a276"
          stroke="#96603e"
          strokeWidth="1.2"
        />
        {bones.map((b, i) => {
          const wrist = xy(h[0]),
            knuckle = xy(h[9]);
          const width = Math.max(
            2,
            Math.min(
              6.5,
              Math.hypot(wrist[0] - knuckle[0], wrist[1] - knuckle[1]) * 0.15,
            ),
          );
          return (
            <g key={i}>
              <polyline
                points={points(b.map((n) => h[n]))}
                fill="none"
                stroke="#96603e"
                strokeWidth={width + 1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={points(b.map((n) => h[n]))}
                fill="none"
                stroke="#d7a276"
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </g>
    ) : null;
  const box =
    viewport &&
    viewport.every(Number.isFinite) &&
    viewport[2] > 0 &&
    viewport[3] > 0
      ? viewport
      : [minX, minY, maxX - minX, maxY - minY];
  return (
    <svg
      viewBox={box.join(" ")}
      preserveAspectRatio="xMidYMid meet"
      className={"avatar lsc-avatar " + (ghost ? "ghost" : "")}
      role="img"
      aria-hidden={ghost || undefined}
      aria-label={
        ghost
          ? undefined
          : "Guía estilizada del movimiento en 2D; consulta el video LSC para detalles y expresión"
      }
    >
      <ellipse
        cx="302"
        cy="475"
        rx="135"
        ry="15"
        fill="#234835"
        opacity=".08"
      />
      <path
        d={`M${headX - 44},${headY - 38} Q${headX - 75},${headY + 60} ${headX - 59},${headY + 142} L${headX + 66},${headY + 142} Q${headX + 78},${headY + 50} ${headX + 45},${headY - 38}Z`}
        fill="#2b342b"
      />
      <path
        d={`M${l[0]},${l[1] - 6} Q300,${Math.min(l[1], r[1]) + 12} ${r[0]},${r[1] - 6} L${r[0] - 12},433 Q300,458 ${l[0] + 12},433Z`}
        fill="#fbf1d7"
        stroke="#d8cbaa"
        strokeWidth="2"
      />
      <path d="M215 407 Q300 422 385 407 L397 478 L202 478Z" fill="#245140" />
      <path
        d="M216 413 Q300 427 384 413"
        stroke="#cf6b48"
        strokeWidth="14"
        fill="none"
      />
      <path
        d={`M${headX - 15},${headY + 25} L${headX - 15},${headY + 72} Q${headX},${headY + 87} ${headX + 15},${headY + 72} L${headX + 15},${headY + 25}`}
        fill="#c88b60"
      />
      <ellipse cx={headX} cy={headY} rx="42" ry="52" fill="#d7a276" />
      <path
        d={`M${headX - 43},${headY - 6} Q${headX - 46},${headY - 67} ${headX + 2},${headY - 54} Q${headX + 48},${headY - 57} ${headX + 43},${headY - 3} Q${headX + 17},${headY - 23} ${headX + 7},${headY - 36} Q${headX - 13},${headY - 9} ${headX - 19},${headY - 24}Z`}
        fill="#2b342b"
      />
      <ellipse cx={headX - 16} cy={headY + 3} rx="5" ry="7" fill="#30382c" />
      <ellipse cx={headX + 16} cy={headY + 3} rx="5" ry="7" fill="#30382c" />
      <circle cx={headX - 14} cy={headY + 1} r="1.8" fill="white" />
      <circle cx={headX + 18} cy={headY + 1} r="1.8" fill="white" />
      <path
        d={`M${headX - 19},${headY - 10} q6,-4 12,0 M${headX + 10},${headY - 10} q6,-4 12,0`}
        stroke="#464331"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${headX - 9},${headY + 29} Q${headX},${headY + 37} ${headX + 10},${headY + 27}`}
        stroke="#8c4e3a"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx={headX}
        cy={headY - 48}
        rx="74"
        ry="13"
        fill="#d2b374"
        stroke="#967d48"
        strokeWidth="2"
        transform={`rotate(-8 ${headX} ${headY - 48})`}
      />
      <path
        d={`M${headX - 38},${headY - 54} Q${headX - 39},${headY - 97} ${headX + 7},${headY - 88} Q${headX + 39},${headY - 86} ${headX + 42},${headY - 57}Z`}
        fill="#e3c589"
        stroke="#ad9057"
        strokeWidth="2"
      />
      <path
        d={`M${headX - 38},${headY - 60} Q${headX},${headY - 50} ${headX + 40},${headY - 62}`}
        stroke="#796138"
        strokeWidth="7"
        fill="none"
      />
      <g transform={`translate(${headX + 46} ${headY - 54})`} fill="#d97551">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} rx="8" ry="13" cy="-9" transform={`rotate(${a})`} />
        ))}
        <circle r="5" fill="#f3ca72" />
      </g>
      {[265, 300, 335].map((x, i) => (
        <g key={x} transform={`translate(${x} ${280 + (i % 2) * 12})`}>
          <path
            d="M0 0L0 20M0 14l-8-6M0 19l8-6"
            stroke="#5d8058"
            strokeWidth="2"
          />
          <circle r="7" fill={i === 1 ? "#ce6846" : "#d2ae49"} />
          <circle r="2" fill="#faf0d3" />
        </g>
      ))}
      {/* Stable 2D painter order: sleeves first, then forearms, then both hands.
     Cross-detector z cannot establish which overlapping hand is in front. */}
      {arms.map((b, i) => (
        <g key={i} data-upper-arm={i}>
          <polyline
            points={points([p[b[0]], p[b[1]]])}
            fill="none"
            stroke="#b17c55"
            strokeWidth="27"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={points([p[b[0]], p[b[1]]])}
            fill="none"
            stroke="#d7a276"
            strokeWidth="23"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1={xy(p[b[0]])[0]}
            y1={xy(p[b[0]])[1]}
            x2={xy(p[b[0]])[0] * 0.75 + xy(p[b[1]])[0] * 0.25}
            y2={xy(p[b[0]])[1] * 0.75 + xy(p[b[1]])[1] * 0.25}
            stroke="#f5e9cb"
            strokeWidth="35"
            strokeLinecap="round"
          />
        </g>
      ))}
      {arms.map((b, i) => (
        <g key={i} data-forearm={i}>
          <polyline
            points={points([p[b[1]], p[b[2]]])}
            fill="none"
            stroke="#b17c55"
            strokeWidth="27"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={points([p[b[1]], p[b[2]]])}
            fill="none"
            stroke="#d7a276"
            strokeWidth="23"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {hand(hands[0], "l")}
      {hand(hands[1], "r")}
    </svg>
  );
}
export function LandmarkOverlay({ frame }: { frame?: Frame }) {
  if (!frame || !validAspect(frame.aspect)) return null;
  // Match the video element's centered object-fit:contain rectangle exactly.
  // Mirroring belongs to their shared .camera-feed parent, never to the data.
  const line = (h: Point[], b: number[]) =>
    b.map((i) => `${h[i].x * 100 * frame.aspect},${h[i].y * 100}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${100 * frame.aspect} 100`}
      preserveAspectRatio="xMidYMid meet"
      className="landmarks lsc-landmarks"
      aria-hidden="true"
    >
      {[frame.l, frame.r].map(
        (h, i) =>
          validHand(h) &&
          h.every(
            (p) =>
              Number.isFinite(p.x * 100 * frame.aspect) &&
              Number.isFinite(p.y * 100),
          ) && (
            <g key={i}>
              {bones.map((b, j) => (
                <polyline
                  key={j}
                  points={line(h, b)}
                  fill="none"
                  stroke="#c8eb7c"
                  strokeWidth=".3"
                />
              ))}
              {h.map((p, j) => (
                <circle
                  key={j}
                  cx={p.x * 100 * frame.aspect}
                  cy={p.y * 100}
                  r=".45"
                  fill="#fff4c6"
                />
              ))}
            </g>
          ),
      )}
    </svg>
  );
}
