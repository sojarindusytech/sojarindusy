# Sojar Indusy

B2B storefront and back office for Sojar Indusy / Sojar Solutions, a supplier of carbide
cutting tools (end mills, drills, oscillating blades, carbide wear parts) to Indian industry.

- **Customers** register, are approved by an admin, then see prices, order, track shipments,
  request returns and submit RFQs.
- **Admins** manage the catalogue, stock, customers, orders, dispatch, returns, RFQs, quotes,
  coupons and purchase orders.
- **The manufacturer** sees purchase orders raised automatically when stock runs low.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres, Auth, Storage) ·
Tailwind CSS · shadcn/ui · Vitest

## Getting started

```bash
cp .env.example .env      # fill in the Supabase URL and keys
npm ci
npm run dev               # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests and database tests (in-process Postgres, no setup needed) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Database

Migrations live in `supabase/migrations/` and are applied by hand in the Supabase SQL editor.
Follow the runbook for each release, e.g. [`supabase/RUNBOOK_20261015.md`](supabase/RUNBOOK_20261015.md):
it lists the order, what runs before and after the app deploy, and how to roll back.

`tests/db/` applies every migration to an in-process Postgres (PGlite) and tests the access
rules and database functions, so a migration can be checked before it reaches Supabase.

## How the code is organised

| Path | Contents |
| --- | --- |
| `src/app/` | Routes: storefront, `/dashboard` (customer), `/admin`, `/manufacturer` |
| `src/actions/` | Server Actions called by pages and components |
| `src/lib/server/` | Server-only modules: database function wrappers, checkout, coupons, catalogue |
| `src/lib/` | Shared logic safe for the browser: pricing, order status rules, constants |
| `src/components/` | UI by audience: `storefront/`, `customer/`, `admin/`, `manufacturer/`, `ui/` |
| `supabase/` | Migrations, preflight checks, rollbacks, runbooks |
| `tests/` | Database tests and test helpers |

### Rules that keep it secure

1. **Every exported function in a `"use server"` file is a public HTTP endpoint.** Start each
   one with a guard from `src/lib/auth-guard.ts` (`requireAdmin`, `requireApprovedCustomer`, …).
   Internal helpers belong in `src/lib/server/`, never in `src/actions/`.
2. **`src/lib/server/*` and `src/lib/supabase/admin.ts` import `server-only`.** The service-role
   key bypasses row-level security, so importing these from a Client Component is a build error.
3. **Never trust money from the browser.** Prices are re-read from the database at checkout;
   totals, stock and coupon limits are decided inside one locked database function
   (`place_order`).
4. **Prices are for approved customers.** Storefront pages pass products through
   `src/lib/server/storefront.ts`, which strips prices and stock for other viewers before any
   data reaches the browser.
5. **An order is priced exactly like its tax invoice.** `src/lib/order-pricing.ts` uses the
   invoice maths (`src/lib/invoice.ts`): GST per line at the SKU's rate or the Sales Settings
   default, CGST + SGST or IGST by the customer's state, coupon discount spread over the lines
   it applies to (before GST). The order stores each line's discount and GST plus a
   `tax_snapshot`, and the invoice raised on delivery reuses them, so the two always match
   (the invoice then rounds its total to the rupee). Change GST rules in one place only.
