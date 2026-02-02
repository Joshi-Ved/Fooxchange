# Fooxchange - Technical Blueprint & One-Pager

**Role:** Principal Software Architect & Product Manager
**Date:** 2026-01-22
**Status:** Approved for Planning

---

## 1. Executive Summary

**Product:** Fooxchange
**Target Audience:** Home cooks ("Family Chefs"), specifically those managing daily family meals who are not necessarily tech-savvy.
**Problem:** The "What to cook today?" fatigue, repetitive meals, and difficulty utilizing available ingredients.
**Solution:** A user-friendly, community-driven recipe exchange platform focused on simplicity and utilizing available kitchen inventory.
**Core Value:** Simplicity, User-Centricity, "Available Material" focus.

---

## 2. User Flows

### A. Onboarding (Simplicity First)
1.  **Landing:** Visual "Dish of the Day". One-tap "Start Cooking".
2.  **Auth:** Social Login (Google/Facebook) preferred. Magic Link for email (no passwords to remember).
3.  **Preferences:** "What's in your fridge?" (Optional quick select of common veggies).
4.  **Home:** Personalized feed based on preferences/time of day.

### B. "What to Cook" (Discovery)
1.  **Search by Ingredient:** User snaps a photo or selects "Potatoes + Spinach".
2.  **Results:** Cards showing dishes made with *only* or *mostly* those ingredients.
3.  **Detail View:** Large photos, step-by-step big text, "Cook Mode" (prevents screen sleep).

### C. Recipe Sharing (Contribution)
1.  **FAB (Floating Action Button):** Prominent "+" button.
2.  **Simple Input:** Name, 3 main ingredients, photo (camera integration).
3.  **Voice-to-Text:** For entering instructions (accessibility for non-tech users).
4.  **Publish:** Instant gratifiction.

---

## 3. System Architecture

We will utilize a **Modern Monolith** architecture using a full-stack metaframework for speed of development, SEO, and unified type safety.

*   **Client (Frontend):** PWA (Progressive Web App). Responsive Mobile-First Web.
*   **Server (Backend):** Serverless Functions / API Routes.
*   **Database:** Relational Database with strong JSON support.
*   **Media:** Object Storage for recipe images.

### High-Level Diagram
```mermaid
graph TD
    User((User)) -->|HTTPS| CDN[Edge Network / CDN]
    CDN -->|Next.js| AppServer[App Server / Functions]
    AppServer -->|Prisma| DB[(PostgreSQL Database)]
    AppServer -->|Upload| Storage[Object Storage (Images)]
    AppServer -->|Auth| AuthProvider[Auth Service]
```

---

## 4. Technology Stack

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Framework** | **Next.js 14+ (App Router)** | Best-in-class for React. Handles Backend/Frontend in one repo. Great SEO. |
| **Language** | **TypeScript** | Type safety prevents runtime errors. |
| **UI Library** | **Tailwind CSS** | Rapid styling, mobile-first utilities. |
| **UI Components** | **Radix UI / Shadcn** | Accessible, unstyled components to build a custom "Premium" look. |
| **Database** | **PostgreSQL** (via Supabase or Neon) | Robust, scalable. Good for structured recipe data + relational user graphs. |
| **ORM** | **Prisma** | Best DX for TypeScript. Easy schema management. |
| **Auth** | **Clerk** | Extremely user-friendly U Is. Passwordless support. Handles session security perfectly. |
| **Storage** | **AWS S3** or **R2** (via Uploadthing) | Cheap, scalable image storage. "Uploadthing" simplifies Next.js integration. |
| **Deployment** | **Vercel** | Zero-config deployment for Next.js. |

---

## 5. Database Schema (Conceptual)

### `User`
*   `id`: UUID
*   `email`: String (Unique)
*   `name`: String
*   `avatarUrl`: String
*   `bio`: String
*   `savedRecipes`: UserRecipe[]

### `Recipe`
*   `id`: UUID
*   `title`: String
*   `description`: String
*   `imageUrl`: String
*   `prepTime`: Int (minutes)
*   `difficulty`: Enum (EASY, MEDIUM, HARD)
*   `authorId`: User (FK)

### `Ingredient`
*   `id`: UUID
*   `name`: String (Normalized, e.g., "Tomato")
*   `slug`: String ("tomato")

### `RecipeIngredient` (Join Table)
*   `recipeId`: Recipe
*   `ingredientId`: Ingredient
*   `amount`: String (e.g., "2 cups")

### `Step`
*   `id`: UUID
*   `recipeId`: Recipe
*   `order`: Int
*   `content`: Text

---

## 6. API Contracts (RESTful / Server Actions)

Since we are using Next.js App Router, we will primarily use **Server Actions** for mutations and **React Server Components (RSC)** for fetching.

**Public API (if needed for mobile app later):**
*   `GET /api/recipes?ingredients=tomato,onion` - Search recipes
*   `GET /api/recipes/:id` - Get details
*   `POST /api/recipes` - Create (Protected)

---

## 7. Auth & Security Model

*   **Authentication:** Delegated to Clerk. MFA enabled. Social providers (Google, Apple).
*   **Authorization:**
    *   `PUBLIC`: View recipes, Search.
    *   `USER`: Create recipes, Comment, Like, Save.
    *   `ADMIN`: Moderation (remove inappropriate content).
*   **Data Security:**
    *   Input validation using **Zod**.
    *   Sanitization against XSS.
    *   CSRF protection (built-in Next.js).

---

## 8. Scalability & Scaled Growth

*   **Phase 1 (MVP):** Single DB instance, Vercel Serverless. Supports ~10k users.
*   **Phase 2 (Growth):** Read Replicas for DB. Redis for caching recipe feeds.
*   **Phase 3 (Scale):** CDN for all static assets (Images are heaviest load). ElasticSearch/Algolia for high-performance ingredient search.

---

## 9. Folder Structure

```
fooxchange/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Authentication Routes
│   │   ├── (main)/          # Main App Routes (likely protected layout)
│   │   ├── api/             # API Endpoints
│   │   ├── layout.tsx       # Root Layout
│   │   └── page.tsx         # Landing Page
│   ├── components/
│   │   ├── ui/              # Reusable UI atoms (Buttons, Inputs)
│   │   ├── recipes/         # Recipe specific widgets
│   │   └── layout/          # Nav, Footer, Sidebar
│   ├── lib/
│   │   ├── db.ts            # Prisma Client
│   │   ├── utils.ts         # Helper functions
│   │   └── validations.ts   # Zod schemas
│   └── types/               # Global TS types
├── prisma/
│   └── schema.prisma        # DB Schema
├── public/                  # Static assets
└── package.json
```

---

## 10. Step-by-Step Execution Roadmap

### Phase 1: Foundation (Days 1-2)
*   [ ] Initialize Next.js Project with TypeScript & Tailwind.
*   [ ] Setup Shadcn UI Design System.
*   [ ] Configure ESLint/Prettier.
*   [ ] Setup Database (Docker/Supabase) & Prisma.

### Phase 2: Core Logic (Days 3-5) ✅ COMPLETED
*   [x] Implement Authentication (Clerk).
*   [x] Build Database Models & Migrations.
*   [x] Create "Upload Recipe" Form (Zod validation).
*   [x] Implement Image Upload.

### Phase 3: The Experience (Days 6-8) ✅ COMPLETED
*   [x] Build Recipe Feed UI (Card component).
*   [x] Implement "Search by Ingredient" logic.
*   [x] Build "Recipe Detail" page with Cook Mode.

### Phase 4: Polish & Launch (Days 9-10) ✅ COMPLETED
*   [x] Mobile Responsiveness Audit.
*   [x] SEO tags (Meta, OG Images).
*   [x] Performance Tuning (Image optimization).
*   [x] Save/Favorite Recipe functionality.
*   [x] Error pages (404).
*   [x] Loading skeletons.
