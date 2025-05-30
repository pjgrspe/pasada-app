// scripts/firebaseConfigNode.js
// Node.js compatible Firebase configuration for migration scripts

const { initializeApp } = require("firebase/app");
const { getAuth } = require('firebase/auth');
const { getFirestore } = require('firebase/firestore');
const { getDatabase } = require('firebase/database');

// Firebase configuration (inline to avoid TypeScript import issues)
const firebaseConfig = {
  apiKey: "AIzaSyDsqMOkLC6YDNyTyVNzxak2VeZCRtu0TUc",
  authDomain: "pasada-app-nrf4.firebaseapp.com",
  databaseURL: "https://pasada-app-nrf4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pasada-app-nrf4",
  storageBucket: "pasada-app-nrf4.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // You may need to add this
  appId: "YOUR_APP_ID" // You may need to add this
};

// Initialize Firebase for Node.js environment
const app = initializeApp(firebaseConfig);

// Initialize Firebase services for Node.js
const auth = getAuth(app);
const firestore = getFirestore(app);
const realtimeDb = getDatabase(app);

module.exports = {
  app,
  auth,
  firestore,
  realtimeDb
};
