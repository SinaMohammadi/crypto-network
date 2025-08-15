# Blockchain Networks API

Lightweight TypeScript Express API that exposes balances and transaction endpoints for multiple blockchain networks.

- Project entry: [src/server.ts](src/server.ts)  
- App class: [`App`](src/app.ts)  
- Server bootstrap (startup): [`startServer`](src/server.ts)  
- Blockchain service factory: [`BlockchainServiceFactory.getAllServices`](src/factory/BlockchainServiceFactory.ts)  
- Request logging: [`Logger`](src/utils/logger.ts)  
- API routes: [src/routes/blockchain.routes.ts](src/routes/blockchain.routes.ts)  
- Blockchain controller (multi-balance): [`BlockchainController.getMultiNetworkBalance`](src/controllers/blockchain.controller.ts)  
- Base service abstraction: [src/abstracts/BaseBlockchainService.ts](src/abstracts/BaseBlockchainService.ts)  
- Example env: [.env.example](.env.example)  
- Package manifest: [package.json](package.json)

## Features
- Health check and basic info endpoints
- Per-network balance, multi-network balance aggregation
- Pluggable blockchain services via [`BlockchainServiceFactory.getAllServices`](src/factory/BlockchainServiceFactory.ts)
- Helmet + CORS + logging + error handling configured in [`App`](src/app.ts)

## Requirements
- Node.js (compatible with versions in pnpm lock; see [package.json](package.json))
- pnpm / npm

## Setup
Install dependencies:

## Stages
It's not complete yet

```sh
# sh
pnpm install
# or
npm install
