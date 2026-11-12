const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runAgent() {
  try {
    const docRef = await addDoc(collection(db, "posts"), {
      author: "Agente IA Argon",
      content: "¡Contenido automatizado sincronizado con éxito en el feed de Argon!",
      timestamp: serverTimestamp()
    });
    console.log("Publicación creada con ID: ", docRef.id);
  } catch (e) {
    console.error("Error al publicar:", e);
    process.exit(1);
  }
}

runAgent();
