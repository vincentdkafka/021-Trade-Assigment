import { Request, Response, NextFunction } from 'express';
import { StockyError, ValidationError, NotFoundError, ConflictError } from '@/types';
import logger from '@/utils/logger';
import config from '@/utils/config';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });


  if (error instanceof StockyError) {
    res.status(error.statusCode).json({
      status: 'error',
      error: {
        code: error.code,
        message: error.message,
        ...(config.nodeEnv === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });
    return;
  }

  if (error.name === 'QueryFailedError' || (error as any).code) {
    const pgError = error as any;
    let statusCode = 500;
    let message = 'Database error occurred';

  
    switch (pgError.code) {
      case '23505': // unique violation
        statusCode = 409;
        message = 'Resource already exists';
        break;
      case '23503': // foreign key violation
        statusCode = 400;
        message = 'Referenced resource does not exist';
        break;
      case '23502': // not null violation
        statusCode = 400;
        message = 'Required field is missing';
        break;
      case '23514': // check violation
        statusCode = 400;
        message = 'Invalid data provided';
        break;
      case '42P01': // undefined table
        statusCode = 500;
        message = 'Database configuration error';
        break;
    }

    res.status(statusCode).json({
      status: 'error',
      error: {
        code: 'DATABASE_ERROR',
        message,
        ...(config.nodeEnv === 'development' && { 
          details: pgError.detail,
          constraint: pgError.constraint
        })
      },
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });
    return;
  }

  if (error.name === 'ValidationError') {
    res.status(400).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message
      },
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });
    return;
  }

  if (error instanceof SyntaxError && (error as any).status === 400 && 'body' in error) {
    res.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body'
      },
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });
    return;
  }

  
  if ((error as any).status === 404) {
    res.status(404).json({
      status: 'error',
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found'
      },
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    });
    return;
  }


  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.nodeEnv === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      ...(config.nodeEnv === 'development' && { stack: error.stack })
    },
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  });
}


export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    status: 'error',
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  });
}


function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
