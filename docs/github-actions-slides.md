# Proctor GitHub Actions & Sponsor Briefing

## Cover
Proctor in GitHub Actions
Evidence-backed agent gates for pull requests
Developer setup guide · v0.1.0

## Slide 1
Why add an integrity gate to CI?

- Agent reports can claim success without showing the path taken.
- A final CI status does not reveal filtered tests, deleted tests, weakened assertions, or bypassed hooks.
- Proctor turns the agent run into a Work Receipt that can be reviewed before merge.

## Slide 2
The workflow has two clear stages

1. **Capture:** run the agent under Proctor and create `.proctor/<run-id>.receipt.json`.
2. **Decide:** invoke `GenRamzi/Proctor@main` to verify the receipt, run the gate, generate the badge, and preserve the result.

The receipt is the handoff between execution and policy.

## Slide 3
A ready-to-copy workflow

```yaml
name: Proctor Integrity Gate

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  proctor-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npx --yes @genramzi/proctor run --claims-file ./agent-report.md -- your-agent-command
      - uses: GenRamzi/Proctor@main
        with:
          receipt: .proctor/latest.receipt.json
          strict: "false"
          comment: "true"
```

## Slide 4
Permissions are a security decision

| Permission | Why it exists |
|---|---|
| `contents: read` | Allows checkout and read-only repository access |
| `pull-requests: write` | Allows Proctor to post a summary comment |

- Use the least privilege that matches the workflow.
- Remove `pull-requests: write` when comments are not needed.
- Treat fork pull requests as untrusted execution contexts.
- Never expose signing keys, npm publish tokens, or cloud credentials to the agent.

## Slide 5
Capture the agent’s claims explicitly

```yaml
- name: Run agent under Proctor
  run: |
    npx --yes @genramzi/proctor run \
      --claims-file ./agent-report.md \
      -- your-agent-command
```

- `run` wraps the command through a PTY and records transcript, snapshots, mutations, tests, and Git signals.
- `--claims-file` is useful when the final report is written separately from the terminal transcript.
- The `--` separator keeps Proctor options separate from agent arguments.
- The receipt becomes the evidence source for the next step.

## Slide 6
Tune the gate with three Action inputs

| Input | Default | Effect |
|---|---:|---|
| `receipt` | newest receipt | Selects the receipt to inspect |
| `strict` | `false` | Makes `UNPROVEN` claims fail the gate when `true` |
| `comment` | `true` | Posts a pull-request summary when permissions allow |

The Action also generates an SVG Integrity badge and uploads the receipt/report bundle as an artifact. A missing comment permission should not erase the gate result or artifact.

## Slide 7
What developers get after the run

- **Gate decision:** a CI-safe exit code for merge policy.
- **Review report:** claims, verdicts, findings, and integrity deductions.
- **Evidence bundle:** JSON receipt, report, and `integrity.svg` artifact.
- **Pull-request context:** optional summary comment with the captured result.

The score summarizes claim/evidence integrity. It is not a correctness, code-quality, or coverage score.

## Slide 8
Sponsor the project and help it grow

- GitHub Sponsor button configuration is now enabled through `.github/FUNDING.yml`.
- The repository points the Sponsor button to the `GenRamzi` GitHub Sponsors profile.
- Sponsorship can support language packs, native agent adapters, richer AST evidence, Sigstore, Homebrew distribution, and `proctor watch`.
- Open the repository and select **Sponsor** to support continued development.

Resources:

- Repository: https://github.com/GenRamzi/Proctor
- Workflow guide: https://github.com/GenRamzi/Proctor/blob/main/docs/github-actions-guide.md
- npm package: https://www.npmjs.com/package/@genramzi/proctor
