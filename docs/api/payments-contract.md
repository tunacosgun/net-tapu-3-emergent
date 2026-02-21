# Payments API Contract

Base path: `/api/v1`

---

## Authentication

All endpoints require JWT Bearer token unless noted otherwise.
Admin endpoints require `roles: ['admin']` in token payload.

---

## POST /payments

**Auth:** JWT (any authenticated user)
**Purpose:** Initiate a new payment for a parcel purchase.

### Request

```json
{
  "parcelId": "uuid",
  "amount": "1500.00",
  "currency": "TRY",
  "paymentMethod": "credit_card | bank_transfer | mail_order",
  "idempotencyKey": "client-generated-unique-string",
  "description": "optional description",
  "cardToken": "optional-token-from-POS-SDK"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| parcelId | UUID | yes | Must be valid UUID v4 |
| amount | string | yes | `^\d{1,13}(\.\d{1,2})?$`, must be > 0 |
| currency | string | no | Max 3 chars. Default: `TRY` |
| paymentMethod | enum | yes | `credit_card`, `bank_transfer`, `mail_order` |
| idempotencyKey | string | yes | Max 255 chars, non-empty |
| description | string | no | Max 500 chars |
| cardToken | string | no | POS SDK token for card payments |

### Response `201 Created`

```json
{
  "id": "uuid",
  "userId": "uuid",
  "parcelId": "uuid",
  "amount": "1500.00",
  "currency": "TRY",
  "status": "pending | provisioned | failed",
  "paymentMethod": "credit_card",
  "idempotencyKey": "...",
  "createdAt": "2026-02-21T10:00:00.000Z",
  "updatedAt": "2026-02-21T10:00:00.000Z"
}
```

### Status after initiation

| POS Result | Payment Status |
|------------|---------------|
| POS provision succeeds | `provisioned` |
| POS provision fails | `failed` |
| POS call throws exception | `pending` or `failed` |
| POS succeeds but DB write fails | `pending` (CRITICAL logged) |

---

## GET /payments

**Auth:** JWT (any authenticated user)
**Purpose:** List the authenticated user's payments (user-scoped).

### Query Parameters

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| status | enum | — | Optional. One of: `pending`, `provisioned`, `completed`, `failed`, `cancelled`, `refunded`, `partially_refunded` |
| page | int | 1 | Min 1 |
| limit | int | 20 | Min 1, Max 100 |

### Response `200 OK`

```json
{
  "data": [ /* Payment[] */ ],
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

---

## GET /payments/:id

**Auth:** JWT (owner or admin)
**Purpose:** Get payment detail. Non-admin users can only access their own payments.

### Response `200 OK`

Full Payment object.

### Errors

| Code | Condition |
|------|-----------|
| 403 | Non-admin user requesting another user's payment |
| 404 | Payment not found |

---

## PATCH /payments/:id/capture

**Auth:** Admin only
**Purpose:** Capture a provisioned payment (finalize the charge).

### Preconditions

- Payment status must be `provisioned`
- POS provision reference must exist

### Response `200 OK`

Payment object with `status: "completed"`.

### Errors

| Code | Condition |
|------|-----------|
| 400 | Payment not in `provisioned` status |
| 400 | No POS provision reference found |
| 400 | POS capture call failed |
| 404 | Payment not found |

### Concurrency

Uses pessimistic `FOR UPDATE` lock. Concurrent capture/cancel requests are serialized. Second request will fail with 400 (wrong status).

---

## PATCH /payments/:id/cancel

**Auth:** Admin only
**Purpose:** Cancel a provisioned payment (void the hold).

### Preconditions

- Payment status must be `provisioned`
- POS provision reference must exist

### Response `200 OK`

Payment object with `status: "cancelled"`.

### Errors

Same as capture.

### Concurrency

Same lock-first pattern as capture. Capture and cancel on the same payment are mutually exclusive.

---

## POST /refunds

**Auth:** Admin only
**Purpose:** Initiate a refund against a completed payment.

### Request

```json
{
  "paymentId": "uuid",
  "amount": "500.00",
  "reason": "Customer requested refund",
  "idempotencyKey": "admin-generated-unique-string",
  "currency": "TRY"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| paymentId | UUID | yes | Must reference existing payment |
| amount | string | yes | `^\d{1,13}(\.\d{1,2})?$`, must be > 0 |
| reason | string | yes | Non-empty, max 500 chars |
| idempotencyKey | string | yes | Max 255 chars, non-empty |
| currency | string | no | Max 3 chars. Default: payment's currency |

### Preconditions

- Payment status must be `completed` or `partially_refunded`
- Refund amount must not exceed remaining refundable amount
- Remaining = payment amount - sum of (pending + completed) refund amounts
- All arithmetic uses integer cents (no floating point)

### Response `201 Created`

```json
{
  "id": "uuid",
  "paymentId": "uuid",
  "amount": "500.00",
  "currency": "TRY",
  "reason": "Customer requested refund",
  "status": "pending | completed | failed",
  "posRefundId": "pos-reference-or-null",
  "idempotencyKey": "...",
  "initiatedAt": "2026-02-21T10:00:00.000Z",
  "completedAt": "2026-02-21T10:05:00.000Z or null"
}
```

### Status after initiation

| POS Result | Refund Status | Amount Locked? |
|------------|--------------|----------------|
| POS succeeds | `completed` | Yes (committed) |
| POS returns `success: false` | `failed` | No (freed) |
| POS throws exception | `failed` | No (freed) |
| POS succeeds + DB write fails | `pending` | Yes (CRITICAL logged) |
| POS fails + DB write fails | `pending` | Yes (CRITICAL logged) |

### Payment status after refund

| Condition | Payment Status |
|-----------|---------------|
| Total completed refunds >= payment amount | `refunded` |
| Total completed refunds < payment amount | `partially_refunded` |

### Errors

| Code | Condition |
|------|-----------|
| 400 | Payment not in `completed` or `partially_refunded` status |
| 400 | Refund amount exceeds remaining refundable amount |
| 404 | Payment not found |
| 409 | Idempotency key used with different parameters |

---

## GET /refunds/payment/:paymentId

**Auth:** Admin only
**Purpose:** List all refunds for a specific payment.

### Response `200 OK`

```json
[ /* Refund[] ordered by initiatedAt DESC */ ]
```

---

## GET /refunds/:id

**Auth:** Admin only
**Purpose:** Get refund detail.

### Errors

| Code | Condition |
|------|-----------|
| 404 | Refund not found |

---

## GET /admin/reconciliation

**Auth:** Admin only
**Purpose:** List stale pending payments and refunds for manual reconciliation.

### Query Parameters

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| olderThanMinutes | int | 30 | Min 1, Max 10080 (7 days) |
| limit | int | 50 | Min 1, Max 100 |

### Response `200 OK`

```json
{
  "generatedAt": "2026-02-21T12:00:00.000Z",
  "thresholdMinutes": 30,
  "stalePendingPayments": [
    {
      "id": "uuid",
      "userId": "uuid",
      "parcelId": "uuid",
      "amount": "1500.00",
      "currency": "TRY",
      "status": "pending",
      "staleSinceMinutes": 45
    }
  ],
  "stalePendingRefunds": [
    {
      "id": "uuid",
      "paymentId": "uuid",
      "amount": "500.00",
      "currency": "TRY",
      "status": "pending",
      "reason": "Customer requested refund",
      "staleSinceMinutes": 120
    }
  ]
}
```

---

## Idempotency Behavior

All mutating payment operations require a client-provided `idempotencyKey`.

### How it works

1. Client sends request with `idempotencyKey`
2. Server computes SHA-256 hash of relevant request fields
3. On first call: resource + idempotency record created atomically in same transaction
4. On retry with **same key + same params**: returns existing resource (no side effects)
5. On retry with **same key + different params**: returns `409 Conflict`

### Hashed fields

| Operation | Fields in hash |
|-----------|---------------|
| Payment initiation | `parcelId`, `amount`, `currency`, `paymentMethod` |
| Refund initiation | `paymentId`, `amount`, `reason` |

### Key expiration

- Keys have a 72-hour TTL
- Expired keys are cleaned up via scheduled SQL job
- After expiration, the same key can be reused

### Atomicity guarantee

The idempotency key is saved in the **same transaction** as the resource creation (Phase 1). This means:
- If Phase 1 succeeds: both resource and key exist, retries always work
- If Phase 1 fails: neither resource nor key exist, client can retry freely
- There is no window where a resource exists without its idempotency key

### Capture and cancel idempotency

Capture and cancel use server-generated idempotency keys (`capture:{paymentId}`, `cancel:{paymentId}`) passed to the POS provider. These are not stored in the idempotency_keys table — they rely on the pessimistic lock to prevent double-execution.
