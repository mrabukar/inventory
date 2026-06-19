# Cloudflare R2 object storage

How to configure R2 for **organization logos** (Phase 0 of report branding). The API stores logo files in a private bucket and serves them only to authenticated super admins and org admins.

For the full upload architecture (API layers, sharp processing, frontend patterns, and how to add new image types), see [image-upload.md](./image-upload.md).

---

## Table of contents

1. [What uses R2](#1-what-uses-r2)
2. [Environment variables](#2-environment-variables)
3. [Create the R2 bucket](#3-create-the-r2-bucket)
4. [Find values from the Cloudflare dashboard](#4-find-values-from-the-cloudflare-dashboard)
5. [Create API credentials](#5-create-api-credentials)
6. [Configure api/.env](#6-configure-apienv)
7. [Local development without R2](#7-local-development-without-r2)
8. [Verify it works](#8-verify-it-works)
9. [Security notes](#9-security-notes)
10. [Troubleshooting](#10-troubleshooting)
11. [Related code](#11-related-code)

---

## 1. What uses R2

| Feature | Storage path in bucket |
|---------|------------------------|
| Organization report logo | `org-logos/{organizationId}/logo.jpg` or `logo.png` |

Logos are uploaded via:

- **Super admin:** create org (optional) or org detail page
- **Org admin:** **Administration → Organization** (`/settings/organization`)

Future report PDF export (Phase 1+) will read the same `logoKey` from the database.

---

## 2. Environment variables

Add these to [`api/.env`](../.env) (see [`.env.example`](../.env.example)):

| Variable | Required for R2 | Description |
|----------|-----------------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID (32-char hex) |
| `R2_ACCESS_KEY_ID` | Yes | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API token secret (shown once at creation) |
| `R2_BUCKET` | Yes | Bucket name, e.g. `inventory-images` |
| `R2_ENDPOINT` | Yes | S3-compatible endpoint URL for the account |
| `STORAGE_LOCAL_PATH` | No | Local folder when R2 is **not** configured (default: `api/uploads`) |

**All five R2 variables must be set** for the API to use Cloudflare. If any is missing, logos are stored on the server filesystem under `uploads/` instead.

Restart the API after changing `.env`.

---

## 3. Create the R2 bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Storage & databases → R2 Object Storage**.
3. **Create bucket** — e.g. `inventory-images`.
4. Choose a location (e.g. Western Europe). Region does not affect the env var format.
5. Leave the bucket **private** — do **not** enable **Public Development URL** for logos.

---

## 4. Find values from the Cloudflare dashboard

Open the bucket → **Settings** tab.

### `R2_BUCKET`

**General → Name**

```env
R2_BUCKET=inventory-images
```

### `R2_ENDPOINT`

**General → S3 API** — copy the **account** URL only (no trailing slash, **no bucket name**):

```env
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

**Wrong** (causes `inventory-images/inventory-images/org-logos/...` in the dashboard):

```env
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com/inventory-images
```

The bucket is selected separately via `R2_BUCKET`. Do not append it to the endpoint.

Example:

```env
R2_ENDPOINT=https://27d467092f696e13ea86f746fdeec469.r2.cloudflarestorage.com
```

### `R2_ACCOUNT_ID`

The same hex ID appears in:

- The S3 API hostname (before `.r2.cloudflarestorage.com`)
- The dashboard URL: `https://dash.cloudflare.com/<account_id>/r2/...`

```env
R2_ACCOUNT_ID=27d467092f696e13ea86f746fdeec469
```

---

## 5. Create API credentials

`R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are **not** on the bucket settings page.

1. R2 overview → **Manage R2 API Tokens** (right sidebar), or **My Profile → API Tokens**.
2. **Create API token** with R2 permissions:
   - **Object Read & Write** (minimum), or **Admin Read & Write** for that bucket.
   - Restrict to the logo bucket when possible (`inventory-images`).
3. Create the token and copy:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY` (only shown once; store it safely)

Never commit these values to git. Use `api/.env` on each environment (local, VPS).

---

## 6. Configure api/.env

Example block (replace with your real values):

```env
R2_ACCOUNT_ID=27d467092f696e13ea86f746fdeec469
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET=inventory-images
R2_ENDPOINT=https://27d467092f696e13ea86f746fdeec469.r2.cloudflarestorage.com
```

On the VPS: edit `api/.env`, then restart the API process (same as any other env change).

---

## 7. Local development without R2

Omit all `R2_*` variables. The API automatically uses:

```
api/uploads/org-logos/{organizationId}/logo.jpg
```

`uploads/` is gitignored. This is fine for local testing; production should use R2 so logos survive redeploys and work across instances.

Optional override:

```env
STORAGE_LOCAL_PATH=./uploads
```

---

## 8. Verify it works

1. Run migrations if not already: `cd api && pnpm prisma:migrate`
2. Restart API with R2 env vars set.
3. Sign in as **super admin** or **org admin**.
4. Upload a PNG or JPG logo (max 3MB):
   - Super admin: **Organizations → [org] → Report logo**
   - Org admin: **Administration → Organization**
5. In Cloudflare: bucket **Objects** tab → look for  
   `org-logos/<organizationId>/logo.jpg` (or `.png`).

If upload succeeds but nothing appears in R2, the API is still on local fallback — recheck all five `R2_*` vars and restart.

---

## 9. Security notes

- Bucket stays **private**; the app uses the S3 API with your token.
- Logo download endpoints require authentication (`super_admin` or `admin` for own org).
- Do not expose R2 credentials in the frontend or commit `.env`.
- Rotate API tokens if a secret is leaked: create a new token, update `.env`, revoke the old token.

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Path shows `bucket/bucket/org-logos/...` | `R2_ENDPOINT` includes `/inventory-images` — use account URL only |
| Upload works, no objects in R2 | Missing or wrong `R2_*` env → local `uploads/` used |
| `Access Denied` on upload | Token lacks write permission or wrong bucket name |
| `Invalid endpoint` | `R2_ENDPOINT` typo, trailing slash, or wrong account ID |
| Logo preview empty after upload | Not logged in, wrong org, or browser blocked credentialed fetch |
| `Logo must be at least 200×80` | Image too small; use a larger source file |

---

## 11. Related code

| Area | Path |
|------|------|
| S3 / R2 client | [`src/common/storage/object-storage.service.ts`](../src/common/storage/object-storage.service.ts) |
| Logo validation & resize | [`src/common/storage/organization-logo.service.ts`](../src/common/storage/organization-logo.service.ts) |
| Super admin logo API | [`src/modules/organizations/organizations-logo.controller.ts`](../src/modules/organizations/organizations-logo.controller.ts) |
| Org admin logo API | [`src/modules/organization-branding/organization-branding.controller.ts`](../src/modules/organization-branding/organization-branding.controller.ts) |
| Env validation | [`src/config/env.validation.ts`](../src/config/env.validation.ts) |
| DB fields | [`prisma/models/organization.prisma`](../prisma/models/organization.prisma) (`logoKey`, `logoUpdatedAt`) |
