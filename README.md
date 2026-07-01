# Ledger — Expense Tracker

A small, professional expense tracker built as a proof of concept.
Full-stack **Nuxt 3** with a **PostgreSQL** database via **Prisma**, styled with
**Tailwind CSS**, and written in **TypeScript**. No authentication — it's a demo.

- **Dashboard** — this month's total, month-over-month change, headline stats, a
  by-category donut + breakdown, and recent entries.
- **Expenses** — searchable, filterable, paginated ledger with full create / read /
  update / delete.

---

## 1. What you need first

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | 18+ (built on 22) | `node --version` |
| npm | 9+ | `npm --version` |
| PostgreSQL | 14+ | `psql --version` |

Node and npm you already have. **PostgreSQL is the one thing you must install** —
the app stores its data there. Pick one of the two options below.

### Option A — Install PostgreSQL natively (Windows)

Using the Windows package manager `winget` (run in PowerShell):

```powershell
winget install PostgreSQL.PostgreSQL.16
```

The installer sets up a database server that runs in the background and a
superuser named `postgres`. **Remember the password you set** — you'll put it in
`.env`. After it finishes, open a new terminal and create the database:

```powershell
# The installer adds psql here; adjust the version folder if needed.
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres expense_tracker
```

(It will prompt for the password you chose during install.)

### Option B — Run PostgreSQL in Docker (no install, throwaway)

If you have Docker Desktop, this is the fastest path:

```powershell
docker run --name ledger-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=expense_tracker -p 5432:5432 -d postgres:16
```

That starts PostgreSQL on `localhost:5432` with user `postgres`, password
`postgres`, and a ready-made `expense_tracker` database — which matches the
default `.env` below, so you can skip straight to step 3.

---

## 2. Configure the connection string

Copy the example env file and edit it to match your database:

```powershell
Copy-Item .env.example .env
```

`.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

The default is `postgresql://postgres:postgres@localhost:5432/expense_tracker?schema=public`.
Change `USER` / `PASSWORD` to whatever you set when installing PostgreSQL. If you
used **Option B (Docker)** the default already works.

---

## 3. Install, migrate, seed, run

```powershell
npm install              # install dependencies (also runs `nuxt prepare`)
npm run db:migrate       # create the tables from prisma/schema.prisma
npm run db:seed          # fill the database with sample data
npm run dev              # start the app at http://localhost:3000
```

Open **http://localhost:3000** and you should see a populated dashboard.

> First time only: `npm run db:migrate` will ask you to name the migration —
> type something like `init` and press Enter.

---

## 4. Handy scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Type-check the whole project |
| `npm run db:migrate` | Create/apply a migration from the schema |
| `npm run db:seed` | Re-seed the database with sample data |
| `npm run db:reset` | Drop everything, re-migrate, and re-seed |
| `npm run db:studio` | Open Prisma Studio (a visual DB browser) |

---

## 5. How the project is organised

Nuxt uses **convention over configuration** — files land in specific folders and
Nuxt wires them up for you. No manual route table, no manual imports.

```
├─ nuxt.config.ts          # Nuxt setup: modules, global CSS, <head>, fonts
├─ tailwind.config.ts      # design tokens (the "ledger" colours + fonts)
├─ prisma/
│  ├─ schema.prisma        # the database shape (single source of truth)
│  └─ seed.ts              # sample data, dated relative to today
├─ types/expense.ts        # TypeScript types shared by server + client
├─ server/                 # the backend (runs on the server only)
│  ├─ utils/               # auto-imported helpers: prisma client, validation…
│  └─ api/                 # each file = one API endpoint (file name = route)
│     ├─ expenses/         # GET/POST /api/expenses, and [id] GET/PUT/DELETE
│     ├─ categories/       # GET /api/categories
│     └─ stats/            # GET /api/stats (dashboard numbers)
├─ composables/            # auto-imported reusable logic (formatting, toasts…)
├─ components/             # auto-imported Vue components (<ExpenseTable/> …)
├─ layouts/default.vue     # the shared page frame (header, footer, toasts)
├─ pages/                  # each file = one route
│  ├─ index.vue            # "/"          → dashboard
│  └─ expenses/index.vue   # "/expenses"  → the ledger + CRUD
└─ app.vue                 # root component that renders the layout + page
```

**The flow of a request:** a page calls `useFetch('/api/expenses')` → Nuxt runs
the matching file in `server/api/` → that handler validates input with Zod and
talks to PostgreSQL through Prisma → the typed JSON comes back to the page.

---

## 6. Key decisions (and why)

- **Category is a table, not an enum.** A table lets you add or rename categories
  from data without a schema migration, and it carries a `color` per category so
  the chart and pills stay consistent. It also demonstrates a Prisma relation
  (one category → many expenses).
- **Money is stored as `Decimal(10,2)`, never a float.** Floating-point numbers
  can't represent money exactly (`0.1 + 0.2 !== 0.3`), which corrupts totals.
  Decimal keeps exact cents.
- **Validation lives on the server (Zod).** The browser is never trusted. The
  client does a quick check for nice UX, but the server is the real gatekeeper
  and returns per-field error messages the form displays inline.
- **No Pinia / global store.** For CRUD, the database is the source of truth. Each
  page fetches with `useFetch` and re-fetches after a change — simpler and less to
  learn than a client-side store. Add Pinia later only if shared client state
  actually appears.
- **Hard delete with confirmation.** Simple and clear for a demo. A `deletedAt`
  "soft delete" column would be the next step if you need an undo/audit trail.

---

## 7. Troubleshooting

- **`Can't reach database server at localhost:5432`** — PostgreSQL isn't running,
  or `DATABASE_URL` is wrong. Start the service (or the Docker container) and check
  the user/password in `.env`.
- **`database "expense_tracker" does not exist`** — create it (see step 1) or run
  the Docker option which makes it for you.
- **The dashboard is empty** — run `npm run db:seed`.
- **Changed the schema?** — run `npm run db:migrate` again to apply it.
