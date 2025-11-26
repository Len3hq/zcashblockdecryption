# Fallback Endpoint Strategy for Zcash Block Scanner

## Current Issue
The project currently relies on a single RPC endpoint (GetBlock.io) for fetching blockchain data. When this endpoint fails or returns errors (like the 500 errors seen with `getrawtransaction`), the entire scanning process is affected.

## Recommendation: Implement Fallback Endpoints

### Why Fallback Endpoints Are Important

1. **Reliability**: Single point of failure is eliminated
2. **Availability**: If one provider has downtime, others can take over
3. **Rate Limiting**: Distribute load across multiple providers
4. **Cost Optimization**: Use free tiers or cheaper providers as fallbacks
5. **Performance**: Route to faster providers based on latency

### Available Zcash RPC Providers

#### Primary Provider (Current)
- **GetBlock.io**
  - Endpoint: `https://go.getblock.io/<API_KEY>`
  - Pros: Reliable, good documentation
  - Cons: Rate limits, cost per request
  - Status: Currently configured

#### Recommended Fallback Providers

1. **Zcash Foundation Public Nodes**
   - Endpoint: Custom (requires running own node or finding public nodes)
   - Pros: Free, official
   - Cons: May be slower, need to find reliable public nodes
   - Setup: Contact Zcash community for public node endpoints

2. **BlockCypher** (if they support Zcash)
   - Endpoint: `https://api.blockcypher.com/v1/zec/main`
   - Pros: Free tier available, REST API
   - Cons: Limited to REST API (not JSON-RPC)
   - Note: API structure differs from JSON-RPC

3. **QuickNode** (if configured for Zcash)
   - Endpoint: `https://<your-endpoint>.quiknode.pro/<API_KEY>`
   - Pros: High reliability, fast
   - Cons: Premium pricing
   - Setup: Requires account creation

4. **Self-Hosted Zcash Node**
   - Endpoint: `http://localhost:8232` (default)
   - Pros: Full control, no rate limits, no cost after setup
   - Cons: Requires hardware, maintenance, initial sync time (~100GB+)
   - Setup: Install `zcashd` daemon

### Implementation Strategy

#### Phase 1: Configuration (RECOMMENDED)

Add multiple endpoints to `.env`:

```bash
# Primary endpoint
GETBLOCK_ENDPOINT=https://go.getblock.io/b096873241314399992d954741f3f7ad

# Fallback endpoints (comma-separated)
FALLBACK_ENDPOINTS=https://your-quicknode-endpoint.pro/abc123,http://localhost:8232

# Timeout before trying fallback (ms)
RPC_TIMEOUT=10000

# Max retries per endpoint
MAX_RETRIES_PER_ENDPOINT=2
```

#### Phase 2: Code Implementation

Create a new file `src/services/multi-provider-client.ts`:

```typescript
import { GetBlockClient } from './getblock-client';
import { logger } from '../utils/logger';
import { CacheService } from './cache';

export class MultiProviderClient {
    private providers: GetBlockClient[];
    private currentProviderIndex: number = 0;
    
    constructor(endpoints: string[], cache: CacheService) {
        this.providers = endpoints.map(
            endpoint => new GetBlockClient(endpoint, cache)
        );
        
        if (this.providers.length === 0) {
            throw new Error('At least one RPC endpoint must be configured');
        }
        
        logger.info(`Initialized ${this.providers.length} RPC provider(s)`);
    }
    
    private async executeWithFallback<T>(
        operation: (client: GetBlockClient) => Promise<T>
    ): Promise<T> {
        let lastError: any;
        
        // Try all providers in round-robin fashion
        for (let i = 0; i < this.providers.length; i++) {
            const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
            const provider = this.providers[providerIndex];
            
            try {
                const result = await operation(provider);
                
                // Success! Update current provider for next call
                this.currentProviderIndex = providerIndex;
                
                if (i > 0) {
                    logger.info(`Successfully failed over to provider ${providerIndex + 1}`);
                }
                
                return result;
            } catch (error: any) {
                lastError = error;
                logger.warn(
                    `Provider ${providerIndex + 1} failed: ${error.message}. ` +
                    `Trying next provider...`
                );
            }
        }
        
        logger.error('All RPC providers failed');
        throw new Error(
            `All ${this.providers.length} RPC providers failed. ` +
            `Last error: ${lastError.message}`
        );
    }
    
    async getBlockHash(height: number): Promise<string> {
        return this.executeWithFallback(
            client => client.getBlockHash(height)
        );
    }
    
    async getBlock(hash: string) {
        return this.executeWithFallback(
            client => client.getBlock(hash)
        );
    }
    
    async getRawTransaction(txid: string): Promise<string> {
        return this.executeWithFallback(
            client => client.getRawTransaction(txid)
        );
    }
    
    async getBlockTransactions(height: number) {
        return this.executeWithFallback(
            client => client.getBlockTransactions(height)
        );
    }
}
```

#### Phase 3: Update Service Initialization

Modify `src/services/getblock-client.ts` to use multi-provider:

```typescript
// Add at the end of the file
export function createMultiProviderClient(cache: CacheService): MultiProviderClient {
    const endpoints = [process.env.GETBLOCK_ENDPOINT];
    
    // Add fallback endpoints if configured
    const fallbacks = process.env.FALLBACK_ENDPOINTS?.split(',').map(e => e.trim()) || [];
    endpoints.push(...fallbacks.filter(e => e.length > 0));
    
    return new MultiProviderClient(endpoints, cache);
}
```

#### Phase 4: Update Routes

Modify `src/routes/scan.ts` to use the multi-provider client instead of single client.

### Quick Win: Self-Hosted Node

For maximum reliability without additional API costs:

1. **Install Zcash daemon**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install zcash
   
   # Or build from source
   git clone https://github.com/zcash/zcash.git
   cd zcash
   ./zcutil/build.sh
   ```

2. **Configure `zcash.conf`**:
   ```conf
   # Enable RPC server
   server=1
   rpcuser=your_username
   rpcpassword=your_secure_password
   rpcport=8232
   rpcallowip=127.0.0.1
   
   # Enable transaction index for getrawtransaction
   txindex=1
   ```

3. **Start daemon and sync**:
   ```bash
   zcashd -daemon
   
   # Monitor sync progress
   zcash-cli getblockchaininfo
   ```

4. **Update `.env`**:
   ```bash
   FALLBACK_ENDPOINTS=http://your_username:your_secure_password@localhost:8232
   ```

### Testing Fallback Implementation

Create a test script `test_fallback.sh`:

```bash
#!/bin/bash

echo "Testing primary endpoint..."
curl -X POST http://localhost:3005/scan \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [3148327],
    "ufvk": "uview1test..."
  }'

echo "\n\nNow disable primary endpoint and test fallback..."
echo "(Manually update .env to use invalid primary endpoint)"
```

## Current Status

✅ **Fixed**: The immediate issue with `getrawtransaction` passing 3 parameters has been resolved
✅ **Implemented**: Retry logic with exponential backoff for transient failures
⚠️ **Recommended**: Implement multi-provider fallback system as described above
⚠️ **Recommended**: Set up self-hosted Zcash node for ultimate reliability

## Summary

**For immediate deployment**: The bug fix (removing the third parameter) resolves the current 500 errors.

**For production resilience**: Implementing fallback endpoints is highly recommended to ensure:
- 99.9%+ uptime
- No single point of failure
- Cost optimization
- Better user experience

**Priority**: Medium-High (should be implemented before production launch)
