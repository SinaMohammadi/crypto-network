import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 60
});

export const rateLimiterMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        await rateLimiter.consume(req.ip || 'unknown');
        next();
    } catch (rejRes: any) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(secs));
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: secs
        });
    }
};

export { rateLimiterMiddleware as rateLimiter };