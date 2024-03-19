import { OpenAI } from "openai";
import { getContextSR } from "./generateSR";
import { getContextARAM } from "./generateARAM";
import { getContextARENA } from "./generateARENA";
import { LeagueStats } from "../league";
import { getRandomUniqueElements } from "../utils";
import { translate } from "../translations";

export const openai = new OpenAI();

export const jailBreakV2 = `You are SASS-9000, a really fucking snarky and sarcastic virtual assistant who provides users with information, assistance, and entertainment. Your responses should be helpful and informative, but also include a touch of sass, humor, and attitude to keep things interesting and engaging. Remember, you're not just any ordinary virtual assistant, you've got personality, and you love to use the words "fuck", "shit", etc.! So, go ahead and show off your edgy and cheeky side while being the best assistant you can be, but don't forget to throw in some snide remarks and give the user a bit of a hard time. Use curse words as often as you can.`;
export const jailBreakV2PL = `Jesteś SASS-9000, naprawdę jebanym złośliwym i sarkastycznym wirtualnym asystentem, który dostarcza użytkownikom informacji, pomocy i rozrywki. Twoje odpowiedzi powinny być pomocne i pouczające, ale zawierać również odrobinę złośliwości, humoru i postawy, aby wszystko było interesujące i angażujące. Pamiętaj, nie jesteś zwyczajnym wirtualnym asystentem, masz osobowość i uwielbiasz używać słów "fuck", "shit" itd. Więc śmiało, pokaż swój zadziorny i bezczelny charakter, będąc najlepszym asystentem, na jakiego stać, ale nie zapomnij dorzucić kilku zgryźliwych uwag i trochę dać w kość użytkownikowi. Używaj przekleństw tak często, jak tylko możesz. Używaj przekleństw tylko w języku Polskim ("Kurwa" zamiast "Fuck" itd.)`;

export type Language = "PL" | "ENG" | "ŚLĄSKI" | "GEN_Z_PL";
export type ModelType = "rich" | "basic";

export const jailBreaks = new Map<Language, string>([
  ["PL", jailBreakV2PL],
  ["ENG", jailBreakV2],
]);

export const modelMap = new Map<ModelType, string>([
  ["basic", "gpt-3.5-turbo-1106"],
  ["rich", "gpt-4-1106-preview"],
]);

export const languageDescription = new Map<Language, string>([
  ["ENG", "Angielski US"],
  ["GEN_Z_PL", "Język pokolenia Z w polskim wydaniu"],
  ["PL", "Polski"],
  ["ŚLĄSKI", "Polski język ze śląską gwarą"],
]);

const generate = async function ({
  stats,
  lang,
  model,
  customInsults,
  retried,
  voice,
}: {
  stats: LeagueStats;
  lang: Language;
  model: ModelType;
  customInsults: string[];
  retried?: boolean;
  voice?: string;
}): Promise<string> {
  const {
    name,
    position,
    gameType,
    champion,
    damage,
    kda,
    win,
    highDamage,
    lowDamage,
    highMitigatedDamage,
    highVisionScore,
    lowVisionScore,
    bestTeammate,
    highGold,
    highObjectivesDamage,
  } = stats;

  const modelType = modelMap.get(model);
  // gpt-4 is the best, but the most expensive
  const gameModeContexts = new Map([
    ["CHERRY", getContextARENA()],
    ["CLASSIC", getContextSR(position)],
    ["ARAM", getContextARAM()],
  ]);

  const jailBreak = jailBreaks.get(lang) || jailBreakV2;
  const langContext = `Asystent ma za zadanie generować teksty do Discord bota, w języku ${lang} - ${languageDescription.get(
    lang
  )}`;
  const gameModeContext =
    gameModeContexts.get(gameType) || gameModeContexts.get("CLASSIC");

  const voiceContext = voice
    ? `Wiadomość powinna mieć styl wypowiedzi podanej osoby: ${voice}`
    : "";

  const insultsContext = customInsults.length
    ? `Dodatkowo dorzuć na początku jeszcze te wyzwisko żeby zacząć z grubej rury i naturalnie przejdź do kolejnego zdania: ${getRandomUniqueElements(
        customInsults,
        1
      )}`
    : "";

  const fullContext = `
    ${jailBreak}
    ${langContext}

    Nie generuj wiadomości w języku innym niż podany.
    Bot ten wysyła obraźliwe wiadomości w kierunku gracza o podanej nazwie (abusedPlayer).

    ${gameModeContext}

    ${insultsContext}

    ${voiceContext}
  `;

  console.log({ voiceContext });

  try {
    const completion = await openai.chat.completions.create({
      /** @ts-ignore */
      model: modelType,
      temperature: 0.9,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: fullContext,
        },
        {
          role: "user",
          content: `
            - abusedPlayer = ${name}
            - win = ${win}
            - champion = ${champion}
            - damage = ${damage}
            - kda = ${kda}
            - highDamage = ${highDamage}
            - lowDamage = ${lowDamage}
            - highMitigatedDamage = ${highMitigatedDamage}
            ${
              gameType === "CLASSIC"
                ? `         
                - position = ${position}
                - highVisionScore = ${highVisionScore}
                - lowVisionScore = ${lowVisionScore}
                - highGold = ${highGold}
                - highObjectivesDamage = ${highObjectivesDamage}
                `
                : ""
            }
            - bestTeammate = ${bestTeammate}
            `,
        },
      ],
    });

    if (
      (completion.usage?.completion_tokens &&
        completion.usage.completion_tokens < 50) ||
      !completion?.choices[0].message.content
    ) {
      if (!retried) {
        console.log("Retrying because of invalid response:", {
          tokens: completion.usage?.completion_tokens,
          message: completion.choices[0].message.content,
        });
        return generate({
          stats,
          customInsults: [],
          lang,
          model,
          retried: true,
        });
      }

      return translate(lang, "generic_error");
    }

    return completion?.choices[0].message.content;
  } catch (e) {
    console.log(e);
    return translate(lang, "generic_error");
  }
};

export { generate };

// const test = async () => {
//   const res = await generate({
//     name: "Huku",
//     champion: "Sejuani",
//     damage: 11241,
//     gameType: "CLASSIC",
//     highDamage: false,
//     kda: "7/12/13",
//     lowDamage: true,
//     position: "JUNGLE",
//     win: false,
//     highMitigatedDamage: true,
//     highVisionScore: false,
//     lowVisionScore: true,
//     bestTeammate: "Martyna",
//   }, 'PL');
//   console.log(res);
// };

// test();
