require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

let isConnected = false;

// MongoDB connection with retry logic
async function connectWithRetry() {
  const maxRetries = 5;
  const retryDelay = 1000; // Start with 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nutrition';
      await mongoose.connect(MONGO_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log('MongoDB connected successfully');
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
    }
  }
}

main().catch(err => {
  console.error('Application startup failed:', err);
  process.exit(1);
});

async function main() {
  const app = express();

  // Middleware
  app.use(logger());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    const status = isConnected ? 'healthy' : 'unhealthy';
    const statusCode = isConnected ? 200 : 503;
    res.status(statusCode).json({
      status,
      database: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // GET: Find a NutritionFact by pet_type
  app.get('/nutrition/:pet_type', async (req, res) => {
    try {
      if (!isConnected) {
        return res.status(503).json({ 
          message: 'Database connection unavailable',
          error: 'SERVICE_UNAVAILABLE'
        });
      }

      const { pet_type } = req.params;
      
      // Input validation
      if (!pet_type || pet_type.trim() === '') {
        return res.status(400).json({ 
          message: 'Pet type is required',
          error: 'INVALID_INPUT'
        });
      }

      const fact = await NutritionFact.findOne({ pet_type: pet_type.toLowerCase() });
      if (!fact) {
        return res.status(404).json({ 
          message: `No nutrition information found for pet type: ${pet_type}`,
          error: 'NOT_FOUND',
          pet_type
        });
      }
      res.status(200).json(fact);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ 
        message: 'Failed to fetch nutrition information',
        error: 'DATABASE_ERROR',
        details: error.message
      });
    }
  });

  // GET: Fetch all NutritionFacts
  app.get('/nutrition', async (req, res) => {
    try {
      if (!isConnected) {
        return res.status(503).json({ 
          message: 'Database connection unavailable',
          error: 'SERVICE_UNAVAILABLE'
        });
      }

      const facts = await NutritionFact.find();
      res.status(200).json(facts);
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ 
        message: 'Failed to fetch nutrition facts',
        error: 'DATABASE_ERROR',
        details: error.message
      });
    }
  });

  // MongoDB connection monitoring
  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('MongoDB connection established');
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('MongoDB disconnected');
  });

  // Connect to MongoDB with retry logic
  await connectWithRetry();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    require('./eureka-client')('nutrition-service', PORT);
    require('./db-seed')();
    console.log(`Server running on port ${PORT}`);
  });
}