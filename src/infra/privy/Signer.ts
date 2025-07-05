import { Buffer } from "buffer";
import {
  PrivyClient,
  type EthereumSignTransactionInputType,
} from "@privy-io/server-auth";
import { ethers, isHexString, toBeHex } from "ethers";

import {
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  PRIVY_SIGNING_KEY,
  BSC_RPC,
} from "@/bootstrap/env";
import type { UserContext } from "@/generated/pancake";
import { logger } from "@/bootstrap/logger";

type Did = string;

export type SignCreds = { walletId: string } | { did: string };

/**
 * Privy session‑signer
 *
 *  • Figures out the **delegated wallet‑ID** from (did, solAddr) – cached in‑mem
 *
 *  • Signs the message via   POST /wallets/{walletId}/sign/solana
 */
export class PrivySigner {
  private readonly privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
    walletApi: {
      authorizationPrivateKey: PRIVY_SIGNING_KEY,
    },
  });

  private readonly authHeader =
    "Basic " +
    Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString("base64");

  private readonly cache: Record<Did, string> = {};

  /**
   * Signs an **EVM** tx and (optionally) broadcasts it.
   * Returns `[rawTx, txHash]`.
   */
  async signEvmTx(
    tx: ethers.TransactionRequest,
    walletId: string,
    broadcast = false,
    provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(BSC_RPC)
  ): Promise<[string, string]> {
    // Normalise & fill missing fields
    const populated: ethers.TransactionRequest = await this.populateTx(
      tx,
      provider
    );

    const { signedTransaction }: { signedTransaction: string } =
      await this.privy.walletApi.ethereum.signTransaction({
        walletId,
        transaction: this.toPrivyTx(populated),
      });

    const txHash = ethers.keccak256(signedTransaction as `0x${string}`);

    if (broadcast) await provider.broadcastTransaction(signedTransaction);
    return [signedTransaction, txHash];
  }

  private async populateTx(
    tx: ethers.TransactionRequest,
    provider: ethers.JsonRpcProvider
  ): Promise<ethers.TransactionRequest> {
    const populated = { ...tx };

    // -------- required fields --------
    if (populated.nonce === undefined) {
      logger.info("[populateTx] getting nonce");
      populated.nonce = await provider.getTransactionCount(
        tx.from?.toString()!,
        "pending"
      );
      logger.info(`[populateTx] nonce is:  ${populated.nonce}`);
    }

    if (populated.gasLimit == null)
      populated.gasLimit = await provider.estimateGas(populated);

    const fee = await provider.getFeeData();

    /* ---------- BSC (no EIP-1559) ---------- */
    if (fee.maxFeePerGas == null) {
      // fallback to legacy
      populated.gasPrice = fee.gasPrice!;
      populated.type = 0; // <- force legacy
    } else {
      // chains that support 1559
      populated.maxFeePerGas = fee.maxFeePerGas!;
      populated.maxPriorityFeePerGas = fee.maxPriorityFeePerGas!;
      populated.type = 2;
    }

    if (populated.chainId == null)
      populated.chainId = (await provider.getNetwork()).chainId;

    logger.info(
      `[populateTx] populated = ${JSON.stringify(
        populated,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      )}`
    );
    return populated;
  }

  private toPrivyTx(
    tx: ethers.TransactionRequest
  ): EthereumSignTransactionInputType["transaction"] {
    const t: Record<string, any> = { ...tx };

    // These fields must be hex strings
    [
      "value",
      "gasLimit",
      "gasPrice",
      "maxFeePerGas",
      "maxPriorityFeePerGas",
      "nonce",
      "chainId",
    ].forEach((k) => {
      if (t[k] != null) {
        // ethers.toBeHex() handles bigint, number, hex-string idempotently
        t[k] = ethers.toBeHex(t[k]);
      }
    });

    // Strip undefined / null
    Object.keys(t).forEach((k) => t[k] == null && delete t[k]);

    return t as EthereumSignTransactionInputType["transaction"];
  }
}

class DelegatedSigner extends ethers.AbstractSigner {
  constructor(
    readonly address: string,
    private walletId: string,
    private ps: PrivySigner,
    provider = new ethers.JsonRpcProvider(BSC_RPC)
  ) {
    super(provider);
  }

  async getAddress() {
    return this.address;
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    const [raw] = await this.ps.signEvmTx(
      tx,
      this.walletId,
      false,
      this.provider as ethers.JsonRpcProvider
    );
    return raw;
  }

  async sendTransaction(
    tx: ethers.TransactionRequest
  ): Promise<ethers.TransactionResponse> {
    const [raw] = await this.ps.signEvmTx(
      tx,
      this.walletId,
      false,
      this.provider as ethers.JsonRpcProvider
    );
    return await (this.provider as ethers.JsonRpcProvider).broadcastTransaction(
      raw
    );
  }

  /** switch provider (required by AbstractSigner) */
  connect(provider: ethers.JsonRpcProvider | null): ethers.Signer {
    return new DelegatedSigner(
      this.address,
      this.walletId,
      this.ps,
      provider ?? undefined
    );
  }

  /** EIP-712 is out-of-scope for now */
  async signTypedData(): Promise<string> {
    throw new Error("signTypedData not implemented for DelegatedSigner");
  }

  signMessage(): Promise<string> {
    throw new Error("signMessage not implemented");
  }
}

export function getDelegatedSigner(user: UserContext): ethers.Signer {
  if (!user.address) throw new Error("Missing user address");
  if (!user.walletId) throw new Error("Missing wallet id");

  return new DelegatedSigner(user.address, user.walletId, new PrivySigner());
}
