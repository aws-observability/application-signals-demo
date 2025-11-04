const NutritionFact = require('./nutrition-fact');
const logger = require('pino')();

/**
 * Loads the nutrutionfact collection with static data. Yes this will drop
 * the collection if it already exists. This is just for demo purposes.
 */

module.exports = function(){
  NutritionFact.collection.drop()
    .then(() => logger.info('collection dropped'))
    .catch(err => logger.error('error dropping collection:', err));

  NutritionFact.insertMany([
    { pet_type: 'cat', facts: 'High-protein, grain-free dry or wet food with real meat as the main ingredient', products: 'PurrfectChoice Premium Feline, WhiskerWell Grain-Free Delight, MeowMaster Senior Formula' },
    { pet_type: 'dog', facts: 'Balanced dog food with quality proteins, fats, and carbohydrates', products: 'BarkBite Complete Nutrition, TailWagger Performance Plus, PawsitiveCare Sensitive Blend' },
    { pet_type: 'lizard', facts: 'Insects, leafy greens, and calcium supplements', products: 'ScaleStrong Calcium Boost, CricketCrunch Live Supply, ReptileVitality D3 Formula' },
    { pet_type: 'snake', facts: 'Whole prey (mice/rats) based on size', products: 'SlitherSnack Frozen Mice, CoilCuisine Feeder Rats, SerpentSupreme Multivitamin' },
    { pet_type: 'bird', facts: 'High-quality seeds, pellets, and fresh fruits/veggies', products: 'FeatherFeast Premium Pellets, WingWellness Seed Mix, BeakBoost Cuttlebone Calcium' },
    { pet_type: 'hamster', facts: 'Pellets, grains, fresh vegetables, and occasional fruits', products: 'HamsterHaven Complete Pellets, CheekPouch Gourmet Mix, WhiskerWonder Vitamin Drops' },
    { pet_type: 'rabbit', facts: 'High-fiber pellets, unlimited timothy hay, and fresh leafy greens', products: 'BunnyBest Timothy Pellets, HopHappy Hay Mix, CarrotCrunch Vitamin Treats' },
    { pet_type: 'ferret', facts: 'High-protein, low-carb diet with frequent small meals', products: 'FerretFuel High-Protein Kibble, WhiskerWild Raw Blend, MustelaMunch Treats' },
    { pet_type: 'turtle', facts: 'Species-specific pellets, leafy greens, and calcium supplements', products: 'ShellStrong Aquatic Pellets, TurtleTreats Calcium Blocks, AquaVeg Greens Mix' },
    { pet_type: 'guinea pig', facts: 'Vitamin C-rich pellets, unlimited timothy hay, and fresh vegetables', products: 'CavyCare Complete Pellets, GuineaGold Hay Blend, PiggyPower Vitamin Drops' },
    { pet_type: 'parrot', facts: 'High-quality pellets, fresh fruits, vegetables, and limited seeds', products: 'ParrotPrime Pellet Mix, TropicalTreats Fruit Blend, BeakBoost Mineral Block' },
    { pet_type: 'bearded dragon', facts: 'Insects, leafy greens, vegetables, and calcium dusting', products: 'DragonDiet Insect Mix, BeardedBest Veggie Blend, ScaleSupreme Calcium Powder' },
    { pet_type: 'fish', facts: 'Species-appropriate flakes or pellets with varied diet', products: 'AquaChoice Premium Flakes, FishFeast Tropical Pellets, MarineMax Color Enhancer' }
  ])
    .then(() => logger.info('collection populated'))
    .catch(err => logger.error('error populating collection:', err));
};