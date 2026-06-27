# End-to-End Production Audit & Full-Stack Roadmap
## CBVA — CBV & Associates LLP Business Planning Platform

---

## Part 1: Frontend Data Extraction & Reverse Engineering

### 1.1 Data Models

The frontend operates on the following distinct domain models, all currently hardcoded in `src/lib/leaderData.js` and `src/lib/leaderData2627.js`.

---

#### Model: `User`
*Source: `src/lib/AuthContext.jsx`, `src/components/layout/AppLayout.jsx`*

```typescript
{
  id: string;                              // MongoDB ObjectId (replaces Base44 UUID)
  full_name: string;
  email: string;
  password_hash: string;                   // Server-side only, never sent to frontend
  designation: string;                     // e.g. "Senior Manager", "Partner"
  role: "admin" | "management" | "user";
  leader_id: string | null;               // Links user to a Leader document (null for admin/management)
  is_active: boolean;
  created_at: datetime;
  last_login: datetime | null;
}
```

---

#### Model: `Leader`
*Source: `src/lib/leaderData.js` (9 leaders), `src/components/layout/LeaderFYSelector.jsx`*

```typescript
{
  id: string;                              // e.g. "manan", "varun", "priyesh"
  name: string;                            // e.g. "Manan Mathuria"
  practice: string;                        // e.g. "Direct Tax", "Transfer Pricing"
  email: string;
  is_active: boolean;
}
```

**All 9 leaders currently in the system:**
| id | name | practice |
|----|------|----------|
| `manan` | Manan Mathuria | Direct Tax |
| `varun` | Varun Chaturvedi | Transfer Pricing |
| `priyesh` | Priyesh Vira | — |
| `ritesh` | Ritesh Thakkar | — |
| `np` | Nirav Poddar | — |
| `abhitan` | Abhitan Mehta | — |
| `amol` | Amol Haryan | — |
| `vinay` | Vinay Sethy | — |
| `biu` | BIU | Business Intelligence Unit |

---

#### Model: `Engagement` (Client)
*Source: `src/components/clients/AddEngagementModal.jsx`, `src/lib/leaderData.js` (`MANAN_CLIENTS` et al.)*

All monetary amounts stored as **integers in paise** (1 Lakh = 100,000 paise).

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  fiscal_year: "2526" | "2627";
  num: number;                             // Display order / row number
  name: string;                            // Client/engagement name (required)
  model: string;                           // Engagement model, defaults to "—"
  rel_partner: string;                     // Relationship partner initials
  el_status: "Signed" | "Not Signed" | "Waived" | "NA" | "DS" | "—";
  green: number;                           // High-confidence pipeline (paise)
  amber: number;                           // Medium-confidence pipeline (paise)
  blue_sky: number;                        // Exploratory pipeline (paise)
  total: number;                           // Computed: green + amber + blue_sky
  collected: number;                       // Amount collected YTD (paise)
  may_col: number | null;                  // May collection
  june_col: number | null;                 // June collection
  july_col: number | null;                 // July collection
  balance: number | null;                  // Computed: total - collected
  remarks: string;
  is_archived: boolean;
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `PipelineSnapshot`
*Source: `src/lib/leaderData.js` (`MANAN_PIPELINE`, `VARUN_PIPELINE` etc.), `src/components/dashboard/PipelineBoardChart.jsx`*

Each document represents one month-label's pipeline state for a leader in a given FY.

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  fiscal_year: "2526" | "2627";
  label: string;                           // e.g. "Board Plan (May 2025)", "November 2025"
  sort_order: number;                      // For ordering rows in the chart
  green: number;                           // (paise)
  amber: number | null;
  blue_sky: number | null;
  total: number;
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `BlueSkyEntry`
*Source: `src/lib/leaderData.js` (`MANAN_BLUESKY`), `src/components/dashboard/BlueSkyTableReal.jsx`*

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  fiscal_year: "2526" | "2627";
  month: string;                           // e.g. "May 2025"
  sort_order: number;
  opening: number;                         // (paise)
  additional: number | null;
  converted: number;
  closing: number;
  remarks: string;
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `CollectionEntry`
*Source: `src/lib/leaderData.js` (`MANAN_COLLECTIONS`), `src/components/dashboard/CollectionsTableReal.jsx`*

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  fiscal_year: "2526" | "2627";
  month: string;                           // e.g. "August 2025"
  sort_order: number;
  planned: number;                         // (paise)
  collected: number;
  outstanding: number | null;
  variance: number;                        // computed: collected - planned
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `Action` (Key Business Plan Action)
*Source: `src/lib/leaderData.js` (`MANAN_ACTIONS`), `src/pages/Actions.jsx`*

These are strategic, pre-seeded business plan items (distinct from `Task` below).

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  fiscal_year: "2526" | "2627";
  num: number;                             // Display order
  category: string;                        // e.g. "Taurus", "Hiring", "Amber Clients"
  description: string;
  status: "In-Progress" | "Not Started" | "Closed";
  notes: string;
  remarks: string;
  due_date: string | null;                 // ISO date string
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `Task`
*Source: `src/pages/Actions.jsx` (TanStack Query → `base44.entities.Task`)*

Dynamic, user-created tasks — separate from the static business plan actions.

```typescript
{
  id: string;
  created_by_id: string;                  // ref → User (leader's user account)
  leader_id: string;                       // ref → Leader
  title: string;                           // (required)
  assignee_name: string;
  client_name: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  deadline: string | null;                 // ISO date string
  notes: string;
  status: "Pending" | "In Progress" | "Done";
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `TeamMember`
*Source: `src/components/team/TeamEntryDrawer.jsx`, `src/pages/TeamView.jsx`*

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  full_name: string;                       // (required)
  designation: string;
  email: string;
  annual_cost: number;                     // INR (not paise, as entered directly)
  joining_date: string | null;             // ISO date string
  status: "Active" | "On Notice" | "Inactive";
  notes: string;
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `HiringRequirement`
*Source: `src/components/team/TeamEntryDrawer.jsx`, `src/pages/TeamView.jsx`*

```typescript
{
  id: string;
  leader_id: string;                       // ref → Leader
  role_title: string;                      // (required)
  level: "Analyst" | "Associate" | "Manager" | "Senior Manager" | "Director" | "Partner" | "Other";
  expected_joining_date: string | null;
  status: "Open" | "In Progress" | "Filled" | "On Hold";
  expected_cost: number;                   // Annual cost in INR
  notes: string;
  created_at: datetime;
  updated_at: datetime;
}
```

---

#### Model: `ELSummary` (FY 26-27 only)
*Source: `src/lib/leaderData2627.js` (`summary2627`), `src/components/dashboard/FY2627Dashboard.jsx`*

```typescript
{
  id: string;
  leader_id: string;
  fiscal_year: "2627";
  el_signed: number;                       // Amount with EL signed (paise)
  el_not_signed: number;
  received_till_may: number;
  to_receive_june: number;
  to_receive_july: number;
  pct_collected: number | null;            // Percentage
  amber_el_signed: number | null;
  amber_el_not_signed: number | null;
  amber_received: number | null;
  updated_at: datetime;
}
```

---

### 1.2 API Requirements

Every user action maps to an API call. Below is the complete API contract the frontend expects.

---

#### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Email + password login, returns JWT |
| `POST` | `/api/auth/logout` | Invalidates refresh token |
| `GET` | `/api/auth/me` | Returns current user profile |
| `POST` | `/api/auth/refresh` | Refresh access token |

**`POST /api/auth/login`**
```json
// Request
{ "email": "mm@cbva.com", "password": "MM" }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "...", "full_name": "Manan Mathuria",
    "email": "mm@cbva.com", "role": "user",
    "leader_id": "manan", "designation": "Partner"
  }
}
```

---

#### Leader Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/leaders` | List all leaders (admin/management only) |
| `GET` | `/api/leaders/{leader_id}` | Get a single leader profile |
| `POST` | `/api/leaders` | Create a leader (admin only) |
| `PUT` | `/api/leaders/{leader_id}` | Update leader profile (admin only) |

**`GET /api/leaders` Response:**
```json
[
  { "id": "manan", "name": "Manan Mathuria", "practice": "Direct Tax", "email": "...", "is_active": true },
  ...
]
```

---

#### Engagement (Client) Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/engagements` | List engagements (filtered by `leader_id`, `fiscal_year`, `is_archived`) |
| `POST` | `/api/engagements` | Create new engagement |
| `PUT` | `/api/engagements/{id}` | Update engagement (inline edits to amounts, remarks, el_status) |
| `DELETE` | `/api/engagements/{id}` | Archive an engagement |
| `PATCH` | `/api/engagements/{id}/remarks` | Quick-update remarks only |

**`GET /api/engagements?leader_id=manan&fiscal_year=2526&is_archived=false` Response:**
```json
{
  "data": [
    {
      "id": "...", "leader_id": "manan", "fiscal_year": "2526",
      "num": 1, "name": "K Raheja Group", "model": "—",
      "rel_partner": "KK", "el_status": "Signed",
      "green": 28806130, "amber": 1515000, "blue_sky": 0,
      "total": 30321130, "collected": 28806130, "balance": 1515000,
      "may_col": null, "june_col": null, "july_col": null,
      "remarks": "", "is_archived": false,
      "created_at": "...", "updated_at": "..."
    }
  ],
  "total": 27
}
```

**`POST /api/engagements` Request:**
```json
{
  "leader_id": "manan", "fiscal_year": "2526",
  "name": "New Client Ltd", "rel_partner": "KK",
  "el_status": "Not Signed",
  "green": 5000000, "amber": 2000000, "blue_sky": 0,
  "collected": 0, "remarks": ""
}
```

---

#### Pipeline Snapshot Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pipeline?leader_id={id}&fiscal_year={fy}` | Get all pipeline snapshots for a leader+FY |
| `POST` | `/api/pipeline` | Add a new monthly snapshot row |
| `PUT` | `/api/pipeline/{id}` | Update a snapshot |
| `DELETE` | `/api/pipeline/{id}` | Delete a snapshot |

**`GET /api/pipeline?leader_id=manan&fiscal_year=2526` Response:**
```json
{
  "data": [
    {
      "id": "...", "leader_id": "manan", "fiscal_year": "2526",
      "label": "Board Plan (May 2025)", "sort_order": 0,
      "green": 45300000, "amber": 26100000, "blue_sky": 2600000, "total": 74000000
    },
    ...
  ]
}
```

---

#### Blue Sky Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bluesky?leader_id={id}&fiscal_year={fy}` | Get blue sky tracking rows |
| `PUT` | `/api/bluesky/{id}` | Update a blue sky entry (remarks, amounts) |

**`GET /api/bluesky?leader_id=manan&fiscal_year=2526` Response:**
```json
{
  "data": [
    {
      "id": "...", "leader_id": "manan", "month": "May 2025", "sort_order": 0,
      "opening": 2639450, "additional": null, "converted": 0, "closing": 2639450,
      "remarks": ""
    }
  ],
  "totals": { "additional": 37087600, "converted": 49423450 }
}
```

---

#### Collections Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/collections?leader_id={id}&fiscal_year={fy}` | Get collections rows |
| `PUT` | `/api/collections/{id}` | Update a collection entry |

**`GET /api/collections?leader_id=manan&fiscal_year=2526` Response:**
```json
{
  "data": [
    {
      "id": "...", "leader_id": "manan", "month": "August 2025", "sort_order": 1,
      "planned": 6340000, "collected": 9485791, "outstanding": null, "variance": 3145791
    }
  ],
  "total_collected": 79357171
}
```

---

#### Action Endpoints (Business Plan Actions)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/actions?leader_id={id}&fiscal_year={fy}` | Get all business plan actions |
| `PUT` | `/api/actions/{id}` | Update action (status, notes, remarks, due_date) |
| `PATCH` | `/api/actions/{id}/status` | Quick status update |

---

#### Task Endpoints (Dynamic User Tasks)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks?leader_id={id}` | Get tasks for a leader |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/{id}` | Update a task |
| `DELETE` | `/api/tasks/{id}` | Delete a task |
| `PATCH` | `/api/tasks/{id}/status` | Quick status update |

**`POST /api/tasks` Request:**
```json
{
  "title": "Follow up with K Raheja",
  "assignee_name": "Manan",
  "client_name": "K Raheja Group",
  "priority": "High",
  "deadline": "2026-07-15",
  "notes": "Regarding outstanding balance"
}
```

---

#### Team Member Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/team?leader_id={id}` | List team members |
| `POST` | `/api/team` | Add team member |
| `PUT` | `/api/team/{id}` | Update team member |
| `DELETE` | `/api/team/{id}` | Remove team member |

---

#### Hiring Requirement Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hiring?leader_id={id}` | List hiring requirements |
| `POST` | `/api/hiring` | Create a hiring requirement |
| `PUT` | `/api/hiring/{id}` | Update a hiring requirement |
| `DELETE` | `/api/hiring/{id}` | Delete a requirement |

---

#### Firmwide / Aggregate Endpoints (Management/Admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/firmwide/summary?fiscal_year={fy}` | Aggregate metrics across all leaders |
| `GET` | `/api/firmwide/leaders?fiscal_year={fy}` | All leaders with their KPIs |
| `GET` | `/api/firmwide/clients?fiscal_year={fy}` | All clients across leaders |
| `GET` | `/api/firmwide/team` | All team members firm-wide |

---

#### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create a user |
| `PUT` | `/api/admin/users/{id}` | Update user (role, active status) |
| `DELETE` | `/api/admin/users/{id}` | Deactivate user |
| `GET` | `/api/admin/settings` | Get app public settings |
| `PUT` | `/api/admin/settings` | Update app settings |

---

### 1.3 Frontend Gaps for Production

The following items are present in the demo but must be addressed before production deployment.

#### Critical Gaps

1. **Hardcoded Mock Data (`leaderData.js`, `leaderData2627.js`)** — These two files (~1,500 lines total) contain every data point in the app. Every component reads directly from these static JS exports. All of this must be replaced with API calls using TanStack Query.

2. **Hardcoded User ID (`MANAN_LEADER_ID`)** — `src/pages/Actions.jsx:12` and `src/App.jsx` hardcode `'69fe2ae7dcf5259c46299cef'`. All leader-scoped queries must derive the leader ID from the authenticated user's `leader_id` field.

3. **Demo Credentials** — `src/pages/Home.jsx` shows `mm@cbva.com / MM` as demo credentials. Remove before production.

4. **No Loading States on Static Data** — Because data is currently imported synchronously, most components have no loading skeleton. When data is fetched from the API, every table/chart needs a loading state (already present in `Actions.jsx` for tasks, but absent everywhere else).

5. **`ClientActionsContext` is In-Memory Only** — `src/lib/ClientActionsContext.jsx` manages client actions and inline edits entirely in React state — there is no API call on create/update. All mutations need `useMutation` hooks wired to the backend.

6. **No Global Error Boundary** — API failures will crash the entire component tree silently. Implement a React `ErrorBoundary` at the router level and per-page.

7. **`GlobalSelectorContext` Does Not Validate Permissions** — Any user can select any leader from the dropdown. The frontend must enforce that a `role=user` can only view their own leader's data; only `admin` and `management` can switch between leaders.

8. **No Token Refresh Logic** — `AuthContext.jsx` checks auth on mount but has no mechanism to refresh an expired JWT silently.

9. **PDF Export Uses Raw DOM** — `html2canvas` + `jsPdf` is used for board pack generation. This is fragile. Consider a server-side PDF generation endpoint.

10. **Base44 SDK Must Be Replaced** — `src/api/base44Client.js` and all `base44.entities.*` calls throughout `Actions.jsx`, `TeamView.jsx`, etc. must be replaced with direct `fetch`/`axios` calls to your FastAPI backend.

#### Important Gaps

11. **No Optimistic Updates** — Inline cell edits in `Clients.jsx` update local state immediately but there is no optimistic update pattern with rollback on error.

12. **No Pagination** — The `firmwide/clients` view will show all engagements across all leaders with no pagination. Large datasets need cursor-based or offset pagination.

13. **No Input Sanitization on Remarks Fields** — Inline remark edits do not strip HTML. Add sanitization before display and before saving.

14. **Currency Unit Confusion** — `TeamEntryDrawer.jsx:23` stores `annual_cost` as a plain INR float, while engagement amounts are in paise integers. The backend must normalize and document this clearly; consider using paise for everything.

---

## Part 2: MongoDB Database Architecture

### 2.1 Schema Design

The following describes the production-ready collection structure. Relationships use **referencing** (ObjectId references) rather than full embedding, except for small, tightly-coupled sub-arrays that are always read together.

---

#### Collection: `users`

```json
{
  "_id": ObjectId,
  "full_name": "Manan Mathuria",
  "email": "mm@cbva.com",
  "password_hash": "$2b$12$...",
  "designation": "Partner",
  "role": "user",
  "leader_id": "manan",
  "is_active": true,
  "last_login": ISODate("2026-06-23T10:00:00Z"),
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `leaders`

```json
{
  "_id": "manan",
  "name": "Manan Mathuria",
  "practice": "Direct Tax",
  "email": "manan@cbva.com",
  "is_active": true,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

> Use the human-readable slug (`"manan"`) as `_id` — it is already used as the stable identifier throughout the frontend and avoids an extra join.

---

#### Collection: `engagements`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2526",
  "num": 1,
  "name": "K Raheja Group",
  "model": "—",
  "rel_partner": "KK",
  "el_status": "Signed",
  "green": 28806130,
  "amber": 1515000,
  "blue_sky": 0,
  "total": 30321130,
  "collected": 28806130,
  "may_col": null,
  "june_col": null,
  "july_col": null,
  "balance": 1515000,
  "remarks": "",
  "is_archived": false,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

> `total` and `balance` are **stored** (not computed at query time) because the frontend always displays them directly and they are edited as a unit. Recompute and overwrite on every PUT.

---

#### Collection: `pipeline_snapshots`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2526",
  "label": "Board Plan (May 2025)",
  "sort_order": 0,
  "green": 45300000,
  "amber": 26100000,
  "blue_sky": 2600000,
  "total": 74000000,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `blue_sky_entries`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2526",
  "month": "May 2025",
  "sort_order": 0,
  "opening": 2639450,
  "additional": null,
  "converted": 0,
  "closing": 2639450,
  "remarks": "",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `collection_entries`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2526",
  "month": "August 2025",
  "sort_order": 1,
  "planned": 6340000,
  "collected": 9485791,
  "outstanding": null,
  "variance": 3145791,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `actions`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2526",
  "num": 1,
  "category": "Taurus",
  "description": "Follow up with Taurus for other Indian clients...",
  "status": "In-Progress",
  "notes": "",
  "remarks": "",
  "due_date": null,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `tasks`

```json
{
  "_id": ObjectId,
  "created_by_id": ObjectId,
  "leader_id": "manan",
  "title": "Follow up with K Raheja",
  "assignee_name": "Manan",
  "client_name": "K Raheja Group",
  "priority": "High",
  "deadline": ISODate("2026-07-15"),
  "notes": "Regarding outstanding balance",
  "status": "Pending",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `team_members`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "full_name": "Rahul Sharma",
  "designation": "Senior Manager",
  "email": "rahul@cbva.com",
  "annual_cost": 1800000,
  "joining_date": ISODate("2025-03-01"),
  "status": "Active",
  "notes": "",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `hiring_requirements`

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "role_title": "Manager",
  "level": "Manager",
  "expected_joining_date": ISODate("2025-03-07"),
  "status": "Filled",
  "expected_cost": 1200000,
  "notes": "1st week of March joining",
  "created_at": ISODate,
  "updated_at": ISODate
}
```

---

#### Collection: `el_summaries` (FY 26-27)

```json
{
  "_id": ObjectId,
  "leader_id": "manan",
  "fiscal_year": "2627",
  "el_signed": 0,
  "el_not_signed": 0,
  "received_till_may": 0,
  "to_receive_june": 0,
  "to_receive_july": 0,
  "pct_collected": null,
  "amber_el_signed": null,
  "amber_el_not_signed": null,
  "amber_received": null,
  "updated_at": ISODate
}
```

---

#### Collection: `app_settings` (singleton)

```json
{
  "_id": "global",
  "public_settings": {
    "app_name": "CBVA Business Plan",
    "active_fiscal_years": ["2526", "2627"],
    "maintenance_mode": false
  },
  "updated_at": ISODate
}
```

---

### 2.2 Recommended MongoDB Indexes

```javascript
// ─── users ────────────────────────────────────────────────────────────────────
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "leader_id": 1 })

// ─── engagements ──────────────────────────────────────────────────────────────
// Primary query: all engagements for a leader in a FY
db.engagements.createIndex({ "leader_id": 1, "fiscal_year": 1, "is_archived": 1 })
// Firmwide client listing (all leaders, one FY)
db.engagements.createIndex({ "fiscal_year": 1, "is_archived": 1 })
// EL status aggregation for firmwide views
db.engagements.createIndex({ "leader_id": 1, "fiscal_year": 1, "el_status": 1 })

// ─── pipeline_snapshots ───────────────────────────────────────────────────────
db.pipeline_snapshots.createIndex({ "leader_id": 1, "fiscal_year": 1, "sort_order": 1 })

// ─── blue_sky_entries ─────────────────────────────────────────────────────────
db.blue_sky_entries.createIndex({ "leader_id": 1, "fiscal_year": 1, "sort_order": 1 })

// ─── collection_entries ───────────────────────────────────────────────────────
db.collection_entries.createIndex({ "leader_id": 1, "fiscal_year": 1, "sort_order": 1 })

// ─── actions ──────────────────────────────────────────────────────────────────
db.actions.createIndex({ "leader_id": 1, "fiscal_year": 1, "num": 1 })

// ─── tasks ────────────────────────────────────────────────────────────────────
db.tasks.createIndex({ "leader_id": 1, "status": 1, "deadline": 1 })
db.tasks.createIndex({ "created_by_id": 1 })

// ─── team_members ─────────────────────────────────────────────────────────────
db.team_members.createIndex({ "leader_id": 1, "status": 1 })

// ─── hiring_requirements ──────────────────────────────────────────────────────
db.hiring_requirements.createIndex({ "leader_id": 1, "status": 1 })
```

---

## Part 3: FastAPI Backend Implementation Strategy

### 3.1 Production Directory Structure

```
cbva-api/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory, CORS, lifespan
│   │
│   ├── core/
│   │   ├── config.py              # Settings via pydantic-settings (.env)
│   │   ├── security.py            # JWT creation, password hashing (bcrypt)
│   │   └── database.py            # Motor async client, db singleton
│   │
│   ├── dependencies/
│   │   ├── auth.py                # get_current_user, require_roles()
│   │   └── pagination.py          # Common skip/limit query params
│   │
│   ├── models/                    # MongoDB document → Python (Motor raw dicts)
│   │   └── (no ORM — use Pydantic directly)
│   │
│   ├── schemas/                   # Pydantic models for request/response
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── leader.py
│   │   ├── engagement.py
│   │   ├── pipeline.py
│   │   ├── bluesky.py
│   │   ├── collection.py
│   │   ├── action.py
│   │   ├── task.py
│   │   ├── team.py
│   │   └── hiring.py
│   │
│   ├── routers/
│   │   ├── auth.py                # /api/auth/*
│   │   ├── leaders.py             # /api/leaders/*
│   │   ├── engagements.py         # /api/engagements/*
│   │   ├── pipeline.py            # /api/pipeline/*
│   │   ├── bluesky.py             # /api/bluesky/*
│   │   ├── collections.py         # /api/collections/*
│   │   ├── actions.py             # /api/actions/*
│   │   ├── tasks.py               # /api/tasks/*
│   │   ├── team.py                # /api/team/*
│   │   ├── hiring.py              # /api/hiring/*
│   │   ├── firmwide.py            # /api/firmwide/*
│   │   └── admin.py               # /api/admin/*
│   │
│   └── services/
│       ├── auth_service.py        # Login, token creation, user lookup
│       ├── engagement_service.py  # Business logic (total/balance computation)
│       └── firmwide_service.py    # Cross-leader aggregate queries
│
├── scripts/
│   └── seed.py                    # One-time data migration from leaderData.js
│
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_engagements.py
│   └── ...
│
├── .env                           # Never commit
├── .env.example
├── requirements.txt
└── Dockerfile
```

---

### 3.2 Pydantic Schema Examples

**`app/schemas/engagement.py`**
```python
from pydantic import BaseModel, Field, computed_field
from typing import Literal, Optional
from datetime import datetime
from bson import ObjectId

ELStatus = Literal["Signed", "Not Signed", "Waived", "NA", "DS", "—"]
FiscalYear = Literal["2526", "2627"]

class EngagementCreate(BaseModel):
    leader_id: str
    fiscal_year: FiscalYear
    name: str = Field(..., min_length=1)
    model: str = "—"
    rel_partner: str = ""
    el_status: ELStatus = "—"
    green: int = Field(0, ge=0)       # paise
    amber: int = Field(0, ge=0)
    blue_sky: int = Field(0, ge=0)
    collected: int = Field(0, ge=0)
    may_col: Optional[int] = None
    june_col: Optional[int] = None
    july_col: Optional[int] = None
    remarks: str = ""

class EngagementUpdate(BaseModel):
    name: Optional[str] = None
    rel_partner: Optional[str] = None
    el_status: Optional[ELStatus] = None
    green: Optional[int] = None
    amber: Optional[int] = None
    blue_sky: Optional[int] = None
    collected: Optional[int] = None
    may_col: Optional[int] = None
    june_col: Optional[int] = None
    july_col: Optional[int] = None
    remarks: Optional[str] = None

class EngagementResponse(BaseModel):
    id: str
    leader_id: str
    fiscal_year: str
    num: int
    name: str
    model: str
    rel_partner: str
    el_status: str
    green: int
    amber: int
    blue_sky: int
    total: int                          # stored: green + amber + blue_sky
    collected: int
    may_col: Optional[int]
    june_col: Optional[int]
    july_col: Optional[int]
    balance: Optional[int]              # stored: total - collected
    remarks: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
```

**`app/schemas/auth.py`**
```python
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserPublic"

class UserPublic(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    leader_id: str | None
    designation: str
```

**`app/schemas/task.py`**
```python
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import date, datetime

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    assignee_name: str = ""
    client_name: str = ""
    priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
    deadline: Optional[date] = None
    notes: str = ""

class TaskStatusPatch(BaseModel):
    status: Literal["Pending", "In Progress", "Done"]
```

---

### 3.3 Security & Authentication Strategy

#### JWT-based Auth Flow

```python
# app/core/security.py
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, role: str, leader_id: str | None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "leader_id": leader_id,
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
```

#### FastAPI Dependency: `get_current_user`

```python
# app/dependencies/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from app.core.database import db

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await db.users.find_one({"_id": ObjectId(user_id), "is_active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    """Dependency factory — enforces RBAC."""
    async def check(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return check
```

#### Role-Based Access Control (RBAC) Matrix

| Resource | `user` | `management` | `admin` |
|----------|--------|--------------|---------|
| Own leader's data (read) | ✅ | ✅ | ✅ |
| Own leader's data (write) | ✅ | ✅ | ✅ |
| Other leader's data (read) | ❌ | ✅ | ✅ |
| Other leader's data (write) | ❌ | ❌ | ✅ |
| Firmwide aggregates | ❌ | ✅ | ✅ |
| Admin panel / users | ❌ | ❌ | ✅ |

#### Enforcing Leader Scoping in Routers

```python
# Example in app/routers/engagements.py
@router.get("/")
async def list_engagements(
    leader_id: str,
    fiscal_year: str,
    current_user=Depends(get_current_user)
):
    # Non-admin users can only query their own leader
    if current_user["role"] == "user" and current_user["leader_id"] != leader_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cursor = db.engagements.find({
        "leader_id": leader_id,
        "fiscal_year": fiscal_year,
        "is_archived": False
    }).sort("num", 1)
    docs = await cursor.to_list(length=500)
    return {"data": [serialize(d) for d in docs]}
```

---

### 3.4 Core Configuration

**`app/core/config.py`**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "cbva"
    SECRET_KEY: str                             # Generate with: openssl rand -hex 32
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

settings = Settings()
```

**`app/core/database.py`**
```python
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

async def close_db():
    client.close()
```

**`app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import connect_db, close_db
from app.routers import auth, leaders, engagements, pipeline, bluesky, collections, actions, tasks, team, hiring, firmwide, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(title="CBVA API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(leaders.router,     prefix="/api/leaders",     tags=["Leaders"])
app.include_router(engagements.router, prefix="/api/engagements", tags=["Engagements"])
app.include_router(pipeline.router,    prefix="/api/pipeline",    tags=["Pipeline"])
app.include_router(bluesky.router,     prefix="/api/bluesky",     tags=["BlueSky"])
app.include_router(collections.router, prefix="/api/collections", tags=["Collections"])
app.include_router(actions.router,     prefix="/api/actions",     tags=["Actions"])
app.include_router(tasks.router,       prefix="/api/tasks",       tags=["Tasks"])
app.include_router(team.router,        prefix="/api/team",        tags=["Team"])
app.include_router(hiring.router,      prefix="/api/hiring",      tags=["Hiring"])
app.include_router(firmwide.router,    prefix="/api/firmwide",    tags=["Firmwide"])
app.include_router(admin.router,       prefix="/api/admin",       tags=["Admin"])
```

---

### 3.5 Step-by-Step Backend Roadmap

Work through these phases in order. Each phase produces a runnable, testable artifact.

---

#### Phase 0: Project Scaffold (Day 1)

1. Create the directory structure above.
2. Install dependencies:
   ```
   fastapi uvicorn[standard] motor pydantic[email] pydantic-settings
   python-jose[cryptography] passlib[bcrypt] python-multipart pytest pytest-asyncio httpx
   ```
3. Write `app/core/config.py` and `.env.example`.
4. Write `app/core/database.py` with `connect_db` / `close_db`.
5. Write the bare `app/main.py` with lifespan and CORS. Verify: `uvicorn app.main:app --reload` starts with no errors and `GET /docs` loads.

---

#### Phase 1: Authentication (Day 1–2)

1. Write `app/core/security.py` — `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`.
2. Write `app/schemas/auth.py` — `LoginRequest`, `TokenResponse`, `UserPublic`.
3. Write `app/routers/auth.py`:
   - `POST /api/auth/login` — look up user by email, verify password, return JWTs.
   - `GET /api/auth/me` — return current user from token.
   - `POST /api/auth/refresh` — validate refresh token, issue new access token.
4. Write `app/dependencies/auth.py` — `get_current_user`, `require_roles()`.
5. Seed the first admin user manually via a script or MongoDB Compass.
6. **Update the frontend:** Replace the Base44 auth in `AuthContext.jsx`:
   - On login form submit → `POST /api/auth/login` → store `access_token` in `localStorage`.
   - On app load → `GET /api/auth/me` using the stored token.
   - On 401 response → clear token and redirect to `/home`.

---

#### Phase 2: Data Migration Script (Day 2–3)

Before writing any more backend, migrate the hardcoded `leaderData.js` into MongoDB. This gives you real data to test against.

1. Write `scripts/seed.py` in Python:
   - Parse (or copy-translate) each constant from `leaderData.js` and `leaderData2627.js`.
   - Insert into `leaders`, `engagements`, `pipeline_snapshots`, `blue_sky_entries`, `collection_entries`, and `actions` collections.
   - This script is idempotent — use `update_one` with `upsert=True`.
2. Run: `python -m scripts.seed`
3. Verify in MongoDB Compass that all 9 leaders' data is present.

---

#### Phase 3: Leaders & Engagements API (Day 3–4)

1. Write `app/schemas/leader.py` and `app/schemas/engagement.py`.
2. Write `app/routers/leaders.py` — GET list, GET by ID.
3. Write `app/services/engagement_service.py`:
   - `compute_totals(data)` — calculates `total` and `balance` from component fields.
4. Write `app/routers/engagements.py`:
   - `GET /api/engagements` — filter by `leader_id`, `fiscal_year`, `is_archived`.
   - `POST /api/engagements` — create, auto-assign `num` (max existing + 1), compute totals.
   - `PUT /api/engagements/{id}` — partial update, recompute totals.
   - `DELETE /api/engagements/{id}` — set `is_archived: true`.
5. **Update the frontend:** Replace `src/lib/ClientActionsContext.jsx` and the static `MANAN_CLIENTS` etc. in `Clients.jsx` with TanStack Query hooks:
   ```javascript
   // src/hooks/useEngagements.js
   export const useEngagements = (leaderId, fiscalYear) =>
     useQuery({
       queryKey: ['engagements', leaderId, fiscalYear],
       queryFn: () => api.get(`/engagements?leader_id=${leaderId}&fiscal_year=${fiscalYear}`)
     });
   ```

---

#### Phase 4: Dashboard Data APIs (Day 4–5)

Build these in this order — they are all read-heavy with occasional admin writes.

1. **Pipeline** — `GET /api/pipeline`, `PUT /api/pipeline/{id}`.
2. **Blue Sky** — `GET /api/bluesky`, `PUT /api/bluesky/{id}`.
3. **Collections** — `GET /api/collections`, `PUT /api/collections/{id}`.
4. **EL Summaries** — `GET /api/el-summary?leader_id={id}&fiscal_year=2627`.

**Update the frontend:** In `LeaderDashboard.jsx` and `LeaderPipeline.jsx`, replace:
```javascript
// BEFORE (static import):
import { MANAN_PIPELINE } from '@/lib/leaderData';

// AFTER (API fetch):
const { data: pipelineData, isLoading } = useQuery({
  queryKey: ['pipeline', selectedLeaderId, activeFY],
  queryFn: () => api.get(`/pipeline?leader_id=${selectedLeaderId}&fiscal_year=${activeFY}`)
});
```

---

#### Phase 5: Actions & Tasks (Day 5–6)

1. Write `app/routers/actions.py`:
   - `GET /api/actions?leader_id={id}&fiscal_year={fy}` — list, sorted by `num`.
   - `PUT /api/actions/{id}` — update status, notes, remarks, due_date.
   - `PATCH /api/actions/{id}/status` — quick status-only update.
2. Write `app/routers/tasks.py`:
   - Full CRUD. On `POST`, inject `created_by_id` from `current_user["_id"]` and `leader_id` from `current_user["leader_id"]`.
3. **Update the frontend `Actions.jsx`:** Replace the hardcoded `MANAN_LEADER_ID` constant with `user.leader_id` from `useAuth()`. Replace `base44.entities.Task.filter(...)` and `base44.entities.Task.create(...)` with API calls.

---

#### Phase 6: Team & Hiring (Day 6–7)

1. Write `app/routers/team.py` — full CRUD for `TeamMember`.
2. Write `app/routers/hiring.py` — full CRUD for `HiringRequirement`.
3. **Update the frontend `TeamView.jsx`:** Replace `base44.entities.TeamMember.*` and `base44.entities.HiringRequirement.*` calls with API calls. The `TeamEntryDrawer` already has the correct form shape — just wire the save handlers to `useMutation`.

---

#### Phase 7: Firmwide Aggregates (Day 7–8)

These endpoints are management/admin-only and use MongoDB aggregation pipelines.

```python
# app/services/firmwide_service.py
async def get_firmwide_summary(fiscal_year: str) -> dict:
    pipeline = [
        {"$match": {"fiscal_year": fiscal_year, "is_archived": False}},
        {"$group": {
            "_id": "$leader_id",
            "total_green": {"$sum": "$green"},
            "total_amber": {"$sum": "$amber"},
            "total_blue_sky": {"$sum": "$blue_sky"},
            "total_pipeline": {"$sum": "$total"},
            "total_collected": {"$sum": "$collected"},
            "engagement_count": {"$sum": 1},
            "el_signed_count": {"$sum": {"$cond": [{"$eq": ["$el_status", "Signed"]}, 1, 0]}}
        }},
        {"$sort": {"total_pipeline": -1}}
    ]
    return await db.engagements.aggregate(pipeline).to_list(length=20)
```

Protect all `/api/firmwide/*` routes with `require_roles("management", "admin")`.

---

#### Phase 8: Admin Panel (Day 8–9)

1. Write `app/routers/admin.py`:
   - `GET /api/admin/users` — list all users.
   - `POST /api/admin/users` — create user (with hashed password).
   - `PUT /api/admin/users/{id}` — update role, active status, linked leader.
   - `GET /api/admin/settings` / `PUT /api/admin/settings` — app-wide config.
2. Protect all admin routes with `require_roles("admin")`.
3. **Update `AdminSettings.jsx`** to fetch and update settings via the admin endpoints.

---

#### Phase 9: Frontend Hardening (Day 9–11)

With all APIs live, address the Frontend Gaps identified in Part 1:

1. **Create a central Axios/Fetch client** (`src/api/client.js`):
   - Attaches `Authorization: Bearer <token>` header on every request.
   - On 401 response, calls `refreshToken()` once, retries, then logs out.
   - Wraps all errors in a consistent shape.

2. **Remove all Base44 SDK imports.** Delete `src/api/base44Client.js`.

3. **Enforce leader scoping in `GlobalSelectorContext`**: After loading the user, set the initial `selectedLeaderId` from `user.leader_id`. Only render the leader dropdown if `user.role !== 'user'`.

4. **Add an `ErrorBoundary`** in `App.jsx` wrapping all routes.

5. **Add loading skeletons** to every page that currently reads from static data (Dashboard, Pipeline, Clients, Collections, TeamView, Actions).

6. **Remove demo credentials** from `Home.jsx`.

---

#### Phase 10: Production Hardening (Day 11–14)

1. **Rate Limiting** — Use `slowapi` to rate-limit `/api/auth/login` (5 req/min per IP).
2. **Refresh Token Rotation** — Store refresh tokens in the `users` collection as a hashed list; invalidate on logout.
3. **HTTPS Only** — Deploy behind nginx or a load balancer with TLS termination.
4. **Environment Variables** — All secrets in `.env`, never committed. Use `python-dotenv` or Docker secrets.
5. **Logging** — Add structured logging with `loguru` on all router errors and auth events.
6. **Docker** — Write a `Dockerfile` and `docker-compose.yml` for local dev (api + mongo).
7. **Tests** — Write integration tests using `pytest-asyncio` + `httpx.AsyncClient` with a dedicated test database. At minimum test: login flow, engagement CRUD, leader scoping enforcement.

---

## Quick Reference: Frontend ↔ Backend Wiring Summary

| Frontend File | Static Data Source (to remove) | Replace With |
|---|---|---|
| `LeaderDashboard.jsx` | `MANAN_PIPELINE`, `MANAN_BLUESKY`, etc. | `GET /api/pipeline`, `/api/bluesky`, `/api/collections` |
| `Clients.jsx` | `leader.clients` from `leaderData` | `GET /api/engagements` |
| `ClientActionsContext.jsx` | In-memory React state | `useMutation` → `PUT /api/engagements/{id}` |
| `Actions.jsx` | `leader.actions` + `base44.entities.Task` | `GET /api/actions` + `GET /api/tasks` |
| `TeamView.jsx` | `base44.entities.TeamMember`, `HiringRequirement` | `GET /api/team`, `GET /api/hiring` |
| `AuthContext.jsx` | `base44.auth.*` | `POST /api/auth/login`, `GET /api/auth/me` |
| `FirmwideDashboard.jsx` | Aggregated from `leaderData` | `GET /api/firmwide/summary` |
| `LeaderFYSelector.jsx` | `ALL_LEADERS` constant | `GET /api/leaders` |
| `AppLayout.jsx` | Hardcoded nav items by role | Role from `user.role` (already correct) |
