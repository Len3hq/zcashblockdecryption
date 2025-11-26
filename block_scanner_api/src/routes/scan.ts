import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getMultiProviderClient } from '../services/multi-provider-client';
import { getDecryptor } from '../services/decryptor';
import { CacheService } from '../services/cache';
import { ScanRequest, ScanResponse, TransactionDetails } from '../types';

export function createScanRouter(cache: CacheService): Router {
    const router = Router();
    const blockchainClient = getMultiProviderClient(cache);
    const decryptor = getDecryptor();

    router.post('/scan', async (req: Request, res: Response) => {
        try {
            const { blockHeights, ufvk }: ScanRequest = req.body;

            // Validation
            if (!blockHeights || !Array.isArray(blockHeights)) {
                return res.status(400).json({
                    success: false,
                    error: 'blockHeights must be an array of numbers'
                });
            }

            if (blockHeights.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'blockHeights array cannot be empty'
                });
            }

            if (blockHeights.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 100 blocks allowed per request'
                });
            }

            if (!ufvk || typeof ufvk !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'ufvk must be a non-empty string'
                });
            }

            // Validate UFVK format
            if (!ufvk.startsWith('uview1') && !ufvk.startsWith('uviewtest1')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid UFVK format. Must start with "uview1" (mainnet) or "uviewtest1" (testnet)'
                });
            }

            // Validate block heights are positive integers
            for (const height of blockHeights) {
                if (!Number.isInteger(height) || height < 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid block height: ${height}. Must be a positive integer`
                    });
                }
            }

            logger.info(`Scanning ${blockHeights.length} blocks with UFVK`);
            const startTime = Date.now();

            const allTransactions: TransactionDetails[] = [];

            // Process each block
            for (const height of blockHeights) {
                try {
                    logger.info(`Processing block ${height}`);

                    // Get all transactions in the block
                    const transactions = await blockchainClient.getBlockTransactions(height);
                    logger.info(`Block ${height} has ${transactions.length} transactions`);

                    // Decrypt all transactions
                    const decryptedTxs = await decryptor.decryptTransactions(transactions, ufvk, height);

                    if (decryptedTxs.length > 0) {
                        logger.info(`Found ${decryptedTxs.length} matching transactions in block ${height}`);
                        allTransactions.push(...decryptedTxs);
                    }
                } catch (error: any) {
                    logger.error(`Error processing block ${height}:`, error.message);
                    // Continue with next block instead of failing entire request
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`Scan completed in ${duration}ms. Found ${allTransactions.length} matching transactions`);

            const response: ScanResponse = {
                success: true,
                blocksScanned: blockHeights.length,
                transactionsFound: allTransactions.length,
                transactions: allTransactions
            };

            res.json(response);
        } catch (error: any) {
            logger.error('Scan endpoint error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    });

    return router;
}
