import { createClient } from "@supabase/supabase-js";
import { LeaguePlatform, LeagueStats } from "./league";
import { Language, ModelType } from "./generate/generate";
import { Database } from "./types/types_db";
import { v4 } from "uuid";

export type SubscriptionType =
  | "FREEMIUM"
  | "DISCORD_LITE"
  | "DISCORD_REGULAR"
  | "DISCORD_PREMIUM"
  | "DISCORD_VOICE"
  | "TWITCH";

export type SubscriptionData = {
  type: SubscriptionType;
  start?: Date;
  end?: Date;
};

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    global: {
      fetch: (...args) => fetch(...args),
    },
  }
);

export const increaseUsage = async ({
  currentDailyUsage,
  usageRecordId,
  voiceCharacters,
  onlyVoice,
}: {
  currentDailyUsage: {
    text: number;
    voice: number;
  };
  usageRecordId: string;
  voiceCharacters: number;
  onlyVoice?: boolean;
}) => {
  if (onlyVoice) {
    await supabase
      .from("discord_usage")
      .update({
        voice_usage_characters: currentDailyUsage.voice + voiceCharacters,
      })
      .eq("id", usageRecordId);
  } else {
    await supabase
      .from("discord_usage")
      .update({
        usage: currentDailyUsage.text + 1,
        voice_usage_characters: currentDailyUsage.voice + voiceCharacters,
      })
      .eq("id", usageRecordId);
  }
};

type UsageType = { text: number; voice: number };

const month = 1000 * 60 * 60 * 24 * 30;

const getSubUsage = async (discordId: string, start: Date, end: Date) => {
  const usage = await supabase
    .from("discord_usage")
    .select("*")
    .eq("discord_id", discordId)
    .gte("created_at", start.toISOString());

  return usage;
};

const getFreemiumUsage = async (discordId: string) => {
  const today = new Date();
  const usage = await supabase
    .from("discord_usage")
    .select("*")
    .eq("discord_id", discordId)
    .lte("cycle_start", today.toISOString())
    .gte("cycle_end", today.toISOString());
  return usage;
};

export const getUsage = async (
  discordId: string,
  sub: {
    start?: Date;
    end?: Date;
  }
): Promise<{
  dailyUsage: UsageType;
  monthlyUsage: UsageType;
  usageRecordId: string;
}> => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const today = new Date();

  const usage = await (async () => {
    if (sub.start && sub.end) {
      return await getSubUsage(discordId, sub.start, sub.end);
    }

    return await getFreemiumUsage(discordId);
  })();

  const dailyUsage = usage.data?.find(
    (record) => new Date(record.created_at).getTime() > dayStart.getTime()
  );

  let usageId = dailyUsage?.id;

  let cycleEnd = usage?.data?.[0]?.cycle_end;
  let cycleStart = usage?.data?.[0]?.cycle_start;

  if (!cycleEnd) {
    if (sub.end) {
      cycleEnd = sub.end.toISOString();
    } else {
      const monthFromNow = new Date();
      monthFromNow.setTime(monthFromNow.getTime() + month);

      cycleEnd = monthFromNow.toISOString();
    }
  }

  if (!cycleStart) {
    if (sub.start) {
      cycleStart = sub.start.toISOString();
    } else {
      cycleStart = today.toISOString();
    }
  }

  if (!usageId) {
    usageId = v4();
    await supabase.from("discord_usage").insert([
      {
        discord_id: discordId,
        id: usageId,
        created_at: today.toISOString(),
        cycle_end: cycleEnd,
        cycle_start: cycleStart,
      },
    ]);
  }

  const initUsage = { text: 0, voice: 0 };

  const monthlyUsage =
    usage?.data?.reduce(
      (acc, record) => {
        acc.text += record.usage || 0;
        acc.voice += record.voice_usage_characters || 0;
        return acc;
      },
      { ...initUsage }
    ) || initUsage;

  return {
    dailyUsage: {
      text: dailyUsage?.usage || 0,
      voice: dailyUsage?.voice_usage_characters || 0,
    },
    monthlyUsage,
    usageRecordId: usageId,
  };
};

export const saveGeneratedMessage = async ({
  discord_id,
  language,
  message,
  sub_type,
  model,
  leagueStats,
  customInsults,
  aliases,
  voiceName,
}: {
  discord_id: string;
  language: Language;
  message: string;
  sub_type: SubscriptionType;
  model: ModelType;
  leagueStats: LeagueStats;
  customInsults: string[];
  aliases: Map<string, string>;
  voiceName?: string | null;
}) => {
  await supabase.from("generated_messages").insert({
    discord_id,
    language,
    message,
    sub_type,
    variables: {
      model,
      leagueStats,
      customInsults,
      aliases: Object.fromEntries(aliases.entries()),
      voiceName,
    },
  });
};

export const getDiscordSubscriptionInfo = async (
  discordId: string
): Promise<SubscriptionData> => {
  try {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (!userData) {
      console.log(`User (${discordId}) not  registered`);
      return {
        type: "FREEMIUM",
      };
    }

    const subInfo = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .eq("user_id", userData.id)
      .maybeSingle();

    if (subInfo.data?.metadata) {
      const type = (subInfo?.data?.metadata as Record<string, string>)
        ?.SUB_TYPE as SubscriptionType;

      const start = new Date(subInfo.data.current_period_start);
      const end = new Date(subInfo.data.current_period_end);

      return { type, start, end };
    }

    const { data: boughtProducts } = await supabase
      .from("bought_products")
      .select("*")
      .eq("user_id", userData.id)
      .order("metadata->>SORT", {
        ascending: false,
      });

    const active = boughtProducts
      ?.map((product) => {
        const duration =
          product.sub_duration === "MONTH" ? 1000 * 60 * 60 * 24 * 30 : 0;
        const expires = new Date(
          new Date(product.created_at).getTime() + duration
        );

        const isExpired = Date.now() > expires.getTime();
        return {
          ...product,
          isExpired,
          expires,
        };
      })
      .filter((s) => !s.isExpired);

    const sub = active?.[0];
    if (!sub) {
      return {
        type: "FREEMIUM",
      };
    }

    return {
      type: sub.sub_type as SubscriptionType,
      start: new Date(sub.created_at),
      end: sub.expires,
    };
  } catch (error) {
    console.error(error);
  }

  return {
    type: "FREEMIUM",
  };
};

export type SettingsType = {
  league_region?: LeaguePlatform;
  language?: Language;
  league_name?: string;
  league_tag?: string;
  league_aliases?: {
    summoner: string;
    realName: string;
  }[];
  custom_slurs?: {
    insult: string;
  }[];
  twitch_bot_enabled?: boolean;
  encrypted_eleven_labs_api_key?: string | null;
  eleven_labs_voice_id?: string | null;
  using_eleven_labs_default?: boolean | null;
};
export const getBotSettings = async (
  discordId: string
): Promise<SettingsType | null> => {
  try {
    // First, get the user ID(s) from the users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("discord_id", discordId);

    if (!userData?.length) {
      console.log(`User (${discordId}) not  registered`);
      return null;
    }

    // Then, use the retrieved user ID to count subscriptions
    const settings = await supabase
      .from("settings")
      .select("*")
      .in(
        "user_id",
        userData.map((user) => user.id)
      );

    return settings?.data?.[0] as unknown as SettingsType;
  } catch (error) {
    console.error(error);
  }

  return null;
};
