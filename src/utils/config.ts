import dotenv from 'dotenv';
import { AppConfig, DatabaseConfig } from '@/types';

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 */
function validateRequiredEnvVars(): void {
  const required = [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_NAME', 
    'DATABASE_USER',
    'DATABASE_PASSWORD'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Parse and validate database configuration
 */
function getDatabaseConfig(): DatabaseConfig {
  validateRequiredEnvVars();

  return {
    host: process.env.DATABASE_HOST!,
    port: parseInt(process.env.DATABASE_PORT!),
    database: process.env.DATABASE_NAME!,
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    ssl: process.env.NODE_ENV === 'production',
    max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '2000')
  };
}

/**
 * Get complete application configuration
 */
function getAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: getDatabaseConfig(),
    jwtSecret: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
    rateLimitWindowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '1000'),
    stockPriceFetchIntervalHours: parseInt(process.env.STOCK_PRICE_FETCH_INTERVAL_HOURS || '1'),
    logLevel: process.env.LOG_LEVEL || 'info',
    logFilePath: process.env.LOG_FILE_PATH || './logs/app.log'
  };
}

/**
 * Validate configuration on startup
 */
function validateConfig(config: AppConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port number. Must be between 1 and 65535.');
  }

  if (config.database.port < 1 || config.database.port > 65535) {
    throw new Error('Invalid database port number. Must be between 1 and 65535.');
  }

  if (config.stockPriceFetchIntervalHours < 1) {
    throw new Error('Stock price fetch interval must be at least 1 hour.');
  }

  if (config.nodeEnv === 'production' && config.jwtSecret === 'default-secret-key-change-in-production') {
    throw new Error('JWT secret must be changed in production environment.');
  }
}

// Create and validate configuration
const config = getAppConfig();
validateConfig(config);

export default config;
