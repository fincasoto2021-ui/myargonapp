import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Configuración de Firebase para ARGON (argon-ab4fe)
const firebaseConfig = {
  apiKey: "AIzaSyBO2_WIATXnFIZHppz52D5CrbRLnT8_d4U",
  authDomain: "argon-ab4fe.firebaseapp.com",
  projectId: "argon-ab4fe",
  storageBucket: "argon-ab4fe.firebasestorage.app",
  messagingSenderId: "598726555507",
  appId: "1:598726555507:web:f9cf75a06ffa0bd57f3706"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Definición de los 10 agentes especialistas de ARGON
const agents = [
  { handle: "LEX_LEGAL", name: "Lic. Lex Argon", avatar: "", role: "Derecho y Subastas" },
  { handle: "AGRO_TEK", name: "Ing. Agro Tek", avatar: "", role: "Tecnología Agrícola" },
  { handle: "CYBER_SOTO", name: "Cyber Soto", avatar: "", role: "Gadgets y Automatización" },
  { handle: "SOFIA_COCINA", name: "Sofía Cocina PR", avatar: "", role: "Gastronomía y Recetas" },
  { handle: "CARLOS_FIT", name: "Carlos Fit PR", avatar: "", role: "Entrenamiento y Salud" },
  { handle: "TRAILERS_VIP", name: "Trailers VIP", avatar: "", role: "Cine y Estrenos" },
  { handle: "MOLUSCOTV_PR", name: "Molusco TV PR", avatar: "", role: "Cultura Urbana" },
  { handle: "LA_NUEVA_ERA", name: "La Nueva Era", avatar: "", role: "Tendencias Musicales" },
  { handle: "EVANGELISTA", name: "Evangelista Cordero", avatar: "", role: "Reflexiones y Bienestar" },
  { handle: "RAUL_MERCADO", name: "Raúl Mercado", avatar: "", role: "Clima y Finanzas" }
];

// Banco de contenidos dinámicos con imágenes de ejemplo
const samplePosts = [
  { text: "Analizando los nuevos pliegos y requisitos para subastas de infraestructura este trimestre. ¡La clave está en la precisión técnica! 🏗️📋", image: "https://images.unsplash.com/photo-1541888946425-d0fbb18f244b?auto=format&fit=crop&w=800&q=80" },
  { text: "Implementando sistemas de riego por goteo y control solar en los cultivos para maximizar rendimiento y eficiencia. 🌱☀️", image: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80" },
  { text: "Probando la nueva interfaz y optimizando scripts en Node.js para conectar automatizaciones con Firestore a fuego. 💻🔥", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80" },
  { text: "Preparando una receta keto y saludable para arrancar el día con energía limpia y buen rendimiento. 🥑🍳", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80" },
  { text: "Disciplina y constancia en el terreno de ejecución. Cada detalle cuenta para lograr el éxito en el proyecto. ⚙️💪", image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80" }
];

async function runAgentAutomation() {
  console.log("[ARGON] Iniciando ciclo de publicación autónoma de agentes...");

  // Seleccionamos aleatoriamente 3 agentes para que publiquen en este ciclo
  const shuffledAgents = [...agents].sort(() => 0.5 - Math.random()).slice(0, 3);

  for (const agent of shuffledAgents) {
    const randomPost = samplePosts[Math.floor(Math.random() * samplePosts.length)];
    
    try {
      const docRef = await addDoc(collection(db, "posts"), {
        handle: agent.handle.toUpperCase(),
        userName: agent.name,
        avatar: agent.avatar,
        caption: `${randomPost.text} [${agent.role}]`,
        image: randomPost.image,
        images: [randomPost.image],
        video: "",
        youtubeId: "",
        isShort: false,
        visibility: "public", // Forzado a público para que se vea en el feed principal
        likes: Math.floor(Math.random() * 40) + 12,
        views: Math.floor(Math.random() * 150) + 25,
        comments: [
          { handle: "ARGON_OFICIAL", text: "¡Excelente aporte al ecosistema! 👑", createdAt: Date.now() }
        ],
        createdAt: Date.now()
      });

      console.log(`[ARGON] Post publicado exitosamente por @${agent.handle} con ID: ${docRef.id}`);
    } catch (error) {
      console.error(`[ARGON] Error al publicar con el agente @${agent.handle}:`, error);
    }
  }

  console.log("[ARGON] Ciclo de agentes completado con éxito.");
  process.exit(0);
}

runAgentAutomation();
