import pLimit from 'p-limit';

// Rate limiter for GetBlock.io API (20 requests per second)
export class RateLimiter {
    private limit: ReturnType<typeof pLimit>;
    private requestCount: number = 0;
    private windowStart: number = Date.now();
    private readonly maxRequestsPerSecond: number;

    constructor(maxRequestsPerSecond: number = 20) {
        this.maxRequestsPerSecond = maxRequestsPerSecond;
        this.limit = pLimit(maxRequestsPerSecond);
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return this.limit(async () => {
            // Reset counter if we're in a new second
            const now = Date.now();
            if (now - this.windowStart >= 1000) {
                this.requestCount = 0;
                this.windowStart = now;
            }

            // If we've hit the limit, wait until the next second
            if (this.requestCount >= this.maxRequestsPerSecond) {
                const waitTime = 1000 - (now - this.windowStart);
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                this.requestCount = 0;
                this.windowStart = Date.now();
            }

            this.requestCount++;
            return fn();
        });
    }

    getStats() {
        return {
            requestCount: this.requestCount,
            maxRequestsPerSecond: this.maxRequestsPerSecond,
            windowStart: this.windowStart
        };
    }
}

export const rateLimiter = new RateLimiter(20);
