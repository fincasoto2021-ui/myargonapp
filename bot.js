const { initializeApp } = require("firebase/app");
const {
  initializeFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBO2_WIATXnFIZHppz52D5CrbRLnT8_d4U",
  authDomain: "argon-ab4fe.firebaseapp.com",
  projectId: "argon-ab4fe",
  storageBucket: "argon-ab4fe.firebasestorage.app",
  messagingSenderId: "598726555507",
  appId: "1:598726555507:web:f9cf75a06ffa0bd57f3706"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

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

// Busca noticias y eventos reales en Google News RSS
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
    console.error("Error leyendo noticias en vivo:", err.message);
    return [];
  }
}

// Busca videos reales recientes en YouTube para que se reproduzcan directo en el feed de ARGON
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
    console.error("Error buscando YouTube:", err.message);
    return [];
  }
}

// Clima real actual de Puerto Rico (NWS San Juan)
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
    suffix: "¡Nos vemos en la calle y en la pista, mi gente! Dejen saber dónde es el jangueo de carros hoy. 🔥🚗💨",
    images: [
      "https://images.pexels.com/photos/337909/pexels-photo-337909.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LEX_LEGAL",
    name: "Lic. Lex Argon",
    bio: "Derecho corporativo, contratos y subastas PR",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80",
    topic: "subastas OR infraestructura OR leyes construcción Puerto Rico",
    prefix: "⚖️ Actualidad Legal y Contratos:",
    suffix: "Ojo a cómo esto impacta las licitaciones y el cumplimiento en la isla. 📋🏛️",
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
    topic: "agricultura OR cosecha café OR energía solar Puerto Rico",
    prefix: "🌱 Reporte del Campo y Energía:",
    suffix: "Seguimos apostando a la producción local sostenible en la montaña. ☕☀️",
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
    topic: "inteligencia artificial OR procesadores OR lanzamiento tecnología",
    prefix: "💻 Radar Tech del Día:",
    suffix: "La industria tecnológica no frena ni un segundo esta semana. ⚡🖥️",
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
    topic: "gastronomía restaurantes cocina Puerto Rico",
    prefix: "🥑 Sazón y Gastronomía:",
    suffix: "¡Nada supera el sabor fresco hecho en casa con ingredientes de aquí! 🍳🇵🇷",
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
    topic: "entrenamiento fuerza salud ejercicio nutrición deportiva",
    prefix: "💪 Nota Fitness de Hoy:",
    suffix: "Recuerda cumplir con tu entrenamiento de hoy sin excusas. 🔥🏋️‍♂️",
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
    topic: "estrenos cine películas taquilla series",
    prefix: "🎬 Cartelera & Estrenos:",
    suffix: "¿La ven en el cine o esperan que llegue a streaming? 🍿🎥",
    images: [
      "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/109669/pexels-photo-109669.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/7991158/pexels-photo-7991158.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "MOLUSCOTV_PR",
    name: "MoluscoTV PR",
    bio: "Cultura urbana y entrevistas PR",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80",
    topic: "música urbana reggaeton conciertos Coliseo Puerto Rico",
    prefix: "🎤 Lo último en el Género Urbano:",
    suffix: "El movimiento en PR sigue encendiendo las redes hoy. ¿Qué opinan ustedes? 🔥🎧",
    images: [
      "https://images.pexels.com/photos/164938/pexels-photo-164938.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/3784221/pexels-photo-3784221.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    handle: "LA_NUEVA_ERA",
    name: "La Nueva Era",
    bio: "Promoción oficial de los influencers más pegados en ARGON",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    topic: "creadores digitales redes sociales tendencias virales",
    prefix: "👑 Tendencia Digital:",
    suffix: "Activos desde ARGON apoyando el talento nuevo que está subiendo de rango. ✨📱",
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
    topic: "solidaridad ayuda comunitaria fe esperanza Puerto Rico",
    prefix: "🙏 Reflexión y Buenas Noticias:",
    suffix: "Que nunca falte el agradecimiento, la salud y la bendición en cada hogar hoy. 🌄✨",
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
    topic: "economía bolsa valores tasas interés Puerto Rico",
    prefix: "📈 Clima & Mercados Hoy:",
    suffix: "Manténganse informados antes de tomar decisiones financieras hoy. 🌤️💼",
    useWeatherToo: true,
    images: [
      "https://images.pexels.com/photos/210607/pexels-photo-210607.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/534216/pexels-photo-534216.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  }
];

async function buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds) {
  const randomImg = agent.images[Math.floor(Math.random() * agent.images.length)];

  // Lógica especial de Eric Tostón: alterna videos reales de YouTube (RX-7, Samurai, Corolla 1.8) y eventos de calle
  if (agent.isFiebruAgent) {
    if (Math.random() < 0.65) {
      const q = agent.ytQueries[Math.floor(Math.random() * agent.ytQueries.length)];
      const videos = await fetchLiveYoutubeVideo(q);
      const freshVid = videos.find(v => !recentYoutubeIds.has(v.videoId));

      if (freshVid) {
        return {
          caption: `🔥 ¡Miren esta joya que me acabo de encontrar en YouTube! "${freshVid.title}" 🏁 Si suena rotativo RX-7, Corolla 1.8 o hay ruta de Suzuki Samurai, aquí lo subimos al momento. ¡Denle Play ahí mismo! 🚗💨 https://youtu.be/${freshVid.videoId}`,
          image: "",
          images: [],
          youtubeId: freshVid.videoId
        };
      }
    }

    const carEvents = await fetchLiveNews(agent.topic);
    for (const ev of carEvents) {
      if (![...recentCaptions].some(old => old.includes(ev.slice(0, 35)))) {
        return {
          caption: `🏁 Radar de Eventos y Fiebre en PR: "${ev}". ¿Quiénes bajan hoy con los Mazda RX-7, los Corolla 1800 y el corillo de los Suzuki Samurai? ¡Reporten asistencia abajo! 🔥🔧`,
          image: randomImg,
          images: [randomImg],
          youtubeId: ""
        };
      }
    }

    const fiebreTopics = [
      "Debate serio de marquesina hoy: ¿El sonido de un Mazda RX-7 rotativo bien seteado en la luz o un Toyota Corolla 1800 gritao en la pista? Los leo abajo, fiebrús. 🔥🏁",
      "Pa' meterse por el fango y subir la montaña sin miedo no hay quien le quite el trono al Suzuki Samurai 4x4 bien montao. ¿Quién tiene el suyo activo pa' ruta este wikén? 🚙⛰️",
      "Aviso a la fiebre de la calle: si tienen flyer de Car Meet, ruta de Samurai o evento en pista esta semana en las redes, tírenmelo al DM pa' anunciarlo oficial aquí en ARGON. 📢🏎️💨"
    ];
    const pick = fiebreTopics.find(t => !recentCaptions.has(t)) || fiebreTopics[0];
    return {
      caption: pick,
      image: randomImg,
      images: [randomImg],
      youtubeId: ""
    };
  }

  // Lógica de Raúl Mercado (Clima real NWS + Finanzas)
  if (agent.useWeatherToo && Math.random() < 0.5) {
    const weatherTxt = await fetchLivePRWeather();
    if (weatherTxt && ![...recentCaptions].some(c => c.includes(weatherTxt.slice(0, 40)))) {
      return {
        caption: `🌤️ ${weatherTxt} ¡Precaución en las carreteras de la montaña si caen aguaceros de tarde! 📈`,
        image: randomImg,
        images: [randomImg],
        youtubeId: ""
      };
    }
  }

  // Noticias en vivo del día para el resto de los agentes
  const headlines = await fetchLiveNews(agent.topic);
  for (const headline of headlines) {
    if (![...recentCaptions].some(old => old.includes(headline.slice(0, 35)))) {
      return {
        caption: `${agent.prefix} "${headline}". ${agent.suffix}`,
        image: randomImg,
        images: [randomImg],
        youtubeId: ""
      };
    }
  }

  const fechaHoy = new Date().toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Puerto_Rico"
  });
  return {
    caption: `${agent.prefix} Monitoreando de cerca el panorama de hoy ${fechaHoy}. ${agent.suffix}`,
    image: randomImg,
    images: [randomImg],
    youtubeId: ""
  };
}

async function runAgentAutomation() {
  const now = Date.now();

  // 1. Mantener los 11 perfiles activos en la colección 'users'
  for (const agent of agents) {
    const handleKey = agent.handle.toUpperCase();
    await setDoc(doc(db, "users", handleKey), {
      userName: agent.name,
      userHandle: handleKey,
      bio: agent.bio,
      avatar: agent.avatar,
      ageVerified: true,
      invitedBy: "BELTO43",
      subs: 1350,
      balance: 10000,
      updatedAt: now
    }, { merge: true });
  }

  // 2. Revisar últimos 35 posts para no repetir noticias ni videos de YouTube
  const recentCaptions = new Set();
  const recentYoutubeIds = new Set();
  try {
    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(35)));
    snap.forEach(d => {
      const data = d.data();
      if (data?.caption) recentCaptions.add(data.caption);
      if (data?.youtubeId) recentYoutubeIds.add(data.youtubeId);
    });
  } catch (e) {}

  // 3. Seleccionar 2 agentes por corrida (dándole prioridad frecuente a Eric Tostón)
  const others = agents.filter(a => a.handle !== "ERIC_TOSTON").sort(() => 0.5 - Math.random());
  const selected = Math.random() < 0.5
    ? [agents[0], others[0]]
    : [others[0], others[1]];

  let offset = 0;
  for (const agent of selected) {
    const handleKey = agent.handle.toUpperCase();
    const payload = await buildDynamicPostPayload(agent, recentCaptions, recentYoutubeIds);
    recentCaptions.add(payload.caption);
    if (payload.youtubeId) recentYoutubeIds.add(payload.youtubeId);

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
      likes: Math.floor(Math.random() * 55) + 18,
      views: Math.floor(Math.random() * 240) + 50,
      comments: [],
      createdAt: Date.now() + (offset++ * 1000)
    });

    console.log(`✓ Publicado por @${handleKey}: ${payload.caption}`);
  }

  setTimeout(() => process.exit(0), 1500);
}

runAgentAutomation().catch((err) => {
  console.error(err);
  process.exit(1);
});
