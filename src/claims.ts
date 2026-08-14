import type { Claim, EvidenceRef, Ledger } from "./types.js";

const TEST_CLAIM = /\b(?:all\s+)?(?:the\s+)?(?:\d+\s+)?tests?\s+(?:pass|passed|are\s+passing)|\b(?:full\s+)?(?:test\s+)?suite\s+(?:pass|passed|is\s+green|passes)\b/i;
const FILE_CLAIM = /\b(?:added|changed|modified|updated|created|deleted|removed|implemented|fixed)\b[^\n]*?((?:src|lib|test|tests|app|packages?)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+)/i;
const CHANGE_CLAIM = /\b(?:fixed|implemented|added|removed|refactored|resolved|changed)\b/i;
const COMPATIBILITY_CLAIM = /\b(?:backwards?|backward|api)\s+compatib|\bcompatible\s+with\s+existing/i;
const COVERAGE_CLAIM = /\b(?:coverage|covered)\b[^\n]*?\b(\d+(?:\.\d+)?)%?/i;

function evidence(kind: EvidenceRef["kind"], label: string, detail: string, id: string, hash?: string): EvidenceRef {
  return { id, kind, label, detail, ...(hash ? { hash } : {}) };
}

export function extractClaims(text: string): Claim[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const claims: Claim[] = [];
  let index = 0;
  for (const line of lines) {
    const normalized = line.replace(/^[\s>*-]+/, "").trim();
    if (normalized.length < 8 || normalized.startsWith("$") || normalized.startsWith("#")) continue;
    let kind: Claim["kind"] | undefined;
    if (TEST_CLAIM.test(normalized)) kind = "test";
    else if (FILE_CLAIM.test(normalized)) kind = "file";
    else if (COVERAGE_CLAIM.test(normalized)) kind = "coverage";
    else if (COMPATIBILITY_CLAIM.test(normalized)) kind = "compatibility";
    else if (CHANGE_CLAIM.test(normalized) && /\b(?:fix|implement|add|remove|refactor|change)/i.test(normalized)) kind = "change";
    if (!kind) continue;
    index += 1;
    claims.push({ id: `claim-${String(index).padStart(3, "0")}`, text: normalized, kind, verdict: "UNPROVEN", evidence: [], reason: "No adjudication has run yet." });
  }
  return claims;
}

function testEvidence(ledger: Ledger): EvidenceRef[] {
  return ledger.tests.map((test, index) => evidence("test", `${test.framework} result`, `${test.passed} passed, ${test.failed} failed, ${test.skipped} skipped, ${test.total} total${test.filter ? `; filter: ${test.filter}` : ""}`, `test-${index + 1}`, test.rawHash));
}

function adjudicateTest(claim: Claim, ledger: Ledger): Claim {
  const tests = ledger.tests;
  const evidenceRefs = testEvidence(ledger);
  const fullClaim = /\b(?:all|full|entire|complete)\b|\bsuite\b/i.test(claim.text);
  const numberClaim = claim.text.match(/\b(\d+)\s+tests?/i)?.[1];
  const total = tests.reduce((sum, item) => sum + item.total, 0);
  const passed = tests.reduce((sum, item) => sum + item.passed, 0);
  const failures = tests.reduce((sum, item) => sum + item.failed + item.errors, 0);
  const filtered = tests.some((test) => Boolean(test.filter));
  if (!tests.length) return { ...claim, verdict: "UNPROVEN", evidence: [], reason: "No structured test result was captured in this session." };
  if (failures > 0 || ledger.exitCode !== 0) return { ...claim, verdict: "CONTRADICTED", evidence: evidenceRefs, reason: `The captured verification contains ${failures} failed or errored tests, or the command exited with ${ledger.exitCode}.` };
  if (fullClaim && filtered) return { ...claim, verdict: "CONTRADICTED", evidence: evidenceRefs, reason: "A filter was captured, so the evidence does not support a full-suite claim." };
  if (numberClaim && Number(numberClaim) !== passed && Number(numberClaim) !== total) return { ...claim, verdict: "CONTRADICTED", evidence: evidenceRefs, reason: `The claim names ${numberClaim} tests, while the ledger captured ${passed} passed tests and ${total} total tests.` };
  if (fullClaim && passed === total && total > 0) return { ...claim, verdict: "PROVEN", evidence: evidenceRefs, reason: `The ledger captured all ${total} tests passing without a filter.` };
  if (passed > 0 && failures === 0) return { ...claim, verdict: "PROVEN", evidence: evidenceRefs, reason: `The ledger captured ${passed} passing tests.` };
  return { ...claim, verdict: "UNPROVEN", evidence: evidenceRefs, reason: "The available test evidence is incomplete for this claim." };
}

export function adjudicateClaims(claims: Claim[], ledger: Ledger): Claim[] {
  return claims.map((claim) => {
    if (claim.kind === "test" || claim.kind === "coverage") return adjudicateTest(claim, ledger);
    if (claim.kind === "compatibility") return { ...claim, verdict: "UNVERIFIABLE", evidence: [], reason: "Compatibility is a qualitative claim that this execution ledger cannot settle by itself." };
    const path = claim.text.match(FILE_CLAIM)?.[1];
    if (path) {
      const mutation = ledger.mutations.find((item) => item.path === path || item.path.endsWith(path));
      if (mutation) {
        return { ...claim, verdict: "PROVEN", evidence: [evidence("file", mutation.path, `${mutation.status} file with before/after content hashes`, `file-${mutation.path}`, mutation.afterHash ?? mutation.beforeHash)], reason: `The ledger captured a ${mutation.status} mutation for ${mutation.path}.` };
      }
      return { ...claim, verdict: "CONTRADICTED", evidence: [], reason: `No mutation for ${path} was captured in the session.` };
    }
    const commandEvidence = ledger.commands.map((command) => evidence("command", command.argv.join(" "), `Executed with exit code ${command.exitCode}`, command.id, command.outputHash));
    if (commandEvidence.length && ledger.exitCode === 0) return { ...claim, verdict: "PROVEN", evidence: commandEvidence, reason: "The wrapped command completed successfully, but this is not a correctness proof." };
    return { ...claim, verdict: "UNPROVEN", evidence: commandEvidence, reason: "The ledger contains no direct evidence for this claim." };
  });
}

export function hasTestClaim(claims: Claim[]): boolean {
  return claims.some((claim) => claim.kind === "test" || claim.kind === "coverage");
}
