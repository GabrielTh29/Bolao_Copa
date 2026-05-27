import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

// Create Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Rate limiters for different endpoints
export const rateLimiters = {
  // General API: 60 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
    prefix: "ratelimit:api",
  }),
  
  // Auth endpoints (login/join): 10 requests per minute to prevent brute force
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),
  
  // Predictions: 30 requests per minute
  predictions: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:predictions",
  }),
  
  // Sync endpoint: 5 requests per minute (heavy operation)
  sync: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:sync",
  }),
}

export type RateLimiterType = keyof typeof rateLimiters

/**
 * Check rate limit for a given identifier
 * @param identifier - Usually IP address or user ID
 * @param type - Type of rate limiter to use
 * @returns Object with success status and response if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimiterType = "api"
): Promise<{ success: boolean; response?: NextResponse }> {
  try {
    const limiter = rateLimiters[type]
    const { success, limit, reset, remaining } = await limiter.limit(identifier)

    if (!success) {
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: "Muitas requisicoes. Tente novamente mais tarde.",
            retryAfter: Math.ceil((reset - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
              "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
            }
          }
        ),
      }
    }

    return { success: true }
  } catch (error) {
    // If Redis is unavailable, allow the request but log the error
    console.error("[Rate Limit] Redis error:", error)
    return { success: true }
  }
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : "anonymous"
  return ip
}
