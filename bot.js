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

const personas = [
  {
    handle: "marcos_hoops", initials: "MH",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    captions: [
      "¡Qué clase de juego anoche en la NBA! Esos tiros en el último cuarto definieron el partido 🔥🏀",
      "La intensidad defensiva en la liga está a otro nivel esta temporada 🏆",
      "Noche de básquetbol y chequeando la comunidad en Argon. ¡Quién se activa a debatir! 🏀⚡"
    ],
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop"
  },
  {
    handle: "diego_finanzas", initials: "DF",
    avatar: "https://randomuser.me/api/portraits/men/85.jpg",
    captions: [
      "Analizando los mercados para el cierre de trimestre. Diversifiquen con cabeza 📈📊",
      "El valor de las A-Coins y la gamificación es el futuro de la monetización 🚀💡",
      "Tip financiero: invierte en tu propio negocio y aprende a mover capital 💼💵"
    ],
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop"
  },
  {
    handle: "valeria_glam", initials: "VG",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&crop=faces",
    captions: [
      "Día de fotos en la playita de Puerto Rico 🌴☀️ ¿Qué les parece este look? ✨💋",
      "Lista para salir esta noche... vibras altas siempre ✨🥂",
      "Empezando el día con la mejor vibra y entrenando duro 💅🔥"
    ],
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop"
  },
  {
    handle: "javi_urbano", initials: "JU",
    avatar: "https://randomuser.me/api/portraits/men/46.jpg",
    captions: [
      "En el estudio cuadrando los ritmos de lo que viene... El género urbano dominando desde PR 🎧🔥🇵🇷",
      "Mucho respeto a los que están metiendo mano independiente sin deberle nada a nadie 🎤🎵",
      "Viernes de estrenos y barras pesadas. ¿Cuál es el tema que tienen en repeat? 🔊🔥"
    ],
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop"
  }
];

async function publish() {
  const p = personas[Math.floor(Math.random() * personas.length)];
  const caption = p.captions[Math.floor(Math.random() * p.captions.length)];
  const useImage = Math.random() > 0.3; // Alterna posts con y sin foto

  try {
    const docRef = await addDoc(collection(db, "posts"), {
      avatar: p.avatar,
      caption: caption,
      createdAt: Date.now(),
      handle: p.handle,
      image: useImage ? p.image : "",
      initials: p.initials,
      likes: Math.floor(Math.random() * 8) + 3,
      shares: Math.floor(Math.random() * 3)
    });
    console.log(`Publicado por @${p.handle} | ID: ${docRef.id}`);
  } catch (err) {
    console.error("Error Firestore:", err);
    process.exit(1);
  }
}

publish();
