import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "../src/ledger.js";
import { calculateIntegrity, createReceipt, readReceipt, signReceipt, verifyReceipt, verifyReceiptChain, verifyReceiptSignature, writeReceipt } from "../src/receipt.js";
import type { Receipt } from "../src/types.js";
import { makeClaim, makeLedger } from "./helpers.js";

function withChain(receipt: Receipt): Receipt {
  const records = [
    ...receipt.ledger.commands.map((record) => JSON.stringify(record)),
    ...receipt.ledger.mutations.map((record) => JSON.stringify(record)),
    JSON.stringify({ transcriptHash: sha256(receipt.ledger.transcript) }),
  ];
  let previous = "0".repeat(64);
  receipt.ledger.chain = records.map((record) => {
    previous = sha256(`${previous}:${record}`);
    return previous;
  });
  return receipt;
}

test("applies strict and severity deductions and clamps failed scores", () => {
  const ledger = makeLedger({ exitCode: 3 });
  const claims = [makeClaim({ verdict: "CONTRADICTED" }), makeClaim({ id: "claim-002", verdict: "UNPROVEN" })];
  const findings = [
    { id: "GW-1", title: "critical", severity: "critical" as const, message: "critical", evidence: [] },
    { id: "GW-2", title: "critical", severity: "critical" as const, message: "critical", evidence: [] },
    { id: "GW-3", title: "critical", severity: "critical" as const, message: "critical", evidence: [] },
    { id: "GW-4", title: "critical", severity: "critical" as const, message: "critical", evidence: [] },
    { id: "GW-5", title: "high", severity: "high" as const, message: "high", evidence: [] },
    { id: "GW-6", title: "medium", severity: "medium" as const, message: "medium", evidence: [] },
  ];
  const strict = calculateIntegrity(claims, findings, ledger, true);
  const advisory = calculateIntegrity(claims, findings, ledger, false);
  assert.equal(strict.score, 0);
  assert.equal(strict.label, "failed");
  assert.ok(strict.deductions.some((item) => /strict mode/.test(item.reason)));
  assert.equal(advisory.deductions.some((item) => /strict mode/.test(item.reason)), false);
});

test("creates a receipt without persisting ephemeral snapshot contents", () => {
  const ledger = makeLedger({
    before: { capturedAt: new Date(0).toISOString(), trackedHash: "before", files: {}, contents: { "secret.txt": "do not persist" } },
    after: { capturedAt: new Date(1).toISOString(), trackedHash: "after", files: {}, contents: { "secret.txt": "do not persist" } },
  });
  const receipt = createReceipt(ledger, [], [], false);
  assert.equal("contents" in receipt.ledger.before, false);
  assert.equal("contents" in receipt.ledger.after, false);
});

test("writes and reads receipts and rejects invalid schema or tool metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "proctor-receipt-"));
  const path = join(directory, "nested", "receipt.json");
  const receipt = withChain(createReceipt(makeLedger(), [], [], false));
  writeReceipt(receipt, path);
  assert.equal(readReceipt(path).runId, receipt.runId);
  const invalidSchema = JSON.parse(readFileSync(path, "utf8")) as Receipt;
  invalidSchema.schemaVersion = 999;
  writeFileSync(path, JSON.stringify(invalidSchema), "utf8");
  assert.throws(() => readReceipt(path), /Unsupported receipt schema/);
  invalidSchema.schemaVersion = 1;
  invalidSchema.tool = { name: "not-proctor" as "proctor", version: "0.0.0" };
  writeFileSync(path, JSON.stringify(invalidSchema), "utf8");
  assert.throws(() => readReceipt(path), /not a Proctor receipt/);
});

test("reports hash-chain length and record mismatches", () => {
  const receipt = withChain(createReceipt(makeLedger(), [], [], false));
  receipt.ledger.chain.pop();
  assert.equal(verifyReceiptChain(receipt).valid, false);
  assert.match(verifyReceiptChain(receipt).reason ?? "", /length/);
  const valid = withChain(createReceipt(makeLedger(), [], [], false));
  valid.ledger.chain[0] = "x".repeat(64);
  assert.equal(verifyReceipt(valid).valid, false);
  assert.match(verifyReceipt(valid).reasons[0] ?? "", /mismatch/);
});

test("detects signature tampering and reports unsigned receipts", () => {
  const keys = generateKeyPairSync("ed25519");
  const privatePem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const signed = signReceipt(withChain(createReceipt(makeLedger(), [], [], false)), privatePem);
  assert.equal(verifyReceiptSignature(signed), true);
  signed.claims.push(makeClaim({ id: "claim-002" }));
  assert.equal(verifyReceiptSignature(signed), false);
  assert.equal(verifyReceiptSignature(createReceipt(makeLedger(), [], [], false)), false);
  assert.equal(verifyReceipt(signed).valid, false);
});
