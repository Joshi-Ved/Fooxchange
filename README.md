# 🍳 Fooxchange - Zero-Cost AI Recipe Sharing Platform

A modern, **Edge AI-powered** Progressive Web App built with Next.js. Uses client-side TensorFlow.js and Transformers.js for **$0 AI costs** and privacy-first architecture.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)
![PWA](https://img.shields.io/badge/PWA-Ready-brightgreen)
![Edge AI](https://img.shields.io/badge/Edge_AI-TensorFlow.js-orange)

## 🚀 **Quick Start - Test on Your Phone NOW!**

### **Run on Local Network (Test on Your Phone via WiFi):**

```bash
# 1. Start the dev server with network access
npm run dev -- -H 0.0.0.0

# 2. Your local IP: 192.168.0.176
# 3. On your phone (connected to SAME WiFi):
#    Open browser → http://192.168.0.176:3000

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
