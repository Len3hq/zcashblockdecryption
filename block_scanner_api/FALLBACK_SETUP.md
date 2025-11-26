# Fallback RPC Endpoints Setup Guide

## Overview

The Zcash Block Scanner now supports multiple RPC endpoints with automatic failover. If the primary endpoint fails, hits rate limits, or becomes unavailable, the system automatically switches to fallback endpoints.

## How It Works

1. **Primary Endpoint**: Configured via `GETBLOCK_ENDPOINT` (required)
2. **Fallback Endpoints**: Configured via `FALLBACK_ENDPOINTS` (optional, comma-separated)
3. **Automatic Failover**: If any request fails, the system immediately tries the next endpoint
4. **Smart Recovery**: Once a working endpoint is found, it becomes the current provider
5. **Rate Limit Detection**: Automatically detects rate limit errors (429, quota messages) and fails over

## Configuration

### Basic Setup (Single Endpoint)

```bash
# .env file
GETBLOCK_ENDPOINT=https://go.getblock.io/your-api-key-here
FALLBACK_ENDPOINTS=
```

### Recommended Setup (Multiple Endpoints)

```bash
# .env file
GETBLOCK_ENDPOINT=https://go.getblock.io/your-primary-key
FALLBACK_ENDPOINTS=https://go.getblock.io/your-secondary-key,https://another-provider.com/zec-rpc
```

### Advanced Setup (With Self-Hosted Node)

```bash
# .env file
GETBLOCK_ENDPOINT=https://go.getblock.io/your-api-key
FALLBACK_ENDPOINTS=http://localhost:8232,https://backup-provider.com/zec
```

## Available RPC Providers

### 1. GetBlock.io (Multiple Accounts)
**Best for**: Immediate setup, reliable service

- Create multiple GetBlock.io accounts (free tier available)
- Each account gets its own API key and rate limit
- Use different keys as primary and fallback

```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/account1-key
FALLBACK_ENDPOINTS=https://go.getblock.io/account2-key,https://go.getblock.io/account3-key
```

### 2. QuickNode
**Best for**: High performance, low latency

- Sign up at https://www.quicknode.com/
- Create a Zcash mainnet endpoint
- Copy the endpoint URL

```bash
FALLBACK_ENDPOINTS=https://your-name-123456.zec.quiknode.pro/your-token/
```

### 3. Self-Hosted Zcash Node
**Best for**: No rate limits, ultimate reliability

#### Setup Steps:

1. **Install Zcash daemon**:
```bash
# Ubuntu/Debian
wget https://z.cash/downloads/zcash-latest-linux64.tar.gz
tar -xvf zcash-latest-linux64.tar.gz
sudo cp zcash-*/bin/* /usr/local/bin/
```

2. **Create configuration file** (`~/.zcash/zcash.conf`):
```conf
# Enable RPC server
server=1
rpcuser=your_username
rpcpassword=your_secure_password
rpcport=8232
rpcallowip=127.0.0.1

# Enable transaction index (required for getrawtransaction)
txindex=1

# Optional: limit memory usage
dbcache=450
```

3. **Start the daemon**:
```bash
zcashd -daemon
```

4. **Wait for sync** (this will take several hours/days):
```bash
# Check sync progress
zcash-cli getblockchaininfo
```

5. **Configure in .env**:
```bash
FALLBACK_ENDPOINTS=http://your_username:your_secure_password@localhost:8232
```

### 4. NowNodes
**Best for**: Easy setup, free tier

- Sign up at https://nownodes.io/
- Get API key
- Use Zcash endpoint

```bash
FALLBACK_ENDPOINTS=https://zec.nownodes.io/your-api-key
```

## Testing Your Configuration

### Test with curl:
```bash
# Test primary endpoint
curl -X POST $GETBLOCK_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":"test"}'

# Test fallback endpoint
curl -X POST "https://your-fallback-endpoint" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":"test"}'
```

### Test with the API:
```bash
# Start the server
npm run dev

# Make a scan request
curl -X POST http://localhost:3005/scan \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [3148327],
    "ufvk": "your-ufvk-here"
  }'
```

Watch the server logs for:
- `Initialized multi-provider client with X endpoint(s)`
- If primary fails: `Rate limit from Primary (...). Trying next provider...`
- If fallback succeeds: `Successfully failed over to Fallback 1 (...)`

## Failover Behavior

### What Triggers Failover?
- HTTP 429 (Too Many Requests)
- HTTP 5xx (Server Errors)
- Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
- Rate limit messages in error responses

### What Doesn't Trigger Failover?
- HTTP 4xx errors (except 429) - these are request errors, not provider issues
- RPC errors (invalid params, etc.) - these would fail on all providers

### Failover Flow:
```
Request → Primary Endpoint
  ↓ (fails)
  Retry Primary (up to 3 times with backoff)
  ↓ (still fails)
  Try Fallback 1
  ↓ (fails)
  Try Fallback 2
  ↓ (succeeds)
  Use Fallback 2 for subsequent requests
```

## Cost Optimization

### Strategy 1: Free Tier Rotation
Use multiple free-tier accounts from the same provider:
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/free-account-1
FALLBACK_ENDPOINTS=https://go.getblock.io/free-account-2,https://go.getblock.io/free-account-3
```

### Strategy 2: Primary + Self-Hosted
Use paid provider as primary, self-hosted as unlimited fallback:
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/paid-account
FALLBACK_ENDPOINTS=http://localhost:8232
```

### Strategy 3: Multi-Provider Mix
Mix different providers for best reliability:
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/key1
FALLBACK_ENDPOINTS=https://quicknode.com/endpoint,http://localhost:8232
```

## Monitoring

The multi-provider client logs all failover events:
- `[INFO] Initialized multi-provider client with X endpoint(s)`
- `[WARN] Rate limit from Primary (...). Trying next provider...`
- `[INFO] Successfully failed over to Fallback 1 (...)`
- `[ERROR] All X RPC provider(s) failed for operation`

Monitor these logs to:
- Detect when primary is frequently failing
- Identify which providers are most reliable
- Alert when all providers are failing

## Troubleshooting

### Issue: "At least one RPC endpoint must be configured"
**Solution**: Ensure `GETBLOCK_ENDPOINT` is set in `.env`

### Issue: Fallback endpoints not being used
**Solution**: 
1. Check `FALLBACK_ENDPOINTS` format (comma-separated, no spaces after commas)
2. Verify endpoints are valid by testing with curl
3. Check logs for initialization message

### Issue: All providers failing
**Solution**:
1. Test each endpoint individually with curl
2. Check if you've hit rate limits on all providers
3. Verify your API keys are valid
4. For self-hosted: check if `zcashd` is running and synced

### Issue: Self-hosted node not working
**Solution**:
1. Verify `txindex=1` is in `zcash.conf`
2. Check if node is fully synced: `zcash-cli getblockchaininfo`
3. Ensure RPC credentials are correct in the URL
4. For remote access, add your IP to `rpcallowip` in `zcash.conf`

## Security Best Practices

1. **Never commit API keys**: Add `.env` to `.gitignore`
2. **Use environment variables**: Don't hardcode endpoints
3. **Rotate keys regularly**: Especially if they're in logs
4. **Secure self-hosted node**: Use strong RPC passwords
5. **Network isolation**: Restrict `rpcallowip` to necessary IPs only

## Example Configurations

### Development (Single Free Tier)
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/free-key
FALLBACK_ENDPOINTS=
```

### Production (High Reliability)
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/paid-key-1
FALLBACK_ENDPOINTS=https://go.getblock.io/paid-key-2,https://quicknode.com/endpoint,http://backup-server:8232
```

### Heavy Usage (Multiple Free + Self-Hosted)
```bash
GETBLOCK_ENDPOINT=https://go.getblock.io/account1
FALLBACK_ENDPOINTS=https://go.getblock.io/account2,https://go.getblock.io/account3,http://localhost:8232
```

## Need More Help?

- Check the main documentation: `endtoend.md`
- Review fixes: `FIXES_APPLIED.md`
- See architectural details: `FALLBACK_ENDPOINTS.md`
- Open an issue on the repository
