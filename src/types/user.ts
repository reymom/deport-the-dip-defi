import type { LinkedWallet } from "./privy";

export type UserRecord = {
  telegram_user_id: string; // bigint but use string to avoid JS int overflow
  bot_id: string;
  privy_did: string;

  // at most one wallet per chain for now
  eth_wallet_id: string;
  eth_address: string;
  eth_delegated: boolean;

  sol_wallet_id?: string | null;
  sol_address?: string | null;

  created_at?: string;
  updated_at?: string;
};

/** Convenience wrapper returned by UserAPI */
export type User = Omit<UserRecord, "created_at" | "updated_at"> & {
  wallets: LinkedWallet[]; // raw Privy objects, if caller needs more detail
};
