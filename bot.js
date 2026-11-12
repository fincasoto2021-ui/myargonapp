const { initializeApp } = require("firebase/app");
const {
  initializeFirestore,
  collection,
  addDoc,
  doc,
  setDoc
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

// Forzar HTTP Long Polling para que GitHub Actions nunca corte la escritura en Firestore
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// Los 10 agentes alineados con tu Directorio Oficial de ARGON
const agents = [
  {
    handle: "LEX_LEGAL",
    name: "Lic. Lex Argon",
    bio: "Derecho corporativo, contratos y subastas PR",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Analizando los nuevos pliegos y requisitos para subastas de infraestructura este trimestre. La clave para ganar está en auditar cada especificación técnica antes de someter. ⚖️📋",
        image: "https://images.unsplash.com/photo-1541888946425-d0fbb18f244b?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "AGRO_TEK",
    name: "Ing. Agro Tek",
    bio: "Agricultura tropical, café y sistemas solares",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Optimizando sistemas de riego por bombeo solar y siembra en contorno en la montaña para proteger el terreno y maximizar la cosecha de café. 🌱☀️",
        image: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "CYBER_SOTO",
    name: "Cyber Studio Tech",
    bio: "Tecnología, gadgets y setups",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Probando la nueva arquitectura automatizada conectada en tiempo real a la nube. Velocidad y rendimiento al máximo nivel en ARGON. 💻⚡",
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "SOFIA_COCINA_PR",
    name: "Sofia Cocina PR",
    bio: "Recetas y sazón del caribe",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Preparando un almuerzo keto bien criollo: proteína limpia, aguacate fresco del patio y cero azúcares añadidos para mantener la energía arriba todo el día. 🥑🍳",
        image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "CARLOS_FIT_PR",
    name: "Carlos Fit PR",
    bio: "Entrenamiento, rutina y disciplina",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "La disciplina no se negocia. Cumpliendo con la rutina pesada desde temprano para mantener mente y cuerpo al 100%. 💪🔥",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "TRAILERS_VIP",
    name: "Cine & Trailers",
    bio: "Estrenos y trailers oficiales",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Los estrenos de acción y suspenso de esta temporada vienen con una producción brutal. ¿Cuál película están esperando ver este fin de semana? 🎬🍿",
        image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "MOLUSCOTV_PR",
    name: "MoluscoTV PR",
    bio: "Cultura urbana y entrevistas PR",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "El movimiento urbano sigue rompiendo récords globales desde la isla. Los nuevos productores independientes están cambiando las reglas del juego. 🎤🎧",
        image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "LA_NUEVA_ERA",
    name: "La Nueva Era",
    bio: "Promoción oficial de los influencers más pegados en ARGON",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Destacando a los creadores más duros de la comunidad en ARGON. Sube tu contenido y pon a brillar tu perfil en el ranking. 👑✨",
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "EVANGELISTA_CORDERO",
    name: "Evangelista Cordero",
    bio: "Palabra de Dios, fe cristiana, predicación y esperanza",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Cuando pones tus proyectos y tu familia en manos de Dios con trabajo honesto, ninguna puerta permanece cerrada. ¡Bendecido día para todos! 🙏✨",
        image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80"
      }
    ]
  },
  {
    handle: "RAUL_MERCADO",
    name: "Raúl Mercado",
    bio: " Clima, mercados y finanzas",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80",
    posts: [
      {
        caption: "Reporte del día: Cielos despejados en la mañana con aguaceros típicos de tarde en la cordillera central, y mercados cerrando en positivo. 📈🌤️",
        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80"
      }
    ]
  }
];

async function runAgentAutomation() {
  console.log("[ARGON] 1/2 Registrando y asegurando los 10 perfiles en Firestore...");
  const now = Date.now();

  // PASO 1: Asegurar que LOS 10 AGENTES existan siempre en la colección 'users'
  for (const agent of agents) {
    const handleKey = agent.handle.toUpperCase();
    await setDoc(doc(db, "users", handleKey), {
      userName: agent.name,
      userHandle: handleKey,
      bio: agent.bio,
      avatar: agent.avatar,
      ageVerified: true,
      invitedBy: "BELTO43",
      subs: 1250,
      balance: 10000,
      updatedAt: now
    }, { merge: true });
    console.log(`✓ Perfil activo en directorio: @${handleKey}`);
  }

  // PASO 2: Seleccionar 4 agentes al azar en esta corrida para publicar en el Feed
  const selected = [...agents].sort(() => 0.5 - Math.random()).slice(0, 4);
  console.log(`[ARGON] 2/2 Publicando ${selected.length} posts nuevos en el Feed...`);

  let offset = 0;
  for (const agent of selected) {
    const handleKey = agent.handle.toUpperCase();
    const postItem = agent.posts[Math.floor(Math.random() * agent.posts.length)];
    const postTime = Date.now() + (offset++ * 1000);

    const docRef = await addDoc(collection(db, "posts"), {
      handle: handleKey,
      userName: agent.name,
      avatar: agent.avatar,
      caption: postItem.caption,
      image: postItem.image,
      images: [postItem.image],
      video: "",
      youtubeId: "",
      isShort: false,
      visibility: "public",
      likes: Math.floor(Math.random() * 45) + 15,
      views: Math.floor(Math.random() * 180) + 40,
      comments: [],
      createdAt: postTime
    });

    console.log(`✓ Post público creado por @${handleKey} -> ID: ${docRef.id}`);
  }

  console.log("[ARGON] ¡Sincronización completada al 100%!");
  setTimeout(() => process.exit(0), 1500);
}

runAgentAutomation().catch((err) => {
  console.error("[ARGON ERROR FATAL]:", err);
  process.exit(1);
});
