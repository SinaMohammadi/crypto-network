declare module '@binance-chain/javascript-sdk' {
    export class BncClient {
        constructor(server: string);

        chooseNetwork(network: 'mainnet' | 'testnet'): void;
        initChain(): Promise<void>;

        recoverAccountFromPrivateKey(privateKey: string): any;
        getAccount(address: string): Promise<any>;
        getAccountSequence(address: string): Promise<{ sequence: number; accountNumber: number }>;

        transfer(from: string, to: string, amount: number, asset: string, memo?: string): Promise<any>;
        multiSend(from: string, outputs: any[], memo?: string): Promise<any>;
        getTx(hash: string): Promise<any>;
        getTransactions(address: string, options?: any): Promise<any>;

        placeOrder(order: any): Promise<any>;
        cancelOrder(cancel: any): Promise<any>;
        getOpenOrders(address: string, symbol?: string): Promise<any>;
        getClosedOrders(address: string, symbol?: string, start?: number, limit?: number): Promise<any>;
        getOrder(orderId: string): Promise<any>;

        getDepth(params: any): Promise<any>;
        get24hrStats(params?: any): Promise<any>;
        getKlines(params: any): Promise<any>;
        getTrades(params: any): Promise<any>;
        getMarkets(params?: any): Promise<any>;
        getTokens(params?: any): Promise<any>;
        getFees(): Promise<any>;

        getNodeInfo(): Promise<any>;
        getValidators(): Promise<any>;
        getTime(): Promise<any>;

        createAtomicSwap(params: any): Promise<any>;
        claimAtomicSwap(params: any): Promise<any>;
        refundAtomicSwap(params: any): Promise<any>;

        static generateMnemonic(): string;
        static recoverAccountFromMnemonic(mnemonic: string, password?: string, index?: number, derivationPath?: string): any;

        crypto: {
            decodeAddress(address: string): Buffer;
            encodeAddress(bytes: Buffer, prefix: string): string;
        };
    }
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {

            BTC_PRIVATE_KEY?: string;
            BTC_RPC_URL?: string;

            TRON_PRIVATE_KEY?: string;
            TRON_API_KEY?: string;
            TRON_RPC_URL?: string;
            TRON_SEED?: string;

            BSC_PRIVATE_KEY?: string;
            BSC_RPC_URL?: string;
            BSC_SEED?: string;

            BNB_PRIVATE_KEY?: string;
            BNB_RPC_URL?: string;
            BNB_SEED?: string;

            PRIVATE_KEY?: string;
            TESTNET?: string;
        }
    }
}

export { };