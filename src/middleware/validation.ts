import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@/types';

/**
 * Validation schemas for API requests
 */
export const schemas = {
  rewardRequest: Joi.object({
    userId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'userId must be a valid UUID',
        'any.required': 'userId is required'
      }),
    
    stockSymbol: Joi.string().alphanum().uppercase().min(1).max(20).required()
      .messages({
        'string.alphanum': 'stockSymbol must contain only alphanumeric characters',
        'string.uppercase': 'stockSymbol must be uppercase',
        'string.min': 'stockSymbol must be at least 1 character long',
        'string.max': 'stockSymbol must not exceed 20 characters',
        'any.required': 'stockSymbol is required'
      }),
    
    quantity: Joi.number().positive().precision(6).required()
      .messages({
        'number.positive': 'quantity must be a positive number',
        'number.precision': 'quantity can have at most 6 decimal places',
        'any.required': 'quantity is required'
      }),
    
    timestamp: Joi.date().iso().max('now').required()
      .messages({
        'date.format': 'timestamp must be in ISO format',
        'date.max': 'timestamp cannot be in the future',
        'any.required': 'timestamp is required'
      }),
    
    eventRef: Joi.string().min(1).max(255).required()
      .messages({
        'string.min': 'eventRef must be at least 1 character long',
        'string.max': 'eventRef must not exceed 255 characters',
        'any.required': 'eventRef is required'
      })
  }),

  userIdParam: Joi.object({
    userId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'userId must be a valid UUID',
        'any.required': 'userId is required'
      })
  })
};

/**
 * Middleware factory for request validation
 */
export function validateRequest(schema: Joi.ObjectSchema, target: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const dataToValidate = req[target];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new ValidationError(errorMessage));
    }

    // Replace the original data with validated and sanitized data
    req[target] = value;
    next();
  };
}

/**
 * Middleware to validate UUID parameters
 */
export function validateUUID(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const paramValue = req.params[paramName];
    
    if (!paramValue) {
      return next(new ValidationError(`${paramName} parameter is required`));
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(paramValue)) {
      return next(new ValidationError(`${paramName} must be a valid UUID`));
    }

    next();
  };
}
