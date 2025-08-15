import dotenv from 'dotenv';
import { App } from './app';
import { Logger } from './utils/logger';
import { BlockchainServiceFactory } from './factory/BlockchainServiceFactory';

dotenv.config();

const logger = new Logger('Server');
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer(): Promise<void> {
    try {
        logger.info('Initializing blockchain services...');
        await BlockchainServiceFactory.getAllServices();
        logger.info('All blockchain services initialized successfully');

        const app = new App();
        app.listen(PORT);

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

startServer();