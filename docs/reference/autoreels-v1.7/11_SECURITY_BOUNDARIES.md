# 11 — SECURITY BOUNDARIES

## Electron

Required:
- `contextIsolation: true`
- `nodeIntegration: false`
- renderer sandbox where practical
- narrow preload API
- IPC input validation

Forbidden:
- arbitrary shell command exposed to renderer
- string-concatenated shell commands from untrusted input
- local HTTP server listening on all interfaces without explicit requirement/authentication

## Credentials

Never persist:
- Facebook password
- 2FA secret
- CAPTCHA answers
- private Facebook application databases/tokens acquired through extraction

Proxy credentials:
- redact from logs
- store through OS credential facility or encrypted reference when production requires persistence

## External automation boundaries

When the Facebook application presents:
- CAPTCHA
- checkpoint
- 2FA
- identity verification
- other account-security challenge

Set:
`NEEDS_REVIEW`

Do not automate bypass.

## Network

Proxy/VPN management is a device routing feature.

Do not implement behavior intended to:
- evade platform enforcement;
- rotate identities/IPs automatically in response to blocks;
- conceal abusive automation.

## Diagnostics

Diagnostic export may contain:
- screenshots
- UI XML
- device identifiers
- Page/profile names
- network metadata

Show user what is included before sharing/exporting externally.
