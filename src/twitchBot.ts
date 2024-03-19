import { createClient } from "@supabase/supabase-js";
import tmi from "tmi.js";
import { leagueHistory } from "./league";
import {
  SettingsType,
  getBotSettings,
  getUsage,
  increaseUsage,
  saveGeneratedMessage,
  supabase,
} from "./subscriptions";
import { generate } from "./generate/generate";
import { Database } from "./types/types_db";
import { createRealNamesMap, replaceAll } from "./utils";

type ChannelType = {
  channelName: string;
  user: {
    id: string;
    twitch_channel: string | null;
    discord_id: string | null;
  };
  sub: {
    start: Date;
    end: Date;
  };
};

async function getChannels(): Promise<ChannelType[]> {
  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select(
      "user_id, metadata, status, current_period_start, current_period_end"
    )
    .filter("metadata->>SUB_TYPE", "eq", "TWITCH")
    .filter("status", "eq", "active");

  if (!subs) {
    return [];
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id,twitch_channel,discord_id")
    .in(
      "id",
      subs.map((user) => user.user_id)
    );

  const channels = await Promise.all(
    users?.map(async (user) => {
      if (!user || !user.discord_id || !user.twitch_channel) {
        return null;
      }
      const sub = subs.find((s) => s.user_id === user.id);
      if (!sub) {
        return null;
      }

      return {
        channelName: JSON.parse(user.twitch_channel)?.name as string,
        user,
        sub: {
          start: new Date(sub.current_period_start),
          end: new Date(sub.current_period_start),
        },
      };
    }) || []
  );

  return channels.filter((channel) => channel !== null) as ChannelType[];
}

const runClient = async (channels: ChannelType[]) => {
  const opts = {
    identity: {
      username: process.env.TWITCH_USERNAME,
      password: process.env.TWITCH_PASSWORD,
    },
    channels: [...(channels.map((channel) => channel.channelName) || [])],
  };

  const client = new tmi.Client(opts);

  client.on(
    "message",
    async function onMessageHandler(channel, tags, message, self) {
      if (self) {
        return;
      }

      const commandName = message.trim();

      if (commandName === "!react") {
        const channelData = channels.find(
          (c) => `#${c.channelName}` === channel
        );

        if (channelData?.channelName !== tags.username) {
          return;
        }

        if (!channelData) {
          return;
        }
        const { user, sub } = channelData;

        if (!user.discord_id) {
          return;
        }

        const settings = await getBotSettings(user.discord_id);

        if (!settings) {
          await client.say(
            channel,
            `Please update your settings at ${process.env.DASHBOARD_URL}/settings`
          );
          return;
        }

        if (!settings.language?.length) {
          await client.say(
            channel,
            `Please update your language before using this command at ${process.env.DASHBOARD_URL}/settings#language`
          );
          return;
        }

        if (!settings.league_name?.length) {
          await client.say(
            channel,
            `Please update your summoner name before using this command at ${process.env.DASHBOARD_URL}/settings#summoner_name`
          );
          return;
        }

        if (!settings.league_region?.length) {
          await client.say(
            channel,
            `Please update your league region before using this command at ${process.env.DASHBOARD_URL}/settings#region`
          );
          return;
        }

        if (!settings.league_tag?.length) {
          await client.say(
            channel,
            `Please update your tagline before using this command at ${process.env.DASHBOARD_URL}/settings#tagline`
          );
          return;
        }

        if (!settings.twitch_bot_enabled) {
          return;
        }

        client.say(channel, "I will take a look on your latest game 🧐");

        const discordId = user?.discord_id || "";

        const usage = await getUsage(discordId, sub);
        const realNames = createRealNamesMap(settings);
        const match = await leagueHistory({
          summonerName: settings.league_name,
          gameIndex: 1,
          realNames,
          plaftorm: settings.league_region,
          tagLine: settings.league_tag,
          language: settings.language,
        });

        if (match?.stats) {
          const insults = (settings?.custom_slurs?.map(
            (item: { insult: string }) => item.insult
          ) || []) as string[];
          const language = settings.language || "PL";
          const message = await generate({
            stats: match?.stats,
            customInsults: insults,
            lang: language,
            model: "rich",
          });
          const cleaned = replaceAll(message, "**", "");
          await client.say(channel, cleaned);
          await increaseUsage({
            usageRecordId: usage.usageRecordId,
            currentDailyUsage: usage.dailyUsage,
            voiceCharacters: 0,
          });
          await saveGeneratedMessage({
            aliases: realNames,
            customInsults: insults,
            discord_id: discordId,
            language,
            leagueStats: match.stats,
            message,
            model: "rich",
            sub_type: "TWITCH",
          });
        }

        if (match?.error) {
          console.error(match.error);
        }

        console.log(`* Executed ${commandName} command`);
      }
    }
  );

  client.on("connected", function onConnectedHandler(addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
  });

  client.connect();

  return client;
};

export const runTwitchBot = async () => {
  let channels = await getChannels();
  let client = await runClient(channels);
  console.log({ channels });
  setInterval(async () => {
    const newChannels = await getChannels();
    const addedChannels = newChannels.filter(
      (newChannel) =>
        !channels.find(
          (currentChannel) =>
            currentChannel.channelName === newChannel.channelName
        )
    );
    const removedChannels = channels.filter(
      (currentChannel) =>
        !newChannels.find(
          (newChannel) => newChannel.channelName === currentChannel.channelName
        )
    );

    console.log({ newChannels, addedChannels, removedChannels });
    channels = newChannels;
    await Promise.all(
      addedChannels.map(async (channel) => {
        try {
          await client.join(channel.channelName);
        } catch (e) {
          console.log(e);
        }
      })
    );
    await Promise.all(
      removedChannels.map(async (channel) => {
        try {
          await client.part(channel.channelName);
        } catch (e) {
          console.log(e);
        }
      })
    );
  }, 5 * 1000 * 60);
};
