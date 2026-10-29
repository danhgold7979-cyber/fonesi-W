# 09 — NEW CHAT HANDOFF PROMPT

Copy the following into a new ChatGPT/Work/Codex conversation if needed:

---

I am continuing development of a project named **Facebook Auto Farm**.

The attached Project Source Pack is the source of truth. Read these files before proposing or coding anything:

1. `00_START_HERE.md`
2. `PROJECT_KNOWLEDGE_MASTER.md`
3. `01_MASTER_SPEC.md`
4. `02_IMPLEMENTATION_PLAN.md`
5. `03_ARCHITECTURE.md`
6. `04_DATABASE_SCHEMA.md`
7. `05_STATE_MACHINES.md`
8. `06_ACCEPTANCE_TESTS.md`
9. `07_OPEN_SOURCE_DEPENDENCIES.md`
10. `10_DECISION_LOG.md`
11. `18_UI_BACKEND_TRACEABILITY.md`
12. `19_DEFINITION_OF_DONE.md`
13. `20_BACKEND_IPC_CONTRACT.md`
14. `21_COMPLETENESS_AUDIT.md`
15. `Facebook_Auto_Farm_FINAL_V17.html`

Treat FINAL V17 as a frozen UI/behavior reference, not production architecture.

Do not re-open decisions already marked FINAL unless there is a technical contradiction.

Important fixed decisions:
- unlimited devices/videos at the business-rule layer;
- manual Facebook login;
- automatic UI-based account/Page discovery after login;
- one Campaign per media folder;
- one active automation job per phone;
- manual multi-device control shares the device lock;
- Proxy/VPN mutually exclusive;
- SQLite persistence and restart recovery;
- no CAPTCHA/2FA/checkpoint bypass;
- no blind retry of Publish;
- use maintained open-source libraries rather than rewriting solved components.

Start by reporting:
1. current phase;
2. files/modules you will change;
3. acceptance criteria for this increment.

Then implement only the current planned increment.

---

Before implementing any Facebook automation, also read:
- `22_FINAL_DEEP_AUDIT.md`
- `23_MEDIA_STAGING_AND_TEXT_INPUT.md`
- `24_STREAM_ADB_ARCHITECTURE_AND_COMPATIBILITY.md`
- `25_ERROR_TIMEOUT_RETRY_AND_RECOVERY_POLICY.md`
- `26_RUNTIME_DATA_RETENTION_BACKUP_AND_OBSERVABILITY.md`
- `27_TECHNICAL_RISK_GATE.md`
- `28_RELEASE_AND_OPERATIONAL_GATES.md`
