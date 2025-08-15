import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { ArbitrumService } from '../services/ArbitrumService';
import { SolanaService } from '../services/SolanaService';
import { TONService } from '../services/TONService';
import { RippleService } from '../services/RippleService';
import { NetworkType } from '../types/blockchain.types';
import { NETWORK_CONFIGS } from '../config/networks.config';
import { PolygonService } from '../services/PolygonService';
import { AvalancheService } from '../services/AvalancheService';
import { CardanoService } from '../services/CardanoService';
import { TRC20Service } from '../services/TRC20Service';

export class BlockchainServiceFactory {
    private static services: Map<NetworkType, BaseBlockchainService> = new Map();

    static async createService(networkType: NetworkType): Promise<BaseBlockchainService> {
        if (this.services.has(networkType)) {
            return this.services.get(networkType)!;
        }

        const config = NETWORK_CONFIGS[networkType];

        let service: BaseBlockchainService;

        switch (networkType) {
            case NetworkType.ARBITRUM:
                service = new ArbitrumService(config, networkType);
                break;
            case NetworkType.SOLANA:
                service = new SolanaService(config, networkType);
                break;
            case NetworkType.TON:
                service = new TONService(config, networkType);
                break;
            case NetworkType.RIPPLE:
                service = new RippleService(config, networkType);
                break;
            case NetworkType.POLYGON:
                service = new PolygonService(config, networkType);
                break;
            case NetworkType.AVALANCHE:
                service = new AvalancheService(config, networkType);
                break;
            case NetworkType.CARDANO:
                service = new CardanoService(config, networkType);
                break;
            case NetworkType.TRC20:
                service = new TRC20Service(config, networkType);
                break;
            default:
                throw new Error(`Unsupported network type: ${networkType}`);
        }
        if (config.enable) {
            await service.initialize();
            this.services.set(networkType, service);
        }
        return service;
    }

    static async getAllServices(): Promise<BaseBlockchainService[]> {
        const services: BaseBlockchainService[] = [];

        for (const networkType of Object.values(NetworkType)) {
            try {
                const service = await this.createService(networkType);
                services.push(service);
            } catch (error) {

                console.error(`Failed to initialize ${networkType} service:`, error);
            }
        }

        return services;
    }

    static getAvailableNetworks(): NetworkType[] {
        return Object.values(NetworkType);
    }
}
