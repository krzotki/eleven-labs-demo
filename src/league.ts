import { AccountData, MatchDto, SummonerData } from "./types";
import { Language, ModelType, generate } from "./generate/generate";
import axios from "axios";
import { translate } from "./translations";

export enum LeaguePlatform {
  BR1 = "BR1",
  EUN1 = "EUN1",
  EUW1 = "EUW1",
  JP1 = "JP1",
  KR = "KR",
  LA1 = "LA1",
  LA2 = "LA2",
  NA1 = "NA1",
  OC1 = "OC1",
  TR1 = "TR1",
  RU = "RU",
  PH2 = "PH2",
  SG2 = "SG2",
  TH2 = "TH2",
  TW2 = "TW2",
  VN2 = "VN2",
}

enum RoutingValue {
  AMERICAS = "AMERICAS",
  ASIA = "ASIA",
  EUROPE = "EUROPE",
  SEA = "SEA",
}

const platformRouting: Record<LeaguePlatform, RoutingValue> = {
  [LeaguePlatform.BR1]: RoutingValue.AMERICAS,
  [LeaguePlatform.LA1]: RoutingValue.AMERICAS,
  [LeaguePlatform.LA2]: RoutingValue.AMERICAS,
  [LeaguePlatform.NA1]: RoutingValue.AMERICAS,
  [LeaguePlatform.KR]: RoutingValue.ASIA,
  [LeaguePlatform.JP1]: RoutingValue.ASIA,
  [LeaguePlatform.EUN1]: RoutingValue.EUROPE,
  [LeaguePlatform.EUW1]: RoutingValue.EUROPE,
  [LeaguePlatform.TR1]: RoutingValue.EUROPE,
  [LeaguePlatform.RU]: RoutingValue.EUROPE,
  [LeaguePlatform.OC1]: RoutingValue.SEA,
  [LeaguePlatform.PH2]: RoutingValue.SEA,
  [LeaguePlatform.SG2]: RoutingValue.SEA,
  [LeaguePlatform.TH2]: RoutingValue.SEA,
  [LeaguePlatform.TW2]: RoutingValue.SEA,
  [LeaguePlatform.VN2]: RoutingValue.SEA,
};

export const availablePlatforms = Object.values(LeaguePlatform);

const RIOT_API_KEY = process.env.LEAGUE_API_KEY;

async function getSummonerIdByName(
  summonerName: string,
  plaftorm: LeaguePlatform
): Promise<SummonerData> {
  const BASE_URL = `https://${plaftorm.toLowerCase()}.api.riotgames.com`;
  const response = await axios.get(
    `${BASE_URL}/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${RIOT_API_KEY}`
  );
  return {
    id: response.data.id,
    accountId: response.data.accountId,
    puuid: response.data.puuid,
  };
}

async function getRiotAccountIdByRiotId(
  summonerName: string,
  plaftorm: LeaguePlatform,
  tagLine: string
): Promise<AccountData> {
  const BASE_URL = `https://${platformRouting[
    plaftorm
  ].toLowerCase()}.api.riotgames.com`;
  const response = await axios.get(
    `${BASE_URL}/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}/?api_key=${RIOT_API_KEY}`
  );
  return response.data;
}

async function getMatchHistory(accountId: string, plaftorm: LeaguePlatform) {
  const BASE_URL = `https://${platformRouting[
    plaftorm
  ].toLowerCase()}.api.riotgames.com`;

  const response = await axios.get(
    `${BASE_URL}/lol/match/v5/matches/by-puuid/${accountId}/ids?api_key=${RIOT_API_KEY}`
  );
  return response.data;
}

async function getMatch(
  matchId: string,
  plaftorm: LeaguePlatform
): Promise<MatchDto> {
  const BASE_URL = `https://${platformRouting[
    plaftorm
  ].toLowerCase()}.api.riotgames.com`;

  const response = await axios.get(
    `${BASE_URL}/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
  );
  return response.data;
}

async function leagueHistory({
  summonerName,
  gameIndex = 1,
  gameId,
  plaftorm = LeaguePlatform.EUN1,
  realNames,
  tagLine,
  language,
}: {
  summonerName: string;
  gameIndex?: number;
  gameId?: string;
  plaftorm?: LeaguePlatform;
  realNames: Map<string, string>;
  tagLine?: string;
  language: Language;
}) {
  let puuid: string;

  try {
    if (!tagLine) {
      const summoner = await getSummonerIdByName(summonerName, plaftorm);
      puuid = summoner.puuid;
    } else {
      const riotAccount = await getRiotAccountIdByRiotId(
        summonerName,
        plaftorm,
        tagLine
      );
      puuid = riotAccount.puuid;
    }
  } catch (e) {
    if (tagLine) {
      return {
        error: translate(language, "league_riotid_not_found", {
          summoner_name: summonerName,
          tagline: tagLine,
        }),
      };
    }

    return {
      error: translate(language, "league_summoner_not_found", {
        summoner_name: summonerName,
      }),
    };
  }

  let lastMatchId = gameId ? `${plaftorm}_${gameId}` : undefined;

  if (!lastMatchId) {
    const matchHistory = await getMatchHistory(puuid, plaftorm);
    lastMatchId = matchHistory[gameIndex - 1];
  }

  const match = await new Promise<MatchDto | undefined>(async (resolve) => {
    if (!lastMatchId) {
      resolve(undefined);
      return;
    }

    try {
      const data = await getMatch(lastMatchId, plaftorm);
      resolve(data);
    } catch (e) {
      resolve(undefined);
    }
  });

  if (!match) {
    return {
      error: "Could not find this match",
    };
  }

  const participantIdentity = match.info.participants.find(
    (participant) => participant.puuid === puuid
  );

  if (!participantIdentity) {
    return;
  }

  const {
    championName: champion,
    individualPosition: position,
    kills,
    deaths,
    assists,
    totalDamageDealtToChampions,
    damageSelfMitigated,
    visionScore,
    damageDealtToObjectives,
    goldEarned,
  } = participantIdentity;

  const sums = match.info.participants.reduce(
    (prev, curr) => ({
      damage: prev.damage + curr.totalDamageDealtToChampions,
      mitigated: prev.mitigated + curr.damageSelfMitigated,
      vision: prev.vision + curr.visionScore,
      damageDealtToObjectives:
        prev.damageDealtToObjectives + curr.damageDealtToObjectives,
      goldEarned: prev.goldEarned + curr.goldEarned,
    }),
    {
      damage: 0,
      mitigated: 0,
      vision: 0,
      damageDealtToObjectives: 0,
      goldEarned: 0,
    }
  );

  const damageRatio = totalDamageDealtToChampions / sums.damage;
  const damageMitigatedRatio = damageSelfMitigated / sums.mitigated;
  const visionRatio = visionScore / sums.vision;
  const objectivesRatio =
    damageDealtToObjectives / sums.damageDealtToObjectives;
  const goldRatio = goldEarned / sums.goldEarned;

  const highDamage = damageRatio > 0.12;
  const lowDamage = damageRatio < 0.07;
  const highMitigatedDamage = damageMitigatedRatio > 0.12;
  const highVisionScore = visionRatio > 0.1;
  const lowVisionScore = visionRatio < 0.04;
  const highObjectivesDamage = objectivesRatio > 0.12;
  const highGold = goldRatio > 0.12;

  const KDA = `${kills}/${deaths}/${assists}`;

  const gameType = match.info.gameMode;

  const team = match.info.participants.filter((mate) => {
    if (mate.playerSubteamId) {
      return mate.playerSubteamId === participantIdentity.playerSubteamId;
    }

    return mate.teamId === participantIdentity.teamId;
  });

  const bestTeammate = [...team].sort((a, b) => {
    const kdaRatioA = (a.kills + a.assists) / a.deaths;
    const damageA = a.totalDamageDealtToChampions / sums.damage;
    const mitigatedA = a.damageSelfMitigated / sums.mitigated;
    const objectivesA =
      a.damageDealtToObjectives / sums.damageDealtToObjectives;
    const goldA = a.goldEarned / sums.goldEarned;

    const scoreA = kdaRatioA * damageA * mitigatedA * objectivesA * goldA;

    const kdaRatioB = (b.kills + b.assists) / b.deaths;
    const damageB = b.totalDamageDealtToChampions / sums.damage;
    const mitigatedB = b.damageSelfMitigated / sums.mitigated;
    const objectivesB =
      b.damageDealtToObjectives / sums.damageDealtToObjectives;
    const goldB = b.goldEarned / sums.goldEarned;

    const scoreB = kdaRatioB * damageB * mitigatedB * objectivesB * goldB;

    return scoreB - scoreA;
  })[0];

  const bestTeammateName =
    bestTeammate.riotIdGameName || bestTeammate.summonerName;

  return {
    stats: {
      name: realNames.get(summonerName) || summonerName,
      champion,
      damage: totalDamageDealtToChampions,
      gameType: gameType,
      kda: KDA,
      position,
      win: participantIdentity.win,
      highDamage,
      lowDamage,
      highMitigatedDamage,
      highVisionScore: highVisionScore,
      lowVisionScore: lowVisionScore,
      highObjectivesDamage,
      highGold,
      bestTeammate: realNames.get(bestTeammateName) || bestTeammateName,
    },
    error: null,
  };
}

export { leagueHistory };

export type LeagueStats = {
  name: string;
  champion: string;
  damage: number;
  gameType: string;
  kda: string;
  position: string;
  win: boolean;
  highDamage: boolean;
  lowDamage: boolean;
  highMitigatedDamage: boolean;
  highVisionScore: boolean;
  lowVisionScore: boolean;
  bestTeammate: string;
  highObjectivesDamage: boolean;
  highGold: boolean;
};
