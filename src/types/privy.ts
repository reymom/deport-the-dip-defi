export type LinkedWallet = {
  id: string;
  type: "wallet";
  delegated: boolean;
  address: string;
  chain_type: "solana" | "ethereum";
};

export type PrivyUser = {
  id: string; // did:privy:...
  linked_accounts: LinkedWallet[];
};
