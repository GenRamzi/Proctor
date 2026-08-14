#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runLedger } from "./ledger.js";
import { adjudicateClaims, extractClaims } from "./claims.js";
import { parseTestOutput } from "./parsers.js";
import { detectFindings } from "./rules.js";
import { createReceipt, readReceipt, signReceipt, verifyReceipt, writeReceipt } from "./receipt.js";
import type { Receipt } from "./types.js";
import { VERSION } from "./version.js";

const HELP = `Proctor ${VERSION}

Your agent said the tests pass. Proctor checks.

Usage:
  proctor run -- <agent-command> [args...]
  proctor verify [receipt.json] [--json] [--strict]
  proctor gate [receipt.json] [--strict]
  proctor inspect <receipt.json>
  proctor badge [receipt.json] [--output integrity.svg]

Run options:
  --cwd <path>             Working directory for the wrapped command
  --receipt-dir <path>     Receipt directory (default: .proctor)
  --claims <text>          Agent final report or claims to adjudicate
  --claims-file <path>     Read the agent final report from a file
  --sign-key <path>        Sign the receipt with an Ed25519 PEM private key
  --ignore <path>          Use a custom ignore file

Verify options:
  --json                   Print machine-readable JSON
  --strict                 Fail on unproven claims as well as contradictions
`;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args: string[], name: string): boolean {
  return args.includes(name);
}

function latestReceipt(cwd: string): string {
  const directory = join(cwd, ".proctor");
  if (!existsSync(directory)) throw new Error("No .proctor directory found. Run `proctor run -- <command>` first.");
  const candidates = readdirSync(directory).filter((name) => name.endsWith(".receipt.json")).sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error("No receipt found. Run `proctor run -- <command>` first.");
  return join(directory, latest);
}

function receiptPath(args: string[], cwd: string): string {
  const candidate = args.find((arg) => arg.endsWith(".receipt.json") || arg.endsWith(".json"));
  return resolve(cwd, candidate ?? latestReceipt(cwd));
}

function formatVerdict(verdict: string): string {
  return verdict === "PROVEN" ? "✔" : verdict === "CONTRADICTED" ? "✖" : "?";
}

function report(receipt: Receipt): string {
  const lines: string[] = [];
  const contradicted = receipt.claims.filter((claim) => claim.verdict === "CONTRADICTED").length;
  lines.push(`VERDICT: ${receipt.status} — ${contradicted} contradicted claim${contradicted === 1 ? "" : "s"}, ${receipt.findings.length} green-wash finding${receipt.findings.length === 1 ? "" : "s"}  Integrity ${receipt.integrity.score}/100`);
  lines.push("");
  lines.push("CLAIMS");
  for (const claim of receipt.claims) {
    lines.push(`  ${formatVerdict(claim.verdict)} "${claim.text}"  ${claim.verdict}`);
    lines.push(`      ${claim.reason}`);
    for (const item of claim.evidence.slice(0, 3)) lines.push(`      evidence: ${item.label} — ${item.detail}`);
  }
  if (!receipt.claims.length) lines.push("  No atomic claims were detected. Pass --claims or --claims-file with the agent report.");
  lines.push("");
  lines.push("GREEN-WASH FINDINGS");
  if (!receipt.findings.length) lines.push("  None detected by the deterministic rules.");
  for (const item of receipt.findings) lines.push(`  ${item.id} ${item.title.padEnd(18)} ${item.path ?? "transcript"}${item.line ? `:${item.line}` : ""} — ${item.message}`);
  lines.push("");
  lines.push(`COMMAND: ${receipt.command.join(" ")}`);
  lines.push(`RECEIPT: ${receipt.runId}.receipt.json${receipt.signed ? " (signed)" : ""}`);
  lines.push(`INTEGRITY: ${receipt.integrity.label.toUpperCase()} — ${receipt.integrity.deductions.length ? receipt.integrity.deductions.map((item) => `-${item.points} ${item.reason}`).join("; ") : "no deductions"}`);
  return lines.join("\n");
}

async function runCommand(args: string[]): Promise<number> {
  const separator = args.indexOf("--");
  if (separator < 0 || !args[separator + 1]) throw new Error("Usage: proctor run -- <agent-command> [args...]");
  const cwd = resolve(flag(args, "--cwd") ?? process.cwd());
  const receiptDir = resolve(cwd, flag(args, "--receipt-dir") ?? ".proctor");
  const claimsFile = flag(args, "--claims-file");
  const explicitClaims = flag(args, "--claims");
  const ledger = await runLedger(args.slice(separator + 1), { cwd, receiptDir, ignorePath: flag(args, "--ignore") });
  ledger.tests = parseTestOutput(ledger.transcript);
  const source = explicitClaims ?? (claimsFile ? readFileSync(resolve(cwd, claimsFile), "utf8") : ledger.transcript);
  const claims = adjudicateClaims(extractClaims(source), ledger);
  const findings = detectFindings(ledger, claims);
  let receipt = createReceipt(ledger, claims, findings, has(args, "--strict"));
  const signKey = flag(args, "--sign-key");
  if (signKey) receipt = signReceipt(receipt, readFileSync(resolve(cwd, signKey), "utf8"));
  const outputPath = join(receiptDir, `${ledger.runId}.receipt.json`);
  writeReceipt(receipt, outputPath);
  console.log(`\nreceipt: ${outputPath}`);
  console.log(report(receipt));
  return receipt.status === "FAILED" ? 1 : 0;
}

function verifyCommand(args: string[], mode: "verify" | "gate"): number {
  const cwd = process.cwd();
  const path = receiptPath(args, cwd);
  const receipt = readReceipt(path);
  const integrity = verifyReceipt(receipt);
  const strict = has(args, "--strict");
  const policyFailure = receipt.status === "FAILED" || receipt.claims.some((claim) => claim.verdict === "CONTRADICTED") || (strict && receipt.claims.some((claim) => claim.verdict === "UNPROVEN"));
  if (has(args, "--json")) {
    console.log(JSON.stringify({ path, receipt, verification: integrity, policyFailure }, null, 2));
  } else {
    console.log(report(receipt));
    console.log(`\nRECEIPT INTEGRITY: ${integrity.valid ? "VALID" : "INVALID"}${integrity.reasons.length ? ` — ${integrity.reasons.join("; ")}` : ""}`);
  }
  return !integrity.valid || (mode === "gate" && policyFailure) || (mode === "verify" && policyFailure) ? 1 : 0;
}

function inspectCommand(args: string[]): number {
  const receipt = readReceipt(receiptPath(args, process.cwd()));
  console.log(JSON.stringify(receipt, null, 2));
  return 0;
}

function badgeCommand(args: string[]): number {
  const cwd = process.cwd();
  const receiptFile = receiptPath(args, cwd);
  const receipt = readReceipt(receiptFile);
  const score = receipt.integrity.score;
  const color = score >= 85 ? "#2da44e" : score >= 65 ? "#bf8700" : score >= 40 ? "#d29922" : "#cf222e";
  const output = resolve(cwd, flag(args, "--output") ?? join(resolve(receiptFile, ".."), "integrity.svg"));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="20" role="img" aria-label="Proctor integrity ${score} out of 100"><title>Proctor integrity: ${score}/100</title><rect width="190" height="20" fill="#555"/><rect x="92" width="98" height="20" fill="${color}"/><text x="46" y="14" fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">integrity</text><text x="141" y="14" fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">${score}/100</text></svg>\n`;
  writeFileSync(output, svg, "utf8");
  console.log(output);
  return 0;
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return 0;
  }
  if (command === "run") return runCommand(args);
  if (command === "verify" || command === "gate") return verifyCommand(args, command);
  if (command === "inspect") return inspectCommand(args);
  if (command === "badge") return badgeCommand(args);
  console.error(`Unknown command: ${command}\n\n${HELP}`);
  return 2;
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  console.error(`Proctor error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
