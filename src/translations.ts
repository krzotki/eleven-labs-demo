import { Language } from "./generate/generate";
import { replaceAll } from "./utils";

type TranslationParams = { [key: string]: string | number };

const common = {
  ENG: {
    discord_invite: `Or join the LeagueAbuser Discord server, provide valuable feedback and get free Premium for a month: %discord_server_url%`,
  },
  PL: {
    discord_invite: `🤝 **Dołącz do nas i Zdobądź Nagrody:** Przyłącz się do społeczności LeagueAbuser na Discordzie. Dziel się swoimi spostrzeżeniami, zgłaszaj uciążliwe błędy lub przedstaw swoje genialne pomysły. Twoje aktywne zaangażowanie może zapewnić Ci darmowy miesiąc Premium! Przyłącz się tutaj %discord_server_url%`,
  },
};

const translations = {
  ENG: {
    monthly_requests_reached: `You have reached the maximum level of toxicity for **this month** (**%max_requests%** messages), but you can refill at %dashboard_url%. 
    ${common.ENG.discord_invite}
    `,

    daily_requests_reached: `You have reached the maximum level of toxicity for **today** (%max_daily_requests% messages), but you can refill at $%dashboard_url%.

${common.ENG.discord_invite}`,
    set_eleven_labs_key: `🔑 **Set Up Required!** To kick things off, you need to set your Eleven Labs API Key. It's quick and easy! Just click [here](%dashboard_url%/settings#voice) to jump to the settings page and enter your key. Let’s get your experience started!`,

    monthly_voice_reached: `You have used your voice chat abuser limit for this **month**, check the settings to reset the limit: %dashboard_url%/settings#voice

${common.ENG.discord_invite}`,

    monthly_rich_voice_reached: `You have used your **rich** voice chat abuser limit for this **month**. You can still use the regular voice abuser, just don't use the **voice** option. Check the options to increase the limit: %dashboard_url%.

${common.ENG.discord_invite}`,

    custom_voices_active: `🔊 **Custom Voices Active!** Since you're using your own custom voices, the default ones are currently inactive.

👉 To switch back and use the default voices, simply visit our [Settings Page](%dashboard_url%/settings#voice).`,

    league_riotid_not_found: `Could not find summoner with name **%summoner_name%#%tagline%**. 
- First of all - check for typos,
- If you play on any other region than EUNE, use the "region" option 🤓👍
    `,

    league_summoner_not_found: `Could not find summoner with name **%summoner_name%**. 
- First of all - check for typos,
- Specify the "tagline" if you have some shit like "#2137",
- If you play on any other region than EUNE, use the "region" option 🤓👍
    `,

    generic_error: "Ugh.. I'm high as fuck.. Gimme a second..'",
    command_timeout:
      "🚧 Hold up! Still processing your last command. Rush me again, and I might just have to kick yo' ass! 🚧",
    premium_voice:
      "⭐ This voice is available only for subscribed users. Subscribe here: %dashboard_url%",
    premium_command:
      "⭐ This command is available only for subscribed users. Try using `/abusevoice <summoner name>`. Or subscribe here: %dashboard_url%",
  },

  PL: {
    monthly_requests_reached: `🎮 **Game Over!** Osiągnąłeś limit **%max_requests%** kąśliwych komentarzy na ten miesiąc. Chcesz więcej frajdy? Oto co możesz zrobić:

🚀 **Więcej Zabawy z Premium:** Nie przerywaj zabawy! Zwiększ swój limit zabawnych komentarzy i skorzystaj z dodatkowych funkcji, odwiedzając nasz [Dashboard](%dashboard_url%).

${common.PL.discord_invite}`,
    daily_requests_reached: `🎮 **Hola, hola toxicu** Chcesz bardzo kogoś zwyzywać? Oto co możesz zrobić:

🚀 **Więcej Zabawy z Premium:** Nie przerywaj zabawy! Zwiększ swój limit zabawnych komentarzy i skorzystaj z dodatkowych funkcji, odwiedzając nasz [Dashboard](%dashboard_url%).
  
${common.PL.discord_invite}`,
    set_eleven_labs_key: `🔑 **Wymagana konfiguracja!** Używasz swoich głosów ale nie dodano jeszcze swojego klucza API ElevenLabs. Jak to zrobić? Łatwizna - przejdź do [ustawień](%dashboard_url%/settings#voice), wejdź w link do ElevenLabs, skopiuj klucz według instrukcji i wklej w odpowiednie pole. Powodzenia!`,

    monthly_voice_reached: `🎤 **Osiągnięto Miesięczny Limit!** Wygląda na to, że osiągnąłeś limit użyć czatu głosowego na ten miesiąc. Chcesz więcej zabawy z politykami i patusami? Masz kilka możliwości!

🚀 **Przejdź na Premium:** Ciesz się większą liczbą wiadomości głosowych i dodatkowymi funkcjami! Sprawdź nasz [Dashboard](%dashboard_url%), aby ulepszyć swój plan.

⚙️ **Własne głosy** Możesz podpiąć swoje konto ElevenLabs, aby uzyskać nielimitowany dostęp do śmiesznych głosów. Sprawdź [ustawienia głosu](%dashboard_url%/settings#voice)

${common.PL.discord_invite}`,

    monthly_rich_voice_reached: `🌟 **Osiągnięto Limit Śmiesznych Głosów!** Wykorzystałeś już swój miesięczny limit na wiadomości ze śmiesznymi głosami. Nie martw się, masz jeszcze inne opcje!

🚀 **Więcej z Premium:** Ciesz się większym limitem na wiadomości ze śmiesznymi głosami i dodatkowymi funkcjami! Sprawdź nasz [Dashboard](%dashboard_url%), aby ulepszyć swój plan.

⚙️ **Własne głosy** Możesz podpiąć swoje konto ElevenLabs, aby uzyskać nielimitowany dostęp do śmiesznych głosów. Sprawdź [ustawienia głosu](%dashboard_url%/settings#voice)

🎙️ **Dostęp do zwykłego głosu:** Możesz nadal używać voice abusera – po prostu pomiń opcję **voice**.

${common.PL.discord_invite}`,
    custom_voices_active: `🔊 **Własne głosy włączone!** Aktualnie używasz własnych głosów, więc te wbudowane obecnie nie będą dostępne.

👉 Aby wrócić do głosów domyślnych, zmień opcję w [ustawieniach](%dashboard_url%/settings#voice).`,

    league_riotid_not_found: `Nie znaleziono gracza z nazwą **%summoner_name%#%tagline%**. 
- Po pierwsze - zobacz czy nie ma literówek,
- Jeśli grasz na regionie innym niz EUNE, użyj opcji "region" 🤓👍
    `,

    league_summoner_not_found: `Nie znaleziono gracza z nazwą **%summoner_name%**. 
- Po pierwsze - zobacz czy nie ma literówek,
- Uzupełnij opcję "tagline" jeśli masz jakieś gówno w nicku jak "#2137",
- Jeśli grasz na regionie innym niz EUNE, użyj opcji "region" 🤓👍
    `,

    generic_error: "Eeeh.. Z leksza się ujebałem.. Daj mi chwilkę..",
    command_timeout:
      "🚧 Poczekaj chwilę! Jeszcze się zastanawiam nad zajebistymi obelgami. Jeszcze raz mnie pospieszysz to skopię Ci dupsko gnojku. 🚧",
    premium_voice:
      "⭐ Ten głos jest dostępny tylko dla użytkowników z subskrypcją. Zasubskrybuj [tutaj](%dashboard_url%)",
  },
  ŚLĄSKI: undefined,
  GEN_Z_PL: undefined,
};

type TranslationKey = keyof typeof translations.ENG;

export function translate(
  language: Language,
  translationKey: TranslationKey,
  params?: TranslationParams
): string {
  // Checking conversion for english entrypoints
  // let translation = (translations[language] || translations.ENG)[
  //   translationKey
  // ];
  let translation = translations.ENG[translationKey];

  if (!translation) {
    return translationKey;
  }

  if (params) {
    for (const key in params) {
      translation = replaceAll(translation, `%${key}%`, params[key].toString());
    }
  }

  return translation;
}
