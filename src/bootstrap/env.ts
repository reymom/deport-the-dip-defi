import "dotenv/config";
import { config } from "dotenv";

config({ path: "../.env" });

const BSC_RPC = process.env.BSC_RPC!;
const BOT_ID = process.env.BOT_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const GRPC_HOST = process.env.GRPC_HOST as string;
const GRPC_PORT = parseInt(process.env.GRPC_PORT as string);

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
const PRIVY_AUTH_API_BASE = "https://auth.privy.io/api/v1";
const PRIVY_API_BASE = "https://api.privy.io";
const PRIVY_SIGNING_KEY = process.env.PRIVY_SIGNING_KEY ?? "";

export {
  BSC_RPC,
  BOT_ID,
  GRPC_HOST,
  GRPC_PORT,
  SUPABASE_URL,
  SUPABASE_KEY,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  PRIVY_SIGNING_KEY,
  PRIVY_AUTH_API_BASE,
  PRIVY_API_BASE,
};
