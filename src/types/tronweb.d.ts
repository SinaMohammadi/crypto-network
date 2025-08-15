// src/types/tronweb.d.ts
declare module 'tronweb' {
    interface TronWebConfig {
        fullHost?: string;
        fullNode?: string;
        solidityNode?: string;
        eventServer?: string;
        privateKey?: string;
        headers?: Record<string, string>;
    }

    interface TronWebAddress {
        fromPrivateKey(privateKey: string): string;
        fromHex(hex: string): string;
        toHex(address: string): string;
    }

    interface TronWebTrx {
        getBalance(address: string): Promise<number>;
        getAccount(address: string): Promise<any>;
        getTransaction(hash: string): Promise<any>;
        getTransactionInfo(hash: string): Promise<any>;
        getCurrentBlock(): Promise<any>;
        getNodeInfo(): Promise<any>;
        getChainParameters(): Promise<any[]>;
        getFees(): Promise<any>;
        getAccountResources(address: string): Promise<any>;
        getTransactionsFromAddress(address: string, limit?: number): Promise<any[]>;
        sign(transaction: any): Promise<any>;
        sendRawTransaction(signedTransaction: any): Promise<any>;
    }

    interface TronWebTransactionBuilder {
        sendTrx(to: string, amount: number, from: string): Promise<any>;
        freezeBalance(amount: number, duration: number, resource: string, from: string): Promise<any>;
        unfreezeBalance(resource: string, from: string): Promise<any>;
    }

    interface TronWebContract {
        at(address: string): Promise<any>;
    }

    class TronWeb {
        constructor(config: TronWebConfig);

        address: TronWebAddress;
        trx: TronWebTrx;
        transactionBuilder: TronWebTransactionBuilder;

        contract(): TronWebContract;
        isAddress(address: string): boolean;
        fromSun(sun: number): string;
        toSun(trx: number): string;
        toHex(str: string): string;
        createAccount(): Promise<any>;
        setPrivateKey(privateKey: string): void;

        static createAccount(): Promise<any>;
    }

    export = TronWeb;
}

// src/types/binance-chain.d.ts
declare module '@binance-chain/javascript-sdk' {
    export class BncClient {
        constructor(server: string);

        chooseNetwork(network: 'mainnet' | 'testnet'): void;
        initChain(): Promise<void>;

        // Account methods
        recoverAccountFromPrivateKey(privateKey: string): any;
        getAccount(address: string): Promise<any>;
        getAccountSequence(address: string): Promise<{ sequence: number; accountNumber: number }>;

        // Transaction methods
        transfer(from: string, to: string, amount: number, asset: string, memo?: string): Promise<any>;
        multiSend(from: string, outputs: any[], memo?: string): Promise<any>;
        getTx(hash: string): Promise<any>;
        getTransactions(address: string, options?: any): Promise<any>;

        // Trading methods
        placeOrder(order: any): Promise<any>;
        cancelOrder(cancel: any): Promise<any>;
        getOpenOrders(address: string, symbol?: string): Promise<any>;
        getClosedOrders(address: string, symbol?: string, start?: number, limit?: number): Promise<any>;
        getOrder(orderId: string): Promise<any>;

        // Market data
        getDepth(params: any): Promise<any>;
        get24hrStats(params?: any): Promise<any>;
        getKlines(params: any): Promise<any>;
        getTrades(params: any): Promise<any>;
        getMarkets(params?: any): Promise<any>;
        getTokens(params?: any): Promise<any>;
        getFees(): Promise<any>;

        // Network info
        getNodeInfo(): Promise<any>;
        getValidators(): Promise<any>;
        getTime(): Promise<any>;

        // Atomic swaps
        createAtomicSwap(params: any): Promise<any>;
        claimAtomicSwap(params: any): Promise<any>;
        refundAtomicSwap(params: any): Promise<any>;

        // Static methods
        static generateMnemonic(): string;
        static recoverAccountFromMnemonic(mnemonic: string, password?: string, index?: number, derivationPath?: string): any;

        // Crypto utilities
        crypto: {
            decodeAddress(address: string): Buffer;
            encodeAddress(bytes: Buffer, prefix: string): string;
        };
    }
}
