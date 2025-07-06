import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import { ethers } from "ethers";

import type {
  TransactionServiceServer,
  BuildTxRequest,
  BuildTxResponse,
} from "@/generated/transaction";
import {
  PANCAKE_ROUTER,
  PancakeAdapter,
} from "@/protocols/pancake/PancakeAdapter";
import { logger } from "@/bootstrap/logger";
import { Transaction } from "ethers";
import { populateTx } from "@/lib/tx-utils";

const pancakeAdapter = new PancakeAdapter();

export const buildUnsignedTx: TransactionServiceServer["buildUnsignedTx"] =
  async (
    call: ServerUnaryCall<BuildTxRequest, BuildTxResponse>,
    cb: sendUnaryData<BuildTxResponse>
  ) => {
    try {
      const { userAddress, pancake } = call.request;

      if (!pancake) throw new Error("Missing pancake payload");

      const { tokenIn, tokenOut, amountInWei, slippageBps } = pancake;

      logger.info(`[buildUnsignedTx] for ${userAddress}`);
      const unsignedTx = await pancakeAdapter.buildSwapTx(
        userAddress,
        tokenIn,
        tokenOut,
        amountInWei,
        slippageBps || 50
      );

      const fullTx = await populateTx(unsignedTx, pancakeAdapter.provider);
      const { from, ...txWithoutFrom } = unsignedTx as any;
      const rawHex = Transaction.from(txWithoutFrom).unsignedSerialized;
      const base64Tx = Buffer.from(rawHex.slice(2), "hex").toString("base64");

      cb(null, {
        unsignedTxBase64: base64Tx,
        txInfo: `Swap ${amountInWei} of ${tokenIn} → ${tokenOut}`,
        txParams: {
          from,
          to: fullTx.to?.toString()!,
          data: fullTx.data!,
          gasLimit: fullTx.gasLimit!.toString(),
          gasPrice: fullTx.gasPrice!.toString(),
          value: fullTx.value?.toString() ?? "0",
          nonce: fullTx.nonce!.toString(),
          chainId: Number(fullTx.chainId),
          type: fullTx.type ?? 0,
        },
      });
    } catch (err: any) {
      logger.error("[buildUnsignedTx] failed", err);
      cb(err);
    }
  };

export const submitSignedTx: TransactionServiceServer["submitSignedTx"] =
  async (call, cb) => {
    try {
      const { signedTxBase64, waitForConfirmation } = call.request;
      const txHex = Buffer.from(signedTxBase64, "base64").toString("hex");

      const provider = pancakeAdapter.provider;
      const txResp = await (
        provider as ethers.JsonRpcProvider
      ).broadcastTransaction(`0x${txHex}`);

      if (waitForConfirmation) await txResp.wait();

      cb(null, {
        txHash: txResp.hash,
        explorerUrl: `https://bscscan.com/tx/${txResp.hash}`,
      });
    } catch (err: any) {
      logger.error("[submitSignedTx] failed", err);
      cb(err);
    }
  };
