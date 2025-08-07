require('dotenv').config();

const { trace } = require('@opentelemetry/api');
const express = require('express');
const mongoose = require('mongoose');
const logger = require('pino-http');
const NutritionFact = require('./nutrition-fact')

// Utility function to add code location attributes to the current span
function addCodeLocationAttributes() {
  const span = trace.getActiveSpan();
  if (span) {
    // Get caller information from stack trace
    const stack = new Error().stack;
    const stackLines = stack.split('\n');
    
    // Find the caller (skip this function and get the actual caller)
    let callerLine = '';
    for (let i = 2; i < stackLines.length; i++) {
      if (stackLines[i].includes('server.js')) {
        callerLine = stackLines[i];
        break;
      }
    }
    
    // Extract file name and line number from stack trace
    const match = callerLine.match(/\/([^\/]+\.js):(\d+):\d+/);
    if (match) {
      const fileName = match[1];
      const lineNumber = parseInt(match[2]);
      
      // Create a more descriptive function name based on line number
      let functionName = `server.js:${lineNumber}`;
      
      span.setAttributes({
        'code.file.path': fileName,
        'code.line.number': lineNumber,
        'code.function.name': functionName
      });
    }
  }
}

main().catch(err => console.log(err));

async function main () {
  const app = express();

  // Middlware
  app.use(logger());
  app.use(express.json());

  // GET: Find a NutritionFact by pet_type
  app.get('/nutrition/:pet_type', async (req, res) => {
    addCodeLocationAttributes();
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
    addCodeLocationAttributes();
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
    require('./eureka-client')('nutrition-service', PORT);
    require('./db-seed')();
    console.log(`server running on port ${PORT}`);
  });
}
