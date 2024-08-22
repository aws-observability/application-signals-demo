const mongoose = require('mongoose');

const NutritionFactSchema = new mongoose.Schema({
  pet_type: { type: String, required: true },
  facts: { type: String, required: true }
});
  

module.exports = mongoose.model('NutritionFact', NutritionFactSchema);

