# Phase 4 — CRM Architecture Design

> Status: DRAFT v2 (refined) | Branch: feature/phase-4-crm
> Date: 2026-02-24

---

## 0. Architectural Decisions (ADR Summary)

### ADR-1: Lead is the Aggregate Root — CONFIRMED

Lead is the **sole aggregate root** of the CRM sales pipeline.

**Rationale:**
Every CRM interaction converges on the question "will this person buy this parcel?"
That question is the Lead. ContactRequest is an **intake boundary** — it exists
before a Lead, but the moment it receives human attention (assigned, in_progress),
it spawns a Lead. After that, the Lead owns the lifecycle.

**Aggregate boundary rules:**
1. All state mutations to the sales pipeline flow through `LeadService`.
2. LeadStatusHistory is a **value object collection** — never modified independently.
3. Task and Note are **associated entities**, not children. They can exist without
   a lead_id (standalone tasks, parcel notes), but when attached to a lead, the
   Lead governs their lifecycle (lead archived → tasks cancelled).
4. ContactRequest is **not** inside the Lead aggregate. It is an independent
   intake entity with its own status machine (`new → assigned → in_progress →
   completed`). When its status reaches `assigned`, a Lead is created with a
   back-reference (`lead.contact_request_id`). After that, the ContactRequest
   becomes read-only context — the Lead drives forward.
5. Offer is **not** inside the Lead aggregate. Offers live in the parcel domain
   (user → parcel negotiation). A Lead may reference an Offer's outcome, but
   Offer has its own lifecycle (pending → accepted/rejected/countered/expired).

**Consequence:** There is exactly one service (`LeadService`) that can transition
lead status. No other service writes to `crm.leads.status` directly.

```
                    ┌──────────────────────────────────┐
                    │      LEAD (Aggregate Root)        │
                    │                                   │
                    │  parcel_id, status, score,        │
                    │  assigned_to, user_id             │
                    │                              │
                    │  ┌──────────────────────┐    │
                    │  │ LeadStatusHistory[]  │    │  ← value objects, append-only
                    │  └──────────────────────┘    │
                    └──────────┬───────────────────┘
                               │ governs lifecycle
                    ┌──────────┼───────────────────┐
                    │          │                    │
               Task (linked)  Note (linked)   Appointment (linked)
               can be standalone  can be standalone  can be standalone

    ┌──────────────────┐                    ┌──────────────┐
    │ ContactRequest   │──── spawns ──────→ │    Lead      │
    │ (intake boundary)│                    │              │
    │ own status machine│←── back-ref ──── │ contact_req_id│
    └──────────────────┘                    └──────────────┘

    ┌──────────────────┐
    │ Offer            │  independent aggregate (parcel domain)
    │ own status machine│  Lead reads outcome, does not own it
    └──────────────────┘
```

### ADR-2: Payment → Lead Propagation — Direct Service Call

**Decision: Direct service call via injectable hook. No polling. No event table.**

**Why not the other two options:**

| Option | Rejected Because |
|---|---|
| Domain event table (poll PaymentLedger) | PaymentLedger already records events for audit, but nothing actively reads it for CRM side-effects. Polling adds 1-60s latency which is unacceptable — consultant sees "deposit received" note only after the next poll cycle. Also requires a new worker process. |
| Polling worker | Same latency problem. Adds operational complexity (cron, health checks, failure recovery). Overkill for a monolith where services are in the same process. |
| Direct service call | Immediate. Zero latency. Debuggable (stack trace shows the full call path). Consistent with the monolith's synchronous model. |

**Implementation pattern — `CrmEventHook`:**

```
PaymentService                          CrmEventHook (injected via token)
     │                                       │
     │  1. commit payment TX                 │
     │  2. record POS result                 │
     │  3. this.crmHook?.onPaymentEvent()───→│  4. find lead by userId+parcelId
     │                                       │  5. create note on lead
     │                                       │  6. update lead status if applicable
     │                                       │  7. audit log
     │  ← returns (fire-and-forget is OK)    │
```

**Coupling rules:**
- `CrmEventHook` is a lightweight interface defined in CRM module.
- PaymentService receives it via `@Optional() @Inject(CRM_EVENT_HOOK)`.
- If CRM module is not loaded (e.g., in auction-service), the hook is `undefined` — no crash.
- CRM module registers the hook provider. Payments module does **not** import CRM module.
- The hook call is **after** the payment transaction commits. CRM failure does not
  roll back the payment. The hook logs errors and continues.

**Same pattern applies to Listings → CRM:**
- `ParcelService.updateStatus()` calls `this.crmHook?.onParcelStatusChange()`
  after committing the status history record.
- CRM hook checks if a Lead exists for that parcel and updates accordingly.

**Hook methods (interface contract):**
```
CRM_EVENT_HOOK:
  onPaymentEvent(paymentId, userId, parcelId, event: LedgerEvent): void
  onParcelStatusChange(parcelId, fromStatus, toStatus, changedBy): void
```

Both are fire-and-forget from the caller's perspective. Both log to
`admin.audit_log` on the CRM side.

---

## 0.1 Current State Assessment

The `crm` schema and module already exist with **7 entities** but **no controllers or services**.

| Exists | Missing |
|--------|---------|
| ContactRequest, Appointment, Offer, OfferResponse | Controllers, Services for all CRM entities |
| NotificationQueue, NotificationLog | Notification dispatch worker |
| UserActivityLog | Task management system |
| — | Notes/comments system |
| — | Lead pipeline & scoring |
| — | CRM dashboard aggregations |

Phase 4 activates the CRM module: wires services, adds missing entities, and exposes endpoints.

---

## 1. Domain Model

### 1.1 New Entities

```
crm.leads
  id              uuid PK DEFAULT gen_random_uuid()
  contact_request_id  uuid FK → crm.contact_requests(id), NULLABLE
  user_id         uuid FK → auth.users(id), NULLABLE
  parcel_id       uuid FK → listings.parcels(id), NULLABLE   -- the parcel this lead is about
  source          crm.lead_source ENUM (website, phone, referral, walk_in, campaign, import)
  status          crm.lead_status ENUM (new, contacted, qualified, proposal, negotiation, won, lost)
  score           smallint DEFAULT 0  -- 0-100
  assigned_to     uuid FK → auth.users(id), NULLABLE
  lost_reason     varchar, NULLABLE
  metadata        jsonb DEFAULT '{}'
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()

  NOTE: won_parcel_id removed. parcel_id is set at creation (from ContactRequest
  or manual). When lead status → 'won', the parcel_id is already known. No need
  for a separate column — the lead's parcel_id IS the parcel they're buying.

crm.lead_status_history                          -- APPEND-ONLY
  id              uuid PK DEFAULT gen_random_uuid()
  lead_id         uuid FK → crm.leads(id)
  from_status     crm.lead_status, NULLABLE
  to_status       crm.lead_status
  changed_by      uuid FK → auth.users(id)
  reason          varchar, NULLABLE
  created_at      timestamptz DEFAULT now()

crm.tasks
  id              uuid PK DEFAULT gen_random_uuid()
  title           varchar NOT NULL
  description     text, NULLABLE
  status          crm.task_status ENUM (pending, in_progress, completed, cancelled)
  priority        crm.task_priority ENUM (low, medium, high, urgent)
  due_date        timestamptz, NULLABLE
  assigned_to     uuid FK → auth.users(id)
  created_by      uuid FK → auth.users(id)
  lead_id         uuid FK → crm.leads(id), NULLABLE
  parcel_id       uuid FK → listings.parcels(id), NULLABLE
  contact_request_id  uuid FK → crm.contact_requests(id), NULLABLE
  completed_at    timestamptz, NULLABLE
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()

crm.notes
  id              uuid PK DEFAULT gen_random_uuid()
  body            text NOT NULL
  author_id       uuid FK → auth.users(id)
  lead_id         uuid FK → crm.leads(id), NULLABLE
  contact_request_id  uuid FK → crm.contact_requests(id), NULLABLE
  parcel_id       uuid FK → listings.parcels(id), NULLABLE
  user_id         uuid FK → auth.users(id), NULLABLE   -- about which user
  is_internal     boolean DEFAULT true                  -- hidden from customer
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()

  CONSTRAINT at_least_one_target
    CHECK (lead_id IS NOT NULL OR contact_request_id IS NOT NULL
           OR parcel_id IS NOT NULL OR user_id IS NOT NULL)
```

### 1.2 New Enums

```sql
CREATE TYPE crm.lead_source   AS ENUM ('website','phone','referral','walk_in','campaign','import');
CREATE TYPE crm.lead_status   AS ENUM ('new','contacted','qualified','proposal','negotiation','won','lost');
CREATE TYPE crm.task_status   AS ENUM ('pending','in_progress','completed','cancelled');
CREATE TYPE crm.task_priority AS ENUM ('low','medium','high','urgent');
```

### 1.3 Aggregates & Ownership

See **ADR-1** (Section 0) for full rationale. Summary:

```
Lead Aggregate (root = Lead)
├── LeadStatusHistory[]     -- append-only value objects, never independent
├── Task[]                  -- linked (can also be standalone if lead_id IS NULL)
├── Note[]                  -- linked (can also be standalone if lead_id IS NULL)
└── Appointment[]           -- linked via contact_request or direct

Intake Boundary (independent):
└── ContactRequest          -- own status machine, spawns Lead on assignment

Negotiation Boundary (independent):
└── Offer / OfferResponse   -- parcel domain, Lead reads outcome

Infrastructure (independent):
├── NotificationQueue / NotificationLog
└── UserActivityLog
```

**Lifecycle rule:** When a Lead moves to `won` or `lost`, all linked tasks with
status `pending` are auto-cancelled. Notes are preserved (immutable context).
Appointments are not affected (they have their own status).

### 1.4 Cross-Module Dependencies

```
CRM reads from:
  auth        → User, UserRole (consultant/dealer resolution)
  listings    → Parcel (read-only: title, status, price, assignedConsultant)
  payments    → Payment, Deposit (read-only: payment history for lead context)
  campaigns   → Campaign (read-only: active campaign on parcel)

CRM writes to:
  crm.*       → All CRM tables (full ownership)
  admin.audit_log → Via AuditLogService (append-only)

CRM receives hooks from (see ADR-2):
  payments    → CrmEventHook.onPaymentEvent()     -- after payment TX commit
  listings    → CrmEventHook.onParcelStatusChange() -- after status history commit

No other module writes to crm.* tables.
Hook calls are fire-and-forget: CRM failure never blocks payment/listing operations.
```

---

## 2. Event Flow

Propagation mechanism: **direct service call via `CrmEventHook`** (see ADR-2).
No EventEmitter. No polling. No domain event table consumption.

### 2.1 Inbound Hooks (other modules → CRM)

These are synchronous calls made **after** the source module commits its transaction.
CRM failure is logged but never blocks the caller.

| Source | Trigger Point | Hook Call | CRM Action |
|---|---|---|---|
| Payments | After `recordPosResult()` commits | `onPaymentEvent(paymentId, userId, parcelId, PAYMENT_COMPLETED)` | Find lead by `(user_id = $userId AND parcel_id = $parcelId)`. If found: create note "Payment completed", update status → `won`, cancel pending tasks. |
| Payments | After deposit TX commits | `onPaymentEvent(paymentId, userId, parcelId, DEPOSIT_COLLECTED)` | Find lead by same lookup. If found: create note "Deposit received", update status → `negotiation` if currently `qualified` or earlier. |
| Payments | After refund TX commits | `onPaymentEvent(paymentId, userId, parcelId, DEPOSIT_REFUNDED)` | Find lead by same lookup. If found: create note "Deposit refunded", reopen lead to `contacted`. |
| Listings | After `updateStatus()` commits | `onParcelStatusChange(parcelId, from, to, changedBy)` | `active`: create task "Prepare listing" for assigned consultant. `deposit_taken`: update linked leads → `negotiation`. `sold`: update linked leads → `won`. `withdrawn`: flag open leads, notify consultant. |

### 2.2 Internal CRM Events (CRM → CRM)

These happen **within** CRM service methods. No hook needed — same module.

| Trigger | Action |
|---|---|
| ContactRequest status → `assigned` | `LeadService.createFromContactRequest()` — creates Lead with back-reference, same TX. |
| Lead status change (any) | `LeadStatusHistory` row appended in same TX. If terminal (`won`/`lost`): cancel pending tasks. |
| Task overdue detection | Future cron queries `tasks WHERE due_date < now() AND status = 'pending'`. Queues notification. |
| Appointment → `no_show` | `AppointmentService` calls `TaskService.create()` + `NoteService.create()` directly. |

### 2.3 What About Admin → CRM (Parcel Reassignment)?

Parcel consultant reassignment (`listings.parcels.assigned_consultant` change) is
currently done via `ParcelService.update()`. This already writes to `admin.audit_log`.

CRM handles this **on read**: when loading leads for a consultant, the query joins
against `listings.parcels.assigned_consultant` to verify current assignment. No hook
needed — the source of truth is the parcel's `assigned_consultant` column.

Bulk reassignment (transfer all leads from consultant A to B) is an **admin-only
CRM endpoint** (`PATCH /crm/leads/bulk-reassign`) that directly updates `crm.leads.assigned_to`.

---

## 3. Data Model Strategy

### 3.1 Schema: `crm.*` (Existing, Separate)

The `crm` schema already exists. All new tables go here. No shared-schema pollution.

```
crm.contact_requests     -- EXISTS
crm.appointments         -- EXISTS
crm.offers               -- EXISTS
crm.offer_responses      -- EXISTS
crm.notification_queue   -- EXISTS
crm.notification_log     -- EXISTS
crm.user_activity_log    -- EXISTS
crm.leads                -- NEW
crm.lead_status_history  -- NEW (append-only)
crm.tasks                -- NEW
crm.notes                -- NEW
```

### 3.2 Read Models vs Write Models

No CQRS separation. Single model for reads and writes, consistent with the rest of the codebase.

**Dashboard queries** use raw SQL or QueryBuilder with aggregations — not materialized views. If performance degrades beyond acceptable thresholds, introduce materialized views at that point.

### 3.3 Audit Trail

| Table | Strategy |
|---|---|
| `crm.lead_status_history` | Append-only (DB trigger, same as DepositTransition) |
| `crm.notes` | Soft-mutable (updated_at tracked, no delete from API) |
| `crm.tasks` | Mutable with audit via `admin.audit_log` |
| All CRM write operations | Logged to `admin.audit_log` via AuditLogService |

New DB trigger for `crm.lead_status_history`:
```sql
CREATE TRIGGER lead_status_history_append_only
  BEFORE UPDATE OR DELETE ON crm.lead_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_modification();
```

Reuses the existing `prevent_modification()` function from migration 012.

---

## 4. Scalability Considerations

### 4.1 Expected Cardinality (Year 1 → Year 3)

**Assumptions:** ~30 consultants, ~1000 active parcels, ~10K registered users, ~1K DAU.

| Table | Year 1 | Year 3 | Growth Pattern | Rationale |
|---|---|---|---|---|
| leads | 5K | 50K | Linear | ~1000 parcels * 10 inquiries/yr * 50% convert to lead |
| lead_status_history | 25K | 300K | 5-6x leads | avg 5.5 transitions per lead lifecycle |
| tasks | 10K | 80K | 2x leads + standalone | ~2 tasks/lead + ~500 standalone/yr |
| notes | 15K | 150K | 3x leads + parcel | ~3 notes/lead + parcel-level notes |
| contact_requests | 8K | 60K | Inbound | Not all become leads (anonymous, spam) |
| appointments | 2K | 15K | 25% of leads | Subset: qualified leads get meetings |
| offers | 1K | 10K | 15% of leads | Subset: leads in proposal/negotiation |
| notification_queue | 20K | 200K | Multi-channel | ~4 notifications per lead lifecycle |
| notification_log | 20K | 200K | 1:1 with queue | Archive of dispatched notifications |
| user_activity_log | 500K | 5M | High volume | ~1K DAU * 10 actions * 365 days. **Partition candidate at 10M+** |

**Task volume per consultant (Year 3):**
- ~50K leads / 30 consultants = ~1,700 lifetime leads per consultant
- ~1,700 * 2 tasks + ~50 standalone/yr * 3yr = ~3,550 lifetime tasks per consultant
- **Active at any time: 20-40 open tasks** (this is the hot-path query)

**Notes growth:** Linear with lead volume. No exponential risk.
Notes are text-only (no attachments in Phase 4), so row size stays small (~500 bytes avg).

### 4.2 Index Strategy — Confirmed for 4 Required Patterns

#### Pattern A: `assigned_to + status` (consultant's work queue)

This is the **highest-frequency query** in the CRM. Every consultant page load hits it.

```sql
-- Leads: "My pipeline" — consultant's active leads grouped by status
CREATE INDEX idx_leads_consultant_pipeline
  ON crm.leads(assigned_to, status)
  WHERE status NOT IN ('won', 'lost');
-- Covers: WHERE assigned_to = $1 AND status NOT IN ('won','lost')
-- At 50K leads, ~60% are won/lost → partial index holds ~20K rows
-- Per consultant (~30): ~670 rows scanned. No perf concern.

-- Tasks: "My open tasks"
CREATE INDEX idx_tasks_consultant_open
  ON crm.tasks(assigned_to, status)
  WHERE status IN ('pending', 'in_progress');
-- Per consultant: ~30 rows. Instant.

-- Contact requests: "My assigned contacts"
CREATE INDEX idx_cr_consultant_active
  ON crm.contact_requests(assigned_to, status)
  WHERE assigned_to IS NOT NULL AND status IN ('new', 'assigned', 'in_progress');
```

#### Pattern B: `created_at DESC` (timeline/pagination)

```sql
-- Leads: global list sorted by newest (admin dashboard)
CREATE INDEX idx_leads_created_desc
  ON crm.leads(created_at DESC);
-- At 50K rows, LIMIT 20 OFFSET N is fine with this index.
-- For consultant-scoped queries, Pattern A index + ORDER BY created_at
-- uses a bitmap scan — no separate composite needed under 50K.

-- Notes: per-entity timeline (always filtered by parent first)
-- No standalone created_at index needed. The parent FK indexes
-- (lead_id, contact_request_id, parcel_id) handle the filter;
-- ORDER BY created_at on <200 matching rows is in-memory sort.

-- user_activity_log: per-user timeline
CREATE INDEX idx_ual_user_timeline
  ON crm.user_activity_log(user_id, created_at DESC);
-- At 5M rows, this composite is essential. Covers the common query:
-- WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
```

#### Pattern C: `parcel_id` (CRM data for a specific property)

```sql
-- Leads: "All leads interested in this parcel"
CREATE INDEX idx_leads_parcel
  ON crm.leads(parcel_id)
  WHERE parcel_id IS NOT NULL;
-- ~70% of leads have a parcel_id (parcel_inquiry type).
-- General/walk-in leads may have NULL parcel_id initially.

-- Contact requests: by parcel
CREATE INDEX idx_cr_parcel
  ON crm.contact_requests(parcel_id)
  WHERE parcel_id IS NOT NULL;

-- Tasks: by parcel
CREATE INDEX idx_tasks_parcel
  ON crm.tasks(parcel_id)
  WHERE parcel_id IS NOT NULL;

-- Notes: by parcel
CREATE INDEX idx_notes_parcel
  ON crm.notes(parcel_id)
  WHERE parcel_id IS NOT NULL;

-- Offers: by parcel (already exists? verify in migration, add if missing)
CREATE INDEX idx_offers_parcel
  ON crm.offers(parcel_id);
```

#### Pattern D: `user_id` (CRM data for a specific customer)

```sql
-- Leads: "All leads for this user" (customer profile view)
CREATE INDEX idx_leads_user
  ON crm.leads(user_id)
  WHERE user_id IS NOT NULL;
-- Most leads have a user_id (~80%). Partial index saves ~20% space.

-- Notes: about a specific user (internal notes on customer)
CREATE INDEX idx_notes_user
  ON crm.notes(user_id)
  WHERE user_id IS NOT NULL;

-- Contact requests: by user (login user's own requests)
CREATE INDEX idx_cr_user
  ON crm.contact_requests(user_id)
  WHERE user_id IS NOT NULL;

-- Offers: by user
CREATE INDEX idx_offers_user
  ON crm.offers(user_id);

-- user_activity_log: already covered by idx_ual_user_timeline above.
```

#### Supporting Indexes (unchanged)

```sql
-- Lead internals
CREATE INDEX idx_leads_source          ON crm.leads(source);
CREATE INDEX idx_leads_contact_req     ON crm.leads(contact_request_id) WHERE contact_request_id IS NOT NULL;
CREATE INDEX idx_leads_score           ON crm.leads(score DESC) WHERE status NOT IN ('won', 'lost');

-- Lead status history (timeline per lead)
CREATE INDEX idx_lsh_lead_timeline     ON crm.lead_status_history(lead_id, created_at DESC);

-- Tasks: overdue detection (cron)
CREATE INDEX idx_tasks_overdue
  ON crm.tasks(due_date)
  WHERE status IN ('pending', 'in_progress') AND due_date IS NOT NULL;

-- Tasks: by lead
CREATE INDEX idx_tasks_lead            ON crm.tasks(lead_id) WHERE lead_id IS NOT NULL;

-- Notes: by lead, by contact_request, by author
CREATE INDEX idx_notes_lead            ON crm.notes(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_notes_contact_req     ON crm.notes(contact_request_id) WHERE contact_request_id IS NOT NULL;
CREATE INDEX idx_notes_author          ON crm.notes(author_id, created_at DESC);

-- user_activity_log: resource lookup
CREATE INDEX idx_ual_resource          ON crm.user_activity_log(resource_type, resource_id);

-- notification_queue: dispatch worker
CREATE INDEX idx_nq_dispatch
  ON crm.notification_queue(status, scheduled_for)
  WHERE status IN ('queued', 'sending');
```

**Total new indexes: 24.** All use `CREATE INDEX CONCURRENTLY` for zero-downtime.
All partial indexes have `WHERE` clauses excluding closed/null data to minimize index size.

### 4.3 Hot-Path Queries

| Query | Frequency | Index Used | Est. Rows Scanned |
|---|---|---|---|
| "My open tasks" | Very high (every page load) | `idx_tasks_consultant_open` | ~30/consultant |
| "My leads pipeline" | High (CRM home) | `idx_leads_consultant_pipeline` | ~670/consultant |
| "Lead detail" (+ notes + tasks + history) | High | 4 FK indexes | <50 per lookup |
| "Contact inbox" (status=new) | High | `idx_cr_consultant_active` | <100 |
| "Parcel CRM view" (leads + notes + tasks for parcel) | Medium | `idx_cr_parcel` + FK joins | <200 |
| "Customer profile" (leads + activity for user) | Medium | `idx_leads_user` + `idx_ual_user_timeline` | <100 + LIMIT |
| "Dashboard stats" (counts by status) | Medium | `idx_leads_consultant_pipeline` (count scan) | <20K |
| "Overdue tasks" (cron) | Low (1x/hour) | `idx_tasks_overdue` | <500 |
| "Activity feed" | Low | `idx_ual_user_timeline` | LIMIT 50 |

---

## 5. Security Model

### 5.1 Role Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ superadmin (role_id=1)                                          │
│  Full CRM access. Can reassign leads/tasks across consultants.  │
│  Can view all notes (including internal).                       │
│  Can delete/archive leads.                                      │
│  Can access dashboard aggregations across all users.            │
├─────────────────────────────────────────────────────────────────┤
│ admin (role_id=2)                                               │
│  Same as superadmin for CRM, except:                            │
│  - Cannot modify system settings                                │
│  - Cannot delete audit trail entries (impossible anyway)         │
├─────────────────────────────────────────────────────────────────┤
│ consultant (role_id=4)                                          │
│  Can view/manage only:                                          │
│  - Leads assigned to them                                       │
│  - Tasks assigned to them                                       │
│  - Contact requests assigned to them                            │
│  - Notes they authored OR on their assigned leads/contacts      │
│  - Appointments where they are the consultant                   │
│  Cannot reassign leads to other consultants.                    │
│  Cannot view dashboard aggregations for other consultants.      │
├─────────────────────────────────────────────────────────────────┤
│ dealer (role_id=5)                                              │
│  Can view:                                                      │
│  - Contact requests on their own parcels                        │
│  - Offers on their own parcels                                  │
│  Cannot access leads, tasks, or notes.                          │
│  Cannot access CRM dashboard.                                   │
├─────────────────────────────────────────────────────────────────┤
│ user (role_id=3)                                                │
│  No CRM access.                                                 │
│  Interacts via public endpoints:                                │
│  - Submit contact request                                       │
│  - Create/withdraw offer                                        │
│  - View own appointments                                        │
│  - View own notification history                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Enforcement Pattern

```
Controller level:  @Roles('admin', 'consultant')  → RolesGuard
Service level:     Ownership check via assigned_to === currentUser.id
                   (for consultant role, enforced in service methods)
```

No new guards needed. Existing `RolesGuard` + service-level ownership checks are sufficient.

### 5.3 Multi-Tenant Isolation (Future-Proofing)

Current system is **single-tenant**. If multi-tenancy is needed:

- Add `tenant_id uuid` column to: `leads`, `tasks`, `notes`, `contact_requests`
- Add tenant_id to all CRM indexes as the leading column
- Row-Level Security (RLS) policy per tenant
- No schema-per-tenant; single schema with RLS is simpler for this domain

**For now**: No tenant_id columns. The `metadata jsonb` field on leads provides an escape hatch if tenant context is needed before a full migration.

---

## 6. Migration Impact

### 6.1 Zero-Downtime Deployment

All migrations are **additive only**:

| Operation | Downtime Risk |
|---|---|
| CREATE TYPE (4 new enums) | None — new types, no ALTER |
| CREATE TABLE (4 new tables) | None — new tables |
| CREATE INDEX CONCURRENTLY | None — non-blocking |
| CREATE TRIGGER (lead_status_history) | None — new table |

No ALTER on existing tables. No column additions to existing tables. No data type changes.

### 6.2 Migration Sequence

```
Migration 020: crm_phase4_enums.sql
  - CREATE TYPE crm.lead_source
  - CREATE TYPE crm.lead_status
  - CREATE TYPE crm.task_status
  - CREATE TYPE crm.task_priority

Migration 021: crm_phase4_tables.sql
  - CREATE TABLE crm.leads
  - CREATE TABLE crm.lead_status_history
  - CREATE TABLE crm.tasks
  - CREATE TABLE crm.notes

Migration 022: crm_phase4_indexes.sql
  - All CREATE INDEX CONCURRENTLY statements

Migration 023: crm_phase4_triggers.sql
  - Append-only trigger on crm.lead_status_history

Migration 024: crm_phase4_seed.sql (optional)
  - Backfill leads from existing contact_requests (see 6.3)
```

### 6.3 Backfill Strategy

Existing `contact_requests` with status `completed` or `in_progress` can seed the leads table:

```sql
INSERT INTO crm.leads (contact_request_id, user_id, parcel_id, source, status, assigned_to, created_at)
SELECT
  cr.id,
  cr.user_id,
  cr.parcel_id,
  CASE cr.type
    WHEN 'call_me' THEN 'phone'::crm.lead_source
    WHEN 'parcel_inquiry' THEN 'website'::crm.lead_source
    ELSE 'website'::crm.lead_source
  END,
  CASE cr.status
    WHEN 'completed' THEN 'won'::crm.lead_status
    WHEN 'in_progress' THEN 'contacted'::crm.lead_status
    WHEN 'assigned' THEN 'contacted'::crm.lead_status
    WHEN 'new' THEN 'new'::crm.lead_status
    ELSE 'new'::crm.lead_status
  END,
  cr.assigned_to,
  cr.created_at
FROM crm.contact_requests cr
WHERE NOT EXISTS (SELECT 1 FROM crm.leads l WHERE l.contact_request_id = cr.id);
```

This is idempotent (WHERE NOT EXISTS) and can run post-deploy without downtime.

---

## 7. Module Structure (Planned)

```
apps/monolith/src/modules/crm/
├── crm.module.ts                      -- UPDATE (add controllers, services, imports)
├── controllers/
│   ├── lead.controller.ts             -- CRUD + pipeline view + assign + score
│   ├── task.controller.ts             -- CRUD + my-tasks + overdue
│   ├── note.controller.ts             -- CRUD (scoped to parent entity)
│   ├── contact-request.controller.ts  -- CRUD + inbox + assign
│   ├── appointment.controller.ts      -- CRUD + calendar view
│   ├── offer.controller.ts            -- CRUD + respond
│   └── crm-dashboard.controller.ts    -- Aggregation endpoints
├── services/
│   ├── lead.service.ts
│   ├── task.service.ts
│   ├── note.service.ts
│   ├── contact-request.service.ts
│   ├── appointment.service.ts
│   ├── offer.service.ts
│   └── crm-dashboard.service.ts
├── entities/                          -- EXISTS (7 entities) + 4 NEW
│   ├── contact-request.entity.ts      -- EXISTS
│   ├── appointment.entity.ts          -- EXISTS
│   ├── offer.entity.ts               -- EXISTS
│   ├── offer-response.entity.ts      -- EXISTS
│   ├── notification-queue.entity.ts   -- EXISTS
│   ├── notification-log.entity.ts    -- EXISTS
│   ├── user-activity-log.entity.ts   -- EXISTS
│   ├── lead.entity.ts                -- NEW
│   ├── lead-status-history.entity.ts -- NEW
│   ├── task.entity.ts                -- NEW
│   └── note.entity.ts               -- NEW
└── dto/
    ├── lead/
    ├── task/
    ├── note/
    ├── contact-request/
    ├── appointment/
    ├── offer/
    └── dashboard/
```

---

## 8. API Surface (Endpoint Inventory)

Listed for planning only — no DTOs or request/response shapes.

```
# Leads
GET    /crm/leads                     -- List (filterable: status, source, assigned_to, date range)
GET    /crm/leads/:id                 -- Detail (includes notes, tasks, history)
POST   /crm/leads                     -- Create
PATCH  /crm/leads/:id                 -- Update (status, score, assigned_to)
PATCH  /crm/leads/:id/assign          -- Reassign to consultant
GET    /crm/leads/pipeline            -- Grouped by status (kanban data)

# Tasks
GET    /crm/tasks                     -- List (filterable: status, priority, assigned_to, due_date)
GET    /crm/tasks/my                  -- Current user's open tasks
GET    /crm/tasks/:id                 -- Detail
POST   /crm/tasks                     -- Create
PATCH  /crm/tasks/:id                 -- Update (status, priority, due_date)

# Notes
GET    /crm/notes?lead_id=X           -- List by parent
POST   /crm/notes                     -- Create (attach to lead/contact/parcel/user)
PATCH  /crm/notes/:id                 -- Update body (author only)

# Contact Requests
GET    /crm/contact-requests          -- List (filterable: status, type, assigned_to)
GET    /crm/contact-requests/inbox    -- Unassigned (status=new)
GET    /crm/contact-requests/:id      -- Detail
PATCH  /crm/contact-requests/:id      -- Update status, assign
POST   /crm/contact-requests          -- Public: submit new request (user/anonymous)

# Appointments
GET    /crm/appointments              -- List (filterable: consultant, date range, status)
GET    /crm/appointments/:id          -- Detail
POST   /crm/appointments              -- Create
PATCH  /crm/appointments/:id          -- Update (status, reschedule)

# Offers
GET    /crm/offers                    -- List (filterable: status, parcel, user)
GET    /crm/offers/:id                -- Detail (includes responses)
POST   /crm/offers                    -- Create (user-facing)
POST   /crm/offers/:id/respond        -- Accept/reject/counter (admin/consultant)
PATCH  /crm/offers/:id/withdraw       -- Withdraw (offer creator only)

# Dashboard
GET    /crm/dashboard/summary         -- Counts by lead status, task status, pending contacts
GET    /crm/dashboard/consultant/:id  -- Per-consultant metrics
GET    /crm/dashboard/conversion      -- Lead source → won conversion rates
```

---

## 9. Implementation Order (Suggested)

```
Phase 4a: Foundation
  1. Migration 020-023 (enums, tables, indexes, triggers)
  2. New entities (Lead, LeadStatusHistory, Task, Note)
  3. ContactRequest service + controller (activate existing entity)
  4. Note service + controller

Phase 4b: Lead Pipeline
  5. Lead service + controller
  6. LeadStatusHistory (auto-recorded on status change)
  7. Lead ← ContactRequest auto-creation
  8. Pipeline endpoint (kanban grouping)

Phase 4c: Task Management
  9. Task service + controller
  10. "My tasks" endpoint
  11. Overdue detection (manual query, no cron yet)

Phase 4d: Offers & Appointments
  12. Offer service + controller (activate existing entity)
  13. OfferResponse flow
  14. Appointment service + controller (activate existing entity)

Phase 4e: Dashboard
  15. Dashboard service + controller
  16. Summary, per-consultant, conversion endpoints

Phase 4f: Backfill & Polish
  17. Migration 024 (backfill leads from contact_requests)
  18. Audit log integration for all CRM write operations
  19. E2E tests for CRM endpoints
```

---

## 10. What This Design Does NOT Include

- **Notification dispatch worker** — Exists as entity only; worker implementation deferred
- **Scheduled jobs / cron** — No overdue task alerts, appointment reminders yet
- **Email/SMS templates** — Template system not in scope
- **File attachments on notes** — Use existing `admin.media` if needed
- **Lead scoring algorithm** — Score field exists; algorithm is product decision
- **Real-time updates (WebSocket)** — CRM is admin-facing; polling is sufficient
- **Bulk import/export** — Deferred to Phase 5
- **Reporting / analytics** — Dashboard covers basics; BI tooling deferred
