# 🍳 Fooxchange

A modern, **AI-powered** recipe sharing platform built with Next.js 14+. Discover recipes using computer vision, semantic search, and intelligent recommendations.

![Next.js](https://img.shields.io/badge/Next.js-16.1.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)
![AI-Powered](https://img.shields.io/badge/AI-Powered-brightgreen)

## ✨ Features

### 🤖 AI-Powered Features (New!)
- 📸 **Computer Vision** - Scan ingredients with your camera using Google Gemini
- 🔍 **Semantic Search** - Find recipes by "vibe" (e.g., "comfort food")
- 🧠 **Intelligent Recommendations** - Context-aware suggestions based on ingredients, time, and preferences
- 📊 **Recipe Analysis** - ML-based difficulty prediction, nutrition estimation, and cooking tips
- 📈 **Trending Recipes** - Velocity-based trending algorithm
- 👤 **Personalized Feed** - Learn your taste and recommend recipes you'll love

### Core Functionality
- 🔍 **Ingredient-Based Search** - Find recipes by available ingredients
- 📖 **Recipe Management** - Create, view, and browse recipes
- 👨‍🍳 **Cook Mode** - Full-screen step-by-step cooking experience
- ❤️ **Save/Favorite Recipes** - Bookmark your favorite recipes
- 🔐 **Authentication** - Secure user authentication with Clerk
- 📸 **Image Upload** - Upload recipe photos via Uploadthing CDN

### User Experience
- 📱 **Mobile Responsive** - Works seamlessly on all devices
- ⚡ **Optimistic UI** - Instant feedback for user actions
- 🎨 **Modern Design** - Beautiful UI with Tailwind CSS
- 🔄 **Loading States** - Skeleton screens for better UX
- 🚫 **Custom 404 Page** - Branded error handling
- 🌐 **SEO Optimized** - Dynamic metadata and Open Graph tags

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1.4** (App Router) + **TypeScript 5** + **React 19**
- **Tailwind CSS 4** + **Shadcn UI** + **Radix UI**
- **Zod 4** - Schema validation

### Backend
- **PostgreSQL** (Neon) + **Prisma 5.22.0**
- **Clerk** (Auth) + **Uploadthing** (CDN)

### AI/ML Stack
- **Google Gemini Flash 1.5** - Vision & text generation
- **OpenAI Embeddings** (text-embedding-3-small) - Semantic search
- **pgvector** - Vector similarity search
- **Custom ML Algorithms** - Difficulty prediction, trending, taste profiling

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Clerk account
- Uploadthing account
- **Google Gemini API key** (for AI features)
- **OpenAI API key** (for embeddings)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/fooxchange.git
cd fooxchange

# Install dependencies
npm install

# Set up environment variables (create .env file)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="..."

# AI API Keys
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma db push

# Generate embeddings for existing recipes (for AI features)
npx tsx scripts/backfill-embeddings.ts

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
fooxchange/
├── app/                    # Next.js App Router
│   └── api/ai/            # AI API endpoints
├── components/             # React components
│   ├── camera-scanner.tsx # Camera scanning UI
│   └── ai-recommendations.tsx # AI suggestions
├── lib/
│   ├── services/          # ML/AI services
│   │   ├── vision-service.ts
│   │   ├── ml-service.ts
│   │   ├── dl-service.ts
│   │   ├── embedding-service.ts
│   │   └── search-service.ts
│   └── actions/           # Server actions
├── prisma/                 # Database schema
└── public/                 # Static assets
```

## 🤖 AI API Endpoints

- `POST /api/ai/identify` - Upload image → Get ingredients
- `POST /api/ai/recommend` - Get intelligent recipe recommendations
- `GET /api/ai/search` - Semantic recipe search
- `POST /api/ai/analyze` - Recipe difficulty, nutrition, tips
- `GET /api/ai/trending` - Trending recipes
- `GET /api/ai/personalized` - Personalized feed

## 🗄️ Database Schema

### Core Tables
- **User** - User accounts (Clerk managed)
- **Recipe** - Recipe data
- **Ingredient** - Ingredient catalog
- **RecipeIngredient** - Many-to-many
- **Step** - Cooking instructions
- **SavedRecipe** - User favorites

### AI Tables
- **IngredientEmbedding** - Vector embeddings for ingredients
- **RecipeEmbedding** - Vector embeddings for recipes
- **VisionLog** - Analytics for vision API

## 🚀 Deployment

Deploy to Vercel:
1. Push code to GitHub
2. Import in Vercel
3. Add environment variables (including AI API keys)
4. Deploy!

**Note**: Ensure PostgreSQL has pgvector extension enabled for AI features.

## 📝 Development Phases

- ✅ **Phase 1**: Foundation
- ✅ **Phase 2**: Core Logic
- ✅ **Phase 3**: Experience
- ✅ **Phase 4**: Polish & Launch
- ✅ **Phase 5**: AI/ML Integration (New!)

## 📊 Performance

| Feature | Avg Latency | Cost/Request |
|---------|-------------|--------------|
| Vision API | ~1.2s | $0.002 |
| Semantic Search | ~0.5s | $0.0001 |
| Recommendations | ~1.5s | $0.005 |
| Trending | ~0.8s | Free |

## 🔜 Future Enhancements

- Comments and ratings
- User profiles
- Meal planning
- Shopping list generator
- Voice-based recipe search
- Recipe image generation (AI)
- Custom fine-tuned ML models

## 📄 License

MIT License

---

**Made with ❤️ and 🤖 AI for home cooks everywhere** 🍳
