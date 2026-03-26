# 🍳 Fooxchange — AI-Powered Food Exchange Platform

> **Production-grade** Next.js 16 application for community recipe sharing, powered by
> client-side TensorFlow.js (Edge AI), semantic vector search, and local Transformers embeddings.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)
![PWA](https://img.shields.io/badge/PWA-Ready-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-70%25%2B-success)

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Testing](#testing)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Key Design Decisions](#key-design-decisions)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│               Next.js App Router (v16)               │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  /app/   │  │/components│  │  /app/api/**       │ │
│  │  Pages   │  │  (UI)    │  │  Route Handlers     │ │
│  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘ │
│       │              │                  │            │
│  ┌────▼──────────────▼──────────────────▼──────────┐ │
│  │                 lib/                             │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌───────┐  │ │
│  │  │ lib/ai │  │ lib/db │  │lib/utils│  │lib/   │  │ │
│  │  │(AI logic│  │  (repos)│  │(logger) │  │security│ │
│  │  │singleton│  │ client) │  │ errors) │  │       │  │ │
│  │  └────────┘  └────────┘  └────────┘  └───────┘  │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Layer responsibilities:**

| Layer | Responsibility |
|---|---|
| `app/` | Pages, layouts, Next.js route handlers |
| `components/` | Pure UI components — no AI or DB logic |
| `lib/ai/` | All AI: model singleton, embeddings, recommendations |
| `lib/db/` | Prisma client singleton + typed repositories |
| `lib/utils/` | Logger, error-handling helpers |
| `lib/security/` | Model integrity, vector validation, secure storage |
| `lib/middleware/` | Rate limiting, request-id injection |
| `lib/validations/` | Zod schemas for all API inputs |

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 5 |
| Auth | Clerk |
| Styling | Tailwind CSS 4 |
| Object Detection | TensorFlow.js + COCO-SSD (client-side) |
| Semantic Search | @xenova/transformers (local, no paid API required) |
| File Uploads | UploadThing |
| Toast Notifications | Sonner |
| Testing | Jest 30 + Testing Library |
| Formatting | Prettier 3 |
| Linting | ESLint 9 + eslint-config-next |

---

## Folder Structure

```
fooxchange/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   ├── analyze/route.ts      # Recipe AI analysis
│   │   │   ├── recommend/route.ts    # Personalised recommendations
│   │   │   ├── search/route.ts       # Semantic recipe search
│   │   │   ├── trending/route.ts     # Trending recipes
│   │   │   └── personalized/route.ts
│   │   ├── __tests__/               # API route integration tests
│   │   └── health/route.ts
│   ├── error.tsx                    # Route-level error boundary
│   ├── global-error.tsx             # Root error boundary
│   └── layout.tsx
├── components/
│   ├── camera-scanner.tsx           # TF.js COCO-SSD ingredient scanner
│   ├── ui/
│   │   ├── error-boundary.tsx       # React error boundary class
│   │   └── toaster.tsx              # Sonner toast provider
│   └── ...
├── lib/
│   ├── ai/                          ← NEW: clean AI layer
│   │   ├── singleton.ts             # Lazy model loading (one instance)
│   │   ├── embeddings.ts            # Local Transformers embeddings
│   │   ├── recommendations.ts       # Scoring, nutrition, difficulty
│   │   ├── index.ts                 # Barrel export
│   │   └── __tests__/              # AI unit tests
│   ├── db/                          ← NEW: repository layer
│   │   ├── client.ts                # Prisma singleton + slow-query logging
│   │   ├── repositories/
│   │   │   ├── recipe.repository.ts
│   │   │   └── user.repository.ts
│   │   └── index.ts                 # Barrel export
│   ├── utils/
│   │   ├── logger.ts                ← NEW: structured JSON logger
│   │   └── error-handling.ts
│   ├── middleware/
│   │   └── rate-limit.ts
│   ├── security/
│   │   ├── model-integrity.ts
│   │   ├── vector-validation.ts
│   │   └── secure-storage.ts
│   └── validations/
│       └── api-validations.ts       # All Zod schemas
└── prisma/
    └── schema.prisma                # Soft-delete + composite indexes
```

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd fooxchange
npm install

# 2. Set up environment variables (see below)
cp .env.example .env.local

# 3. Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# 4. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# UploadThing (file uploads)
UPLOADTHING_APP_ID="..."
UPLOADTHING_SECRET="..."

# OpenAI (optional — only needed if you add an OpenAI provider path)
# Local Transformers embeddings work without this key.
OPENAI_API_KEY="sk-..."

# CORS (comma-separated allowed origins)
ALLOWED_ORIGINS="http://localhost:3000"
```

---

## Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

The schema includes:

- **Soft delete** on `User` and `Recipe` (via `deletedAt` field)
- **Composite indexes** on `(authorId, deletedAt)` and `(createdAt, deletedAt)` for efficient feed queries
- **Vector embeddings** stored as JSON text (upgradeable to `pgvector`)

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report (enforces ≥ 70 % across lines/functions/branches)
npm run test:coverage
```

**Test locations:**

| Suite | Path |
|---|---|
| Embedding unit tests | `lib/ai/__tests__/embeddings.test.ts` |
| Recommendation unit tests | `lib/ai/__tests__/recommendations.test.ts` |
| API integration tests | `app/api/__tests__/analyze-route.test.ts` |
| ML Service tests | `lib/services/__tests__/ml-service.test.ts` |

---

## Production Deployment Checklist

### Before deploying

- [ ] All environment variables set in hosting dashboard (never commit secrets)
- [ ] `OPENAI_API_KEY` configured only if you explicitly enable an OpenAI embedding provider
- [ ] `DATABASE_URL` pointing to production PostgreSQL (connection-pooled)
- [ ] Run `npm run type-check` — zero TS errors
- [ ] Run `npm run lint` — zero ESLint errors
- [ ] Run `npm run test:coverage` — coverage ≥ 70 %
- [ ] Run `npm run format:check` — code is formatted

### Database

- [ ] Run `prisma migrate deploy` (not `db push`) in production
- [ ] Enable connection pooling (PgBouncer / Neon pooler)
- [ ] Set up automated daily backups

### Security

- [ ] Rate limiting configured per route (see `lib/middleware/rate-limit.ts`)
- [ ] CORS origins restricted (`ALLOWED_ORIGINS`)
- [ ] Clerk webhook secret validated for user sync
- [ ] All AI routes require authentication (`auth()` check)
- [ ] User input sanitised via Zod before reaching DB

### Performance

- [ ] `next build` output reviewed — no unexpected large bundles
- [ ] TensorFlow.js loaded via dynamic import (code-split from main bundle)
- [ ] Images served through Next.js `<Image />` with proper `sizes`
- [ ] Prisma connection pooling verified (singleton pattern in `lib/db/client.ts`)

### Observability

- [ ] Structured logs routed to your logging stack (Datadog / Logtail / ELK)
- [ ] `ai-error` log level filtered to a dedicated channel / alert
- [ ] Error tracking (Sentry or similar) wired to `app/error.tsx`
- [ ] Database slow-query logging enabled (`> 200 ms` threshold)

---

## Key Design Decisions

---

## Local Embedding Setup & Troubleshooting

Embeddings run locally by default via Transformers.js and the MiniLM model in [lib/services/embedding-service.ts](lib/services/embedding-service.ts).

### Backfill command

```bash
npm run db:seed:curation
```

This now works without `OPENAI_API_KEY`.

### If local embeddings seem slow on first run

- First run downloads model files once and caches them.
- Subsequent runs are much faster.

### If embedding generation fails

- Ensure dependencies are installed: `npm install`
- Confirm Node version is compatible with the project (`>=20`)
- Re-run: `npm run type-check`
- Re-run backfill: `npx tsx scripts/backfill-embeddings.ts`

The embedding service includes a deterministic hash fallback, so failures should not crash the overall app flow.

### Why a model singleton? (`lib/ai/singleton.ts`)

COCO-SSD is ~30 MB. Without a singleton, switching pages could trigger multiple
downloads. The module-level `_modelPromise` ensures the model loads exactly once
per browser session, with progress events for UX feedback.

### Why the repository pattern? (`lib/db/repositories/`)

Keeps Prisma query logic out of route handlers and components, making it trivial
to swap query implementations in tests and reducing duplication.

### Why soft delete?

Permanent deletes are irreversible. With `deletedAt`, we can recover accidentally
deleted content and maintain referential integrity for analytics data.

### Why structured logging? (`lib/utils/logger.ts`)

JSON log lines are machine-parseable by any log aggregator (Datadog,
Logtail, ELK, etc.). The separate `ai-error` level lets you create targeted alerts when
AI calls fail, independently from general application errors.

### TensorFlow on the client, not the server

Running COCO-SSD client-side (WebGL backend) is ~10× faster than server inference
for real-time camera scanning, keeps costs at $0, and means image data never
leaves the user's device.


## 🚀 **Quick Start - Test on Your Phone NOW!**

### **Run on Local Network (Test on Your Phone via WiFi):**

```bash
# 1. Start the dev server with network access
npm run dev -- -H 0.0.0.0

# 2. Find your local IP (Windows)
ipconfig

# 3. On your phone (connected to SAME WiFi):
#    Open browser → http://<YOUR_LOCAL_IP>:3000

# 4. Test the PWA:
#    - Camera scanning (requires HTTPS in production)
#    - Recipe browsing
#    - Offline support (after first load)

# Note: Camera WON'T work on HTTP (local network)
# For camera testing, use HTTPS (deploy to Vercel or use ngrok)
```

### **Test with HTTPS (For Camera Access):**

```bash
# Install ngrok (one-time)
npm install -g ngrok

# Start your app
npm run dev

# In another terminal, create HTTPS tunnel
ngrok http 3000

# Use the HTTPS URL on your phone (camera will work!)
# Example: https://abc123.ngrok.io
```

---

## ✨ Features

### 🤖 Edge AI-Powered (Zero Cost!)
- 📸 **Computer Vision** - Scan ingredients with camera (TensorFlow.js - runs in browser)
- 🔍 **Semantic Search** - Find recipes by meaning using Transformers.js
- 🧠 **Smart Recommendations** - ML-based suggestions
- 📊 **Recipe Analysis** - Difficulty prediction, nutrition estimation
- 🔒 **Privacy-First** - All AI processing happens on YOUR device
- 💰 **Zero API Costs** - No Gemini/OpenAI fees

### 📱 Progressive Web App
- ✅ **Installable** - Add to home screen on ANY smartphone
- 🌐 **Works Offline** - Service Worker caches content
- ⚡ **Fast** - Edge AI + PWA optimizations
- 📱 **Native Feel** - Full-screen, no URL bar

### Core Functionality
- 🔍 **Ingredient Search** - Find recipes by available ingredients
- 📖 **Recipe Management** - Create, view, browse recipes
- 👨‍🍳 **Cook Mode** - Step-by-step cooking
- ❤️ **Favorites** - Save recipes
- 🔐 **Authentication** - Clerk-powered auth
- 📸 **Image Upload** - Uploadthing CDN

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1.6** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **Shadcn UI**
- **Zod 4** - Validation

### Backend
- **PostgreSQL** (Neon) + **Prisma 5.22.0**
- **Clerk** (Auth) + **Uploadthing** (CDN)

### Edge AI Stack (Client-Side)
- **TensorFlow.js** - Computer vision (COCO-SSD model, 5MB)
- **Transformers.js** - Semantic embeddings (MiniLM-L6-v2, 20MB)
- **Web Workers** - Background AI processing
- **IndexedDB** - Model caching + encrypted storage
- **Service Worker** - Offline support

---

## 📱 Local Network Testing

### **Step 1: Start Dev Server**

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/fooxchange.git
cd fooxchange
npm install

# Set up environment (create .env.local)
cp .env.local.example .env.local
# Add your Clerk, Database, and Uploadthing keys

# Run database setup
npx prisma generate
npx prisma db push

# Start server on local network
npm run dev -- -H 0.0.0.0
```

### **Step 2: Find Your Local IP**

**Windows:**
```bash
ipconfig | grep "IPv4"
# Example: 192.168.0.176
```

**Mac/Linux:**
```bash
ifconfig | grep "inet "
# or
hostname -I
```

### **Step 3: Access from Phone**

1. **Connect phone to SAME WiFi** as your computer
2. **Open browser** on phone
3. **Visit**: `http://YOUR_LOCAL_IP:3000`
   - Example: `http://192.168.0.176:3000`

### **Step 4: Test Features**

✅ **Will Work on HTTP (local network):**
- Recipe browsing
- Search
- Authentication
- Creating recipes
- Saving recipes
- PWA installation
- Offline mode

❌ **Won't Work on HTTP:**
- Camera scanning (requires HTTPS)

### **For Camera Testing (Requires HTTPS):**

**Option A: Using ngrok (Easiest)**
```bash
# Terminal 1: Run app
npm run dev

# Terminal 2: Create HTTPS tunnel
ngrok http 3000

# Output: https://abc123.ngrok.io
# Use this URL on your phone - camera will work!
```

**Option B: Deploy to Vercel (Production)**
```bash
vercel --prod
# Get: https://fooxchange.vercel.app
# Camera works + Always online!
```

---

## 🌐 Deploy to Production (Always Online)

### **Vercel Deployment (FREE)**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Add environment variables in Vercel Dashboard
# 5. Your app is live at: https://fooxchange.vercel.app
```

**See `ALL SETUP/DEPLOYMENT.md` for detailed deployment guide.**

---

## 📁 Project Structure

```
fooxchange/
├── ALL SETUP/              # 📚 Complete documentation
│   ├── DEPLOYMENT.md       # How to deploy + mobile access
│   ├── AI-ARCHITECTURE.md  # How AI works (technical deep dive)
│   └── PLAN3.md           # Edge AI implementation plan
├── app/                    # Next.js App Router
│   ├── api/ai/            # AI API endpoints
│   └── layout.tsx         # PWA configuration
├── components/
│   ├── camera-scanner.tsx # Edge Vision UI
│   └── pwa/               # PWA components
├── lib/
│   ├── hooks/
│   │   ├── use-edge-vision.ts  # TensorFlow.js hook
│   │   └── use-edge-search.ts  # Transformers.js hook
│   ├── services/          # AI services
│   ├── security/          # Security utilities
│   └── middleware/        # Rate limiting, request tracking
├── public/
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service Worker
│   └── icons/             # PWA icons
└── prisma/                # Database schema
```

---

## 🤖 How the AI Works

### **Edge Vision (Ingredient Detection)**

```
Phone Camera → Capture Frame → TensorFlow.js (IN BROWSER)
                ↓
         COCO-SSD Model (5MB, cached)
                ↓
    Detects: banana (92%), apple (87%)
                ↓
           Cost: $0 forever
```

### **Edge Search (Semantic Search)**

```
User types: "spicy comfort food"
        ↓
Transformers.js converts to 384 numbers (IN BROWSER)
        ↓
Send only numbers to server (not text - privacy!)
        ↓
Find similar recipes by meaning
        ↓
    Cost: $0 forever
```

**See `ALL SETUP/AI-ARCHITECTURE.md` for complete technical explanation.**

---

## 🔐 Security Features

- ✅ CSP headers (Content Security Policy)
- ✅ CORS strict origins
- ✅ Rate limiting with IP validation
- ✅ Vector injection prevention
- ✅ Model integrity verification (SHA-256)
- ✅ IndexedDB encryption (libsodium.js)
- ✅ Request ID tracking
- ✅ Input validation (Zod)
- ✅ HTTPS enforced in production
- ✅ Next.js 16.1.6 (security patches)

---

## 📊 Cost Comparison

| Feature | Cloud AI | Edge AI (Fooxchange) | Savings |
|---------|----------|---------------------|---------|
| **Vision** | $500-2,000/mo | $0 | 100% |
| **Search** | $200-1,000/mo | $0 | 100% |
| **Hosting** | $20-50/mo | $0 (free tier) | $0-50 |
| **Total** | $720-3,050/mo | $0-20/mo | **$700-3,030/mo** |

**For 10,000 users:** Cloud AI = $5,000+/month | Edge AI = $50/month

---

## 🚨 Troubleshooting Local Testing

### Camera not working?
- **Cause**: HTTP doesn't allow camera access
- **Fix**: Use ngrok for HTTPS or deploy to Vercel

### Phone can't connect?
- **Cause**: Different WiFi or firewall blocking
- **Fix**: Ensure same network, disable firewall temporarily

### Service Worker not installing?
- **Cause**: Development mode
- **Fix**: Build production (`npm run build && npm start`)

### App not installing on iPhone?
- **Cause**: HTTP (needs HTTPS)
- **Fix**: Use Vercel deployment or ngrok

---

## 🎯 Next Steps

1. ✅ **Test locally**: `npm run dev -- -H 0.0.0.0`
2. ✅ **Test on phone**: Visit `http://YOUR_IP:3000`
3. ✅ **Test camera**: Use `ngrok http 3000` for HTTPS
4. ✅ **Deploy**: `vercel --prod`
5. ✅ **Share**: Your app is now worldwide!

---

## 📚 Documentation

- **`ALL SETUP/DEPLOYMENT.md`** - Complete deployment guide
- **`ALL SETUP/AI-ARCHITECTURE.md`** - How the AI works
- **`ALL SETUP/PLAN3.md`** - Edge AI implementation roadmap

---

## 💡 Why Fooxchange is Different

- 🆓 **Zero AI costs** (TensorFlow.js + Transformers.js)
- 🔒 **Privacy-first** (data never leaves device)
- 📱 **True PWA** (installable on any phone)
- 🌐 **Works offline** (Service Worker caching)
- ⚡ **10x faster** (no API latency)
- 🌍 **Accessible worldwide** (just share URL)

---

## 📄 License

MIT License

---

**Made with ❤️ and 🤖 Edge AI for home cooks everywhere** 🍳

**Your Local IP**: `192.168.0.176` - Visit `http://192.168.0.176:3000` from your phone!
