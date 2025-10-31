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
    { pet_type: 'rabbit', facts: 'High-fiber pellets, hay, and fresh vegetables', products: 'BunnyBest Timothy Pellets, HopHappy Hay Mix, CarrotCrunch Vitamin C' },
    { pet_type: 'chameleon', facts: 'Live insects and calcium/vitamin D3 supplements', products: 'ChameleonChoice Cricket Supply, ColorChange Calcium Plus, ReptileRainbow UVB Support' },
    { pet_type: 'chinchilla', facts: 'High-fiber pellets and timothy hay', products: 'ChinChamp Premium Pellets, DustBath Delight, SoftFur Timothy Hay' },
    { pet_type: 'bearded dragon', facts: 'Insects, leafy greens, and calcium supplements', products: 'DragonDine Cricket Mix, BeardBoost Calcium, ScaleShine Multivitamin' },
    { pet_type: 'guinea pig', facts: 'Vitamin C-rich pellets, hay, and fresh vegetables', products: 'PiggyPerfect Vitamin C Pellets, GuineaGreen Timothy Hay, WheekyWell Veggie Mix' },
    { pet_type: 'ferret', facts: 'High-protein, low-carb diet with quality meat', products: 'FerretFeast High-Protein, WhiskerWild Raw Diet, PlayfulPaws Premium Kibble' },
    { pet_type: 'turtle', facts: 'Aquatic plants, insects, and calcium supplements', products: 'ShellStrong Calcium, TurtleTreat Aquatic Plants, PondPal Vitamin D3' },
    { pet_type: 'parrot', facts: 'High-quality pellets, nuts, and fresh fruits', products: 'ParrotPrime Pellets, BeakBest Nut Mix, TropicalTreat Fruit Blend' },
    { pet_type: 'iguana', facts: 'Leafy greens, vegetables, and calcium supplements', products: 'IguanaIdeal Greens Mix, ScaleSupreme Calcium, ReptileRich Multivitamin' }
  ])
    .then(() => logger.info('collection populated'))
    .catch(err => logger.error('error populating collection:', err));
};