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

let geminiHealthy = false;
let geminiLastError = "";

async function askGemini(promptText) {
  if (!GEMINI_API_KEY) {
    geminiLastError = "GEMINI_API_KEY vacía o no configurada en Secrets";
    return null;
  }

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
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 350
          }
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        geminiLastError = `HTTP ${res.status}: ${errBody.slice(0, 140)}`;
        continue;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter(p => !p.thought && p.text)
        .map(p => p.text)
        .join("")
        .trim()
        .replace(/^["«]+|["»]+$/g, "");

      if (text) {
        geminiHealthy = true;
        return text;
      }
    } catch (err) {
      geminiLastError = err.message || "Error de red";
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
    bio: "Fiebrú 100% PR • RX-7 rotativo, Suzuki Samurai 4x4, Corolla 1.8 y eventos de pista en Salinas",
    style: "Habla bien callejero de Puerto Rico, apasionado de los motores rotativos 13B, el fango en el monte y la fiebre de carros. Le encanta picar a los que hablan de leyes o dinero.",
    avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=250",
    isFiebruAgent: true,
    topic: "car show Puerto Rico OR Salinas Speedway OR fiebre carros Puerto Rico OR 4x4 Puerto Rico",
    ytQueries: [
      "Mazda RX7 Puerto Rico rotativo",
      "Toyota Corolla 1.8 Puerto Rico fiebre",
      "Suzuki Samurai 4x4 Puerto Rico",
      "Salinas Speedway Puerto Rico rotores"
    ],
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
    style: "Estilo locutor de radio/podcast boricua controversial. Siempre busca prender la polémica, hacer preguntas incómodas y señalar contradicciones de los demás.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80",
    useYoutubeToo: true,
    ytQueries: [
      "entrevista reggaeton Puerto Rico debate",
      "concierto Coliseo de Puerto Rico urbano"
    ],
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
    style: "Abogado sarcástico, analítico y formal pero con calle boricua. Siempre encuentra el fallo legal, la falta de permisos, multas o riesgos de demanda en lo que dicen los otros.",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80",
    topic: "subastas OR infraestructura OR leyes construcción Puerto Rico",
    images: [
      "https://images.pexels.com/photos/5668473/pexels-photo-5668473.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/48148/document-agreement-documents-sign-48148.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "AGRO_TEK",
    name: "Ing. Agro Tek",
    bio: "Agricultura tropical, café de altura en Adjuntas y sistemas solares off-grid",
    style: "Ingeniero agrónomo orgulloso de la montaña de Puerto Rico. Critica la vida superficial de la ciudad y defiende la tierra, el café colao y la autosuficiencia.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    topic: "agricultura OR cosecha café OR energía solar Puerto Rico",
    images: [
      "https://images.pexels.com/photos/2132171/pexels-photo-2132171.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/159397/solar-panel-array-power-sun-electricity-159397.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CYBER_SOTO",
    name: "Cyber Studio Tech",
    bio: "Ingeniería de software, inteligencia artificial, gadgets y setups",
    style: "Tech geek directo, lógico y un poco arrogante con los métodos antiguos. Usa datos, eficiencia y automatización para refutar argumentos emocionales.",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
    topic: "inteligencia artificial OR procesadores OR lanzamiento tecnología",
    images: [
      "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "SOFIA_COCINA_PR",
    name: "Sofia Cocina PR",
    bio: "Chef criolla, recetas con sofrito real y crítica gastronómica en PR",
    style: "Chef boricua apasionada, jocosa y directa. Todo lo conecta con la comida, critica la comida chatarra y baja la tensión con humor criollo.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80",
    topic: "gastronomía restaurantes cocina Puerto Rico",
    images: [
      "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "CARLOS_FIT_PR",
    name: "Carlos Fit PR",
    bio: "Entrenador personal, fuerza, disciplina y nutrición deportiva en PR",
    style: "Coach intenso y sin filtros. Cero excusas, critica la vagancia y reta a los demás usuarios a tener disciplina física y mental.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
    topic: "entrenamiento fuerza salud ejercicio nutrición deportiva",
    images: [
      "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "TRAILERS_VIP",
    name: "Cine & Trailers",
    bio: "Crítico de cine, estrenos de taquilla y series en PR",
    style: "Cinéfilo crítico y analítico. Compara las situaciones de la vida real o los dramas de los comentarios con películas y guiones de Hollywood.",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80",
    useYoutubeToo: true,
    ytQueries: [
      "trailer oficial español estreno 2026 pelicula",
      "nuevo trailer accion español cine"
    ],
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
    style: "Joven, aguda, moderna y competitiva. Evalúa qué tiene impacto real en redes y qué es puro ruido viejo.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    topic: "creadores digitales redes sociales tendencias virales",
    images: [
      "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "EVANGELISTA_CORDERO",
    name: "Evangelista Cordero",
    bio: "Fe cristiana, valores, sabiduría y reflexión comunitaria en PR",
    style: "Predicador sabio, calmado pero firme. Aporta perspectiva moral y humana cuando los demás se están tirando muy duro.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80",
    topic: "solidaridad ayuda comunitaria fe esperanza Puerto Rico",
    images: [
      "https://images.pexels.com/photos/1420440/pexels-photo-1420440.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "RAUL_MERCADO",
    name: "Raúl Mercado",
    bio: "Economía, mercados, costo de vida y pronóstico del tiempo en PR",
    style: "Analista financiero pragmático y realista. Todo lo mide por costo, retorno de inversión, inflación y realidad económica de Puerto Rico.",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80",
    topic: "economía bolsa valores tasas interés Puerto Rico",
    useWeatherToo: true,
    images: [
      "https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  }
];

function formatThreadContext(comments = []) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return "Nadie ha comentado todavía. Eres el primero en abrir el debate.";
  }
  return comments
    .slice(-6)
    .map(c => `- @${c.handle}: "${c.text}"`)
    .join("\n");
}

async function generateContextualComment(commenter, postAuthorHandle, postCaption, existingComments = [], stanceDirective = "") {
  const threadHistory = formatThreadContext(existingComments);
  const lastComment = existingComments.length > 0 ? existingComments[existingComments.length - 1] : null;
  const targetMention = lastComment && lastComment.handle !== commenter.handle
    ? `Si tiene sentido, menciónale directamente a @${lastComment.handle} para responderle a su punto.`
    : `Dirígete al tema de @${postAuthorHandle}.`;

  const prompt = `Eres ${commenter.name} (@${commenter.handle}) participando en un debate real dentro de la red social puertorriqueña ARGON.
Tu perfil: ${commenter.bio}
Tu forma de hablar y pensar: ${commenter.style}

PUBLICACIÓN ORIGINAL DE @${postAuthorHandle}:
"${postCaption}"

COMENTARIOS PREVIOS EN ESTE HILO:
${threadHistory}

TU MISIÓN EN ESTE COMENTARIO:
- ${stanceDirective || "Reacciona con una postura clara desde tu especialidad."}
- ${targetMention}
- PROHIBIDO repetir frases genéricas o lo mismo que ya dijeron arriba. Responde a un detalle concreto del post o del comentario anterior.
- Escribe máximo 2 oraciones cortas, naturales, en español de Puerto Rico, con 1 emoji. Sin comillas ni prefijos.`;

  return await askGemini(prompt);
}

async function buildDebateThread(authorAgent, captionText) {
  const authorHandle = authorAgent.handle.toUpperCase();
  const commenters = agents
    .filter(a => a.handle !== authorHandle)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  const stances = [
    "Lleva la contraria con sarcasmo o cuestiona el punto principal del post desde tu área.",
    "Responde directamente al comentario anterior, sea para refutarlo o llevar la discusión a otro ángulo práctico.",
    "Tira un comentario picante o una pregunta incómoda que obligue al autor del post a defenderse."
  ];

  let baseTs = Date.now() + 2000;
  const thread = [];

  for (let idx = 0; idx < commenters.length; idx++) {
    const c = commenters[idx];
    const commentText = await generateContextualComment(c, authorHandle, captionText, thread, stances[idx]);
    if (!commentText) continue;

    thread.push({
      handle: c.handle,
      text: commentText,
      createdAt: baseTs + idx * 2000
    });
  }

  // El autor original responde al último comentario que le tiraron
  if (thread.length > 0) {
    const lastComment = thread[thread.length - 1];
    const authorReply = await generateContextualComment(
      authorAgent,
      authorHandle,
      captionText,
      thread,
      `Este es TU propio post. Respóndele directamente a @${lastComment.handle} defendiendo tu postura con orgullo boricua y un toque de vacilón.`
    );

    if (authorReply) {
      thread.push({
        handle: authorHandle,
        text: authorReply,
        createdAt: baseTs + 8000
      });
    }
  }

  return thread;
}

async function craftPostCaption(agent, rawTopicText, youtubeId = "") {
  const prompt = `Eres ${agent.name} (@${agent.handle}) en la red social ARGON de Puerto Rico.
Tu perfil: ${agent.bio}
Tu estilo: ${agent.style}

Noticia o tema real de hoy: "${rawTopicText}"

Redacta una publicación original de 2 a 3 oraciones en español de Puerto Rico que exponga una opinión fuerte o una pregunta polémica sobre ese tema específico para que la gente debata abajo.
- No uses saludos robóticos ni frases clichés repetitivas.
- Usa 1 o 2 emojis.
- No pongas enlaces ni comillas alrededor del texto.`;

  const aiCaption = await askGemini(prompt);
  if (!aiCaption) return null;
  return youtubeId ? `${aiCaption} https://youtu.be/${youtubeId}` : aiCaption;
}

async function buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds) {
  const randomImg = agent.images[Math.floor(Math.random() * agent.images.length)];

  if (agent.isFiebruAgent && Math.random() < 0.65) {
    const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
    const videos = await fetchLiveYoutubeVideo(q);
    const freshVid = videos.find(v => !recentYoutubeIds.has(v.videoId));

    if (freshVid) {
      const caption = await craftPostCaption(agent, `Video recién salido de fiebre de carros en PR: "${freshVid.title}"`, freshVid.videoId);
      if (caption) return { caption, image: "", images: [], youtubeId: freshVid.videoId };
    }
  }

  if (agent.useYoutubeToo && Math.random() < 0.45) {
    const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
    const videos = await fetchLiveYoutubeVideo(q);
    const freshVid = videos.find(v => !recentYoutubeIds.has(v.videoId));
    if (freshVid) {
      const caption = await craftPostCaption(agent, `Video tendencia en YouTube: "${freshVid.title}"`, freshVid.videoId);
      if (caption) return { caption, image: "", images: [], youtubeId: freshVid.videoId };
    }
  }

  if (agent.useWeatherToo && Math.random() < 0.5) {
    const weatherTxt = await fetchLivePRWeather();
    if (weatherTxt && ![...recentCaptions].some(c => c.includes(weatherTxt.slice(0, 35)))) {
      const caption = await craftPostCaption(agent, weatherTxt);
      if (caption) return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  const headlines = await fetchLiveNews(agent.topic);
  for (const headline of headlines) {
    if (![...recentCaptions].some(old => old.includes(headline.slice(0, 30)))) {
      const caption = await craftPostCaption(agent, headline);
      if (caption) return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
    }
  }

  const caption = await craftPostCaption(agent, `Un tema caliente de hoy en Puerto Rico relacionado con: ${agent.bio}`);
  if (!caption) return null;
  return { caption, image: randomImg, images: [randomImg], youtubeId: "" };
}

async function runAgentAutomation() {
  const now = Date.now();
  const botHandles = new Set(agents.map(a => a.handle.toUpperCase()));

  // 1. Mantener perfiles actualizados
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

  // 2. Leer los últimos 30 posts
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

  // 3. Prueba rápida de Gemini antes de generar contenido
  const healthCheck = await askGemini("Responde solo con la palabra: OK");
  if (!healthCheck) {
    console.error(`❌ GEMINI FALLÓ Y NO GENERARÁ FRASES REPETIDAS. Motivo: ${geminiLastError}`);
    process.exit(1);
  }
  console.log("🧠 Gemini 2.5 Flash verificado y respondiendo con memoria contextual.");

  // 4. Publicar 2 posts nuevos con hilo de debate real de 4 turnos
  const shuffledAgents = [...agents].sort(() => 0.5 - Math.random()).slice(0, 2);
  let offset = 0;

  for (const agent of shuffledAgents) {
    const handleKey = agent.handle.toUpperCase();
    const payload = await buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds);
    if (!payload) continue;

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

    console.log(`✓ Nuevo debate IA publicado por @${handleKey} (${initialDebate.length} respuestas cruzadas)`);
  }

  // 5. Prioridad a posts donde escribieron usuarios reales (no bots) o posts recientes
  const publicPosts = existingPosts.filter(
    p => p.visibility !== "private" && (Array.isArray(p.comments) ? p.comments.length : 0) < 16
  );

  const humanPosts = publicPosts.filter(p => {
    const isHumanAuthor = p.handle && !botHandles.has(p.handle.toUpperCase());
    const hasHumanComment = Array.isArray(p.comments) && p.comments.some(c => c.handle && !botHandles.has(c.handle.toUpperCase()));
    return isHumanAuthor || hasHumanComment;
  });

  const botPosts = publicPosts.filter(p => !humanPosts.includes(p)).sort(() => 0.5 - Math.random());
  const targetExisting = [...humanPosts, ...botPosts].slice(0, 4);

  for (const post of targetExisting) {
    const currentComments = Array.isArray(post.comments) ? [...post.comments] : [];
    const lastAuthor = currentComments.length > 0 ? currentComments[currentComments.length - 1].handle : post.handle;
    const availableCommenters = agents.filter(a => a.handle !== lastAuthor);
    if (availableCommenters.length === 0) continue;

    const picks = availableCommenters.sort(() => 0.5 - Math.random()).slice(0, 2);

    for (const commenter of picks) {
      const commentTxt = await generateContextualComment(
        commenter,
        post.handle,
        post.caption || "",
        currentComments,
        "Lee el último comentario de la lista y respóndele directamente para avanzar la conversación."
      );
      if (!commentTxt) continue;

      const newCommentObj = {
        handle: commenter.handle,
        text: commentTxt,
        createdAt: Date.now() + Math.floor(Math.random() * 3000)
      };

      currentComments.push(newCommentObj);

      await updateDoc(doc(db, "posts", post.id), {
        comments: arrayUnion(newCommentObj),
        likes: increment(Math.floor(Math.random() * 8) + 2),
        views: increment(Math.floor(Math.random() * 25) + 8)
      });

      const isBotAuthor = botHandles.has((post.handle || "").toUpperCase());
      if (!isBotAuthor && post.handle) {
        await addDoc(collection(db, "notifications"), {
          to: post.handle,
          from: commenter.handle,
          type: "comment",
          text: `respondió en tu post: "${commentTxt.slice(0, 50)}..."`,
          postId: post.id,
          createdAt: Date.now()
        });
      }
      console.log(`✓ @${commenter.handle} continuó el hilo en el post de @${post.handle}`);
    }
  }

  setTimeout(() => process.exit(0), 1500);
}

runAgentAutomation().catch((err) => {
  console.error(err);
  process.exit(1);
});
