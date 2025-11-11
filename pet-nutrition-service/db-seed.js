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
    // Original pet types
    { pet_type: 'cat', facts: 'High-protein, grain-free dry or wet food with real meat as the main ingredient', products: 'PurrfectChoice Premium Feline, WhiskerWell Grain-Free Delight, MeowMaster Senior Formula' },
    { pet_type: 'dog', facts: 'Balanced dog food with quality proteins, fats, and carbohydrates', products: 'BarkBite Complete Nutrition, TailWagger Performance Plus, PawsitiveCare Sensitive Blend' },
    { pet_type: 'lizard', facts: 'Insects, leafy greens, and calcium supplements', products: 'ScaleStrong Calcium Boost, CricketCrunch Live Supply, ReptileVitality D3 Formula' },
    { pet_type: 'snake', facts: 'Whole prey (mice/rats) based on size', products: 'SlitherSnack Frozen Mice, CoilCuisine Feeder Rats, SerpentSupreme Multivitamin' },
    { pet_type: 'bird', facts: 'High-quality seeds, pellets, and fresh fruits/veggies', products: 'FeatherFeast Premium Pellets, WingWellness Seed Mix, BeakBoost Cuttlebone Calcium' },
    { pet_type: 'hamster', facts: 'Pellets, grains, fresh vegetables, and occasional fruits', products: 'HamsterHaven Complete Pellets, CheekPouch Gourmet Mix, WhiskerWonder Vitamin Drops' },
    
    // Missing pet types causing 404 errors
    { pet_type: 'puppy', facts: 'High-quality puppy food with DHA for brain development, smaller kibble size', products: 'PuppyPower Growth Formula, SmartStart Puppy Nutrition, GrowStrong Puppy Complete' },
    { pet_type: 'llama', facts: 'Grass hay, pasture grazing, mineral supplements, and limited grain', products: 'LlamaLife Hay Pellets, AndeanGraze Mineral Mix, CamelCare Complete Nutrition' },
    { pet_type: 'rabbit', facts: 'Timothy hay, high-fiber pellets, leafy greens, and limited fruits', products: 'BunnyBest Timothy Pellets, HopHappy Hay Mix, CarrotCrunch Vitamin Treats' },
    { pet_type: 'toucan', facts: 'Low-iron fruit diet, specialized pellets, and occasional insects', products: 'TropicalBeak Fruit Pellets, RainforestNutrition Low-Iron Formula, ExoticBird Complete' },
    { pet_type: 'flying squirrel', facts: 'Insects, nuts, fruits, and specialized glider diet', products: 'GliderGourmet Complete Diet, NutriGlide Protein Mix, SugarFree Glider Treats' }
  ])
    .then(() => logger.info('collection populated'))
    .catch(err => logger.error('error populating collection:', err));
};