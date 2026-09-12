import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { evaluate } = await server.ssrLoadModule("/src/scoring.ts");
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const ids = [
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
  const refs = Object.fromEntries(
    ids.map((id) => [id, read(`public/references/${id}.json`).frames]),
  );
  const summarize = (x) => ({
    ok: x.ok,
    score: x.score,
    metrics: x.metrics,
    coverage: x.coverage,
    feedback: x.feedback,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    kind: "Diagnostic fixtures, not learner validation",
    sameReference: Object.fromEntries(
      ids.map((id) => [id, summarize(evaluate(refs[id], refs[id]))]),
    ),
    crossSign: Object.fromEntries(
      ids.map((id) => [
        id,
        Object.fromEntries(
          ids.map((other) => [
            other,
            summarize(evaluate(refs[id], refs[other])),
          ]),
        ),
      ]),
    ),
    heldOut: Object.fromEntries(
      ["0000", "0030"].map((id) => [
        id,
        summarize(
          evaluate(refs[id], read(`verification/heldout-${id}.json`).frames),
        ),
      ]),
    ),
    browserReextraction: summarize(
      evaluate(
        refs["0000"],
        read("verification/reextracted-gracias.json").frames,
      ),
    ),
  };
  writeFileSync(
    "verification/evaluation-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        self: Object.fromEntries(
          ids.map((id) => [id, report.sameReference[id].score]),
        ),
        heldOut: report.heldOut,
        browserReextraction: report.browserReextraction,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
