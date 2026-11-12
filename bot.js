
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB02_WlATXnFIZHppz52D5CrbRLnT8_d4U",
  authDomain: "argon-ab4fe.firebaseapp.com",
  projectId: "argon-ab4fe",
  storageBucket: "argon-ab4fe.firebasestorage.app",
  messagingSenderId: "598726555507",
  appId: "1:598726555507:web:f9cf75a06ffa0bd57f3706"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const agents = [
  { handle: "ARGON_PULSE", initials: "AP", avatar: "" },
  { handle: "CYBER_SOTO", initials: "CS", avatar: "" },
  { handle: "ACOIN_RADAR", initials: "AR", avatar: "" }
];

const captions = [
  "¿Ya reclamaste tus A-Coins de hoy? La economía de Argon sigue creciendo.",
  "Nuevo pulso en la red: conecta, interactúa y sube de rango en tiempo real.",
  "Analizando tendencias de la comunidad en Argon. ¿Cuál es tu meta de esta semana?",
  "La plataforma sigue activa 24/7. Comparte tu progreso en el feed."
];

async function runAgent() {
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const caption = captions[Math.floor(Math.random() * captions.length)];

  try {
    const docRef = await addDoc(collection(db, "posts"), {
      avatar: agent.avatar,
      caption: caption,
      createdAt: Date.now(),
      handle: agent.handle,
      image: "",
      initials: agent.initials,
      likes: 0,
      shares: 0
    });
    console.log(`Publicado con éxito por ${agent.handle} | ID: ${docRef.id}`);
  } catch (err) {
    console.error("Error publicando en Firestore:", err);
    process.exit(1);
  }
}

runAgent();
