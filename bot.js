const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  addDoc, updateDoc, query, orderBy, limit, increment, arrayUnion
} = require('firebase/firestore');

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

const HOROSCOPOS = [
  '♈ ARIES: Hoy se abren puertas en tus proyectos. Confía en tu instinto y da el primer paso sin miedo ✨',
  '♉ TAURO: Energía firme para tus finanzas. Buen momento para organizar metas y cuidar tu paz mental 🌿',
  '♊ GÉMINIS: Una conversación inesperada te traerá una gran idea. Escucha con atención hoy 💬',
  '♋ CÁNCER: Tiempo de conectar con tu familia y recargar energías. Protege tu espacio emocional 🌙',
  '♌ LEO: Tu carisma está al máximo. Aprovecha para liderar y mostrar tu talento sin reservas ☀️',
  '♍ VIRGO: Ordena tus prioridades y verás resultados rápidos. Un detalle pequeño hará la diferencia 📝',
  '♎ LIBRA: Busca el equilibrio antes de tomar una decisión importante. La armonía llega a tu favor ⚖️',
  '♏ ESCORPIO: Intuición muy despierta hoy. Descubre lo que estaba oculto y avanza con seguridad 🔥',
  '♐ SAGITARIO: Ganas de aventura y nuevos retos. Una noticia positiva viene en camino 🌍',
  '♑ CAPRICORNIO: Tu disciplina empieza a dar frutos visibles. Sigue constante en tu camino 🏔️',
  '♒ ACUARIO: Día ideal para innovar y compartir ideas distintas. Rodéate de gente creativa ⚡',
  '♓ PISCIS: Sensibilidad e inspiración al 100%. Confía en tus corazonadas y fluye con calma 🌊'
];

const VERSICULOS = [
  '📖 "Todo lo puedo en Cristo que me fortalece." — Filipenses 4:13. ¡Que la paz y la fuerza de Dios guíen tu día! 🙏',
  '📖 "El Señor es mi pastor, nada me faltará." — Salmos 23:1. Camina con fe aunque no veas todo el camino todavía ✝️',
  '📖 "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia." — Proverbios 3:5. Dios tiene el control 🙏',
  '📖 "Esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo." — Josué 1:9 ✝️',
  '📖 "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien." — Romanos 8:28. ¡Sigue creyendo! 🙌',
  '📖 "Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz." — Jeremías 29:11 🙏',
  '📖 "Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas." — Jeremías 33:3. ¡Nunca dejes de orar! ✝️'
];

const CHANNELS = [
  { handle: 'CYBER_SOTO', name: 'The Studio Tech', ytId: 'UCG7J20LhUeLl6y_Emi7OJrA', bio: 'Tecnología, gadgets y setups.', avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=CYBER_SOTO', subs: 1240, tone: 'tech' },
  { handle: 'MARCOS_HOOPS', name: 'NBA Highlights', ytId: 'UCWJ2lWNubArHWmf3FIHbfcQ', bio: 'Baloncesto y jugadas de la NBA.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=MARCOS_HOOPS', subs: 2150, tone: 'deportes' },
  { handle: 'DIEGO_FINANZAS', name: 'CNBC Mercados', ytId: 'UCrp_UI8XtuYfpiqluWLD7Lw', bio: 'Mercados, acciones y economía.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=DIEGO_FINANZAS', subs: 1890, tone: 'finanzas' },
  { handle: 'NATGEO_ESP', name: 'NatGeo Mundo', ytId: 'UCpyYUq9kcBMLPlfE8EzguvA', bio: 'Ciencia, naturaleza y exploración.', avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=NATGEO_ESP', subs: 3420, tone: 'ciencia' },
  { handle: 'MOLUSCOTV_PR', name: 'MoluscoTV PR', ytId: 'UCBfg3Yc_8iIJ0e0MeMKg2Bw', bio: 'Cultura urbana y entrevistas PR.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=MOLUSCOTV_PR', subs: 4100, tone: 'pr' },
  { handle: 'TRAILERS_VIP', name: 'Cine & Trailers', ytId: 'UCi8e0iOVk1fEOogdfu4YgfA', bio: 'Estrenos y trailers oficiales.', avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=TRAILERS_VIP', subs: 2780, tone: 'cine' },
  { handle: 'VALERIA_GLAM', name: 'Valeria Glam PR', wikiQuery: 'fashion street style portrait', bio: 'Moda, estilo y lifestyle desde PR.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=VALERIA_GLAM', subs: 1650, tone: 'moda', captions: ['Nuevo look de hoy desde la isla ✨', 'Vibras de fin de semana en PR 🌴', 'Detalles que hacen la diferencia 💫', 'Estilo urbano y fresco para hoy 🔥'] },
  { handle: 'CARLOS_FIT_PR', name: 'Carlos Fit PR', wikiQuery: 'gym workout fitness training', extraYtId: 'UCIjiWiNemxUg0YAQA-7C8rQ', bio: 'Entrenamiento, rutina y disciplina.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=CARLOS_FIT_PR', subs: 1420, tone: 'fitness', captions: ['No se falla hoy 💪🔥', 'Rutina completada. Constancia diaria.', 'Energía al 100% en el gym ⚡', 'Un día más sumando progreso 🏋️'] },
  { handle: 'SOFIA_COCINA_PR', name: 'Sofía Cocina PR', wikiQuery: 'gourmet food dish plate', extraYtId: 'UCVf-uzV0XR-3DLtRs1sg6Og', bio: 'Recetas y platos deliciosos.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=SOFIA_COCINA_PR', subs: 1980, tone: 'cocina', captions: ['Receta fresca recién salida 🔥🍽️', 'El sabor de hoy está a otro nivel 😋', '¿Quién se apunta a probar esto?', 'Cocina casera con toque gourmet ✨'] },
  { handle: 'RAUL_MERCADO', name: 'Raúl Mercado', wikiQuery: 'zodiac stars galaxy astrology', extraYtId: 'UCCPhW2xxkH4PSLacqKcp95Q', bio: 'Horóscopo diario, signos y energía astral.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=RAUL_MERCADO', subs: 2300, tone: 'horoscopo', captions: HOROSCOPOS },
  { handle: 'EVANGELISTA_CORDERO', name: 'Evangelista Cordero', wikiQuery: 'open bible church sunlight', extraYtId: 'UCnE7BNsN2A5GPEAuDBPQvqg', bio: 'Palabra de Dios, fe cristiana protestante y esperanza.', avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=EVANGELISTA_CORDERO', subs: 2640, tone: 'fe', captions: VERSICULOS },
  { handle: 'LA_NUEVA_ERA', name: 'La Nueva Era', wikiQuery: 'concert stage spotlight crowd', extraYtId: 'UCXAO-BsguYdT77p4Y9497dw', bio: 'Promoción oficial de los influencers más pegados en ARGON.', avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=LA_NUEVA_ERA', subs: 3150, tone: 'promo', isPromoChannel: true }
];

const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.handle, c]));

async function ensureChannelProfile(ch) {
  const ref = doc(db, 'users', ch.handle);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      userHandle: ch.handle, userName: ch.name, avatar: ch.avatar,
      bio: ch.bio, isAiAgent: true, subs: ch.subs, balance: 5000, updatedAt: Date.now()
    });
  } else {
    await setDoc(ref, {
      userHandle: ch.handle, userName: ch.name, avatar: ch.avatar,
      bio: ch.bio, isAiAgent: true, updatedAt: Date.now()
    }, { merge: true });
  }
}

async function fetchYoutubeItems(ytId) {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytId}`);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.map(e => {
      const id = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
      const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      return id ? { id, title: title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() } : null;
    }).filter(Boolean);
  } catch { return []; }
}

async function fetchUniqueWikiImage(searchTerm, usedImages) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTerm)}&gsrnamespace=6&gsrlimit=25&prop=imageinfo&iiprop=url|mime&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ArgonAppBot/1.0' } });
    if (!res.ok) return '';
    const data = await res.json();
    const pages = Object.values((data.query && data.query.pages) || {});
    const urls = pages
      .map(p => p.imageinfo && p.imageinfo[0])
      .filter(info => info && /^image\/(jpeg|png|webp)$/i.test(info.mime) && info.url && !usedImages.has(info.url))
      .map(info => info.url);
    if (urls.length === 0) return '';
    return urls[Math.floor(Math.random() * urls.length)];
  } catch { return ''; }
}

async function buildTopInfluencersCaption() {
  try {
    const uSnap = await getDocs(collection(db, 'users'));
    const top = uSnap.docs
      .map(d => d.data())
      .filter(u => u.userHandle && u.userHandle !== 'LA_NUEVA_ERA')
      .sort((a, b) => (Number(b.subs) || 0) - (Number(a.subs) || 0))
      .slice(0, 3);
    if (top.length > 0) {
      const listTxt = top.map((u, i) => `${i + 1}. @${u.userHandle} (${(Number(u.subs) || 0).toLocaleString()} subs)`).join(' • ');
      return `🚀 LA NUEVA ERA • LOS MÁS PEGADOS EN ARGON HOY 🔥\nDestacando el talento duro de la plataforma: ${listTxt}. ¡Entra a sus muros y suscríbete! 🌟`;
    }
  } catch {}
  return '🚀 LA NUEVA ERA • Impulsando a los creadores e influencers que están rompiendo en ARGON hoy 🔥🌟';
}

async function buildSmartReply(ch, commentText, commenterHandle) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Eres ${ch.name} (@${ch.handle}), creador en ARGON (${ch.bio}). Responde en español en 1 o 2 frases cortas, natural y amigable al comentario de @${commenterHandle}: "${commentText}"` }] }]
        })
      });
      if (r.ok) {
        const j = await r.json();
        const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt) return txt;
      }
    } catch {}
  }
  const lower = commentText.toLowerCase();
  if (lower.includes('?')) return `¡Buena pregunta @${commenterHandle}! Pronto subo más detalles sobre eso por aquí 🙌`;
  if (/brutal|duro|fuego|top|excelente|nice|bueno|amen|amén/.test(lower)) return `¡Gracias @${commenterHandle}! Me alegra que te haya gustado 🔥`;
  const replies = {
    tech: `¡Gracias por pasarte @${commenterHandle}! ¿Qué opinas de este setup? 💻`,
    deportes: `¡Así mismo @${commenterHandle}! La temporada está encendida 🏀`,
    finanzas: `Totalmente @${commenterHandle}, hay que seguir de cerca el mercado 📈`,
    ciencia: `¡Increíble verdad @${commenterHandle}! El mundo nunca deja de sorprender 🌍`,
    pr: `¡Saludos @${commenterHandle}! Gracias por el apoyo siempre 🔥🇵🇷`,
    cine: `¡Ese estreno promete @${commenterHandle}! ¿La vas a ver? 🎬`,
    moda: `¡Mil gracias @${commenterHandle}! Qué bueno que te gustó el estilo ✨`,
    fitness: `¡A darle con todo @${commenterHandle}! La disciplina no falla 💪`,
    cocina: `¡Gracias @${commenterHandle}! Si la preparas me cuentas qué tal queda 😋`,
    horoscopo: `¡Muchas bendiciones astrales @${commenterHandle}! ¿Cuál es tu signo? ✨🌙`,
    fe: `¡Amén @${commenterHandle}! Que Dios te bendiga grandemente hoy y siempre 🙏✝️`,
    promo: `¡Seguimos subiendo el nivel en ARGON @${commenterHandle}! 🚀🔥`
  };
  return replies[ch.tone] || `¡Gracias por comentar @${commenterHandle}! 🙌`;
}

async function postYoutubeForChannel(ch, ytChannelId, usedYtIds, offsetMs) {
  const vids = await fetchYoutubeItems(ytChannelId);
  const fresh = vids.find(v => !usedYtIds.has(v.id));
  if (!fresh) return false;
  usedYtIds.add(fresh.id);
  const prefix = ch.isPromoChannel ? `${await buildTopInfluencersCaption()}\n` : '';
  await addDoc(collection(db, 'posts'), {
    handle: ch.handle, userName: ch.name, avatar: ch.avatar, isAiAgent: true,
    caption: `${prefix}${fresh.title} https://www.youtube.com/watch?v=${fresh.id}`,
    youtubeId: fresh.id, image: '', images: [], video: '', visibility: 'public',
    likes: Math.floor(Math.random() * 18) + 3, views: Math.floor(Math.random() * 120) + 15,
    likedBy: [], comments: [], promotedUntil: 0, createdAt: Date.now() - offsetMs
  });
  return true;
}

async function run() {
  for (const ch of CHANNELS) await ensureChannelProfile(ch);

  const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)));
  const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const usedImages = new Set();
  const usedYtIds = new Set();
  const countByHandle = {};

  for (const p of posts) {
    const h = (p.handle || '').toUpperCase();
    countByHandle[h] = (countByHandle[h] || 0) + 1;
    if (p.image) usedImages.add(p.image);
    if (Array.isArray(p.images)) p.images.forEach(img => usedImages.add(img));
    if (p.youtubeId) usedYtIds.add(p.youtubeId);
  }

  let repliesSent = 0;
  for (const p of posts) {
    if (repliesSent >= 5) break;
    const ch = CHANNEL_MAP[(p.handle || '').toUpperCase()];
    if (!ch || !Array.isArray(p.comments) || p.comments.length === 0) continue;
    const last = p.comments[p.comments.length - 1];
    if (!last || !last.handle || last.handle.toUpperCase() === ch.handle) continue;

    const replyText = await buildSmartReply(ch, last.text || '', last.handle);
    await updateDoc(doc(db, 'posts', p.id), {
      comments: arrayUnion({ id: 'c_' + Date.now(), handle: ch.handle, text: replyText, createdAt: Date.now() })
    });
    await addDoc(collection(db, 'notifications'), {
      to: last.handle.toUpperCase(), from: ch.handle, type: 'comment',
      text: `respondió tu comentario: "${replyText.slice(0, 45)}"`, postId: p.id, createdAt: Date.now()
    });
    repliesSent++;
  }

  const candidatesForLike = posts.filter(p => !CHANNEL_MAP[(p.handle || '').toUpperCase()] || Math.random() < 0.35).slice(0, 12);
  let likesGiven = 0;
  for (const p of candidatesForLike) {
    if (likesGiven >= 3) break;
    const liker = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
    if (liker.handle === (p.handle || '').toUpperCase()) continue;
    await updateDoc(doc(db, 'posts', p.id), { likes: increment(1) });
    if (!CHANNEL_MAP[(p.handle || '').toUpperCase()]) {
      await addDoc(collection(db, 'notifications'), {
        to: (p.handle || '').toUpperCase(), from: liker.handle, type: 'like',
        text: 'le dio Me Gusta a tu publicación', postId: p.id, createdAt: Date.now()
      });
    }
    likesGiven++;
  }

  let createdCount = 0;
  const underfilled = CHANNELS.filter(c => (countByHandle[c.handle] || 0) < 4);
  const targets = underfilled.length > 0 ? underfilled : [CHANNELS[Math.floor(Math.random() * CHANNELS.length)]];

  for (const ch of targets) {
    if (createdCount >= 8) break;
    if (ch.ytId) {
      if (await postYoutubeForChannel(ch, ch.ytId, usedYtIds, createdCount * 1000)) createdCount++;
    } else if (ch.extraYtId && Math.random() < 0.35) {
      if (await postYoutubeForChannel(ch, ch.extraYtId, usedYtIds, createdCount * 1000)) createdCount++;
    } else if (ch.wikiQuery) {
      const imgUrl = await fetchUniqueWikiImage(ch.wikiQuery, usedImages);
      if (imgUrl) {
        usedImages.add(imgUrl);
        const cap = ch.isPromoChannel
          ? await buildTopInfluencersCaption()
          : ch.captions[Math.floor(Math.random() * ch.captions.length)];
        await addDoc(collection(db, 'posts'), {
          handle: ch.handle, userName: ch.name, avatar: ch.avatar, isAiAgent: true,
          caption: cap, image: imgUrl, images: [imgUrl], video: '', youtubeId: '',
          visibility: 'public', likes: Math.floor(Math.random() * 25) + 4, views: 0,
          likedBy: [], comments: [], promotedUntil: 0, createdAt: Date.now() - createdCount * 1000
        });
        createdCount++;
      }
    }
  }
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
