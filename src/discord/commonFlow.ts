import {
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from "@discordjs/voice";
import {
  CacheType,
  ChatInputCommandInteraction,
  GuildMember,
  Interaction,
} from "discord.js";
import { changeNumbersToText } from "../numbersToText";
import { Language, ModelType, generate, openai } from "../generate/generate";
import { Readable } from "stream";
import { leagueHistory } from "../league";
import {
  OptionsType,
  defaultVoices,
  discordServer,
  getOptions,
  reply,
} from "./discordBot";
import {
  SettingsType,
  SubscriptionData,
  SubscriptionType,
  getBotSettings,
  getUsage,
  increaseUsage,
  saveGeneratedMessage,
} from "../subscriptions";
import { createRealNamesMap, decryptFunction, replaceAll } from "../utils";
import { translate } from "../translations";

const defaultPremadeVoiceId = "29vD33N1CtxCmqQRPOHJ"; //DREW

// needs this https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-2023-12-18-git-be8a4f80b9-full_build.7z
export const abuseOnVC = async ({
  connection,
  message,
  elevenLabsVoice,
  voiceLabSettings,
}: {
  connection: VoiceConnection;
  message: string;
  elevenLabsVoice: boolean;
  voiceLabSettings?: {
    apiKey: string;
    voiceId: string;
  };
}) => {
  let response: Response;

  if (elevenLabsVoice && voiceLabSettings) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": voiceLabSettings.apiKey,
      },
      body: JSON.stringify({
        model_id: "eleven_multilingual_v2",
        text: message,
      }),
    };

    const voiceId = voiceLabSettings.voiceId;

    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4`,
      options
    );
    console.log({ elevenResponse: response.status });
  } else {
    response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: message,
      speed: 1,
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const player = createAudioPlayer();

  const readableStream = new Readable();
  readableStream.push(buffer);
  readableStream.push(null); // End of the stream

  const resource = createAudioResource(readableStream);

  player.play(resource);

  // try this
  // connection.playOpusPacket();
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  });

  player.on(AudioPlayerStatus.AutoPaused, () => {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  });

  player.on(AudioPlayerStatus.Paused, () => {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  });
};

export const getVoiceIdByName = (name?: string) => {
  return defaultVoices.find((voice) => voice.name === name)?.value;
};

export type LimitsType = {
  MAX_DAILY_BASIC_REQUESTS?: number;
  MAX_MONTHLY_BASIC_REQUESTS?: number;
  MAX_MONTHLY_ELEVEN_LABS_CHARACTERS: number;
  MAX_MONTHLY_OPENAI_VOICE_CHARACTERS: number;
  MAX_MONTHLY_RICH_REQUESTS: number;
};

export const commonFlow = async ({
  interaction,
  options,
  voice,
  settings,
  limits,
  subData,
}: {
  interaction: ChatInputCommandInteraction<CacheType>;
  options: OptionsType;
  voice: boolean;
  settings: SettingsType | null;
  subData: SubscriptionData;
  limits: LimitsType;
}) => {
  const chatCallback = async ({
    elevenLabsVoice,
    message,
    voice,
    voiceLabSettings,
  }: {
    message: string;
    voice: boolean;
    elevenLabsVoice: boolean;
    voiceLabSettings: {
      apiKey: string;
      voiceId: string;
    };
  }) => {
    // if on voice channel, join and abuse
    if (
      voice &&
      interaction.guild &&
      interaction.member instanceof GuildMember &&
      interaction.member.voice.channel
    ) {
      const connection = joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      console.log("Connected to voice channel");
      const messageAdjustedForVC = await changeNumbersToText(message, language);
      const cleaned = replaceAll(messageAdjustedForVC, "**", "");
      try {
        await abuseOnVC({
          connection,
          message: cleaned.length > 200 ? cleaned : message,
          elevenLabsVoice,
          voiceLabSettings,
        });
        console.log("Succesfully abused on voice channel");
      } catch (e) {
        console.error("Premium flow abuseVoice error", e);
      }
      await reply(interaction, message, false);
      return true;
    }

    // else just send the message
    await reply(interaction, message, false);
    return false;
  };

  if (!options) {
    return;
  }

  const {
    MAX_DAILY_BASIC_REQUESTS,
    MAX_MONTHLY_BASIC_REQUESTS,
    MAX_MONTHLY_ELEVEN_LABS_CHARACTERS,
    MAX_MONTHLY_OPENAI_VOICE_CHARACTERS,
    MAX_MONTHLY_RICH_REQUESTS,
  } = limits;
  const discordId = interaction.user.id;

  const { gameId, index, lang, playerName, plaftorm, tagLine } = options;

  const { dailyUsage, monthlyUsage, usageRecordId } = await getUsage(
    discordId,
    subData
  );

  const model: ModelType =
    monthlyUsage.text < MAX_MONTHLY_RICH_REQUESTS ? "rich" : "basic";

  const isUsingDefaultElevenLabsVoices =
    typeof settings?.using_eleven_labs_default === "boolean"
      ? settings.using_eleven_labs_default
      : true;

  const canUseElevenLabsVoice =
    monthlyUsage.voice < MAX_MONTHLY_ELEVEN_LABS_CHARACTERS ||
    !isUsingDefaultElevenLabsVoices;

  const canUseOpenAiVoice =
    monthlyUsage.voice <
    MAX_MONTHLY_ELEVEN_LABS_CHARACTERS + MAX_MONTHLY_OPENAI_VOICE_CHARACTERS;

  const language = lang || settings?.language || "PL";

  console.log({
    dailyUsage,
    monthlyUsage,
    usageRecordId,
    language,
  });

  const eleven_labs_api_key = settings?.encrypted_eleven_labs_api_key
    ? decryptFunction(settings.encrypted_eleven_labs_api_key)
    : null;

  const defaultVoiceId =
    defaultVoices.find((voice) => voice.name === "Korwin")?.value ||
    defaultVoices[0].value;

  const getVoiceLabSettings = () => {
    if (settings && eleven_labs_api_key && !isUsingDefaultElevenLabsVoices) {
      return {
        apiKey: eleven_labs_api_key,
        voiceId: settings.eleven_labs_voice_id || defaultPremadeVoiceId,
      };
    }

    return {
      apiKey: process.env.ELEVEN_LABS_API_KEY || "",
      voiceId: options.voiceId || defaultVoiceId,
    };
  };

  const voiceLabSettings = getVoiceLabSettings();

  if (
    MAX_MONTHLY_BASIC_REQUESTS &&
    monthlyUsage.text >= MAX_MONTHLY_BASIC_REQUESTS + MAX_MONTHLY_RICH_REQUESTS
  ) {
    await reply(
      interaction,
      translate(language, "monthly_requests_reached", {
        max_requests: MAX_MONTHLY_BASIC_REQUESTS + MAX_MONTHLY_RICH_REQUESTS,
        dashboard_url: process.env.DASHBOARD_URL || "",
        discord_server_url: discordServer,
      }),
      true
    );

    return;
  }

  if (MAX_DAILY_BASIC_REQUESTS && dailyUsage.text >= MAX_DAILY_BASIC_REQUESTS) {
    await reply(
      interaction,
      translate(language, "daily_requests_reached", {
        max_daily_requests: MAX_DAILY_BASIC_REQUESTS,
        dashboard_url: process.env.DASHBOARD_URL || "",
        discord_server_url: discordServer,
      }),
      true
    );

    return;
  }

  if (voice && !isUsingDefaultElevenLabsVoices && !eleven_labs_api_key) {
    await reply(
      interaction,
      translate(language, "set_eleven_labs_key", {
        dashboard_url: process.env.DASHBOARD_URL || "",
      }),
      true
    );

    return;
  }

  if (
    voice &&
    !(canUseElevenLabsVoice || canUseOpenAiVoice) &&
    isUsingDefaultElevenLabsVoices
  ) {
    await reply(
      interaction,
      translate(language, "monthly_voice_reached", {
        dashboard_url: process.env.DASHBOARD_URL || "",
        discord_server_url: discordServer,
      }),
      true
    );

    return;
  }

  if (voice && options.voiceId && !canUseElevenLabsVoice) {
    await reply(
      interaction,
      translate(language, "monthly_rich_voice_reached", {
        dashboard_url: process.env.DASHBOARD_URL || "",
        discord_server_url: discordServer,
      }),
      true
    );
    return;
  }

  if (voice && options.voiceId && !isUsingDefaultElevenLabsVoices) {
    await reply(
      interaction,
      translate(language, "custom_voices_active", {
        dashboard_url: process.env.DASHBOARD_URL || "",
      }),
      true
    );

    return;
  }

  // Maybe check subscription
  const realNames = createRealNamesMap(settings);

  const insults = (settings?.custom_slurs?.map(
    (item: { insult: string }) => item.insult
  ) || []) as string[];

  const getTagline = () => {
    if (tagLine) {
      return tagLine;
    }

    if (settings?.league_tag === playerName) {
      return settings.league_tag;
    }

    return undefined;
  };

  const match = await leagueHistory({
    summonerName: playerName,
    gameIndex: index,
    gameId,
    plaftorm: plaftorm || settings?.league_region,
    realNames,
    tagLine: getTagline(),
    language,
  });

  if (match?.stats) {
    if (!interaction.deferred) {
      await interaction.deferReply();
    }

    const selectedVoice = voice
      ? defaultVoices.find((voice) => voice.value === voiceLabSettings.voiceId)
      : null;

    const message = await generate({
      // Maybe check subscription
      customInsults: insults,
      stats: match.stats,
      lang: language,
      model,
      voice: selectedVoice?.description,
    });

    if (message.length < 100) {
      await reply(interaction, message, false, true);
      return;
    }

    await increaseUsage({
      currentDailyUsage: dailyUsage,
      usageRecordId,
      voiceCharacters: isUsingDefaultElevenLabsVoices ? message.length : 0,
    });

    await chatCallback({
      elevenLabsVoice: canUseElevenLabsVoice,
      message,
      voice,
      voiceLabSettings,
    });

    await saveGeneratedMessage({
      aliases: realNames,
      customInsults: insults,
      discord_id: discordId,
      language,
      leagueStats: match.stats,
      message,
      model,
      sub_type: subData.type,
      voiceName: selectedVoice?.name,
    });
  } else {
    await reply(
      interaction,
      match?.error || translate(language, "generic_error"),
      true
    );
  }
};
