/**
 * Backfill Embeddings Script
 * 
 * Generates vector embeddings for all existing recipes and ingredients
 * in the database. This is a one-time migration script.
 * 
 * Usage: npx tsx scripts/backfill-embeddings.ts
 */

import { db } from '../lib/db';
import {
    generateIngredientEmbedding,
    generateRecipeEmbedding,
} from '../lib/services/embedding-service';

async function backfillIngredientEmbeddings() {
    console.log('🔍 Fetching ingredients without embeddings...');

    const ingredients = await db.ingredient.findMany({
        where: {
            ingredientEmbedding: null,
        },
    });

    console.log(`Found ${ingredients.length} ingredients to process`);

    if (ingredients.length === 0) {
        console.log('✅ All ingredients already have embeddings');
        return;
    }

    let processed = 0;
    let failed = 0;

    for (const ingredient of ingredients) {
        try {
            console.log(`Processing: ${ingredient.name} (${ingredient.category || 'no category'})`);

            // Generate embedding
            const embedding = await generateIngredientEmbedding(
                ingredient.name,
                ingredient.category
            );

            // Store in database
            await db.ingredientEmbedding.create({
                data: {
                    ingredientId: ingredient.id,
                    embedding: JSON.stringify(embedding),
                    metadata: ingredient.category
                        ? {
                            category: ingredient.category,
                        }
                        : undefined,
                },
            });

            processed++;
            console.log(`✅ ${processed}/${ingredients.length} complete`);

            // Rate limiting: wait 500ms between requests to avoid hitting OpenAI limits
            await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
            failed++;
            console.error(`❌ Failed to process ${ingredient.name}:`, error);
        }
    }

    console.log(`\n📊 Ingredient Embedding Summary:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed: ${failed}`);
}

async function backfillRecipeEmbeddings() {
    console.log('\n🔍 Fetching recipes without embeddings...');

    const recipes = await db.recipe.findMany({
        where: {
            recipeEmbedding: null,
        },
        include: {
            ingredients: {
                include: {
                    ingredient: true,
                },
            },
        },
    });

    console.log(`Found ${recipes.length} recipes to process`);

    if (recipes.length === 0) {
        console.log('✅ All recipes already have embeddings');
        return;
    }

    let processed = 0;
    let failed = 0;

    for (const recipe of recipes) {
        try {
            console.log(`Processing: ${recipe.title}`);

            // Extract ingredient names
            const ingredientNames = recipe.ingredients.map(
                (ri) => ri.ingredient.name
            );

            // Generate embedding
            const embedding = await generateRecipeEmbedding(
                recipe.title,
                recipe.description,
                ingredientNames
            );

            // Store in database
            await db.recipeEmbedding.create({
                data: {
                    recipeId: recipe.id,
                    embedding: JSON.stringify(embedding),
                },
            });

            processed++;
            console.log(`✅ ${processed}/${recipes.length} complete`);

            // Rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
            failed++;
            console.error(`❌ Failed to process ${recipe.title}:`, error);
        }
    }

    console.log(`\n📊 Recipe Embedding Summary:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed: ${failed}`);
}

async function main() {
    console.log('🚀 Starting embedding backfill process...\n');

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ ERROR: OPENAI_API_KEY environment variable is not set');
        console.error('Please add your OpenAI API key to the .env file');
        process.exit(1);
    }

    try {
        // Process ingredients first (they're simpler and faster)
        await backfillIngredientEmbeddings();

        // Then process recipes
        await backfillRecipeEmbeddings();

        console.log('\n✅ Embedding backfill complete!');
    } catch (error) {
        console.error('\n❌ Fatal error during backfill:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
}

// Run the script
main();
