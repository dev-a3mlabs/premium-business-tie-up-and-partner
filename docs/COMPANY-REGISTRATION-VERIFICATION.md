# Company registration: GSTIN, PAN and Udyam verification

Registration now checks the company's GSTIN, PAN and Udyam number against government records before the account is created. There is **no new endpoint**. Everything happens inside the existing `POST /auth/company-registration`.

This guide covers what changed for the frontend: the flow, the request, every response, and how to show each error.

---

## 1. Flow

```
User fills every wizard step (Account → Company → Registration → Requirements)
  │   Validate formats in the browser (see section 3). No API calls between steps.
  ▼
POST /auth/company-registration      (one call; can take a few seconds, show a loader)
  │
  ├─ 201 Created ...................... save accessToken + refreshToken → confirmation → /app
  │
  ├─ 409 EMAIL_TAKEN .................. go back to the Account step, show the error on Email
  │
  ├─ 400 VALIDATION_ERROR ............. map each details[].field to its step + field (section 6)
  │      e.g. org.registration.gstin   → Registration step, GSTIN field
  │           org.name                 → Company step, Company name field
  │
  └─ 503 VERIFICATION_UNAVAILABLE ..... keep every form value, show a retry message,
                                        let the user press Submit again
```

Nothing is saved unless the call returns `201`. After any error the user can fix the fields and submit again.

---

## 2. Endpoint

```
POST {BASE}/auth/company-registration
Content-Type: application/json
```

`BASE` is `http://localhost:5001/api/v1` locally. The endpoint is public, so no `Authorization` header.

---

## 3. Registration fields

| Field | Required | Format (validate in the browser too) |
|---|---|---|
| `org.name` | Yes | 2-120 characters. **Must match the company name on the GST registration** (see below) |
| `org.registration.entityType` | Yes | One of the entity type options |
| `org.registration.gstin` | Yes | `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$` (15 characters). The server uppercases it |
| `org.registration.pan` | Yes | `^[A-Z]{5}\d{4}[A-Z]$`, and it must equal GSTIN characters 3-12 |
| `org.registration.udyamNumber` | No | `""` or `^UDYAM-[A-Z]{2}-\d{2}-\d{7}$`. Send `""` if the company has none |

**What the server checks:**

| Number | Passes when |
|---|---|
| GSTIN | It exists **and** its status is Active **and** `org.name` matches its registered legal or trade name |
| PAN | It exists and is valid |
| Udyam | Only checked if sent. It exists and is not cancelled |

**Company name matching** ignores case, spaces, punctuation and common short forms, so these all match `MAPMONEY FINTECH PRIVATE LIMITED`:

- `MapMoney Fintech Private Limited`
- `MapMoney Fintech Pvt. Ltd.`
- `mapmoney fintech pvt ltd`

Hint for the UI: put helper text under Company name such as *"Enter the name as it appears on your GST registration."*

---

## 4. Request

```sh
curl -X POST "$BASE/auth/company-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": {
      "contactName": "Test User",
      "email": "verify-doc-3@example.com",
      "password": "StrongPass#1"
    },
    "org": {
      "name": "MapMoney Fintech Pvt. Ltd.",
      "website": "",
      "industry": "Financial services",
      "size": "11-50",
      "location": "Mohali",
      "country": "India",
      "description": "Fintech company building payment products for merchants.",
      "registration": {
        "entityType": "Private Limited / Public Limited",
        "gstin": "03AAUCM6464H1Z2",
        "pan": "AAUCM6464H",
        "udyamNumber": "UDYAM-MH-26-0012345"
      }
    },
    "requirements": [
      {
        "categoryId": "other",
        "subcategoryId": "not-specified",
        "customCategory": "Compliance review",
        "title": "Compliance review",
        "description": "Independent review of our GST compliance before scaling.",
        "intake": {
          "companyContext": "Small finance team handling filings for one state.",
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

The rest of the body (`contact`, the other `org` fields and `requirements`) is unchanged.

---

## 5. Responses

### 5.1 `201 Created`: registered and signed in

```json
{
  "success": true,
  "message": "Company registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "cEfHyFzUbN1bsCX_0svnFlrW-YK9x4QvQobFj9Fk...",
    "session": {
      "user": {
        "id": "71ae47df-4b92-4080-985b-75212340b90a",
        "name": "Test User",
        "email": "verify-doc-3@example.com",
        "isPlatformAdmin": false,
        "createdAt": "2026-11-26T07:02:09.023Z"
      },
      "memberships": [
        { "orgId": "6f02faab-fe63-402d-b1a3-c3e6bb4c4fe3", "role": "owner", "createdAt": "2026-11-26T07:02:09.037Z" }
      ],
      "organizations": [
        { "id": "6f02faab-fe63-402d-b1a3-c3e6bb4c4fe3", "name": "MapMoney Fintech Pvt. Ltd." }
      ],
      "activeOrgId": "6f02faab-fe63-402d-b1a3-c3e6bb4c4fe3"
    },
    "organization": {
      "id": "6f02faab-fe63-402d-b1a3-c3e6bb4c4fe3",
      "name": "MapMoney Fintech Pvt. Ltd.",
      "slug": "mapmoney-fintech-pvt-ltd",
      "website": "",
      "industry": "Financial services",
      "size": "11-50",
      "location": "Mohali",
      "country": "India",
      "description": "Fintech company building payment products for merchants.",
      "createdAt": "2026-11-26T07:02:09.034Z",
      "updatedAt": "2026-11-26T07:02:09.034Z"
    },
    "requests": [
      {
        "id": "dcaf22a3-4fb5-49b0-be90-ba23b227fd89",
        "title": "Compliance review",
        "status": "submitted",
        "categoryId": null,
        "subcategoryId": null,
        "categoryLabel": "Compliance review",
        "subcategoryLabel": null,
        "createdAt": "2026-11-26T07:02:09.048Z",
        "updatedAt": "2026-11-26T07:02:09.048Z"
      }
    ]
  }
}
```

Same shape as before. Save the tokens and redirect to `/app` using `session.activeOrgId`.

### 5.2 `400 VALIDATION_ERROR`: company name doesn't match the GST registration

The GSTIN is valid and active, but `org.name` was `"Acme Corp"`.

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "org.name", "message": "Company name must match the name registered for this GSTIN" }
    ]
  }
}
```

### 5.3 `400 VALIDATION_ERROR`: numbers not found

Every failing number is listed in a single response, so show all of them at once.

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "org.registration.gstin", "message": "GSTIN could not be verified" },
      { "field": "org.registration.pan", "message": "PAN could not be verified" },
      { "field": "org.registration.udyamNumber", "message": "Udyam number could not be verified" }
    ]
  }
}
```

### 5.4 `400 VALIDATION_ERROR`: GSTIN not active / Udyam cancelled

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "org.registration.gstin", "message": "GSTIN is not active" },
      { "field": "org.registration.udyamNumber", "message": "Udyam registration is cancelled" }
    ]
  }
}
```

### 5.5 `409 EMAIL_TAKEN`

Checked before the numbers are verified.

```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error": { "code": "EMAIL_TAKEN" }
}
```

### 5.6 `503 VERIFICATION_UNAVAILABLE`: verification is down for a moment

Nothing was saved. Keep every form value and let the user submit again.

```json
{
  "success": false,
  "message": "Verification is unavailable right now. Please try again shortly.",
  "error": { "code": "VERIFICATION_UNAVAILABLE" }
}
```

---

## 6. Error → wizard step mapping

| `details[].field` | Possible `message` | Wizard step | Form field |
|---|---|---|---|
| `org.name` | `Company name must match the name registered for this GSTIN` | Company | Company name |
| `org.registration.gstin` | `GSTIN could not be verified` | Registration | GSTIN |
| `org.registration.gstin` | `GSTIN is not active` | Registration | GSTIN |
| `org.registration.pan` | `PAN could not be verified` | Registration | PAN |
| `org.registration.udyamNumber` | `Udyam number could not be verified` | Registration | Udyam number |
| `org.registration.udyamNumber` | `Udyam registration is cancelled` | Registration | Udyam number |

Suggested handling:

1. Put each message under its field.
2. Send the user to the **first** step that has an error, in wizard order. A name mismatch goes to the Company step, even if the Registration step also has errors.
3. Show the server's `message` text as is.

```ts
const STEP_OF_FIELD = (field: string) => {
  if (field.startsWith('contact.')) return 'account';
  if (field.startsWith('org.registration.')) return 'registration';
  if (field.startsWith('org.')) return 'company';
  if (field.startsWith('requirements.')) return 'requirements';
  return 'review';
};

async function submitRegistration(body: RegistrationBody) {
  const res = await fetch(`${BASE}/auth/company-registration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();

  if (json.success) return { ok: true, data: json.data };

  switch (json.error.code) {
    case 'VALIDATION_ERROR':
      return { ok: false, fieldErrors: json.error.details }; // [{ field, message }], use STEP_OF_FIELD
    case 'EMAIL_TAKEN':
      return { ok: false, fieldErrors: [{ field: 'contact.email', message: json.message }] };
    case 'VERIFICATION_UNAVAILABLE':
      return { ok: false, retry: true, message: json.message }; // keep form values, show retry
    default:
      return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}
```

---

## 7. UX notes

- **Loading:** the call now takes a few seconds. Disable the Submit button and show a loader such as "Verifying your company details…" so it isn't pressed twice.
- **No per-field checks:** there is no separate endpoint to check a number while the user types. Check the formats from section 3 in the browser and let the final submit do the real check.
- **PAN and GSTIN:** pre-fill PAN from GSTIN characters 3-12 once a valid GSTIN is entered, to avoid mismatches.
- **Udyam is optional:** if it's empty, send `""` and it won't be checked.

---

## 8. Test values (local / sandbox)

| Case | `org.name` | `gstin` | `pan` | `udyamNumber` | Result |
|---|---|---|---|---|---|
| Success | `MapMoney Fintech Pvt. Ltd.` | `03AAUCM6464H1Z2` | `AAUCM6464H` | `UDYAM-MH-26-0012345` | `201` |
| Success without Udyam | `MapMoney Fintech Pvt. Ltd.` | `03AAUCM6464H1Z2` | `AAUCM6464H` | `""` | `201` |
| Name mismatch | `Acme Corp` | `03AAUCM6464H1Z2` | `AAUCM6464H` | `""` | `400`, `org.name` |
| Numbers not found | `Acme Corp` | `27AAPFU0939F1ZV` | `AAPFU0939F` | `UDYAM-MH-26-9999999` | `400`, three fields |

Use a new `contact.email` for each successful test, or you'll get `409 EMAIL_TAKEN`.
