# Security Policy

## Supported Versions

xpenser is pre-1.0. Security fixes target the `main` branch unless a release
branch is explicitly announced.

## Reporting A Vulnerability

Please do not open a public issue for a vulnerability.

Use GitHub private vulnerability reporting for this repository. If private
reporting is not visible, contact a maintainer privately through their GitHub
profile and include only the minimum information needed to establish a private
channel.

Helpful details include:

- Affected component or endpoint.
- Impact and who can trigger it.
- Reproduction steps or proof of concept.
- Whether credentials, API keys, Telegram links, or personal finance data may be
  exposed.

Maintainers will acknowledge valid reports as soon as practical and coordinate
fixes before public disclosure.

## Security Baseline

- Production startup rejects documented placeholder secrets.
- Passwords use scrypt with per-password salts.
- API keys, Telegram link tokens, and email confirmation tokens are stored as
  hashes.
- MCP access requires an API-key principal and can read or mutate the API-key
  owner's vendors, categories, and transactions.
- Database spans redact SQL text at the instrumentation boundary.
