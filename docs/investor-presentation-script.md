# Proctor — Investor and Project Manager Presentation Script

## Audience and framing

This script is designed for investors, engineering leaders, product managers, and program owners evaluating whether Proctor should become part of an agent-assisted development platform. It separates current product facts from forward-looking hypotheses. The repository currently ships a TypeScript/Node.js CLI, a GitHub Action, a Work Receipt format, deterministic claim adjudication, green-wash detectors, a local dashboard, examples, and a public npm package. Product-market, revenue, and adoption statements below are proposals to validate rather than historical results. [1] [2]

## Slide 1 — The executive premise

Software agents can produce changes quickly, but a green result is not automatically an auditable result. Proctor is an evidence layer for agent-assisted development. It captures the execution, compares reported claims with observable evidence, and turns that evidence into a reviewable Work Receipt and CI decision.

The executive message is simple: Proctor does not replace an engineering team’s test suite. It strengthens the trust boundary around the agent run. For a project manager, this means clearer review artifacts and fewer ambiguous status checks. For an investor, it means a focused infrastructure wedge at the point where autonomous software work meets organizational accountability.

## Slide 2 — The operating problem

Teams already have several partial signals: an agent transcript, a pull-request diff, a test command, and a CI status. These signals are often disconnected. The transcript may overstate what happened. The diff may contain changes that narrow verification. CI may only confirm the command it received.

This fragmentation creates a management problem as much as a technical one. Reviewers spend time reconstructing the path from claim to evidence. Security and compliance owners lack a consistent artifact for the agent session. Engineering leaders cannot easily compare the integrity of agent runs across repositories.

Proctor addresses the evidence gap without asking teams to replace their existing agents or CI provider.

## Slide 3 — The product in one sentence

Proctor wraps an agent or project command, captures a local evidence ledger, adjudicates explicit claims, detects deterministic green-wash patterns, and emits a portable Work Receipt that CI can verify.

The product has four layers. Capture records commands, transcript, snapshots, mutations, tests, and Git signals. Adjudication assigns conservative verdicts such as `PROVEN`, `CONTRADICTED`, `UNPROVEN`, and `UNVERIFIABLE`. Policy applies a gate and Integrity Score. Delivery exposes the result through JSON, an SVG badge, a pull-request comment, and a local dashboard.

The architecture is intentionally composable: teams can keep using their preferred agent and test runner.

## Slide 4 — Why the Work Receipt matters

The Work Receipt is the product’s durable unit of trust. It contains the run identifier, wrapped command, transcript hash, before-and-after snapshots, mutations, parsed test results, Git signals, claims, findings, integrity deductions, status, and an optional Ed25519 signature.

This design gives different stakeholders a common artifact. Developers can inspect the raw decision path. CI can verify the hash chain and return a stable exit code. Reviewers can read a concise report. Security teams can archive the receipt without introducing a hosted data pipeline on day one.

The local-first model is also a deliberate adoption choice. Teams can start with sensitive execution data kept inside their own workspace and CI artifacts.

## Slide 5 — The developer adoption path

Adoption is designed to be incremental. A team first runs Proctor in advisory mode with `strict: "false"`. It reviews receipts, claim quality, and detector findings. It then improves the agent report and command boundaries. When the signal is understood, the team enables strict mode so unproven claims can fail the merge gate.

This path reduces organizational friction. The team does not need to change agents, migrate repositories, or add a hosted control plane before learning whether the evidence is useful. The GitHub Action is a small addition to an existing workflow, and the npm package is available through `npx @genramzi/proctor`.

## Slide 6 — Differentiation

Proctor is differentiated by the combination of execution capture, conservative claim adjudication, and deterministic anti-green-wash rules. A test runner can say that tests passed. A diff viewer can show changed lines. A generic agent evaluator can score a transcript. Proctor connects the claim to the command, file mutation, test result, and policy decision.

The product deliberately avoids presenting a subjective model score as ground truth. A finding is traceable to a stable detector ID, a location, and evidence. The current engine implements `GW-001` through `GW-008`, `GW-012`, and `GW-014`, with the taxonomy documented for future expansion. [1]

## Slide 7 — Current product surface

The current release includes the `run`, `verify`, `gate`, `inspect`, and `badge` commands. It supports deterministic parsing for pytest, Node.js built-in test output, Jest/Vitest, Go test, JUnit XML, and TAP. It includes a reusable GitHub Action, a browser-only dashboard, Node.js and Python workflow examples, and an optional Ed25519 signing path.

These are concrete product surfaces rather than a slide-only concept. The repository includes automated tests, a public npm package, and documentation for CI setup, examples, receipts, badges, and release automation. [1] [2]

## Slide 8 — Governance and risk controls

The product’s trust model depends on scope discipline. Proctor does not claim that an Integrity Score proves code correctness, quality, or coverage. It measures the integrity of captured claims and evidence. This boundary should remain explicit in product copy and in enterprise contracts.

The release workflow uses tag matching, protected environments, OIDC-based trusted publishing, and separate npm and PyPI publish jobs. The npm and PyPI credentials are short-lived workflow identities rather than long-lived write tokens. The dashboard is local-first and warns users that command arguments and paths may still be sensitive.

The key operational risks are parser blind spots, incorrect workflow configuration, and teams treating an advisory signal as an absolute correctness guarantee.

## Slide 9 — Roadmap priorities

The roadmap should prioritize trust density rather than feature count. First, expand language and test-result packs while preserving deterministic evidence references. Second, add richer AST evidence for more precise mutation explanations. Third, add native adapters for widely used agent runtimes so users do not need to hand-maintain wrapper commands. Fourth, integrate Sigstore-style provenance and strengthen receipt signing. Fifth, improve distribution through Homebrew and a future `proctor watch` daemon.

Each roadmap item should be evaluated against three questions: Does it make evidence easier to verify? Does it reduce adoption friction? Does it preserve local-first privacy and predictable CI behavior?

## Slide 10 — Commercial and operating hypotheses

The current repository does not claim revenue, customer count, or market share. Those metrics must be validated through customer discovery. Plausible operating hypotheses include a free local CLI for adoption, a team tier for policy management and hosted retention, and an enterprise tier for compliance controls, support, and integrations.

The open-source surface can serve as the trust and distribution layer. Paid value would need to come from capabilities that organizations cannot or do not want to operate themselves: fleet-level policy, searchable receipt retention, organization-wide dashboards, managed provenance, and enterprise support.

These are hypotheses, not commitments. The first validation milestone should be repeated usage by teams running coding agents in pull-request workflows.

## Slide 11 — Success metrics for a program owner

A project manager should measure adoption and evidence quality, not only the number of workflows installed. Useful early metrics include the number of repositories running Proctor, the percentage of runs producing parseable receipts, the proportion of claims that become `PROVEN`, the number of findings reviewed before merge, time spent by reviewers reconstructing agent work, and the rate of false-positive or unhelpful findings.

A healthy program should show that Proctor reduces review ambiguity without creating a large maintenance burden. Teams should be able to explain why a gate failed, reproduce the receipt, and decide whether the next action is to fix code, improve the test command, or refine the claim.

## Slide 12 — The decision request

The immediate decision is not to deploy Proctor everywhere. It is to approve a controlled pilot. Select two or three repositories that already use coding agents. Run Proctor in advisory mode for a defined period. Review receipts with developers, security, and project management. Establish a baseline for review time, claim quality, parser coverage, and findings.

At the end of the pilot, make a evidence-based decision: expand, refine, or stop. The pilot should have a named owner, a small set of success metrics, and an explicit policy for sensitive receipts.

Proctor’s proposal is straightforward: make agent-assisted development easier to trust without making teams abandon the tools they already use.

## Closing

The long-term opportunity is an evidence standard for autonomous software work. The short-term product is practical: a local CLI, a Work Receipt, a CI gate, and an understandable path from claim to evidence. If the pilot confirms that teams make faster and more confident review decisions with Proctor, the project has a strong basis for deeper integrations, hosted governance, and enterprise adoption.

## References

[1]: https://github.com/GenRamzi/Proctor "Proctor source repository"

[2]: https://www.npmjs.com/package/@genramzi/proctor "Proctor package on npm"
