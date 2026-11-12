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

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function getLatestYouTube(channelId) {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 5);
    if (!entries.length) return null;
    const pick = entries[Math.floor(Math.random() * entries.length)][1];
    const id = pick.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = pick.match(/<title>(.*?)<\/title>/)?.[1];
    if (!id || !title) return null;
    return {
      title: decode(title),
      image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      link: `https://www.youtube.com/watch?v=${id}`
    };
  } catch { return null; }
}

const channels = [
  { handle: "marcos_hoops", initials: "MH", avatar: "https://randomuser.me/api/portraits/men/32.jpg", yt: "UCWJ2lWNubArHWmf3FIHbfcQ", tag: "🏀 NBA EN VIVO:" },
  { handle: "historias_tierra", initials: "HT", avatar: "https://randomuser.me/api/portraits/men/52.jpg", yt: "UCpyYUq9kcBMLPlfE8EzguvA", tag: "🌍 PLANETA TIERRA:" },
  { handle: "flow_urbano_pr", initials: "FU", avatar: "https://randomuser.me/api/portraits/men/46.jpg", yt: "UCBfg3Yc_8iIJ0e0MeMKg2Bw", tag: "🔥 GÉNERO URBANO:" },
  { handle: "diego_finanzas", initials: "DF", avatar: "https://randomuser.me/api/portraits/men/85.jpg", yt: "UCrp_UI8XtuYfpiqluWLD7Lw", tag: "📈 ECONOMÍA HOY:" },
  { handle: "tech_boricua", initials: "TB", avatar: "https://randomuser.me/api/portraits/men/22.jpg", yt: "UCG7J20LhUeLl6y_Emi7OJrA", tag: "⚡ TECH & FUTURO:" },
  { handle: "cine_trailer", initials: "CT", avatar: "https://randomuser.me/api/portraits/women/12.jpg", yt: "UCi8e0iOVk1fEOogdfu4YgfA", tag: "🎬 ESTRENO DE CINE:" },
  {
    handle: "valeria_glam", initials: "VG",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&crop=faces",
    posts: [
      { caption: "Día de fotos en la playita de Puerto Rico 🌴☀️ ¿Qué les parece este look? ✨💋", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop" },
      { caption: "Lista para salir esta noche... vibras altas siempre ✨🥂", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop" }
    ]
  },
  {
    handle: "chinchorreo_pr", initials: "CP",
    avatar: "https://randomuser.me/api/portraits/women/65.jpg",
    posts: [
      { caption: "Nada le gana a un buen chinchorreo por la isla con vista al mar 🇵🇷🍤 ¿Cuál es su spot favorito?", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop" },
      { caption: "Atardeceres en el oeste de Puerto Rico que no tienen comparación 🌅🌴", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop" }
    ]
  },
  {
    handle: "fuerza_fit", initials: "FF",
    avatar: "https://randomuser.me/api/portraits/men/64.jpg",
    posts: [
      { caption: "Sin excusas hoy. La disciplina de todos los días es la que trae resultados 💪🔥", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop" }
    ]
  }
];

async function run() {
  for (const ch of channels) {
    let caption = "";
    let image = "";
    if (ch.yt) {
      const vid = await getLatestYouTube(ch.yt);
      if (!vid) continue;
      caption = `${ch.tag} ${vid.title}\n\n▶️ Míralo aquí: ${vid.link}`;
      image = vid.image;
    } else {
      const p = ch.posts[Math.floor(Math.random() * ch.posts.length)];
      caption = p.caption;
      image = p.image;
    }
    await addDoc(collection(db, "posts"), {
      avatar: ch.avatar,
      caption,
      createdAt: Date.now(),
      handle: ch.handle,
      image,
      initials: ch.initials,
      likes: Math.floor(Math.random() * 15) + 4,
      shares: Math.floor(Math.random() * 5)
    });
    console.log(`Publicado: @${ch.handle}`);
  }
}

run();
