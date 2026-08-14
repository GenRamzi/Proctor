# Proctor — Developer Briefing

## Cover
Proctor
Your agent said the tests pass. Proctor checks.
Developer guide and product overview · v0.1.0

## Slide 1
The missing question in agent-assisted development

- Coding agents report outcomes, but the report is often the only artifact a reviewer sees.
- “All tests pass” can hide a filtered command, skipped test, weakened assertion, or bypassed hook.
- Diff review sees the code. CI sees the command result. Proctor checks whether the claim was earned.

## Slide 2
Proctor turns agent claims into reviewable evidence

- Wrap any CLI agent: Claude, Codex, Aider, or a custom script.
- Capture a deterministic execution ledger: command, transcript, file mutations, tests, and Git signals.
- Adjudicate claims as `PROVEN`, `CONTRADICTED`, `UNPROVEN`, or `UNVERIFIABLE`.
- Emit one portable Work Receipt for local review and CI.

## Slide 3
One local-first pipeline, four useful outputs

1. `run` — execute the agent through a PTY and snapshot the workspace.
2. Analyze — parse supported test output and apply deterministic green-wash rules.
3. Receipt — store evidence, claims, findings, score, and hash-chain metadata.
4. Decide — use `verify`, `gate`, `inspect`, or `badge` for the next workflow step.

Local-first means source code and transcripts are not sent to a hosted model by default.

## Slide 4
The 30-second developer workflow

```console
npx --yes @genramzi/proctor run -- claude
npx --yes @genramzi/proctor verify
npx --yes @genramzi/proctor gate
```

- The wrapped agent’s output streams to the terminal.
- A receipt is written to `.proctor/<run-id>.receipt.json`.
- A failed claim or high-signal finding becomes visible before merge.
- Use `--claims` or `--claims-file` when the agent’s final report is separate from the transcript.

## Slide 5
The CLI is designed for agent handoffs

| Command | Developer outcome |
|---|---|
| `run` | Capture an agent session and produce a receipt |
| `verify` | Readable evidence report plus chain validation |
| `gate` | CI-safe exit code for merge policy |
| `inspect` | Full JSON for automation and downstream tooling |
| `badge` | Standalone SVG Integrity badge |

The executable is named `proctor`; the public npm package is `@genramzi/proctor` because the unscoped npm name is already occupied.

## Slide 6
A Work Receipt is the durable handoff artifact

- **Ledger:** command metadata, transcript hash, snapshots, file mutations, test results, Git operations, and hash chain.
- **Claims:** atomic text, verdict, reason, and evidence references.
- **Findings:** stable `GW-` identifier, severity, location, message, and evidence.
- **Integrity:** score, label, transparent deductions, status, and optional Ed25519 signature.

The receipt is JSON, portable, inspectable, and suitable for CI artifacts.

## Slide 7
Green-wash detectors create a shared vocabulary

| ID | Pattern | Evidence anchor |
|---|---|---|
| GW-001 | `SCOPE-NARROWED` | Full-suite claim + captured filter |
| GW-003 | `TEST-DELETED` | Before/after file hashes |
| GW-004 | `ASSERT-WEAKENED` | Test diff or changed test content |
| GW-007 | `STUB-RETURN` | Implementation diff + constant return |
| GW-012 | `HOOK-BYPASSED` | Git operation or transcript |
| GW-014 | `NEVER-RAN` | Claim without executed verification |

v0.1 ships deterministic implementations for GW-001 through GW-008, GW-012, and GW-014. Every finding must cite evidence; missing evidence is not an accusation.

## Slide 8
From local run to pull-request gate

```yaml
permissions:
  contents: read
  pull-requests: write

- name: Verify the Work Receipt
  uses: GenRamzi/Proctor@main
  with:
    receipt: .proctor/latest.receipt.json
    strict: "false"
    comment: "true"
```

- The Action locates the configured or newest timestamped receipt.
- It runs `gate`, generates an SVG badge, and uploads the evidence bundle.
- It can comment on a pull request without hiding the gate result when comment permissions are unavailable.

## Slide 9
Adopt Proctor without changing your agent

- Start with one command: `proctor run -- <agent-command>`.
- Add `.proctorignore` for `.env*`, secrets, keys, coverage, and generated artifacts.
- Use `--claims-file` for structured agent handoff reports.
- Begin with advisory `verify`; move to `gate --strict` after reviewing findings.
- Extend safely with deterministic parsers, rules, fixtures, and tests.

The current release requires Node.js 20+ and is distributed as `@genramzi/proctor@0.1.0`.

## Slide 10
Evidence first, automation second

- Proctor is not a correctness oracle, code reviewer, telemetry platform, or model judge.
- The current release does not fully observe every child process or provide native adapters for every agent.
- The score summarizes claim/evidence integrity, not code quality or test coverage.
- Roadmap: language packs, native agent adapters, richer AST evidence, Sigstore, Homebrew, and `proctor watch`.

## Slide 11
Start auditing the next agent run

```console
npm install --save-dev @genramzi/proctor
npx proctor run -- <your-agent-command>
npx proctor verify
```

Resources:

- GitHub: https://github.com/GenRamzi/Proctor
- npm: https://www.npmjs.com/package/@genramzi/proctor
- Taxonomy: https://github.com/GenRamzi/Proctor/blob/main/docs/taxonomy.md
- CLI guide: https://github.com/GenRamzi/Proctor/blob/main/README.md

Proctor: make every green checkmark show its work.
