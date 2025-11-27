# Railway Deployment Guide

This guide explains how to deploy the Zcash Block Scanner & Transaction Decryptor to Railway.

## Prerequisites

- A [Railway](https://railway.app/) account
- A GetBlock.io API key (get one at [getblock.io](https://getblock.io/))
- Git repository with this code (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### 1. Connect Your Repository to Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"** (or GitLab/Bitbucket)
4. Choose your repository
5. Railway will automatically detect the Dockerfile

### 2. Configure Environment Variables

In the Railway dashboard, add the following environment variables:

#### Required Variables

```env
GETBLOCK_ENDPOINT=https://go.getblock.io/YOUR_API_KEY_HERE
```

#### Optional Variables

```env
# Add fallback endpoints for redundancy (comma-separated)
FALLBACK_ENDPOINTS=https://go.getblock.io/KEY2,http://other-provider

# Port (Railway sets this automatically, but you can override)
PORT=3005

# Database configuration (defaults to SQLite)
DB_TYPE=sqlite
DB_PATH=/app/cache/blocks.db
```

### 3. Deploy

1. Railway will automatically build and deploy using the Dockerfile
2. Wait for the build to complete (5-10 minutes for first build)
3. Once deployed, Railway will provide a public URL

### 4. Verify Deployment

Test the health endpoint:

```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T14:13:09.974Z",
  "uptime": 22.88562773
}
```

## Using the API

### Scan Blocks Endpoint

```bash
curl -X POST https://your-app.railway.app/scan \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [3148327, 3148328],
    "ufvk": "uview1..."
  }'
```

## Build Details

The Dockerfile uses a multi-stage build process:

1. **Stage 1 (rust-builder)**: Compiles the Rust transaction decryptor
   - Uses Rust nightly for edition2024 support
   - Produces optimized release binary (~2.4MB)

2. **Stage 2 (node-builder)**: Builds the Node.js TypeScript API
   - Compiles TypeScript to JavaScript
   - Installs production dependencies

3. **Stage 3 (production)**: Creates minimal production image
   - Only includes runtime dependencies
   - Copies compiled Rust binary and Node.js dist
   - Final image size: ~200MB

## Railway-Specific Considerations

### Port Configuration

Railway automatically sets the `PORT` environment variable. The Dockerfile is configured to use `PORT=3005` by default, but Railway's `PORT` variable will override this.

### Persistent Storage

The default configuration uses SQLite for caching block data. This works well on Railway, but note:
- Data is stored in `/app/cache/blocks.db`
- This is ephemeral storage (data lost on restart)
- For persistent storage, use PostgreSQL or MySQL (see below)

### Using PostgreSQL on Railway

Railway offers a PostgreSQL database. To use it:

1. Add a PostgreSQL database to your Railway project
2. Railway will automatically create these variables:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

3. Add these environment variables to your app:
   ```env
   DB_TYPE=postgres
   DB_HOST=${{PGHOST}}
   DB_PORT=${{PGPORT}}
   DB_NAME=${{PGDATABASE}}
   DB_USER=${{PGUSER}}
   DB_PASSWORD=${{PGPASSWORD}}
   ```

### Resource Limits

The default Railway plan includes:
- 512 MB RAM
- 1 vCPU
- 5GB bandwidth

This is sufficient for moderate usage. For higher load, upgrade to a paid plan.

## Health Checks

The Dockerfile includes a health check that Railway will use:
- Checks `/health` endpoint every 30 seconds
- 10-second timeout
- 3 retries before marking unhealthy

## Troubleshooting

### Build Failures

**Issue**: Rust compilation fails  
**Solution**: Ensure you have enough build time. Railway allows up to 10 minutes for builds.

**Issue**: Node.js dependencies fail  
**Solution**: Check that `package-lock.json` is committed to your repository.

### Runtime Errors

**Issue**: "All RPC providers failed"  
**Solution**: Verify your `GETBLOCK_ENDPOINT` environment variable is set correctly with a valid API key.

**Issue**: Container exits immediately  
**Solution**: Check Railway logs for errors. Common causes:
- Missing `GETBLOCK_ENDPOINT` variable
- Invalid UFVK format
- Database connection issues

### Viewing Logs

In Railway dashboard:
1. Click on your deployment
2. Navigate to **"Deployments"** tab
3. Click on the active deployment
4. View real-time logs

## Cost Estimation

### Railway Costs
- Free tier: $5 of credits per month
- Hobby plan: $5/month + usage
- Typical usage for this app: ~$5-10/month

### GetBlock.io Costs
- Free tier: 40,000 requests/day
- Growth plan: $49/month for 1M requests
- This app caches blocks, minimizing API calls

## Scaling

To handle more traffic:

1. **Horizontal Scaling**: Deploy multiple instances with load balancer
2. **Database**: Switch from SQLite to PostgreSQL for shared cache
3. **Fallback Endpoints**: Add multiple RPC providers for redundancy

## Security

- Never commit `.env` files with real API keys
- Use Railway's environment variables feature
- Rotate API keys regularly
- Monitor usage and set up alerts

## Support

- Railway Documentation: https://docs.railway.app/
- Zcash Documentation: https://zcash.readthedocs.io/
- Project Issues: Create an issue in the GitHub repository
