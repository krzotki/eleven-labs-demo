import { joinVoiceChannel } from "@discordjs/voice";
import {
  CacheType,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";

import { OptionsType, defaultVoices, discordServer, reply } from "./discordBot";
import {
  SettingsType,
  SubscriptionData,
  SubscriptionType,
  getUsage,
  increaseUsage,
} from "../subscriptions";
import { decryptFunction, replaceAll } from "../utils";
import { translate } from "../translations";
import { LimitsType, abuseOnVC } from "./commonFlow";
import { generateJoke } from "../generate/generateJoke";

const defaultPremadeVoiceId = "29vD33N1CtxCmqQRPOHJ"; //DREW

export const commonJokeFlow = async ({
  interaction,
  options,
  voice,
  settings,
  limits,
  subData,
  topic,
}: {
  interaction: ChatInputCommandInteraction<CacheType>;
  options: OptionsType;
  voice: boolean;
  settings: SettingsType | null;
  subData: SubscriptionData;
  limits: LimitsType;
  topic?: string;
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
      const withPauses = replaceAll(message, "...", '<break time="3.0s" />');
      try {
        await abuseOnVC({
          connection,
          message: withPauses,
          elevenLabsVoice,
          voiceLabSettings,
        });
        console.log("Succesfully custom-abused on voice channel");
      } catch (e) {
        console.error("Custom abuse error", e);
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
    MAX_MONTHLY_ELEVEN_LABS_CHARACTERS,
    MAX_MONTHLY_OPENAI_VOICE_CHARACTERS,
  } = limits;
  const discordId = interaction.user.id;

  const { lang } = options;

  const { dailyUsage, monthlyUsage, usageRecordId } = await getUsage(
    discordId,
    subData
  );

  console.log({ dailyUsage, monthlyUsage, usageRecordId });

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

  if (!interaction.deferred) {
    await interaction.deferReply();
  }

  const selectedVoice = voice
    ? defaultVoices.find((voice) => voice.value === voiceLabSettings.voiceId)
    : null;

  const message = await generateJoke({
    lang,
    model: "rich",
    voice: selectedVoice?.name,
    topic,
  });

  await increaseUsage({
    currentDailyUsage: dailyUsage,
    usageRecordId,
    voiceCharacters: isUsingDefaultElevenLabsVoices ? message.length : 0,
    onlyVoice: true,
  });

  await chatCallback({
    elevenLabsVoice: canUseElevenLabsVoice,
    message,
    voice,
    voiceLabSettings,
  });
};
