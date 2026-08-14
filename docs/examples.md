# Proctor workflow examples

This directory contains runnable GitHub Actions examples for two common project types. Both workflows use the same integration pattern:

1. Check out the repository.
2. Install the project’s test dependencies.
3. Run the test or agent command under `@genramzi/proctor`.
4. Pass the explicit report with `--claims-file`.
5. Verify the resulting Work Receipt with `GenRamzi/Proctor@main`.

The examples are intentionally small so that the workflow structure is easy to copy into a larger codebase.

## Node.js

The Node.js example lives in [`examples/nodejs`](../examples/nodejs). Its test command is `node --test`:

```console
cd examples/nodejs
npm test
npx --yes @genramzi/proctor run \
  --claims-file ./agent-report.md \
  -- node --test
```

For an existing Node.js project, replace `node --test` with the project’s real command, such as `npm test`, `npm run test:ci`, or the command that starts your coding agent. Keep the `--` separator so Proctor options cannot be confused with arguments intended for the wrapped command.

### Node.js workflow customization

```yaml
- name: Run Node.js agent under Proctor
  working-directory: .
  run: |
    npx --yes @genramzi/proctor run \
      --claims-file ./agent-report.md \
      --receipt-dir ./artifacts/proctor \
      -- npm run test:ci

- name: Verify receipt
  uses: GenRamzi/Proctor@main
  with:
    receipt: ./artifacts/proctor/latest.receipt.json
    strict: "true"
    comment: "true"
```

Use `strict: "true"` after the team has reviewed the initial findings and wants incomplete claims to fail the merge gate.

## Python

The Python example lives in [`examples/python`](../examples/python). It uses pytest:

```console
cd examples/python
python -m pip install -r requirements.txt
pytest -q
npx --yes @genramzi/proctor run \
  --claims-file ./agent-report.md \
  -- pytest -q
```

For an existing Python project, replace `pytest -q` with the actual command, such as `python -m pytest -q`, `tox`, `nox`, or a wrapper that invokes your coding agent.

### Python workflow customization

```yaml
- name: Run Python agent under Proctor
  working-directory: .
  run: |
    npx --yes @genramzi/proctor run \
      --claims-file ./agent-report.md \
      -- python -m pytest -q

- name: Verify receipt
  uses: GenRamzi/Proctor@main
  with:
    receipt: .proctor/latest.receipt.json
    strict: "false"
    comment: "true"
```

## Claims file guidance

A claims file should contain the agent’s final report or the small set of claims that reviewers want Proctor to adjudicate. Keep it factual and specific:

```markdown
Implemented the retry path in src/http.ts.

All Node.js tests pass without a test filter.

Changed files: src/http.ts and test/http.test.ts.
```

Avoid writing claims that cannot be supported by execution evidence. For example, “the code is perfect” is qualitative and will normally be `UNVERIFIABLE`, while a concrete claim such as “12 tests passed” can be compared with a parsed test result.

## Choosing gate strictness

| Mode | Recommended use | Behavior |
|---|---|---|
| `strict: "false"` | Initial rollout and advisory review | Fails for failed receipts or contradicted claims, but does not fail only because a claim is unproven |
| `strict: "true"` | Mature CI policy | Also fails when a claim is `UNPROVEN` |

Start with `strict: "false"`, inspect receipts and findings, improve the claims file and test commands, then enable strict mode when the signal is understood.

## Receipt locations

The standard location is `.proctor/`. When a workflow uses a custom `--receipt-dir`, pass the same location to the Action:

```yaml
with:
  receipt: ./artifacts/proctor/latest.receipt.json
```

If the alias does not exist, the Action searches for the newest timestamped receipt in the configured directory.
