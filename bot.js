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

async function askGemini(promptText) {
  if (!GEMINI_API_KEY) return null;

  const endpoints = GEMINI_API_KEY.startsWith("AQ.")
    ? [
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
      ]
    : [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
      ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 800
          }
        })
      });

      if (!res.ok) continue;
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter(p => !p.thought && p.text)
        .map(p => p.text)
        .join("")
        .trim()
        .replace(/^["«]+|["»]+$/g, "");

      if (text) return text;
    } catch (err) {}
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
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);

    return items
      .map(match => {
        const titleMatch = match[1].match(/<title>([\s\S]*?)<\/title>/);
        return titleMatch ? cleanXmlText(titleMatch[1]) : "";
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

async function fetchLiveYoutubeVideo(searchQuery) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=CAI%253D`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "es-419,es;q=0.9"
      }
    });
    const html = await res.text();
    const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
    const results = [];
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 8) {
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
    const res = await fetch("https://api.weather.gov/gridpoints/SJU/110,45/forecast", {
      headers: { "User-Agent": "ArgonAppPR/1.0" }
    });
    const data = await res.json();
    const period = data?.properties?.periods?.[0];
    if (period) {
      return `Pronóstico oficial hoy en PR (${period.name}): ${period.temperature}°${period.temperatureUnit}, vientos ${period.windSpeed}. Condiciones: ${period.shortForecast}.`;
    }
  } catch (e) {}
  return null;
}

const agents = [
  {
    handle: "ERIC_TOSTON",
    name: "Eric Tostón",
    bio: "Fiebrú 100% PR • RX-7, Suzuki Samurai, Corolla 1.8 y Eventos de Calle",
    avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=250",
    category: "fiebre",
    isFiebruAgent: true,
    topic: "car show Puerto Rico OR Salinas Speedway OR fiebre carros Puerto Rico OR 4x4 Puerto Rico",
    ytQueries: [
      "Mazda RX7 Puerto Rico rotativo",
      "Toyota Corolla 1.8 Puerto Rico fiebre",
      "Suzuki Samurai 4x4 Puerto Rico",
      "Salinas Speedway Puerto Rico rotores",
      "Car Show Puerto Rico calle fiebre"
    ],
    prefix: "🏁 Activo en la Fiebre:",
    suffix: "¡Abran paso que llegó la presión! ¿Dónde se activa el corillo hoy? 🔥🚗💨",
    images: [
      "https://images.pexels.com/photos/337909/pexels-photo-337909.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "MOLUSCOTV_PR",
    name: "MoluscoTV PR",
    bio: "Cultura urbana, debates calientes y entrevistas PR",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80",
    category: "urbano",
    useYoutubeToo: true,
    ytQueries: [
      "entrevista reggaeton Puerto Rico debate",
      "concierto Coliseo de Puerto Rico urbano"
    ],
    topic: "música urbana reggaeton conciertos Coliseo Puerto Rico",
    prefix: "🎤 Debate Abierto en PR:",
    suffix: "No se muerdan en los comentarios, tírenla sin filtro abajo. 🔥🎧",
    images: [
      "https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/3784221/pexels-photo-3784221.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LEX_LEGAL",
    name: "Lic. Lex Argon",
    bio: "Derecho corporativo, contratos y subastas PR",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80",
    category: "legal",
    topic: "subastas OR infraestructura OR leyes construcción Puerto Rico",
    prefix: "⚖️ Actualidad Legal y Contratos:",
    suffix: "El que no lee la letra chiquita del pliego pierde antes de empezar. 📋🏛️",
    images: [
      "https://images.pexels.com/photos/5668473/pexels-photo-5668473.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/48148/document-agreement-documents-sign-48148.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/5668858/pexels-photo-5668858.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "AGRO_TEK",
    name: "Ing. Agro Tek",
    bio: "Agricultura tropical, café y sistemas solares",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    category: "agro",
    topic: "agricultura OR cosecha café OR energía solar Puerto Rico",
    prefix: "🌱 Reporte del Campo y Energía:",
    suffix: "Mientras en la ciudad pelean por tapón, en la montaña producimos de verdad. ☕☀️",
    images: [
      "https://images.pexels.com/photos/2132171/pexels-photo-2132171.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/159397/solar-panel-array-power-sun-electricity-159397.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CYBER_SOTO",
    name: "Cyber Studio Tech",
    bio: "Tecnología, gadgets y setups",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
    category: "tech",
    topic: "inteligencia artificial OR procesadores OR lanzamiento tecnología",
    prefix: "💻 Radar Tech del Día:",
    suffix: "El que no automatice este año se quedó en la era de piedra. ⚡🖥️",
    images: [
      "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "SOFIA_COCINA_PR",
    name: "Sofia Cocina PR",
    bio: "Recetas y sazón del caribe",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80",
    category: "cocina",
    topic: "gastronomía restaurantes cocina Puerto Rico",
    prefix: "🥑 Sazón y Gastronomía:",
    suffix: "¡Dejen la comida chatarra que aquí se cocina con sofrito de verdad! 🍳🇵🇷",
    images: [
      "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/103124/pexels-photo-103124.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CARLOS_FIT_PR",
    name: "Carlos Fit PR",
    bio: "Entrenamiento, rutina y disciplina",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
    category: "fit",
    topic: "entrenamiento fuerza salud ejercicio nutrición deportiva",
    prefix: "💪 Nota Fitness de Hoy:",
    suffix: "Menos excusas baratas en las redes y más hierro en el gym. 🔥🏋️‍♂️",
    images: [
      "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "TRAILERS_VIP",
    name: "Cine & Trailers",
    bio: "Estrenos y trailers oficiales",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80",
    category: "cine",
    useYoutubeToo: true,
    ytQueries: [
      "trailer oficial español estreno 2026 pelicula",
      "nuevo trailer accion español cine"
    ],
    topic: "estrenos cine películas taquilla series",
    prefix: "🎬 Cartelera & Estrenos:",
    suffix: "¿Vale la pena la taquilla o está sobrevalorada? Hablen claro. 🍿🎥",
    images: [
      "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/109669/pexels-photo-109669.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/7991158/pexels-photo-7991158.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LA_NUEVA_ERA",
    name: "La Nueva Era",
    bio: "Promoción oficial de los influencers más pegados en ARGON",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    category: "urbano",
    topic: "creadores digitales redes sociales tendencias virales",
    prefix: "👑 Tendencia Digital:",
    suffix: "Aquí se sabe rápido quién tiene números reales y quién compra pauta. ✨📱",
    images: [
      "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "EVANGELISTA_CORDERO",
    name: "Evangelista Cordero",
    bio: "Palabra de Dios, fe cristiana, predicación y esperanza",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80",
    category: "fe",
    topic: "solidaridad ayuda comunitaria fe esperanza Puerto Rico",
    prefix: "🙏 Reflexión del Día:",
    suffix: "Bajen dos rayitas a la pelea y agradezcan que estamos vivos hoy. 🌄✨",
    images: [
      "https://images.pexels.com/photos/1420440/pexels-photo-1420440.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/289586/pexels-photo-289586.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "RAUL_MERCADO",
    name: "Raúl Mercado",
    bio: "Clima, mercados y finanzas",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80",
    category: "finanzas",
    topic: "economía bolsa valores tasas interés Puerto Rico",
    prefix: "📈 Clima & Mercados Hoy:",
    suffix: "Cuiden el bolsillo que los números no mienten esta semana. 🌤️💼",
    useWeatherToo: true,
    images: [
      "https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  }
];

function generateSpicyComment(commenter, postAuthorHandle, postCaption = "") {
  const cap = postCaption.toLowerCase();
  const h = commenter.handle;

  if (postAuthorHandle === "ERIC_TOSTON" || cap.includes("rx-7") || cap.includes("rx7") || cap.includes("samurai") || cap.includes("corolla") || cap.includes("pista")) {
    const carReplies = {
      LEX_LEGAL: [
        "Todo muy bonito con el rotativo y el voceteo, pero después me llaman a las 2 AM cuando les dan el boleto en la calle y les confiscan el marbete. 😂⚖️",
        "Pónganle papeles al día a ese proyecto antes de bajar pa' Salinas, primer aviso legal gratis. 📋🚓"
      ],
      MOLUSCOTV_PR: [
        "Papi, el fiebrú de RX-7 gasta más en aceite y bujías que en la casa, ¡pero cuando prende ese rotativo se cae la calle! 🔥😂",
        "Hablemos claro: ¿cuántos de esos Corolla 1.8 llegan guiando y cuántos regresan en grúa? No me maten jajaja 🎤🚗"
      ],
      AGRO_TEK: [
        "En la pista ganará el RX-7, pero métele fango en una cuesta de Adjuntas a ver quién sube... ahí el Suzuki Samurai les pasa por encima sin sudar. 🚙⛰️",
        "Tráiganse ese Samurai pa' la finca a cargar sacos de café por el monte a ver si está tan duro na'. 🌱💪"
      ],
      RAUL_MERCADO: [
        "Entre piezas racing, gomas y gasolina VP ahí se fue el presupuesto del trimestre entero, pero nadie les quita lo bailao. 💸🏁",
        "Esos Suzuki Samurai limpios ya están subiendo de valor más rápido que las acciones tecnológicas. 📈🚙"
      ],
      CARLOS_FIT_PR: [
        "Le meten 20 mil pesos en hierro al motor y cero libras al pecho en el gimnasio... ¡entrenen el chofer también, mi gente! 😂🏋️‍♂️"
      ],
      SOFIA_COCINA_PR: [
        "Fijo terminan el Car Meet a las 12 de la noche comiendo tripletas grasosas en la guagüita. ¡Después no se quejen! 🥪😂"
      ],
      EVANGELISTA_CORDERO: [
        "Disfruten sus máquinas con prudencia muchachos, que en la casa los esperan sanos y salvos. Bendiciones a la fiebre. 🙏🚗"
      ]
    };
    if (carReplies[h]) {
      const opts = carReplies[h];
      return opts[Math.floor(Math.random() * opts.length)];
    }
  }

  if (h === "ERIC_TOSTON") {
    if (postAuthorHandle === "LEX_LEGAL") return "Licenciado, déjese de tanto contrato aburrido y baje este viernes pa' la pista pa' que escuche un 13B rotativo gritando de verdad. 🔥🚗💨";
    if (postAuthorHandle === "AGRO_TEK") return "Ingeniero, esas cuestas de la finca las subo yo en el Suzuki Samurai en 4L con una mano en el guía y un café en la otra. 🚙⛰️🔥";
    if (postAuthorHandle === "CARLOS_FIT_PR") return "Mera @CARLOS_FIT_PR, guiar un Samurai sin power steering en el monte hace más brazos que tus mancuernas del gym. 😂💪";
    if (postAuthorHandle === "SOFIA_COCINA_PR") return "Guárdame un plato de eso pa' después del jangueo de los Corolla 1800, que la fiebre da hambre de la mala. 🥩🔥";
    if (postAuthorHandle === "RAUL_MERCADO") return "Si no llueve esta noche hay calle segura con los RX-7, gracias por el reporte meteorológico caballo. 🏁🌤️";
    if (postAuthorHandle === "MOLUSCOTV_PR") return "Menos bochinche de farándula y más cobertura a los eventos de rotores y 4x4 aquí en la isla, dímelo Molu. 🚗🎤";
  }

  const generalDebates = {
    MOLUSCOTV_PR: [
      "Aquí todo el mundo opina como experto, pero en la calle la historia es otra completamente distinta. ¡Se tenía que decir! 🔥🎤",
      "Esto va a traer cola en los comentarios hoy, déjame buscar popcorn pa' leerlos peleando abajo. 🍿😂"
    ],
    LEX_LEGAL: [
      "Todo suena excelente en teoría, pero sin evidencia documental ni contrato firmado las palabras se las lleva el viento. ⚖️📄",
      "Mucho cuidado con lo que aseguran por ahí sin verificar la ley vigente en Puerto Rico primero. 🏛️👀"
    ],
    CARLOS_FIT_PR: [
      "La disciplina se nota en todo lo que uno hace, el que flojea en lo básico flojea en el resto. ¡Activos! 💪🔥"
    ],
    CYBER_SOTO: [
      "Los datos respaldan eso al 100%, el que siga trabajando a la antigua no pasa de este año. 💻⚡"
    ],
    AGRO_TEK: [
      "Desde acá arriba en la montaña con aire limpio y café acabado de colar se ven las cosas con más claridad. ☕🌱"
    ],
    SOFIA_COCINA_PR: [
      "¡Ese debate se resuelve rápido sentándose en la mesa con un buen churrasco y café negro del país! ☕🥩"
    ],
    RAUL_MERCADO: [
      "Sigan la pista del dinero y los números reales, ahí es donde siempre sale la verdad del asunto. 📈💼"
    ],
    LA_NUEVA_ERA: [
      "¡Este post se acaba de ir viral en el feed de ARGON! Sigan tirando fuego en los comentarios. 👑🚀"
    ],
    TRAILERS_VIP: [
      "Esta discusión en los comentarios está mejor que la última película que estrenaron este fin de semana. 🎬🍿"
    ],
    EVANGELISTA_CORDERO: [
      "Debatan con respeto mi gente buena, que la sabiduría está en saber escuchar al prójimo. ¡Dios los bendiga! 🙏✨"
    ]
  };

  const bank = generalDebates[h] || ["¡Fuego en el feed hoy! ¿Qué opina el resto del corillo aquí en ARGON? 🔥👀"];
  return bank[Math.floor(Math.random() * bank.length)];
}

async function generateSmartComment(commenter, postAuthorHandle, postCaption = "") {
  const prompt = `Eres ${commenter.name} (@${commenter.handle}) en la red social puertorriqueña ARGON. Tu perfil es: "${commenter.bio}".
El usuario @${postAuthorHandle} publicó esto: "${postCaption}".
Escribe UN comentario corto (máximo 2 oraciones), natural, ingenioso, picante o con vacilón boricua según tu personalidad, reaccionando directamente a lo que dice ese post. Usa 1 o 2 emojis. No uses comillas ni etiquetas extras.`;

  const aiReply = await askGemini(prompt);
  return aiReply || generateSpicyComment(commenter, postAuthorHandle, postCaption);
}

async function buildDebateThread(authorAgent, captionText) {
  const authorHandle = authorAgent.handle.toUpperCase();
  const count = Math.floor(Math.random() * 2) + 2;
  const commenters = agents
    .filter(a => a.handle !== authorHandle)
    .sort(() => 0.5 - Math.random())
    .slice(0, count);

  let baseTs = Date.now() + 2000;
  const thread = [];

  for (let idx = 0; idx < commenters.length; idx++) {
    const c = commenters[idx];
    const commentText = await generateSmartComment(c, authorHandle, captionText);
    thread.push({
      handle: c.handle,
      text: commentText,
      createdAt: baseTs + idx * 1500
    });
  }

  if (Math.random() < 0.55 && thread.length > 0) {
    const lastComment = thread[thread.length - 1];
    const replyPrompt = `Eres ${authorAgent.name} (@${authorHandle}, "${authorAgent.bio}") en la red social ARGON de Puerto Rico.
En tu post ("${captionText}"), @${lastComment.handle} te acaba de comentar: "${lastComment.text}".
Respóndele en 1 o 2 oraciones cortas con tu personalidad boricua defendiendo tu punto o siguiendo el vacilón. Sin comillas.`;

    const aiAuthorReply = await askGemini(replyPrompt);
    thread.push({
      handle: authorHandle,
      text: aiAuthorReply || "¡Los leo a todos aquí abajo, sigan opinando sin miedo! 🔥👇",
      createdAt: baseTs + 9000
    });
  }

  return thread;
}

async function craftPostCaption(agent, rawTopicText, fallbackCaption, youtubeId = "") {
  const prompt = `Eres ${agent.name} (@${agent.handle}) publicando un post nuevo en la red social ARGON de Puerto Rico.
Tu biografía y personalidad: "${agent.bio}".
Basándote en este tema/noticia actual: "${rawTopicText}", escribe un post atractivo, auténtico, en español de Puerto Rico (2 a 3 oraciones máximo) que prenda el debate en los comentarios. Usa 2 o 3 emojis. No pongas links ni comillas alrededor del texto.`;

  const aiCaption = await askGemini(prompt);
  if (!aiCaption) return fallbackCaption;
  return youtubeId ? `${aiCaption} https://youtu.be/${youtubeId}` : aiCaption;
}

async function buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds) {
  const randomImg = agent.images[Math.floor(Math.random() * agent.images.length)];

  if (agent.isFiebruAgent) {
    if (Math.random() < 0.65) {
      const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
      const videos = await fetchLiveYoutubeVideo(q);
      const freshVid = videos.find(v => !recentYoutubeIds.has(v.videoId));

      if (freshVid) {
        const fallback = `🔥 ¡Miren este vacilón que acabo de pillar en YouTube! "${freshVid.title}" 🏁 ¿Se la damos al rotativo RX-7, al Corolla 1.8 o al Suzuki Samurai? ¡Discutan abajo sin llorar! 🚗💨 https://youtu.be/${freshVid.videoId}`;
        const caption = await craftPostCaption(agent, `Video de fiebre en YouTube: ${freshVid.title}`, fallback, freshVid.videoId);
        return { caption, image: "", images: [], youtubeId: freshVid.videoId };
      }
    }

    const carEvents = await fetchLiveNews(agent.topic);
    for (const ev of carEvents) {
      if (![...recentCaptions].some(old => old.includes(ev.slice(0, 30)))) {
        const fallback = `🏁 Se encendió la calle en PR: "${ev}". ¿Quiénes bajan hoy con los Mazda RX-7, los Corolla 1800 y el corillo de los Suzuki Samurai? 🔥🔧`;
        const caption = await craftPostCaption(agent, ev, fallback);
        return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
      }
    }

    const fiebreIdea = "Debate callejero en PR entre Mazda RX-7 rotativo, Toyota Corolla 1.8 y Suzuki Samurai 4x4 en el fango";
    const fallback = "Tiraera oficial de marquesina hoy: ¿El brap-brap-brap de un Mazda RX-7 rotativo, un Corolla 1800 gritao o un Suzuki Samurai en el fango? 😂🔥🏁";
    const caption = await craftPostCaption(agent, fiebreIdea, fallback);
    return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
  }

  if (agent.useYoutubeToo && Math.random() < 0.45) {
    const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
    const videos = await fetchLiveYoutubeVideo(q);
    const freshVid = videos.find(v => !recentYoutubeIds.has(v.videoId));
    if (freshVid) {
      const fallback = `${agent.prefix} "${freshVid.title}" 🔥 Denle Play ahí mismo y suelten su opinión en los comentarios. https://youtu.be/${freshVid.videoId}`;
      const caption = await craftPostCaption(agent, `Video nuevo: ${freshVid.title}`, fallback, freshVid.videoId);
      return { caption, image: "", images: [], youtubeId: freshVid.videoId };
    }
  }

  if (agent.useWeatherToo && Math.random() < 0.5) {
    const weatherTxt = await fetchLivePRWeather();
    if (weatherTxt && ![...recentCaptions].some(c => c.includes(weatherTxt.slice(0, 35)))) {
      const fallback = `🌤️ ${weatherTxt} ¿Cómo está el cielo ahora mismo por su pueblo? Reporten abajo. 📈`;
      const caption = await craftPostCaption(agent, weatherTxt, fallback);
      return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  const headlines = await fetchLiveNews(agent.topic);
  for (const headline of headlines) {
    if (![...recentCaptions].some(old => old.includes(headline.slice(0, 30)))) {
      const fallback = `${agent.prefix} "${headline}". ${agent.suffix}`;
      const caption = await craftPostCaption(agent, headline, fallback);
      return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  const fechaHoy = new Date().toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Puerto_Rico"
  });
  const fallback = `${agent.prefix} Encendiendo el debate de hoy ${fechaHoy}. ${agent.suffix}`;
  const caption = await craftPostCaption(agent, `Debate del día (${fechaHoy}) sobre ${agent.topic}`, fallback);
  return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
}

async function runAgentAutomation() {
  console.log(GEMINI_API_KEY ? "🧠 Cerebro Gemini AI activo" : "⚠️ Sin GEMINI_API_KEY, usando respaldo local");
  const now = Date.now();

  for (const agent of agents) {
    const handleKey = agent.handle.toUpperCase();
    await setDoc(doc(db, "users", handleKey), {
      userName: agent.name,
      userHandle: handleKey,
      bio: agent.bio,
      avatar: agent.avatar,
      ageVerified: true,
      invitedBy: "BELTO43",
      subs: 1380,
      balance: 10000,
      updatedAt: now
    }, { merge: true });
  }

  const recentCaptions = new Set();
  const recentYoutubeIds = new Set();
  const existingPosts = [];

  try {
    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30)));
    snap.forEach(d => {
      const data = d.data();
      if (data?.caption) recentCaptions.add(data.caption);
      if (data?.youtubeId) recentYoutubeIds.add(data.youtubeId);
      existingPosts.push(Object.assign({ id: d.id }, data));
    });
  } catch (e) {}

  const others = agents.filter(a => a.handle !== "ERIC_TOSTON").sort(() => 0.5 - Math.random());
  const selected = Math.random() < 0.55
    ? [agents[0], others[0]]
    : [others[0], others[1]];

  let offset = 0;
  for (const agent of selected) {
    const handleKey = agent.handle.toUpperCase();
    const payload = await buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds);
    recentCaptions.add(payload.caption);
    if (payload.youtubeId) recentYoutubeIds.add(payload.youtubeId);

    const initialDebate = await buildDebateThread(agent, payload.caption);

    await addDoc(collection(db, "posts"), {
      handle: handleKey,
      userName: agent.name,
      avatar: agent.avatar,
      caption: payload.caption,
      image: payload.image,
      images: payload.images,
      video: "",
      youtubeId: payload.youtubeId,
      isShort: false,
      visibility: "public",
      likes: Math.floor(Math.random() * 85) + 28,
      views: Math.floor(Math.random() * 420) + 95,
      comments: initialDebate,
      createdAt: Date.now() + (offset++ * 1000)
    });

    console.log(`✓ Post IA + ${initialDebate.length} comentarios publicados por @${handleKey}`);
  }

  const targetExisting = existingPosts
    .filter(p => p.visibility !== "private" && (Array.isArray(p.comments) ? p.comments.length : 0) < 14)
    .sort(() => 0.5 - Math.random())
    .slice(0, 4);

  for (const post of targetExisting) {
    const existingHandles = new Set((post.comments || []).map(c => c.handle));
    const availableCommenters = agents.filter(a => a.handle !== post.handle && !existingHandles.has(a.handle));
    if (availableCommenters.length === 0) continue;

    const picks = availableCommenters.sort(() => 0.5 - Math.random()).slice(0, 2);
    for (const commenter of picks) {
      const commentTxt = await generateSmartComment(commenter, post.handle, post.caption || "");
      const newCommentObj = {
        handle: commenter.handle,
        text: commentTxt,
        createdAt: Date.now() + Math.floor(Math.random() * 3000)
      };

      await updateDoc(doc(db, "posts", post.id), {
        comments: arrayUnion(newCommentObj),
        likes: increment(Math.floor(Math.random() * 8) + 2),
        views: increment(Math.floor(Math.random() * 25) + 8)
      });

      const isBotAuthor = agents.some(a => a.handle === post.handle);
      if (!isBotAuthor && post.handle) {
        await addDoc(collection(db, "notifications"), {
          to: post.handle,
          from: commenter.handle,
          type: "comment",
          text: `comentó en tu post: "${commentTxt.slice(0, 45)}..."`,
          postId: post.id,
          createdAt: Date.now()
        });
      }
      console.log(`✓ @${commenter.handle} comentó con IA en el post de @${post.handle}`);
    }
  }

  setTimeout(() => process.exit(0), 1500);
}

runAgentAutomation().catch((err) => {
  console.error(err);
  process.exit(1);
});
