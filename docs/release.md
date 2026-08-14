# Automated release workflow

Proctor now includes a tag-driven release workflow at [`.github/workflows/release.yml`](../.github/workflows/release.yml). It is designed to validate the repository first, publish the npm package through npm Trusted Publishing, optionally publish a Python distribution through PyPI Trusted Publishing, and create a GitHub Release with generated notes and release assets.

## What triggers a release?

The workflow runs only when a semantic version tag matching this pattern is pushed:

```text
v*.*.*
```

The tag must match the `version` field in `package.json` after removing the leading `v`:

| Tag | `package.json` version | Result |
|---|---|---|
| `v0.1.1` | `0.1.1` | Valid |
| `v0.2.0` | `0.1.0` | Fails before publishing |
| `release-0.1.1` | `0.1.1` | Does not trigger this workflow |

Create and push a release tag with:

```console
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Prepare v0.1.1"
git tag v0.1.1
git push origin main --follow-tags
```

For a minor or major release, replace `patch` with `minor` or `major`. Do not reuse a published npm or PyPI version.

## Workflow stages

The workflow has five logical stages:

1. **Validate:** checks the tag/version match, detects whether `pyproject.toml` exists, installs npm dependencies, runs lint, typecheck, tests, and build.
2. **Publish npm:** runs `npm publish` with OIDC from the protected `release` environment.
3. **Build Python:** runs only when a root-level `pyproject.toml` exists and uploads `dist/` as an artifact.
4. **Publish PyPI:** runs only after a successful Python build and uses the protected `pypi` environment.
5. **Create GitHub Release:** runs after npm succeeds and after PyPI either succeeds or is intentionally skipped. It attaches the npm tarball and any Python distributions.

The current Proctor repository is a TypeScript/Node.js package and does not contain a root-level `pyproject.toml`. Therefore, the PyPI branch is deliberately skipped until a real Python distribution is added. This prevents the workflow from publishing a placeholder or misleading Python package.

## Configure npm Trusted Publishing

The npm package is `@genramzi/proctor`. In npm package settings, configure a GitHub Actions Trusted Publisher with these exact values:

| npm field | Value |
|---|---|
| Organization or user | `GenRamzi` |
| Repository | `Proctor` |
| Workflow filename | `release.yml` |
| Environment name | `release` |
| Allowed action | `npm publish` |

npm requires the configured workflow filename to match the file under `.github/workflows/`, including the `.yml` extension. The workflow grants `id-token: write` only to the publish job and uses a GitHub-hosted runner. npm Trusted Publishing uses OIDC short-lived credentials rather than a long-lived npm token. [1]

The current npm documentation states that Trusted Publishing requires npm CLI `11.5.1` or newer and Node.js `22.14.0` or newer. The release workflow uses Node.js `24` and `actions/setup-node@v6`. [1]

Before the first automated release, verify that the npm package’s `repository.url` exactly matches:

```text
git+https://github.com/GenRamzi/Proctor.git
```

## Configure PyPI Trusted Publishing

The PyPI job is conditional. When this repository gains a root-level Python package, configure the corresponding project on PyPI before pushing a tag.

In PyPI project settings, add a Trusted Publisher with:

| PyPI field | Value |
|---|---|
| Owner | `GenRamzi` |
| Repository name | `Proctor` |
| Workflow name | `release.yml` |
| Environment | `pypi` |

The Python package must provide a valid `pyproject.toml` and build into `dist/` with `python -m build`. The workflow then uses `pypa/gh-action-pypi-publish@release/v1` without a username, password, or API token. The publish job grants `id-token: write` at job scope and uses the `pypi` environment. [2] [3]

PyPI’s official guidance recommends using the publishing action rather than implementing the OIDC token exchange manually. [2]

## GitHub environment protection

Create two GitHub Environments under **Settings → Environments**:

| Environment | Used by | Recommended protection |
|---|---|---|
| `release` | npm publish | Required reviewer and tag/branch restrictions |
| `pypi` | PyPI publish | Required reviewer and tag/branch restrictions |

The workflow can be used without required reviewers, but protected environments provide a deliberate approval point before publishing. Configure the tag policy so only trusted maintainers can create `v*.*.*` tags.

## First release checklist

Before pushing a real release tag, confirm the following:

```console
npm whoami
npm view @genramzi/proctor version
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Then check that:

- the npm Trusted Publisher configuration uses `release.yml`, not the full path;
- the `release` environment name matches both npm and the workflow;
- the package version and tag version match;
- no private dependency requires a write token during `npm ci`;
- the GitHub repository is public if npm provenance is expected;
- the PyPI Trusted Publisher is configured only if a real Python package exists.

## Security model

The workflow does not store npm or PyPI write tokens. Publishing is limited to tag pushes, protected environments, and exact Trusted Publisher identities. npm Trusted Publishing automatically produces provenance for eligible public repository/package publishes. [1] PyPI Trusted Publishing likewise binds the project to an exact repository and workflow identity. [2] [3]

If a release is interrupted after npm publishing, do not reuse the version. Fix the workflow or package, increment the version, and create a new tag. Package registries treat published versions as immutable release identifiers.

## References

[1]: https://docs.npmjs.com/trusted-publishers/ "Trusted publishing for npm packages — npm Docs"

[2]: https://docs.pypi.org/trusted-publishers/using-a-publisher/ "Publishing with a Trusted Publisher — PyPI Docs"

[3]: https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-pypi "Configuring OpenID Connect in PyPI — GitHub Docs"
