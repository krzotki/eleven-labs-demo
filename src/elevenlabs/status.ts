export async function getElevenUsage() {
  const url = "https://api.elevenlabs.io/v1/user/subscription";

  const response = await fetch(url, {
    method: "get",
    headers: {
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY || "",
    },
  });

  const { character_count, character_limit } = await response.json();
  return {
    character_count,
    character_limit,
  };
}
