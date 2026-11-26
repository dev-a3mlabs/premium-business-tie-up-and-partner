# Admin panel: contact submissions

Messages sent from the public **Contact** form (`POST /contact`) can now be read and handled in the admin panel.

| # | Endpoint | Purpose |
|---|---|---|
| 1 | `GET /admin/contact-submissions?status=&page=` | Inbox list, newest first |
| 2 | `GET /admin/contact-submissions/:submissionId` | One message |
| 3 | `PATCH /admin/contact-submissions/:submissionId/status` | Mark as resolved, or reopen |

---

## 1. Flow

```
Visitor sends the public contact form
  └─ POST /contact ................................ saved with status "new"

Admin opens "Contact messages" screen
  └─ GET /admin/contact-submissions?status=new&page=1     (tabs: New / Resolved / All)
       │
       ├─ click a row
       │    └─ GET /admin/contact-submissions/:submissionId     (or reuse the row data)
       │
       ├─ "Mark as resolved"
       │    └─ PATCH /admin/contact-submissions/:submissionId/status   { "status": "resolved" }
       │         → update the row from the response
       │
       └─ "Reopen"
            └─ PATCH /admin/contact-submissions/:submissionId/status   { "status": "new" }
                 → update the row from the response
```

---

## 2. Basics

- Base URL: `http://localhost:5001/api/v1`
- Every endpoint here needs a **platform admin** token: `Authorization: Bearer <accessToken>`, using the `accessToken` from `POST /auth/login` with an admin account.
- `id` / `submissionId` is a UUID string. Timestamps are ISO 8601 UTC.

```sh
BASE=http://localhost:5001/api/v1
TOKEN=<admin accessToken>
SUBMISSION_ID=<a submission id from the list>
```

### Contact submission object

Every endpoint returns submissions in this shape:

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Use as `submissionId` |
| `name` | string | Sender's name |
| `email` | string | Sender's email (lowercased) |
| `subject` | string | `Writing a business brief`, `Requests and introductions`, `Platform feedback` or `Other` |
| `message` | string | Plain text, up to 3000 characters. Keep line breaks (`white-space: pre-wrap`) |
| `status` | `"new"` \| `"resolved"` | |
| `resolvedAt` | string \| null | When it was marked resolved; `null` while `new` |
| `resolvedBy` | `{ id, name }` \| null | Admin who resolved it; `null` while `new` |
| `createdAt` | string | When the visitor sent it |

---

## 3. List submissions: `GET /admin/contact-submissions`

**Query**

| Param | Required | Values |
|---|---|---|
| `status` | No | `new` or `resolved`. Leave it out for all |
| `page` | No | Integer ≥ 1, default `1`. 25 items per page |

```sh
curl "$BASE/admin/contact-submissions?status=new&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Contact submissions fetched",
  "data": {
    "items": [
      {
        "id": "b3f7e2c0-3642-429f-9a92-0de66941304b",
        "name": "Ravi Kumar",
        "email": "ravi@example.com",
        "subject": "Platform feedback",
        "message": "The brief form was easy to follow.",
        "status": "new",
        "resolvedAt": null,
        "resolvedBy": null,
        "createdAt": "2026-11-26T07:38:38.208Z"
      },
      {
        "id": "bf762844-9d57-463b-b530-d8457fe7d542",
        "name": "Jane Cooper",
        "email": "jane@company.com",
        "subject": "Platform feedback",
        "message": "Nice website !",
        "status": "new",
        "resolvedAt": null,
        "resolvedBy": null,
        "createdAt": "2026-11-26T07:32:31.691Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 2, "totalPages": 1 }
  }
}
```

The list already includes the full `message`, so the detail view can open from the row data without another call.

---

## 4. One submission: `GET /admin/contact-submissions/:submissionId`

Use it for a direct link or page refresh, e.g. `/admin/contact/:submissionId`.

```sh
curl "$BASE/admin/contact-submissions/$SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Contact submission fetched",
  "data": {
    "id": "b3f7e2c0-3642-429f-9a92-0de66941304b",
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "subject": "Platform feedback",
    "message": "The brief form was easy to follow.",
    "status": "new",
    "resolvedAt": null,
    "resolvedBy": null,
    "createdAt": "2026-11-26T07:38:38.208Z"
  }
}
```

---

## 5. Change status: `PATCH /admin/contact-submissions/:submissionId/status`

**Body**

| Field | Required | Values |
|---|---|---|
| `status` | Yes | `resolved` (mark as handled) or `new` (reopen) |

### 5.1 Mark as resolved

```sh
curl -X PATCH "$BASE/admin/contact-submissions/$SUBMISSION_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "resolved" }'
```

**200 OK**

```json
{
  "success": true,
  "message": "Contact submission updated",
  "data": {
    "id": "b3f7e2c0-3642-429f-9a92-0de66941304b",
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "subject": "Platform feedback",
    "message": "The brief form was easy to follow.",
    "status": "resolved",
    "resolvedAt": "2026-11-26T07:38:38.668Z",
    "resolvedBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "createdAt": "2026-11-26T07:38:38.208Z"
  }
}
```

### 5.2 Reopen

```sh
curl -X PATCH "$BASE/admin/contact-submissions/$SUBMISSION_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "new" }'
```

**200 OK**: `resolvedAt` and `resolvedBy` are cleared.

```json
{
  "success": true,
  "message": "Contact submission updated",
  "data": {
    "id": "b3f7e2c0-3642-429f-9a92-0de66941304b",
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "subject": "Platform feedback",
    "message": "The brief form was easy to follow.",
    "status": "new",
    "resolvedAt": null,
    "resolvedBy": null,
    "createdAt": "2026-11-26T07:38:38.208Z"
  }
}
```

Sending the status it already has is safe. It returns `200` with no change, and a resolved message keeps its original `resolvedAt` and `resolvedBy`. Replace the row with `data` from the response; there is no need to refetch the list (unless you're on a filtered tab and want the row to disappear).

---

## 6. Errors

```json
// 400: invalid status filter (?status=open)
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "status", "message": "Invalid option: expected one of \"new\"|\"resolved\"" }]
  }
}

// 400: submissionId is not a UUID
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "submissionId", "message": "Invalid submission id" }]
  }
}

// 404: no submission with that id
{ "success": false, "message": "Contact submission not found", "error": { "code": "NOT_FOUND" } }

// 401: no token
{ "success": false, "message": "Access token is required", "error": { "code": "UNAUTHORIZED" } }
```

| HTTP | `code` | What the frontend does |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bug in the client (bad filter or id) |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` | Go to login |
| 401 | `TOKEN_EXPIRED` | Call `/auth/refresh`, then retry once |
| 403 | `FORBIDDEN` | Signed in but not a platform admin: show "not allowed" |
| 404 | `NOT_FOUND` | Show "message not found" and go back to the list |

---

## 7. UI suggestions

- **Tabs:** New (`?status=new`, default), Resolved (`?status=resolved`), All (no `status`). Use `pagination.totalItems` for the tab counts.
- **Row:** name, email, subject, first line of the message, relative `createdAt` ("2 hours ago"), and a status badge.
- **Detail panel:** full message, a `mailto:` link to reply to `email`, a **Mark as resolved** / **Reopen** button, and "Resolved by {resolvedBy.name} on {resolvedAt}" when resolved.
