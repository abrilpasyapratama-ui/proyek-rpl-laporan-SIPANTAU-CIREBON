import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/** Validates req.body against a zod schema and replaces it with parsed data. */
export const validateBody =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };

/** Validates req.query against a zod schema and replaces it with parsed data. */
export const validateQuery =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      Object.defineProperty(req, 'query', { value: parsed, writable: true });
      next();
    } catch (err) {
      next(err);
    }
  };
