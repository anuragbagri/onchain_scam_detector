# 🛡️ Solana Scam Detector

Real-time on-chain risk analysis for Solana wallet and token addresses. Get explainable risk scores powered by heuristic analysis of transaction patterns, token metadata, and wallet behavior.

## ✨ Features

- **Risk Scoring** — Overall risk score (0–100) with breakdown across 3 categories
- **Rug Pull Detection** — Checks mint/freeze authority, holder concentration, token age
- **Fake Volume Detection** — Identifies bot patterns, uniform spacing, velocity anomalies
- **Wallet Behavior Analysis** — Evaluates wallet age, balance drain, failure rates
- **Auto-Detection** — Automatically identifies if an address is a token or wallet
- **Known Address Recognition** — Reduces false positives for well-known protocols (USDC, Raydium, Jupiter, etc.)
- **Solscan Deep-Links** — Every signal links directly to Solscan for verification
- **Analysis History** — Recent analyses saved in localStorage
- **Share Reports** — Copy, share, or download risk reports
- **Token/Wallet Metadata** — Display supply, authority status, balance, holdings

## 🏗️ Architecture

```
Frontend (Next.js :3000) → POST /api/analyze → Backend (Express :3001) → Solana Mainnet RPC
```

### Lightweight RPC Strategy

Uses only fast, non-rate-limited Solana RPC endpoints:

| Endpoint | What We Get |
|----------|-------------|
| `getSignaturesForAddress` | blockTime, slot, err — timing/velocity analysis |
| `getParsedAccountInfo` | Token metadata (mint/freeze authority, supply) |
| `getBalance` | SOL balance |
| `getTokenLargestAccounts` | Top holders for concentration analysis |

> ⚠️ We intentionally avoid `getParsedTransaction` (aggressively rate-limited on public RPC).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or use `npx pnpm`)

### Setup

```bash
# Clone the repo
git clone https://github.com/anuragbagri/onchain_scam_detector.git
cd onchain_scam_detector

# Install dependencies
npx pnpm install

# Start both servers (backend on :3001, frontend on :3000)
npx pnpm dev
```

Or start them separately:

```bash
# Terminal 1 — Backend
cd apps/backend && npx ts-node-dev --respawn src/index.ts

# Terminal 2 — Frontend
cd apps/frontend && npx next dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# apps/backend/.env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com   # or Helius/QuickNode URL
PORT=3001
```

> 💡 For faster, more reliable analysis, use a [Helius](https://helius.dev) free-tier API key.

## 📁 Project Structure

```
onchain_scam_detector/
├── apps/
│   ├── backend/src/
│   │   ├── engines/         # Risk analysis engines
│   │   │   ├── rugPullAnalyzer.ts
│   │   │   ├── fakeVolumeAnalyzer.ts
│   │   │   ├── walletAnalyzer.ts
│   │   │   └── riskScorer.ts
│   │   ├── services/        # Solana RPC data fetching
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Validation & error handling
│   │   └── utils/           # Cache, known addresses
│   └── frontend/src/app/
│       ├── components/      # React components
│       │   ├── SearchInput, RiskGauge, CategoryCard
│       │   ├── MetadataPanel, ShareReport
│       │   ├── AnalysisProgress, HistorySidebar
│       └── lib/api.ts       # Backend API client
├── packages/shared/         # Shared TypeScript types
└── package.json             # Monorepo root (pnpm workspaces)
```

## 🎯 Scoring Methodology

| Category | Weight | Key Signals |
|----------|--------|-------------|
| **Rug Pull Risk** | 40% | Mint/freeze authority, holder concentration, token age |
| **Fake Volume** | 30% | Timing clusters, uniform spacing, transaction velocity |
| **Wallet Behavior** | 30% | Wallet age, balance drain, failure rate, velocity |

Risk levels:
- 🟢 **Low** (0–29): Normal on-chain activity
- 🟡 **Medium** (30–59): Some concerning signals
- 🔴 **High** (60–100): Significant risk indicators

## 🔧 Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, CSS Modules
- **Backend**: Express, TypeScript, @solana/web3.js
- **Monorepo**: pnpm workspaces
- **Styling**: Custom CSS with glassmorphism, animations, Solana-inspired palette

## ⚠️ Disclaimer

This is a **heuristic-based analysis tool**. It does not constitute financial advice. Always do your own research before making investment decisions. The scoring is based on on-chain patterns and may produce false positives for legitimate high-activity addresses.

## 📄 License

MIT
