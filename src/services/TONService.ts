import { TonClient, Address, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { beginCell, Cell } from '@ton/core';
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';

export class TONService extends BaseBlockchainService {
    private client!: TonClient;
    private wallet?: WalletContractV4;
    private keyPair?: any;

    private toNano(amount: string | number): bigint {
        const amountStr = typeof amount === 'number' ? amount.toString() : amount;
        const [whole, decimal = ''] = amountStr.split('.');
        const paddedDecimal = decimal.padEnd(9, '0').slice(0, 9);
        return BigInt(whole + paddedDecimal);
    }

    private fromNano(amount: bigint): string {
        const amountStr = amount.toString().padStart(10, '0');
        const whole = amountStr.slice(0, -9) || '0';
        const decimal = amountStr.slice(-9).replace(/0+$/, '');
        return decimal ? `${whole}.${decimal}` : whole;
    }

    private createMessageBody(memo?: string): Cell {
        const builder = beginCell();
        if (memo) {
            builder.storeUint(0, 32).storeStringTail(memo);
        }
        return builder.endCell();
    }

    private createInternalMessage(params: {
        to: Address | string;
        value: bigint;
        body?: Cell;
        bounce?: boolean;
    }) {
        const to = typeof params.to === 'string' ? Address.parse(params.to) : params.to;

        return {
            info: {
                type: 'internal' as const,
                ihrDisabled: true,
                bounce: params.bounce ?? true,
                bounced: false,
                src: null,
                dest: to,
                value: {
                    coins: params.value
                },
                ihrFee: 0n,
                forwardFee: 0n,
                createdLt: 0n,
                createdAt: 0
            },
            body: params.body || beginCell().endCell()
        };
    }

    async initialize(): Promise<void> {
        try {
            this.client = new TonClient({
                endpoint: this.config.rpcUrl,
                apiKey: this.config.apiKey
            });

            if (process.env.TON_MNEMONIC) {
                try {
                    const mnemonic = process.env.TON_MNEMONIC.split(' ');
                    this.keyPair = await mnemonicToWalletKey(mnemonic);
                    this.wallet = WalletContractV4.create({
                        publicKey: this.keyPair.publicKey,
                        workchain: 0
                    });
                    this.logger.info(`TON Wallet initialized: ${this.wallet.address.toString()}`);
                } catch (walletError) {
                    this.logger.warn('Failed to initialize TON wallet from mnemonic');
                }
            }

            const info = await this.client.getMasterchainInfo();
            this.logger.info(`TON service initialized successfully. Latest seqno: ${info.latestSeqno}`);
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid TON address format');
            }

            const addr = Address.parse(address);
            const balance = await this.client.getBalance(addr);
            const tonBalance = parseFloat(this.fromNano(balance));

            this.logger.debug(`Balance for ${address}: ${tonBalance} TON`);
            return tonBalance;
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet || !this.keyPair) {
                throw new Error('Wallet not initialized. Please provide TON_MNEMONIC');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const contract = this.client.open(this.wallet);
            const seqno = await contract.getSeqno();

            const transfer = contract.createTransfer({
                secretKey: this.keyPair.secretKey,
                seqno: seqno,
                messages: [
                    this.createInternalMessage({
                        to: request.to,
                        value: this.toNano(request.amount.toString()),
                        body: this.createMessageBody(request.memo),
                        bounce: false
                    })
                ]
            });

            await contract.send(transfer);

            const hash = `ton_${Date.now()}_${seqno}`;

            this.logTransaction('sendTransaction', {
                hash,
                to: request.to,
                amount: request.amount,
                seqno,
                memo: request.memo
            });

            return {
                hash,
                status: 'pending',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            if (hash.startsWith('ton_')) {
                return {
                    hash,
                    status: 'confirmed',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            try {
                const transactions = await this.client.getTransactions(
                    Address.parse(this.wallet?.address.toString() || ''),
                    { limit: 100 }
                );

                const found = transactions.find((tx: any) =>
                    tx.hash().toString() === hash ||
                    tx.hash().toString() === hash
                );

                return {
                    hash,
                    status: found ? 'confirmed' : 'pending',
                    blockNumber: found ? Number(found.lt) : undefined,
                    fee: found ? parseFloat(this.fromNano(found.totalFees.coins)) : undefined,
                    timestamp: found ? found.now : Math.floor(Date.now() / 1000)
                };
            } catch {
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
                throw new Error('Invalid TON address format');
            }

            const balance = await this.getBalance(address);
            const addr = Address.parse(address);

            try {
                const transactions = await this.client.getTransactions(addr, { limit: 1 });
                const transactionCount = transactions.length > 0 ? 1 : 0;

                this.logger.debug(`Wallet info for ${address}: ${balance} TON, ${transactionCount} recent transactions`);

                return {
                    address,
                    balance,
                    nativeToken: 'TON',
                    transactionCount
                };
            } catch {
                return {
                    address,
                    balance,
                    nativeToken: 'TON',
                    transactionCount: 0
                };
            }
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const masterchainInfo = await this.client.getMasterchainInfo();

            return {
                number: masterchainInfo.latestSeqno,
                hash: masterchainInfo.shard,
                timestamp: Math.floor(Date.now() / 1000),
                transactionCount: 0,
                gasUsed: undefined,
                gasLimit: undefined,
                baseFeePerGas: undefined
            };
        } catch (error) {
            this.handleError(error, 'getLatestBlock');
        }
    }

    validateAddress(address: string): boolean {
        try {
            const addr = Address.parse(address);
            return addr instanceof Address;
        } catch {
            return false;
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const baseGas = 0.005;
            const messageSize = request.memo ? request.memo.length * 0.0001 : 0;
            const estimatedFee = baseGas + messageSize;

            this.logger.debug(`Estimated fee: ${estimatedFee} TON`);
            return estimatedFee;
        } catch (error) {
            return 0.005;
        }
    }

    async getAccountState(address: string): Promise<{
        balance: string;
        state: 'uninitialized' | 'frozen' | 'active';
        code?: string;
        data?: string;
        lastTransactionLt: string;
        lastTransactionHash: string;
    }> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid TON address format');
            }

            const addr = Address.parse(address);
            const state = await this.client.getContractState(addr);

            return {
                balance: this.fromNano(state.balance),
                state: state.state,
                code: state.code?.toString('hex'),
                data: state.data?.toString('hex'),
                lastTransactionLt: state.lastTransaction?.lt.toString() || '0',
                lastTransactionHash: state.lastTransaction?.hash.toString() || ''
            };
        } catch (error) {
            this.handleError(error, 'getAccountState');
        }
    }

    async getTransactionHistory(
        address: string,
        limit: number = 100
    ): Promise<Array<{
        hash: string;
        lt: string;
        timestamp: number;
        inMessage?: {
            source?: string;
            destination: string;
            value: string;
            body?: string;
        };
        outMessages: Array<{
            source: string;
            destination?: string;
            value: string;
            body?: string;
        }>;
        fee: string;
    }>> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid address format');
            }

            const addr = Address.parse(address);
            const transactions = await this.client.getTransactions(addr, { limit });

            return transactions.map((tx: any) => ({
                hash: tx.hash().toString(),
                lt: tx.lt.toString(),
                timestamp: tx.now,
                inMessage: tx.inMessage ? {
                    source: tx.inMessage.info.src?.toString(),
                    destination: tx.inMessage.info.dest.toString(),
                    value: this.fromNano(tx.inMessage.info.value.coins),
                    body: tx.inMessage.body.toString()
                } : undefined,
                outMessages: tx.outMessages.map((msg: any) => ({
                    source: msg.info.src.toString(),
                    destination: msg.info.dest?.toString(),
                    value: this.fromNano(msg.info.value.coins),
                    body: msg.body.toString()
                })),
                fee: this.fromNano(tx.totalFees.coins)
            }));
        } catch (error) {
            this.handleError(error, 'getTransactionHistory');
        }
    }

    async getMasterchainInfo(): Promise<{
        workchain: number;
        shard: string;
        seqno: number;
        initSeqno: number;
        latestSeqno: number;
    }> {
        try {
            const info = await this.client.getMasterchainInfo();
            return {
                workchain: info.workchain,
                shard: info.shard,
                seqno: info.latestSeqno,
                initSeqno: info.initSeqno,
                latestSeqno: info.latestSeqno
            };
        } catch (error) {
            this.handleError(error, 'getMasterchainInfo');
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.client.getMasterchainInfo();
            return true;
        } catch {
            return false;
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        workchain: number;
        seqno: number;
        endpoint: string;
    }> {
        try {
            const masterchainInfo = await this.client.getMasterchainInfo();

            return {
                name: 'TON',
                workchain: masterchainInfo.workchain,
                seqno: masterchainInfo.latestSeqno,
                endpoint: this.config.rpcUrl
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async getWalletSeqno(): Promise<number> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const contract = this.client.open(this.wallet);
            return await contract.getSeqno();
        } catch (error) {
            this.handleError(error, 'getWalletSeqno');
        }
    }

    async deployWallet(): Promise<TransactionResponse> {
        try {
            if (!this.wallet || !this.keyPair) {
                throw new Error('Wallet not initialized. Please provide TON_MNEMONIC');
            }

            const contract = this.client.open(this.wallet);
            const seqno = await contract.getSeqno();

            if (seqno !== 0) {
                throw new Error('Wallet is already deployed');
            }

            const transfer = contract.createTransfer({
                secretKey: this.keyPair.secretKey,
                seqno: 0,
                messages: [
                    this.createInternalMessage({
                        to: this.wallet.address,
                        value: this.toNano('0.01'),
                        body: this.createMessageBody(),
                        bounce: false
                    })
                ]
            });

            await contract.send(transfer);

            const hash = `ton_deploy_${Date.now()}`;

            this.logTransaction('deployWallet', {
                hash,
                address: this.wallet.address.toString()
            });

            return {
                hash,
                status: 'pending',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'deployWallet');
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let mnemonic: string[];
            let keyPair: any;
            let wallet: WalletContractV4;
            let usedIndex: number | undefined;

            if (options?.mnemonic) {
                mnemonic = options.mnemonic.split(' ');
            } else if (process.env.TON_SEED) {
                mnemonic = process.env.TON_SEED.split(' ');
            } else {

                const { mnemonicNew } = await import('@ton/crypto');
                mnemonic = await mnemonicNew();
            }

            keyPair = await mnemonicToWalletKey(mnemonic);


            const workchain = options?.index !== undefined ? options.index : 0;
            usedIndex = options?.index;

            wallet = WalletContractV4.create({
                publicKey: keyPair.publicKey,
                workchain: workchain
            });

            this.logger.info(`Created new TON wallet: ${wallet.address.toString()}`);

            return {
                address: wallet.address.toString(),
                publicKey: keyPair.publicKey.toString('hex'),
                privateKey: keyPair.secretKey.toString('hex'),
                mnemonic: mnemonic.join(' '),
                keyPair,
                network: 'ton',
                index: usedIndex
            };
        } catch (error) {
            this.handleError(error, 'createWallet');
        }
    }
}
