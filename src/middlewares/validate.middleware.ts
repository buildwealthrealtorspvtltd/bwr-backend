import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export interface ValidationSchema {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        const parsedQuery = (await schema.query.parseAsync(req.query)) as Record<string, unknown>;
        req.query = parsedQuery as unknown as Request['query'];
      }
      if (schema.params) {
        const parsedParams = (await schema.params.parseAsync(req.params)) as Record<
          string,
          unknown
        >;
        req.params = parsedParams as unknown as Request['params'];
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
