import { Language, openai } from "./generate/generate";

export const changeNumbersToText = async (
  message: string,
  lang: Language
) => {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    temperature: 0,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `Twoim zadaniem jest zamiana liczb i cyfr na słowa w zdaniu. 
          Na przykład "55" zamień na "pięćdziesiąt pięć", "4/2/6" zamień na "cztery dwa sześć". 
          Liczby większę niż 1000 powinny być zaokrąglane do tysięcy, na przykład "52335" zamień na "pięćdziesiąt dwa tysiące"
          Liczby powinny być przetłumaczone w zależności od podanego języka (PL - Polski, ENG - angielski, ŚLĄSKI - Polski, GEN_Z_PL - Polski).
          Zwróć tylko przetłumaczony tekst.
          `,
      },
      {
        role: "user",
        content: `Zamień liczby i cufry na słowa w tym tekście w języku ${lang}: ${message}`,
      },
    ],
  });

  return completion.choices[0].message.content || message;
};
