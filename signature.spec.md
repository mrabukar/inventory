# Spec: Organization Signature Upload

## 1. Goal

Invoices currently render a blank "Signature" line with nothing on it:

```
Signature
_______________
```

We want organizations to upload an image of an authorized signature (e.g. a
scanned/photographed signature, or a signature-pad export) once, in Organization
Settings, and have it appear automatically on every generated/printed invoice —
sitting on top of the signature line, where a person would otherwise sign by hand.

This is **the same pattern already implemented for the "Business stamp" feature**
(see `add-organization-stamp` branch / already-merged history). That feature is the
direct template for this one — same data model shape, same storage approach, same
upload UI, same invoice wiring. Copy it file-for-file and rename `stamp` → `signature`
unless noted otherwise below.

**Reference files to copy from (already in the codebase):**

Backend:
- `api/src/common/storage/organization-stamp.constants.ts`
- `api/src/common/storage/organization-stamp.service.ts`
- `api/src/common/storage/storage.module.ts` (registration pattern)
- `api/src/modules/organization-branding/organization-branding.controller.ts` (the `/logo` and `/stamp` routes — add `/signature` alongside them)
- `api/src/modules/invoices/invoices.service.ts` (`invoiceInclude.organization.select`)
- `api/prisma/models/organization.prisma`
- `api/prisma/migrations/20260818120000_add_organization_stamp/migration.sql`

Frontend:
- `web/service/organizations/stamp.ts`
- `web/service/upload.ts` (`organizationStampUrl` / `fetchOrganizationStampBlob`)
- `web/components/organization/organization-stamp-preview.tsx`
- `web/components/organization/organization-stamp-upload.tsx`
- `web/app/(app)/settings/organization/page.tsx` (stamp uploader wiring)
- `web/components/invoices/invoice-document.tsx` (stamp rendering)
- `web/app/(app)/invoices/[id]/page.tsx` (stamp fetch/pass-down)
- `web/types/organizations/organization.ts`, `web/types/invoices/invoice.ts`

---

## 2. Scope decision (confirm before building)

Mirroring the stamp feature means **one signature image per organization**
(an "authorized signer" stamp-like asset), not a signature per staff member/user.
This matches how the request was phrased ("same idea for the signature... upload the
signature like the stamp"). If per-user signatures (e.g. whoever processed the sale)
are wanted instead, that's a materially different design (signature would need to
live on `User`, not `Organization`, and the invoice would need to pick the signature
of `sale.soldBy`) — flag this to the product owner before starting if there's any
doubt. **Assume org-level for the rest of this spec.**

---

## 3. Data model

Add to `api/prisma/models/organization.prisma`, alongside `logoKey`/`stampKey`:

```prisma
signatureKey       String?
signatureUpdatedAt DateTime?
```

### Migration

Create `api/prisma/migrations/<timestamp>_add_organization_signature/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "organization" ADD COLUMN "signatureKey" TEXT;
ALTER TABLE "organization" ADD COLUMN "signatureUpdatedAt" TIMESTAMP(3);
```

**Important — how this database is applied (learned while building the stamp feature):**
This project's dev database (Neon Postgres) already has migration-history drift from
before this feature (unrelated to this change). Running `prisma migrate dev` will try
to **reset the entire database** — do not do that. Instead:

1. Write the migration folder/SQL by hand (as above, following the existing naming convention: `YYYYMMDDHHMMSS_description`).
2. Apply it directly: `npx prisma db execute --file <path-to-sql> --schema=./prisma`
3. Record it in migration history without touching other migrations: `npx prisma migrate resolve --applied <migration-folder-name> --schema=./prisma`
4. Regenerate the client: `npx prisma generate --schema=./prisma`
   - On Windows, if this fails with `EPERM ... rename ... query_engine-windows.dll.node`, a running `nest start --watch` process has the engine file locked. Stop that node process (find it via `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` and match the command line containing `dist\src\main`) and re-run `prisma generate`; `nest --watch` will auto-respawn it.

---

## 4. Backend

### 4.1 Constants — `organization-signature.constants.ts`

Same shape as `organization-stamp.constants.ts`. Suggested limits (signatures are
usually wide/short, unlike the roughly-square stamp):

```ts
export const ORGANIZATION_SIGNATURE_MAX_BYTES = 3 * 1024 * 1024;
export const ORGANIZATION_SIGNATURE_MAX_WIDTH = 800;
export const ORGANIZATION_SIGNATURE_MAX_HEIGHT = 300;
export const ORGANIZATION_SIGNATURE_MIN_WIDTH = 100;
export const ORGANIZATION_SIGNATURE_MIN_HEIGHT = 40;

export const ORGANIZATION_SIGNATURE_PREFIX = "org-signatures";

export function organizationSignatureObjectKey(
  organizationId: string,
  extension: "jpg" | "png",
): string {
  return `${ORGANIZATION_SIGNATURE_PREFIX}/${organizationId}/signature.${extension}`;
}
```

PNG should be preferred/recommended in the UI copy (transparent background lets the
signature sit cleanly on the printed line instead of showing a white box), but accept
both PNG and JPEG like logo/stamp do, for consistency and because not every user will
have a transparent-background scan.

### 4.2 Service — `organization-signature.service.ts`

Clone `OrganizationStampService` → `OrganizationSignatureService`:
- `assertCanManageSignature(user, organizationId)` — identical role check (super_admin, or admin of that org).
- `processUpload(file)` — same validation (size/mime/dimensions) and `sharp` resize (`fit: "inside", withoutEnlargement: true`) using the new constants.
- `uploadSignature`, `deleteSignature`, `getSignatureObject` — identical shape, writing to `organization.signatureKey` / `signatureUpdatedAt` instead of the stamp fields.
- `purgeSignatureStorage` — same purge-both-extensions approach.

Register it in `storage.module.ts` providers/exports alongside the other two.

### 4.3 Routes — `organization-branding.controller.ts`

Add, mirroring the existing `/logo` and `/stamp` blocks exactly:

```
POST   /organization/signature   (FileInterceptor("signature", ...), admin-only, current org)
DELETE /organization/signature
GET    /organization/signature   (streams image bytes, Cache-Control: private, max-age=300)
```

Inject `OrganizationSignatureService` into the controller constructor alongside
`organizationLogo` and `organizationStamp`.

### 4.4 Invoice data

Add `signatureKey: true` to the `organization.select` block in
`api/src/modules/invoices/invoices.service.ts` (`invoiceInclude`), next to `stampKey`.

### 4.5 Out of scope (unless asked)

Same call as the stamp feature: no super-admin `/organizations/:id/signature` route
(the by-org-id variant used on the super-admin org detail page) — only the
current-org route that the org's own Settings page uses. Easy to add later by
following the `organizations-logo.controller.ts` pattern if needed.

---

## 5. Frontend

### 5.1 Types

- `web/types/organizations/organization.ts` — add `signatureKey?: string | null; signatureUpdatedAt?: string | null;` to `Organization`.
- `web/types/invoices/invoice.ts` — add `signatureKey: string | null;` to `InvoiceOrganization`.

### 5.2 Upload/blob helpers — `web/service/upload.ts`

Add, mirroring `organizationStampUrl` / `fetchOrganizationStampBlob` (current-org
scope only, same reasoning as the stamp helpers — see the "Out of scope" note above):

```ts
export function organizationSignatureUrl(signatureUpdatedAt?: string | null): string { ... }
export async function fetchOrganizationSignatureBlob(signatureUpdatedAt?: string | null): Promise<string | null> { ... }
```

### 5.3 Service functions — `web/service/organizations/signature.ts`

```ts
export function uploadCurrentOrganizationSignature(file: File) { ... } // POST /api/organization/signature, form field "signature"
export function deleteCurrentOrganizationSignature() { ... }           // DELETE /api/organization/signature
```

### 5.4 Components

- `web/components/organization/organization-signature-preview.tsx` — clone `organization-stamp-preview.tsx`. Use a wider/shorter preview box than the stamp's `size-20` square (e.g. `h-16 w-40`) since signatures are landscape, not square. Use the `Signature` icon from `lucide-react` for the empty state (confirmed present in the installed version — `import { Signature } from "lucide-react"`).
- `web/components/organization/organization-signature-upload.tsx` — clone `organization-stamp-upload.tsx`. Title: "Signature". Description: "PNG or JPG, up to 3MB. A transparent PNG looks best. Shown on the signature line on invoices."

### 5.5 Settings page — `web/app/(app)/settings/organization/page.tsx`

Add a third stacked card in the same right-hand column as the logo and stamp
uploaders (`<OrganizationLogoUpload/>`, `<OrganizationStampUpload/>`,
`<OrganizationSignatureUpload/>`), same `hasX={Boolean(org.xKey)}` /
`xUpdatedAt={org.xUpdatedAt}` / invalidate-`["organization","current"]`-on-success
pattern as the stamp card added there.

### 5.6 Invoice rendering — `web/components/invoices/invoice-document.tsx`

Add a `signatureUrl: string | null` prop. Current signature block:

```tsx
<div className="mt-8 flex items-end justify-between gap-8 print:mt-5">
  <div className="flex flex-col gap-1">
    <span className="text-xs text-neutral-500">Signature</span>
    <div className="w-48 border-b border-neutral-400" />
  </div>

  {/* stamp column */}
  <div className="flex w-full max-w-50 shrink-0 justify-start">
    {stampUrl ? <img src={stampUrl} ... /> : null}
  </div>
</div>
```

The signature image should render **sitting on top of the line**, not replacing the
label or the underline (so the layout looks identical whether or not a signature is
uploaded, and the line is still there to sign on by hand if no image is set — same
"optional, no layout change when absent" rule as the stamp). Suggested change:

```tsx
<div className="flex flex-col gap-1">
  <span className="text-xs text-neutral-500">Signature</span>
  {signatureUrl ? (
    <img
      src={signatureUrl}
      alt="Signature"
      className="h-10 w-48 object-contain object-bottom"
    />
  ) : (
    <div className="h-10 w-48" /> // spacer so the line doesn't jump when no signature is set
  )}
  <div className="w-48 border-b border-neutral-400" />
</div>
```

Adjust the spacer/image height (`h-10` above is a starting guess) so the image's
baseline sits just above `border-b` line — check visually against a real uploaded
signature and tune.

### 5.7 Invoice page — `web/app/(app)/invoices/[id]/page.tsx`

Add a `signatureKey`/`signatureUrl` state pair and a `useEffect`, copied from the
existing `stampKey`/`stampUrl` effect (fetch via
`fetchOrganizationSignatureBlob(null)`, scope is always "current" — same reasoning as
logo/stamp: invoices are only ever viewed by their own organization). Pass
`signatureUrl` into `<InvoiceDocument />`.

---

## 6. Validation / limits summary

| | Max size | Max dimensions | Min dimensions | Formats |
|---|---|---|---|---|
| Signature | 3 MB | 800×300 | 100×40 | PNG (preferred), JPEG |

(Matches the stamp feature's 3MB cap and validate/resize approach — only the
width/height bounds differ, to suit a landscape signature instead of a square stamp.)

---

## 7. Testing checklist for the implementing dev

- [ ] `prisma generate` / `tsc --noEmit` clean on both `api` and `web`.
- [ ] `npx eslint <changed files>` clean (auto-fix formatting-only issues with `--fix`).
- [ ] Upload a signature in Settings → Organization; confirm preview shows immediately, "Replace"/"Remove" buttons work.
- [ ] Remove the signature; confirm the invoice reverts to a blank line with no layout shift.
- [ ] Open an invoice with a signature uploaded; confirm it renders sitting on the line, doesn't overlap or collide with the stamp image (which sits in a separate column to the right — see stamp spec/PR).
- [ ] Print/PDF export the invoice (the existing `window.print()` A5 flow in `invoices/[id]/page.tsx`) and confirm the signature image survives print CSS (`.invoice-print` visibility rules) the same way logo/stamp do.
- [ ] Multi-tenant check: organization A's signature must never be fetchable/visible from organization B's session (covered automatically if `assertCanManageSignature`/`requireOrganizationId` are copied correctly from the stamp service — don't skip this check).
- [ ] `npm run build` clean on both `api` and `web`.

---

## 8. Open questions for product/owner (not blocking, but worth a decision)

1. Per-organization signature (this spec) vs. per-user/per-signer signature — confirmed as per-organization above; revisit if that assumption is wrong.
2. Should super-admins be able to manage a signature for *any* organization (the `/organizations/:id/signature` route), like they can for logos? Currently out of scope for stamp and (by this spec) for signature too.
3. Any legal/compliance concern with a static signature image being reusable on any invoice (i.e. it's a picture, not a live e-signature) — likely fine for this business's use case (matches "stamp" being just an image too), but worth a one-line confirmation before shipping.
