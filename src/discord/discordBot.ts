import { REST } from "@discordjs/rest";

import { Routes } from "discord-api-types/v10";
import { ChatInputCommandInteraction, Client } from "discord.js";
import { Language } from "../generate/generate";
import {
  SubscriptionType,
  getBotSettings,
  getDiscordSubscriptionInfo,
} from "../subscriptions";

import { LeaguePlatform, availablePlatforms } from "../league";
import { replaceAll } from "../utils";
import { translate } from "../translations";
import { LimitsType, commonFlow } from "./commonFlow";
import { commonCustomFlow } from "./commonCustomFlow";
import { uploadVoices } from "../elevenlabs/uploadVoices";
import { commonJokeFlow } from "./commonJokeFlow";
import { jokeTopics } from "../generate/generateJoke";
import { getElevenUsage } from "../elevenlabs/status";

const token = process.env["BOT_TOKEN"] || "";

const client = new Client({
  intents: ["Guilds", "GuildMessages", "GuildVoiceStates"],
});
const MAX_CUSTOM_TEXT_LENGTH = 600;
const commonOptions = [
  {
    name: "playername",
    type: 3, // STRING
    description: "The league name of the player",
    required: true,
  },
  {
    name: "tagline",
    type: 3, // STRING
    description: 'Tagline (eg. EUNE, without the "#")',
    required: false,
  },
  {
    name: "index",
    type: 4, // INTEGER
    description:
      "Optional index for the game. Type '2' to get a game before the last, etc.",
    required: false,
  },
  {
    name: "language",
    type: 3,
    description: "Language PL or ENG, default: PL",
    required: false,
    choices: [
      {
        name: "Polski",
        value: "PL",
      },
      {
        name: "English",
        value: "ENG",
      },
      // {
      //   name: "Śląski",
      //   value: "ŚLĄSKI",
      // },
      // {
      //   name: "Gen Z (PL)",
      //   value: "GEN_Z_PL",
      // },
    ],
  },
  {
    name: "gameid",
    type: 3, // INTEGER
    description: "Optional id of the game. Last game is taken if not provided",
    required: false,
  },
  {
    name: "region",
    type: 3,
    description: "Abused player's League of Legends region, default - EUN1",
    required: false,
    choices: availablePlatforms.map((region) => ({
      name: region,
      value: region,
    })),
  },
];

export let defaultVoices: {
  name: string;
  value: string;
  isPremium: boolean;
  description: string;
}[];

const getCommands = async () => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY || "",
    },
  };

  const response = await fetch(`https://api.elevenlabs.io/v1/voices`, options);

  const json = await response.json();

  let voices = json.voices.filter(
    (voice: { category: string }) => voice.category !== "premade"
  );

  if (voices.length === 0) {
    console.log("No voices found. Uploading from samples...");
    voices = await uploadVoices();
  }

  defaultVoices = voices.map(
    (voice: {
      name: string;
      voice_id: string;
      isPremium: boolean;
      description: string;
    }) => ({
      name: voice.name,
      value: voice.voice_id,
      isPremium: voice.name.includes("[PREMIUM]"),
      description: voice.description,
    })
  );

  const voicesOption = {
    name: "voice",
    type: 3, // STRING
    description: "Voice of the abuser",
    required: false,
    choices: defaultVoices.map((voice) => ({
      ...voice,
      name: voice.name.replace("[PREMIUM]", "⭐"),
    })),
  };

  return [
    {
      name: "abusevoice",
      description:
        "Join current voice channel and abuse a player based on name and game index",
      options: [...commonOptions, voicesOption],
    },
    {
      name: "abuse",
      description: "Abuse a player on chat based on name and game index",
      options: [...commonOptions],
    },
    {
      name: "abusecustom",
      description:
        "Join current voice channel and speak whatever you want in choosen voice",
      options: [
        {
          name: "text",
          type: 3, // STRING
          description: `Text (max ${MAX_CUSTOM_TEXT_LENGTH} characters)`,
          required: true,
        },
        voicesOption,
      ],
    },
    {
      name: "abusejoke",
      description:
        "Join current voice channel and tell a joke in the topic you want in choosen voice",
      options: [
        {
          name: "topic",
          type: 3, // STRING
          description: `Topic`,
          required: false,
          choices: jokeTopics.map((topic) => ({ name: topic, value: topic })),
        },
        voicesOption,
        {
          name: "language",
          type: 3,
          description: "Language PL or ENG, default: PL",
          required: false,
          choices: [
            {
              name: "Polski",
              value: "PL",
            },
            {
              name: "English",
              value: "ENG",
            },
          ],
        },
      ],
    },
    {
      name: "abuseme",
      description: "Abuse yourself on chat (if all settings are set)",
      options: [
        {
          name: "index",
          type: 4, // INTEGER
          description:
            "Optional index for the game. Type '2' to get a game before the last, etc.",
          required: false,
        },
        {
          name: "gameid",
          type: 3, // INTEGER
          description:
            "Optional id of the game. Last game is taken if not provided",
          required: false,
        },
      ],
    },
  ];
};
const registerCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Started refreshing application (/) commands.");
    const commands = await getCommands();
    // Registering commands globally instead of for a specific guild
    await rest.put(Routes.applicationCommands(client?.user?.id || ""), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
};

export const getOptions = (interaction: ChatInputCommandInteraction) => {
  const playerNameRequired =
    interaction.commandName === "abuse" ||
    interaction.commandName === "abusevoice";

  let playerName = String(
    interaction.options.get("playername", playerNameRequired)?.value
  );

  let tagLine = interaction.options.get("tagline", false)?.value as
    | string
    | undefined;

  if (playerName.includes("#")) {
    [playerName, tagLine] = playerName.split("#");
  }

  let index = interaction.options.get("index", false)?.value as
    | number
    | undefined;

  let gameId = interaction.options.get("gameid", false)?.value as
    | string
    | undefined;

  let lang = interaction.options.get("language", false)?.value as Language;

  const plaftorm = interaction.options.get("region", false)?.value as
    | LeaguePlatform
    | undefined;

  const voiceId = interaction.options.get("voice", false)?.value as
    | string
    | undefined;

  const customTextRequired = interaction.commandName === "abusecustom";

  const customText = interaction.options.get("text", customTextRequired)
    ?.value as string | undefined;

  const jokeTopic = interaction.options.get("topic", false)?.value as
    | string
    | undefined;

  if (customText && customText.length > MAX_CUSTOM_TEXT_LENGTH) {
    reply(
      interaction,
      `Custom text can have only ${MAX_CUSTOM_TEXT_LENGTH} characters`,
      true
    );
    return;
  }

  if (index && isNaN(Number(index))) {
    reply(interaction, `${index}? That does not look like a number...`, true);
    return;
  }

  if (!lang) {
    lang = localesMap.get(interaction.locale) || "ENG";
  }

  if (
    lang !== "ENG" &&
    lang !== "PL" &&
    lang !== "ŚLĄSKI" &&
    lang !== "GEN_Z_PL"
  ) {
    reply(interaction, `Language ${lang} is not supported (yet)`, true);
    return;
  }

  if (!playerName) {
    reply(interaction, "Whom should I abuse? 🤷🤷", true);
    return;
  }

  return {
    playerName,
    index,
    gameId,
    lang,
    plaftorm,
    voiceId,
    tagLine: tagLine ? replaceAll(tagLine, "#", "") : undefined,
    customText,
    topic: jokeTopic,
  };
};

export type OptionsType = ReturnType<typeof getOptions>;

export const discordServer = "https://discord.gg/PUSx3hSfJJ";
const activeCommands = new Map();
const failedCommandsCount = new Map<string, number>();

export const reply = async (
  interaction: ChatInputCommandInteraction,
  message: string,
  fail: boolean,
  error?: boolean
) => {
  const { commandName } = interaction;
  const discordId = interaction.user.id;

  console.log(`Reply to ${discordId} command ${commandName}: ${message}`);

  activeCommands.delete(discordId);

  if (interaction.replied) {
    console.log(`Interaction was already replied`);
    return;
  }

  let msg = message;
  if (fail || error) {
    const failedCount = failedCommandsCount.get(discordId);
    if (!failedCount) {
      failedCommandsCount.set(discordId, 1);
    } else if (failedCount === 2) {
      msg += `\nHaving trouble using bot? Get help at ${discordServer}`;
      failedCommandsCount.set(discordId, 0);
    } else {
      failedCommandsCount.set(discordId, failedCount + 1);
    }
  } else {
    failedCommandsCount.set(discordId, 0);
  }
  try {
    if (fail && !interaction.deferred) {
      return interaction.reply({
        ephemeral: true,
        content: msg,
      });
    }

    return interaction.editReply(msg);
  } catch (e) {
    console.log("Could not reply", e);
  }
};

const localesMap = new Map<string, Language>([
  ["en-US", "ENG"],
  ["pl", "PL"],
]);

const defaultLimits = {
  MAX_DAILY_BASIC_REQUESTS: 10,
  MAX_MONTHLY_ELEVEN_LABS_CHARACTERS: 500,
  MAX_MONTHLY_OPENAI_VOICE_CHARACTERS: 2400,
  MAX_MONTHLY_RICH_REQUESTS: 5,
};

const getLimits = async () => {
  try {
    const res = await fetch(`${process.env.DASHBOARD_URL}/api/limits`);
    const limits = await res.json();
    return limits as Record<SubscriptionType, LimitsType>;
  } catch (e) {
    console.log(e);
    return {} as Record<SubscriptionType, undefined>;
  }
};

export const runDiscordBot = async () => {
  const limitsMap = await getLimits();
  const logUsage = async () => {
    const ELEVEN_LABS_USAGE = await getElevenUsage();
    console.log({ ELEVEN_LABS_USAGE });
  };
  logUsage();
  setInterval(logUsage, 1000 * 60 * 5);

  client.once("ready", () => {
    console.log("Logged in as", client?.user?.tag || "");
    registerCommands();
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (
        !interaction.isCommand() ||
        !(interaction instanceof ChatInputCommandInteraction)
      ) {
        return;
      }

      const discordId = interaction.user.id;

      const { commandName } = interaction;

      console.log(
        `${
          interaction.user.globalName
        } (${discordId}) used command ${commandName} with options ${interaction.options.data
          .map((option) => {
            if (option.name !== "voice") {
              return `${option.name}: ${option.value} `;
            }

            return `${option.name}: ${
              defaultVoices.find((voice) => voice.value === option.value)?.name
            } `;
          })
          .join(", ")}`
      );

      const options = await getOptions(interaction);

      console.log({ locale: interaction.locale });

      const lang = options?.lang || "ENG";

      if (activeCommands.get(discordId)) {
        await reply(interaction, translate(lang, "command_timeout"), true);
        return;
      }

      const settings = (await getBotSettings(discordId)) || {};

      activeCommands.set(discordId, commandName);

      const subData = await getDiscordSubscriptionInfo(discordId);
      console.log({ subData });
      const subType = subData?.type;

      if (options?.voiceId) {
        const voice = defaultVoices.find(
          (voice) => voice.value === options.voiceId
        );
        if (voice?.isPremium && subType === "FREEMIUM") {
          await reply(
            interaction,
            translate(lang, "premium_voice", {
              dashboard_url: process.env.DASHBOARD_URL || "",
            }),
            true
          );
          return;
        }
      }

      const limits = limitsMap[subType || "FREEMIUM"] || defaultLimits;

      if (!options) {
        return;
      }

      if (commandName === "abuse") {
        await commonFlow({
          interaction,
          options,
          settings,
          voice: false,
          limits,
          subData,
        });

        return;
      }

      if (commandName === "abuseme") {
        if (!settings) {
          await reply(
            interaction,
            `Please update your settings before using this command at ${process.env.DASHBOARD_URL}/settings`,
            true
          );

          return;
        }

        if (!settings.language?.length) {
          await reply(
            interaction,
            `Please update your language before using this command at ${process.env.DASHBOARD_URL}/settings#language`,
            true
          );

          return;
        }

        if (!settings.league_name?.length) {
          await reply(
            interaction,
            `Please update your summoner name before using this command at ${process.env.DASHBOARD_URL}/settings#summoner_name`,
            true
          );

          return;
        }

        if (!settings.league_region?.length) {
          await reply(
            interaction,
            `Please update your league region before using this command at ${process.env.DASHBOARD_URL}/settings#region`,
            true
          );

          return;
        }

        if (!settings.league_tag?.length) {
          await reply(
            interaction,
            `Please update your tagline before using this command at ${process.env.DASHBOARD_URL}/settings#tagline`,
            true
          );

          return;
        }

        let index = interaction.options.get("index", false)?.value as
          | number
          | undefined;

        let gameId = interaction.options.get("gameid", false)?.value as
          | string
          | undefined;

        const options = {
          index,
          gameId,
          lang: settings.language,
          playerName: settings.league_name,
          plaftorm: settings.league_region,
          voiceId: undefined,
          tagLine: settings.league_tag,
          customText: undefined,
          topic: undefined,
        };

        await commonFlow({
          interaction,
          options,
          settings,
          voice: false,
          limits,
          subData,
        });
      }

      if (commandName === "abusevoice") {
        await commonFlow({
          interaction,
          options,
          settings,
          voice: true,
          limits,
          subData,
        });
      }

      if (commandName === "abusecustom") {
        if (!options.customText) {
          return;
        }

        if (subType === "FREEMIUM") {
          await reply(
            interaction,
            translate(lang, "premium_command", {
              dashboard_url: process.env.DASHBOARD_URL || "",
            }),
            true
          );
          return;
        }

        await commonCustomFlow({
          interaction,
          options,
          settings,
          voice: true,
          customMessage: options.customText,
          limits,
          subData,
        });
      }

      if (commandName === "abusejoke") {
        await commonJokeFlow({
          interaction,
          options,
          settings,
          voice: true,
          topic: options.topic,
          limits,
          subData,
        });
      }
    } catch (e) {
      console.log({ e });
    }
  });

  client.login(token);
};
