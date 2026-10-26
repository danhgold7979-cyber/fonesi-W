# 20 — BACKEND / IPC CONTRACT

This is the minimum production API surface implied by FINAL V17.

Exact TypeScript names may evolve, but capability coverage may not disappear.

## devices

```ts
devices.list()
devices.scan()
devices.addManualConnection(input)
devices.reconnect(deviceIds)
devices.getDetails(deviceIds)
devices.captureScreenshot(deviceIds)
devices.openApp(deviceIds, appRole)
devices.openPackage(deviceIds, packageName, options)
devices.openSettings(deviceIds)
devices.clearManagedBackground(deviceIds)
```

## streams

```ts
streams.subscribe(deviceId, profile)
streams.unsubscribe(deviceId)
streams.focus(deviceId)
streams.setGlobalPreviewProfile({ fps, quality })
streams.requestKeyFrame(deviceIds)
streams.setVisibility(deviceId, visibility)
```

## manualControl

```ts
manualControl.acquire(deviceIds)
manualControl.release(deviceIds)
manualControl.tap(deviceIds, normalizedPoint)
manualControl.swipe(deviceIds, normalizedGesture)
manualControl.key(deviceIds, key)
```

Manual acquisition coordinates with DeviceWorker ownership.

## workers

```ts
workers.getState(deviceId)
workers.setManualLock(deviceIds, locked)
workers.pauseForManualControl(deviceIds)
workers.resumeAfterRedetect(deviceIds)
```

## accounts / identities / metrics

```ts
accounts.openManualLogin(deviceId)
accounts.scan(deviceId)
accounts.list(deviceId)

identities.list(loginSessionId)
identities.verify(identityId)
identities.switchTo(identityId)

metrics.refresh(identityId)
metrics.history(identityId)
```

## campaigns

```ts
campaigns.list()
campaigns.get(id)
campaigns.create(input)
campaigns.update(id, patch)
campaigns.remove(id)
campaigns.setFolder(id, folderPath)
campaigns.setWatcherEnabled(id, enabled)
campaigns.setReconcileInterval(id, seconds)
campaigns.setDelayRange(id, minSeconds, maxSeconds)
```

## media

```ts
media.query(query)
media.update(id, patch)
media.bulkUpdate(ids, patch, textMode)
media.removeFromCampaign(ids)
media.cloneMetadata(id)
media.reconcile(campaignId)
media.importSpreadsheet(campaignId, path)
media.exportSpreadsheet(campaignId, query)
```

## scheduler

```ts
scheduler.generateJobs(campaignId, options)
scheduler.clearPending(campaignId)
scheduler.queryTimeline(query)
scheduler.reschedule(jobId, scheduledAt)
scheduler.spreadConflicts(query, minMinutes, maxMinutes)
scheduler.enqueueNow(mediaId)
```

## jobs

```ts
jobs.get(id)
jobs.cancel(id)
jobs.retryAllowedAction(id)
jobs.events.subscribe()
```

There is no generic “retry publish” command from POST_PENDING.

## proxy

```ts
proxy.parseAndUpsert(text)
proxy.list()
proxy.check(proxyIds)
proxy.checkAll()
proxy.assign(mappings)
proxy.clear(deviceIds)
```

## network / VPN

```ts
network.scanVpnApps(deviceId)
network.setVpn(deviceId, packageName, enabled)
network.openActiveVpnApp(deviceIds)
network.getDeviceRouting(deviceId)
```

## APK

```ts
apk.install(deviceIds, apkPath)
apk.uninstall(deviceIds, packageName)
apk.listKnown()
```

## clone/config

```ts
config.getCloneSource(input)
config.clone(input)
```

Never copies credentials/private session material.

## system/app/settings

```ts
system.getMetrics()
system.metrics.subscribe()

app.setRunInBackground(enabled)
app.getRunInBackground()

settings.get(key)
settings.set(key, value)
```

## diagnostics

```ts
diagnostics.capture(deviceId, jobId, reason)
diagnostics.exportPackage(query)
```

## Result contract

Batch actions return per-device results:

```ts
type BatchResult<T> = {
  requested: number
  succeeded: number
  failed: number
  items: Array<{
    deviceId: string
    ok: boolean
    value?: T
    error?: {
      code: string
      message: string
      retryable: boolean
    }
  }>
}
```

Never collapse “9 succeeded / 1 failed” into a fake global success.
