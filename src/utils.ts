import crypto from "crypto";

export function capitalizeWord(word: string) {
  if (!word || typeof word !== "string") {
    return "";
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function createRealNamesMap(settings: any) {
  const realNames = new Map<string, string>(
    (settings?.league_aliases || []).map(
      (alias: { summoner: string; realName: string }) => [
        alias.summoner,
        alias.realName,
      ]
    )
  );

  return realNames;
}

export function getRandomUniqueElements<T>(arr: T[], n: number): T[] {
  if (n > arr.length) {
    throw new Error("Requested number of elements exceeds array length");
  }

  // Shuffling the array
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
  }

  // Returning the first n elements
  return arr.slice(0, n);
}

export function replaceAll(
  str: string,
  search: string,
  replacement: string
): string {
  return str.split(search).join(replacement);
}

export function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length,
    randomIndex: number;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

const cryptoKey = process.env.SECRET_CRYPTO_KEY || "";

if (!cryptoKey) {
  throw new Error("SECRET_CRYPTO_KEY not set!");
}

function getKeyFromPassword(password: string): Buffer {
  return crypto.createHash("sha256").update(password).digest();
}

export function decryptFunction(text: string): string {
  const textParts = text.split(":");
  if (textParts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  const iv = Buffer.from(textParts[0], "hex");
  if (iv.length !== 16) {
    throw new Error("Invalid IV length");
  }
  const encryptedText = Buffer.from(textParts[1], "hex");
  const key = getKeyFromPassword(cryptoKey);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
