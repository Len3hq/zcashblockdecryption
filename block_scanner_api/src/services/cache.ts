import Database from 'better-sqlite3';
import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
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

// SQLite implementation
class SQLiteCache implements CacheService {
    private db: Database.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    async initialize(): Promise<void> {
        this.db = new Database(this.dbPath);

        // Create tables
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS block_hashes (
        height INTEGER PRIMARY KEY,
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blocks (
        hash TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS raw_transactions (
        txid TEXT PRIMARY KEY,
        hex TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_block_hashes_height ON block_hashes(height);
      CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
      CREATE INDEX IF NOT EXISTS idx_raw_tx_txid ON raw_transactions(txid);
    `);

        logger.info('SQLite cache initialized at', this.dbPath);
    }

    async getBlockHash(height: number): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT hash FROM block_hashes WHERE height = ?').get(height) as { hash: string } | undefined;
        return row?.hash || null;
    }

    async setBlockHash(height: number, hash: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('INSERT OR REPLACE INTO block_hashes (height, hash) VALUES (?, ?)').run(height, hash);
    }

    async getBlock(hash: string): Promise<BlockData | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT data_json FROM blocks WHERE hash = ?').get(hash) as { data_json: string } | undefined;
        return row ? JSON.parse(row.data_json) : null;
    }

    async setBlock(hash: string, data: BlockData): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('INSERT OR REPLACE INTO blocks (hash, data_json) VALUES (?, ?)').run(hash, JSON.stringify(data));
    }

    async getRawTx(txid: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');
        const row = this.db.prepare('SELECT hex FROM raw_transactions WHERE txid = ?').get(txid) as { hex: string } | undefined;
        return row?.hex || null;
    }

    async setRawTx(txid: string, hex: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('INSERT OR REPLACE INTO raw_transactions (txid, hex) VALUES (?, ?)').run(txid, hex);
    }

    async close(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
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

// MySQL implementation
class MySQLCache implements CacheService {
    private pool: mysql.Pool | null = null;
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        this.pool = mysql.createPool(this.config);

        const connection = await this.pool.getConnection();
        try {
            await connection.query(`
        CREATE TABLE IF NOT EXISTS block_hashes (
          height INT PRIMARY KEY,
          hash TEXT NOT NULL
        );
      `);

            await connection.query(`
        CREATE TABLE IF NOT EXISTS blocks (
          hash VARCHAR(255) PRIMARY KEY,
          data_json JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

            await connection.query(`
        CREATE TABLE IF NOT EXISTS raw_transactions (
          txid VARCHAR(255) PRIMARY KEY,
          hex TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

            await connection.query(`CREATE INDEX IF NOT EXISTS idx_block_hashes_height ON block_hashes(height);`);
            await connection.query(`CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);`);
            await connection.query(`CREATE INDEX IF NOT EXISTS idx_raw_tx_txid ON raw_transactions(txid);`);
        } finally {
            connection.release();
        }

        logger.info('MySQL cache initialized');
    }

    async getBlockHash(height: number): Promise<string | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const [rows] = await this.pool.query('SELECT hash FROM block_hashes WHERE height = ?', [height]);
        return (rows as any)[0]?.hash || null;
    }

    async setBlockHash(height: number, hash: string): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        await this.pool.query('INSERT INTO block_hashes (height, hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE hash = ?', [height, hash, hash]);
    }

    async getBlock(hash: string): Promise<BlockData | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const [rows] = await this.pool.query('SELECT data_json FROM blocks WHERE hash = ?', [hash]);
        const row = (rows as any)[0];
        return row ? JSON.parse(row.data_json) : null;
    }

    async setBlock(hash: string, data: BlockData): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        const jsonData = JSON.stringify(data);
        await this.pool.query('INSERT INTO blocks (hash, data_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE data_json = ?', [hash, jsonData, jsonData]);
    }

    async getRawTx(txid: string): Promise<string | null> {
        if (!this.pool) throw new Error('Database not initialized');
        const [rows] = await this.pool.query('SELECT hex FROM raw_transactions WHERE txid = ?', [txid]);
        return (rows as any)[0]?.hex || null;
    }

    async setRawTx(txid: string, hex: string): Promise<void> {
        if (!this.pool) throw new Error('Database not initialized');
        await this.pool.query('INSERT INTO raw_transactions (txid, hex) VALUES (?, ?) ON DUPLICATE KEY UPDATE hex = ?', [txid, hex, hex]);
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}

// Factory function to create appropriate cache service
export function createCacheService(): CacheService {
    const dbType = process.env.DB_TYPE || 'sqlite';

    switch (dbType.toLowerCase()) {
        case 'sqlite':
            const dbPath = process.env.DB_PATH || './cache/blocks.db';
            return new SQLiteCache(dbPath);

        case 'postgres':
        case 'postgresql':
            return new PostgresCache({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'zcash_cache',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || ''
            });

        case 'mysql':
            return new MySQLCache({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306'),
                database: process.env.DB_NAME || 'zcash_cache',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || ''
            });

        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}
