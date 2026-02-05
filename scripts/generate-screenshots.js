/**
 * PWA Screenshot Generator
 * Creates placeholder screenshots for PWA manifest
 * 
 * Run with: node scripts/generate-screenshots.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'screenshots');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Create SVG screenshot templates
function createHomeSVG() {
    return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="540" height="720" viewBox="0 0 540 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#16a34a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="540" height="720" fill="#f5f5f5"/>
  
  <!-- Header -->
  <rect width="540" height="120" fill="url(#grad)"/>
  <text x="270" y="70" font-family="Arial" font-size="32" font-weight="bold" fill="white" text-anchor="middle">Fooxchange</text>
  
 <!-- Hero Section -->
  <rect x="20" y="140" width="500" height="200" fill="white" rx="12"/>
  <text x="270" y="190" font-family="Arial" font-size="24" font-weight="bold" fill="#16a34a" text-anchor="middle">Share Your Recipes</text>
  <text x="270" y="230" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">Discover delicious recipes from</text>
  <text x="270" y="255" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">food lovers around the world</text>
  
  <!-- CTA Button -->
  <rect x="170" y="280" width="200" height="45" fill="#16a34a" rx="8"/>
  <text x="270" y="310" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">Get Started</text>
  
  <!-- Feature Cards -->
  <rect x="20" y="360" width="150" height="150" fill="white" rx="8"/>
  <circle cx="95" cy="410" r="25" fill="#dcfce7"/>
  <text x="95" y="420" font-family="Arial" font-size="24" fill="#16a34a" text-anchor="middle">📷</text>
  <text x="95" y="460" font-family="Arial" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">Scan</text>
  <text x="95" y="480" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Ingredients</text>
  
  <rect x="195" y="360" width="150" height="150" fill="white" rx="8"/>
  <circle cx="270" cy="410" r="25" fill="#dcfce7"/>
  <text x="270" y="420" font-family="Arial" font-size="24" fill="#16a34a" text-anchor="middle">🔍</text>
  <text x="270" y="460" font-family="Arial" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">Find</text>
  <text x="270" y="480" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Recipes</text>
  
  <rect x="370" y="360" width="150" height="150" fill="white" rx="8"/>
  <circle cx="445" cy="410" r="25" fill="#dcfce7"/>
  <text x="445" y="420" font-family="Arial" font-size="24" fill="#16a34a" text-anchor="middle">📱</text>
  <text x="445" y="460" font-family="Arial" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">Offline</text>
  <text x="445" y="480" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Ready</text>
  
  <!-- Footer Info -->
  <text x="270" y="600" font-family="Arial" font-size="14" fill="#999" text-anchor="middle">Install the app for the best experience</text>
</svg>`);
}

function createRecipesSVG() {
    return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="540" height="720" viewBox="0 0 540 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#16a34a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="540" height="720" fill="#f5f5f5"/>
  
  <!-- Header -->
  <rect width="540" height="80" fill="url(#grad)"/>
  <text x="270" y="50" font-family="Arial" font-size="24" font-weight="bold" fill="white" text-anchor="middle">Browse Recipes</text>
  
  <!-- Search Bar -->
  <rect x="20" y="100" width="500" height="50" fill="white" rx="25" stroke="#ddd" stroke-width="1"/>
  <text x="270" y="132" font-family="Arial" font-size="16" fill="#999" text-anchor="middle">Search for recipes...</text>
  
  <!-- Recipe Cards -->
  <rect x="20" y="170" width="240" height="220" fill="white" rx="12"/>
  <rect x="20" y="170" width="240" height="140" fill="#dcfce7" rx="12"/>
  <text x="140" y="245" font-family="Arial" font-size="24" fill="#16a34a" text-anchor="middle">🥗</text>
  <text x="140" y="295" font-family="Arial" font-size="16" font-weight="bold" fill="#333" text-anchor="middle">Fresh Salad</text>
  <text x="140" y="320" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Healthy & Delicious</text>
  <text x="140" y="360" font-family="Arial" font-size="14" fill="#16a34a" text-anchor="middle">⭐ 4.8</text>
  
  <rect x="280" y="170" width="240" height="220" fill="white" rx="12"/>
  <rect x="280" y="170" width="240" height="140" fill="#fee2e2" rx="12"/>
  <text x="400" y="245" font-family="Arial" font-size="24" fill="#dc2626" text-anchor="middle">🍝</text>
  <text x="400" y="295" font-family="Arial" font-size="16" font-weight="bold" fill="#333" text-anchor="middle">Pasta Delight</text>
  <text x="400" y="320" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Italian Classic</text>
  <text x="400" y="360" font-family="Arial" font-size="14" fill="#16a34a" text-anchor="middle">⭐ 4.9</text>
  
  <rect x="20" y="410" width="240" height="220" fill="white" rx="12"/>
  <rect x="20" y="410" width="240" height="140" fill="#fef3c7" rx="12"/>
  <text x="140" y="485" font-family="Arial" font-size="24" fill="#f59e0b" text-anchor="middle">🍰</text>
  <text x="140" y="535" font-family="Arial" font-size="16" font-weight="bold" fill="#333" text-anchor="middle">Sweet Cake</text>
  <text x="140" y="560" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Dessert Special</text>
  <text x="140" y="600" font-family="Arial" font-size="14" fill="#16a34a" text-anchor="middle">⭐ 5.0</text>
  
  <rect x="280" y="410" width="240" height="220" fill="white" rx="12"/>
  <rect x="280" y="410" width="240" height="140" fill="#dbeafe" rx="12"/>
  <text x="400" y="485" font-family="Arial" font-size="24" fill="#3b82f6" text-anchor="middle">🍲</text>
  <text x="400" y="535" font-family="Arial" font-size="16" font-weight="bold" fill="#333" text-anchor="middle">Warm Soup</text>
  <text x="400" y="560" font-family="Arial" font-size="12" fill="#666" text-anchor="middle">Comfort Food</text>
  <text x="400" y="600" font-family="Arial" font-size="14" fill="#16a34a" text-anchor="middle">⭐ 4.7</text>
</svg>`);
}

async function generateScreenshots() {
    console.log('📸 Generating PWA screenshots...\n');

    try {
        // Generate home screenshot
        await sharp(createHomeSVG())
            .resize(540, 720)
            .png()
            .toFile(path.join(OUTPUT_DIR, 'home.png'));
        console.log('✅ Generated home.png');

        // Generate recipes screenshot
        await sharp(createRecipesSVG())
            .resize(540, 720)
            .png()
            .toFile(path.join(OUTPUT_DIR, 'recipes.png'));
        console.log('✅ Generated recipes.png');

        console.log('\n✨ Screenshots generated successfully!');
    } catch (error) {
        console.error('❌ Error generating screenshots:', error);
    }
}

generateScreenshots();
