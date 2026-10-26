# Increment 006 — queue claims và ownership recovery

Trước code đã đối chiếu master V2.1, P07, operation policies, S019/S062/S063/S064/S068 và REG-16/17. Increment 005 checks: 118 unit/integration, 8 Chromium scenarios; chưa có runtime Android. Scope dưới đây là S064 và phần ownership recovery của S068; overdue slot policies/power hooks/calendar vẫn tách riêng, không gọi full phase accepted.

## 006A — persistence/contract

1. Migration 5 append-only: job_claims ghi job/device/owner/generation/expiry; queue_events audit claim/renew/recovery. Không sửa migration 1–4.
2. QueueClaimResult phân biệt CLAIMED/EMPTY/DEVICE_DISABLED/DEVICE_BUSY/NEEDS_REVIEW. Claim chứa pinned snapshot/hash và DeviceLease, không có external result.
3. Chỉ private DB-worker port có queue.claim/renew/recover. Public envelope/preload không expose dispatch hay lease API; forged public command phải reject.

## 006B — transactional claim/renew

1. BEGIN IMMEDIATE chọn due jobs cho đúng device, enabled registry, scheduledUtc ascending → priority descending → createdAt → id. QUEUED/SCHEDULED chưa có effect intent mới được chọn.
2. Active manual/Inspector/APK/network lease hoặc active job khác => DEVICE_BUSY. Any NEEDS_REVIEW/uncertain effect cùng máy => NEEDS_REVIEW; các máy khác độc lập. Không tự clear uncertainty hoặc tự release owner khác.
3. Cùng transaction acquire lease tăng fencing generation và đổi SCHEDULED→QUEUED→PREFLIGHT (hoặc QUEUED→PREFLIGHT), ghi claim/audit. Snapshot/job ID/occurrence không đổi. Không dispatch UI/device input.
4. Renewal kiểm lease owner/kind/generation/expiry, claim refs và active job; gia hạn cả lease + claim atomic. Invalid/overflow clock/TTL reject; stale generation không renew. Bổ sung finite clock guard cho assertLease hiện tại.

## 006C — recovery

1. Recovery theo claim row + current lease; lease live và khớp owner/generation thì giữ nguyên. Expiry hoặc bị thay owner là lost ownership, không dùng wall-clock gap để giả biết external outcome.
2. PREFLIGHT không có bất kỳ effect journal => QUEUED để preflight/redetect lại; RUNNING hoặc bất kỳ durable effect / pending state => NEEDS_REVIEW. Không tự chuyển thành SUCCESS/FAILED hoặc phát lại publish.
3. Chỉ xóa claim đã recover, release lease khi chính owner/generation đó còn khớp; không release lease Manual mới. Giữ snapshot/effect journal/history, append audit event. Recovery lần hai idempotent.
4. Không gọi recovery/claim từ timer production khi chưa có actual runner. Sleep/overdue runtime nối ở P08/S074/S117 sau kế hoạch riêng.

## 006D — kiểm chứng

- Hai DB workers thật cùng SQLite claim đồng thời: chỉ một claim cùng phone, hai phone độc lập; priority/due/future và disabled gates.
- Manual ownership, unreviewed effects và orphan active job không bị chiếm; no due => không acquire lease rỗng.
- Renew trước deadline, stale/expired/NaN/overflow guards; restart recovery trước intent (safe requeue), RUNNING/after intent (review), never replay external input.
- Snapshot/hash giữ nguyên; recovery hai lần không sinh duplicate; Manual owner mới không bị release.
- Whole check/typecheck/lint/unit/build + browser regression và Electron/worker boundary smoke. Actual Android, Windows power, network/routing, app certification remain NOT_RUN.

### Fresh-checkout test entry

Concurrency test dùng DB worker production đã biên dịch. Trước khi sửa scripts, chốt: tách `build:host` (tsc project references + runtime copy), để `pnpm test` chạy build:host trước Vitest. Không phụ thuộc thư mục dist từ một phiên trước; `build` reuse cùng script. Đây là prerequisite của actual-worker tests, không thêm frontend build vào mọi test nhỏ.
