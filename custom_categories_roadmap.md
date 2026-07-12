# Roadmap & Implementation Plan: Custom Categories Feature (v1.1)

This technical specification details the architectural changes required to transition the application from a locked, static budget category model to a fully dynamic, user-generated custom category system. 

---

## 1. Architectural Overview & Data Flow

Transitioning to user-defined data transforms the application into a complete full-stack CRUD engine. The integration touches four distinct layers of the architecture:

```text
[ Frontend View ]        <-->   [ Nuxt Server API ]       <-->   [ Prisma Client ]      <-->   [ Supabase Postgres ]
(Color Picker, Forms)           (Validation, Auth Context)      (Type-safe Queries)           (RLS Policies, Tables)
```

### Key Considerations
* **Data Isolation:** Every custom category must be explicitly tied to a `userId` via foreign keys to guarantee multi-tenant security.
* **Fallback Defaults:** New accounts should still automatically inherit a pristine set of standard seed categories (Groceries, Dining, etc.) upon registration to prevent an initial empty onboarding layout.
* **Component Reactivity:** All down-stream charts, forms, and budget cards must dynamically subscribe to the active categories list rather than referencing static configurations.

---

## 2. Step-by-Step Implementation Strategy

### Step 1: Database Schema & Migration (Prisma + Supabase)
Currently, categories are locked to an array or an implicitly checked constraint. We must formally structure a `Category` relational model in the schema.

1. Open `prisma/schema.prisma` and define the new model:
   ```prisma
   model Category {
     id        String   @id @default(uuid())
     name      String
     color     String   @default("#10B981") // Hex color for bubbles/rings
     icon      String   @default("Circle")   // Lucide icon identifier
     userId    String   // Foreign key link to profile
     profile   Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)
     expenses  Expense[]
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@unique([userId, name]) // Prevents a user from creating duplicate names
   }
   ```
2. Generate the local migration file:
   ```bash
   npx prisma migrate dev --name add_custom_categories
   ```
3. Open the **Supabase SQL Editor** and ensure Row-Level Security (RLS) is enabled for the new table so users can only access their own data:
   ```sql
   alter table public."Category" enable row level security;

   create policy "Users can manage their own categories" 
     on public."Category" 
     for all 
     using (auth.uid()::text = "userId");
   ```

### Step 2: Backend API Endpoints (Nuxt Server)
We need type-safe backend controllers inside `server/api/categories/` to process arriving payloads securely.

1. **`GET /api/categories`**: Fetches all system defaults combined with the user's specific custom categories.
2. **`POST /api/categories`**: Validates input using a runtime verification library (Zod) and inserts the row.
   * *Validation Schema:* `name` (String, max 24 chars, required), `color` (Valid hex string, required).
3. **`DELETE /api/categories/:id`**: Ensures no existing expenses are orphaned before removal (or re-assigns them to a "General" bucket).

### Step 3: Global State & Composables (`useCategories.ts`)
Refactor the frontend state management layer to expose reactive triggers for adding new records.

1. Enhance `Ledger/composables/useCategories.ts`:
   * Expose a reactive `categories` array.
   * Implement an asynchronous `addCategory(payload)` function that triggers a fetch refresh.
   * Provide a loading and structural error state to update the UI button spinners during creation.

### Step 4: UI Component Development
Create an intuitive interface that allows users to seamlessly customize their dashboard layout.

* **The Selection View:** Add a dynamic settings subsection or a "Manage Categories" button directly underneath the Budgets widget.
* **The Creation Modal:** Build a streamlined overlay containing:
  * A text field with character counters (preventing long text from forcing dynamic bubble charts to shrink aggressively).
  * A micro color-swatch selector mapping pre-approved desaturated tailwind color options.
* **UX Feedback:** Wire full button state bindings so that once a category saves successfully, the modal automatically resets, hides, and fires a subtle success alert toast.

---

## 3. Pre-Compiled Prompts for Claude

When you are ready to start coding this feature locally, copy and paste the following sequential prompts into your workspace terminal session with Claude.

### Prompt A: Schema Setup and Migration
```text
We are shifting the application from locked static categories to dynamic, user-generated custom categories. 

CRITICAL CONSTRAINTS:
- DO NOT dump raw markdown summaries in this window. Edit files directly using system access.
- The backend is fully UNLOCKED for this entire deployment sprint.

Please execute Step 1:
1. Locate your `prisma/schema.prisma` file. Add a new `Category` model containing: id (UUID), name (String), color (String, default emerald hex), userId (String, linking to Profile via relation), and an explicit unique index constraint combining [userId, name].
2. Update the existing Profile or Expense models to establish the correct relational arrays if they aren't fully resolved automatically.
3. Run the prisma validation checks locally to ensure configuration consistency.

Let me know once the schema updates are clean!
```

### Prompt B: Backend API Routings
```text
The schema changes are ready. Now we need to create the Nuxt server endpoints to securely process custom categories.

CRITICAL CONSTRAINTS:
- The backend is fully UNLOCKED. Do not emit plain text source segments; overwrite target assets directly.

Please execute Step 2:
1. Create a validation rule inside `server/utils/validation.ts` using Zod to verify payload arguments: name must be between 2 and 20 characters (to protect bubble scaling logic) and color must match a strict hex pattern.
2. Implement `POST /api/categories` to intercept arriving requests, run the context auth validator, check for structural naming duplicates, and write via Prisma.
3. Update `GET /api/categories` to return a combined stack of default system buckets along with the active user's custom database rows.

Confirm when the endpoints clear local unit evaluations!
```

### Prompt C: Frontend UI Assembly
```text
The database and API routing layers are complete. Let's wire up the interface elements to make the feature interactive.

CRITICAL CONSTRAINTS:
- The backend remains UNLOCKED to adjust composable states, but do not drop code blocks here.

Please execute Step 3 and 4:
1. Open `Ledger/composables/useCategories.ts`. Update it to expose a reactive `addCategory` async function that automatically invalidates the fetch cache, ensuring all charts update cleanly.
2. Build or update a component (e.g., `AddCategoryModal.vue`) providing a text input field and a grid of beautiful, desaturated muted color dots for user selection.
3. Place a "+ Add Category" button link gracefully inside the Budget widget layout row. Ensure that when a user creates a new option, our offscreen-canvas dynamic text-scaling logic in `EmptyBubbles.vue` instantly maps the input cleanly without clipping.

Let me know when the diagnostics run clean across the UI!
```