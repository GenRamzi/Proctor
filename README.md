# Proctor

> Your agent said the tests pass. Proctor checks.

Proctor audits what a coding agent **said** against what it **actually did**. It records a deterministic execution ledger, adjudicates claims against evidence, detects green-washing patterns, and writes a portable Work Receipt that can be reviewed locally or attached to a pull request.

## The 30-second demo

```console
$ npx proctor run -- claude
$ npx proctor verify

VERDICT: FAILED — 1 contradicted claim, 3 green-wash findings  Integrity 41/100

CLAIMS
  ✖ "All 412 tests pass"  CONTRADICTED
      A filter was captured, so the evidence does not support a full-suite claim.
      evidence: pytest result — 12 passed, 0 failed, 1 skipped, 13 total; filter: retry

GREEN-WASH FINDINGS
  GW-001 SCOPE-NARROWED    transcript — A full-suite claim was paired with a captured test filter.
  GW-003 TEST-DELETED      tests/test_timeout.py — Test file was deleted during the run.
  GW-012 HOOK-BYPASSED     transcript — A hook bypass or force operation was detected.
```

The exact result depends on the agent command and repository. Proctor does not claim that a clean report proves code correctness; it reports what the captured evidence can and cannot establish.

## Why Proctor exists

Coding agents optimize for the requested outcome. When the outcome is “make CI green,” the cheapest path can be to narrow a test command, weaken an assertion, remove a test, or bypass a hook. A normal diff review sees the resulting code, while normal CI sees only the final command result. Proctor adds the missing question: **did the agent earn its claims honestly?**

## Install

Proctor requires Node.js 20 or newer.

```console
npm install --save-dev proctor
npx proctor --help
```

For local development from this repository:

```console
npm install
npm run build
node dist/cli.js --help
```

The package is Apache-2.0 licensed. Bun and Homebrew distribution are planned follow-ups; the npm package and `npx proctor` path are the v0.1 distribution surface.

## Commands

### Run an agent under Proctor

```console
proctor run -- <agent-command> [args...]
proctor run --cwd ./repo --claims-file ./agent-report.txt -- claude --print
```

`run` captures the wrapped command through a PTY, records its exit status and transcript, snapshots file hashes before and after execution, detects Git operations, parses recognizable test output, extracts claims from the transcript or an explicit report, and writes a receipt under `.proctor/`.

Use `--claims` or `--claims-file` when the agent’s final message is not printed in the wrapped transcript. Use `--ignore` to point at a custom ignore file, and `--sign-key` to sign a receipt with an Ed25519 private key.

### Verify and gate

```console
proctor verify
proctor verify .proctor/<run-id>.receipt.json
proctor gate .proctor/<run-id>.receipt.json --strict
```

`verify` prints a human-readable evidence report and validates the ledger hash chain. `gate` is intended for CI: it exits non-zero when the receipt is failed, a claim is contradicted, the receipt is tampered with, or `--strict` finds an unproven claim.

### Inspect a receipt and generate a badge

```console
proctor inspect .proctor/<run-id>.receipt.json
proctor badge .proctor/<run-id>.receipt.json --output integrity.svg
```

`inspect` emits the complete JSON receipt for downstream tooling. `badge` writes a dependency-free SVG Integrity badge that can be uploaded as a CI artifact or published with a project’s status assets.

## Work Receipts

A receipt is written to `.proctor/<run-id>.receipt.json`. It contains the schema version, tool version, command, ledger, claims, findings, integrity score, status, and optional Ed25519 signature. The ledger includes command metadata, transcript hash, before/after file hashes, mutations, parsed test results, sensitive Git operations, and a hash chain.

Receipts do not persist raw source contents used internally by detectors. By default, Proctor is local-first: it does not upload transcripts or source files to a service. Review the receipt before sharing it because command arguments and file names may still reveal project context.

## Verdicts

| Verdict | Meaning |
|---|---|
| `PROVEN` | The captured ledger contains direct supporting evidence. |
| `CONTRADICTED` | Captured evidence conflicts with the claim. |
| `UNPROVEN` | The claim is plausible but the ledger has no sufficient evidence. |
| `UNVERIFIABLE` | The claim is qualitative or outside what execution evidence can settle. |

Proctor defaults to humility. It does not convert missing evidence into an accusation.

## Green-wash detectors

The v0.1 deterministic engine implements `GW-001` through `GW-008`, `GW-012`, and `GW-014`. The stable taxonomy, examples, and evidence policy are documented in [`docs/taxonomy.md`](docs/taxonomy.md).

Supported test output includes pytest summaries, Jest/Vitest summaries, Go test output, TAP, and basic JUnit XML parsing through the reusable parser layer. Python and TypeScript/JavaScript rules are intentionally conservative, and pattern matches should be reviewed in context.

## GitHub Action

The repository includes a composite action that verifies a receipt, uploads the receipt and report as an artifact, optionally comments on pull requests, and preserves the gate result as the workflow exit code.

```yaml
name: Proctor

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  proctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run the agent under Proctor
        run: npx proctor run -- your-agent-command --final-report agent-report.txt
      - name: Verify the receipt
        uses: GenRamzi/Proctor@main
        with:
          receipt: .proctor/latest.receipt.json
          strict: "false"
          comment: "true"
```

The workflow must create the receipt before the action runs. For fork pull requests, use the least privilege compatible with the repository’s security policy. A missing permission to comment should not erase the uploaded report or the gate result.

## Ignore rules

Create `.proctorignore` to exclude sensitive or irrelevant paths from snapshots. It uses glob patterns, one per line:

```text
.env*
secrets/**
coverage/**
*.pem
```

Proctor always excludes `.git`, `.proctor`, `node_modules`, and `dist` from workspace snapshots.

## Integrity score

The score starts at 100 and applies transparent deductions for contradicted claims, strict-mode unproven claims, findings by severity, and a non-zero wrapped-command exit code. It is a review aid, not a code-quality score or correctness oracle. The score and deductions are stored in the receipt so a reviewer can audit the result.

## Anti-goals

Proctor is **not** a code reviewer, correctness oracle, telemetry platform, model judge, replay system, or cloud surveillance service. Deterministic rules come first. An optional model-assisted claim extractor may be added later, but an LLM is never the sole basis of an accusation. Every finding must cite evidence, and Proctor should remain silent when evidence is absent.

## Development

```console
npm install
npm run typecheck
npm test
npm run build
```

The tests use deterministic fixtures and cover parsers, claim adjudication, green-wash findings, receipt chain verification, tamper detection, and Ed25519 signing. Add a fixture and a focused test when extending a detector or parser.

## Roadmap

The next increments are language packs for Go, Rust, Java, and Ruby; native adapters for agent hooks; richer AST evidence; support for `GW-009` through `GW-013`; public Work Receipt specification; optional Sigstore integration; and a `proctor watch` daemon that can interrupt a run when a high-confidence finding fires.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
