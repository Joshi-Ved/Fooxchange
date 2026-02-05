/**
 * PWA Icon Converter - SVG to PNG
 * Converts SVG icons to PNG format using sharp
 * 
 * Run with: node scripts/convert-icons-to-png.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

async function convertToPNG() {
    console.log('🔄 Converting SVG icons to PNG...\n');

    for (const size of SIZES) {
        const svgFile = path.join(ICONS_DIR, `icon-${size}x${size}.svg`);
        const pngFile = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

        try {
            await sharp(svgFile)
                .resize(size, size)
                .png()
                .toFile(pngFile);

            console.log(`✅ Converted icon-${size}x${size}.png`);
        } catch (error) {
            console.error(`❌ Failed to convert ${size}x${size}:`, error.message);
        }
    }

    console.log('\n✨ PNG conversion complete!');
}

convertToPNG().catch(console.error);
