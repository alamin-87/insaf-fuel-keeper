# Insaf Gas Corp ERP — Phase 1 Frontend Scaffold

Build a frontend-only scaffold for the ERP with mocked data (in-memory), ready to swap for a real MongoDB/Express API later. Two important adaptations to your spec:

1. **Routing**: This project runs on **TanStack Start** (file-based routing under `src/routes/`), not React Router. All navigation will use TanStack `<Link>` and route files. The component tree you specified will still live under `src/components/`.
2. **Data layer**: Since the MongoDB backend is deployed separately, `services/*.ts` will call a central `api.ts` fetch wrapper pointed at `import.meta.env.VITE_API_BASE_URL`. Until that's set, services return mock data so the UI is fully clickable.

## Scope (Phase 1)

- Dashboard (Kanban-style widgets): Today's Sales, Collections, Expenses, Customer Dues, Supplier Payables, Cash/Bank, Stock Alerts
- Master Data CRUD (mocked): Customers, Suppliers, Products
- Sales workflow: Sales Orders, Quotation, Invoice view, Payment recording
- Cylinder tracking: Registry, Movement history, Location & status
- Delivery: Challan list + creation + confirm

## File plan

**Routes (`src/routes/`)** — one file per page, each with its own `head()` metadata:
- `__root.tsx` — update: add sidebar+topbar shell around `<Outlet />`, brand "Insaf Gas Corp"
- `index.tsx` — Dashboard
- `customers.tsx`, `customers.new.tsx`, `customers.$id.tsx`
- `suppliers.tsx`, `suppliers.new.tsx`, `suppliers.$id.tsx`
- `products.tsx`, `products.new.tsx`, `products.$id.tsx`
- `sales.tsx` (orders list), `sales.new.tsx`, `sales.$id.tsx` (invoice view), `sales.quotation.tsx`
- `cylinders.tsx`, `cylinders.new.tsx`, `cylinders.$id.tsx` (movement history + tracking)
- `deliveries.tsx`, `deliveries.new.tsx`

**Components (`src/components/`)** — as per your spec (layout, dashboard, master-data, sales, cylinder, delivery, common). Each route file imports its component.

**Types (`src/types/`)** — `customer.ts`, `supplier.ts`, `product.ts`, `sales.ts`, `cylinder.ts`, `delivery.ts`, `index.ts` (barrel).

**Services (`src/services/`)** — `api.ts` (fetch wrapper), plus one service per domain. Each has `list/get/create/update/remove` and cylinder adds `getMovements/addMovement`. Backed by an in-memory mock store keyed off seed data so the UI works before the backend exists.

**Hooks (`src/hooks/`)** — `useCustomer`, `useSales`, `useCylinder` built on TanStack Query (already installed).

**Utils (`src/utils/`)** — `formatters.ts` (currency, dates), `validators.ts`, `helpers.ts`.

## Design system

- Tailwind v4 tokens in `src/styles.css` — I'll retune the palette to a professional industrial theme (deep navy primary, warm amber accent) fitting a gas/industrial ERP, dark-mode ready. All colors as semantic tokens — no hardcoded classes.
- shadcn primitives already available; sidebar uses `@/components/ui/sidebar`.

## Deliverables per module

- **Layout**: collapsible sidebar with grouped nav (Dashboard, Masters, Sales, Cylinders, Deliveries), topbar with brand + user menu placeholder.
- **Dashboard**: 6–8 widget cards + a stock-alert list. Numbers from mock service.
- **Lists**: sortable table with search + "New" button; row click → detail.
- **Forms**: react-hook-form + zod validation, toast on save (`sonner`).
- **Invoice view**: printable layout with line items, totals, payment box.
- **Cylinder tracking**: registry table, per-cylinder timeline of movements (issued/returned/refilled/at customer), status badges.
- **Delivery challan**: form with driver/vehicle, line items, Confirm button (records timestamp; signature capture noted as Phase 2).

## Out of scope (Phase 2, not built now)

Auth, MongoDB backend, signature capture, real payments, reporting exports, role-based permissions.

## Technical notes

- No Lovable Cloud usage — pure frontend + mock services (matches your "backend deployed separately" note).
- `services/api.ts` reads `import.meta.env.VITE_API_BASE_URL`; if unset, services fall back to the in-memory mock. Swapping to real MongoDB later = set the env var and delete the mock branch.
- TanStack Query for all reads/mutations; loaders left minimal since data is mocked.
- All routes get distinct `head()` titles + descriptions.

Given the volume (~50 files), this will land as one large scaffold in a single implementation pass. Approve and I'll build it.