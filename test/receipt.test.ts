import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { createReceipt, signReceipt, verifyReceipt, verifyReceiptSignature } from "../src/receipt.js";
import type { Ledger } from "../src/types.js";

function ledger(): Ledger {
  const base: Ledger = {
    runId: "run-receipt",
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(1).toISOString(),
    cwd: process.cwd(),
    command: ["node", "-e", "console.log('ok')"],
    exitCode: 0,
    transcript: "ok\n",
    transcriptHash: "ignored",
    commands: [{ id: "cmd-001", argv: ["node", "-e", "console.log('ok')"], cwd: process.cwd(), startedAt: new Date(0).toISOString(), endedAt: new Date(1).toISOString(), durationMs: 1, exitCode: 0, actuallyRan: true, outputHash: "output", sensitive: false }],
    mutations: [],
    tests: [],
    gitOperations: [],
    before: { capturedAt: new Date(0).toISOString(), trackedHash: "before", files: {} },
    after: { capturedAt: new Date(1).toISOString(), trackedHash: "after", files: {} },
    chain: [],
  };
  let previous = "0".repeat(64);
  const records = [...base.commands.map((record) => JSON.stringify(record)), ...base.mutations.map((record) => JSON.stringify(record)), JSON.stringify({ transcriptHash: createHash("sha256").update(base.transcript).digest("hex") })];
  base.chain = records.map((record) => {
    previous = createHash("sha256").update(`${previous}:${record}`).digest("hex");
    return previous;
  });
  return base;
}

test("validates the hash chain and detects tampering", () => {
  const receipt = createReceipt(ledger(), [], [], false);
  assert.equal(verifyReceipt(receipt).valid, true);
  receipt.ledger.transcript = "tampered";
  assert.equal(verifyReceipt(receipt).valid, false);
});

test("signs and verifies a receipt with Ed25519", () => {
  const keys = generateKeyPairSync("ed25519");
  const privatePem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const receipt = signReceipt(createReceipt(ledger(), [], [], false), privatePem);
  assert.equal(verifyReceiptSignature(receipt), true);
  assert.equal(verifyReceipt(receipt).valid, true);
});
