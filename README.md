# 🍳 Fooxchange

A modern, production-ready recipe sharing platform built with Next.js 14+. Answer the question "What to cook today?" by discovering recipes based on ingredients you have.

![Next.js](https://img.shields.io/badge/Next.js-16.1.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)

## ✨ Features

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

- **Next.js 16.1.4** (App Router) + **TypeScript 5** + **React 19**
- **PostgreSQL** (Neon) + **Prisma 5.22.0**
- **Clerk** (Auth) + **Uploadthing** (CDN)
- **Tailwind CSS 4** + **Shadcn UI** + **Radix UI**
- **Zod 4** - Schema validation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Clerk account
- Uploadthing account

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

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
fooxchange/
├── app/                    # Next.js App Router
├── components/             # React components
├── lib/                    # Utilities & actions
├── prisma/                 # Database schema
└── public/                 # Static assets
```

## 🗄️ Database Schema

- **User** - User accounts (Clerk managed)
- **Recipe** - Recipe data
- **Ingredient** - Ingredient catalog
- **RecipeIngredient** - Many-to-many
- **Step** - Cooking instructions
- **SavedRecipe** - User favorites

## 🚀 Deployment

Deploy to Vercel:
1. Push code to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

## 📝 Development Phases

- ✅ **Phase 1**: Foundation
- ✅ **Phase 2**: Core Logic
- ✅ **Phase 3**: Experience
- ✅ **Phase 4**: Polish & Launch

## 🔜 Future Enhancements

- Comments and ratings
- User profiles
- Meal planning
- Shopping list generator
- Nutrition info

## 📄 License

MIT License

---

**Made with ❤️ for home cooks everywhere** 🍳
