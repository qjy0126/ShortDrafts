import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0QIfKTXS7hH4_DpRfaatAowNn6sevEhU",
  authDomain: "soaprail.firebaseapp.com",
  projectId: "soaprail",
  storageBucket: "soaprail.firebasestorage.app",
  messagingSenderId: "933579566820",
  appId: "1:933579566820:web:2f5333f42d59d8ce7b86f1",
  measurementId: "G-NSY7CFTQTE",
};

const app = initializeApp(firebaseConfig);
isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});
