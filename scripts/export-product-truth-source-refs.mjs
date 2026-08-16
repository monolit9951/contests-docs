#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_TRUTH_PATH = fileURLToPath(new URL("../data/product-truth.json", import.meta.url));
const SOURCE_CONTRACT = Object.freeze({
  backend: Object.freeze({
    repository: "monolit9951/Contests",
    branch: "release",
    output: "backend_sha",
  }),
  truthPack: Object.freeze({
    repository: "monolit9951/darebay-seo-fleet",
    branch: "master",
    output: "truth_pack_sha",
  }),
});

export function reviewedSourceRefs(truth) {
  if (truth?.schemaVersion !== 2) {
    throw new Error(`product truth schemaVersion must be 2, got ${JSON.stringify(truth?.schemaVersion)}`);
  }

  const refs = {};
  for (const [name, expected] of Object.entries(SOURCE_CONTRACT)) {
    const source = truth.source?.[name];
    if (source?.repository !== expected.repository) {
      throw new Error(`source.${name}.repository must be ${expected.repository}`);
    }
    if (source?.branch !== expected.branch) {
      throw new Error(`source.${name}.branch must be ${expected.branch}`);
    }
    if (!/^[a-f0-9]{40}$/.test(source?.verifiedCommit || "")) {
      throw new Error(`source.${name}.verifiedCommit must be a full lowercase git SHA`);
    }
    refs[expected.output] = source.verifiedCommit;
  }
  return refs;
}

export function exportReviewedSourceRefs({
  truthPath = DEFAULT_TRUTH_PATH,
  outputPath = process.env.GITHUB_OUTPUT,
} = {}) {
  if (!outputPath) throw new Error("GITHUB_OUTPUT is required");
  const truth = JSON.parse(readFileSync(truthPath, "utf8"));
  const refs = reviewedSourceRefs(truth);
  const lines = Object.entries(refs).map(([name, sha]) => `${name}=${sha}`).join("\n");
  appendFileSync(outputPath, `${lines}\n`, { encoding: "utf8" });
  return refs;
}

function runCli() {
  const truthIndex = process.argv.indexOf("--truth");
  const truthPath = truthIndex >= 0 ? resolve(process.argv[truthIndex + 1]) : DEFAULT_TRUTH_PATH;
  exportReviewedSourceRefs({ truthPath });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runCli();
