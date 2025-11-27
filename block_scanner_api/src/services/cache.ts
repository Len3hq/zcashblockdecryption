import { Pool as PgPool } from 'pg';
import { logger } from '../utils/logger';
import { BlockData, RawTransaction } from '../types';

export interface CacheService {
    initialize(): Promise<void>;
    getBlockHash(height: number): Promise<string | null>;
    setBlockHash(height: number, hash: string): Promise<void>;
    getBlock(hash: string): Promise<BlockData | null>;
    setBlock(hash: string, data: BlockData): Promise<void>;
    getRawTx(txid: string): Promise<string | null>;
    setRawTx(txid: string, hex: string): Promise<void>;
    close(): Promise<void>;
}

// PostgreSQL implementation
class PostgresCache implements CacheService {
    private pool: PgPool | null = null;
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        this.pool = new PgPool(this.config);

        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS block_hashes (
        height INTEGER PRIMARY KEY,
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blocks (
        hash TEXT PRIMARY KEY,
        data_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS raw_transactions (
        txid TEXT PRIMARY KEY,
        hex TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_block_hashes_height ON block_hashes(height);
      CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_txid ON raw_transactions(txid);
    `);

        logger.info('PostgreSQL cache initialized');
    }

    async getBlockHash(height: number): Promise<string | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const result = await this.pool.query('SELECT hash FROM block_hashes WHERE height = $1', [height]);
        return result.rows[0]?.hash || null;
    }

    async setBlockHash(height: number, hash: string): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        await this.pool.query('INSERT INTO block_hashes (height, hash) VALUES ($1, $2) ON CONFLICT (height) DO UPDATE SET hash = $2', [height, hash]);
    }

    async getBlock(hash: string): Promise<BlockData | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const result = await this.pool.query('SELECT data_json FROM blocks WHERE hash = $1', [hash]);
        return result.rows[0]?.data_json || null;
    }

    async setBlock(hash: string, data: BlockData): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        await this.pool.query('INSERT INTO blocks (hash, data_json) VALUES ($1, $2) ON CONFLICT (hash) DO UPDATE SET data_json = $2', [hash, data]);
    }

    async getRawTx(txid: string): Promise<string | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const result = await this.pool.query('SELECT hex FROM raw_transactions WHERE txid = $1', [txid]);
        return result.rows[0]?.hex || null;
    }

    async setRawTx(txid: string, hex: string): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        await this.pool.query('INSERT INTO raw_transactions (txid, hex) VALUES ($1, $2) ON CONFLICT (txid) DO UPDATE SET hex = $2', [txid, hex]);
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}

// Factory function to create cache service
export function createCacheService(): CacheService {
    const config: any = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    };

    // Add SSL configuration if sslmode is specified
    const sslMode = process.env.DB_SSLMODE;
    if (sslMode === 'require') {
        config.ssl = {
            rejectUnauthorized: false // For Aiven and most managed PostgreSQL services
        };
    }

    // Validate required environment variables
    if (!config.host || !config.database || !config.user || !config.password) {
        throw new Error('Missing required database configuration. Ensure DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD are set.');
    }

    logger.info(`Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);
    return new PostgresCache(config);
}
