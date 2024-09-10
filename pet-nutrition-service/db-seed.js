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
    { pet_type: 'cat', facts: 'High-protein, grain-free dry or wet food with real meat as the main ingredient' },
    { pet_type: 'dog', facts: 'Balanced dog food with quality proteins, fats, and carbohydrates' },
    { pet_type: 'lizard', facts: 'Insects, leafy greens, and calcium supplements' },
    { pet_type: 'snake', facts: 'Whole prey (mice/rats) based on size' },
    { pet_type: 'bird', facts: 'High-quality seeds, pellets, and fresh fruits/veggies' },
    { pet_type: 'hamster', facts: 'Pellets, grains, fresh vegetables, and occasional fruits' }
  ])
    .then(() => logger.info('collection populated'))
    .catch(err => logger.error('error populating collection:', err));
};
