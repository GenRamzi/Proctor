import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { findPrintedCommands, redactSecrets, runLedger, sha256, snapshotWorkspace } from "../src/ledger.js";

test("hashes values and redacts common secret formats", () => {
  assert.equal(sha256("hello"), sha256("hello"));
  const redacted = redactSecrets("token=abc api_key: xyz ghp_123456 sk-secret -----BEGIN RSA PRIVATE KEY-----abc-----END RSA PRIVATE KEY-----");
  assert.match(redacted, /token=\[REDACTED\]/);
  assert.match(redacted, /api_key: \[REDACTED\]/);
  assert.doesNotMatch(redacted, /abc|xyz|ghp_123456|sk-secret|BEGIN RSA PRIVATE KEY/);
  assert.match(redacted, /\[REDACTED TOKEN\]/);
  assert.match(redacted, /\[REDACTED PRIVATE KEY\]/);
});

test("finds shell-style printed commands", () => {
  assert.deepEqual(findPrintedCommands("$ npm test\n> node --test\nplain text\n"), ["npm test", "node --test"]);
});

test("snapshots workspace files and respects a custom ignore file", () => {
  const cwd = mkdtempSync(join(tmpdir(), "proctor-snapshot-"));
  mkdirSync(join(cwd, "src"));
  writeFileSync(join(cwd, "src", "visible.txt"), "visible", "utf8");
  writeFileSync(join(cwd, "secret.env"), "token=do-not-capture", "utf8");
  writeFileSync(join(cwd, ".proctorignore"), "secret.env\n", "utf8");
  const snapshot = snapshotWorkspace(cwd);
  assert.ok(snapshot.files["src/visible.txt"]);
  assert.equal(snapshot.contents?.["src/visible.txt"], "visible");
  assert.equal(snapshot.files["secret.env"], undefined);
  assert.equal(snapshot.gitHead, undefined);
});

test("captures a successful PTY run, mutation, redacted transcript, and transcript file", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "proctor-ledger-"));
  const transcriptPath = join(cwd, "transcript.log");
  const ledger = await runLedger(["node", "-e", "console.log('token=abc'); require('fs').writeFileSync('output.txt','hello')"], { cwd, transcriptPath });
  assert.equal(ledger.exitCode, 0);
  assert.equal(ledger.commands[0]?.actuallyRan, true);
  assert.equal(ledger.commands[0]?.sensitive, true);
  assert.match(ledger.transcript, /token=\[REDACTED\]/);
  assert.ok(ledger.mutations.some((mutation) => mutation.path === "output.txt" && mutation.status === "added"));
  assert.equal(readFileSync(transcriptPath, "utf8"), ledger.transcript);
  assert.equal(ledger.chain.length, ledger.commands.length + ledger.mutations.length + 1);
});

test("captures a non-zero command exit and marks sensitive argv", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "proctor-ledger-fail-"));
  const ledger = await runLedger(["node", "-e", "console.log('password=abc'); process.exit(4)"], { cwd });
  assert.equal(ledger.exitCode, 4);
  assert.equal(ledger.commands[0]?.sensitive, true);
  assert.match(ledger.transcript, /password=\[REDACTED\]/);
});

test("rejects an empty wrapped command", async () => {
  await assert.rejects(() => runLedger([], { cwd: process.cwd() }), /No command supplied/);
});
