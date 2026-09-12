import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync("public/assets-manifest.json", "utf8"),
);
for (const [path, expected] of Object.entries(manifest)) {
  const data = readFileSync("public/" + path);
  const actual = createHash("sha256").update(data).digest("hex");
  if (actual !== expected) throw new Error(`Asset checksum mismatch: ${path}`);
}
const lessons = [
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
];
for (const id of lessons) {
  const ref = JSON.parse(readFileSync(`public/references/${id}.json`));
  if (ref.id !== id || ref.fps !== 24 || ref.frames.length < 10)
    throw new Error(`Invalid reference ${id}`);
  for (const frame of ref.frames) {
    if (!Number.isFinite(frame.t) || frame.aspect <= 0)
      throw new Error(`Invalid timing/aspect ${id}`);
    for (const [key, count] of [
      ["p", 33],
      ["l", 21],
      ["r", 21],
    ]) {
      if (
        frame[key].length !== count ||
        frame[key].some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
      )
        throw new Error(`Invalid ${key} coordinates ${id}`);
    }
  }
}
console.log(
  `${Object.keys(manifest).length} local assets verified by SHA-256; 10 references validated.`,
);
