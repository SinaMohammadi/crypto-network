import { ethers } from 'ethers';
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';

export class ArbitrumService extends BaseBlockchainService {
    private provider!: ethers.JsonRpcProvider;
    private wallet?: ethers.Wallet;

    async initialize(): Promise<void> {
        try {
            this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
            const network = await this.provider.getNetwork();

            if (network.chainId !== 42161n && network.chainId !== 421614n) {
                this.logger.warn(`Connected to unexpected network: ${network.name} (${network.chainId})`);
            }

            if (process.env.ARBITRUM_PRIVATE_KEY || process.env.PRIVATE_KEY) {
                const privateKey = process.env.ARBITRUM_PRIVATE_KEY || process.env.PRIVATE_KEY;
                this.wallet = new ethers.Wallet(privateKey!, this.provider);
                this.logger.info(`Wallet initialized: ${this.wallet.address}`);
            }

            this.logger.info(`Arbitrum service initialized successfully on ${network.name} (Chain ID: ${network.chainId})`);
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Ethereum address format');
            }

            const balanceWei = await this.provider.getBalance(address);
            const balanceEth = parseFloat(ethers.formatEther(balanceWei));

            this.logger.debug(`Balance for ${address}: ${balanceEth} ETH`);
            return balanceEth;
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized. Please provide ARBITRUM_PRIVATE_KEY or PRIVATE_KEY');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            if (request.from && !this.validateAddress(request.from)) {
                throw new Error('Invalid sender address');
            }

            const txRequest: ethers.TransactionRequest = {
                to: request.to,
                value: ethers.parseEther(request.amount.toString()),
                gasLimit: request.gasLimit || undefined,
            };

            if (request.gasPrice) {
                txRequest.gasPrice = ethers.parseUnits(request.gasPrice.toString(), 'gwei');
            }

            if (request.memo) {
                txRequest.data = ethers.hexlify(ethers.toUtf8Bytes(request.memo));
            }

            const tx = await this.wallet.sendTransaction(txRequest);

            this.logTransaction('sendTransaction', {
                hash: tx.hash,
                to: request.to,
                amount: request.amount,
                gasLimit: txRequest.gasLimit?.toString(),
                gasPrice: txRequest.gasPrice?.toString(),
                nonce: tx.nonce
            });

            return {
                hash: tx.hash,
                status: 'pending',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            const tx = await this.provider.getTransaction(hash);

            if (!tx) {
                return {
                    hash,
                    status: 'failed',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            const receipt = await this.provider.getTransactionReceipt(hash);

            if (receipt) {
                const status = receipt.status === 1 ? 'confirmed' : 'failed';
                const gasUsed = Number(receipt.gasUsed);
                const effectiveGasPrice = receipt.gasPrice || tx.gasPrice || 0n;
                const fee = parseFloat(ethers.formatEther(BigInt(gasUsed) * effectiveGasPrice));

                return {
                    hash,
                    status,
                    blockNumber: receipt.blockNumber,
                    gasUsed,
                    fee,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            } else {
                return {
                    hash,
                    status: 'pending',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }
        } catch (error) {
            this.handleError(error, 'getTransactionStatus');
        }
    }

    async getWalletInfo(address: string): Promise<WalletInfo> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Ethereum address format');
            }

            const balance = await this.getBalance(address);
            const transactionCount = await this.provider.getTransactionCount(address);

            this.logger.debug(`Wallet info for ${address}: ${balance} ETH, ${transactionCount} transactions`);

            return {
                address,
                balance,
                nativeToken: 'ETH',
                transactionCount
            };
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const block = await this.provider.getBlock('latest');

            if (!block) {
                throw new Error('Failed to fetch latest block');
            }

            return {
                number: block.number,
                hash: block.hash || "",
                timestamp: block.timestamp,
                transactionCount: block.transactions.length,
                gasUsed: block.gasUsed ? Number(block.gasUsed) : undefined,
                gasLimit: block.gasLimit ? Number(block.gasLimit) : undefined,
                baseFeePerGas: block.baseFeePerGas ? Number(block.baseFeePerGas) : undefined
            };
        } catch (error) {
            this.handleError(error, 'getLatestBlock');
        }
    }

    validateAddress(address: string): boolean {
        try {
            return ethers.isAddress(address);
        } catch {
            return false;
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const txRequest: ethers.TransactionRequest = {
                to: request.to,
                value: ethers.parseEther(request.amount.toString()),
            };

            if (request.from && this.validateAddress(request.from)) {
                txRequest.from = request.from;
            } else if (this.wallet) {
                txRequest.from = this.wallet.address;
            }

            if (request.memo) {
                txRequest.data = ethers.hexlify(ethers.toUtf8Bytes(request.memo));
            }

            const gasEstimate = await this.provider.estimateGas(txRequest);
            const gasNumber = Number(gasEstimate);

            this.logger.debug(`Gas estimate for transaction: ${gasNumber} units`);
            return gasNumber;
        } catch (error) {
            this.handleError(error, 'estimateGas');
        }
    }

    async getCurrentGasPrice(): Promise<number> {
        try {
            const gasPrice = await this.provider.getFeeData();
            const gasPriceGwei = gasPrice.gasPrice
                ? parseFloat(ethers.formatUnits(gasPrice.gasPrice, 'gwei'))
                : 0;

            this.logger.debug(`Current gas price: ${gasPriceGwei} Gwei`);
            return gasPriceGwei;
        } catch (error) {
            this.handleError(error, 'getCurrentGasPrice');
        }
    }

    async getFeeData(): Promise<{
        gasPrice: number;
        maxFeePerGas: number;
        maxPriorityFeePerGas: number;
    }> {
        try {
            const feeData = await this.provider.getFeeData();

            return {
                gasPrice: feeData.gasPrice ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')) : 0,
                maxFeePerGas: feeData.maxFeePerGas ? parseFloat(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')) : 0,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')) : 0,
            };
        } catch (error) {
            this.handleError(error, 'getFeeData');
        }
    }

    async getTransactionHistory(
        address: string,
        fromBlock?: number,
        toBlock?: number
    ): Promise<string[]> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid address format');
            }

            const currentBlock = await this.provider.getBlockNumber();
            const startBlock = fromBlock || Math.max(0, currentBlock - 1000);
            const endBlock = toBlock || currentBlock;

            const transactions: string[] = [];

            for (let i = startBlock; i <= endBlock && i <= startBlock + 100; i++) {
                const block = await this.provider.getBlock(i, true);
                if (block && block.transactions) {
                    for (const tx of block.transactions) {
                        if (typeof tx === 'object' && tx !== null && 'from' in tx && 'to' in tx && 'hash' in tx) {
                            const transaction = tx as ethers.TransactionResponse;
                            if (transaction.from === address || transaction.to === address) {
                                transactions.push(transaction.hash);
                            }
                        }
                    }
                }
            }

            return transactions;
        } catch (error) {
            this.handleError(error, 'getTransactionHistory');
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            const network = await this.provider.getNetwork();
            return network.chainId === 42161n || network.chainId === 421614n;
        } catch {
            return false;
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        chainId: number;
        blockNumber: number;
        gasPrice: number;
    }> {
        try {
            const [network, blockNumber, feeData] = await Promise.all([
                this.provider.getNetwork(),
                this.provider.getBlockNumber(),
                this.provider.getFeeData()
            ]);

            return {
                name: network.name,
                chainId: Number(network.chainId),
                blockNumber,
                gasPrice: feeData.gasPrice ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')) : 0
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let wallet: ethers.Wallet | ethers.HDNodeWallet;
            let mnemonic: string | undefined;
            let publicKey: string;
            let usedIndex: number | undefined;
            let usedDerivationPath: string | undefined;

            const targetMnemonic = options?.mnemonic || process.env.ARBITRUM_SEED;

            if (targetMnemonic) {
                const mnemonicObj = ethers.Mnemonic.fromPhrase(targetMnemonic);

                if (options?.index !== undefined) {
                    usedIndex = options.index;
                    usedDerivationPath = options.derivationPath || `m/44'/60'/${options.index}'/0/0`;

                    const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, usedDerivationPath);
                    wallet = hdNode;
                    publicKey = wallet.publicKey;

                    this.logger.info(`Created Arbitrum wallet with derivation path: ${usedDerivationPath}`);
                } else {
                    wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj);
                    publicKey = wallet.publicKey;
                }

                mnemonic = targetMnemonic;
            } else {
                if (options?.index !== undefined) {
                    const randomWallet = ethers.Wallet.createRandom();
                    mnemonic = randomWallet.mnemonic?.phrase;

                    if (mnemonic) {
                        usedIndex = options.index;
                        usedDerivationPath = options.derivationPath || `m/44'/60'/${options.index}'/0/0`;

                        const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
                        wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, usedDerivationPath);
                        publicKey = wallet.publicKey;

                        this.logger.info(`Created new Arbitrum wallet with derivation path: ${usedDerivationPath}`);
                    } else {
                        throw new Error('Failed to generate mnemonic for new wallet');
                    }
                } else {
                    wallet = ethers.Wallet.createRandom();
                    mnemonic = wallet.mnemonic?.phrase;
                    publicKey = wallet.signingKey.publicKey;
                }
            }

            this.logger.info(`Created new Arbitrum wallet: ${wallet.address}`);

            return {
                address: wallet.address,
                privateKey: wallet.privateKey,
                publicKey: publicKey,
                mnemonic,
                network: 'Arbitrum',
                index: usedIndex,
                derivationPath: usedDerivationPath
            };
        } catch (error) {
            this.handleError(error, 'createWallet');
        }
    }
}
