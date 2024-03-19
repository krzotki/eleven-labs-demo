import axios from "axios";
import FormData from "form-data";
import { readFileSync } from "fs";

const voices = [
  {
    name: "Korwin",
    description: "Janusz Korwin Mikke",
    premium: false,
    samples: ["korwin", "korwin2"],
    settings: {
      similarity_boost: 1,
      stability: 0.45,
      style: 0.45,
      use_speaker_boost: true,
    },
  },
  {
    name: "Angry indian tech support",
    description: "Wściekły hinduski tech support",
    premium: false,
    samples: ["hindus1", "hindus2"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.5,
      use_speaker_boost: true,
    },
  },
  {
    name: "Makłowicz",
    description: "Robert Makłowicz - polski dziennikarz, krytyk kulinarny, pisarz, publicysta i podróżnik",
    premium: false,
    samples: ["maklo1"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.4,
      use_speaker_boost: true,
    },
  },
  {
    name: "Tiger Bonzo",
    description: "Tiger Bonzo - vloger, youtuber, wybitny ekspert od blokady płyt głównych i całek. ",
    premium: true,
    samples: ["bonzo"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.1,
      style: 0.9,
      use_speaker_boost: true,
    },
  },
  {
    name: "Rafonix",
    description: "Rafonix - jedna z legend polskiego internetu, niekoniecznie w pozytywnym tego słowa znaczeniu. Zasłynął z patostreamów, a skończył w FAME MMA i Hype MMA",
    premium: true,
    samples: ["rafonix"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.4,
      use_speaker_boost: true,
    },
  },
  {
    name: "Klocuch",
    description: "Klocuch - jest znanym w Polsce wideorecenzentem, twórcą poradników, bajek (animacji), kabaretów (parodii), seriali (gameplayów) i piosenek.",
    premium: false,
    samples: ["klocuch"],
    settings: {
      similarity_boost: 0.3,
      stability: 0.45,
      style: 0.45,
      use_speaker_boost: true,
    },
  },
  {
    name: "Chłopaki z Baraków",
    description: "Polski lektor z serialu Chłopaki z Baraków (teksty mówione przez Ricka, Juliana, Bubblesa czy Lahey'a)",
    premium: true,
    samples: ["chlopaki", "chlopaki2"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.4,
      use_speaker_boost: true,
    },
  },
  {
    name: "Fronczewski",
    description: "Franek Kimono - postać muzyczna wykreowana przez aktora Piotra Fronczewskiego. Jego postać była parodią stylu disco. Franek Kimono jako formę ekspresji wokalnej stosował melodeklamację.",
    premium: true,
    samples: ["kimono1", "kimono2"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.45,
      use_speaker_boost: true,
    },
  },
  {
    name: "Pudzianowski",
    description: "Mariusz Zbigniew Pudzianowski ps. Pudzian, Dominator, Pyton, Pudzilla - polski zawodnik mieszanych sztuk walki",
    premium: true,
    samples: ["pudzian"],
    settings: {
      similarity_boost: 0.75,
      stability: 0.5,
      style: 0.4,
      use_speaker_boost: true,
    },
  },
  {
    name: "Dawid Jasper",
    description: "Jest osobą niepełnosprawną w stopniu umiarkowanym i bierze drogie leki. Mieszka w Pabianicach. Posiada prawo jazdy na ciężarówkę, na co dzień wozi towary na Ukrainę.",
    premium: true,
    samples: ["jasper"],
    settings: {
      similarity_boost: 1,
      stability: 0.35,
      style: 0.45,
      use_speaker_boost: true,
    },
  },
];

type Voice = (typeof voices)[number];

type UploadedVoices = Array<{ voice_id: string } & Voice>;

export const uploadVoices = async () => {
  const results: UploadedVoices = [];

  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const form = new FormData();

    form.append("description", voice.description);

    const name = voice.premium ? `${voice.name} [PREMIUM]` : voice.name;

    form.append("name", name);

    voice.samples.forEach((sampleName) => {
      const filePath = `./samples/${sampleName}.mp3`;
      const audio = readFileSync(filePath);
      form.append("files", audio, `${sampleName}.mp3`);
    });

    try {
      const response = await axios.post(
        "https://api.elevenlabs.io/v1/voices/add",
        form,
        {
          headers: {
            ...form.getHeaders(),
            "xi-api-key": process.env.ELEVEN_LABS_API_KEY || "",
          },
        }
      );

      results.push({
        ...response.data,
        ...voice,
        name,
      });
    } catch (error: any) {
      console.error("Failed to upload voice:", error.response.data.detail);
    }
  }

  console.log("Uploaded voices", results);

  const settinsResults = await changeVoicesSettings(results);

  console.log("Changed settings", settinsResults);

  return results;
};

const changeVoicesSettings = async (uploadedVoices: UploadedVoices) => {
  const results = [];

  for (let i = 0; i < uploadedVoices.length; i++) {
    const voice = uploadedVoices[i];

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVEN_LABS_API_KEY || "",
      },
      body: JSON.stringify(voice.settings),
    };

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/voices/${voice.voice_id}/settings/edit`,
        options
      );
      const data = await response.json();
      results.push(data);
    } catch (error: any) {
      console.error("Failed to change settings:", error);
    }
  }

  return results;
};
