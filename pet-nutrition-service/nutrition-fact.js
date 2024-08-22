const mongoose = require('mongoose');

const NutritionFactSchema = new mongoose.Schema({
  pet_id: { type: String, required: true },
  notes: { type: String, required: true }
});
  

module.exports = mongoose.model('NutritionFact', NutritionFactSchema);

