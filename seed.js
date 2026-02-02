const { PrismaClient } = require("./lib/generated/prisma");

const prisma = new PrismaClient({
    log: ["error"],
});

async function seed() {
    console.log("🌱 Seeding database...");

    try {
        // Create a test user
        const user = await prisma.user.upsert({
            where: { clerkId: "seed_user_123" },
            update: {},
            create: {
                clerkId: "seed_user_123",
                email: "chef@fooxchange.com",
                name: "Master Chef",
                avatarUrl: null,
                bio: "Home cooking enthusiast sharing family recipes!",
            },
        });

        console.log("✅ Created test user:", user.name);

        // Create ingredients
        const ingredients = await Promise.all([
            prisma.ingredient.upsert({
                where: { slug: "tomato" },
                update: {},
                create: { name: "Tomato", slug: "tomato", category: "Vegetable" },
            }),
            prisma.ingredient.upsert({
                where: { slug: "chicken" },
                update: {},
                create: { name: "Chicken", slug: "chicken", category: "Protein" },
            }),
            prisma.ingredient.upsert({
                where: { slug: "rice" },
                update: {},
                create: { name: "Rice", slug: "rice", category: "Grain" },
            }),
            prisma.ingredient.upsert({
                where: { slug: "garlic" },
                update: {},
                create: { name: "Garlic", slug: "garlic", category: "Spice" },
            }),
            prisma.ingredient.upsert({
                where: { slug: "onion" },
                update: {},
                create: { name: "Onion", slug: "onion", category: "Vegetable" },
            }),
        ]);

        console.log("✅ Created", ingredients.length, "ingredients");

        // Create a sample recipe
        const recipe = await prisma.recipe.create({
            data: {
                title: "Classic Chicken Fried Rice",
                description:
                    "A delicious and easy fried rice recipe perfect for using leftover rice. Quick, flavorful, and satisfying!",
                imageUrl: null,
                prepTime: 15,
                cookTime: 20,
                servings: 4,
                difficulty: "EASY",
                authorId: user.id,
                ingredients: {
                    create: [
                        {
                            amount: "2 cups",
                            isOptional: false,
                            ingredient: { connect: { slug: "rice" } },
                        },
                        {
                            amount: "300g",
                            isOptional: false,
                            ingredient: { connect: { slug: "chicken" } },
                        },
                        {
                            amount: "1 medium",
                            isOptional: false,
                            ingredient: { connect: { slug: "onion" } },
                        },
                        {
                            amount: "3 cloves",
                            isOptional: false,
                            ingredient: { connect: { slug: "garlic" } },
                        },
                    ],
                },
                steps: {
                    create: [
                        {
                            order: 1,
                            content:
                                "Cook rice according to package instructions and let it cool. Day-old rice works best for fried rice.",
                            imageUrl: null,
                        },
                        {
                            order: 2,
                            content:
                                "Dice chicken into small cubes. Mince garlic and chop onion finely.",
                            imageUrl: null,
                        },
                        {
                            order: 3,
                            content:
                                "Heat oil in a large wok or pan over high heat. Add chicken and cook until golden brown, about 5-7 minutes.",
                            imageUrl: null,
                        },
                        {
                            order: 4,
                            content:
                                "Add garlic and onion, stir-fry until fragrant, about 2 minutes.",
                            imageUrl: null,
                        },
                        {
                            order: 5,
                            content:
                                "Add the cooked rice and break up any clumps. Stir-fry for 3-4 minutes until heated through.",
                            imageUrl: null,
                        },
                        {
                            order: 6,
                            content:
                                "Season with soy sauce, salt, and pepper to taste. Garnish with green onions and serve hot!",
                            imageUrl: null,
                        },
                    ],
                },
            },
        });

        console.log("✅ Created recipe:", recipe.title);

        // Create another recipe
        const recipe2 = await prisma.recipe.create({
            data: {
                title: "Fresh Tomato Garlic Pasta",
                description:
                    "Simple Italian-inspired pasta with fresh tomatoes and garlic. Ready in 30 minutes!",
                imageUrl: null,
                prepTime: 10,
                cookTime: 20,
                servings: 2,
                difficulty: "EASY",
                authorId: user.id,
                ingredients: {
                    create: [
                        {
                            amount: "4 large",
                            isOptional: false,
                            ingredient: { connect: { slug: "tomato" } },
                        },
                        {
                            amount: "6 cloves",
                            isOptional: false,
                            ingredient: { connect: { slug: "garlic" } },
                        },
                    ],
                },
                steps: {
                    create: [
                        {
                            order: 1,
                            content: "Boil pasta according to package instructions.",
                            imageUrl: null,
                        },
                        {
                            order: 2,
                            content:
                                "Dice tomatoes and mince garlic while pasta is cooking.",
                            imageUrl: null,
                        },
                        {
                            order: 3,
                            content:
                                "Heat olive oil in a pan, add garlic and cook until fragrant.",
                            imageUrl: null,
                        },
                        {
                            order: 4,
                            content:
                                "Add tomatoes and cook until they break down into a sauce, about 10 minutes.",
                            imageUrl: null,
                        },
                        {
                            order: 5,
                            content:
                                "Drain pasta and toss with the tomato sauce. Season and serve with basil!",
                            imageUrl: null,
                        },
                    ],
                },
            },
        });

        console.log("✅ Created recipe:", recipe2.title);

        console.log("\n🎉 Seeding complete!");
        console.log("📊 Created:");
        console.log("  - 1 user");
        console.log("  - 5 ingredients");
        console.log("  - 2 recipes");
        console.log("\n🚀 Ready to test at http://localhost:3000");
    } catch (error) {
        console.error("❌ Seeding error:", error);
        throw error;
    }
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
