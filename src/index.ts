import dotenv from "dotenv";
dotenv.config({});

import { runDiscordBot } from "./discord/discordBot";
import { runTwitchBot } from "./twitchBot";

runDiscordBot();
if (process.env.ENVIRONMENT !== "dev") {
  console.log("Run Twitch Bot");
  runTwitchBot();
}
