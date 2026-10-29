# 27 — TECHNICAL RISK GATE (MANDATORY BEFORE FULL AUTOMATION)

## Purpose

Prove the highest-risk technical assumptions early.

Do not spend weeks implementing later phases before these pass.

## Spike R1 — Embedded screen/control

On at least 2 real Android devices:
- embedded video inside Electron renderer;
- H.264 decode;
- tap/swipe;
- clipboard text;
- reconnect;
- MASTER quality;
- preview profile.

PASS evidence:
- video recording/screenshot;
- latency observation;
- automated lifecycle test where possible.

## Spike R2 — Unicode caption input

On Facebook real text fields:
- Vietnamese diacritics;
- emoji;
- URL;
- multiline if required;
- hashtag.

PASS:
- inserted text equals requested text.

No reliance on plain ADB input text for general Unicode.

## Spike R3 — PC video -> Facebook picker

Prove end-to-end:

```text
PC video
-> adb transfer
-> MediaStore visible
-> Facebook Reel picker
-> exact video selected
```

Run on at least:
- 2 Android versions/vendors;
- portrait video;
- landscape video.

PASS:
- exact intended source selected every run.

## Spike R4 — Account/Page discovery

Manual login:
- scanner detects current account/profile;
- discovers variable Page count;
- scroll-until-stable works;
- re-scan updates cache.

PASS:
- compare scanner result to manual inspection.

## Spike R5 — Facebook state detection

Detect without posting:
- Home;
- profile switcher;
- Page home;
- Create Reel;
- media picker;
- editor/details;
- popup;
- login/checkpoint.

PASS:
- deterministic state report and diagnostic on unknown.

## Spike R6 — Post verification feasibility

On controlled test Page:
- publish one test Reel manually/with limited flow;
- determine reliable verification signals;
- distinguish success vs ambiguous.

Do not build retry logic until verification strategy is proven.

## Spike R7 — Proxy routing

For each claimed supported type:
- check proxy from PC;
- apply adapter to device;
- prove device egress changed;
- prove Facebook traffic remains usable.

If SOCKS/auth cannot be reliably enforced device-wide, mark that adapter unsupported for v1 rather than claiming support.

## Spike R8 — ADB coexistence

Test AutoReels with the machine's other ADB-shipping software:
- not running;
- installed;
- optionally running if user workflow requires coexistence.

Decide and document:
- shared server;
- isolated server;
- or mutually exclusive operation.

## Gate result

Create:

```text
docs/evidence/risk-gate/
risk-gate-report.md
```

Each spike:
```text
PASS
FAIL
DEFERRED
```

Any FAIL affecting core architecture blocks dependent production phases.
