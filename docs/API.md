# Nexora API reference

Every endpoint the frontend needs, the order to call them in, and real requests and responses captured from the running backend. IDs, timestamps and tokens in the examples are sample values.

## Contents

1. [Basics](#1-basics)
2. [Which API is called after which](#2-which-api-is-called-after-which)
3. [Auth APIs](#3-auth-apis)
4. [Public contact API](#4-public-contact-api)
5. [Company workspace APIs](#5-company-workspace-apis)
6. [Admin workspace APIs](#6-admin-workspace-apis)
7. [Shared objects](#7-shared-objects)
8. [Fixed values and status rules](#8-fixed-values-and-status-rules)

---

## 1. Basics

### Base URL

```
http://localhost:5001/api/v1
```

The curl examples use these shell variables:

```sh
BASE=http://localhost:5001/api/v1
TOKEN=<accessToken from login>
ORG_ID=<session.activeOrgId>
REQUEST_ID=<a request id>
INTRO_ID=<an introduction id>
```

### Request rules

- Send JSON with `Content-Type: application/json`.
- Bodies reject unknown keys. Sending a field that isn't listed returns `400 VALIDATION_ERROR`.
- Text fields are trimmed before their length is checked.
- Every `id` is a UUID string.
- Timestamps are ISO 8601 UTC strings such as `2026-11-25T08:34:22.904Z`.
- Protected routes need the header `Authorization: Bearer <accessToken>`.

### Success response

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": { }
}
```

`data` is `null` when there is nothing to return.

### Paginated response

List endpoints take `?page=1` (default `1`, 25 items per page).

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 3, "totalPages": 1 }
  }
}
```

### Error response

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "requirements.0.intake.deliverables", "message": "Too small: expected string to have >=15 characters" }
    ]
  }
}
```

`details` only appears on `VALIDATION_ERROR`. `field` is the dot path of the input, so `requirements.1.customCategory` is the `customCategory` of the second requirement. Use it to put the message on the right form field and wizard step.

### Error codes

| HTTP | `code` | When | What the frontend does |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query or URL id is invalid | Show `details` on the fields |
| 400 | `INVALID_JSON` | Body isn't valid JSON | Bug in the client |
| 401 | `UNAUTHORIZED` | No `Authorization` header | Go to login |
| 401 | `TOKEN_EXPIRED` | Access token expired (after 15 min) | Call `/auth/refresh`, then retry once |
| 401 | `INVALID_TOKEN` | Token invalid, or the session was logged out or revoked | Go to login |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password | Show "Invalid email or password" |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh token invalid, expired or already used | Clear tokens and go to login |
| 403 | `FORBIDDEN` | Signed in, but this role can't do this | Show "not allowed" |
| 404 | `NOT_FOUND` | The record doesn't exist **or belongs to another company** | Show "not available" |
| 409 | `EMAIL_TAKEN` | Registration email already has an account | Show it on the email field |
| 409 | `INVALID_TRANSITION` | Action not allowed in the request's or intro's current state | Refetch the record and show the new state |
| 409 | `INTRO_EXISTS` | Specialist already has an open intro on this request | Show it on the specialist name field |
| 409 | `CONFLICT` | Two requests collided on a unique value | Retry |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Keep form values; show a generic error |

---

## 2. Which API is called after which

### 2.1 Tokens

- `accessToken` is a JWT that lasts **15 minutes**. Send it on every protected call.
- `refreshToken` gets new tokens. A login lasts at most **14 days**; after that the user must sign in again.
- **Each refresh returns a new `refreshToken`, and the old one stops working.** Always save the new one.
- **If an old refresh token is used again, the backend treats it as stolen and logs the user out on every device.** Never send two `/auth/refresh` calls at the same time. If several API calls get `TOKEN_EXPIRED` together, run one refresh and let the others wait for it.

### 2.2 App start

```
App opens
  └─ have saved tokens?
       ├─ no  → show public site / login
       └─ yes → GET /auth/session
                  ├─ 200 → user is signed in → go to their workspace (2.4)
                  ├─ 401 TOKEN_EXPIRED → POST /auth/refresh → save new tokens → GET /auth/session again
                  └─ 401 (anything else, or refresh failed) → clear tokens → login page
```

### 2.3 Any protected call

```
call API with accessToken
  ├─ success → done
  └─ 401 TOKEN_EXPIRED → POST /auth/refresh (only one at a time)
        ├─ 200 → save both new tokens → retry the original call once
        └─ 401 → clear tokens → login page
```

### 2.4 Where to send the user after login, registration or session

Use the `session` object returned by `/auth/login`, `/auth/company-registration` or `/auth/session`:

```
session.user.isPlatformAdmin === true  → /admin  (admin panel)
session.activeOrgId !== null            → /app    (company workspace, use activeOrgId as ORG_ID)
otherwise                               → /register/company
```

### 2.5 Company registration (public "Register your company" wizard)

```
user fills all wizard steps (no API calls between steps; validate in the browser)
  └─ POST /auth/company-registration   (one call: account + company + all briefs)
       ├─ 201 → save accessToken + refreshToken → show confirmation → /app
       ├─ 400 VALIDATION_ERROR → map details[].field to the step and field
       └─ 409 EMAIL_TAKEN → back to the Account step
```

### 2.6 Company workspace

| Screen | Calls |
|---|---|
| Dashboard `/app` | `GET /company/:orgId/dashboard` |
| Profile `/app/profile` | `GET /company/:orgId/profile` → on save, `PATCH /company/:orgId/profile` (owner/admin only) |
| New requirement | `POST /company/:orgId/requests` → then go to My Requests |
| My Requests | `GET /company/:orgId/requests?page=1` |
| Request detail | `GET /company/:orgId/requests/:requestId` |
| Cancel button (only if `allowedActions.cancel`) | `POST /company/:orgId/requests/:requestId/cancel` → then refetch the detail |
| Introductions | `GET /company/:orgId/introductions?page=1` |
| Settings | Use the session from `GET /auth/session`; no other API |
| Logout | `POST /auth/logout` → clear tokens |

### 2.7 Admin panel

| Screen | Calls |
|---|---|
| Dashboard `/admin` | `GET /admin/dashboard` |
| Requirements queue | `GET /admin/requests?status=&assignee=&page=` and `GET /admin/coordinators` (filter + assign dropdown) |
| Request detail | `GET /admin/requests/:requestId` |
| Introductions | `GET /admin/introductions?status=&page=` |
| Companies | `GET /admin/companies?page=` |
| Users & Access | `GET /admin/users?page=` |
| Activity | `GET /admin/activity?visibility=&q=&type=&page=` |

**Admin request detail actions.** After each one, refetch `GET /admin/requests/:requestId`, because statuses can change automatically:

| Button | Call | Show it when |
|---|---|---|
| Change status | `PATCH /admin/requests/:requestId/status` | Status is in `allowedActions.changeStatusTo` |
| Assign / unassign | `PATCH /admin/requests/:requestId/assignment` | Always (`allowedActions.assign`) |
| Add internal note | `POST /admin/requests/:requestId/notes` | Always (`allowedActions.addNote`) |
| Draft introduction | `POST /admin/requests/:requestId/introductions` | `allowedActions.draftIntroduction` |
| Send intro | `POST /admin/introductions/:introId/send` | Intro's `allowedActions.send` |
| Record accepted / declined | `POST /admin/introductions/:introId/response` | Intro's `allowedActions.respond` |
| Discard draft | `POST /admin/introductions/:introId/discard` | Intro's `allowedActions.discard` |

### 2.8 Full coordination flow (admin side, then what the company sees)

```
Company submits request ............................ status: submitted
Admin  PATCH status → under_review ................. under_review
Admin  PATCH status → partner_search ............... partner_search
Admin  PATCH status → shortlisted .................. shortlisted
Admin  POST  requests/:id/introductions (draft) .... intro_pending   (automatic on the first draft)
Admin  POST  introductions/:id/send ................ intro_sent      (automatic on the first send)
       → the company now sees the specialist name in its intros
Admin  POST  introductions/:id/response accepted ... discussion      (automatic on the first acceptance)
Admin  PATCH status → established .................. established     (finished)
```

At any open status the admin can also set `closed` or `cancelled`, and the company can cancel. See [8.2](#82-request-status-rules).

---

## 3. Auth APIs

### 3.1 Register a company — `POST /auth/company-registration`

Public. Creates the user account, the company (with the user as `owner`), and 1-10 requests in one step, then signs the user in. If anything fails, nothing is saved.

**Body**

| Field | Rules |
|---|---|
| `contact.contactName` | 2-120 |
| `contact.email` | Valid email, max 254. Lowercased by the server |
| `contact.password` | 8-128 characters **and at most 72 bytes** (bcrypt limit). Not trimmed |
| `org` | Company profile; see [Company profile fields](#company-profile-fields) |
| `org.registration.entityType` | One of [entity types](#81-option-lists) |
| `org.registration.gstin` | `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$`. Uppercased by the server |
| `org.registration.pan` | `^[A-Z]{5}\d{4}[A-Z]$`, and must equal `gstin` characters 3-12 |
| `org.registration.udyamNumber` | Optional. `""` or `^UDYAM-[A-Z]{2}-\d{2}-\d{7}$` |
| `requirements` | Array of 1-10; see [Requirement fields](#requirement-fields) |
| `policyVersion` | 1-64. The terms/privacy version the user agreed to |

```sh
curl -X POST "$BASE/auth/company-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": { "contactName": "Asha Rao", "email": "asha@halden.example", "password": "StrongPass#1" },
    "org": {
      "name": "Halden Foods",
      "website": "halden.example",
      "industry": "Food & beverage",
      "size": "51-200",
      "location": "Pune",
      "country": "India",
      "description": "Packaged food manufacturer with regional distribution.",
      "registration": {
        "entityType": "Private Limited / Public Limited",
        "gstin": "27AAPFU0939F1ZV",
        "pan": "AAPFU0939F",
        "udyamNumber": ""
      }
    },
    "requirements": [
      {
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "customCategory": "",
        "customSubcategory": "",
        "title": "Review our GST filings",
        "description": "We need a specialist to review our GST filings before the next audit.",
        "intake": {
          "companyContext": "Finance team of six handling filings for three states.",
          "currentSetup": "Filings are prepared in-house with spreadsheets.",
          "deliverables": "A filing review and a corrected compliance calendar.",
          "successCriteria": "No notices from the tax department next year.",
          "constraints": "",
          "engagementModel": "One-off project",
          "readiness": "Defining the scope",
          "decisionProcess": "CFO approves the engagement."
        },
        "budgetRange": "₹1-3 lakh",
        "timeline": "Within 2 months",
        "locationPreference": "Pune",
        "preferredCriteria": "Experience with food manufacturers.",
        "industriesServed": ["Food & beverage", "Other"],
        "otherIndustries": "Cold-chain logistics"
      },
      {
        "categoryId": "other",
        "subcategoryId": "not-specified",
        "customCategory": "Internal platform review",
        "title": "Internal platform review",
        "description": "Independent review of our internal ordering platform before scaling.",
        "intake": {
          "companyContext": "Ordering platform used by 40 distributors across the west region.",
          "deliverables": "Written review with risks and fixes.",
          "successCriteria": "Clear go/no-go recommendation.",
          "engagementModel": "Advisory only",
          "readiness": "Exploring options"
        },
        "budgetRange": "Not decided yet",
        "timeline": "1 month",
        "industriesServed": []
      }
    ],
    "policyVersion": "2026-11-01"
  }'
```

**201 Created**

```json
{
  "success": true,
  "message": "Company registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "pmulKP5z9fbdQQSIJB1P...",
    "session": {
      "user": {
        "id": "37199902-026a-4d7c-b602-58b235801b8b",
        "name": "Asha Rao",
        "email": "asha@halden.example",
        "isPlatformAdmin": false,
        "createdAt": "2026-11-25T08:34:22.885Z"
      },
      "memberships": [
        { "orgId": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "role": "owner", "createdAt": "2026-11-25T08:34:22.898Z" }
      ],
      "organizations": [
        { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" }
      ],
      "activeOrgId": "ad8a56a8-021f-40fa-8d30-7fe6256da882"
    },
    "organization": {
      "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882",
      "name": "Halden Foods",
      "slug": "halden-foods",
      "website": "https://halden.example",
      "industry": "Food & beverage",
      "size": "51-200",
      "location": "Pune",
      "country": "India",
      "description": "Packaged food manufacturer with regional distribution.",
      "createdAt": "2026-11-25T08:34:22.895Z",
      "updatedAt": "2026-11-25T08:34:22.895Z"
    },
    "requests": [
      {
        "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "title": "Review our GST filings",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:22.904Z",
        "updatedAt": "2026-11-25T08:34:22.904Z"
      },
      {
        "id": "099be8b1-3a9e-49ae-acf7-1664fa80119e",
        "title": "Internal platform review",
        "status": "submitted",
        "categoryId": null,
        "subcategoryId": null,
        "categoryLabel": "Internal platform review",
        "subcategoryLabel": null,
        "createdAt": "2026-11-25T08:34:22.910Z",
        "updatedAt": "2026-11-25T08:34:22.910Z"
      }
    ]
  }
}
```

`requests` are in the same order as you sent them.

**Errors**

```json
// 409: email already registered
{ "success": false, "message": "An account with this email already exists", "error": { "code": "EMAIL_TAKEN" } }

// 400: PAN doesn't match GSTIN
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "org.registration.pan", "message": "PAN must match the GSTIN" }]
  }
}
```

### 3.2 Login — `POST /auth/login`

Public. Used for both company users and admins.

| Field | Rules |
|---|---|
| `email` | Valid email (case doesn't matter) |
| `password` | 1-128 |

```sh
curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@nexora.com", "password": "Password@123" }'
```

**200 OK**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "-qB1UnOt4oP4q3ljfpF8...",
    "session": {
      "user": {
        "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d",
        "name": "Nexora Admin",
        "email": "admin@nexora.com",
        "isPlatformAdmin": true,
        "createdAt": "2026-11-25T08:31:59.375Z"
      },
      "memberships": [],
      "organizations": [],
      "activeOrgId": null
    }
  }
}
```

A company user gets the same shape, with `isPlatformAdmin: false` and their company in `memberships`, `organizations` and `activeOrgId`.

**401**: a wrong password, an unknown email and a disabled account all give the same answer.

```json
{ "success": false, "message": "Invalid email or password", "error": { "code": "INVALID_CREDENTIALS" } }
```

### 3.3 Refresh tokens — `POST /auth/refresh`

Public. Call it when any API returns `401 TOKEN_EXPIRED`.

```sh
curl -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "pmulKP5z9fbdQQSIJB1P..." }'
```

**200 OK.** Save **both** new tokens.

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiIs...", "refreshToken": "-qB1UnOt4oP4q3ljfpF8..." }
}
```

**401**: send the user to login.

```json
{ "success": false, "message": "Invalid or expired refresh token", "error": { "code": "INVALID_REFRESH_TOKEN" } }
```

### 3.4 Current session — `GET /auth/session`

Signed in. Call it on app start and to refresh the Settings page.

```sh
curl "$BASE/auth/session" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Session fetched",
  "data": {
    "user": {
      "id": "37199902-026a-4d7c-b602-58b235801b8b",
      "name": "Asha Rao",
      "email": "asha@halden.example",
      "isPlatformAdmin": false,
      "createdAt": "2026-11-25T08:34:22.885Z"
    },
    "memberships": [
      { "orgId": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "role": "owner", "createdAt": "2026-11-25T08:34:22.898Z" }
    ],
    "organizations": [{ "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" }],
    "activeOrgId": "ad8a56a8-021f-40fa-8d30-7fe6256da882"
  }
}
```

`memberships[].role` is `owner`, `admin` or `member`. Only `owner` and `admin` may edit the company profile, so hide the Edit button for `member`.

**401**

```json
{ "success": false, "message": "Access token is required", "error": { "code": "UNAUTHORIZED" } }
{ "success": false, "message": "Invalid access token", "error": { "code": "INVALID_TOKEN" } }
{ "success": false, "message": "Access token expired", "error": { "code": "TOKEN_EXPIRED" } }
```

### 3.5 Logout — `POST /auth/logout`

Signed in. Ends this session; its access and refresh tokens stop working right away. Clear the tokens in the browser afterwards.

```sh
curl -X POST "$BASE/auth/logout" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{ "success": true, "message": "Logged out successfully", "data": null }
```

---

## 4. Public contact API

### 4.1 Send a contact message — `POST /contact`

Public. The message is stored for the Nexora team. No email is sent yet.

| Field | Rules |
|---|---|
| `name` | 2-120 |
| `email` | Valid email, max 254 |
| `subject` | One of [contact subjects](#81-option-lists) |
| `message` | 10-3000, plain text |

```sh
curl -X POST "$BASE/contact" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Ravi Kumar", "email": "ravi@example.com", "subject": "Platform feedback", "message": "The brief form was easy to follow." }'
```

**202 Accepted**

```json
{ "success": true, "message": "Your message was received.", "data": null }
```

---

## 5. Company workspace APIs

Every route here:

- is under `/company/:orgId`, where `orgId` = `session.activeOrgId`
- needs `Authorization: Bearer <accessToken>`
- needs the user to be a member of that company. **Another company's org or request id returns `404 NOT_FOUND`**, exactly like an id that doesn't exist.

### 5.1 Dashboard — `GET /company/:orgId/dashboard`

```sh
curl "$BASE/company/$ORG_ID/dashboard" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "counts": {
      "activeRequests": 2,
      "establishedRequests": 0,
      "introductions": 0,
      "acceptedIntroductions": 0
    },
    "recentRequests": [
      {
        "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "title": "Review our GST filings",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:22.904Z",
        "updatedAt": "2026-11-25T08:34:22.904Z"
      }
    ],
    "recentActivity": [
      {
        "id": "41b875f6-9f9a-46f7-89a8-adcd5b35592b",
        "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "type": "request_submitted",
        "message": "Request submitted.",
        "statusAtEvent": "submitted",
        "createdAt": "2026-11-25T08:34:22.907Z"
      },
      {
        "id": "572eef43-fcbc-4961-b1de-3fb1f349a662",
        "requestId": null,
        "type": "org_created",
        "message": "Company workspace created.",
        "statusAtEvent": null,
        "createdAt": "2026-11-25T08:34:22.901Z"
      }
    ]
  }
}
```

- `activeRequests`: requests not `established`, `closed` or `cancelled`.
- `introductions`: sent intros, including declined ones. `acceptedIntroductions` is the accepted subset (the "Specialists in discussion" card).
- `recentRequests`: the latest 5. `recentActivity`: the latest 6, newest first.

### 5.2 Company profile — `GET /company/:orgId/profile`

Any member.

```sh
curl "$BASE/company/$ORG_ID/profile" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: a [CompanyProfile](#companyprofile).

```json
{
  "success": true,
  "message": "Company profile fetched",
  "data": {
    "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882",
    "name": "Halden Foods",
    "slug": "halden-foods",
    "website": "https://halden.example",
    "industry": "Food & beverage",
    "size": "51-200",
    "location": "Pune",
    "country": "India",
    "description": "Packaged food manufacturer with regional distribution.",
    "createdAt": "2026-11-25T08:34:22.895Z",
    "updatedAt": "2026-11-25T08:34:22.895Z"
  }
}
```

### 5.3 Update company profile — `PATCH /company/:orgId/profile`

`owner` or `admin` only; a `member` gets `403 FORBIDDEN`. Send **only the fields that changed** (at least one). The fields and rules are in [Company profile fields](#company-profile-fields). `slug` and the tax IDs can't be changed.

```sh
curl -X PATCH "$BASE/company/$ORG_ID/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "location": "Mumbai" }'
```

**200 OK**: the updated [CompanyProfile](#companyprofile).

```json
{
  "success": true,
  "message": "Company profile updated",
  "data": {
    "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882",
    "name": "Halden Foods",
    "slug": "halden-foods",
    "website": "https://halden.example",
    "industry": "Food & beverage",
    "size": "51-200",
    "location": "Mumbai",
    "country": "India",
    "description": "Packaged food manufacturer with regional distribution.",
    "createdAt": "2026-11-25T08:34:22.895Z",
    "updatedAt": "2026-11-25T08:34:23.244Z"
  }
}
```

**Errors**

```json
// 403: member role
{ "success": false, "message": "You do not have permission to do this", "error": { "code": "FORBIDDEN" } }

// 400: empty body
{ "success": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": [{ "message": "Send at least one field to update" }] } }
```

### 5.4 Submit new requests — `POST /company/:orgId/requests`

Any member. Body: `requirements` (1-10, [Requirement fields](#requirement-fields)) and `policyVersion` (1-64).

```sh
curl -X POST "$BASE/company/$ORG_ID/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policyVersion": "2026-11-01",
    "requirements": [
      {
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "title": "Cold-chain audit",
        "description": "We need a specialist to review our GST filings before the next audit.",
        "intake": {
          "companyContext": "Finance team of six handling filings for three states.",
          "deliverables": "A filing review and a corrected compliance calendar.",
          "successCriteria": "No notices from the tax department next year.",
          "engagementModel": "One-off project",
          "readiness": "Defining the scope"
        },
        "budgetRange": "₹1-3 lakh",
        "timeline": "Within 2 months",
        "industriesServed": ["Food & beverage"]
      }
    ]
  }'
```

**201 Created**

```json
{
  "success": true,
  "message": "Requests submitted",
  "data": {
    "requests": [
      {
        "id": "32ff5fed-71f6-4c8e-9cc1-c18574f198e5",
        "title": "Cold-chain audit",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:23.271Z",
        "updatedAt": "2026-11-25T08:34:23.271Z"
      }
    ]
  }
}
```

### 5.5 My requests — `GET /company/:orgId/requests?page=1`

Newest first, paginated, items are [RequestSummary](#requestsummary).

```sh
curl "$BASE/company/$ORG_ID/requests?page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "items": [
      {
        "id": "32ff5fed-71f6-4c8e-9cc1-c18574f198e5",
        "title": "Cold-chain audit",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:23.271Z",
        "updatedAt": "2026-11-25T08:34:23.271Z"
      },
      {
        "id": "099be8b1-3a9e-49ae-acf7-1664fa80119e",
        "title": "Internal platform review",
        "status": "submitted",
        "categoryId": null,
        "subcategoryId": null,
        "categoryLabel": "Internal platform review",
        "subcategoryLabel": null,
        "createdAt": "2026-11-25T08:34:22.910Z",
        "updatedAt": "2026-11-25T08:34:22.910Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 2, "totalPages": 1 }
  }
}
```

### 5.6 Request detail — `GET /company/:orgId/requests/:requestId`

```sh
curl "$BASE/company/$ORG_ID/requests/$REQUEST_ID" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Request fetched",
  "data": {
    "request": {
      "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
      "title": "Review our GST filings",
      "status": "discussion",
      "categoryId": "cat-01",
      "subcategoryId": "cat-01-sub-03",
      "categoryLabel": "Accounting & Finance",
      "subcategoryLabel": "Tax compliance",
      "createdAt": "2026-11-25T08:34:22.904Z",
      "updatedAt": "2026-11-25T08:34:23.669Z",
      "description": "We need a specialist to review our GST filings before the next audit.",
      "preferredCriteria": "Experience with food manufacturers.",
      "locationPreference": "Pune",
      "industriesServed": ["Food & beverage", "Cold-chain logistics"],
      "budgetRange": "₹1-3 lakh",
      "timeline": "Within 2 months",
      "intake": {
        "companyContext": "Finance team of six handling filings for three states.",
        "currentSetup": "Filings are prepared in-house with spreadsheets.",
        "deliverables": "A filing review and a corrected compliance calendar.",
        "successCriteria": "No notices from the tax department next year.",
        "constraints": "",
        "engagementModel": "One-off project",
        "readiness": "Defining the scope",
        "decisionProcess": "CFO approves the engagement."
      }
    },
    "introductions": [
      {
        "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
        "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
        "specialistName": "Ledgerline Advisory",
        "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
        "status": "accepted",
        "createdAt": "2026-11-25T08:34:23.556Z",
        "sentAt": "2026-11-25T08:34:23.606Z",
        "respondedAt": "2026-11-25T08:34:23.639Z"
      }
    ],
    "timeline": [
      { "id": "41b875f6-...", "requestId": "a2fc805c-...", "type": "request_submitted", "message": "Request submitted.", "statusAtEvent": "submitted", "createdAt": "2026-11-25T08:34:22.907Z" },
      { "id": "d7cb6bda-...", "requestId": "a2fc805c-...", "type": "status_changed", "message": "Status changed to Under Review.", "statusAtEvent": "under_review", "createdAt": "2026-11-25T08:34:23.462Z" },
      { "id": "98a26a8b-...", "requestId": "a2fc805c-...", "type": "status_changed", "message": "Status changed to Introduction Pending.", "statusAtEvent": "intro_pending", "createdAt": "2026-11-25T08:34:23.563Z" },
      { "id": "22ffbfcd-...", "requestId": "a2fc805c-...", "type": "intro_sent", "message": "An introduction was sent.", "statusAtEvent": "intro_sent", "createdAt": "2026-11-25T08:34:23.609Z" },
      { "id": "6a9e6596-...", "requestId": "a2fc805c-...", "type": "intro_accepted", "message": "A specialist accepted the introduction.", "statusAtEvent": "discussion", "createdAt": "2026-11-25T08:34:23.642Z" },
      { "id": "6443123d-...", "requestId": "a2fc805c-...", "type": "status_changed", "message": "Status changed to Discussion in Progress.", "statusAtEvent": "discussion", "createdAt": "2026-11-25T08:34:23.647Z" }
    ],
    "allowedActions": { "cancel": true }
  }
}
```

- `introductions`: only intros the admin has **sent** (`sent`, `accepted`, `declined`), newest first, at most 50. Drafts never appear.
- `timeline`: company-visible events, **oldest first**, at most 50. Render `message` as plain text.
- Show the Cancel button only when `allowedActions.cancel` is `true`.

### 5.7 Cancel a request — `POST /company/:orgId/requests/:requestId/cancel`

Any member. No body. Cancelling an already-cancelled request returns it again (200).

```sh
curl -X POST "$BASE/company/$ORG_ID/requests/$REQUEST_ID/cancel" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: the [RequestSummary](#requestsummary).

```json
{
  "success": true,
  "message": "Request cancelled",
  "data": {
    "id": "099be8b1-3a9e-49ae-acf7-1664fa80119e",
    "title": "Internal platform review",
    "status": "cancelled",
    "categoryId": null,
    "subcategoryId": null,
    "categoryLabel": "Internal platform review",
    "subcategoryLabel": null,
    "createdAt": "2026-11-25T08:34:22.910Z",
    "updatedAt": "2026-11-25T08:34:23.788Z"
  }
}
```

**409**: the request is `established` or `closed`.

```json
{ "success": false, "message": "This request can no longer be cancelled", "error": { "code": "INVALID_TRANSITION" } }
```

### 5.8 Introductions — `GET /company/:orgId/introductions?page=1`

All sent intros for this company, newest first, paginated, items are [CompanyIntroduction](#companyintroduction).

```sh
curl "$BASE/company/$ORG_ID/introductions?page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Introductions fetched",
  "data": {
    "items": [
      {
        "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
        "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
        "specialistName": "Ledgerline Advisory",
        "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
        "status": "accepted",
        "createdAt": "2026-11-25T08:34:23.556Z",
        "sentAt": "2026-11-25T08:34:23.606Z",
        "respondedAt": "2026-11-25T08:34:23.639Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1 }
  }
}
```

---

## 6. Admin workspace APIs

Every route here is under `/admin`, needs `Authorization: Bearer <accessToken>`, and needs `session.user.isPlatformAdmin === true`. Anyone else gets:

```json
{ "success": false, "message": "You do not have permission to do this", "error": { "code": "FORBIDDEN" } }
```

Admin login for development: `admin@nexora.com` / `Password@123`.

### 6.1 Dashboard — `GET /admin/dashboard`

```sh
curl "$BASE/admin/dashboard" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "counts": {
      "openRequests": 3,
      "submittedRequests": 3,
      "companies": 1,
      "introductions": 0,
      "inFlightIntroductions": 0
    },
    "openRequests": [
      {
        "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "title": "Review our GST filings",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:22.904Z",
        "updatedAt": "2026-11-25T08:34:22.904Z",
        "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "assignedAdmin": null
      }
    ],
    "recentActivity": [
      {
        "id": "add2f953-be19-4259-a624-10dd5ff0c2dd",
        "requestId": null,
        "type": "company_profile_updated",
        "message": "Company profile updated.",
        "statusAtEvent": null,
        "createdAt": "2026-11-25T08:34:23.251Z",
        "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "actor": { "id": "37199902-026a-4d7c-b602-58b235801b8b", "name": "Asha Rao" },
        "visibility": "internal",
        "entityId": "ad8a56a8-021f-40fa-8d30-7fe6256da882"
      }
    ]
  }
}
```

- `openRequests` (count): requests not `established`, `closed` or `cancelled`.
- `introductions`: all intros except discarded drafts.
- `inFlightIntroductions`: `pending` + `sent`.
- The lists hold the latest 6 open requests ([AdminRequestRow](#adminrequestrow)) and the latest 8 events ([AdminActivity](#adminactivity)).

### 6.2 Requirements queue — `GET /admin/requests`

| Query | Values |
|---|---|
| `page` | Default `1` |
| `status` | Optional, a [request status](#82-request-status-rules) |
| `assignee` | Optional: `unassigned`, or an admin `id` from `/admin/coordinators` |

```sh
curl "$BASE/admin/requests?status=submitted&assignee=unassigned&page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: paginated [AdminRequestRow](#adminrequestrow), newest first.

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "items": [
      {
        "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "title": "Review our GST filings",
        "status": "submitted",
        "categoryId": "cat-01",
        "subcategoryId": "cat-01-sub-03",
        "categoryLabel": "Accounting & Finance",
        "subcategoryLabel": "Tax compliance",
        "createdAt": "2026-11-25T08:34:22.904Z",
        "updatedAt": "2026-11-25T08:34:22.904Z",
        "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "assignedAdmin": null
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 3, "totalPages": 1 }
  }
}
```

### 6.3 Coordinators — `GET /admin/coordinators`

Active admins for the assign dropdown and the `assignee` filter. Not paginated.

```sh
curl "$BASE/admin/coordinators" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Coordinators fetched",
  "data": { "items": [{ "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" }] }
}
```

### 6.4 Request detail — `GET /admin/requests/:requestId`

The only API that returns the company's tax IDs (`company.registration`). Each call is recorded in the audit log.

```sh
curl "$BASE/admin/requests/$REQUEST_ID" -H "Authorization: Bearer $TOKEN"
```

**200 OK** (long arrays shortened)

```json
{
  "success": true,
  "message": "Request fetched",
  "data": {
    "request": {
      "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
      "title": "Review our GST filings",
      "status": "discussion",
      "categoryId": "cat-01",
      "subcategoryId": "cat-01-sub-03",
      "categoryLabel": "Accounting & Finance",
      "subcategoryLabel": "Tax compliance",
      "createdAt": "2026-11-25T08:34:22.904Z",
      "updatedAt": "2026-11-25T08:34:23.669Z",
      "description": "We need a specialist to review our GST filings before the next audit.",
      "preferredCriteria": "Experience with food manufacturers.",
      "locationPreference": "Pune",
      "industriesServed": ["Food & beverage", "Cold-chain logistics"],
      "budgetRange": "₹1-3 lakh",
      "timeline": "Within 2 months",
      "intake": {
        "companyContext": "Finance team of six handling filings for three states.",
        "currentSetup": "Filings are prepared in-house with spreadsheets.",
        "deliverables": "A filing review and a corrected compliance calendar.",
        "successCriteria": "No notices from the tax department next year.",
        "constraints": "",
        "engagementModel": "One-off project",
        "readiness": "Defining the scope",
        "decisionProcess": "CFO approves the engagement."
      }
    },
    "company": {
      "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882",
      "name": "Halden Foods",
      "slug": "halden-foods",
      "website": "https://halden.example",
      "industry": "Food & beverage",
      "size": "51-200",
      "location": "Mumbai",
      "country": "India",
      "description": "Packaged food manufacturer with regional distribution.",
      "createdAt": "2026-11-25T08:34:22.895Z",
      "updatedAt": "2026-11-25T08:34:23.244Z",
      "registration": {
        "entityType": "Private Limited / Public Limited",
        "gstin": "27AAPFU0939F1ZV",
        "pan": "AAPFU0939F",
        "udyamNumber": null
      }
    },
    "assignedAdmin": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "introductions": [
      {
        "id": "23706561-6959-49bb-96b6-f139cc2bd130",
        "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
        "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "specialistName": "Northwind Tax",
        "message": "Northwind specialises in multi-state GST.",
        "status": "pending",
        "createdAt": "2026-11-25T08:34:23.661Z",
        "sentAt": null,
        "respondedAt": null,
        "discardedAt": "2026-11-25T08:34:23.671Z",
        "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "sentBy": null,
        "respondedBy": null,
        "allowedActions": { "send": false, "respond": false, "discard": false }
      },
      {
        "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
        "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
        "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "specialistName": "Ledgerline Advisory",
        "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
        "status": "accepted",
        "createdAt": "2026-11-25T08:34:23.556Z",
        "sentAt": "2026-11-25T08:34:23.606Z",
        "respondedAt": "2026-11-25T08:34:23.639Z",
        "discardedAt": null,
        "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "sentBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "respondedBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "allowedActions": { "send": false, "respond": false, "discard": false }
      }
    ],
    "timeline": [
      {
        "id": "41b875f6-9f9a-46f7-89a8-adcd5b35592b",
        "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "type": "request_submitted",
        "message": "Request submitted.",
        "statusAtEvent": "submitted",
        "createdAt": "2026-11-25T08:34:22.907Z",
        "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "actor": { "id": "37199902-026a-4d7c-b602-58b235801b8b", "name": "Asha Rao" },
        "visibility": "public",
        "entityId": "a2fc805c-2b87-468c-9bfa-dd070d225f46"
      },
      {
        "id": "5c5b6ffc-f67f-46fc-bcff-145b87061f87",
        "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "type": "request_assigned",
        "message": "Request assigned.",
        "statusAtEvent": "shortlisted",
        "createdAt": "2026-11-25T08:34:23.525Z",
        "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "actor": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "visibility": "internal",
        "entityId": "a2fc805c-2b87-468c-9bfa-dd070d225f46"
      }
    ],
    "internalNotes": [
      {
        "id": "d9aaa60c-55c3-4989-981a-4fd07844c430",
        "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "type": "internal_note",
        "message": "Client prefers Pune-based firms.",
        "statusAtEvent": "shortlisted",
        "createdAt": "2026-11-25T08:34:23.537Z",
        "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "actor": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "visibility": "internal",
        "entityId": null
      }
    ],
    "allowedActions": {
      "changeStatusTo": ["established", "closed", "cancelled"],
      "assign": true,
      "addNote": true,
      "draftIntroduction": true
    }
  }
}
```

- `introductions`: every intro on the request, including drafts and discarded ones (`discardedAt` set), newest first, at most 50.
- `timeline`: every event except internal notes, **oldest first**, at most 50. `visibility: "public"` events are the ones the company also sees.
- `internalNotes`: newest first, at most 50. Never shown to the company.
- `allowedActions.changeStatusTo`: the only statuses you may offer in the status dropdown.

### 6.5 Change status — `PATCH /admin/requests/:requestId/status`

Body: `{ "status": "<request status>" }`. Only send a value from `allowedActions.changeStatusTo`. Sending the current status does nothing and returns 200.

```sh
curl -X PATCH "$BASE/admin/requests/$REQUEST_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "under_review" }'
```

**200 OK**: the [AdminRequestRow](#adminrequestrow).

```json
{
  "success": true,
  "message": "Status updated",
  "data": {
    "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
    "title": "Review our GST filings",
    "status": "under_review",
    "categoryId": "cat-01",
    "subcategoryId": "cat-01-sub-03",
    "categoryLabel": "Accounting & Finance",
    "subcategoryLabel": "Tax compliance",
    "createdAt": "2026-11-25T08:34:22.904Z",
    "updatedAt": "2026-11-25T08:34:23.459Z",
    "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "assignedAdmin": null
  }
}
```

**409**: not an allowed step (for example skipping a step, or reopening a finished request).

```json
{ "success": false, "message": "This status change is not allowed", "error": { "code": "INVALID_TRANSITION" } }
```

### 6.6 Assign a coordinator — `PATCH /admin/requests/:requestId/assignment`

Body: `{ "adminId": "<coordinator id>" }`, or `{ "adminId": null }` to unassign.

```sh
curl -X PATCH "$BASE/admin/requests/$REQUEST_ID/assignment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "adminId": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d" }'
```

**200 OK**: the [AdminRequestRow](#adminrequestrow) with `assignedAdmin` set.

```json
{
  "success": true,
  "message": "Assignment updated",
  "data": {
    "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
    "title": "Review our GST filings",
    "status": "shortlisted",
    "categoryId": "cat-01",
    "subcategoryId": "cat-01-sub-03",
    "categoryLabel": "Accounting & Finance",
    "subcategoryLabel": "Tax compliance",
    "createdAt": "2026-11-25T08:34:22.904Z",
    "updatedAt": "2026-11-25T08:34:23.523Z",
    "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "assignedAdmin": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" }
  }
}
```

**400**: not an active coordinator.

```json
{ "success": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "adminId", "message": "Choose an active coordinator" }] } }
```

### 6.7 Add an internal note — `POST /admin/requests/:requestId/notes`

Body: `{ "message": "<1-2000 chars>" }`. Allowed at any status. Never visible to the company.

```sh
curl -X POST "$BASE/admin/requests/$REQUEST_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "message": "Client prefers Pune-based firms." }'
```

**201 Created**: an [AdminActivity](#adminactivity).

```json
{
  "success": true,
  "message": "Note added",
  "data": {
    "id": "d9aaa60c-55c3-4989-981a-4fd07844c430",
    "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
    "type": "internal_note",
    "message": "Client prefers Pune-based firms.",
    "statusAtEvent": "shortlisted",
    "createdAt": "2026-11-25T08:34:23.537Z",
    "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "actor": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "visibility": "internal",
    "entityId": null
  }
}
```

### 6.8 Draft an introduction — `POST /admin/requests/:requestId/introductions`

Allowed only when `allowedActions.draftIntroduction` is `true` (statuses `shortlisted`, `intro_pending`, `intro_sent`, `discussion`). The first draft moves a `shortlisted` request to `intro_pending`.

| Field | Rules |
|---|---|
| `specialistName` | 2-120. Repeated spaces are collapsed. Can't be edited later; discard and draft again instead |
| `message` | 20-2000. Shared with the company when sent |

```sh
curl -X POST "$BASE/admin/requests/$REQUEST_ID/introductions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "specialistName": "Ledgerline Advisory", "message": "Ledgerline has reviewed GST filings for 40+ manufacturers." }'
```

**201 Created**: an [AdminIntroduction](#adminintroduction).

```json
{
  "success": true,
  "message": "Introduction drafted",
  "data": {
    "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
    "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
    "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "specialistName": "Ledgerline Advisory",
    "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
    "status": "pending",
    "createdAt": "2026-11-25T08:34:23.556Z",
    "sentAt": null,
    "respondedAt": null,
    "discardedAt": null,
    "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "sentBy": null,
    "respondedBy": null,
    "allowedActions": { "send": true, "respond": false, "discard": true }
  }
}
```

**Errors**

```json
// 409: this specialist already has a pending/sent/accepted intro on this request
// (names compared ignoring case and extra spaces; declined or discarded intros don't block)
{ "success": false, "message": "This specialist already has an open introduction for this request", "error": { "code": "INTRO_EXISTS" } }

// 409: request is not at a drafting status
{ "success": false, "message": "Introductions cannot be drafted at this stage", "error": { "code": "INVALID_TRANSITION" } }
```

### 6.9 Send an introduction — `POST /admin/introductions/:introId/send`

No body. Publishes the intro to the company workspace (no email yet). The first send moves an `intro_pending` request to `intro_sent`.

```sh
curl -X POST "$BASE/admin/introductions/$INTRO_ID/send" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: the [AdminIntroduction](#adminintroduction) with `status: "sent"`.

```json
{
  "success": true,
  "message": "Introduction sent",
  "data": {
    "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
    "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
    "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "specialistName": "Ledgerline Advisory",
    "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
    "status": "sent",
    "createdAt": "2026-11-25T08:34:23.556Z",
    "sentAt": "2026-11-25T08:34:23.606Z",
    "respondedAt": null,
    "discardedAt": null,
    "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "sentBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "respondedBy": null,
    "allowedActions": { "send": false, "respond": true, "discard": false }
  }
}
```

**409**: already sent, discarded, or the request isn't at a sending status (`intro_pending`, `intro_sent`, `discussion`).

```json
{ "success": false, "message": "Only a draft introduction can be sent", "error": { "code": "INVALID_TRANSITION" } }
```

### 6.10 Record the specialist's reply — `POST /admin/introductions/:introId/response`

Body: `{ "status": "accepted" }` or `{ "status": "declined" }`. Only for a `sent` intro.

- The first acceptance moves an `intro_sent` request to `discussion`.
- A decline never changes the request status.
- Replies can still be recorded after the request is finished; the status stays the same.

```sh
curl -X POST "$BASE/admin/introductions/$INTRO_ID/response" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "accepted" }'
```

**200 OK**: the [AdminIntroduction](#adminintroduction).

```json
{
  "success": true,
  "message": "Response recorded",
  "data": {
    "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
    "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
    "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
    "specialistName": "Ledgerline Advisory",
    "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
    "status": "accepted",
    "createdAt": "2026-11-25T08:34:23.556Z",
    "sentAt": "2026-11-25T08:34:23.606Z",
    "respondedAt": "2026-11-25T08:34:23.639Z",
    "discardedAt": null,
    "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "sentBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "respondedBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
    "allowedActions": { "send": false, "respond": false, "discard": false }
  }
}
```

**409**: the intro isn't `sent` (still a draft, or already answered).

```json
{ "success": false, "message": "A response can only be recorded for a sent introduction", "error": { "code": "INVALID_TRANSITION" } }
```

### 6.11 Discard a draft — `POST /admin/introductions/:introId/discard`

No body. Only for an unsent draft. Discarding an already-discarded draft returns 200.

```sh
curl -X POST "$BASE/admin/introductions/$INTRO_ID/discard" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{ "success": true, "message": "Introduction discarded", "data": null }
```

**409**: the intro was already sent.

```json
{ "success": false, "message": "Only a draft introduction can be discarded", "error": { "code": "INVALID_TRANSITION" } }
```

### 6.12 All introductions — `GET /admin/introductions`

| Query | Values |
|---|---|
| `page` | Default `1` |
| `status` | Optional: `pending`, `sent`, `accepted`, `declined` |

Discarded drafts are left out. Newest first.

```sh
curl "$BASE/admin/introductions?status=sent&page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: paginated [AdminIntroduction](#adminintroduction).

```json
{
  "success": true,
  "message": "Introductions fetched",
  "data": {
    "items": [
      {
        "id": "03ff5192-d04c-4b2b-8103-1d1b84c96f76",
        "request": { "id": "a2fc805c-2b87-468c-9bfa-dd070d225f46", "title": "Review our GST filings" },
        "company": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "specialistName": "Ledgerline Advisory",
        "message": "Ledgerline has reviewed GST filings for 40+ manufacturers.",
        "status": "sent",
        "createdAt": "2026-11-25T08:34:23.556Z",
        "sentAt": "2026-11-25T08:34:23.606Z",
        "respondedAt": null,
        "discardedAt": null,
        "createdBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "sentBy": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "respondedBy": null,
        "allowedActions": { "send": false, "respond": true, "discard": false }
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1 }
  }
}
```

### 6.13 Companies — `GET /admin/companies?page=1`

Read-only. Newest first.

```sh
curl "$BASE/admin/companies?page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Companies fetched",
  "data": {
    "items": [
      {
        "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882",
        "name": "Halden Foods",
        "industry": "Food & beverage",
        "location": "Mumbai",
        "country": "India",
        "size": "51-200",
        "requestCount": 3,
        "memberCount": 1,
        "createdAt": "2026-11-25T08:34:22.895Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 1, "totalPages": 1 }
  }
}
```

### 6.14 Users & Access — `GET /admin/users?page=1`

Read-only. Newest first.

```sh
curl "$BASE/admin/users?page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "items": [
      {
        "user": {
          "id": "37199902-026a-4d7c-b602-58b235801b8b",
          "name": "Asha Rao",
          "email": "asha@halden.example",
          "isPlatformAdmin": false,
          "createdAt": "2026-11-25T08:34:22.885Z"
        },
        "memberships": [
          { "orgId": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "orgName": "Halden Foods", "role": "owner" }
        ]
      },
      {
        "user": {
          "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d",
          "name": "Nexora Admin",
          "email": "admin@nexora.com",
          "isPlatformAdmin": true,
          "createdAt": "2026-11-25T08:31:59.375Z"
        },
        "memberships": []
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 2, "totalPages": 1 }
  }
}
```

### 6.15 Activity log — `GET /admin/activity`

| Query | Values |
|---|---|
| `page` | Default `1` |
| `visibility` | Optional: `public` (also shown to the company) or `internal` |
| `q` | Optional, 1-100. Case-insensitive text search in `type` and `message`. Debounce input by about 250 ms |
| `type` | Optional, an exact [event type](#83-activity-event-types). Without it, `registration_viewed` audit events are left out |

```sh
curl "$BASE/admin/activity?visibility=public&page=1" -H "Authorization: Bearer $TOKEN"
```

**200 OK**: paginated [AdminActivity](#adminactivity), newest first.

```json
{
  "success": true,
  "message": "Activity fetched",
  "data": {
    "items": [
      {
        "id": "6443123d-76d0-4cf1-81af-caa0724709aa",
        "requestId": "a2fc805c-2b87-468c-9bfa-dd070d225f46",
        "type": "status_changed",
        "message": "Status changed to Discussion in Progress.",
        "statusAtEvent": "discussion",
        "createdAt": "2026-11-25T08:34:23.647Z",
        "org": { "id": "ad8a56a8-021f-40fa-8d30-7fe6256da882", "name": "Halden Foods" },
        "actor": { "id": "06eb8520-1b97-4fcb-9e1c-e3d5f1fa5e1d", "name": "Nexora Admin" },
        "visibility": "public",
        "entityId": "a2fc805c-2b87-468c-9bfa-dd070d225f46"
      }
    ],
    "pagination": { "page": 1, "pageSize": 25, "totalItems": 12, "totalPages": 1 }
  }
}
```

---

## 7. Shared objects

### Requirement fields

Used by `requirements[]` in registration and in `POST /company/:orgId/requests`. Optional text fields may be left out or sent as `""`.

| Field | Required | Rules |
|---|---|---|
| `categoryId` | yes | 1-48. A category ID from the frontend catalogue, or `other` |
| `subcategoryId` | yes | 1-48. A subcategory ID, `other`, or `not-specified`. With `categoryId: "other"` it must be `other` or `not-specified` |
| `categoryLabel` | when `categoryId` is not `other` | 0-120. The category's display name |
| `subcategoryLabel` | when `subcategoryId` is a real ID | 0-120. The subcategory's display name |
| `customCategory` | only when `categoryId` is `other` | 1-120 when required; must be empty otherwise |
| `customSubcategory` | only when `subcategoryId` is `other` | 1-120 when required; must be empty otherwise |
| `title` | yes | 4-140 |
| `description` | yes | 20-3000 |
| `intake.companyContext` | yes | 20-1500 |
| `intake.currentSetup` | no | 0-1500 |
| `intake.deliverables` | yes | 15-1500 |
| `intake.successCriteria` | yes | 12-1000 |
| `intake.constraints` | no | 0-1000 |
| `intake.engagementModel` | yes | One of [engagement models](#81-option-lists) |
| `intake.readiness` | yes | One of [readiness levels](#81-option-lists) |
| `intake.decisionProcess` | no | 0-1000 |
| `budgetRange` | yes | 1-120, free text (e.g. `Not decided yet`) |
| `timeline` | yes | 1-120, free text |
| `locationPreference` | no | 0-120 |
| `preferredCriteria` | no | 0-1000 |
| `industriesServed` | yes | Array (may be empty), max 25, each 1-80 |
| `otherIndustries` | only when `industriesServed` includes `"Other"` | Comma-separated, each name max 80, at most 40 names. Must be empty when `"Other"` isn't selected |

How categories are stored:

| You send | Stored and returned |
|---|---|
| `cat-01` + `cat-01-sub-03` | Both IDs and both labels |
| `cat-01` + `not-specified` | Category ID and label; `subcategoryId` and `subcategoryLabel` are `null` |
| `cat-01` + `other` + `customSubcategory` | Category ID and label; `subcategoryId` `null`; `subcategoryLabel` = your custom text |
| `other` + `not-specified` + `customCategory` | Both IDs `null`; `categoryLabel` = your custom text |
| `other` + `other` + both custom fields | Both IDs `null`; both labels = your custom text |

`"Other"` in `industriesServed` is replaced by the names from `otherIndustries`, and duplicate names are removed (ignoring case). For example, `["Food & beverage", "Other"]` with `"Cold-chain logistics"` is stored as `["Food & beverage", "Cold-chain logistics"]`.

### Company profile fields

| Field | Rules |
|---|---|
| `name` | 2-120 |
| `website` | Optional, max 300. A plain domain becomes `https://domain`; otherwise it must be a valid `http(s)` URL |
| `industry` | 1-80, free text |
| `size` | One of [company sizes](#81-option-lists) |
| `location` | 2-120 |
| `country` | 2-80 |
| `description` | 20-2000 |

### CompanyProfile

`{ id, name, slug, website, industry, size, location, country, description, createdAt, updatedAt }`. It never includes tax IDs.

### RequestSummary

`{ id, title, status, categoryId, subcategoryId, categoryLabel, subcategoryLabel, createdAt, updatedAt }`

- `categoryLabel` is the catalogue label or the custom category, or `"Category not specified"`.
- `subcategoryLabel` can be `null`.

### RequestBrief

`RequestSummary` + `{ description, preferredCriteria, locationPreference, industriesServed, budgetRange, timeline, intake }`.

### CompanyIntroduction

`{ id, request: { id, title }, specialistName, message, status, createdAt, sentAt, respondedAt }`. `status` is `sent`, `accepted` or `declined`.

### CompanyActivity

`{ id, requestId, type, message, statusAtEvent, createdAt }`. `requestId` and `statusAtEvent` can be `null`.

### AdminRequestRow

`RequestSummary` + `{ company: { id, name }, assignedAdmin: { id, name } | null }`.

### AdminIntroduction

`{ id, request: { id, title }, company: { id, name }, specialistName, message, status, createdAt, sentAt, respondedAt, discardedAt, createdBy, sentBy, respondedBy, allowedActions: { send, respond, discard } }`. `createdBy`, `sentBy` and `respondedBy` are `{ id, name }` or `null`.

### AdminActivity

`CompanyActivity` + `{ org: { id, name } | null, actor: { id, name } | null, visibility: "public" | "internal", entityId }`.

---

## 8. Fixed values and status rules

### 8.1 Option lists

Send these values exactly as written.

| Field | Allowed values |
|---|---|
| Company `size` | `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+` |
| `registration.entityType` | `Individual / Proprietorship`, `Partnership`, `LLP`, `Private Limited / Public Limited`, `Other` |
| `intake.engagementModel` | `One-off project`, `Ongoing support`, `Pilot or trial`, `Advisory only`, `Not decided yet` |
| `intake.readiness` | `Exploring options`, `Defining the scope`, `Preparing to select a partner`, `Ready to start` (the UI may label the third one "Preparing to select a specialist") |
| Contact `subject` | `Writing a business brief`, `Requests and introductions`, `Platform feedback`, `Other` |
| Membership `role` | `owner`, `admin`, `member` |
| Introduction `status` | `pending` (draft), `sent`, `accepted`, `declined` |

### 8.2 Request status rules

| `status` | UI label | Admin can move it to | Moves automatically when |
|---|---|---|---|
| `submitted` | Submitted | `under_review`, `closed`, `cancelled` | |
| `under_review` | Under Review | `partner_search`, `closed`, `cancelled` | |
| `partner_search` | Specialist Search in Progress | `shortlisted`, `closed`, `cancelled` | |
| `shortlisted` | Specialists Shortlisted | `closed`, `cancelled` | first intro drafted → `intro_pending` |
| `intro_pending` | Introduction Pending | `closed`, `cancelled` | first intro sent → `intro_sent` |
| `intro_sent` | Introduction Sent | `closed`, `cancelled` | first intro accepted → `discussion` |
| `discussion` | Discussion in Progress | `established`, `closed`, `cancelled` | |
| `established` | Established | finished | |
| `closed` | Closed | finished | |
| `cancelled` | Cancelled | finished | |

- **Finished:** `established`, `closed` and `cancelled` never change again.
- **Company cancel:** a company can cancel any request that isn't finished.
- **When a request finishes:** unsent draft intros are discarded automatically. Sent intros stay.
- **Use the server's options:** always build the status buttons from `allowedActions.changeStatusTo`, not from this table.

### 8.3 Activity event types

| `type` | `visibility` | Meaning |
|---|---|---|
| `org_created` | public | Company registered |
| `request_submitted` | public | A request was submitted |
| `status_changed` | public | Request status changed (`message` names the new status) |
| `intro_sent` | public | An introduction was sent |
| `intro_accepted` | public | A specialist accepted |
| `intro_declined` | public | A specialist declined |
| `company_profile_updated` | internal | Company edited its profile |
| `request_assigned` | internal | Coordinator assigned or removed |
| `internal_note` | internal | Admin note |
| `intro_drafted` | internal | Intro draft created |
| `intro_discarded` | internal | Draft discarded |
| `registration_viewed` | internal | Admin opened request detail with tax IDs (audit) |

`public` means "visible to that company", not visible to everyone.
