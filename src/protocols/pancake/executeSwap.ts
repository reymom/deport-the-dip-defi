import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js";
import type {
  SwapRequest,
  SwapResponse,
  SwapServiceServer,
} from "@/generated/pancake";

import {
  PANCAKE_ROUTER,
  PancakeAdapter,
} from "@/protocols/pancake/PancakeAdapter";
import { getDelegatedSigner } from "@/infra/privy/Signer";
import { logger } from "@/bootstrap/logger";
import { ensureAllowance } from "../utils/approve";

const adapter = new PancakeAdapter();

export const executeSwap: SwapServiceServer["executeSwap"] = async (
  call: ServerUnaryCall<SwapRequest, SwapResponse>,
  cb: sendUnaryData<SwapResponse>
) => {
  try {
    const { user, tokenIn, tokenOut, amountInWei, slippageBps } = call.request;
    logger.info(
      `[executeSwap] call with ${JSON.stringify(
        call.request,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      )}`
    );

    if (!user) throw new Error("Undefined user in params");

    const signer = getDelegatedSigner(user);
    const amountBN = BigInt(amountInWei);

    logger.info("[executeSwap] we got a signer, trying to ensure allowance...");
    await ensureAllowance(
      tokenIn,
      user.address,
      amountBN,
      PANCAKE_ROUTER,
      signer
    );

    logger.info("[executeSwap] we got allowance, trying to build swap tx...");
    const txReq = await adapter.buildSwapTx(
      user.address,
      tokenIn,
      tokenOut,
      amountInWei,
      slippageBps || 50
    );

    logger.info(
      `[txReq] = ${JSON.stringify(
        txReq,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2
      )}`
    );
    const txResp = await signer.sendTransaction(txReq);
    await txResp.wait();

    cb(null, {
      txHash: txResp.hash,
      status: "SUBMITTED",
      error: "",
      code: "200",
    });
  } catch (err: any) {
    logger.error(`[executeSwap] error: ${err}`);

    // -------- normalise --------
    let code = "UNKNOWN";
    let msg = err?.shortMessage ?? err?.message ?? String(err);

    switch (err?.code) {
      case "INSUFFICIENT_FUNDS":
        code = "INSUFFICIENT_GAS";
        break;
      case "CALL_EXCEPTION":
        if (/TRANSFER_FROM_FAILED/i.test(msg)) code = "ALLOWANCE";
        else code = "REVERT";
        break;
      case "UNKNOWN_ERROR":
        if (/already known/i.test(err?.error?.message ?? "")) {
          code = "DUPLICATE_TX";
          msg = "Transaction already in mem-pool";
        }
        break;
      default:
        // keep UNKNOWN
        break;
    }

    cb(null, {
      txHash: "",
      status: "FAILED",
      error: msg,
      code,
    });
  }
};
