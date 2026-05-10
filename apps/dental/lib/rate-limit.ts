import { NextRequest } from 'next/server';

// Simple in-memory rate limiter (for production use Upstash Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const tokenCount = options.uniqueTokenPerInterval ?? 10; // 10 requests
  const interval = options.interval ?? 60000; // per minute

  return {
    check: async (request: NextRequest, limit?: number, token?: string): Promise<{ success: boolean; remaining: number }> => {
      const requestLimit = limit ?? tokenCount;

      // Get identifier from IP or user token
      const identifier = token ??
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        'anonymous';

      const now = Date.now();
      const tokenData = rateLimitMap.get(identifier) ?? { count: 0, resetTime: now + interval };

      // Reset if interval has passed
      if (now > tokenData.resetTime) {
        tokenData.count = 0;
        tokenData.resetTime = now + interval;
      }

      tokenData.count += 1;
      rateLimitMap.set(identifier, tokenData);

      const remaining = Math.max(requestLimit - tokenData.count, 0);
      const success = tokenData.count <= requestLimit;

      // Clean up old entries periodically
      if (rateLimitMap.size > 1000) {
        const cutoff = now - interval * 2;
        for (const [key, value] of rateLimitMap.entries()) {
          if (value.resetTime < cutoff) {
            rateLimitMap.delete(key);
          }
        }
      }

      return { success, remaining };
    }
  };
}

// Pre-configured rate limiters for different endpoints
export const apiLimiter = rateLimit({
  uniqueTokenPerInterval: 100,  // 100 requests
  interval: 60000                // per minute
});

export const authLimiter = rateLimit({
  uniqueTokenPerInterval: 5,      // 5 attempts
  interval: 300000                // per 5 minutes
});

export const strictLimiter = rateLimit({
  uniqueTokenPerInterval: 10,     // 10 requests
  interval: 60000                 // per minute
});