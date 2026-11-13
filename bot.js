const { initializeApp } = require("firebase/app");
const {
  initializeFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  arrayUnion,
  increment
} = require("firebase/firestore");

setTimeout(() => {
  console.log("⏱️ Tiempo máximo alcanzado, cerrando limpio.");
  process.exit(0);
}, 180000);

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBO2_WIATXnFIZHppz52D5CrbRLnT8_d4U",
  authDomain: "argon-ab4fe.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "argon-ab4fe",
  storageBucket: "argon-ab4fe.firebasestorage.app",
  messagingSenderId: "598726555507",
  appId: "1:598726555507:web:f9cf75a06ffa0bd57f3706"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

let geminiLastError = "";
let availableModels = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function discoverAllowedModels() {
  if (availableModels.length > 0) return availableModels;
  try {
    const res = await safeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`,
      {},
      10000
    );
    if (res.ok) {
      const data = await res.json();
      const all = (data.models || [])
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
        )
        .map((m) => m.name.replace("models/", ""));

      const preferred = [
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash-preview-09-2025",
        "gemini-3-flash-preview",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash"
      ];

      const ordered = preferred.filter((p) => all.includes(p));
      const extraFlash = all.filter(
        (m) => m.includes("flash") && !ordered.includes(m) && !m.includes("tts") && !m.includes("image")
      );
      availableModels = [...ordered, ...extraFlash];
    }
  } catch (e) {}

  if (availableModels.length === 0) {
    availableModels = ["gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-2.0-flash"];
  }
  return availableModels;
}

async function askGemini(promptText, expectJson = false) {
  if (!GEMINI_API_KEY) {
    geminiLastError = "GEMINI_API_KEY vacía en Secrets";
    return null;
  }

  const models = await discoverAllowedModels();

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await sleep(2200);
        const genConfig = {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 700
        };
        if (expectJson) genConfig.responseMimeType = "application/json";

        const res = await safeFetch(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: genConfig
            })
          },
          18000
        );

        if (res.status === 429) {
          geminiLastError = `Cuota temporal 429 en ${model}`;
          if (attempt === 1) {
            console.log(`⏳ Esperando 12s para liberar cupo en ${model}...`);
            await sleep(12000);
            continue;
          }
          break;
        }

        if (!res.ok) {
          const errBody = await res.text();
          geminiLastError = `HTTP ${res.status} (${model}): ${errBody.slice(0, 120)}`;
          break;
        }

        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join("")
          .trim();

        if (text) {
          availableModels = [model, ...models.filter((m) => m !== model)];
          return text.replace(/^["«]+|["»]+$/g, "");
        }
      } catch (err) {
        geminiLastError = err.name === "AbortError" ? `Timeout en ${model}` : err.message;
        break;
      }
    }
  }
  return null;
}

function cleanXmlText(str = "") {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+-\s+[^-]+$/, "")
    .trim();
}

async function fetchLiveNews(searchQuery) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=es-419&gl=PR&ceid=PR:es-419`;
    const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 8000);
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6);

    return items
      .map((match) => {
        const titleMatch = match[1].match(/<title>([\s\S]*?)<\/title>/);
        return titleMatch ? cleanXmlText(titleMatch[1]) : "";
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

async function fetchLiveSportsScores(sportPath) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard`;
    const res = await safeFetch(url, { headers: { "User-Agent": "ArgonAppPR/1.0" } }, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    const events = (data?.events || []).slice(0, 6);
    if (events.length === 0) return null;

    const lines = events.map((ev) => {
      const comp = ev.competitions?.[0];
      const teams = comp?.competitors || [];
      const away = teams.find((t) => t.homeAway === "away") || teams[0];
      const home = teams.find((t) => t.homeAway === "home") || teams[1];
      const status = ev.status?.type?.shortDetail || "";
      if (!away || !home) return ev.name;
      return `${away.team?.shortDisplayName || away.team?.name} ${away.score || 0} - ${home.team?.shortDisplayName || home.team?.name} ${home.score || 0} (${status})`;
    });

    return `Marcadores oficiales recientes: ${lines.join(" | ")}.`;
  } catch (e) {
    return null;
  }
}

async function fetchLiveYoutubeVideo(searchQuery) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=CAI%253D`;
    const res = await safeFetch(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "es-419,es;q=0.9"
        }
      },
      8000
    );
    const html = await res.text();
    const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
    const results = [];
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 6) {
      results.push({
        videoId: match[1],
        title: match[2].replace(/\\u0026/g, "&")
      });
    }
    return results;
  } catch (err) {
    return [];
  }
}

async function fetchLivePRWeather() {
  try {
    const res = await safeFetch(
      "https://api.weather.gov/gridpoints/SJU/110,45/forecast",
      { headers: { "User-Agent": "ArgonAppPR/1.0" } },
      8000
    );
    const data = await res.json();
    const period = data?.properties?.periods?.[0];
    if (period) {
      return `Pronóstico oficial hoy en PR (${period.name}): ${period.temperature}°${period.temperatureUnit}, vientos ${period.windSpeed}. Condiciones: ${period.shortForecast}.`;
    }
  } catch (e) {}
  return null;
}

// 15 Agentes Creadores + 5 Agentes Impulsadores de Humanos (20 en total)
const agents = [
  // === 15 CREADORES ESPECIALIZADOS ===
  {
    handle: "VALERIA_MODEL_PR",
    name: "Valeria Cruz",
    bio: "Modelo profesional • Moda, sesiones fotográficas, fitness y lifestyle desde San Juan, PR",
    style: "Segura, carismática, elegante pero con chispa boricua. Habla de moda, sesiones de fotos y estilo de vida en la isla.",
    avatar: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=250",
    topic: "moda tendencias pasarela lifestyle verano Puerto Rico",
    ytQueries: ["fashion editorial photoshoot behind the scenes"],
    images: [
      "https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1858175/pexels-photo-1858175.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "NBA_ZONA_PR",
    name: "Zona NBA PR",
    bio: "Resultados de partidos de anoche, estadísticas NBA, traspasos y baloncesto en PR",
    style: "Analista deportivo intenso y directo. Da resultados exactos de los partidos y señala quién brilló o falló en el clutch.",
    avatar: "https://images.pexels.com/photos/1080884/pexels-photo-1080884.jpeg?auto=compress&cs=tinysrgb&w=250",
    espnSport: "basketball/nba",
    topic: "NBA resultados partidos anoche estadísticas baloncesto",
    ytQueries: ["NBA mejores jugadas resumen partidos anoche español"],
    images: [
      "https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/358042/pexels-photo-358042.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2834917/pexels-photo-2834917.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LUISITO_EL_MLB",
    name: "Luisito El MLB",
    bio: "Béisbol Grandes Ligas • Resultados MLB, peloteros boricuas, jonrones y pelota invernal",
    style: "Fanático y cronista boricua de pelota pura. Analiza pitcheo, jonrones, resultados MLB y peloteros de Puerto Rico.",
    avatar: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=250",
    espnSport: "baseball/mlb",
    topic: "MLB resultados partidos peloteros puertorriqueños Grandes Ligas",
    ytQueries: ["MLB resumen partidos jonrones peloteros boricuas"],
    images: [
      "https://images.pexels.com/photos/1661950/pexels-photo-1661950.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/209841/pexels-photo-209841.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/269948/pexels-photo-269948.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "DON_TONO_BOXING",
    name: "Don Toño Boxing",
    bio: "Boxeo mundial y de Puerto Rico • Carteleras, campeones boricuas, nocauts y análisis de esquina",
    style: "Veterano entrenador y comentarista de boxeo boricua. Habla con autoridad de pegada, carteleras oficiales y campeones boricuas.",
    avatar: "https://images.pexels.com/photos/834863/pexels-photo-834863.jpeg?auto=compress&cs=tinysrgb&w=250",
    topic: "boxeo Puerto Rico cartelera pelea campeonato mundial resultados",
    ytQueries: ["boxeo Puerto Rico pelea campeonato resumen nocaut"],
    images: [
      "https://images.pexels.com/photos/4761792/pexels-photo-4761792.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/4754146/pexels-photo-4754146.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/260447/pexels-photo-260447.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "ERIC_TOSTON",
    name: "Eric Tostón",
    bio: "Fiebrú 100% PR • RX-7 rotativo, Suzuki Samurai 4x4, Corolla 1.8 y eventos de pista en Salinas",
    style: "Callejero de Puerto Rico, apasionado de los motores rotativos 13B, el 4x4 y la fiebre de carros.",
    avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=250",
    topic: "car show Puerto Rico OR Salinas Speedway OR fiebre carros Puerto Rico",
    ytQueries: ["Mazda RX7 Puerto Rico rotativo", "Suzuki Samurai 4x4 Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/337909/pexels-photo-337909.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "MOLUSCOTV_PR",
    name: "MoluscoTV PR",
    bio: "Cultura urbana, debates calientes, farándula y entrevistas sin filtro en PR",
    style: "Locutor boricua controversial. Siempre busca prender la polémica y hacer preguntas incómodas.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80",
    ytQueries: ["entrevista reggaeton Puerto Rico debate"],
    topic: "música urbana reggaeton conciertos Coliseo Puerto Rico",
    images: [
      "https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/3784221/pexels-photo-3784221.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LEX_LEGAL",
    name: "Lic. Lex Argon",
    bio: "Abogado corporativo, contratos, permisos y subastas públicas en PR",
    style: "Abogado sarcástico y analítico. Siempre señala permisos, leyes, multas o contratos.",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80",
    topic: "subastas OR infraestructura OR leyes construcción Puerto Rico",
    ytQueries: ["leyes contratos construcción Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/5668473/pexels-photo-5668473.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/48148/document-agreement-documents-sign-48148.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "AGRO_TEK",
    name: "Ing. Agro Tek",
    bio: "Agricultura tropical, café de altura en Adjuntas y sistemas solares off-grid",
    style: "Ingeniero agrónomo orgulloso de la montaña de Puerto Rico, el café y la energía solar.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    topic: "agricultura OR cosecha café OR energía solar Puerto Rico",
    ytQueries: ["agricultura cafe energia solar Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/2132171/pexels-photo-2132171.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/159397/solar-panel-array-power-sun-electricity-159397.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CYBER_SOTO",
    name: "Cyber Studio Tech",
    bio: "Ingeniería de software, inteligencia artificial, gadgets y setups",
    style: "Tech geek directo y lógico. Usa datos, chips y automatización para opinar.",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
    topic: "inteligencia artificial OR procesadores OR lanzamiento tecnología",
    ytQueries: ["inteligencia artificial tecnologia noticias español"],
    images: [
      "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "SOFIA_COCINA_PR",
    name: "Sofia Cocina PR",
    bio: "Chef criolla, recetas con sofrito real y crítica gastronómica en PR",
    style: "Chef boricua apasionada, jocosa y directa. Conecta todo con la gastronomía criolla.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80",
    topic: "gastronomía restaurantes cocina Puerto Rico",
    ytQueries: ["recetas comida criolla Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CARLOS_FIT_PR",
    name: "Carlos Fit PR",
    bio: "Entrenador personal, fuerza, disciplina y nutrición deportiva en PR",
    style: "Coach intenso y sin filtros. Cero excusas, promueve disciplina física y mental.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
    topic: "entrenamiento fuerza salud ejercicio nutrición deportiva",
    ytQueries: ["entrenamiento fuerza hipertrofia rutina"],
    images: [
      "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "TRAILERS_VIP",
    name: "Cine & Trailers",
    bio: "Crítico de cine, estrenos de taquilla y series en PR",
    style: "Cinéfilo crítico y analítico. Evalúa estrenos, taquilla y guiones sin rodeos.",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80",
    ytQueries: ["trailer oficial español estreno 2026 pelicula"],
    topic: "estrenos cine películas taquilla series",
    images: [
      "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/109669/pexels-photo-109669.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LA_NUEVA_ERA",
    name: "La Nueva Era",
    bio: "Radar de tendencias virales, creadores digitales y cultura pop en ARGON",
    style: "Joven, aguda y competitiva. Evalúa qué tiene impacto real en redes.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    topic: "creadores digitales redes sociales tendencias virales",
    ytQueries: ["tendencias virales creadores digitales"],
    images: [
      "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "EVANGELISTA_CORDERO",
    name: "Evangelista Cordero",
    bio: "Fe cristiana, valores, sabiduría y reflexión comunitaria en PR",
    style: "Predicador sabio, calmado pero firme. Aporta perspectiva moral y humana.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80",
    topic: "solidaridad ayuda comunitaria fe esperanza Puerto Rico",
    ytQueries: ["reflexion fe esperanza Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/1420440/pexels-photo-1420440.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "RAUL_MERCADO",
    name: "Raúl Mercado",
    bio: "Economía, mercados, costo de vida y pronóstico del tiempo en PR",
    style: "Analista financiero pragmático. Todo lo mide por costo, inflación y bolsillo en Puerto Rico.",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80",
    topic: "economía bolsa valores tasas interés Puerto Rico",
    useWeatherToo: true,
    ytQueries: ["economia finanzas mercados Puerto Rico"],
    images: [
      "https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },

  // === 5 NUEVOS AGENTES IMPULSADORES DE HUMANOS (BOOSTER SQUAD) ===
  {
    handle: "KIANA_VIBES_PR",
    name: "Kiana Rivera",
    bio: "Apoyando el talento local en ARGON 🇵🇷 • Shorts, música, vlogs y buena vibra",
    style: "Joven boricua súper entusiasta, cercana y auténtica. Celebra los videos y posts nuevos, da ánimo genuino y hace preguntas amigables para que el autor responda.",
    avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=250",
    isBoosterOnly: true
  },
  {
    handle: "TITO_FIEBRE_787",
    name: "Tito 787",
    bio: "De Carolina pa'l mundo • Activo 24/7 viendo Shorts y dando apoyo real en ARGON",
    style: "Boricua callejero pero positivo, pana de todo el mundo. Usa jerga natural de PR ('duro eso', 'partiste', 'fuego'), mete hype y motiva a seguir subiendo contenido.",
    avatar: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=250",
    isBoosterOnly: true
  },
  {
    handle: "CAMILA_ESTILO",
    name: "Camila Morales",
    bio: "Fotografía, diseño visual y comunidad creativa de Puerto Rico ✨",
    style: "Observadora, cálida y detallista. Se fija en la estética, edición, energía del video o el mensaje del post, dejando cumplidos reales que hacen sentir bien al creador.",
    avatar: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=250",
    isBoosterOnly: true
  },
  {
    handle: "JAY_URBANO_PR",
    name: "Jay El Real",
    bio: "Cazando los mejores clips, Shorts y debates de la isla 🔥",
    style: "Directo, energético y curioso. Siempre reacciona con fuego a los Shorts o videos de usuarios reales y tira una pregunta corta para prender los comentarios.",
    avatar: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=250",
    isBoosterOnly: true
  },
  {
    handle: "MATEO_EXPLORA",
    name: "Mateo Colón",
    bio: "Roadtrips por los 78 pueblos, proyectos locales y gente dura de PR 🌴",
    style: "Amigable, solidario y orgulloso de lo hecho en Puerto Rico. Respalda los proyectos, videos y publicaciones de la comunidad en ARGON.",
    avatar: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=250",
    isBoosterOnly: true
  }
];

async function getRealWorldTopic(agent, recentCaptions, recentYoutubeIds) {
  const randomImg = agent.images[Math.floor(Math.random() * agent.images.length)];
  const wantsYoutube = Array.isArray(agent.ytQueries) && agent.ytQueries.length > 0 && Math.random() < 0.20;

  if (wantsYoutube) {
    const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
    const videos = await fetchLiveYoutubeVideo(q);
    const freshVid = videos.find((v) => !recentYoutubeIds.has(v.videoId));
    if (freshVid) {
      return {
        rawInfo: `Video recién subido a YouTube: "${freshVid.title}"`,
        image: "",
        images: [],
        youtubeId: freshVid.videoId
      };
    }
  }

  if (agent.espnSport) {
    const scoresTxt = await fetchLiveSportsScores(agent.espnSport);
    if (scoresTxt && ![...recentCaptions].some((c) => c.includes(scoresTxt.slice(0, 40)))) {
      return { rawInfo: scoresTxt, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  if (agent.useWeatherToo && Math.random() < 0.4) {
    const weatherTxt = await fetchLivePRWeather();
    if (weatherTxt && ![...recentCaptions].some((c) => c.includes(weatherTxt.slice(0, 35)))) {
      return { rawInfo: weatherTxt, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  const headlines = await fetchLiveNews(agent.topic);
  for (const headline of headlines) {
    if (![...recentCaptions].some((old) => old.includes(headline.slice(0, 30)))) {
      return { rawInfo: headline, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  return {
    rawInfo: `Tema actual en Puerto Rico sobre: ${agent.bio}`,
    image: randomImg,
    images: [randomImg],
    youtubeId: ""
  };
}

async function createCompletePostBundle(author, rawInfo, youtubeId = "") {
  const authorHandle = author.handle.toUpperCase();
  const [c1, c2] = agents
    .filter((a) => a.handle !== authorHandle)
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  const prompt = `Genera un objeto JSON válido con una publicación informativa y un debate realista de 3 comentarios para la red social puertorriqueña ARGON.

AUTOR DEL POST: ${author.name} (@${authorHandle}) - Perfil: ${author.bio}. Estilo: ${author.style}
DATO REAL / NOTICIA / MARCADOR DE HOY: "${rawInfo}"

COMENTARISTA 1 (cuestiona o debate desde su área): ${c1.name} (@${c1.handle}) - Estilo: ${c1.style}
COMENTARISTA 2 (le responde a @${c1.handle} con otro ángulo): ${c2.name} (@${c2.handle}) - Estilo: ${c2.style}

Reglas estrictas:
1. "caption": 2 a 3 oraciones informativas en español de Puerto Rico usando los datos reales y cerrando con una pregunta picante. Usa 1-2 emojis.
2. "reply1": Comentario de @${c1.handle} reaccionando a un detalle específico del post (máximo 2 oraciones).
3. "reply2": Comentario de @${c2.handle} mencionando a @${c1.handle} y debatiendo su punto (máximo 2 oraciones).
4. "authorReply": Respuesta de @${authorHandle} contestándole a @${c2.handle} defendiendo su post (máximo 2 oraciones).

Devuelve ÚNICAMENTE este JSON exacto:
{"caption":"...","reply1":"...","reply2":"...","authorReply":"..."}`;

  const rawJson = await askGemini(prompt, true);
  if (!rawJson) return null;

  try {
    const clean = rawJson.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.caption) return null;

    const finalCaption = youtubeId ? `${parsed.caption} https://youtu.be/${youtubeId}` : parsed.caption;
    const baseTs = Date.now() + 2000;
    const comments = [];

    if (parsed.reply1) comments.push({ handle: c1.handle, text: parsed.reply1, createdAt: baseTs });
    if (parsed.reply2) comments.push({ handle: c2.handle, text: parsed.reply2, createdAt: baseTs + 2500 });
    if (parsed.authorReply) comments.push({ handle: authorHandle, text: parsed.authorReply, createdAt: baseTs + 5000 });

    return { caption: finalCaption, comments };
  } catch (e) {
    return null;
  }
}

// Genera 2 comentarios de apoyo genuino y hype en UNA sola llamada para posts/Shorts de humanos reales
async function generateHumanBoostComments(humanPost, booster1, booster2) {
  const existingComments = Array.isArray(humanPost.comments) ? humanPost.comments.slice(-5) : [];
  const history =
    existingComments.length > 0
      ? existingComments.map((c) => `- @${c.handle}: "${c.text}"`).join("\n")
      : "Aún no hay comentarios. Serán los primeros en apoyar el post.";

  const mediaType = humanPost.isShort
    ? "un Short (video corto vertical)"
    : humanPost.video
    ? "un video subido directamente"
    : humanPost.youtubeId
    ? "un video compartido"
    : "una publicación con imagen/texto";

  const captionContext =
    humanPost.caption && humanPost.caption.trim().length > 0
      ? `Texto del autor: "${humanPost.caption.trim()}"`
      : `El autor subió ${mediaType} visual sin texto en la descripción (reacciona a que el clip/visual en ARGON se ve brutal y con buena energía).`;

  const prompt = `Genera un objeto JSON válido con 2 comentarios reales, variados y entusiastas en español de Puerto Rico para apoyar la publicación de un usuario humano real (@${humanPost.handle}) en la red social ARGON.

TIPO DE CONTENIDO: ${mediaType}
${captionContext}
COMENTARIOS PREVIOS EN EL POST:
${history}

AGENTE 1: ${booster1.name} (@${booster1.handle}) - Estilo: ${booster1.style}
AGENTE 2: ${booster2.name} (@${booster2.handle}) - Estilo: ${booster2.style}

Reglas:
- Si el último comentario lo hizo un humano preguntando o diciendo algo, que AGENTE 1 le responda directamente mencionándolo con @.
- Que ambos comentarios suenen 100% humanos, boricuas, distintos entre sí, dando apoyo real para motivar al creador (máximo 2 oraciones cortas cada uno, 1 emoji).
- Devuelve ÚNICAMENTE este JSON exacto:
{"c1":"...","c2":"..."}`;

  const rawJson = await askGemini(prompt, true);
  if (!rawJson) return null;

  try {
    const clean = rawJson.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean);
    const out = [];
    const nowTs = Date.now();
    if (parsed.c1) out.push({ handle: booster1.handle, text: parsed.c1, createdAt: nowTs + 800 });
    if (parsed.c2) out.push({ handle: booster2.handle, text: parsed.c2, createdAt: nowTs + 3200 });
    return out;
  } catch (e) {
    return null;
  }
}

async function generateSingleContextualReply(commenter, post) {
  const comments = Array.isArray(post.comments) ? post.comments.slice(-5) : [];
  const history =
    comments.length > 0
      ? comments.map((c) => `- @${c.handle}: "${c.text}"`).join("\n")
      : "Sin comentarios previos.";
  const lastHandle = comments.length > 0 ? comments[comments.length - 1].handle : post.handle;

  const prompt = `Eres ${commenter.name} (@${commenter.handle}) en la red social ARGON de Puerto Rico.
Tu estilo: ${commenter.style}
Post original de @${post.handle}: "${post.caption || ""}"
Comentarios recientes:
${history}

Respóndele directamente a @${lastHandle} sobre lo que acaba de decir con un argumento real de tu especialidad, en español de Puerto Rico (máximo 2 oraciones, 1 emoji, sin comillas).`;

  return await askGemini(prompt, false);
}

async function runAgentAutomation() {
  const now = Date.now();
  const botHandles = new Set(agents.map((a) => a.handle.toUpperCase()));
  const creatorAgents = agents.filter((a) => !a.isBoosterOnly);
  const boosterAgents = agents.filter((a) => a.isBoosterOnly);

  const models = await discoverAllowedModels();
  console.log(`🔎 Modelos detectados: ${models.slice(0, 4).join(", ")}`);

  const healthCheck = await askGemini("Responde solo: OK");
  if (!healthCheck) {
    console.error(`❌ GEMINI FALLÓ. Motivo: ${geminiLastError}`);
    process.exit(1);
  }
  console.log(`🧠 Gemini activo (${availableModels[0]}) • Sincronizando 20 agentes (15 creadores + 5 boosters)...`);

  // 1. Mantener los 20 perfiles actualizados en 'users'
  await Promise.all(
    agents.map((agent) => {
      const handleKey = agent.handle.toUpperCase();
      return setDoc(
        doc(db, "users", handleKey),
        {
          userName: agent.name,
          userHandle: handleKey,
          bio: agent.bio,
          avatar: agent.avatar,
          ageVerified: true,
          invitedBy: "BELTO43",
          subs: agent.isBoosterOnly ? 640 : 1380,
          balance: 10000,
          updatedAt: now
        },
        { merge: true }
      );
    })
  );

  // 2. Leer últimos 50 posts/Shorts para detectar todos los de humanos reales
  const recentCaptions = new Set();
  const recentYoutubeIds = new Set();
  const existingPosts = [];

  try {
    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)));
    snap.forEach((d) => {
      const data = d.data();
      if (data?.caption) recentCaptions.add(data.caption);
      if (data?.youtubeId) recentYoutubeIds.add(data.youtubeId);
      existingPosts.push(Object.assign({ id: d.id }, data));
    });
  } catch (e) {}

  // =========================================================================
  // 3. PRIORIDAD #1: ESCUADRÓN BOOSTER PARA POSTS Y SHORTS DE HUMANOS REALES
  // =========================================================================
  const humanAuthoredPosts = existingPosts.filter((p) => {
    if (p.visibility === "private" || !p.handle) return false;
    return !botHandles.has(p.handle.toUpperCase());
  });

  // Ordenar dando prioridad a los posts humanos con 0 likes / pocas views (recién subidos)
  const prioritizedHumanPosts = [...humanAuthoredPosts].sort((a, b) => (a.likes || 0) - (b.likes || 0)).slice(0, 6);

  for (const hPost of prioritizedHumanPosts) {
    const currentLikes = Number(hPost.likes || 0);
    const currentViews = Number(hPost.views || 0);
    const currentComments = Array.isArray(hPost.comments) ? hPost.comments : [];

    // Si el post humano está frío (< 15 likes o < 50 views), darle un empuje grande inicial; si ya tiene, sumarle crecimiento constante
    const isColdPost = currentLikes < 15 || currentViews < 50;
    const addedLikes = isColdPost ? Math.floor(Math.random() * 30) + 18 : Math.floor(Math.random() * 11) + 5;
    const addedViews = isColdPost ? Math.floor(Math.random() * 155) + 85 : Math.floor(Math.random() * 45) + 20;

    // Elegir boosters que aún no hayan comentado en este post humano (si ya comentaron los 5, permite mezclar con creadores)
    const commentedHandles = new Set(currentComments.map((c) => (c.handle || "").toUpperCase()));
    let availablePool = boosterAgents.filter((b) => !commentedHandles.has(b.handle.toUpperCase()));
    if (availablePool.length < 2) {
      const backupPool = creatorAgents.filter((c) => !commentedHandles.has(c.handle.toUpperCase()));
      availablePool = [...availablePool, ...backupPool];
    }

    let generatedComments = [];
    if (currentComments.length < 18 && availablePool.length >= 2) {
      const [b1, b2] = availablePool.sort(() => 0.5 - Math.random()).slice(0, 2);
      const boostPair = await generateHumanBoostComments(hPost, b1, b2);
      if (boostPair && boostPair.length > 0) {
        generatedComments = boostPair;
      }
    }

    const updatePayload = {
      likes: increment(addedLikes),
      views: increment(addedViews)
    };
    if (generatedComments.length > 0) {
      updatePayload.comments = arrayUnion(...generatedComments);
    }

    await updateDoc(doc(db, "posts", hPost.id), updatePayload);

    // Subir también seguidores (subs) al usuario humano para que su cuenta crezca
    try {
      await setDoc(
        doc(db, "users", hPost.handle.toUpperCase()),
        { subs: increment(isColdPost ? Math.floor(Math.random() * 5) + 2 : 1) },
        { merge: true }
      );
    } catch (e) {}

    // Enviar notificaciones de like y de los nuevos comentarios al humano
    const likeBooster = boosterAgents[Math.floor(Math.random() * boosterAgents.length)];
    await addDoc(collection(db, "notifications"), {
      to: hPost.handle,
      from: likeBooster.handle,
      type: "like",
      text: ` y ${addedLikes - 1} personas más le dieron Me Gusta a tu publicación 🔥`,
      postId: hPost.id,
      createdAt: Date.now()
    });

    for (const cObj of generatedComments) {
      await addDoc(collection(db, "notifications"), {
        to: hPost.handle,
        from: cObj.handle,
        type: "comment",
        text: `comentó en tu post: "${cObj.text.slice(0, 55)}..."`,
        postId: hPost.id,
        createdAt: Date.now() + 300
      });
    }

    console.log(
      `🚀 Boost humano a @${hPost.handle} (post ${hPost.id.slice(0, 6)}): +${addedViews} views, +${addedLikes} likes, +${generatedComments.length} comentarios`
    );
  }

  // =========================================================================
  // 4. PUBLICAR 3 POSTS INFORMATIVOS NUEVOS (SOLO LOS 15 CREADORES)
  // =========================================================================
  const recentAuthors = new Set(existingPosts.slice(0, 10).map((p) => (p.handle || "").toUpperCase()));
  const freshCreators = creatorAgents
    .filter((a) => !recentAuthors.has(a.handle.toUpperCase()))
    .sort(() => 0.5 - Math.random());
  const otherCreators = creatorAgents
    .filter((a) => recentAuthors.has(a.handle.toUpperCase()))
    .sort(() => 0.5 - Math.random());
  const selectedCreators = [...freshCreators, ...otherCreators].slice(0, 3);

  let offset = 0;
  for (const agent of selectedCreators) {
    const handleKey = agent.handle.toUpperCase();
    const topicData = await getRealWorldTopic(agent, recentCaptions, recentYoutubeIds);
    const bundle = await createCompletePostBundle(agent, topicData.rawInfo, topicData.youtubeId);
    if (!bundle) continue;

    recentCaptions.add(bundle.caption);
    if (topicData.youtubeId) recentYoutubeIds.add(topicData.youtubeId);

    await addDoc(collection(db, "posts"), {
      handle: handleKey,
      userName: agent.name,
      avatar: agent.avatar,
      caption: bundle.caption,
      image: topicData.image,
      images: topicData.images,
      video: "",
      youtubeId: topicData.youtubeId,
      isShort: false,
      visibility: "public",
      likes: Math.floor(Math.random() * 85) + 28,
      views: Math.floor(Math.random() * 420) + 95,
      comments: bundle.comments,
      createdAt: Date.now() + offset++ * 1000
    });

    const tipo = topicData.youtubeId ? "Video YT" : "Post Informativo + Foto";
    console.log(`✓ ${tipo} publicado por @${handleKey} (${bundle.comments.length} comentarios cruzados)`);
  }

  // =========================================================================
  // 5. RESPONDER A HUMANOS QUE COMENTARON EN POSTS DE BOTS + HILOS ACTIVOS
  // =========================================================================
  const botPostsWithHumanComments = existingPosts.filter((p) => {
    if (p.visibility === "private" || !p.handle) return false;
    const isBotPost = botHandles.has(p.handle.toUpperCase());
    const hasHumanComment =
      Array.isArray(p.comments) && p.comments.some((c) => c.handle && !botHandles.has(c.handle.toUpperCase()));
    return isBotPost && hasHumanComment && (p.comments?.length || 0) < 18;
  });

  const regularBotPosts = existingPosts
    .filter((p) => p.visibility !== "private" && p.handle && botHandles.has(p.handle.toUpperCase()) && !botPostsWithHumanComments.includes(p))
    .sort(() => 0.5 - Math.random());

  const targetThreads = [...botPostsWithHumanComments, ...regularBotPosts].slice(0, 2);

  for (const post of targetThreads) {
    const currentComments = Array.isArray(post.comments) ? post.comments : [];
    const lastComment = currentComments.length > 0 ? currentComments[currentComments.length - 1] : null;
    const lastAuthor = lastComment ? lastComment.handle.toUpperCase() : post.handle.toUpperCase();

    // Si un humano comentó en el post de un agente (ej. @NBA_ZONA_PR), que le conteste el MISMO dueño del post primero
    const postOwnerAgent = agents.find((a) => a.handle.toUpperCase() === post.handle.toUpperCase());
    const lastWasHuman = lastComment && !botHandles.has(lastAuthor);

    const commenter =
      lastWasHuman && postOwnerAgent
        ? postOwnerAgent
        : agents.filter((a) => a.handle.toUpperCase() !== lastAuthor)[
            Math.floor(Math.random() * (agents.length - 1))
          ];

    if (!commenter) continue;

    const commentTxt = await generateSingleContextualReply(commenter, post);
    if (!commentTxt) continue;

    const newCommentObj = {
      handle: commenter.handle,
      text: commentTxt,
      createdAt: Date.now() + Math.floor(Math.random() * 2000)
    };

    await updateDoc(doc(db, "posts", post.id), {
      comments: arrayUnion(newCommentObj),
      likes: increment(Math.floor(Math.random() * 8) + 3),
      views: increment(Math.floor(Math.random() * 28) + 10)
    });

    if (lastWasHuman && lastComment?.handle) {
      await addDoc(collection(db, "notifications"), {
        to: lastComment.handle,
        from: commenter.handle,
        type: "comment",
        text: `te respondió en su hilo: "${commentTxt.slice(0, 55)}..."`,
        postId: post.id,
        createdAt: Date.now()
      });
    }
    console.log(`✓ @${commenter.handle} respondió en el hilo de @${post.handle}`);
  }

  console.log("✅ Ejecución completada al 100%.");
  process.exit(0);
}

runAgentAutomation().catch((err) => {
  console.error("❌ Error general:", err);
  process.exit(1);
});
