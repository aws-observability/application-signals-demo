require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

main().catch(err => console.log(err));

async function main () {
  const app = express();

  // Middleware
  app.use(logger());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // GET: Find a NutritionFact by pet_type with validation
  app.get('/nutrition/:pet_type', async (req, res) => {
    try {
      const { pet_type } = req.params;
      
      // Input validation and sanitization
      if (!pet_type || typeof pet_type !== 'string') {
        return res.status(400).json({ 
          message: 'Invalid pet type provided',
          error: 'Pet type must be a non-empty string'
        });
      }

      const sanitizedPetType = pet_type.toLowerCase().trim();
      
      if (sanitizedPetType.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid pet type provided',
          error: 'Pet type cannot be empty'
        });
      }

      req.log.info({ pet_type: sanitizedPetType }, 'Searching for nutrition facts');
      
      const fact = await NutritionFact.findOne({ pet_type: sanitizedPetType });
      
      if (!fact) {
        req.log.warn({ pet_type: sanitizedPetType }, 'Nutrition fact not found');
        return res.status(404).json({ 
          message: `Nutrition information not available for ${sanitizedPetType}`,
          pet_type: sanitizedPetType,
          available_types: await NutritionFact.distinct('pet_type')
        });
      }
      
      req.log.info({ pet_type: sanitizedPetType }, 'Nutrition fact found successfully');
      res.status(200).json(fact);
    } catch (error) {
      req.log.error({ error: error.message, stack: error.stack }, 'Error fetching nutrition fact');
      res.status(500).json({ 
        message: 'Internal server error while fetching nutrition information',
        error: 'Please try again later or contact support'
      });
    }
  });

  // GET: Fetch all NutritionFacts
  app.get('/nutrition', async (req, res) => {
    try {
      req.log.info('Fetching all nutrition facts');
      const facts = await NutritionFact.find();
      req.log.info({ count: facts.length }, 'Retrieved nutrition facts');
      res.status(200).json(facts);
    } catch (error) {
      req.log.error({ error: error.message, stack: error.stack }, 'Error fetching all nutrition facts');
      res.status(500).json({ 
        message: 'Internal server error while fetching nutrition information',
        error: 'Please try again later or contact support'
      });
    }
  });

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/'
  await mongoose.connect(MONGO_URI);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    require('./eureka-client')('nutrition-service', PORT);
    require('./db-seed')();
    console.log(`server running on port ${PORT}`);
  });
}