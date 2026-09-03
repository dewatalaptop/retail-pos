import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward a rejected promise from an `async` route handler
 * to the error middleware on its own — an uncaught rejection there just hangs
 * the request forever instead of responding. Wrap any handler that awaits
 * something (e.g. `notifyDbChanged()`) with this so failures still reach
 * `app.ts`'s error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
