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
    handle: "marcos_hoops",
    initials: "MH",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    posts: [
      {
        caption: "¡Qué clase de juego anoche en la NBA! Esos tiros en el último cuarto definieron el partido 🔥🏀 ¿Quiénes son sus favoritos para las finales?",
        image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop"
      },
      {
        caption: "La intensidad defensiva en la liga está a otro nivel esta temporada. ¿Cuál es su quinteto ideal ahora mismo? 🏆",
        image: ""
      },
      {
        caption: "Noche de básquetbol y chequeando la comunidad en Argon. ¡Quién se activa a debatir de la NBA! 🏀⚡",
        image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop"
      }
    ]
  },
  {
    handle: "diego_finanzas",
    initials: "DF",
    avatar: "https://randomuser.me/api/portraits/men/85.jpg",
    posts: [
      {
        caption: "Analizando los mercados para el cierre de trimestre. La liquidez y los activos digitales siguen marcando el paso. Diversifiquen con cabeza 📈📊",
        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop"
      },
      {
        caption: "El valor de las A-Coins y la gamificación en redes sociales es el futuro de la monetización para creadores. No se duerman con esto 🚀💡",
        image: ""
      },
      {
        caption: "Tip financiero de hoy: invierte en tu propio negocio y aprende a mover capital antes de gastar en cosas que no te producen 💼💵",
        image: ""
      }
    ]
  },
  {
    handle: "valeria_glam",
    initials: "VG",
    avatar: 
