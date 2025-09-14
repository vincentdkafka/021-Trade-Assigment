import { createApp } from './app';
import database from '@/database/connection';
import stockPriceService from '@/services/stock-price';
import logger from '@/utils/logger';
import config from '@/utils/config';

/**
 * Main server entry point
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Stocky API Server...', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      logLevel: config.logLevel
    });

    // Initialize database connection
    logger.info('Initializing database connection...');
    await database.initialize(config.database);
    
    // Verify database health
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database health check failed');
    }
    logger.info('Database connection verified successfully');

    // Start stock price service
    logger.info('Starting stock price service...');
    stockPriceService.start();

    // Create Express application
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Stocky API Server running on port ${config.port}`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        pid: process.pid,
        version: process.env.npm_package_version || '1.0.0'
      });

      // Log available endpoints in development
      if (config.nodeEnv === 'development') {
        const baseUrl = `http://localhost:${config.port}`;
        logger.info('Available endpoints:', {
          health: `${baseUrl}/health`,
          docs: `${baseUrl}/api-docs`,
          reward: `${baseUrl}/reward`,
          todayStocks: `${baseUrl}/today-stocks/:userId`,
          historicalInr: `${baseUrl}/historical-inr/:userId`,
          stats: `${baseUrl}/stats/:userId`,
          portfolio: `${baseUrl}/portfolio/:userId`
        });
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Stop stock price service
        stockPriceService.stop();
        
        // Close database connections
        await database.close();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection:', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start the server
startServer();

export { startServer };
