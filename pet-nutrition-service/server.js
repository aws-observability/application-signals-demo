require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

main().catch(err => console.log(err));

async function main() {
  const app = express();

  // Middlware
  app.use(logger());
  app.use(express.json());

  // POST: Create a new NutritionFact
  app.post('/nutrition', async (req, res) => {
    try {
      const { pet_type, facts } = req.body;
      const newNutritionFact = new NutritionFact({ pet_type, facts });
      const savedFact = await newNutritionFact.save();
      req.log.info(`saved nutrition fact for ${pet_type}`)
      res.status(201).json(savedFact);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ message: 'failed to save nutrition fact', error });
    }
  });

  // GET: Find a NutritionFact by pet_type
  app.get('/nutrition/:pet_type', async (req, res) => {
    try {
      const { pet_type } = req.params;
      const fact = await NutritionFact.findOne({ pet_type });
      if (!fact) {
        return res.status(404).json({ message: 'nutrition fact not found for the given pet_type' });
      }
      res.status(200).json(fact);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ message: 'failed to fetch nutrition fact', error });
    }
  });

  // GET: Fetch all NutritionFacts
  app.get('/nutrition', async (req, res) => {
    try {
      const facts = await NutritionFact.find();
      res.status(200).json(facts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch nutrition facts', error });
    }
  });

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/'
  await mongoose.connect(MONGO_URI);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
}