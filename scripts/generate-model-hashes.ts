/**
 * Build Script: Generate Model Integrity Hashes
 * 
 * Scans /public/models/ directory and generates SHA-256 hashes
 * for all model files. Outputs manifest.json for runtime verification.
 * 
 * Usage: npx ts-node scripts/generate-model-hashes.ts
 * 
 * Add to package.json scripts:
 * "build:model-hashes": "ts-node scripts/generate-model-hashes.ts"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ModelManifest {
    version: string;
    generatedAt: string;
    models: {
        [modelName: string]: {
            files: {
                [fileName: string]: string;
            };
            totalSize: number;
            description: string;
        };
    };
}

const MODELS_DIR = path.join(process.cwd(), 'public', 'models');
const MANIFEST_PATH = path.join(MODELS_DIR, 'manifest.json');

/**
 * Computes SHA-256 hash of a file
 */
function computeFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Gets all files in a directory recursively
 */
function getFilesInDir(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getFilesInDir(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Main function
 */
async function generateManifest(): Promise<void> {
    console.log('🔐 Generating model integrity manifest...\n');

    // Ensure models directory exists
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log('📁 Created /public/models/ directory');
        console.log('⚠️  No models found. Add model folders and run again.\n');

        // Create empty manifest
        const emptyManifest: ModelManifest = {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            models: {},
        };
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(emptyManifest, null, 2));
        console.log('✅ Created empty manifest.json\n');
        return;
    }

    // Find model directories
    const entries = fs.readdirSync(MODELS_DIR, { withFileTypes: true });
    const modelDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (modelDirs.length === 0) {
        console.log('⚠️  No model directories found in /public/models/');
        console.log('   Expected structure: /public/models/<model-name>/model.json\n');
        return;
    }

    const manifest: ModelManifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        models: {},
    };

    // Process each model
    for (const modelName of modelDirs) {
        const modelDir = path.join(MODELS_DIR, modelName);
        const files = getFilesInDir(modelDir);

        console.log(`📦 Processing: ${modelName}`);

        const modelInfo: ModelManifest['models'][string] = {
            files: {},
            totalSize: 0,
            description: '',
        };

        for (const filePath of files) {
            const relativeName = path.relative(modelDir, filePath).replace(/\\/g, '/');
            const hash = computeFileHash(filePath);
            const stats = fs.statSync(filePath);

            modelInfo.files[relativeName] = hash;
            modelInfo.totalSize += stats.size;

            console.log(`   ✓ ${relativeName} (${(stats.size / 1024).toFixed(1)} KB)`);
        }

        // Try to read description from a metadata file if it exists
        const metadataPath = path.join(modelDir, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                modelInfo.description = metadata.description || '';
            } catch {
                // Ignore metadata parsing errors
            }
        }

        manifest.models[modelName] = modelInfo;
        console.log(`   Total: ${(modelInfo.totalSize / 1024 / 1024).toFixed(2)} MB\n`);
    }

    // Write manifest
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    console.log('═══════════════════════════════════════════');
    console.log(`✅ Manifest generated: ${MANIFEST_PATH}`);
    console.log(`   Models: ${Object.keys(manifest.models).length}`);
    console.log(`   Generated: ${manifest.generatedAt}`);
    console.log('═══════════════════════════════════════════\n');
}

// Run
generateManifest().catch(console.error);
