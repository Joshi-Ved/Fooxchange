# Fooxchange - Phase 2 Setup Guide

## 🎯 Phase 2: Core Logic - COMPLETED

This phase implements the core authentication, database operations, and recipe creation functionality.

---

## ✅ What's Been Implemented

### 1. Authentication (Clerk)
- ✅ Clerk middleware for route protection
- ✅ ClerkProvider wrapper in root layout
- ✅ Sign-in and Sign-up pages
- ✅ User synchronization with database
- ✅ Protected routes configuration

### 2. Database Integration
- ✅ Prisma client singleton
- ✅ Production-ready connection pooling
- ✅ User model synced with Clerk
- ✅ Complete recipe schema with relations

### 3. Recipe Creation System
- ✅ Zod validation schemas
- ✅ Server actions for CRUD operations
- ✅ Transaction-based recipe creation
- ✅ Ingredient normalization and linking
- ✅ Dynamic steps and ingredients management

### 4. Image Upload
- ✅ Uploadthing integration
- ✅ Recipe image uploader (4MB max)
- ✅ Step image uploader (2MB max)
- ✅ Authentication middleware for uploads
- ✅ Client-side upload components

### 5. UI Components
- ✅ CreateRecipeForm with dynamic fields
- ✅ Textarea component
- ✅ File upload integration
- ✅ Form validation and error handling

---

## 🔧 Setup Instructions

### Step 1: Install Dependencies

All required dependencies are already installed:
- `@clerk/nextjs` - Authentication
- `uploadthing` & `@uploadthing/react` - Image uploads
- `zod` - Validation
- `@prisma/client` - Database ORM

### Step 2: Configure Environment Variables

You need to set up three services:

#### A. Database (PostgreSQL)

**Option 1: Local PostgreSQL with Docker**
```powershell
# Run PostgreSQL in Docker
docker run --name fooxchange-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fooxchange -p 5432:5432 -d postgres

# Your .env DATABASE_URL is already configured for this
```

**Option 2: Supabase (Recommended for Production)**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database → Connection String
4. Copy the "Connection Pooling" URL
5. Update `DATABASE_URL` in `.env`

**Option 3: Neon**
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update `DATABASE_URL` in `.env`

#### B. Clerk Authentication

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Choose your authentication providers (Google, Email, etc.)
4. Go to API Keys
5. Copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
6. Update these values in `.env`

**Important Clerk Settings:**
- Set Sign-in URL to: `/sign-in`
- Set Sign-up URL to: `/sign-up`
- Set After sign-in URL to: `/`
- Set After sign-up URL to: `/`

#### C. Uploadthing (Image Uploads)

1. Go to [uploadthing.com](https://uploadthing.com)
2. Sign in with GitHub
3. Create a new app
4. Copy:
   - `UPLOADTHING_SECRET`
   - `UPLOADTHING_APP_ID`
5. Update these values in `.env`

### Step 3: Run Database Migrations

```powershell
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma db push

# (Optional) Open Prisma Studio to view your database
npx prisma studio
```

### Step 4: Start Development Server

```powershell
npm run dev
```

Visit `http://localhost:3000`

---

## 📁 Key Files Created

```
fooxchange/
├── middleware.ts                              # Clerk route protection
├── app/
│   ├── layout.tsx                            # Updated with ClerkProvider
│   ├── sign-in/[[...sign-in]]/page.tsx      # Sign-in page
│   ├── sign-up/[[...sign-up]]/page.tsx      # Sign-up page
│   ├── recipes/create/page.tsx               # Create recipe page
│   └── api/uploadthing/
│       ├── core.ts                           # Upload configuration
│       └── route.ts                          # Upload API routes
├── components/
│   ├── recipes/create-recipe-form.tsx        # Recipe creation form
│   └── ui/textarea.tsx                       # New UI component
├── lib/
│   ├── db.ts                                # Prisma client (already existed)
│   ├── uploadthing.ts                       # Upload helpers
│   ├── validations.ts                       # Zod schemas
│   └── actions/recipe-actions.ts            # Server actions
└── .env.example                              # Environment template
```

---

## 🧪 Testing Phase 2

### Test Authentication
1. Navigate to `/sign-up`
2. Create an account (use test mode in Clerk)
3. Sign in at `/sign-in`
4. Verify you're redirected to home page

### Test Recipe Creation
1. While signed in, navigate to `/recipes/create`
2. Fill out the form:
   - Add a title and description
   - Upload a recipe image
   - Add at least one ingredient
   - Add at least one cooking step
3. Submit the form
4. Verify redirect to recipe page

### Verify Database
```powershell
npx prisma studio
```
Check that:
- User record was created (synced from Clerk)
- Recipe was created
- Ingredients were normalized
- Steps were linked correctly

---

## 🐛 Common Issues

### Issue: Prisma Client not generated
**Solution:**
```powershell
npx prisma generate
```

### Issue: Database connection failed
**Solution:**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running (if using Docker: `docker ps`)
- Test connection: `npx prisma db push`

### Issue: Clerk authentication not working
**Solution:**
- Verify both Clerk keys are in `.env`
- Check Clerk dashboard URLs match `/sign-in` and `/sign-up`
- Restart dev server after adding env vars

### Issue: Image upload failing
**Solution:**
- Verify Uploadthing keys in `.env`
- Check Uploadthing dashboard for errors
- Ensure route `/api/uploadthing` is accessible

---

## 🎯 Next Steps: Phase 3

Phase 2 is complete! Ready to move to **Phase 3: The Experience**:
- [ ] Build Recipe Feed UI (Card component)
- [ ] Implement "Search by Ingredient" logic
- [ ] Build "Recipe Detail" page with Cook Mode
- [ ] Add recipe browsing and discovery features

---

## 📝 Notes

- All authentication is handled by Clerk (no password management needed)
- Images are stored on Uploadthing's CDN (not in your database)
- Ingredients are automatically normalized (e.g., "tomato" and "Tomato" are the same)
- Recipe creation uses database transactions for data integrity
- Server Actions provide type-safe API with automatic validation

