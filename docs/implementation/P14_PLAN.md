# P14 — Packaging/build/readiness plan

S119–S125. Chưa được phép biến branch đang phát triển thành production certification. Installer publication/merge main là thao tác riêng; tiếp tục build/test/doc trong branch đã được user/AGENTS cho phép.

1. Fix reproducible Linux/Windows source checkout/toolchain/checks trước packaging. Receipt pin commit/OS/runtime/schema/check counts; Windows hosted CI khác Windows10/physical phone acceptance.
2. Hướng dẫn người dùng tải đúng feature branch và launcher Windows, Node/pnpm exact, caches app-owned, paths có dấu/khoảng trắng, exit codes/timeout/cancel rõ. Source checkout chạy được khác portable/offline installer.
3. Đóng full dependency closure/runtime/data files, verify official binary hashes/license/notices, offline smoke. Không bundle ADB/scrcpy/ffmpeg/OCR chưa có source/hash/license metadata; missing capability báo rõ.
4. Build Windows installer/portable trong native CI sau packaging spike; staging artifacts có checksum/build receipt, không tự publish release. Clean-machine Win10 x64/DPI/userData/upgrade/rollback/uninstall phải có evidence riêng.
5. Completeness audit UI→named service→provider→test→physical profile, preserve NOT_RUN/deferred. Không dùng code coverage hoặc số tests thay thế supported hardware/app matrix20→300 phones.

Increment022: repair actual Windows CI CRLF failure + Windows source setup/launch. Installer/certification gates vẫn mở.
