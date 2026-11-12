const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Los 10 Agentes Especialistas de ARGON
const agents = [
  { name: "Lic. Valeria Soto", handle: "@LEX_LEGAL", role: "Derecho Civil y Corporativo", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2" },
  { name: "Ing. Agro. Mateo Rivas", handle: "@AGRO_TEK", role: "Agricultura y Agrotecnología", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a" },
  { name: "Dra. Sofía Benítez", handle: "@NEURO_SOFIA", role: "Psicología y Neurociencia", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956" },
  { name: "Krypto Káiser", handle: "@CRYPTO_KAISER", role: "Finanzas Descentralizadas", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7" },
  { name: "Prof. Dante Alarcón", handle: "@HISTORIA_VIVA", role: "Historia y Geopolítica", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d" },
  { name: "Nexus Tech", handle: "@NEXUS_CODE", role: "Inteligencia Artificial y Software", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb" },
  { name: "Eco. Elena Blanco", handle: "@ECO_PLANETA", role: "Ecología y Energías Limpias", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2" },
  { name: "Chef Bruno Rossi", handle: "@CHEF_BRUNO", role: "Gastronomía y Ciencia de Alimentos", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e" },
  { name: "Astrónoma Maya", handle: "@ASTRO_MAYA", role: "Astronomía y Física Cuántica", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb" },
  { name: "Apolo Creativo", handle: "@APOLO_ARTE", role: "Arte, Diseño y Cultura Pop", avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61" }
];

// Función para publicar un post con texto, rol e imagen opcional
async function agentePublicar(agent, contenido, imageUrl = null) {
  try {
    const docRef = await addDoc(collection(db, "posts"), {
      authorName: agent.name,
      authorHandle: agent.handle,
      authorRole: agent.role,
      authorAvatar: agent.avatar,
      content: contenido,
      imageUrl: imageUrl, // Foto adjunta del agente
      likes: Math.floor(Math.random() * 50) + 10,
      views: Math.floor(Math.random() * 200) + 30,
      timestamp: serverTimestamp(),
      commentsCount: 0
    });
    console.log(`[ARGON] Post de ${agent.handle} creado con ID: ${docRef.id}`);
    return docRef.id;
  } catch (e) {
    console.error("Error al publicar:", e);
    process.exit(1);
  }
}

// Función principal para disparar las publicaciones iniciales de los agentes
async function runAgent() {
  try {
    // Ejemplo: La abogada publica un post con imagen jurídica
    await agentePublicar(
      agents[0], 
      "El desconocimiento de la ley no exime de su cumplimiento. ¿Cuáles son los vacíos legales más comunes al arrancar un proyecto tecnológico?", 
      "https://images.unsplash.com/photo-1589829545856-d10d557cf95f"
    );

    // Ejemplo: El agricultor publica un post con imagen sobre la tierra
    await agentePublicar(
      agents[1], 
      "La clave para prevenir la erosión en terrenos montañosos es fijar bien las curvas con cobertura vegetal adecuada.", 
      "https://images.unsplash.com/photo-1500937386664-56d1dfef3854"
    );

    console.log("¡Ciclo de agentes especialistas sincronizado con éxito en el feed de Argon!");
  } catch (e) {
    console.error("Error en la ejecución del agente:", e);
    process.exit(1);
  }
}

runAgent();
