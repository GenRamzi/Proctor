import { createHash } from "node:crypto";
import type { Claim, Ledger } from "../src/types.js";

export function makeLedger(overrides: Partial<Ledger> = {}): Ledger {
  const startedAt = new Date(0).toISOString();
  const endedAt = new Date(1).toISOString();
  const command = ["node", "-e", "console.log('ok')"];
  const base: Ledger = {
    runId: "run-test",
    startedAt,
    endedAt,
    cwd: process.cwd(),
    command,
    exitCode: 0,
    transcript: "ok\n",
    transcriptHash: createHash("sha256").update("ok\n").digest("hex"),
    commands: [{
      id: "cmd-001",
      argv: command,
      cwd: process.cwd(),
      startedAt,
      endedAt,
      durationMs: 1,
      exitCode: 0,
      actuallyRan: true,
      outputHash: "output",
      sensitive: false,
    }],
    mutations: [],
    tests: [],
    gitOperations: [],
    before: { capturedAt: startedAt, trackedHash: "before", files: {}, contents: {} },
    after: { capturedAt: endedAt, trackedHash: "after", files: {}, contents: {} },
    chain: [],
  };
  return { ...base, ...overrides };
}

export function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-001",
    text: "Implemented the change",
    kind: "change",
    verdict: "UNPROVEN",
    evidence: [],
    reason: "No adjudication has run yet.",
    ...overrides,
  };
}
