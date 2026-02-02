# 🧪 Fooxchange Testing Guide

## ✅ Your App is Running!

**Local URL**: http://localhost:3000

---

## 📋 Manual Testing Checklist

### 1. Home Page Test ✅
**URL**: `http://localhost:3000`

**What to check:**
- [ ] Page loads without errors
- [ ] Hero section with gradient background displays
- [ ] "Browse Recipes" and "Share Your Recipe" buttons visible
- [ ] "How It Works" section shows 3 steps
- [ ] Trending Recipes section (may be empty if no data)

**Expected**: Clean, modern landing page

---

### 2. Sign Up / Sign In Test 🔐
**Click**: "Sign In" button (top right)

**What to check:**
- [ ] Clerk authentication modal appears
- [ ] Can sign up with email or Google
- [ ] After sign in, user avatar appears in header
- [ ] Can sign out successfully

**Expected**: Smooth Clerk authentication flow

---

### 3. Create Recipe Test ✍️
**URL**: `http://localhost:3000/recipes/create`
**Requires**: Must be signed in

**What to test:**
1. Fill out the form:
   - **Title**: "Test Recipe"
   - **Description**: "This is a test recipe"
   - **Prep Time**: 10
   - **Cook Time**: 20
   - **Servings**: 4
   - **Difficulty**: Easy
  
2. Click "Add Ingredient":
   - **Name**: Tomato
   - **Amount**: 2 cups

3. Click "Add Step":
   - **Step 1**: "Chop the tomatoes"
   - **Step 2**: "Cook for 10 minutes"

4. Click "Create Recipe"

**What to check:**
- [ ] Form validation works (try submitting empty)
- [ ] Can add/remove ingredients
- [ ] Can add/remove steps
- [ ] Image upload button works (optional)
- [ ] Redirects to recipe detail after creation
- [ ] Success message appears

**Expected**: Recipe created successfully!

---

### 4. Browse Recipes Test 🔍
**URL**: `http://localhost:3000/recipes`

**What to check:**
- [ ] Recipe grid displays (or empty state if no recipes yet)
- [ ] Each recipe card shows:
  - Title
  - Author name
  - Ingredients preview
  - Cook time
  - Difficulty badge
  - Like count
- [ ] Clicking a card goes to recipe detail
- [ ] "Create Your First Recipe" button (if empty)

**Expected**: Grid of recipe cards or helpful empty state

---

### 5. Ingredient Search Test 🥕
**URL**: `http://localhost:3000/recipes`

**What to test:**
1. Type "tomato" in search box
2. Click "Add" or press Enter
3. See ingredient tag appear
4. Type another ingredient like "chicken"
5. Click X to remove an ingredient

**What to check:**
- [ ] Can add multiple ingredients
- [ ] Tags display correctly
- [ ] Can remove ingredients
- [ ] Recipes filter in real-time
- [ ] Popular ingredients suggestions show

**Expected**: Dynamic filtering by ingredients

---

### 6. Recipe Detail Test 📖
**URL**: Click any recipe card

**What to check:**
- [ ] Hero image displays (or placeholder emoji)
- [ ] Recipe title and description
- [ ] Author info with avatar
- [ ] "Save" button (heart icon)
- [ ] "Share" button
- [ ] Meta info: Total time, Servings, Difficulty
- [ ] Ingredients list (with amounts)
- [ ] Numbered steps
- [ ] "Start Cook Mode" button
- [ ] "Back" button works

**Expected**: Complete recipe details with all information

---

### 7. Save Recipe Test ❤️
**On Recipe Detail Page**
**Requires**: Must be signed in

**What to test:**
1. Click "Save" button
2. Heart should fill with color
3. Count should increase by 1
4. Button text changes to "Saved"
5. Click again to unsave
6. Heart unfills
7. Count decreases

**What to check:**
- [ ] Save button works
- [ ] Visual feedback (heart fills)
- [ ] Count updates
- [ ] Unsave works
- [ ] If not signed in, redirects to sign-in

**Expected**: Smooth save/unsave with visual feedback

---

### 8. Cook Mode Test 👨‍🍳
**On Recipe Detail Page**

**What to test:**
1. Click "Start Cook Mode"
2. Full-screen interface appears
3. See current step highlighted
4. Click checkbox to mark step complete
5. Green checkmark appears
6. Progress bar updates
7. Click "Next Step"
8. Navigate through all steps
9. See completion message
10. Click "Exit Cook Mode"

**What to check:**
- [ ] Full-screen mode activates
- [ ] Steps are numbered and clear
- [ ] Can mark steps complete
- [ ] Progress bar accurate
- [ ] Navigation buttons work
- [ ] Completion celebration shows
- [ ] Can exit anytime

**Expected**: Immersive cooking experience!

---

### 9. 404 Error Page Test 🚫
**URL**: `http://localhost:3000/recipes/fake-id-12345`

**What to check:**
- [ ] Custom 404 page displays
- [ ] Shows "404" in large text
- [ ] Message: "Recipe Not Found"
- [ ] "Go Home" button works
- [ ] "Browse Recipes" button works
- [ ] Branded design matches app

**Expected**: Helpful error page, not generic 404

---

### 10. Loading States Test ⏳
**Quick test**: Refresh recipe detail page

**What to check:**
- [ ] Loading skeleton appears
- [ ] Skeleton matches actual layout
- [ ] Content appears smoothly
- [ ] No layout shift

**Expected**: Smooth loading experience

---

### 11. Mobile Responsiveness Test 📱
**How**: Resize browser window to phone size (375px wide)

**Pages to test:**
- Home page
- Browse recipes
- Recipe detail
- Create recipe
- Cook Mode

**What to check:**
- [ ] All content fits without horizontal scroll
- [ ] Text is readable
- [ ] Buttons are touch-friendly (big enough)
- [ ] Images scale properly
- [ ] Navigation menu works
- [ ] Forms are usable

**Expected**: Fully responsive on all screen sizes

---

## 🎯 Quick Testing Workflow

**Fastest way to test everything:**

1. ✅ **Open**: http://localhost:3000
2. ✅ **Sign in** using Clerk
3. ✅ **Create a recipe** at `/recipes/create`
4. ✅ **View your recipe** from the list
5. ✅ **Save the recipe** (click heart)
6. ✅ **Try Cook Mode**
7. ✅ **Test ingredient search** at `/recipes`
8. ✅ **Test 404** by going to `/recipes/fake-id`

**Time needed**: ~5-10 minutes

---

## 🐛 If Something Doesn't Work

### Common Issues:

**1. "Authentication Required" error**
- ✅ **Solution**: Make sure you're signed in via Clerk

**2. No recipes showing**
- ✅ **Solution**: Create your first recipe! Click "Share Your Recipe"

**3. Image upload not working**
- ✅ **Check**: Uploadthing API keys in `.env`
- ✅ **Note**: Images are optional

**4. Database error**
- ✅ **Check**: Neon database is connected
- ✅ **Verify**: `DATABASE_URL` in `.env`

**5. Page won't load**
- ✅ **Check**: Dev server is running (`npm run dev`)
- ✅ **Check**: http://localhost:3000 (not 3001)

---

## ✅ What Success Looks Like

**All features working:**
- ✅ Can create recipes
- ✅ Can browse recipes
- ✅ Can search by ingredients
- ✅ Can save recipes
- ✅ Cook Mode works
- ✅ Authentication works
- ✅ Images upload (if you add them)
- ✅ Mobile responsive
- ✅ No console errors

**You'll know it's working when you can create a recipe, find it in the browse page, save it, and use Cook Mode!** 🎉

---

## 📊 Test Results Template

Copy this and fill it out:

```
## My Test Results

- [ ] Home page loads
- [ ] Sign in works
- [ ] Created a recipe
- [ ] Recipe appears in browse
- [ ] Ingredient search works
- [ ] Recipe detail shows correctly
- [ ] Save recipe works
- [ ] Cook Mode works
- [ ] 404 page works
- [ ] Mobile responsive

**Issues found**: (note any problems)

**Overall**: ✅ Working / ⚠️ Some issues / ❌ Not working
```

---

## 🎉 Ready to Test!

**Your app is live at**: http://localhost:3000

**Start testing now!** Sign in and create your first recipe! 👨‍🍳🚀
