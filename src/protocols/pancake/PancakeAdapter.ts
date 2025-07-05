import { ethers, Contract, Wallet } from "ethers";
import routerAbi from "@/abis/PancakeRouter.json";
import { BSC_RPC } from "@/bootstrap/env";
import { logger } from "@/bootstrap/logger";

export const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const WBNB = "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export class PancakeAdapter {
  readonly provider = new ethers.JsonRpcProvider(BSC_RPC);
  readonly router: Contract;

  constructor() {
    this.router = new Contract(PANCAKE_ROUTER, routerAbi, this.provider);
  }

  /**
   * Builds an **unsigned** `swapExactTokensForTokens` tx.
   *
   * @param senderAddr  EOA (or delegated Privy wallet) that will sign & pay
   * @param tokenIn  erc-20 address
   * @param tokenOut erc-20 address
   * @param amountInWei  stringified wei amount
   * @param slippageBps  e.g. 50 = 0.50 %
   */
  async buildSwapTx(
    senderAddress: string,
    tokenIn: string,
    tokenOut: string,
    amountInWei: string,
    slippageBps = 50
  ) {
    const path = await this.autoPath(tokenIn, tokenOut);
    logger.info(`[buildSwapTx] path: ${path}`);

    const amountsOut: bigint[] = await this.router.getAmountsOut(
      amountInWei,
      path
    );
    const amountOutWei = amountsOut[amountsOut.length - 1];

    const amountOutMin =
      (amountOutWei * BigInt(10_000 - slippageBps)) / BigInt(10_000);

    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    const fn = this.router.getFunction("swapExactTokensForTokens");
    logger.info("[buildSwapTx] going to populate transaction");
    const tx = await fn.populateTransaction(
      amountInWei,
      amountOutMin,
      path,
      senderAddress,
      deadline
    );
    tx.from = senderAddress;
    tx.to = PANCAKE_ROUTER;

    return tx;
  }

  private async autoPath(tokenIn: string, tokenOut: string): Promise<string[]> {
    // quick on-chain test: does a pair exist?
    const factory = new Contract(
      "0xca143ce32fe78f1f7019d7d551a6402fc5350c73", // PancakeFactoryV2
      ["function getPair(address,address) view returns (address)"],
      this.provider
    );

    const direct = await factory.getPair(tokenIn, tokenOut);
    if (direct !== ethers.ZeroAddress) return [tokenIn, tokenOut];

    // fall-back through WBNB
    return [tokenIn, WBNB, tokenOut];
  }
}
