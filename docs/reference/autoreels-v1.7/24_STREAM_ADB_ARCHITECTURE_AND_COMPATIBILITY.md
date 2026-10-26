# 24 — STREAM / ADB ARCHITECTURE AND COMPATIBILITY

## Goal

Embed low-latency Android video/control into Electron/React.

## Do not assume

Do not assume the native scrcpy desktop SDL window is the embedded renderer.

## Candidate architecture to prove

```text
official/project-pinned ADB
-> ADB server transport
-> Tango/@yume-chan ADB client components
-> scrcpy-server exact pinned version
-> @yume-chan scrcpy protocol support
-> WebCodecs H.264 decoder
-> React canvas/video rendering
-> scrcpy control channel
```

Use official scrcpy server behavior/protocol as the source of truth.

## Pinning rule

scrcpy server/client/protocol versions are a compatibility set.

Never update one independently in production.

Store:

```text
scrcpy_server_version
client_library_versions
decoder_profile
```

in build metadata.

## Preferred video profile

Start with:
- H.264;
- no audio for farm previews;
- hardware WebCodecs where available.

Why:
- broad Android hardware support;
- lower complexity;
- audio is not required for automation.

Add HEVC/AV1 only after capability tests.

## Stream profiles

### MASTER

- high resolution;
- 30–60 FPS as device/hardware allows;
- high quality;
- full control.

### visible preview

- configured FPS/quality;
- bounded number of active decoders.

### offscreen

Preferred policy:
- stop/unsubscribe expensive continuous stream where possible;
- keep last frame;
- optionally periodic low-rate screenshot/preview.

Do not keep hundreds of full encoders/decoders running merely because devices are registered.

## State detector frame source

State detector can obtain image from:
1. active scrcpy frame when available;
2. on-demand `adb exec-out screencap -p` fallback.

UIAutomator remains preferred for semantic UI state.

## Reconnect

Stream session state:

```text
STOPPED
STARTING
RUNNING
DEGRADED
RECONNECTING
FAILED
```

Per-device exponential backoff, bounded.

A failing stream must not kill DeviceWorker's job state.

## ADB ownership/coexistence spike

This project machine may have other ADB-based tools.

Before fixing ADB server strategy, test:
- system/default server 5037 interoperability;
- project-local client with existing server;
- dedicated server port feasibility;
- USB locking behavior when another server/tool is active.

The result is documented before Phase 2 exits.

## Device compatibility record

Capture:
- Android API;
- vendor/model;
- ABI;
- resolution;
- DPI;
- current orientation;
- codec capabilities;
- Facebook package/version;
- UI locale.

## Automation eligibility

Separate fields:

```text
registered = true
manual_control_supported = true/false
automation_supported = true/false
automation_block_reason
```

An unknown device may still be manually controlled.

## Android / Facebook versioning

Selectors are selected by:
- Facebook package;
- versionCode/versionName;
- locale;
- Android profile when necessary.

Unknown app version:
- no blind posting;
- diagnostics;
- unsupported/review state.

## Facebook Lite

Not part of initial automation target.

Initial package:
`com.facebook.katana`
