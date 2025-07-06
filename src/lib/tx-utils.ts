import { ethers } from "ethers";
import { BSC_RPC } from "@/bootstrap/env";
import { logger } from "@/bootstrap/logger";
import type { EthereumSignTransactionInputType } from "@privy-io/server-auth";

/** fills nonce, gas, fee fields */
export async function populateTx(
  tx: ethers.TransactionRequest,
  provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(BSC_RPC)
): Promise<ethers.TransactionRequest> {
  const populated: ethers.TransactionRequest = { ...tx };

  if (populated.nonce === undefined) {
    populated.nonce = await provider.getTransactionCount(
      tx.from!.toString(),
      "pending"
    );
  }
  if (populated.gasLimit == null) {
    populated.gasLimit = await provider.estimateGas(populated);
  }

  const fee = await provider.getFeeData();
  if (populated.gasPrice == null && populated.maxFeePerGas == null) {
    if (fee.maxFeePerGas == null) {
      populated.gasPrice = fee.gasPrice!; // legacy (BSC)
      populated.type = 0;
    } else {
      populated.maxFeePerGas = fee.maxFeePerGas!; // EIP-1559
      populated.maxPriorityFeePerGas = fee.maxPriorityFeePerGas!;
      populated.type = 2;
    }
  }

  if (populated.chainId == null) {
    populated.chainId = (await provider.getNetwork()).chainId;
  }
  logger.info(
    `[populateTx] populated = ${JSON.stringify(
      populated,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )}`
  );
  return populated;
}

/** convert to Privy-compliant hex-string fields */
export function toPrivyTx(
  tx: ethers.TransactionRequest
): EthereumSignTransactionInputType["transaction"] {
  const t: Record<string, any> = { ...tx };
  [
    "value",
    "gasLimit",
    "gasPrice",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "nonce",
    "chainId",
  ].forEach((k) => {
    if (t[k] != null) t[k] = ethers.toBeHex(t[k]);
  });
  Object.keys(t).forEach((k) => t[k] == null && delete t[k]);

  return t as EthereumSignTransactionInputType["transaction"];
}
