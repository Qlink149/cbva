# Smoke Test Results: A5 (Actions) / B3 (Client dropdown)

**Date:** 15 Sep 2026  
**Scope:** Code-path verification; live UI not exercised in this pass

---

## Automated tests added

| Test | File | Result |
|------|------|--------|
| `parseAmount` round-trip (modal lakhs + table rupees) | `frontend/src/lib/parseAmount.test.js` | **PASS** (5/5 via `npm run test:parse`) |
| Engagement action create + list same collection | `backend/tests/test_engagement_actions.py` | **NOT RUN** — local MongoDB unavailable (`localhost:27017` refused). Test file ready for CI/staging. |

---

## Code-path verification (static)

### A5 — Action created in Engagements appears in Actions tab

| Check | Evidence | Status |
|-------|----------|--------|
| Single collection | `engagement_actions` | PASS |
| Single API | `POST/GET /api/engagement-actions/` | PASS |
| Shared React context | `ClientActionsContext.jsx` wraps app | PASS |
| Create from Engagements | `ClientRowExpanded.jsx` → `addAction()` | PASS |
| Create from Actions tab | `Actions.jsx` → `addAction()` | PASS |
| Query invalidation on create | `useEngagementMeta.js` | PASS |
| Sep 2 fix commit | `8922814` | PASS |

### B3 — Client dropdown on action creation

| Check | Evidence | Status |
|-------|----------|--------|
| Client combobox on Actions page | `Actions.jsx` + `ClientCombobox.jsx` | PASS |
| `engagement_id` stored on action | `engagement_actions.py` create handler | PASS |
| `client_name` denormalized from engagement | `engagement_actions.py` L98 | PASS |

---

## Manual smoke test checklist (staging)

Run when staging is available:

1. Log in as a leader with FY26-27 editable.
2. **Engagements tab:** expand a client → add action point with deadline → confirm toast/save.
3. **Actions tab:** confirm action appears without refresh.
4. **Actions tab:** click "New Action Point" → select client from combobox → save → confirm list updates.
5. Filter to **Pending** → confirm new action visible.

---

## B6 partial gap (not in scope for this smoke pass)

Status/Remarks columns and Pending filter exist. Engagement-point and month filters **not implemented** — see verification report B6.
