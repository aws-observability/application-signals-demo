require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

main().catch(err => console.log(err));

async function main () {
  const app = express();

  // Middlware
  app.use(logger());
  app.use(express.json());

  // GET: Find a NutritionFact by pet_type
  app.get('/nutrition/:pet_type', async (req, res) => {
    try {
      const { pet_type } = req.params;
      const fact = await NutritionFact.findOne({ pet_type }).maxTimeMS(5000);
      if (!fact) {
        return res.status(404).json({ message: 'nutrition fact not found for the given pet_type' });
      }
      res.status(200).json(fact);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ message: 'failed to fetch nutrition fact', error: error.message });
    }
  });

  // GET: Fetch all NutritionFacts
  app.get('/nutrition', async (req, res) => {
    try {
      const facts = await NutritionFact.find().maxTimeMS(5000);
      res.status(200).json(facts);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ message: 'Failed to fetch nutrition facts', error: error.message });
    }
  });

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/'
  
  // Configure mongoose with connection pooling and timeouts
  mongoose.set('maxPoolSize', 10);
  mongoose.set('serverSelectionTimeoutMS', 5000);
  mongoose.set('socketTimeoutMS', 45000);
  mongoose.set('bufferMaxEntries', 0);
  
  await mongoose.connect(MONGO_URI);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    require('./eureka-client')('nutrition-service', PORT);
    require('./db-seed')();
    console.log(`server running on port ${PORT}`);
  });
}