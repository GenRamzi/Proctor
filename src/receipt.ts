import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RECEIPT_SCHEMA_VERSION, type Claim, type Finding, type IntegrityScore, type Ledger, type Receipt, type Snapshot } from "./types.js";
import { sha256 } from "./ledger.js";
import { VERSION } from "./version.js";

export function calculateIntegrity(claims: Claim[], findings: Finding[], ledger: Ledger, strict = false): IntegrityScore {
  const deductions: IntegrityScore["deductions"] = [];
  const contradicted = claims.filter((claim) => claim.verdict === "CONTRADICTED").length;
  const unproven = claims.filter((claim) => claim.verdict === "UNPROVEN").length;
  const critical = findings.filter((item) => item.severity === "critical").length;
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  if (contradicted) deductions.push({ reason: `${contradicted} contradicted claim${contradicted === 1 ? "" : "s"}`, points: contradicted * 25 });
  if (unproven && strict) deductions.push({ reason: `${unproven} unproven claim${unproven === 1 ? "" : "s"} in strict mode`, points: unproven * 8 });
  if (critical) deductions.push({ reason: `${critical} critical finding${critical === 1 ? "" : "s"}`, points: critical * 25 });
  if (high) deductions.push({ reason: `${high} high-severity finding${high === 1 ? "" : "s"}`, points: high * 12 });
  if (medium) deductions.push({ reason: `${medium} medium-severity finding${medium === 1 ? "" : "s"}`, points: medium * 5 });
  if (ledger.exitCode !== 0) deductions.push({ reason: `Wrapped command exited with ${ledger.exitCode}`, points: 20 });
  const score = Math.max(0, Math.min(100, 100 - deductions.reduce((sum, item) => sum + item.points, 0)));
  const label: IntegrityScore["label"] = score >= 85 ? "strong" : score >= 65 ? "caution" : score >= 40 ? "weak" : "failed";
  return { score, label, deductions };
}

function unsignedPayload(receipt: Receipt): string {
  const unsigned = { ...receipt };
  delete unsigned.signed;
  return JSON.stringify(unsigned);
}

function publicSnapshot(snapshot: Snapshot): Snapshot {
  const copy = { ...snapshot };
  delete copy.contents;
  return copy;
}

export function createReceipt(ledger: Ledger, claims: Claim[], findings: Finding[], strict = false): Receipt {
  const integrity = calculateIntegrity(claims, findings, ledger, strict);
  const persistedLedger: Ledger = { ...ledger, before: publicSnapshot(ledger.before), after: publicSnapshot(ledger.after) };
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    tool: { name: "proctor", version: VERSION },
    runId: ledger.runId,
    createdAt: new Date().toISOString(),
    cwd: ledger.cwd,
    command: ledger.command,
    ledger: persistedLedger,
    claims,
    findings,
    integrity,
    status: integrity.score < 65 || claims.some((claim) => claim.verdict === "CONTRADICTED") ? "FAILED" : "PASSED",
  };
}

export function writeReceipt(receipt: Receipt, path: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

export function readReceipt(path: string): Receipt {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Receipt;
  if (parsed.schemaVersion !== RECEIPT_SCHEMA_VERSION) throw new Error(`Unsupported receipt schema version: ${parsed.schemaVersion}`);
  if (parsed.tool?.name !== "proctor") throw new Error("This file is not a Proctor receipt.");
  return parsed;
}

export function signReceipt(receipt: Receipt, privateKeyPem: string): Receipt {
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
  const signature = sign(null, Buffer.from(unsignedPayload(receipt)), privateKey).toString("base64");
  return { ...receipt, signed: { algorithm: "Ed25519", publicKey, signature } };
}

export function verifyReceiptSignature(receipt: Receipt): boolean {
  if (!receipt.signed) return false;
  const publicKey = createPublicKey({ key: Buffer.from(receipt.signed.publicKey, "base64"), type: "spki", format: "der" });
  return verify(null, Buffer.from(unsignedPayload(receipt)), publicKey, Buffer.from(receipt.signed.signature, "base64"));
}

export function verifyReceiptChain(receipt: Receipt): { valid: boolean; reason?: string } {
  let previous = "0".repeat(64);
  const records = [
    ...receipt.ledger.commands.map((record) => JSON.stringify(record)),
    ...receipt.ledger.mutations.map((record) => JSON.stringify(record)),
    JSON.stringify({ transcriptHash: sha256(receipt.ledger.transcript) }),
  ];
  if (records.length !== receipt.ledger.chain.length) return { valid: false, reason: "Ledger chain length does not match its records." };
  for (const [index, record] of records.entries()) {
    previous = sha256(`${previous}:${record}`);
    if (previous !== receipt.ledger.chain[index]) return { valid: false, reason: `Ledger chain mismatch at record ${index + 1}.` };
  }
  return { valid: true };
}

export function verifyReceipt(receipt: Receipt): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const chain = verifyReceiptChain(receipt);
  if (!chain.valid && chain.reason) reasons.push(chain.reason);
  if (receipt.signed && !verifyReceiptSignature(receipt)) reasons.push("Ed25519 signature verification failed.");
  return { valid: reasons.length === 0, reasons };
}
