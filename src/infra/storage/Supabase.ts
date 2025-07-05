import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "@/bootstrap/env";
import type { UserRecord } from "@/types/user";

export class Storage {
  private static instance: Storage;
  readonly db: SupabaseClient;

  private constructor() {
    if (!SUPABASE_KEY || !SUPABASE_URL) {
      throw new Error("❌ Missing supabase env vars. Check .env");
    }

    this.db = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }

  static getInstance() {
    if (!Storage.instance) Storage.instance = new Storage();
    return Storage.instance;
  }

  async upsertUser(record: UserRecord) {
    const { error } = await this.db.from("users").upsert(record, {
      onConflict: "telegram_user_id,bot_id",
    });
    if (error) throw error;
  }

  async getUser(telegramUserId: string, botId: string) {
    const { data, error } = await this.db
      .from("users")
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .eq("bot_id", botId)
      .single();
    if (error && error.code !== "PGRST116") throw error; // 116 = no row
    return data as UserRecord | null;
  }
}
