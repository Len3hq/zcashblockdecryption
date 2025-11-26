import { GetBlockClient } from './getblock-client';
import { logger } from '../utils/logger';
import { CacheService } from './cache';
import { BlockData } from '../types';

/**
 * Multi-provider client that supports automatic failover between multiple RPC endpoints.
 * If the primary endpoint fails or hits rate limits, it automatically tries fallback endpoints.
 */
export class MultiProviderClient {
    private providers: GetBlockClient[];
    private currentProviderIndex: number = 0;
    private providerLabels: string[];
    
    constructor(endpoints: string[], cache: CacheService) {
        if (!endpoints || endpoints.length === 0) {
            throw new Error('At least one RPC endpoint must be configured');
        }
        
        // Create a client for each endpoint
        this.providers = endpoints.map(endpoint => new GetBlockClient(endpoint, cache));
        
        // Create labels for logging
        this.providerLabels = endpoints.map((endpoint, idx) => {
            const label = idx === 0 ? 'Primary' : `Fallback ${idx}`;
            // Mask the API key in the endpoint for security
            const maskedEndpoint = endpoint.replace(/([a-f0-9]{8})[a-f0-9]{24,}/gi, '$1...');
            return `${label} (${maskedEndpoint})`;
        });
        
        logger.info(`Initialized multi-provider client with ${this.providers.length} endpoint(s)`);
        this.providerLabels.forEach((label, idx) => {
            logger.info(`  [${idx}] ${label}`);
        });
    }
    
    /**
     * Execute an operation with automatic fallback to other providers on failure.
     */
    private async executeWithFallback<T>(
        operationName: string,
        operation: (client: GetBlockClient) => Promise<T>
    ): Promise<T> {
        let lastError: any;
        const startIndex = this.currentProviderIndex;
        
        // Try all providers, starting with the current one
        for (let i = 0; i < this.providers.length; i++) {
            const providerIndex = (startIndex + i) % this.providers.length;
            const provider = this.providers[providerIndex];
            const providerLabel = this.providerLabels[providerIndex];
            
            try {
                const result = await operation(provider);
                
                // Success! Update current provider for next call
                if (providerIndex !== this.currentProviderIndex) {
                    logger.info(`Successfully failed over to ${providerLabel}`);
                    this.currentProviderIndex = providerIndex;
                }
                
                return result;
            } catch (error: any) {
                lastError = error;
                
                // Determine if this is a rate limit or other retryable error
                const isRateLimit = 
                    error.message?.includes('rate limit') ||
                    error.message?.includes('429') ||
                    error.message?.includes('quota') ||
                    error.response?.status === 429;
                
                const isServerError = 
                    error.response?.status >= 500 && error.response?.status < 600;
                
                const errorType = isRateLimit ? 'Rate limit' : isServerError ? 'Server error' : 'Error';
                
                if (i < this.providers.length - 1) {
                    logger.warn(
                        `${errorType} from ${providerLabel} for ${operationName}: ${error.message}. ` +
                        `Trying next provider...`
                    );
                    
                    // Small delay before trying next provider
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    logger.error(
                        `${errorType} from ${providerLabel} for ${operationName}: ${error.message}`
                    );
                }
            }
        }
        
        // All providers failed
        logger.error(`All ${this.providers.length} RPC provider(s) failed for ${operationName}`);
        throw new Error(
            `All RPC providers failed. Last error: ${lastError.message}`
        );
    }
    
    async getBlockHash(height: number): Promise<string> {
        return this.executeWithFallback(
            `getBlockHash(${height})`,
            client => client.getBlockHash(height)
        );
    }
    
    async getBlock(hash: string): Promise<BlockData> {
        return this.executeWithFallback(
            `getBlock(${hash.substring(0, 16)}...)`,
            client => client.getBlock(hash)
        );
    }
    
    async getRawTransaction(txid: string): Promise<string> {
        return this.executeWithFallback(
            `getRawTransaction(${txid.substring(0, 16)}...)`,
            client => client.getRawTransaction(txid)
        );
    }
    
    async getBlockTransactions(height: number): Promise<{ txid: string; hex: string }[]> {
        return this.executeWithFallback(
            `getBlockTransactions(${height})`,
            client => client.getBlockTransactions(height)
        );
    }
    
    /**
     * Get statistics about provider usage (for monitoring/debugging)
     */
    getStats(): { currentProvider: string; totalProviders: number } {
        return {
            currentProvider: this.providerLabels[this.currentProviderIndex],
            totalProviders: this.providers.length
        };
    }
}

// Singleton instance
let multiProviderInstance: MultiProviderClient | null = null;

/**
 * Get or create the multi-provider client singleton.
 * Reads endpoints from environment variables:
 * - GETBLOCK_ENDPOINT: Primary endpoint (required)
 * - FALLBACK_ENDPOINTS: Comma-separated list of fallback endpoints (optional)
 */
export function getMultiProviderClient(cache: CacheService): MultiProviderClient {
    if (!multiProviderInstance) {
        const primary = process.env.GETBLOCK_ENDPOINT;
        if (!primary) {
            throw new Error('GETBLOCK_ENDPOINT environment variable is not set');
        }
        
        const endpoints = [primary];
        
        // Add fallback endpoints if configured
        const fallbacks = process.env.FALLBACK_ENDPOINTS;
        if (fallbacks && fallbacks.trim().length > 0) {
            const fallbackList = fallbacks
                .split(',')
                .map(e => e.trim())
                .filter(e => e.length > 0);
            
            endpoints.push(...fallbackList);
        }
        
        multiProviderInstance = new MultiProviderClient(endpoints, cache);
    }
    return multiProviderInstance;
}
