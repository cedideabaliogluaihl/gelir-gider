import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmb5RK2NQCBPEv692-lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311790",
  appId: "1:682384311790:web:2ba8621cec98145232faff"
};


/* =========================================================
   FIREBASE BAŞLAT
   ========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   SABİTLER
   ========================================================= */

const ITEMS_KEY = "gelirGiderV4";
const SETTINGS_KEY = "gelirGiderSettingsV1";


const defaultSettings = {

  cards: [
    { name: "Kart 1", limit: 0 },
    { name: "Kart 2", limit: 0 },
    { name: "Kart 3", limit: 0 }
  ],

  incomeCategories: [
    "Maaş",
    "Ek Ders",
    "Diğer Gelir"
  ],

  expenseCategories: [
    "Kira",
    "Market",
    "Fatura",
    "Yakıt",
    "Nakit",
    "Diğer Gider"
  ]

};


/* =========================================================
   DURUM
   ========================================================= */

let user = null;

let dataCache = {
  items: [],
  settings: structuredClone(defaultSettings),
  exists: false
};

let readyPromise = null;


/* =========================================================
   AYARLARI NORMALİZE ET
   ========================================================= */

function normalizeSettings(settings) {

  settings =
    settings &&
    typeof settings === "object"
      ? settings
      : {};

  const cards =
    Array.isArray(settings.cards) &&
    settings.cards.length === 3
      ? settings.cards
      : defaultSettings.cards;


  return {

    cards: cards.map((card, index) => ({
      name: String(
        card?.name ||
        `Kart ${index + 1}`
      ),

      limit:
        Number(card?.limit) || 0
    })),

    incomeCategories:
      Array.isArray(settings.incomeCategories) &&
      settings.incomeCategories.length
        ? settings.incomeCategories.map(String)
        : [...defaultSettings.incomeCategories],

    expenseCategories:
      Array.isArray(settings.expenseCategories) &&
      settings.expenseCategories.length
        ? settings.expenseCategories.map(String)
        : [...defaultSettings.expenseCategories]

  };

}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function readLocal() {

  let items = [];

  let settings =
    structuredClone(defaultSettings);


  try {

    items =
      JSON.parse(
        localStorage.getItem(ITEMS_KEY) || "[]"
      );

  } catch {

    items = [];

  }


  try {

    settings =
      normalizeSettings(
        JSON.parse(
          localStorage.getItem(SETTINGS_KEY) || "null"
        )
      );

  } catch {

    settings =
      structuredClone(defaultSettings);

  }


  return {

    items:
      Array.isArray(items)
        ? items
        : [],

    settings

  };

}


/* =========================================================
   LOCAL CACHE YAZ
   ========================================================= */

function writeLocal(items, settings) {

  localStorage.setItem(
    ITEMS_KEY,
    JSON.stringify(items)
  );

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(
      normalizeSettings(settings)
    )
  );

}


/* =========================================================
   AUTH EKRANI
   ========================================================= */

function addAuthUi() {

  if (
    document.getElementById(
      "firebaseAuthBar"
    )
  ) {
    return;
  }


  const bar =
    document.createElement("div");

  bar.id =
    "firebaseAuthBar";


  bar.style.cssText =
    `
    position:sticky;
    top:0;
    z-index:9999;
    background:#eef5fb;
    border-bottom:1px solid #cbd9e6;
    padding:7px 14px;
    font:14px Arial,sans-serif;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    `;


  bar.innerHTML =
    `
    <span id="firebaseUserText">
      Firebase bağlantısı hazırlanıyor…
    </span>

    <button
      id="firebaseLoginBtn"
      style="
        display:none;
        border:0;
        border-radius:7px;
        padding:7px 12px;
        background:#1f4e78;
        color:#fff;
        cursor:pointer;
      "
    >
      Google ile giriş yap
    </button>

    <button
      id="firebaseLogoutBtn"
      style="
        display:none;
        border:1px solid #999;
        border-radius:7px;
        padding:6px 10px;
        background:#fff;
        cursor:pointer;
      "
    >
      Çıkış
    </button>
    `;


  document.body.prepend(bar);


  bar
    .querySelector("#firebaseLoginBtn")
    .onclick = () => {

      signInWithPopup(
        auth,
        provider
      ).catch(showAuthError);

    };


  bar
    .querySelector("#firebaseLogoutBtn")
    .onclick = () => {

      signOut(auth);

    };

}


/* =========================================================
   AUTH HATA
   ========================================================= */

function showAuthError(error) {

  const text =
    document.getElementById(
      "firebaseUserText"
    );

  if (!text) return;


  text.textContent =
    "Giriş başarısız: " +
    (
      error?.code ||
      error?.message ||
      "Bilinmeyen hata"
    );

}


/* =========================================================
   AUTH BEKLE
   ========================================================= */

function waitForAuth() {

  return new Promise(resolve => {

    let resolved = false;


    onAuthStateChanged(
      auth,
      currentUser => {

        user = currentUser;


        const text =
          document.getElementById(
            "firebaseUserText"
          );

        const login =
          document.getElementById(
            "firebaseLoginBtn"
          );

        const logout =
          document.getElementById(
            "firebaseLogoutBtn"
          );


        if (currentUser) {

          if (text) {

            text.textContent =
              `☁️ ${currentUser.displayName || currentUser.email || "Google hesabı"} — Firebase'e bağlı`;

          }


          if (login) {
            login.style.display =
              "none";
          }


          if (logout) {
            logout.style.display =
              "inline-block";
          }


          if (!resolved) {

            resolved = true;

            resolve(currentUser);

          }

        }

        else {

          if (text) {

            text.textContent =
              "Firebase'e bağlanmak için Google ile giriş yapmalısın.";

          }


          if (login) {

            login.style.display =
              "inline-block";

          }


          if (logout) {

            logout.style.display =
              "none";

          }

        }

      }
    );

  });

}


/* =========================================================
   FIRESTORE'DAN VERİ ÇEK
   ========================================================= */

async function syncFromCloud() {

  if (!user) {

    throw new Error(
      "Firebase kullanıcı oturumu bulunamadı."
    );

  }


  const ref =
    doc(
      db,
      "users",
      user.uid
    );


  const snap =
    await getDoc(ref);


  const local =
    readLocal();


  /* -----------------------------------------
     KULLANICI KAYDI VAR
     ----------------------------------------- */

  if (snap.exists()) {

    const data =
      snap.data();


    dataCache = {

      items:
        Array.isArray(data.items)
          ? data.items
          : [],

      settings:
        normalizeSettings(
          data.settings
        ),

      exists: true

    };


    /*
      ÖNEMLİ:
      Firebase'deki veriyi LocalStorage'a
      kopyalıyoruz.
    */

    writeLocal(
      dataCache.items,
      dataCache.settings
    );

  }


  /* -----------------------------------------
     KULLANICI KAYDI YOK
     ----------------------------------------- */

  else {

    dataCache = {

      items:
        Array.isArray(local.items)
          ? local.items
          : [],

      settings:
        normalizeSettings(
          local.settings
        ),

      exists: false

    };


    await setDoc(
      ref,
      {
        items:
          dataCache.items,

        settings:
          dataCache.settings,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()

      }
    );


    dataCache.exists = true;


    writeLocal(
      dataCache.items,
      dataCache.settings
    );

  }


  return dataCache;

}


/* =========================================================
   FIREBASE HAZIR
   ========================================================= */

export async function firebaseReady() {

  addAuthUi();


  if (!readyPromise) {

    readyPromise =
      (async () => {

        await waitForAuth();

        return await syncFromCloud();

      })();

  }


  return readyPromise;

}


/* =========================================================
   VERİ OKUMA
   ========================================================= */

export function getUser() {

  return user;

}


export function getItems() {

  return dataCache.items;

}


export function getSettings() {

  return dataCache.settings;

}


/* =========================================================
   İŞLEMLERİ KAYDET
   ========================================================= */

export async function saveItems(items) {

  dataCache.items =
    Array.isArray(items)
      ? items
      : [];


  writeLocal(
    dataCache.items,
    dataCache.settings
  );


  if (!user) {

    throw new Error(
      "Firebase oturumu yok."
    );

  }


  await setDoc(

    doc(
      db,
      "users",
      user.uid
    ),

    {

      items:
        dataCache.items,

      updatedAt:
        serverTimestamp()

    },

    {
      merge: true
    }

  );

}


/* =========================================================
   AYARLARI KAYDET
   ========================================================= */

export async function saveSettings(settings) {

  dataCache.settings =
    normalizeSettings(settings);


  writeLocal(
    dataCache.items,
    dataCache.settings
  );


  if (!user) {

    throw new Error(
      "Firebase oturumu yok."
    );

  }


  await setDoc(

    doc(
      db,
      "users",
      user.uid
    ),

    {

      settings:
        dataCache.settings,

      updatedAt:
        serverTimestamp()

    },

    {
      merge: true
    }

  );

}


/* =========================================================
   ESKİ LOCAL YEDEK
   ========================================================= */

export function legacyBackup() {

  const data =
    readLocal();


  return {

    items:
      data.items,

    settings:
      data.settings

  };

}
