import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import config from '@/utils/config';
import logger from '@/utils/logger';


export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, 
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});


export const corsOptions = cors({
  origin: function (origin, callback) {
    // In production, specify allowed origins
    if (config.nodeEnv === 'production') {
      // Add your allowed origins here
      const allowedOrigins = [
        'https://stocky.com',
        'https://app.stocky.com',
        'https://admin.stocky.com'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Allow all origins in development
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
});

/**
 * General API rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs, // 15 minutes by default
  max: config.rateLimitMaxRequests, // 1000 requests per windowMs by default
  message: {
    status: 'error',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      status: 'error',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Stricter rate limiting for reward creation endpoint
 */
export const rewardCreationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 reward creations per minute
  message: {
    status: 'error',
    error: {
      code: 'REWARD_CREATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many reward creation attempts, please slow down.'
    },
    timestamp: new Date().toISOString()
  },
  keyGenerator: (req: Request) => {
    // Rate limit by IP and userId combination for reward creation
    return `${req.ip}-${req.body?.userId || 'anonymous'}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Reward creation rate limit exceeded', {
      ip: req.ip,
      userId: req.body?.userId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      status: 'error',
      error: {
        code: 'REWARD_CREATION_RATE_LIMIT_EXCEEDED',
        message: 'Too many reward creation attempts, please slow down.'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.originalUrl} - Request started`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    ...(req.method === 'POST' && { bodySize: JSON.stringify(req.body).length })
  });

  // Override res.end to log response
  const originalSend = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - start;
    
    // Log response
    (logger as any).logRequest(req, res, duration);
    
    return originalSend.call(this, body);
  };

  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Remove potentially dangerous properties
  if (req.body) {
    // Remove any __proto__ or constructor properties
    delete req.body.__proto__;
    delete req.body.constructor;
    delete req.body.prototype;
    
    // Recursively clean nested objects
    req.body = sanitizeObject(req.body);
  }
  
  next();
}


function sanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous properties
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
}

export function healthCheck(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
}


export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.get('X-API-Key');
  
  // Skip auth for health checks
  if (req.path === '/health') {
    return next();
  }
  
  // In development, skip auth or use a simple key
  if (config.nodeEnv === 'development') {
    return next();
  }
  
  // In production, implement proper authentication
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn('Unauthorized API access attempt', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      providedKey: apiKey ? 'provided' : 'missing'
    });
    
    return res.status(401).json({
      status: 'error',
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid API key is required'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}
