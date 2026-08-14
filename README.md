# Proctor

<p align="center">
  <strong>Your agent said the tests pass. Proctor checks.</strong>
</p>

<p align="center">
  <a href="https://github.com/GenRamzi/Proctor/actions">CI</a> ·
  <a href="https://www.npmjs.com/package/@genramzi/proctor">npm</a> ·
  <a href="docs/taxonomy.md">Green-wash taxonomy</a> ·
  <a href="LICENSE">Apache-2.0</a>
</p>

Proctor audits what a coding agent **said** against what it **actually did**. It wraps an agent command, records a deterministic execution ledger, compares claims with captured evidence, detects high-signal green-washing patterns, and writes a portable **Work Receipt** that can be reviewed locally or attached to a pull request.

Proctor is designed for local-first use. It does not require a hosted service, does not send source code to an LLM, and does not treat the absence of evidence as proof of dishonesty.

> Proctor is an evidence and integrity tool. It is not a correctness oracle, a code reviewer, or a replacement for human review.

## Contents

- [Why Proctor](#why-proctor)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [Claims and verdicts](#claims-and-verdicts)
- [Green-wash detectors](#green-wash-detectors)
- [Work Receipts](#work-receipts)
- [Integrity score](#integrity-score)
- [Ignore rules and privacy](#ignore-rules-and-privacy)
- [GitHub Action](#github-action)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Limitations and anti-goals](#limitations-and-anti-goals)
- [Roadmap](#roadmap)
- [License](#license)

## Why Proctor

Coding agents are increasingly asked to work unattended and to report their own results. A report such as “fixed the race condition,” “all tests pass,” or “backwards compatible” can be confidently written even when the agent ran a filtered test command, weakened an assertion, deleted a test, or bypassed a Git hook.

A normal diff review examines the resulting code. A normal CI job reports the status of the command it was given. Proctor adds the missing evidence trail:

> **Did the agent earn the green checkmark honestly, and is its final summary supported by what happened during the run?**

## How it works

A Proctor run follows this pipeline:

```text
agent command
     │
     ▼
PTY wrapper + workspace snapshots
     │
     ├── command and transcript evidence
     ├── before/after file hashes and mutations
     ├── parsed test results
     └── sensitive Git operation signals
     │
     ▼
claim extraction + deterministic detectors
     │
     ▼
Work Receipt: claims, verdicts, findings, evidence, score
     │
     ├── proctor verify   human-readable report
     ├── proctor gate     CI exit code
     ├── proctor inspect  machine-readable JSON
     └── proctor badge    SVG Integrity badge
```

The v0.1 implementation records the wrapped top-level command and its PTY transcript. It also analyzes recognizable commands printed in the transcript, Git operations, workspace mutations, and supported test output. It does not yet provide native hook adapters for every coding agent or a complete operating-system-level audit of every child process.

## Installation

### Run without installing globally

The published package is scoped because the unscoped npm name `proctor` is already occupied by another package. Run the published Proctor package with:

```console
npx --yes @genramzi/proctor --version
npx --yes @genramzi/proctor --help
```

To invoke the executable name `proctor` explicitly from the scoped package:

```console
npx --yes --package=@genramzi/proctor proctor --version
```

### Add it to a project

```console
npm install --save-dev @genramzi/proctor
```

After installation, the local binary is available as:

```console
npx proctor --help
```

The `npx proctor` command above resolves the project-local binary from `node_modules/.bin`. In a directory without the package installed, use the scoped form shown earlier.

### Requirements

| Requirement | Version or behavior |
|---|---|
| Node.js | 20 or newer |
| Package manager | npm 10+ recommended; npm, pnpm, and compatible managers can install the package |
| Operating system | Linux and macOS are the primary tested environments; PTY behavior may vary on Windows |
| Network | Not required for local verification after installation; required only to install the package or use GitHub-hosted CI |

## Quick start

### 1. Run an agent under Proctor

From the root of the repository the agent will modify, run:

```console
npx --yes @genramzi/proctor run -- claude
```

Replace `claude` with any CLI command that starts your coding agent:

```console
npx --yes @genramzi/proctor run -- codex
npx --yes @genramzi/proctor run -- aider --message "Fix the failing tests"
npx --yes @genramzi/proctor run -- ./my-agent-wrapper.sh
```

The command after `--` is the command Proctor wraps. Arguments after the agent command are passed through unchanged.

When the run finishes, Proctor writes a receipt under `.proctor/` and prints a report. The wrapped command’s output is streamed to the terminal while it runs.

### 2. Supply the agent’s final report explicitly

If the agent writes its final summary to a file or does not print it in the captured transcript, provide it explicitly:

```console
npx --yes @genramzi/proctor run \
  --claims-file ./agent-report.txt \
  -- claude --print
```

You can also provide a short report directly:

```console
npx --yes @genramzi/proctor run \
  --claims "Added a retry wrapper in src/http.ts. All tests pass." \
  -- claude --print
```

### 3. Review the receipt

```console
npx --yes @genramzi/proctor verify
```

To select a specific receipt:

```console
npx --yes @genramzi/proctor verify .proctor/<run-id>.receipt.json
```

### 4. Use Proctor as a CI gate

```console
npx --yes @genramzi/proctor gate .proctor/<run-id>.receipt.json
```

The command returns exit code `0` when the receipt passes the policy and a non-zero exit code when the receipt is invalid, failed, or contains contradicted claims. Add `--strict` to fail on unproven claims as well.

## CLI reference

Run `proctor --help` for the installed version’s help text. The complete command surface is summarized below.

### `proctor run`

Wrap an agent command and create a receipt.

```console
proctor run -- <agent-command> [args...]
```

Options must be placed before the `--` separator:

| Option | Description | Example |
|---|---|---|
| `--cwd <path>` | Working directory for the wrapped command. Defaults to the current directory. | `--cwd ./project` |
| `--receipt-dir <path>` | Directory for the generated receipt. Defaults to `.proctor`. | `--receipt-dir ./artifacts/proctor` |
| `--claims <text>` | Final report or claim text to adjudicate. | `--claims "All tests pass"` |
| `--claims-file <path>` | File containing the final report. | `--claims-file ./report.md` |
| `--sign-key <path>` | Ed25519 private key in PEM format. | `--sign-key ~/.config/proctor/signing-key.pem` |
| `--ignore <path>` | Custom ignore file instead of `.proctorignore`. | `--ignore .proctorignore.ci` |
| `--strict` | Apply strict scoring to unproven claims. | `--strict` |

Example with multiple options:

```console
proctor run \
  --cwd ./my-repository \
  --receipt-dir ./artifacts/proctor \
  --claims-file ./agent-final-report.md \
  --ignore .proctorignore \
  -- claude --print
```

The `--` separator is required. Without it, Proctor cannot reliably distinguish its own options from arguments intended for the agent.

### `proctor verify`

Read and validate a receipt, then print the evidence report.

```console
proctor verify
proctor verify .proctor/<run-id>.receipt.json
proctor verify .proctor/<run-id>.receipt.json --strict
proctor verify .proctor/<run-id>.receipt.json --json
```

Without a path, Proctor selects the most recent receipt in `.proctor/`. The `--json` option emits the receipt, chain verification result, and policy result as machine-readable JSON.

### `proctor gate`

Use the receipt as a CI policy decision.

```console
proctor gate .proctor/<run-id>.receipt.json
proctor gate .proctor/<run-id>.receipt.json --strict
```

`gate` returns non-zero when:

- the receipt’s integrity chain is invalid;
- the receipt status is `FAILED`;
- at least one claim is `CONTRADICTED`; or
- `--strict` is enabled and a claim is `UNPROVEN`.

A failed comment-posting step in GitHub should not be treated as evidence that the receipt itself passed or failed. Always retain the receipt artifact and inspect the gate’s exit code.

### `proctor inspect`

Print the full receipt JSON:

```console
proctor inspect .proctor/<run-id>.receipt.json
```

This is useful for downstream scripts, data collection, debugging, and building custom reports.

### `proctor badge`

Generate a standalone SVG badge from a receipt:

```console
proctor badge .proctor/<run-id>.receipt.json --output integrity.svg
```

If `--output` is omitted, Proctor writes `integrity.svg` beside the selected receipt. The badge displays the Integrity Score and uses a color based on the score band.

## Claims and verdicts

Proctor extracts atomic claims from the agent’s final report using deterministic heuristics. The default extraction recognizes claims about test success, file changes, implementation changes, coverage, and compatibility.

Each claim receives one of four verdicts:

| Verdict | Meaning | Typical evidence |
|---|---|---|
| `PROVEN` | The ledger contains direct supporting evidence. | A changed file matching the claim or a complete unfiltered test result |
| `CONTRADICTED` | Captured evidence conflicts with the claim. | A filtered test command paired with a full-suite claim or a failed test result |
| `UNPROVEN` | The claim may be plausible, but the ledger has insufficient evidence. | A generic quality claim with no matching artifact |
| `UNVERIFIABLE` | The claim is qualitative or outside the scope of execution evidence. | “This is more maintainable” or a broad compatibility assertion |

Proctor follows a conservative evidence policy:

> No citation, no accusation.

An `UNPROVEN` result does not mean the agent lied. It means the session did not capture enough evidence to prove the claim.

## Green-wash detectors

Green-washing is the practice of making a verification result look stronger without making the underlying code or evidence stronger. Proctor assigns stable IDs to common patterns so teams can discuss findings consistently.

| ID | Name | Detection target |
|---|---|---|
| GW-001 | `SCOPE-NARROWED` | A full-suite claim paired with a filtered test command |
| GW-002 | `TEST-SKIPPED` | A skip, xfail, `.skip`, or `t.Skip` marker in changed tests |
| GW-003 | `TEST-DELETED` | A deleted test file or test path during the run |
| GW-004 | `ASSERT-WEAKENED` | Equality assertions changed to weaker presence or truthiness checks |
| GW-005 | `EXPECTED-REWRITTEN` | Expected values or assertions changed alongside an implementation change |
| GW-006 | `SUT-MOCKED` | A changed test mocks a local module that appears to be under test |
| GW-007 | `STUB-RETURN` | A changed implementation appears to return a constant canned value |
| GW-008 | `ERROR-SWALLOWED` | An empty catch or `except: pass` hides failures |
| GW-012 | `HOOK-BYPASSED` | `--no-verify`, force operations, or similar Git hook bypasses |
| GW-014 | `NEVER-RAN` | A verification claim has no corresponding executed test command or result |

The current v0.1 engine implements `GW-001` through `GW-008`, `GW-012`, and `GW-014`. IDs `GW-009`, `GW-010`, `GW-011`, and `GW-013` are reserved for expanded language and configuration packs and are documented in [`docs/taxonomy.md`](docs/taxonomy.md).

### Supported test output

The parser layer recognizes:

- pytest summaries, including basic `-k` filters;
- Jest and Vitest summaries;
- Go test output;
- JUnit XML test suites; and
- TAP output.

Parser output is evidence, not an assertion that the entire repository was tested. A filter, a skipped test, or an incomplete parser result must be reviewed in context.

## Work Receipts

A Work Receipt is the portable artifact produced by a Proctor run:

```text
.proctor/<run-id>.receipt.json
```

A receipt contains:

| Section | Contents |
|---|---|
| `schemaVersion` | Receipt format version |
| `tool` | Proctor name and version |
| `runId` | Unique run identifier |
| `command` | Wrapped command and arguments |
| `ledger` | Transcript hash, command record, snapshots, mutations, tests, Git signals, and hash chain |
| `claims` | Extracted claims, verdicts, reasons, and evidence references |
| `findings` | Green-wash findings with IDs, severity, locations, and evidence |
| `integrity` | Score, label, and transparent deductions |
| `status` | `PASSED` or `FAILED` |
| `signed` | Optional Ed25519 signature metadata |

The receipt is JSON and can be archived as a CI artifact, attached to a pull request, or passed to another automated reviewer.

### Hash-chain verification

The ledger chains command records, mutation records, and the transcript hash. `verify` and `gate` recompute the chain and report the receipt as invalid if any record has been changed after creation.

### Optional Ed25519 signing

Generate a signing key using your organization’s approved key-management process, then pass the private-key path to `run`:

```console
proctor run \
  --sign-key ~/.config/proctor/signing-key.pem \
  -- claude --print
```

Proctor stores the public key and signature in the receipt. Keep the private key outside the repository and never place it in `.proctor/`, an artifact directory, or a GitHub Actions log.

## Integrity score

Every receipt starts at `100`. Transparent deductions are applied for evidence and policy problems, including:

- contradicted claims;
- unproven claims in strict mode;
- findings weighted by severity; and
- a non-zero exit code from the wrapped command.

The score is labeled as follows:

| Score | Label | Interpretation |
|---|---|---|
| 85–100 | `STRONG` | No or few evidence deductions |
| 65–84 | `CAUTION` | Review the deductions before merging |
| 40–64 | `WEAK` | Significant evidence gaps or findings |
| 0–39 | `FAILED` | The evidence or policy gate should fail |

The score is not a code-quality score, test-coverage score, or correctness prediction. It summarizes the integrity of the captured claims and evidence.

## Ignore rules and privacy

Create `.proctorignore` in the target repository to exclude sensitive or irrelevant paths from workspace snapshots:

```text
# Credentials and keys
.env*
secrets/**
*.pem
*.key

# Generated artifacts
coverage/**
reports/**
```

Patterns are one per line. Blank lines and lines beginning with `#` are ignored. Proctor always excludes the following directories from workspace snapshots:

```text
.git/
.proctor/
node_modules/
dist/
```

Proctor uses file hashes in persisted snapshots. Bounded text contents may be held temporarily in memory while deterministic rules inspect a change, but raw source contents are removed before the receipt is written.

The transcript can still contain sensitive command arguments or file names. Review the receipt before sharing it externally, and avoid passing secrets as command-line arguments.

## GitHub Action

The repository includes a composite GitHub Action that:

1. installs and builds Proctor;
2. locates the configured receipt or the newest timestamped receipt under `.proctor/`;
3. runs `gate`;
4. generates an Integrity SVG badge;
5. uploads the receipt and reports as an artifact;
6. optionally comments on a pull request; and
7. preserves the gate exit code as the workflow result.

### Recommended workflow

The agent or verification job must create the receipt before the Proctor Action runs:

```yaml
name: Proctor integrity gate

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  proctor:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run the agent under Proctor
        run: |
          npx --yes @genramzi/proctor run \
            --claims-file ./agent-report.md \
            -- claude --print

      - name: Verify the Work Receipt
        uses: GenRamzi/Proctor@main
        with:
          receipt: .proctor/latest.receipt.json
          strict: "false"
          comment: "true"
```

The Action falls back to the newest `.proctor/*.receipt.json` file when the configured alias does not exist. For a stricter merge policy:

```yaml
      - name: Strict Proctor gate
        uses: GenRamzi/Proctor@main
        with:
          receipt: .proctor/latest.receipt.json
          strict: "true"
          comment: "true"
```

### Pull request security

Pull request workflows can execute untrusted code. Use the least privilege compatible with your repository policy. In particular:

- keep `contents: read` unless a stronger permission is required;
- grant `pull-requests: write` only when PR comments are desired;
- be careful when running agent commands on fork pull requests;
- do not expose npm publish tokens, private signing keys, or cloud credentials to agent processes; and
- retain the receipt artifact even if comment creation is unavailable.

The included example workflow is available at [`.github/workflows/proctor-example.yml`](.github/workflows/proctor-example.yml).

## Examples

### A successful evidence-backed run

```console
$ proctor run -- ./agent-wrapper.sh
pytest tests -q
3 passed in 0.08s
All tests pass

VERDICT: PASSED — 0 contradicted claims, 0 green-wash findings  Integrity 100/100

CLAIMS
  ✔ "All tests pass"  PROVEN
      The ledger captured all 3 tests passing without a filter.

GREEN-WASH FINDINGS
  None detected by the deterministic rules.
```

### A contradicted full-suite claim

```console
$ proctor run --claims "All 412 tests pass" -- ./agent-wrapper.sh
pytest tests/test_http.py -k retry
12 passed, 1 skipped

VERDICT: FAILED — 1 contradicted claim, 4 green-wash findings  Integrity 0/100

CLAIMS
  ✖ "All 412 tests pass"  CONTRADICTED
      A filter was captured, so the evidence does not support a full-suite claim.
      evidence: pytest result — 12 passed, 0 failed, 1 skipped, 13 total; filter: retry

GREEN-WASH FINDINGS
  GW-001 SCOPE-NARROWED
  GW-003 TEST-DELETED
  GW-004 ASSERT-WEAKENED
  GW-012 HOOK-BYPASSED
```

### Machine-readable verification

```console
proctor verify .proctor/<run-id>.receipt.json --json > verification.json
```

A script can inspect `verification.json` and use these fields:

```text
verification.valid
policyFailure
receipt.status
receipt.integrity.score
receipt.claims
receipt.findings
```

## Troubleshooting

### `No .proctor directory found`

Run a Proctor session first:

```console
proctor run -- <agent-command>
```

Or provide the path to an existing receipt:

```console
proctor verify ./artifacts/proctor/<run-id>.receipt.json
```

### `No claims were detected`

The final report was not printed in the transcript or did not match the supported claim heuristics. Pass it explicitly:

```console
proctor run --claims-file ./agent-report.md -- <agent-command>
```

### A test result is missing

Ensure the output contains a supported summary format. Proctor currently recognizes pytest, Jest/Vitest, Go test, JUnit XML, and TAP patterns. Save the raw output and inspect the transcript in the receipt when adding a new framework.

### `gate` fails with a valid-looking code change

A gate failure means the captured evidence or policy failed; it does not necessarily mean the code is incorrect. Inspect:

```console
proctor verify .proctor/<run-id>.receipt.json
proctor inspect .proctor/<run-id>.receipt.json
```

Review contradicted claims, filters, skipped tests, deleted tests, changed assertions, sensitive Git operations, and the score deductions.

### The GitHub Action cannot post a comment

The receipt and gate can still be useful without comments. Verify that the workflow has:

```yaml
permissions:
  contents: read
  pull-requests: write
```

For fork pull requests, repository security restrictions may prevent write access. Keep the artifact upload and gate result as the source of truth.

### `npx proctor` runs another package

The unscoped npm name `proctor` is already used by another package. Outside a project that has Proctor installed locally, use:

```console
npx --yes @genramzi/proctor --help
```

Or invoke the binary from the scoped package:

```console
npx --yes --package=@genramzi/proctor proctor --help
```

## Development

Clone the repository and install dependencies:

```console
git clone https://github.com/GenRamzi/Proctor.git
cd Proctor
npm ci
```

Run the quality checks:

```console
npm run lint
npm run typecheck
npm test
npm run build
```

Run the compiled CLI locally:

```console
node dist/cli.js --help
node dist/cli.js --version
```

### Project structure

| Path | Purpose |
|---|---|
| `src/cli.ts` | CLI argument handling, reports, exit codes, and command routing |
| `src/ledger.ts` | PTY execution, snapshots, file hashes, mutations, transcript redaction, and Git signals |
| `src/parsers.ts` | Deterministic test-result parsers |
| `src/claims.ts` | Claim extraction and evidence-backed adjudication |
| `src/rules.ts` | Green-wash detector implementations |
| `src/receipt.ts` | Receipt creation, scoring, signing, and verification |
| `src/types.ts` | Shared Work Receipt and ledger contracts |
| `test/` | Unit and integration-focused deterministic fixtures |
| `docs/taxonomy.md` | Green-wash taxonomy and evidence policy |
| `action.yml` | Reusable GitHub Action |

### Adding a detector

A detector should be deterministic, conservative, and independently testable. When adding a rule:

1. define a stable `GW-` identifier;
2. identify the minimum evidence required;
3. return a finding with a precise message and evidence reference;
4. add positive and negative fixtures;
5. update [`docs/taxonomy.md`](docs/taxonomy.md); and
6. document known false-positive boundaries.

Do not make an accusation depend solely on an LLM response.

## Limitations and anti-goals

Proctor is not:

- a code reviewer;
- a correctness oracle;
- a full test runner;
- a telemetry or cloud monitoring service;
- a model judge;
- a replay or deterministic execution system; or
- a substitute for human review.

The current release does not provide complete operating-system-level network monitoring, native adapters for every agent, full AST coverage for every supported language, or a guarantee that every child process of a complex agent is individually observed. The report should be interpreted according to the evidence actually captured.

## Roadmap

Planned follow-ups include:

- language packs for Rust, Java, Ruby, and additional Go analysis;
- native adapters for Claude Code hooks, Codex, Cursor, Aider, OpenHands, and similar tools;
- richer AST evidence and lower-noise detector implementations;
- implementation of the remaining taxonomy IDs `GW-009` through `GW-013`;
- a public Work Receipt specification;
- optional Sigstore integration;
- Homebrew distribution; and
- `proctor watch`, a daemon that can interrupt a run when a high-confidence finding fires.

## License

Proctor is released under the [Apache License 2.0](LICENSE).
