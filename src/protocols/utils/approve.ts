import { logger } from "@/bootstrap/logger";
import type { TransactionRequest } from "ethers";
import { Contract, ethers, type Signer } from "ethers";

const ERC20_MIN_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
] as const;

/**
 * Ensure `dst` can pull **at least** `amountWei` from `owner`.
 * If allowance is too low we send *one* `approve` tx for the exact amount.
 *
 * @param token      ERC-20 contract address
 * @param owner      address that will pay / sign
 * @param amountWei  bigint amount that will be spent
 * @param dst        spender address (e.g. Pancake router)
 * @param signer     signer able to submit transactions from `owner`
 */
export async function ensureAllowance(
  token: string,
  owner: string,
  amountWei: bigint,
  dst: string,
  signer: Signer
) {
  const erc20 = new Contract(token, ERC20_MIN_ABI, signer);

  /* current allowance ----------------------------------------------------- */
  const current: bigint = await erc20.allowance(owner, dst);
  logger.info(
    `[ensureAllowance] current: ${current.toString()} -> amountWei: ${amountWei}`
  );
  if (current >= amountWei) return;

  const approveTxReq = await erc20
    .getFunction("approve")
    .populateTransaction(dst, amountWei);

  approveTxReq.from = owner;

  /* send & wait ----------------------------------------------------------- */
  logger.info(
    `[ensureAllowance] sending transaction: ${JSON.stringify(
      approveTxReq,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )}`
  );

  try {
    const resp = await signer.sendTransaction(approveTxReq);
    await resp.wait();
    logger.info(`[allowance] approve mined → ${resp.hash}`);
    return;
  } catch (err: any) {
    const duplicate =
      err?.message?.includes("already known") ||
      err?.error?.message?.includes("already known");

    if (duplicate) {
      logger.warn("[allowance] pending duplicate detected - cancelling nonce");
      await cancelPendingTx(signer, approveTxReq.nonce!, 200n);
    }
  }
}

async function cancelPendingTx(
  signer: ethers.Signer, // delegated signer
  nonce: number, // 0 in your case
  gasPriceGwei = 200n // something > previous 100 gwei
) {
  const cancelTx = {
    from: await signer.getAddress(),
    to: await signer.getAddress(), // self-send
    value: 0,
    nonce,
    gasPrice: gasPriceGwei * 10n ** 9n,
    gasLimit: 21_000,
  };
  const resp = await signer.sendTransaction(cancelTx);
  await resp.wait(); // mined -> nonce 0 is now used
}
