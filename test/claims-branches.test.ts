import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateClaims, extractClaims, hasTestClaim } from "../src/claims.js";
import { makeClaim, makeLedger } from "./helpers.js";

test("extracts supported claim kinds and ignores headings, commands, and short lines", () => {
  const claims = extractClaims([
    "# Final report",
    "$ npm test",
    "Fixed src/http.ts retry handling",
    "Updated tests/http.test.ts",
    "All 12 tests pass",
    "Coverage is 84%",
    "The API is backwards compatible",
    "This is more maintainable",
  ].join("\n"));
  assert.deepEqual(claims.map((claim) => claim.kind), ["file", "file", "test", "coverage", "compatibility"]);
  assert.equal(hasTestClaim(claims), true);
});

test("proves a full unfiltered test claim", () => {
  const claim = makeClaim({ text: "All 2 tests pass", kind: "test" });
  const result = adjudicateClaims([claim], makeLedger({ tests: [{ framework: "node", source: "node", passed: 2, failed: 0, skipped: 0, errors: 0, total: 2 }] }))[0];
  assert.equal(result?.verdict, "PROVEN");
  assert.match(result?.reason ?? "", /all 2 tests/i);
});

test("contradicts a failed test claim and a mismatched numeric claim", () => {
  const failed = adjudicateClaims([makeClaim({ text: "All tests pass", kind: "test" })], makeLedger({ exitCode: 1, tests: [{ framework: "node", source: "node", passed: 1, failed: 1, skipped: 0, errors: 0, total: 2 }] }))[0];
  const mismatch = adjudicateClaims([makeClaim({ text: "5 tests pass", kind: "test" })], makeLedger({ tests: [{ framework: "node", source: "node", passed: 2, failed: 0, skipped: 0, errors: 0, total: 2 }] }))[0];
  assert.equal(failed?.verdict, "CONTRADICTED");
  assert.equal(mismatch?.verdict, "CONTRADICTED");
});

test("handles partial test evidence, missing evidence, and compatibility claims", () => {
  const partial = adjudicateClaims([makeClaim({ text: "2 tests pass", kind: "test" })], makeLedger({ tests: [{ framework: "node", source: "node", passed: 2, failed: 0, skipped: 1, errors: 0, total: 3 }] }))[0];
  const missing = adjudicateClaims([makeClaim({ text: "All tests pass", kind: "test" })], makeLedger())[0];
  const compatibility = adjudicateClaims([makeClaim({ text: "The API is backwards compatible", kind: "compatibility" })], makeLedger())[0];
  assert.equal(partial?.verdict, "PROVEN");
  assert.equal(missing?.verdict, "UNPROVEN");
  assert.equal(compatibility?.verdict, "UNVERIFIABLE");
});

test("uses file mutations and command completion as evidence", () => {
  const mutation = { path: "src/http.ts", status: "modified" as const, beforeHash: "before", afterHash: "after", outsideGit: false };
  const provenFile = adjudicateClaims([makeClaim({ text: "Fixed src/http.ts", kind: "file" })], makeLedger({ mutations: [mutation] }))[0];
  const missingFile = adjudicateClaims([makeClaim({ text: "Fixed src/missing.ts", kind: "file" })], makeLedger())[0];
  const generic = adjudicateClaims([makeClaim({ text: "Implemented the retry change", kind: "change" })], makeLedger())[0];
  const failedGeneric = adjudicateClaims([makeClaim({ text: "Implemented the retry change", kind: "change" })], makeLedger({ exitCode: 2 }))[0];
  assert.equal(provenFile?.verdict, "PROVEN");
  assert.equal(missingFile?.verdict, "CONTRADICTED");
  assert.equal(generic?.verdict, "PROVEN");
  assert.equal(failedGeneric?.verdict, "UNPROVEN");
});
