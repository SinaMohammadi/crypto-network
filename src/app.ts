import express, { Application } from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import blockchainRoutes from './routes/blockchain.routes';
import { Logger } from './utils/logger';

export class App {
    public app: Application;
    private logger: Logger;

    constructor() {
        this.app = express();
        this.logger = new Logger('App');
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares(): void {
        this.app.use(helmet());
        this.app.use(corsMiddleware);

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    private initializeRoutes(): void {

        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            });
        });


        this.app.use('/api/blockchain', blockchainRoutes);

        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Blockchain Networks',
                version: '1.0.0',
                supportedNetworks: ['arbitrum', 'ton', 'solana', 'ripple', "avalanche", "polygon"],
                endpoints: {
                    networks: 'GET /api/blockchain/networks',
                    balance: 'GET /api/blockchain/:network/balance/:address',
                    multiBalance: 'GET /api/blockchain/balance/:address',
                    sendTransaction: 'POST /api/blockchain/:network/transaction',
                    transactionStatus: 'GET /api/blockchain/:network/transaction/:hash',
                    estimateGas: 'POST /api/blockchain/:network/estimate-gas',
                    walletInfo: 'GET /api/blockchain/:network/wallet/:address',
                    latestBlock: 'GET /api/blockchain/:network/block/latest',
                    createWallet: 'GET /api/blockchain/:network/create/wallet',
                }
            });
        });
    }

    private initializeErrorHandling(): void {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }

    public listen(port: number): void {
        this.app.listen(port, () => {
            this.logger.info(`Server is running on port ${port}`);
            this.logger.info('Available endpoints:');
            this.logger.info('  GET  /health - Health check');
            this.logger.info('  GET  /api - API documentation');
            this.logger.info('  GET  /api/blockchain/networks - Supported networks');
            this.logger.info('  GET  /api/blockchain/:network/balance/:address - Get balance');
            this.logger.info('  POST /api/blockchain/:network/transaction - Send transaction');
        });
    }
}
