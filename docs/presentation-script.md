# Proctor in GitHub Actions — Presentation Script

## Slide 1 — Proctor in GitHub Actions

Welcome, everyone. Today we will look at how Proctor turns an agent or test execution into an evidence-backed GitHub Actions decision. The goal is not to distrust coding agents. The goal is to make their work reviewable. Proctor captures what happened, compares the agent’s claims with the evidence, and carries that result into a pull request. We will finish with the exact workflow configuration, the security decisions behind it, and the ways developers can support the project’s roadmap.

## Slide 2 — Why add an integrity gate to CI?

A passing CI status tells us that a particular command returned a passing result. It does not always tell us whether the command covered the intended scope. An agent report can omit a filtered test command. A final diff can hide a deleted test or a weakened assertion. Proctor adds a missing question: did the agent earn the outcome honestly? The tool gives reviewers a path from the claim to the captured command, file mutation, test result, or Git operation.

## Slide 3 — The workflow has two clear stages

The integration has two stages. First, Capture: run the agent or project test command under Proctor and create a Work Receipt. Second, Decide: pass that receipt to the Proctor Action, which verifies the hash chain, applies the gate policy, generates a badge, uploads evidence, and optionally comments on the pull request. The receipt is the handoff artifact. It separates execution from policy, which makes the workflow easier to debug and audit.

## Slide 4 — A ready-to-copy workflow

This YAML is the smallest complete pattern. The workflow runs on pull requests targeting main, checks out the repository, installs the Node runtime, and runs the project command under Proctor. The final Action step verifies the timestamped receipt. In a real project, replace `your-agent-command` with the command that starts your agent or with the project-specific test command. Keep the `--` separator: options before it belong to Proctor, and everything after it belongs to the wrapped command.

## Slide 5 — Permissions are a security decision

The workflow requests `contents: read` so it can check out the repository. It requests `pull-requests: write` only because the example wants to post a summary comment. If comments are not needed, remove that permission and set `comment` to false. Treat fork pull requests as untrusted execution contexts. Most importantly, do not pass npm publish tokens, signing keys, or cloud credentials into the agent process. A restricted comment permission should affect only the comment; it should not erase the gate result or the evidence artifact.

## Slide 6 — Capture the agent’s claims explicitly

The `run` step is where Proctor observes the execution. It uses a PTY wrapper, captures the transcript, records before-and-after snapshots, identifies mutations and Git signals, and parses supported test output. The `--claims-file` option is useful when the agent writes its final report to a file rather than printing it in the terminal. Claims should be specific enough to compare with evidence. “All tests pass without a filter” is more useful than “the code is perfect.”

## Slide 7 — Tune the gate with three Action inputs

The Action has three important inputs. `receipt` selects the receipt to inspect; if the configured alias is missing, the Action can select the newest timestamped receipt. `strict` controls whether an unproven claim fails the gate. Start with false during rollout, inspect the results, and enable strict mode when the team understands its claims and evidence. `comment` controls pull-request comments. Regardless of comments, the Action generates the Integrity badge and uploads the evidence bundle.

## Slide 8 — What developers get after the run

The result is more than a green or red check. Developers receive a CI-safe gate exit code, a readable review report, a JSON Work Receipt, and an SVG badge. The receipt includes claims, verdicts, green-wash findings, integrity deductions, command metadata, and a hash chain. The score is intentionally narrow: it summarizes the integrity of claims and evidence. It is not a score for code quality, correctness, or test coverage.

## Slide 9 — Sponsor the project and help it grow

The repository now includes `.github/FUNDING.yml`, which points GitHub’s Sponsor button to the GenRamzi Sponsors profile. Sponsorship supports the next engineering increments: language packs, native agent adapters, richer AST evidence, Sigstore integration, Homebrew distribution, and a future `proctor watch` daemon. If Proctor is useful in your team, open the repository, select Sponsor, and help fund the work that makes agent-assisted development more accountable.

## Closing

To adopt Proctor, copy the workflow, replace the wrapped command, and begin in advisory mode. Run the agent, inspect the receipt, and only then make the gate strict. The operating principle is simple: every green checkmark should show its work. The repository, npm package, workflow guide, and examples are linked in the project documentation. Thank you.
