/**
 * Recipe Tag Derivation — derive dietary/category tags from ingredient names
 *
 * Used by ml-service.ts for filtering recommendations by diet.
 * Since the Recipe model doesn't have a persisted `tags` field,
 * this derives tags on-the-fly from ingredient lists.
 *
 * Categories: meat, seafood, dairy, vegetarian, vegan, gluten-free, etc.
 */

/** Ingredient keywords mapped to categories */
const MEAT_KEYWORDS = [
    'beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'chicken', 'turkey',
    'duck', 'lamb', 'veal', 'venison', 'bison', 'goat', 'salami', 'pepperoni',
    'prosciutto', 'chorizo', 'ground beef', 'ground turkey', 'ground pork',
    'ribs', 'wing', 'thigh', 'breast', 'drumstick', 'tenderloin',
];

const SEAFOOD_KEYWORDS = [
    'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'oyster',
    'mussel', 'clam', 'scallop', 'squid', 'octopus', 'sardine', 'anchovy',
    'cod', 'tilapia', 'halibut', 'mackerel', 'trout', 'swordfish', 'mahi',
    'catfish', 'bass', 'snapper',
];

const DAIRY_KEYWORDS = [
    'milk', 'cheese', 'butter', 'cream', 'yogurt', 'curd', 'ghee',
    'mozzarella', 'cheddar', 'parmesan', 'ricotta', 'brie', 'camembert',
    'gouda', 'feta', 'mascarpone', 'sour cream', 'heavy cream',
    'whipped cream', 'cream cheese', 'cottage cheese',
];

const EGG_KEYWORDS = ['egg', 'eggs', 'yolk', 'egg white'];

const GLUTEN_KEYWORDS = [
    'flour', 'wheat', 'bread', 'pasta', 'noodle', 'spaghetti', 'penne',
    'macaroni', 'lasagna', 'tortilla', 'pita', 'couscous', 'barley',
    'rye', 'semolina', 'breadcrumb', 'crouton', 'baguette',
];

const NUT_KEYWORDS = [
    'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut',
    'macadamia', 'peanut', 'pine nut', 'chestnut', 'brazil nut',
];

export type RecipeTag =
    | 'meat'
    | 'seafood'
    | 'dairy'
    | 'egg'
    | 'gluten'
    | 'nuts'
    | 'vegetarian'
    | 'vegan'
    | 'gluten-free'
    | 'nut-free'
    | 'dairy-free';

/**
 * Derive dietary/category tags from a list of ingredient names.
 *
 * @param ingredientNames — Array of ingredient names
 * @returns Array of derived tags
 */
export function deriveRecipeTags(ingredientNames: string[]): RecipeTag[] {
    const lowerNames = ingredientNames.map((n) => n.toLowerCase());
    const tags: Set<RecipeTag> = new Set();

    const hasKeyword = (keywords: string[]) =>
        lowerNames.some((name) => keywords.some((kw) => name.includes(kw)));

    const hasMeat = hasKeyword(MEAT_KEYWORDS);
    const hasSeafood = hasKeyword(SEAFOOD_KEYWORDS);
    const hasDairy = hasKeyword(DAIRY_KEYWORDS);
    const hasEgg = hasKeyword(EGG_KEYWORDS);
    const hasGluten = hasKeyword(GLUTEN_KEYWORDS);
    const hasNuts = hasKeyword(NUT_KEYWORDS);

    // Positive tags (what the recipe contains)
    if (hasMeat) tags.add('meat');
    if (hasSeafood) tags.add('seafood');
    if (hasDairy) tags.add('dairy');
    if (hasEgg) tags.add('egg');
    if (hasGluten) tags.add('gluten');
    if (hasNuts) tags.add('nuts');

    // Derived dietary tags
    if (!hasMeat && !hasSeafood) {
        tags.add('vegetarian');
        if (!hasDairy && !hasEgg) {
            tags.add('vegan');
        }
    }
    if (!hasGluten) tags.add('gluten-free');
    if (!hasNuts) tags.add('nut-free');
    if (!hasDairy) tags.add('dairy-free');

    return Array.from(tags);
}

/**
 * Check if a recipe matches a dietary restriction.
 *
 * @param ingredientNames — Array of ingredient names
 * @param restriction — Dietary restriction to check (e.g., 'vegetarian', 'vegan')
 * @returns true if the recipe satisfies the restriction
 */
export function matchesDietaryRestriction(
    ingredientNames: string[],
    restriction: string
): boolean {
    const tags = deriveRecipeTags(ingredientNames);
    return tags.includes(restriction.toLowerCase() as RecipeTag);
}
