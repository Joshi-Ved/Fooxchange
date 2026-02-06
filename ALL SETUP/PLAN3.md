# Fooxchange V3: The "Edge-First" Revolution (PLAN3)

**Status:** Planning Phase  
**Date:** 2026-02-05  
**Last Review:** 2026-02-05 (Security Audit Complete)  
**Objective:** Pivot Fooxchange to a **Zero-Cost, Privacy-First, Native-Like** application using Client-Side AI and PWA technology.

---

## 1. The Strategic Pivot

We are moving away from expensive Cloud APIs (Gemini/OpenAI) to an **"Edge AI"** architecture.
*   **Old Way:** App sends data to Cloud -> User pays $$$ per request.
*   **New Way:** App downloads a small "Brain" (Model) to the browser. The User's device does the thinking. **Cost: $0.**

### Key Benefits
1.  **Zero API Costs:** No monthly bills for Vision or Embedding APIs.
2.  **Privacy:** User photos and data never leave their device for processing.
3.  **Offline Capability:** Core features can theoretically work without internet.
4.  **Native Feel:** PWA installation makes it capable of being "installed" on mobile without App Stores.

### Known Trade-offs
1.  **Initial Load Time:** Users must download AI models (~20-50MB) on first use.
2.  **Device Dependency:** Older phones may struggle with WASM-based inference.
3.  **Model Accuracy:** Pre-trained generic models are less accurate than specialized cloud APIs.

---

## 2. Technical Architecture

### A. The "Edge Vision" Pipeline (Ingredient Recognition)
*   **Technology:** `TensorFlow.js` or `MediaPipe`.
*   **Model Source:** 
    *   *Initial:* Pre-trained `COCO-SSD` (detects generic objects like "banana", "apple").
    *   *Advanced:* Custom "Food-101" model trained on Google Colab, exported to TFJS format.
*   **Execution:** Runs strictly in the browser `WebWorker` to avoid UI freezing.
*   **Model Storage:** `/public/models/` directory with integrity hashes.

### B. The "Edge Intelligence" Pipeline (Search & Recommendations)
*   **Technology:** `Transformers.js` (by Xenova).
*   **Function:** Generates vector embeddings for recipes/ingredients *inside* the browser.
*   **Model:** `Xenova/all-MiniLM-L6-v2` (Quantized, ~20MB).
*   **Workflow:** 
    1.  User types "Spicy comfort food".
    2.  Browser converts text -> Vector Numbers.
    3.  App sends *only numbers* to Database for comparison.
*   **Server Validation:** All incoming vectors are validated for dimensionality and range.

### C. Mobile Distribution (PWA)
*   **Manifest:** JSON file defining App Name, Icons, Colors.
*   **Service Worker:** Caches assets for offline use and faster loading.
*   **Experience:** Users see "Add to Home Screen". Opens in full-screen (no URL bar). Works on iOS and Android.
*   **Update Strategy:** Service Worker versioning with forced refresh on critical updates.

### D. Offline Data Storage
*   **Technology:** `IndexedDB` (NOT localStorage).
*   **Why:** IndexedDB is asynchronous (non-blocking) and supports larger data.
*   **Stored Data:** User's pantry/ingredient list, cached recipes, user preferences.
*   **Encryption:** Sensitive data (user profile) encrypted before storage.

---

## 3. Security & Hardening 🔒

This section addresses vulnerabilities specific to the "Edge AI" architecture.

### A. Content Security Policy (CSP)
Prevents injection attacks and restricts what scripts can run.

| Directive | Value | Reason |
|:---|:---|:---|
| `default-src` | `'self'` | Only load resources from our domain. |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Allow WASM for TensorFlow.js. |
| `worker-src` | `'self' blob:` | Allow WebWorkers for AI inference. |
| `img-src` | `'self' data: blob:` | Allow camera captures and blobs. |
| `connect-src` | `'self' https://api.fooxchange.com` | Restrict API calls to our backend only. |
| `style-src` | `'self' 'unsafe-inline'` | Allow inline styles (required by some UI libs). |

### B. Model Integrity Verification
**Risk:** Models in `/public/` can be intercepted and replaced (Man-in-the-Middle).
**Mitigation:**
1.  Generate SHA-256 hash of each model file during build.
2.  Store hashes in a signed manifest (`model-manifest.json`).
3.  On load, browser computes hash and compares before executing.
4.  If mismatch: Refuse to run, show error, log incident.

### C. Vector Injection Prevention
**Risk:** Malicious clients send crafted vectors to manipulate search results.
**Mitigation (Server-Side):**
1.  **Dimensionality Check:** Reject vectors that are not exactly 384 dimensions (for MiniLM).
2.  **Range Check:** All values must be between -1.0 and 1.0.
3.  **Rate Limiting:** Max 20 vector searches per minute per user.
4.  **Anomaly Detection:** Flag users sending statistically unusual vectors.

### D. Service Worker Security
**Risk:** Compromised Service Worker can intercept all requests.
**Mitigation:**
1.  **Versioning:** Each SW has a version number. On update, old cache is purged.
2.  **skipWaiting Control:** Do NOT auto-activate new SW; prompt user to refresh.
3.  **Scope Limitation:** SW only controls `/app/` routes, not `/api/`.
4.  **No Third-Party SW:** Only our SW registered; block others via CSP.

### E. Secure Development Tunneling (ngrok)
**Risk:** Public tunnel URLs expose local dev environment to internet.
**Protocol:**
1.  **Always use authentication:** `ngrok http 3000 --auth="user:password"`
2.  **Time-Limited Sessions:** Stop tunnel immediately after testing.
3.  **Never expose production `.env`:** Use separate `.env.development` with dummy keys.
4.  **IP Whitelisting:** If possible, restrict tunnel access to your phone's IP only.

### F. Authentication & Session Security
**Risk:** Offline-first apps have complex session management.
**Strategy:**
1.  **JWT with Short Expiry:** Access tokens expire in 15 minutes.
2.  **Refresh Token (Secure):** Stored in HttpOnly cookie, not accessible to JS.
3.  **Offline Grace:** Cached content is read-only when offline; writes queue until online.
4.  **Re-auth on Sync:** When coming back online, validate session before syncing data.

### G. Graceful Degradation (Old Devices)
**Risk:** Phones without WASM support will crash or freeze.
**Strategy:**
1.  **Feature Detection:** Check for `WebAssembly` and `WebWorker` support on load.
2.  **Fallback Mode:** If unsupported, disable AI features; show manual ingredient input.
3.  **User Feedback:** Display clear message: "Your device doesn't support AI scanning. Please use manual entry."

---

## 4. Development Roadmap (Revised)

### Phase 3.0: Security Foundation 🔐 (NEW - Do First)
*   [ ] **CSP Headers:** Configure in `next.config.ts` / middleware.
*   [ ] **Model Integrity Script:** Create build-time hash generator.
*   [ ] **Vector Validation Utility:** Create server-side validation function.
*   [ ] **IndexedDB Wrapper:** Create utility for encrypted local storage.

### Phase 3.1: The Mobile Foundation (PWA) 📱
*   [ ] **Manifest.json:** Create standard app manifest.
*   [ ] **Icons:** Generate required icon set (192, 512, apple-touch).
*   [ ] **Meta Tags:** Update `layout.tsx` for mobile viewports and PWA compatibility.
*   [ ] **Service Worker:** Implement with versioning and controlled updates.
*   [ ] **Secure Testing Tunnel:** Setup `ngrok` with authentication for HTTPS mobile testing.

### Phase 3.2: "Edge Vision" Implementation 👁️
*   [ ] **Remove Gemini Server Actions:** Clean up old expensive API code.
*   [ ] **Install TensorFlow.js:** Add client-side libraries.
*   [ ] **WebWorker Setup:** Move AI inference off main thread.
*   [ ] **Camera Integration:** Hook up existing camera feed to TFJS analyzer.
*   [ ] **Real-time Bounding Boxes:** Draw detection boxes on the camera preview canvas.
*   [ ] **Model Loading UX:** Progress bar for model download; lazy load on camera open.
*   [ ] **Fallback UI:** Manual input for unsupported devices.

### Phase 3.3: "Edge Search" Implementation 🧠
*   [ ] **Remove OpenAI Embeddings:** Clean up server-side embedding generation.
*   [ ] **Install Transformers.js:** Configure Next.js to handle `.wasm` and `.onnx` files.
*   [ ] **Client-Side Vectorization:** Create hook to generate embeddings in browser.
*   [ ] **Server Validation:** Implement vector dimension/range checks on API routes.

### Phase 3.4: The Training Workflow 🎓
*   [ ] **Colab Notebook:** Create a standard Google Colab script for:
    1.  Loading Food Dataset (Food-101 or custom).
    2.  Training a MobileNet/EfficientNet model.
    3.  Converting to `tfjs_graph_model`.
    4.  Generating integrity hashes.
*   [ ] **Model Integration:** Workflow to download `model.json` from Colab -> `public/models/` in app.
*   [ ] **Versioning:** Model version tracked in `model-manifest.json`.

---

## 5. Testing Strategy (Mobile Focused)

### A. The "Secure Tunnel" Protocol
Camera permissions on mobile **require HTTPS**. 
*   **Tool:** `ngrok` (Free Tier).
*   **Command:** `ngrok http 3000 --auth="dev:securepassword123"`
*   **Workflow:** 
    1.  Run App locally: `npm run dev`
    2.  Run Tunnel with auth.
    3.  Open HTTPS link on actual phone (enter auth when prompted).
    4.  Test Camera & PWA installation.
*   **⚠️ Security:** Never share tunnel URL publicly. Stop tunnel immediately after testing.

### B. Device Compatibility Matrix
| Device Type | Expected Behavior |
|:---|:---|
| Modern Android (Chrome 90+) | Full AI + PWA |
| Modern iOS (Safari 15+) | Full AI + PWA (with iOS quirks) |
| Older Android (Chrome < 80) | Fallback Mode (Manual Input) |
| Desktop Chrome/Edge/Firefox | Full AI |
| Desktop Safari | Full AI (may need polyfills) |

### C. Performance Benchmarks
| Metric | Target | Measurement Tool |
|:---|:---|:---|
| Model Load Time | < 5s on 4G | Chrome DevTools |
| Inference Time | < 500ms per image | Performance API |
| PWA Install Prompt | Shows within 30s | Manual Test |
| Offline Functionality | Cached pages load | Airplane Mode Test |

---

## 6. File Cleanup (Executed)
*   Archived/Deleted old "Phase" plans and API-heavy ML documentation to focus strictly on this new Edge/PWA direction.

---

## 7. Architectural Decisions (Finalized)

| # | Question | Decision | Rationale |
|:---|:---|:---|:---|
| 1 | Which Food Dataset? | **Food-101 (Standard)** | Covers 101 global food categories. Well-documented, widely used in research. Good international variety. |
| 2 | Model size vs accuracy? | **MobileNetV3 (Quantized)** | Best balance: ~8-12MB, 75%+ accuracy. Runs smoothly even on mid-range phones with limited storage. |
| 3 | IndexedDB encryption? | **libsodium.js** | Industry-standard cryptography (used by Signal). Resistant to timing attacks. Better than crypto-js for sensitive data. |
| 4 | PWA update notification? | **Toast (Default) + Silent (Optional)** | Toast gives users control/awareness. Silent option in Settings for power users who trust auto-updates. |

### Technical Notes on Decisions:

#### Decision 1: Food-101 Dataset
*   **Source:** https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/
*   **Size:** 101 categories, 1000 images each (101,000 total images).
*   **Global Coverage:** Includes dishes like Sushi (Japan), Tacos (Mexico), Samosa (India), Bruschetta (Italy), etc.
*   **Limitation:** May not cover hyper-regional dishes. Can supplement with custom images later.

#### Decision 2: MobileNetV3 (Quantized)
*   **Why not EfficientNet?** EfficientNet-B0 is ~20MB; B1-B3 are 30-50MB. Too heavy for users with 16GB phones.
*   **Why MobileNetV3?** Designed by Google specifically for mobile. V3 improves on V2 with better accuracy at same size.
*   **Quantization:** We will use INT8 quantization to reduce model from ~12MB to ~4MB with minimal accuracy loss (~1-2%).
*   **Fallback:** If user's device struggles, we can serve an even smaller "Lite" model (~2MB).

#### Decision 3: libsodium.js
*   **Package:** `libsodium-wrappers` (npm)
*   **Why not crypto-js?** crypto-js is older, has known vulnerabilities in some modes, and is not constant-time (vulnerable to timing attacks).
*   **Features Used:**
    *   `crypto_secretbox_easy` — Symmetric encryption for pantry data.
    *   `crypto_pwhash` — Derive encryption key from user's password/session.
*   **Size Impact:** ~200KB (acceptable).

#### Decision 4: PWA Notification Strategy
*   **Default Behavior:** When new version detected, show toast: *"Update available. Tap to refresh."*
*   **Settings Toggle:** "Silent Updates" checkbox. If enabled, SW updates and refreshes in background on next visit.
*   **Critical Updates:** Force refresh regardless of setting (for security patches).

---

## 8. Success Criteria (Phase 3)

| Metric | Definition | Target |
|:---|:---|:---|
| **Zero API Cost** | No Gemini/OpenAI calls in production | 100% |
| **PWA Installable** | Passes Chrome PWA checklist | Yes |
| **Camera Works on Mobile** | HTTPS tested on real Android/iOS | Yes |
| **Offline Search** | Cached recipes searchable without internet | Yes |
| **Security Audit Pass** | All CSP, validation, auth items checked | 100% |
