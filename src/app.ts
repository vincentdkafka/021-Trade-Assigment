import express, { Application } from 'express';
import compression from 'compression';
import { 
  securityHeaders, 
  corsOptions, 
  apiRateLimit,
  rewardCreationRateLimit,
  requestLogger, 
  sanitizeRequest,
  healthCheck,
  apiKeyAuth
} from '@/middleware/security';
import { errorHandler, notFoundHandler } from '@/middleware/error';
import { validateRequest, validateUUID, schemas } from '@/middleware/validation';
import rewardController from '@/controllers/reward';
import logger from '@/utils/logger';
import config from '@/utils/config';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy (important for rate limiting and logging behind reverse proxy)
  app.set('trust proxy', 1);

  // Security middleware (applied to all routes)
  app.use(securityHeaders);
  app.use(corsOptions);
  app.use(compression()); // Gzip compression
  app.use(express.json({ limit: '10mb' })); // Increase limit for large payloads
  app.use(express.urlencoded({ extended: true }));

  // Request sanitization and logging
  app.use(sanitizeRequest);
  app.use(requestLogger);

  // Apply general rate limiting to all API routes
  app.use('/api', apiRateLimit);

  // Health check endpoint (no authentication required)
  app.get('/health', healthCheck);

  // API Routes with authentication and validation

  // POST /reward - Create a new stock reward
  app.post('/reward',
    rewardCreationRateLimit, // Stricter rate limiting for reward creation
    apiKeyAuth, // Authentication
    validateRequest(schemas.rewardRequest, 'body'), // Request validation
    rewardController.createReward
  );

  // GET /today-stocks/:userId - Get today's rewards for a user
  app.get('/today-stocks/:userId',
    apiKeyAuth,
    validateUUID('userId'),
    rewardController.getTodayStocks
  );

  // GET /historical-inr/:userId - Get historical portfolio values
  app.get('/historical-inr/:userId',
    apiKeyAuth,
    validateUUID('userId'),
    rewardController.getHistoricalInr
  );

  // GET /stats/:userId - Get user statistics
  app.get('/stats/:userId',
    apiKeyAuth,
    validateUUID('userId'),
    rewardController.getStats
  );

  // GET /portfolio/:userId - Get user portfolio (bonus endpoint)
  app.get('/portfolio/:userId',
    apiKeyAuth,
    validateUUID('userId'),
    rewardController.getPortfolio
  );

  // API documentation endpoint (development only)
  if (config.nodeEnv === 'development') {
    app.get('/api-docs', (req, res) => {
      res.json({
        title: 'Stocky API Documentation',
        version: '1.0.0',
        description: 'Production-ready REST API for Stocky stock rewards platform',
        endpoints: [
          {
            method: 'POST',
            path: '/reward',
            description: 'Record that a user has been rewarded X shares of a stock',
            requestBody: {
              userId: 'UUID - User identifier',
              stockSymbol: 'string - Stock symbol (e.g., RELIANCE)',
              quantity: 'number - Number of shares (up to 6 decimal places)',
              timestamp: 'ISO date - When the reward was issued',
              eventRef: 'string - Unique event reference for idempotency'
            }
          },
          {
            method: 'GET',
            path: '/today-stocks/:userId',
            description: 'Fetch all rewards for the user today'
          },
          {
            method: 'GET',
            path: '/historical-inr/:userId',
            description: 'Fetch INR valuations of stock rewards by day (excluding today)'
          },
          {
            method: 'GET',
            path: '/stats/:userId',
            description: 'Get user statistics including today\'s totals and current portfolio value'
          },
          {
            method: 'GET',
            path: '/portfolio/:userId',
            description: 'List holdings per stock symbol with current INR value'
          }
        ],
        authentication: {
          type: 'API Key',
          header: 'X-API-Key',
          note: 'Required in production, optional in development'
        },
        rateLimits: {
          general: `${config.rateLimitMaxRequests} requests per ${config.rateLimitWindowMs / 1000 / 60} minutes`,
          rewardCreation: '10 requests per minute per IP+userId combination'
        }
      });
    });
  }

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last middleware)
  app.use(errorHandler);

  return app;
}

export default createApp;
