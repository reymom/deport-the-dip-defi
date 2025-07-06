# DeFi Server — PancakeSwap RPC Service

This is a Bun-powered gRPC backend that builds and executes swap transactions on **PancakeSwap (BSC)**.

It supports two flows:

- **Delegated** swaps (Privy-signed), via `pancake.SwapService/ExecuteSwap`
- **Unsigned TX generation** for MiniApps, via `transaction.TransactionService`

---

## Stack

- Bun runtime
- Ethers.js
- gRPC (via `@grpc/grpc-js`)
- TypeScript
- Supabase (for storage)
- Privy (for delegated wallets)

---

## ▶ Run Locally

```bash
bun run dev
```

---

## gRPC API Overview

### 1. Pancake Swap (Delegated TX)

**Service**: `pancake.SwapService`

**Proto file**: `proto/pancake.proto`

**Example call (0.5 USDT ➜ CAKE)**

```bash
docker run --rm -it --network=host -v "$(pwd)/proto":/proto \
  fullstorydev/grpcurl:latest -plaintext \
  -import-path /proto -proto pancake.proto \
  -d '{
    "user": {
      "address":  "",
      "wallet_id":""
    },
    "token_in":   "0x55d398326f99059ff775485246999027b3197955",
    "token_out":  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amount_in_wei":"500000000000000000",
    "slippage_bps": 100
  }' localhost:50051 pancake.SwapService/ExecuteSwap
```

### 2. Build & Submit TX (Non-Delegated Flow)

**Service**: `transaction.TransactionService`

**Proto file**: `proto/transaction.proto`

This is designed for MiniApp clients:

- `BuildUnsignedTx` ➜ called by backend
- TX is signed in frontend (Privy hook)
- `SubmitSignedTx` ➜ returns tx hash and explorer URL

Made with 💥 for **ETH Cannes 2025 Hackathon** 🐐
