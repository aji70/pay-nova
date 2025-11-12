# 💸 PayNova

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Chain: Base](https://img.shields.io/badge/Chain-Base-blue.svg)
![WalletConnect: Reown](https://img.shields.io/badge/WalletConnect-Reown-purple.svg)

## 🧭 Overview

**PayNova** is a decentralized payment application built on blockchain technology, allowing users to **generate, search, and execute crypto transactions with zero mistakes**.  

It supports **native tokens** and **ERC-20 tokens** (e.g., USDT, USDC) across multiple chains, with a focus on seamless wallet integration and on-chain transaction management.

### ✨ Key Functionalities
- **Generate Transactions:** Create secure, reference-based payment requests for recipients on supported chains.  
- **Search & Pay:** Load existing transactions by reference ID and pay partial or full amounts.  
- **Receipt Generation:** View and print on-chain verified receipts after successful payments.  
- **Multi-Chain Support:** Currently optimized for **Base (mainnet)**, with compatibility for **Ethereum**, **BSC**, **Polygon**, and testnets like **Base Sepolia**.

PayNova leverages a custom smart contract (**PayNovaABI**) for transaction storage and execution, ensuring tamper-proof records.

---

## 🧩 Features

- **Reference-Based Payments:** Unique IDs (e.g., `ref_abc123`) for easy sharing and tracking.  
- **Partial Payments:** Pay any amount up to the original transaction value.  
- **Token Support:** Native tokens (ETH, BNB, etc.) and ERC-20 tokens (USDT, USDC, custom tokens).  
- **Approval Handling:** Automatic ERC-20 approvals before payments.  
- **Toast Notifications:** Real-time feedback with React Hot Toast.  
- **Responsive UI:** Modern, gradient-based design with animated blobs for an engaging experience.  
- **Print Receipts:** Generate printable payment proofs with timestamps and details.  
- **Error Handling:** Robust try-catch for wallet disconnections, invalid inputs, and reverted transactions.

---

## 🛠️ Tech Stack

### **Frontend**
- Next.js 14+ (App Router)
- React 18
- TypeScript

### **Wallet Integration**
- Wagmi for React hooks (`useAccount`, `usePublicClient`)
- **Reown (WalletConnect v2)** for secure, cross-chain wallet connections with MetaMask, Rainbow, etc.

### **Blockchain**
- **Viem** for low-level smart contract reads/writes and transaction formatting  
- Smart Contract deployed on **Base mainnet (Chain ID: 8453)**  
  - Key Functions: `generateTransaction`, `payTransaction`, `approveTransaction`

### **UI/UX**
- Tailwind CSS  
- Heroicons  
- React Hot Toast

### **Environment**
- Development: Base Sepolia (testnet)  
- Production: Base mainnet

---

## ⚙️ Prerequisites

- **Node.js 18+** and **npm/yarn/pnpm**  
- **Wallet** with testnet/mainnet funds (e.g., ETH on Base)  
- Environment variables for contract addresses and API keys (see `.env.example`)

---

## 🚀 Installation

Clone the repository:
```bash
git clone <your-repo-url>
cd paynova
```
Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

**Set up environment variables:**
```bash
Copy .env.example → .env.local and fill in:

NEXT_PUBLIC_PAYNOVA_CONTRACT=0x...           # Your deployed contract address on Base
NEXT_PUBLIC_USDT_BASE_SEPOLIA=0x...          # Testnet USDT (if using Sepolia)
NEXT_PUBLIC_USDC_BASE_SEPOLIA=0x...          # Testnet USDC (if using Sepolia)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
```

## **🔗 Configure WalletConnect with Reown**

**Sign up at Reown Cloud**
 and create a project to get your projectId.

In your Wagmi config (e.g., wagmi.config.ts), include the WalletConnect connector:
```bash
import { walletConnect } from 'wagmi/connectors'

// ...
createConfig({
  connectors: [
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID }),
    // Other connectors like injected (MetaMask)
  ],
})
```


This setup uses Reown's WalletConnect v2 for cross-chain wallet connections, ensuring compatibility with Base and other EVM chains.

## **💻 Usage**
**Run Development Server**
```bash
npm run dev


Open http://localhost:3000
 in your browser.

Connect Wallet

Click “Connect Wallet” (via Wagmi/Reown integration)

Select your wallet; Reown will handle the modal and session.

Generate a Transaction

Click “Generate New Transaction”

Select chain, token, recipient, and amount

Submit to create an on-chain reference ID

Search & Pay

Enter a reference ID and click “Find”

If pending and yours, enter payment amount and click “Pay Now”

Approve ERC-20 if needed, then confirm in wallet

View Receipt

After payment, view or print the receipt with transaction details

💡 For testing: Use Base Sepolia faucet for funds. Switch chains via your wallet.
```

## **🧱 Deployment**
App Hosting

Hosting: Vercel
 (recommended for Next.js)

Connect your GitHub repo to Vercel

Add environment variables in the Vercel dashboard

Deploy command:
```bash
npm run build && npm run start
```
Smart Contract

Deploy the PayNova smart contract to Base mainnet using Hardhat or Foundry

Update .env with the deployed contract address

Verify on Basescan

Chain Configuration

Base mainnet RPC:

https://mainnet.base.org


Example Wagmi chain setup:

import { base } from 'wagmi/chains'
// ...
createConfig({ chains: [base] })

## **🌐 Live Demo**

paynova.app
 — deployed on Base mainnet.

## **📜 License**

This project is MIT licensed — see the LICENSE
 file for details.
