# Proctor status badge and dashboard

Proctor supports two complementary ways to display integrity status:

1. a small SVG badge generated from a Work Receipt; and
2. a local, dependency-free dashboard that renders a receipt in the browser.

## Generate a status badge in CI

After a Proctor run has written a receipt, generate the badge with:

```console
npx --yes @genramzi/proctor badge .proctor/<run-id>.receipt.json --output integrity.svg
```

The GitHub Action already generates `integrity.svg` before uploading the evidence bundle. You can also generate the badge in a custom job:

```yaml
- name: Generate Proctor badge
  run: |
    npx --yes @genramzi/proctor badge \
      .proctor/latest.receipt.json \
      --output artifacts/proctor/integrity.svg

- name: Upload Proctor status
  uses: actions/upload-artifact@v4
  with:
    name: proctor-status
    path: artifacts/proctor/integrity.svg
```

The badge is intentionally small and dependency-free. It shows the Integrity Score, not a claim that the code is correct. Review the receipt when a badge is yellow or red.

## Embed a badge in a README

For a stable public badge, publish the generated file to a branch or static artifact location that your README can access. A simple repository-owned pattern is:

```markdown
[![Proctor Integrity](https://raw.githubusercontent.com/GenRamzi/Proctor/status-badge/integrity.svg)](https://github.com/GenRamzi/Proctor/actions)
```

The URL above is a pattern. Your workflow must publish `integrity.svg` to the `status-badge` branch or replace the URL with the location used by your organization. Do not make a README claim that the badge is current unless the publication workflow updates it on every relevant run.

## Local dashboard

Open [`dashboard/index.html`](../dashboard/index.html) directly in a browser. The dashboard has two modes:

- **Load demo receipt** displays a clearly labeled illustrative receipt.
- **Choose a JSON file** loads a local `.receipt.json` file with the browser File API.

The dashboard does not upload the selected receipt to a server. It renders status, score, claims, findings, chain metadata, and run metadata in the browser. The receipt can still contain sensitive command arguments and file paths, so review it before sharing screenshots or hosting the dashboard publicly.

## Host the dashboard with GitHub Pages

A repository can publish the static dashboard with a small workflow. The dashboard is an inspection tool; it does not fetch private receipts automatically.

```yaml
name: Publish Proctor dashboard

on:
  push:
    branches: [main]
    paths:
      - dashboard/**
      - .github/workflows/proctor-dashboard.yml

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload dashboard
        uses: actions/upload-pages-artifact@v3
        with:
          path: dashboard

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Before using the workflow, enable GitHub Pages for the repository and select **GitHub Actions** as the source. Do not publish private receipts into the dashboard directory. For private projects, host the dashboard only where the repository’s access controls are appropriate.

## Recommended operating model

Use the badge as a quick signal and the receipt as the audit record:

| Surface | Best use |
|---|---|
| SVG badge | README, pull-request artifact list, or a project status page |
| GitHub Action comment | Short reviewer summary on a pull request |
| Work Receipt JSON | Durable evidence, automation, and forensic review |
| Local dashboard | Human inspection of a receipt without a hosted service |
