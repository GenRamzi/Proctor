# Release automation sources

The release workflow and documentation were checked against these official sources:

1. npm Trusted Publishers: https://docs.npmjs.com/trusted-publishers/
   Key points: npm Trusted Publishing uses OIDC, requires `id-token: write`, requires npm CLI 11.5.1+ and Node 22.14.0+, and the configured GitHub workflow filename must match exactly. Trusted publishing is configured on the npm package’s Trusted Publisher settings.

2. PyPI Trusted Publishers: https://docs.pypi.org/trusted-publishers/using-a-publisher/
   Key points: `pypa/gh-action-pypi-publish@release/v1` supports Trusted Publishing; the publish job needs `id-token: write`; username and password are omitted for OIDC publishing; an optional protected GitHub environment is recommended.

3. GitHub OIDC with PyPI: https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-pypi
   Key points: configure the PyPI project to trust the exact GitHub owner, repository, workflow filename, and optional environment; `id-token: write` is required; environment protection rules can restrict deployment.
