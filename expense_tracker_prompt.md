# Expense Tracker — Nuxt.js Proof of Concept Prompt

> Copy-paste the prompt below into a new Antigravity conversation.

---

```
Build me a full-stack Expense Tracker application as a proof-of-concept project. I am a beginner with this tech stack, so please guide me step-by-step and explain every major decision you make.

## Tech Stack (Required)

- **Framework**: Nuxt 3 (latest stable)
- **Language**: TypeScript (strict mode)
- **Frontend**: Vue 3 (Composition API with `<script setup>`)
- **Styling**: Tailwind CSS (latest stable, confirm version before installing)
- **ORM / Migrations**: Prisma
- **Database**: PostgreSQL (local instance — guide me on setup if needed)
- **Runtime**: Node.js

## Project Scope — Basic CRUD Only

This is a proof-of-concept for my supervisor. Keep it simple but professional-looking. Implement only these features:

### Core Features
1. **Dashboard** — Summary view showing total expenses, recent transactions, and a simple chart/visual breakdown by category
2. **Create Expense** — Form to add a new expense (amount, category, description, date)
3. **Read/List Expenses** — Paginated table or card list of all expenses with search and filter by category/date
4. **Update Expense** — Edit an existing expense
5. **Delete Expense** — Soft delete or hard delete with confirmation dialog

### Data Model (Prisma Schema)
- `Expense` table with fields: id, title/description, amount, category, date, createdAt, updatedAt
- `Category` — can be an enum or a separate table (your recommendation, explain why)
- Seed file with sample data so I can see the app working immediately

### API Routes
- Use Nuxt 3 server routes (`/server/api/`) for the backend
- RESTful endpoints: GET, POST, PUT/PATCH, DELETE for expenses
- Basic input validation on the server side

## Important Guidelines

1. **Beginner-Friendly**: I have minimal experience with Nuxt, TypeScript, Prisma, and Tailwind. Explain WHY you're doing things, not just what. Add helpful comments in the code.
2. **Step-by-Step Setup**: Walk me through project initialization, installing dependencies, configuring Prisma with PostgreSQL, running migrations, and seeding the database.
3. **File Structure**: Explain the Nuxt 3 directory conventions (pages/, components/, server/, composables/, etc.) as you create files.
4. **Error Handling**: Include proper error handling on both client and server side with user-friendly error messages.
5. **Responsive Design**: The UI should look good on both desktop and mobile using Tailwind.
6. **No Authentication**: Skip auth for now — this is just a proof of concept.

## What I Do NOT Need Right Now
- Authentication / Authorization
- AI model integration (my supervisor mentioned it but I want to nail the basics first — we can add it later)
- Deployment configuration
- Testing (nice to have but not priority)
- Complex state management (Pinia only if truly needed, explain why)

## Environment Notes
- OS: Windows
- Working directory: c:\Users\abcde\OneDrive\Desktop\Intern\ExpenseTracker
- I need help with PostgreSQL connection string setup (.env file)
- If any global CLI tools need installing (like Prisma CLI), tell me explicitly

Please create a detailed implementation plan first, then build it step by step. After each major step, verify the app still runs.
```

---

## Tips for Using This Prompt

| Tip | Details |
|-----|---------|
| **PostgreSQL first** | Make sure PostgreSQL is installed and running before you start. If not, ask Antigravity to help you set it up. |
| **One step at a time** | If the output feels overwhelming, tell it: *"Pause. Let me catch up. Explain what we just did."* |
| **Adding AI later** | Once CRUD works, you can follow up with: *"Now add a simple AI-powered feature — suggest expense categories using an LLM based on the description field."* |
| **Ask questions** | Don't hesitate to say *"Why did you use X instead of Y?"* — that's the fastest way to learn. |
