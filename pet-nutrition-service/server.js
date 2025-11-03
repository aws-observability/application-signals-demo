require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

async function connectWithRetry() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nutrition';
  const maxRetries = 5;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        bufferCommands: false,
        bufferMaxEntries: 0
      });
      console.log('Connected to MongoDB successfully');
      return;
    } catch (error) {
      retries++;
      console.error(`MongoDB connection attempt ${retries} failed:`, error.message);
      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
}

async function main () {
  const app = express();

  // Middleware
  app.use(logger());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        res.status(200).json({ status: 'healthy', database: 'connected' });
      } else {
        res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
      }
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', database: 'error', error: error.message });
    }
  });

  // GET: Find a NutritionFact by pet_type
  app.get('/nutrition/:pet_type', async (req, res) => {
    try {
      const { pet_type } = req.params;
      
      // Validate input
      if (!pet_type || typeof pet_type !== 'string') {
        return res.status(400).json({ message: 'Invalid pet_type parameter' });
      }

      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database connection unavailable' });
      }

      const fact = await NutritionFact.findOne({ pet_type: pet_type.toLowerCase() }).lean();
      
      if (!fact) {
        return res.status(404).json({ 
          message: `Nutrition information not found for pet type: ${pet_type}`,
          available_types: ['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster']
        });
      }
      
      res.status(200).json(fact);
    } catch (error) {
      req.log.error({ error: error.message, stack: error.stack }, 'Error fetching nutrition fact');
      
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        res.status(503).json({ message: 'Database service temporarily unavailable' });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // GET: Fetch all NutritionFacts
  app.get('/nutrition', async (req, res) => {
    try {
      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database connection unavailable' });
      }

      const facts = await NutritionFact.find().lean();
      res.status(200).json(facts);
    } catch (error) {
      req.log.error({ error: error.message, stack: error.stack }, 'Error fetching all nutrition facts');
      
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        res.status(503).json({ message: 'Database service temporarily unavailable' });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Connect to MongoDB with retry logic
  await connectWithRetry();

  // Handle MongoDB connection events
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    require('./eureka-client')('nutrition-service', PORT);
    require('./db-seed')();
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}