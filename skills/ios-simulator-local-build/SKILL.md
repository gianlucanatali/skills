---
name: ios-simulator-local-build
description: Use when you need a real, entitlement-bearing iOS Simulator build of an Expo mobile app WITHOUT waiting on the EAS cloud queue — e.g. to reproduce/verify a live-reported bug (passkeys, associated domains, Face ID) locally, or to point a Simulator build at a local backend instead of staging/production. Covers the local xcodebuild flow, pointing the build at a local backend, the `?mode=developer` passkey debug flag, and the swcd/associated-domains diagnostic technique.
---

# iOS Simulator local build — no EAS cloud queue, real entitlements

**Why this exists**: a plain `xcodebuild ... CODE_SIGNING_ALLOWED=NO` builds fine but
silently drops ALL entitlements (`com.apple.developer.associated-domains` included) —
anything gated by one (passkeys, Universal Links) then fails at runtime with an error that
looks unrelated to signing. This can cost an entire session of chasing the wrong theory
(RP ID, staging vs local, "Simulator can't test this at all") before the real cause — a
missing entitlement from the build command, not a platform limitation — is found in the
`swcd` system log.

## Quick build (no cloud queue)

```bash
<app>/scripts/build-simulator-local.sh [--passkey-dev-mode]
```

Adapt this script to your project (copy the pattern below), or run the equivalent commands
directly:

- Run `expo prebuild` + `xcodebuild` with **ad-hoc signing**
  (`CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES`) —
  NOT `CODE_SIGNING_ALLOWED=NO`. This is the one flag that matters: ad-hoc signing
  embeds a working entitlement (even though it's prefixed `FAKETEAMID.<bundle-id>`,
  not the real Apple Team ID — that prefix is normal for ANY unsigned/ad-hoc
  Simulator build, EAS-built ones included, and is NOT itself a failure signal).
- `--passkey-dev-mode` appends `?mode=developer` to each `webcredentials:`
  associated-domain entry (an env var read by your `app.config.js`) — Apple's own
  documented mechanism
  (`developer.apple.com/documentation/xcode/supporting-associated-domains`) to force
  a fresh AASA fetch instead of `swcd`'s aggressive multi-day cache. Use this when
  iterating on a passkey-related bug on a repeatedly-reinstalled Simulator.
- Install: `xcrun simctl install booted <app>/ios/build_local/Build/Products/Release-iphonesimulator/<AppName>.app`

## Point the build at a local backend

Set env vars before running the script above (adapt names to your project's Expo public env
var convention):

```bash
export EXPO_PUBLIC_API_URL="http://127.0.0.1:<port>"
export EXPO_PUBLIC_API_KEY="<local key>"
```

`127.0.0.1` inside the build resolves correctly on the SIMULATOR (shares the Mac's network
namespace) — never on a real device.

## Diagnosing "not associated with domain" (native error code 1004)

The check runs in a separate SYSTEM daemon (`swcd`), never in the app's own process — the
app-scoped log (`process == "<AppName>"`) never shows it:

```bash
xcrun simctl spawn booted log stream --level debug \
  --predicate 'process CONTAINS "swcd"' > swcd.log &
# THEN install/relaunch the app — the check fires on app registration, not on
# the passkey call itself — and grep for your bundle ID:
grep -n "<your-bundle-id>" swcd.log | grep -iE "denied|approved|missing app identifier entitlement"
```

- `missing app identifier entitlement` → the build has no entitlement at all (the
  `CODE_SIGNING_ALLOWED=NO` bug above). Fix the build, not the domain config.
- `denied` → the entitlement exists but verification failed for real. `swcd` caches
  a denied verdict for **~5 days** — waiting longer in the same session does NOT
  clear it; `xcrun simctl uninstall <bundle-id>` + reinstall (or a full
  `simctl erase`) forces a fresh check.
- No entry at all for your domain → the associated-domains list never made it into
  the build's entitlements — check your `app.config.js`/`app.json`.

## What NOT to conclude from a failure here

Simulator passkey/associated-domains testing has a real reputation for being unreliable in
developer forum reports — but that reputation does NOT mean "Simulator can never test
this." A build with the entitlement actually present can pass verification cleanly and
complete a real passkey registration + biometric unlock cycle, repeatably. Don't reach for
"this is a platform limitation" before checking the `swcd` log for the concrete reason
first.
