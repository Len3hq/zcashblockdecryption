import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { rateLimiter } from './rate-limiter';
import { createCacheService, CacheService } from './cache';
import { JsonRpcRequest, JsonRpcResponse, BlockData, RawTransaction } from '../types';

export class GetBlockClient {
    private axiosInstance: AxiosInstance;
    private cache: CacheService;
    private endpoint: string;

    constructor(endpoint: string, cache: CacheService) {
        this.endpoint = endpoint;
        this.cache = cache;
        this.axiosInstance = axios.create({
            baseURL: endpoint,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    }

    private async rpcCall<T>(method: string, params: any[], retries = 3): Promise<T> {
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id: 'getblock.io'
        };

        return rateLimiter.execute(async () => {
            let lastError: any;
            
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    logger.debug(`RPC call: ${method} (attempt ${attempt + 1}/${retries})`, params);
                    const response = await this.axiosInstance.post<JsonRpcResponse<T>>('', request);

                    if (response.data.error) {
                        const errorMsg = JSON.stringify(response.data.error);
                        logger.error(`RPC error for ${method}: ${errorMsg}`);
                        throw new Error(`RPC error: ${errorMsg}`);
                    }

                    return response.data.result;
                } catch (error: any) {
                    lastError = error;
                    
                    // Check if it's a network error or 5xx error that might benefit from retry
                    const isRetryable = 
                        !error.response || 
                        (error.response?.status >= 500 && error.response?.status < 600) ||
                        error.code === 'ECONNRESET' ||
                        error.code === 'ETIMEDOUT' ||
                        error.code === 'ENOTFOUND';
                    
                    if (attempt < retries - 1 && isRetryable) {
                        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                        logger.warn(`Retrying ${method} after ${delay}ms due to: ${error.message}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    logger.error(`RPC call failed for ${method} after ${attempt + 1} attempts:`, error.message);
                    break;
                }
            }
            
            throw lastError;
        });
    }

    async getBlockHash(height: number): Promise<string> {
        // Check cache first
        const cached = await this.cache.getBlockHash(height);
        if (cached) {
            logger.debug(`Cache hit for block hash at height ${height}`);
            return cached;
        }

        // Fetch from API
        logger.info(`Fetching block hash for height ${height}`);
        const hash = await this.rpcCall<string>('getblockhash', [height]);

        // Cache the result
        await this.cache.setBlockHash(height, hash);

        return hash;
    }

    async getBlock(hash: string): Promise<BlockData> {
        // Check cache first
        const cached = await this.cache.getBlock(hash);
        if (cached) {
            logger.debug(`Cache hit for block ${hash}`);
            return cached;
        }

        // Fetch from API (verbosity = 1 for JSON with tx IDs)
        logger.info(`Fetching block data for ${hash}`);
        const blockData = await this.rpcCall<BlockData>('getblock', [hash, 1]);

        // Cache the result
        await this.cache.setBlock(hash, blockData);

        return blockData;
    }

    async getRawTransaction(txid: string): Promise<string> {
        // Check cache first
        const cached = await this.cache.getRawTx(txid);
        if (cached) {
            logger.debug(`Cache hit for raw tx ${txid}`);
            return cached;
        }

        // Fetch from API (verbose = 1 to get JSON with hex field)
        logger.info(`Fetching raw transaction ${txid}`);
        const txData = await this.rpcCall<RawTransaction>('getrawtransaction', [txid, 1]);

        // Cache the hex
        await this.cache.setRawTx(txid, txData.hex);

        return txData.hex;
    }

    async getBlockTransactions(height: number): Promise<{ txid: string; hex: string }[]> {
        // Get block hash
        const hash = await this.getBlockHash(height);

        // Get block data
        const block = await this.getBlock(hash);

        // Fetch all raw transactions
        const transactions = await Promise.all(
            block.tx.map(async (txid) => {
                const hex = await this.getRawTransaction(txid);
                return { txid, hex };
            })
        );

        return transactions;
    }
}

// Singleton instance
let clientInstance: GetBlockClient | null = null;

export function getGetBlockClient(cache: CacheService): GetBlockClient {
    if (!clientInstance) {
        const endpoint = process.env.GETBLOCK_ENDPOINT;
        if (!endpoint) {
            throw new Error('GETBLOCK_ENDPOINT environment variable is not set');
        }
        clientInstance = new GetBlockClient(endpoint, cache);
    }
    return clientInstance;
}
