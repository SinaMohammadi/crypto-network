import { Request, Response } from 'express';
import { BlockchainServiceFactory } from '../factory/BlockchainServiceFactory';
import { NetworkType, TransactionRequest, CreateWalletOptions } from '../types/blockchain.types';
import { Logger } from '../utils/logger';

export class BlockchainController {
    private logger = new Logger('BlockchainController');


    async getBalance(req: Request, res: Response): Promise<void> {
        try {
            const { network, address } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            if (!service.validateAddress(address)) {
                res.status(400).json({ error: 'Invalid address format' });
                return;
            }

            const balance = await service.getBalance(address);

            const walletInfo = await service.getWalletInfo(address);

            res.json({
                network,
                address,
                balance,
                nativeToken: walletInfo.nativeToken,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting balance:', error);
            res.status(500).json({
                error: 'Failed to get balance',
                network: req.params.network,
                address: req.params.address
            });
        }
    }

    async sendTransaction(req: Request, res: Response): Promise<void> {
        try {
            const { network } = req.params;
            const transactionRequest: TransactionRequest = req.body;

            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            if (!service.validateAddress(transactionRequest.to)) {
                res.status(400).json({ error: 'Invalid recipient address' });
                return;
            }


            if (transactionRequest.from && !service.validateAddress(transactionRequest.from)) {
                res.status(400).json({ error: 'Invalid sender address' });
                return;
            }

            const result = await service.sendTransaction(transactionRequest);

            res.json({
                network,
                transaction: result,
                request: {
                    to: transactionRequest.to,
                    amount: transactionRequest.amount,
                    memo: transactionRequest.memo
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error sending transaction:', error);
            res.status(500).json({
                error: 'Failed to send transaction',
                network: req.params.network
            });
        }
    }


    async getTransactionStatus(req: Request, res: Response): Promise<void> {
        try {
            const { network, hash } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            const status = await service.getTransactionStatus(hash);

            res.json({
                network,
                transactionHash: hash,
                status: status.status,
                details: status,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting transaction status:', error);
            res.status(500).json({
                error: 'Failed to get transaction status',
                network: req.params.network,
                hash: req.params.hash
            });
        }
    }


    async getWalletInfo(req: Request, res: Response): Promise<void> {
        try {
            const { network, address } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            if (!service.validateAddress(address)) {
                res.status(400).json({ error: 'Invalid address format' });
                return;
            }

            const walletInfo = await service.getWalletInfo(address);

            res.json({
                network,
                wallet: walletInfo,
                networkConfig: {
                    name: service.getNetworkConfig().name,
                    chainId: service.getNetworkConfig().chainId
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting wallet info:', error);
            res.status(500).json({
                error: 'Failed to get wallet info',
                network: req.params.network,
                address: req.params.address
            });
        }
    }

    async getLatestBlock(req: Request, res: Response): Promise<void> {
        try {
            const { network } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            const blockInfo = await service.getLatestBlock();

            res.json({
                network,
                block: blockInfo,
                networkInfo: {
                    name: service.getNetworkConfig().name,
                    rpcUrl: service.getNetworkConfig().rpcUrl
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting latest block:', error);
            res.status(500).json({
                error: 'Failed to get latest block',
                network: req.params.network
            });
        }
    }


    async estimateGas(req: Request, res: Response): Promise<void> {
        try {
            const { network } = req.params;
            const transactionRequest: TransactionRequest = req.body;

            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            if (!service.validateAddress(transactionRequest.to)) {
                res.status(400).json({ error: 'Invalid recipient address' });
                return;
            }

            const gasEstimate = await service.estimateGas(transactionRequest);
            const walletInfo = await service.getWalletInfo(transactionRequest.to);

            res.json({
                network,
                gasEstimate,
                estimatedFee: gasEstimate,
                feeToken: walletInfo.nativeToken,
                transactionDetails: {
                    to: transactionRequest.to,
                    amount: transactionRequest.amount
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error estimating gas:', error);
            res.status(500).json({
                error: 'Failed to estimate gas',
                network: req.params.network
            });
        }
    }


    async getSupportedNetworks(req: Request, res: Response): Promise<void> {
        try {
            const networks = BlockchainServiceFactory.getAvailableNetworks();


            const networkDetails = await Promise.allSettled(
                networks.map(async (networkType) => {
                    try {
                        const service = await BlockchainServiceFactory.createService(networkType);
                        const config = service.getNetworkConfig();
                        return {
                            type: networkType,
                            name: config.name,
                            chainId: config.chainId,
                            testnet: config.testnet || false,
                            status: 'available'
                        };
                    } catch (error) {
                        return {
                            type: networkType,
                            name: networkType,
                            status: 'unavailable',
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                })
            );

            const results = networkDetails.map(result =>
                result.status === 'fulfilled' ? result.value : result.reason
            );

            res.json({
                supportedNetworks: results,
                count: networks.length,
                availableCount: results.filter(n => n.status === 'available').length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting supported networks:', error);
            res.status(500).json({ error: 'Failed to get supported networks' });
        }
    }


    async getMultiNetworkBalance(req: Request, res: Response): Promise<void> {
        try {
            const { address } = req.params;
            const services = await BlockchainServiceFactory.getAllServices();

            this.logger.info(`Checking balance for address ${address} across ${services.length} networks`);

            const balances = await Promise.allSettled(
                services.map(async (service) => {
                    try {
                        if (service.validateAddress(address)) {
                            const walletInfo = await service.getWalletInfo(address);
                            return {
                                network: service.getNetworkType(),
                                networkName: service.getNetworkConfig().name,
                                address: walletInfo.address,
                                balance: walletInfo.balance,
                                nativeToken: walletInfo.nativeToken,
                                status: 'success'
                            };
                        } else {
                            return {
                                network: service.getNetworkType(),
                                networkName: service.getNetworkConfig().name,
                                status: 'invalid_address',
                                error: 'Address format not supported on this network'
                            };
                        }
                    } catch (error) {
                        return {
                            network: service.getNetworkType(),
                            networkName: service.getNetworkConfig().name,
                            status: 'error',
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                })
            );


            const successful = balances
                .filter(result => result.status === 'fulfilled' && result.value.status === 'success')
                .map(result => (result as PromiseFulfilledResult<any>).value);

            const failed = balances
                .filter(result =>
                    result.status === 'rejected' ||
                    (result.status === 'fulfilled' && result.value.status !== 'success')
                )
                .map(result =>
                    result.status === 'rejected'
                        ? { error: result.reason.message, status: 'rejected' }
                        : (result as PromiseFulfilledResult<any>).value
                );


            const totalBalance = successful.reduce((sum, item) => sum + item.balance, 0);

            res.json({
                address,
                networks: successful,
                totalNetworks: successful.length,
                totalBalance,
                failedNetworks: failed,
                summary: {
                    successfulQueries: successful.length,
                    failedQueries: failed.length,
                    totalNetworksChecked: balances.length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error getting multi-network balance:', error);
            res.status(500).json({
                error: 'Failed to get multi-network balance',
                address: req.params.address
            });
        }
    }


    async validateAddress(req: Request, res: Response): Promise<void> {
        try {
            const { network, address } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            const isValid = service.validateAddress(address);

            res.json({
                network,
                address,
                isValid,
                networkName: service.getNetworkConfig().name,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error validating address:', error);
            res.status(500).json({
                error: 'Failed to validate address',
                network: req.params.network,
                address: req.params.address
            });
        }
    }


    async createWallet(req: Request, res: Response): Promise<void> {
        try {
            const { network } = req.params;
            const options = req.body || {};

            const service = await BlockchainServiceFactory.createService(network as NetworkType);
            const walletData = await service.createWallet(options);

            res.json({
                network,
                wallet: walletData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Error creating wallet:', error);
            res.status(500).json({
                error: 'Failed to create wallet',
                network: req.params.network
            });
        }
    }


    async getNetworkHealth(req: Request, res: Response): Promise<void> {
        try {
            const { network } = req.params;
            const service = await BlockchainServiceFactory.createService(network as NetworkType);

            const startTime = Date.now();
            const blockInfo = await service.getLatestBlock();
            const responseTime = Date.now() - startTime;

            res.json({
                network,
                networkName: service.getNetworkConfig().name,
                status: 'healthy',
                latestBlock: blockInfo.number,
                responseTime: `${responseTime}ms`,
                rpcUrl: service.getNetworkConfig().rpcUrl,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error(`Network health check failed for ${req.params.network}:`, error);
            res.status(503).json({
                network: req.params.network,
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    }
}