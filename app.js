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
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// FIREBASE
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmb5RK2NQCBPEv692-lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311790",
  appId: "1:682384311790:web:2ba8621cec98145232faff"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


// ============================================================
// LOCAL / CLOUD ANAHTARLARI
// ============================================================

const KEY = "gelirGiderV4";
const SET = "gelirGiderSettingsV1";


// ============================================================
// VARSAYILAN AYARLAR
// ============================================================

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


// ============================================================
// DEĞİŞKENLER
// ============================================================

let items = [];

let settings = structuredClone(defaultSettings);

let currentUser = null;

let loading = false;


// ============================================================
// KISA FONKSİYONLAR
// ============================================================

const $ = id => document.getElementById(id);


const money = n =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(Number(n) || 0);


const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );


function todayLocal() {

  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}


function currentMonth() {

  return todayLocal().slice(0, 7);

}


function monthLabel(m) {

  return new Date(
    m + "-01T00:00:00"
  ).toLocaleDateString(
    "tr-TR",
    {
      month: "long",
      year: "numeric"
    }
  );

}


function ym(d) {

  return String(d || "").slice(0, 7);

}


function installments(x) {

  return Math.max(
    1,
    Number(x.installments) || 1
  );

}


function isCard(x) {

  return (
    x.type === "Gider" &&
    x.payment === "Kredi Kartı" &&
    String(x.card || "").startsWith("c")
  );

}


function due(x, month) {

  if (!isCard(x)) return 0;

  const start = ym(x.date);

  const diff =
    (
      Number(month.slice(0, 4)) -
      Number(start.slice(0, 4))
    ) * 12
    +
    (
      Number(month.slice(5)) -
      Number(start.slice(5))
    );

  return (
    diff >= 0 &&
    diff < installments(x)
  )
    ? Number(x.amount) / installments(x)
    : 0;

}


// ============================================================
// LOCAL STORAGE
// ============================================================

function loadLocal() {

  try {

    const savedItems =
      JSON.parse(
        localStorage.getItem(KEY) || "[]"
      );

    const savedSettings =
      JSON.parse(
        localStorage.getItem(SET) ||
        JSON.stringify(defaultSettings)
      );

    items =
      Array.isArray(savedItems)
        ? savedItems
        : [];

    settings = normalizeSettings(savedSettings);

  } catch {

    items = [];

    settings =
      structuredClone(defaultSettings);

  }

}


function saveLocal() {

  localStorage.setItem(
    KEY,
    JSON.stringify(items)
  );

  localStorage.setItem(
    SET,
    JSON.stringify(settings)
  );

}


// ============================================================
// AYAR NORMALİZASYONU
// ============================================================

function normalizeSettings(s) {

  if (!s || typeof s !== "object") {

    return structuredClone(defaultSettings);

  }

  return {

    cards:
      Array.isArray(s.cards) &&
      s.cards.length === 3

        ? s.cards.map((c, i) => ({
            name:
              String(
                c?.name ||
                `Kart ${i + 1}`
              ),

            limit:
              Number(c?.limit) || 0
          }))

        : structuredClone(
            defaultSettings.cards
          ),

    incomeCategories:
      Array.isArray(s.incomeCategories) &&
      s.incomeCategories.length

        ? s.incomeCategories.map(String)

        : [...defaultSettings.incomeCategories],

    expenseCategories:
      Array.isArray(s.expenseCategories) &&
      s.expenseCategories.length

        ? s.expenseCategories.map(String)

        : [...defaultSettings.expenseCategories]

  };

}


// ============================================================
// FIRESTORE YOLLARI
// ============================================================

function userRoot() {

  if (!currentUser) {

    throw new Error(
      "Kullanıcı giriş yapmamış."
    );

  }

  return `users/${currentUser.uid}`;

}


function itemsCollection() {

  return collection(
    db,
    userRoot(),
    "items"
  );

}


function settingsDoc() {

  return doc(
    db,
    userRoot(),
    "meta",
    "settings"
  );

}


// ============================================================
// FIRESTORE'DAN VERİ OKU
// ============================================================

async function loadCloud() {

  if (!currentUser) return;

  loading = true;

  try {

    const snap =
      await getDocs(
        itemsCollection()
      );

    const cloudItems = [];

    snap.forEach(d => {

      cloudItems.push({
        ...d.data(),
        id: d.id
      });

    });

    const settingsSnap =
      await getDocs(
        collection(
          db,
          userRoot(),
          "meta"
        )
      );

    let cloudSettings = null;

    settingsSnap.forEach(d => {

      if (d.id === "settings") {

        cloudSettings = d.data();

      }

    });


    // --------------------------------------------------------
    // BULUTTA VERİ YOKSA LOCAL VERİYİ TAŞI
    // --------------------------------------------------------

    if (
      cloudItems.length === 0 &&
      items.length > 0
    ) {

      await migrateLocalToCloud();

      return;

    }


    items = cloudItems;

    if (cloudSettings) {

      settings =
        normalizeSettings(
          cloudSettings
        );

    }


    saveLocal();

    render();

  } catch (error) {

    console.error(
      "Firestore okuma hatası:",
      error
    );

    showMessage(
      "Firebase verileri okunamadı: " +
      error.message,
      true
    );

  } finally {

    loading = false;

  }

}


// ============================================================
// LOCAL → FIREBASE TAŞIMA
// ============================================================

async function migrateLocalToCloud() {

  if (!currentUser) return;

  try {

    const batch = writeBatch(db);

    for (const item of items) {

      const id =
        String(item.id);

      batch.set(
        doc(
          db,
          userRoot(),
          "items",
          id
        ),
        item
      );

    }

    batch.set(
      settingsDoc(),
      settings
    );

    await batch.commit();

    showMessage(
      "Mevcut kayıtların Firebase'e aktarıldı."
    );

    await loadCloud();

  } catch (error) {

    console.error(error);

    showMessage(
      "Firebase'e aktarım başarısız: " +
      error.message,
      true
    );

  }

}


// ============================================================
// FIRESTORE'A TEK İŞLEM KAYDET
// ============================================================

async function saveItemCloud(item) {

  if (!currentUser) return;

  await setDoc(
    doc(
      db,
      userRoot(),
      "items",
      String(item.id)
    ),
    item
  );

}


// ============================================================
// FIRESTORE'DAN İŞLEM SİL
// ============================================================

async function deleteItemCloud(id) {

  if (!currentUser) return;

  await deleteDoc(
    doc(
      db,
      userRoot(),
      "items",
      String(id)
    )
  );

}


// ============================================================
// AYARLARI FIRESTORE'A KAYDET
// ============================================================

async function saveSettingsCloud() {

  if (!currentUser) return;

  await setDoc(
    settingsDoc(),
    settings
  );

}


// ============================================================
// MESAJ
// ============================================================

function showMessage(message, error = false) {

  const el = $("authMessage");

  if (!el) return;

  el.style.display = "block";

  el.textContent = message;

  el.style.background =
    error
      ? "#ffe8e8"
      : "#eef6ff";

  el.style.color =
    error
      ? "#a00000"
      : "#1f4e78";

  if (!error) {

    setTimeout(() => {

      el.style.display = "none";

    }, 5000);

  }

}


// ============================================================
// KATEGORİLER
// ============================================================

function populateCategories() {

  const type =
    $("type")?.value;

  const sel =
    $("category");

  if (!sel) return;

  if (type === "Kasa Transferi") {

    sel.innerHTML =
      `<option value="Kasa Transferi">
        Kasa Transferi
      </option>`;

    return;

  }

  const arr =
    type === "Gelir"
      ? settings.incomeCategories
      : settings.expenseCategories;

  sel.innerHTML =
    arr
      .map(
        x =>
          `<option value="${esc(x)}">
            ${esc(x)}
          </option>`
      )
      .join("");

}


// ============================================================
// KARTLAR
// ============================================================

function populateCards() {

  const card =
    $("card");

  if (!card) return;

  card.innerHTML =
    `<option value="">
      Kart seç
    </option>` +
    settings.cards
      .map(
        (c, i) =>
          `<option value="c${i}">
            ${esc(c.name)}
          </option>`
      )
      .join("");

}


// ============================================================
// FORM GÖRÜNÜMÜ
// ============================================================

function sync() {

  const type =
    $("type")?.value;

  const isExpense =
    type === "Gider";

  const isCardPayment =
    isExpense &&
    $("payment")?.value ===
      "Kredi Kartı";

  if ($("payment")) {

    $("payment").disabled =
      !isExpense;

  }

  if ($("card")) {

    $("card").disabled =
      !isCardPayment;

  }

  if ($("installmentBox")) {

    $("installmentBox").hidden =
      !isCardPayment;

  }

  if (!isCardPayment) {

    if ($("installment")) {

      $("installment").checked =
        false;

    }

    if ($("installmentFields")) {

      $("installmentFields").hidden =
        true;

    }

  }

  populateCategories();

}


// ============================================================
// ANA RENDER
// ============================================================

function render() {

  const m =
    currentMonth();

  const label =
    monthLabel(m);

  const current =
    items.filter(
      x =>
        String(x.date || "")
          .startsWith(m)
    );


  // ----------------------------------------------------------
  // GELİR
  // ----------------------------------------------------------

  const income =
    current
      .filter(
        x => x.type === "Gelir"
      )
      .reduce(
        (s, x) =>
          s + Number(x.amount || 0),
        0
      );


  // ----------------------------------------------------------
  // NAKİT GİDER
  // ----------------------------------------------------------

  const cashExpense =
    current
      .filter(
        x =>
          x.type === "Gider" &&
          !isCard(x)
      )
      .reduce(
        (s, x) =>
          s + Number(x.amount || 0),
        0
      );


  // ----------------------------------------------------------
  // KREDİ KARTI
  // ----------------------------------------------------------

  const cardExpense =
    items.reduce(
      (s, x) =>
        s + due(x, m),
      0
    );


  const expense =
    cashExpense +
    cardExpense;


  // ----------------------------------------------------------
  // TRANSFER
  // ----------------------------------------------------------

  const transfer =
    current
      .filter(
        x =>
          x.type ===
          "Kasa Transferi"
      )
      .reduce(
        (s, x) =>
          s + Number(x.amount || 0),
        0
      );


  // ----------------------------------------------------------
  // ÜST ÖZET
  // ----------------------------------------------------------

  $("totalIncome").textContent =
    money(income);

  $("totalExpense").textContent =
    money(expense);

  $("net").textContent =
    money(
      income -
      expense -
      transfer
    );

  $("totalTransfer").textContent =
    money(transfer);


  $("currentMonthLabel")
    .textContent = label;

  $("transactionsTitle")
    .textContent =
      `${label} İşlemleri`;


  // ----------------------------------------------------------
  // KART ÖZETİ
  // ----------------------------------------------------------

  $("cardSummary").innerHTML =
    settings.cards
      .map((c, i) => {

        const value =
          items.reduce(
            (s, x) =>
              s +
              due(x, m) *
              (
                x.card ===
                "c" + i
                  ? 1
                  : 0
              ),
            0
          );

        const limit =
          Number(c.limit) || 0;

        const remaining =
          limit - value;

        return `
          <div>

            <span>
              ${esc(c.name)}
            </span>

            <strong>
              ${money(value)}
            </strong>

            <small>
              Bu ay harcama
            </small>

            <small>
              Limit: ${money(limit)}
              ·
              Kalan: ${money(remaining)}
            </small>

          </div>
        `;

      })
      .join("");


  // ----------------------------------------------------------
  // AYLIK ÖZET
  // ----------------------------------------------------------

  $("monthIncome")
    .textContent =
      money(income);

  $("monthExpense")
    .textContent =
      money(expense);

  $("monthNet")
    .textContent =
      money(
        income -
        expense -
        transfer
      );

  $("monthTransfer")
    .textContent =
      money(transfer);


  // ----------------------------------------------------------
  // İŞLEM LİSTESİ
  // ----------------------------------------------------------

  const sorted =
    current
      .slice()
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
          ||
          Number(b.id || 0) -
          Number(a.id || 0)
      );


  $("list").innerHTML =
    sorted
      .map(x => {

        const cardIndex =
          isCard(x)
            ? Number(
                String(x.card)
                  .slice(1)
              )
            : -1;

        const cardName =
          cardIndex >= 0
            ? settings
                .cards[
                  cardIndex
                ]?.name || "-"
            : "-";

        const amount =
          isCard(x)
            ? Number(x.amount) /
              installments(x)
            : Number(x.amount);


        return `
          <tr class="${
            x.type === "Gelir"
              ? "income"
              : x.type === "Gider"
                ? "expense"
                : "transfer"
          }">

            <td>
              <input
                class="sel"
                type="checkbox"
                data-id="${esc(x.id)}"
              >
            </td>

            <td>
              ${new Date(
                x.date +
                "T00:00:00"
              ).toLocaleDateString(
                "tr-TR"
              )}
            </td>

            <td>
              ${esc(x.description)}
            </td>

            <td>
              ${esc(
                x.category ||
                "Genel"
              )}
            </td>

            <td>
              ${esc(x.type)}
            </td>

            <td>
              ${esc(
                x.payment || "-"
              )}
            </td>

            <td>
              ${esc(cardName)}
            </td>

            <td>
              ${
                isCard(x)
                  ? installments(x) > 1
                    ? installments(x) +
                      " taksit"
                    : "Tek çekim"
                  : "-"
              }
            </td>

            <td class="amount">
              ${money(amount)}
            </td>

          </tr>
        `;

      })
      .join("");


  $("empty").style.display =
    sorted.length
      ? "none"
      : "block";

}


// ============================================================
// GOOGLE GİRİŞ
// ============================================================

async function login() {

  try {

    showMessage(
      "Google hesabı ile giriş yapılıyor..."
    );

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    currentUser =
      result.user;

    showMessage(
      "Giriş başarılı: " +
      currentUser.email
    );

    await loadCloud();

  } catch (error) {

    console.error(
      "Firebase giriş hatası:",
      error
    );

    let message =
      error?.code ||
      error?.message ||
      "Bilinmeyen hata";

    showMessage(
      "Giriş işlemi başarısız: " +
      message,
      true
    );

  }

}


// ============================================================
// ÇIKIŞ
// ============================================================

async function logout() {

  try {

    await signOut(auth);

    currentUser = null;

    showMessage(
      "Çıkış yapıldı."
    );

    render();

  } catch (error) {

    showMessage(
      "Çıkış başarısız: " +
      error.message,
      true
    );

  }

}


// ============================================================
// AUTH DURUMU
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    currentUser =
      user || null;

    if (user) {

      $("loginBtn").hidden =
        true;

      $("logoutBtn").hidden =
        false;

      $("userInfo").textContent =
        user.email || "";

      try {

        await loadCloud();

      } catch (error) {

        console.error(error);

      }

    } else {

      $("loginBtn").hidden =
        false;

      $("logoutBtn").hidden =
        true;

      $("userInfo").textContent =
        "";

      render();

    }

  }
);


// ============================================================
// TARİH
// ============================================================

$("date").value =
  todayLocal();


// ============================================================
// EVENTLER
// ============================================================

$("loginBtn").onclick =
  login;


$("logoutBtn").onclick =
  logout;


$("type").onchange =
  sync;


$("payment").onchange =
  sync;


$("installment").onchange =
  () => {

    $("installmentFields")
      .hidden =
        !$("installment").checked;

    updateInstallmentPreview();

  };


$("installmentCount").onchange =
  updateInstallmentPreview;


$("amount").oninput =
  updateInstallmentPreview;


function updateInstallmentPreview() {

  const box =
    $("installmentPreview");

  if (
    !$("installment").checked
  ) {

    box.textContent = "";

    return;

  }

  const amount =
    Number(
      $("amount").value
    );

  const count =
    Number(
      $("installmentCount").value
    ) || 1;

  box.textContent =
    amount > 0
      ? `Aylık taksit: ${money(
          amount / count
        )}`
      : "";

}


// ============================================================
// İŞLEM EKLE
// ============================================================

$("form").onsubmit =
  async e => {

    e.preventDefault();

    if (!currentUser) {

      alert(
        "Önce Google ile giriş yapmalısın."
      );

      return;

    }


    const type =
      $("type").value;

    const amount =
      Number(
        $("amount").value
      );

    const payment =
      type === "Gider"
        ? $("payment").value
        : "";

    const card =
      payment === "Kredi Kartı"
        ? $("card").value
        : "";

    const description =
      $("description")
        .value
        .trim();


    if (!description) {

      alert(
        "Açıklama gir."
      );

      return;

    }


    if (
      !amount ||
      amount <= 0
    ) {

      alert(
        "Geçerli tutar gir."
      );

      return;

    }


    if (
      (
        type === "Gelir" ||
        type === "Gider"
      ) &&
      !$("category").value
    ) {

      alert(
        "Kategori seç."
      );

      return;

    }


    if (
      payment === "Kredi Kartı" &&
      !card
    ) {

      alert(
        "Kart seç."
      );

      return;

    }


    const count =
      payment === "Kredi Kartı" &&
      $("installment").checked
        ? Number(
            $("installmentCount")
              .value
          ) || 1
        : 1;


    const item = {

      id:
        Date.now(),

      date:
        $("date").value,

      description,

      type,

      payment,

      card,

      category:
        type === "Kasa Transferi"
          ? "Kasa Transferi"
          : $("category").value,

      amount,

      installments:
        count

    };


    try {

      await saveItemCloud(
        item
      );

      items.push(item);

      saveLocal();

      render();


      $("description").value =
        "";

      $("amount").value =
        "";

      $("installment").checked =
        false;

      $("installmentFields")
        .hidden = true;

      $("installmentPreview")
        .textContent = "";


      showMessage(
        "İşlem Firebase'e kaydedildi."
      );

    } catch (error) {

      console.error(error);

      alert(
        "İşlem kaydedilemedi:\n\n" +
        error.message
      );

    }

  };


// ============================================================
// SEÇİLİ SİL
// ============================================================

$("clearBtn").onclick =
  async () => {

    if (!currentUser) {

      alert(
        "Önce Google ile giriş yap."
      );

      return;

    }


    const ids =
      [
        ...document.querySelectorAll(
          ".sel:checked"
        )
      ].map(
        x =>
          String(
            x.dataset.id
          )
      );


    if (!ids.length) {

      alert(
        "Silmek için işlem seç."
      );

      return;

    }


    if (
      !confirm(
        "Seçili işlemler silinsin mi?"
      )
    ) {

      return;

    }


    try {

      for (const id of ids) {

        await deleteItemCloud(
          id
        );

      }


      items =
        items.filter(
          x =>
            !ids.includes(
              String(x.id)
            )
        );


      saveLocal();

      render();

    } catch (error) {

      alert(
        "Silme başarısız:\n\n" +
        error.message
      );

    }

  };


// ============================================================
// TÜMÜNÜ TEMİZLE
// ============================================================

$("clearAllBtn").onclick =
  async () => {

    if (!currentUser) {

      alert(
        "Önce Google ile giriş yap."
      );

      return;

    }


    if (
      !confirm(
        "Tüm kayıtlar Firebase'den silinecek.\n\n" +
        "Bu işlem geri alınamaz.\n\n" +
        "Devam edilsin mi?"
      )
    ) {

      return;

    }


    try {

      const snap =
        await getDocs(
          itemsCollection()
        );

      const batch =
        writeBatch(db);


      snap.forEach(
        d =>
          batch.delete(d.ref)
      );


      await batch.commit();


      items = [];

      saveLocal();

      render();


      showMessage(
        "Tüm işlemler silindi."
      );

    } catch (error) {

      alert(
        "Temizleme başarısız:\n\n" +
        error.message
      );

    }

  };


// ============================================================
// YEDEKLE
// ============================================================

$("exportBtn").onclick =
  () => {

    const backup = {

      version: "2.0",

      exportedAt:
        new Date()
          .toISOString(),

      user:
        currentUser?.email ||
        null,

      settings,

      items

    };


    const blob =
      new Blob(
        [
          JSON.stringify(
            backup,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      "gelir-gider-firebase-yedek.json";

    a.click();


    URL.revokeObjectURL(
      url
    );

  };


// ============================================================
// BAŞLANGIÇ
// ============================================================

loadLocal();

populateCards();

sync();

render();
