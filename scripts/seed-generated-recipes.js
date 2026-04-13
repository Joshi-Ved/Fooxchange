const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// The 46 ingredients our model is trained on
const ingredientsList = [
  'apple', 'banana', 'orange', 'lemon', 'lime', 'mango', 'pineapple', 'strawberry', 'grapes', 'watermelon', 'pear', 'peach', 'cherry', 'kiwi', 'avocado', 'pomegranate', 'papaya', 'tomato', 'potato', 'onion', 'garlic', 'ginger', 'carrot', 'broccoli', 'spinach', 'cabbage', 'capsicum', 'green_chili', 'red_chili', 'cucumber', 'eggplant', 'peas', 'corn', 'mushroom', 'cauliflower', 'zucchini', 'pumpkin', 'radish', 'beetroot', 'lettuce', 'bitter_gourd', 'milk', 'turmeric', 'cumin', 'coriander', 'sugar'
];

// Helper function to get a random subset of ingredients
const getRandomIngredients = (count) => {
  const shuffled = [...ingredientsList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Helper function to generate a random recipe
const generateRecipe = (ingredientNames) => {
  const mainIngredient = ingredientNames[0];
  const recipeType = ['Stew', 'Salad', 'Curry', 'Roast', 'Soup', 'Stir-fry', 'Pie', 'Casserole'];
  const randomType = recipeType[Math.floor(Math.random() * recipeType.length)];

  const title = `Simple ${mainIngredient.charAt(0).toUpperCase() + mainIngredient.slice(1)} ${randomType}`;
  const description = `A delicious and easy-to-make ${randomType} featuring ${mainIngredient} and other fresh ingredients. Perfect for a weeknight meal.`;

  const ingredients = ingredientNames.map(name => ({
    name: name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), // Capitalize and replace underscore
    amount: `${Math.floor(Math.random() * 3) + 1} ${['cups', 'tbsp', 'whole', 'grams'][Math.floor(Math.random() * 4)]}`
  }));

  const steps = [
    `Prepare all your ingredients. Wash and chop the ${ingredientNames.join(', ')}.`,
    `In a large pan, heat a small amount of oil and sauté the ${ingredientNames[0]} and ${ingredientNames[1] || 'onion'}.`,
    `Add the remaining ingredients and cook for 20-30 minutes until tender.`,
    `Season with salt, pepper, and your favorite spices.`,
    `Serve hot and enjoy your homemade ${mainIngredient} ${randomType}.`
  ];

  return {
    title,
    description,
    prepTime: Math.floor(Math.random() * 15) + 10,
    cookTime: Math.floor(Math.random() * 45) + 20,
    servings: Math.floor(Math.random() * 4) + 2,
    difficulty: ["EASY", "MEDIUM"][Math.floor(Math.random() * 2)],
    ingredients,
    steps: steps.map(s => ({ description: s })),
  };
};

async function main() {
  console.log("Starting to seed the database with generated recipes...");

  // Clear existing recipes to avoid duplicates if script is run multiple times
  console.log("Clearing old recipe data...");
  await prisma.recipeIngredient.deleteMany({});
  await prisma.step.deleteMany({});
  await prisma.recipe.deleteMany({});
  console.log("Old data cleared.");

  const recipeCount = 200;
  for (let i = 0; i < recipeCount; i++) {
    const numIngredients = Math.floor(Math.random() * 5) + 3; // 3 to 7 ingredients per recipe
    const selectedIngredients = getRandomIngredients(numIngredients);
    const recipeData = generateRecipe(selectedIngredients);

    // Find or create the author
    const author = await prisma.user.upsert({
        where: { email: 'seeder@fooxchange.com' },
        update: {},
        create: {
            clerkId: `user_seeder_${Date.now()}`,
            email: 'seeder@fooxchange.com',
            name: 'Recipe Bot',
        },
    });

    // Create the recipe in the database
    await prisma.recipe.create({
      data: {
        title: recipeData.title,
        description: recipeData.description,
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        servings: recipeData.servings,
        difficulty: recipeData.difficulty,
        authorId: author.id,
        steps: {
          create: recipeData.steps,
        },
        ingredients: {
          create: recipeData.ingredients.map(ing => ({
            ingredient: {
              connectOrCreate: {
                where: { name: ing.name },
                create: { name: ing.name, slug: ing.name.toLowerCase().replace(/ /g, '-') },
              },
            },
            amount: ing.amount,
          })),
        },
      },
    });
    console.log(`Created recipe ${i + 1}/${recipeCount}: "${recipeData.title}"`);
  }

  console.log(`\nSeeding finished. Successfully created ${recipeCount} recipes.`);
}

main()
  .catch((e) => {
    console.error("An error occurred during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
