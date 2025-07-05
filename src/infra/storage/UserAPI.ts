import type { AxiosInstance } from "axios";
import { Storage } from "@/infra/storage/Supabase";
import type { PrivyUser } from "@/types/privy";
import type { User, UserRecord } from "@/types/user";

export class UserAPI {
  private db = Storage.getInstance();

  constructor(private http: AxiosInstance) {}

  /** Fetch user from Supabase (or null) */
  async fetch(telegramUserId: string, botId: string): Promise<User | null> {
    const rec = await this.db.getUser(telegramUserId, botId);
    if (!rec) return null;

    const wallets = await this.fetchPrivyWallets(rec.privy_did);
    return { ...rec, wallets };
  }

  /** Create or update the record using fresh Privy user payload */
  async upsertFromPrivy(
    botId: string,
    telegramUserId: string,
    privy: PrivyUser
  ) {
    // pull first EVM + first Solana wallet:
    const evm = privy.linked_accounts.find((w) => w.chain_type === "ethereum");
    if (!evm)
      throw new Error("Embedded EVM wallet missing - cannot trade on BSC");

    const sol = privy.linked_accounts.find((w) => w.chain_type === "solana");

    const record: UserRecord = {
      telegram_user_id: telegramUserId,
      bot_id: botId,
      privy_did: privy.id,
      eth_wallet_id: evm.id ?? "", // embedded EVM returns null id
      eth_address: evm.address,
      eth_delegated: evm.delegated,
      sol_wallet_id: sol?.id ?? null,
      sol_address: sol?.address ?? null,
    };

    await this.db.upsertUser(record);
    return record;
  }

  /* ---------- helpers ---------- */

  private async fetchPrivyWallets(privyDid: string) {
    const { data } = await this.http.get<PrivyUser>(
      `/api/v1/users/${privyDid.replace("did:privy:", "")}`
    );
    return data.linked_accounts;
  }
}
