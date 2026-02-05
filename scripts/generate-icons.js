/**
 * PWA Icon Generator Script
 * Generates all required PWA icons for Fooxchange
 * 
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Icon sizes required by PWA manifest
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('✅ Created icons directory');
}

// Generate SVG icon
function generateSVGIcon(size) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#16a34a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.15}"/>
  
  <!-- Chef Hat Design -->
  <g transform="translate(${size / 2}, ${size / 2})">
    <!-- Hat top puff -->
    <circle cx="0" cy="${-size * 0.12}" r="${size * 0.16}" fill="white" opacity="0.95"/>
    
    <!-- Left puff -->
    <circle cx="${-size * 0.12}" cy="${-size * 0.04}" r="${size * 0.12}" fill="white" opacity="0.95"/>
    
    <!-- Right puff -->
    <circle cx="${size * 0.12}" cy="${-size * 0.04}" r="${size * 0.12}" fill="white" opacity="0.95"/>
    
    <!-- Hat band -->
    <rect x="${-size * 0.2}" y="${size * 0.04}" width="${size * 0.4}" height="${size * 0.08}" fill="white" opacity="0.95" rx="${size * 0.02}"/>
    
    <!-- Food elements (fork and spoon crossed) -->
    <!-- Fork -->
    <g opacity="0.3">
      <rect x="${-size * 0.15}" y="${size * 0.15}" width="${size * 0.04}" height="${size * 0.18}" fill="white" rx="${size * 0.01}"/>
      <rect x="${-size * 0.17}" y="${size * 0.15}" width="${size * 0.015}" height="${size * 0.08}" fill="white"/>
      <rect x="${-size * 0.13}" y="${size * 0.15}" width="${size * 0.015}" height="${size * 0.08}" fill="white"/>
    </g>
    
    <!-- Spoon -->
    <g opacity="0.3">
      <circle cx="${size * 0.12}" cy="${size * 0.19}" r="${size * 0.025}" fill="white"/>
      <rect x="${size * 0.1}" y="${size * 0.21}" width="${size * 0.04}" height="${size * 0.12}" fill="white" rx="${size * 0.01}"/>
    </g>
  </g>
</svg>`;
}

// Generate all icons
console.log('🎨 Generating PWA icons for Fooxchange...\n');

SIZES.forEach(size => {
    const svg = generateSVGIcon(size);
    const filename = `icon-${size}x${size}.svg`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, svg);
    console.log(`✅ Generated ${filename}`);
});

// Also generate a base icon for screenshots
const screenshotSVG = generateSVGIcon(1024);
fs.writeFileSync(path.join(OUTPUT_DIR, 'icon-base.svg'), screenshotSVG);
console.log(`✅ Generated icon-base.svg (1024x1024)`);

console.log(`\n✨ Successfully generated ${SIZES.length + 1} SVG icons in ${OUTPUT_DIR}`);
console.log('\n📝 Note: SVG icons work great for PWAs. If you need PNG versions, you can use an online converter or a tool like sharp/jimp.');
console.log('\nTo convert to PNG (optional):');
console.log('npm install sharp');
console.log('Then create a conversion script using sharp library.\n');
