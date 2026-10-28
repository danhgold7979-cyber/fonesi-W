# Increment032 — P09/S083.1 selector relative/fallback

**Baseline:** `feat/studio-workspace@d25110f00e60e866258e593b79ab666fd8ac83be`. Plan committed before source: `docs/implementation/INCREMENT-032_PLAN.md`. Source HEAD `9d52d60163112dd7a821345cd0bad877801b04ad`.

**Implementation:** `uiSelectorV2Schema` supports 1–5 ordered strategies, each with <=12 EQ/CONTAINS whitelist predicates, optional bounded ancestor chain (maxDepth1–20), clickable/enabled. Old version1 selectors and `suggestUiSelector` remain supported. `inspectUiSelectorMatches` reports exact 0/1/n, strategy number, attempt counts and ambiguity. When 2+ results match a strategy, it stops: no weaker fallback or arbitrary first match. Password text/description never matches, reject unsafe keys, malformed criteria, duplicate IDs and ancestry cycles. UI Inspector shows matched strategy. No device touch.

**Tests:** XML fixture v1 parity, first-zero fallback, hierarchy depth, ambiguity, all-zero, malformed/oversize, password/cycle; Playwright actual TCP ADB XML fixture read-only v2 UI and no input. Source CI [GitHub Actions 40646572330](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40646572330): Ubuntu **264/264 units /27 files +26/26 Chromium**; Windows **263 pass,1 pre-existing Unix SDK fixture skipped /27 files**. Type/lint/build/plan + Windows setup/VerifyOnly PASS.

**OPEN/NOT_RUN:** XPath/OCR/image matching, gesture/multitouch, physical Android geometry/stream/latency, fleet scale, real publishing, installer. P09 not fully ACCEPTED.
