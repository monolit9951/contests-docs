import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  exportReviewedSourceRefs,
  reviewedSourceRefs,
} from "./export-product-truth-source-refs.mjs";

const truthPath = new URL("../data/product-truth.json", import.meta.url);
const exporterPath = new URL("./export-product-truth-source-refs.mjs", import.meta.url);
const truth = JSON.parse(readFileSync(truthPath, "utf8"));

describe("reviewed product-truth source ref exporter", () => {
  it("exports only the two immutable SHAs from the reviewed schema", () => {
    expect(reviewedSourceRefs(truth)).toEqual({
      backend_sha: truth.source.backend.verifiedCommit,
      truth_pack_sha: truth.source.truthPack.verifiedCommit,
    });
  });

  it.each([
    ["schema version", (value) => { value.schemaVersion = 3; }, /schemaVersion must be 2/],
    ["backend repository", (value) => { value.source.backend.repository = "attacker/Contests"; }, /source\.backend\.repository/],
    ["backend branch", (value) => { value.source.backend.branch = "main"; }, /source\.backend\.branch/],
    ["truth-pack repository", (value) => { value.source.truthPack.repository = "attacker/darebay-seo-fleet"; }, /source\.truthPack\.repository/],
    ["truth-pack branch", (value) => { value.source.truthPack.branch = "release"; }, /source\.truthPack\.branch/],
    ["movable ref", (value) => { value.source.backend.verifiedCommit = "release"; }, /full lowercase git SHA/],
    ["uppercase SHA", (value) => { value.source.backend.verifiedCommit = "A".repeat(40); }, /full lowercase git SHA/],
  ])("rejects a changed %s", (_label, mutate, expected) => {
    const changed = structuredClone(truth);
    mutate(changed);
    expect(() => reviewedSourceRefs(changed)).toThrow(expected);
  });

  it("appends GitHub outputs with fixed names and no branch aliases", () => {
    const fixture = mkdtempSync(join(tmpdir(), "product-truth-refs-"));
    const outputPath = join(fixture, "github-output");
    try {
      exportReviewedSourceRefs({ truthPath, outputPath });
      expect(readFileSync(outputPath, "utf8")).toBe([
        `backend_sha=${truth.source.backend.verifiedCommit}`,
        `truth_pack_sha=${truth.source.truthPack.verifiedCommit}`,
        "",
      ].join("\n"));
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("runs before npm install using only Node built-ins", () => {
    const fixture = mkdtempSync(join(tmpdir(), "product-truth-refs-cli-"));
    const outputPath = join(fixture, "github-output");
    try {
      execFileSync(process.execPath, [exporterPath.pathname], {
        env: { ...process.env, GITHUB_OUTPUT: outputPath },
        stdio: "pipe",
      });
      expect(readFileSync(outputPath, "utf8")).toContain(`backend_sha=${truth.source.backend.verifiedCommit}\n`);
      expect(readFileSync(outputPath, "utf8")).toContain(`truth_pack_sha=${truth.source.truthPack.verifiedCommit}\n`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
