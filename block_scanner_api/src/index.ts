import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { createCacheService } from './services/cache';
import { createScanRouter } from './routes/scan';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Initialize cache and routes
let cacheService: ReturnType<typeof createCacheService>;

async function initializeApp() {
    try {
        // Initialize cache
        cacheService = createCacheService();
        await cacheService.initialize();
        logger.info('Cache service initialized');

        // Mount routes
        app.use('/', createScanRouter(cacheService));

        // Health check endpoint
        app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // 404 handler
        app.use((req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });

        // Error handler
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            logger.error('Unhandled error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });

        // Start server
        app.listen(port, () => {
            logger.info(`Zcash Block Scanner API listening on port ${port}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Database type: ${process.env.DB_TYPE || 'sqlite'}`);
        });
    } catch (error) {
        logger.error('Failed to initialize application:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    if (cacheService) {
        await cacheService.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down gracefully...');
    if (cacheService) {
        await cacheService.close();
    }
    process.exit(0);
});

// Start the application
initializeApp();
