// ============================================================
// GELİR - GİDER V1.9
// Firebase Authentication + Firestore + LocalStorage
// ============================================================

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ============================================================
// FIREBASE AYARLARI
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmb5RK2NQCBPEv692-lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311790",
  appId: "1:682384311790:web:2ba8621cec98145232faff"
};


// Firebase başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();


// ============================================================
// SABİTLER
// ============================================================

const KEY = "gelirGiderV4";
const SET = "gelirGiderSettingsV1";

let items = [];

let settings = {
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

let currentUser = null;


// ============================================================
// YARDIMCI FONKSİYONLAR
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


// ============================================================
// LOCALSTORAGE
// ============================================================

function loadLocal() {

  try {
    items = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );
  } catch {
    items = [];
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem(SET) ||
      JSON.stringify(settings)
    );

    if (saved && typeof saved === "object") {
      settings = saved;
    }

  } catch {}

  if (!Array.isArray(items)) {
    items = [];
  }

  if (
    !Array.isArray(settings.cards) ||
    settings.cards.length !== 3
  ) {
    settings.cards = [
      { name: "Kart 1", limit: 0 },
      { name: "Kart 2", limit: 0 },
      { name: "Kart 3", limit: 0 }
    ];
  }

  if (
    !Array.isArray(settings.incomeCategories) ||
    !settings.incomeCategories.length
  ) {
    settings.incomeCategories = [
      "Maaş",
      "Ek Ders",
      "Diğer Gelir"
    ];
  }

  if (
    !Array.isArray(settings.expenseCategories) ||
    !settings.expenseCategories.length
  ) {
    settings.expenseCategories = [
      "Kira",
      "Market",
      "Fatura",
      "Yakıt",
      "Nakit",
      "Diğer Gider"
    ];
  }

}


// ============================================================
// LOCAL KAYDET
// ============================================================

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
// KREDİ KARTI
// ============================================================

function isCard(x) {

  return (
    x.type === "Gider" &&
    x.payment === "Kredi Kartı" &&
    typeof x.card === "string" &&
    x.card.startsWith("c")
  );

}


function installments(x) {

  return Math.max(
    1,
    Number(x.installments) || 1
  );

}


function ym(d) {

  return String(d ?? "").slice(0, 7);

}


function due(x, m) {

  if (!isCard(x)) {
    return 0;
  }

  const s = ym(x.date);

  const diff =
    (+m.slice(0, 4) - +s.slice(0, 4)) * 12 +
    (+m.slice(5) - +s.slice(5));

  return (
    diff >= 0 &&
    diff < installments(x)
  )
    ? Number(x.amount) / installments(x)
    : 0;

}


function currentMonth() {

  return new Date()
    .toISOString()
    .slice(0, 7);

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


// ============================================================
// KATEGORİLER
// ============================================================

function populateCategories() {

  const type = $("type")?.value;
  const sel = $("category");

  if (!sel) {
    return;
  }

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

  sel.innerHTML = arr
    .map(
      x =>
        `<option value="${esc(x)}">
          ${esc(x)}
        </option>`
    )
    .join("");

}


// ============================================================
// FIREBASE AUTH ARAYÜZÜ
// ============================================================

function createAuthUI() {

  if (document.getElementById("firebaseAuthBox")) {
    return;
  }

  const box =
    document.createElement("div");

  box.id = "firebaseAuthBox";

  box.style.cssText = `
    width:100%;
    box-sizing:border-box;
    padding:10px 16px;
    background:#eef6ff;
    border-bottom:1px solid #cbdcec;
    display:flex;
    justify-content:center;
    align-items:center;
    gap:12px;
    flex-wrap:wrap;
    font-family:Arial,sans-serif;
  `;

  box.innerHTML = `

    <span id="firebaseStatus">
      Firebase bağlantısı hazırlanıyor...
    </span>

    <button
      id="firebaseLoginBtn"
      type="button"
      style="
        background:#1f4e78;
        color:white;
        border:0;
        border-radius:8px;
        padding:10px 16px;
        font-weight:600;
        cursor:pointer;
      "
    >
      Google ile giriş yap
    </button>

    <button
      id="firebaseLogoutBtn"
      type="button"
      style="
        display:none;
        background:#fff;
        color:#1f4e78;
        border:1px solid #1f4e78;
        border-radius:8px;
        padding:10px 16px;
        font-weight:600;
        cursor:pointer;
      "
    >
      Çıkış Yap
    </button>
  `;

  document.body.insertBefore(
    box,
    document.body.firstChild
  );


  $("firebaseLoginBtn").onclick =
    loginGoogle;

  $("firebaseLogoutBtn").onclick =
    logoutGoogle;

}


// ============================================================
// GOOGLE GİRİŞ
// ============================================================

async function loginGoogle() {

  const status =
    $("firebaseStatus");

  const btn =
    $("firebaseLoginBtn");

  try {

    btn.disabled = true;

    status.textContent =
      "Google hesabı açılıyor...";

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    currentUser = result.user;

    status.textContent =
      `${currentUser.displayName || currentUser.email} ile giriş yapıldı.`;

    await syncCloud();

  } catch (error) {

    console.error(
      "Firebase giriş hatası:",
      error
    );

    status.textContent =
      "Giriş başarısız.";

    alert(
      "Giriş başarısız:\n\n" +
      error.code +
      "\n\n" +
      (error.message || "")
    );

  } finally {

    btn.disabled = false;

  }

}


// ============================================================
// ÇIKIŞ
// ============================================================

async function logoutGoogle() {

  try {

    await signOut(auth);

    currentUser = null;

    updateAuthUI(null);

  } catch (error) {

    console.error(error);

    alert(
      "Çıkış yapılamadı:\n" +
      error.message
    );

  }

}


// ============================================================
// AUTH DURUMU
// ============================================================

function updateAuthUI(user) {

  const status =
    $("firebaseStatus");

  const login =
    $("firebaseLoginBtn");

  const logout =
    $("firebaseLogoutBtn");

  if (!status) {
    return;
  }

  if (user) {

    status.textContent =
      `☁️ ${user.displayName || user.email} — Firebase'e bağlı`;

    if (login) {
      login.style.display = "none";
    }

    if (logout) {
      logout.style.display = "inline-block";
    }

  } else {

    status.textContent =
      "☁️ Firebase'e bağlanmak için giriş yap";

    if (login) {
      login.style.display = "inline-block";
    }

    if (logout) {
      logout.style.display = "none";
    }

  }

}


// ============================================================
// FIRESTORE YOLU
// ============================================================

function userDoc() {

  if (!currentUser) {
    return null;
  }

  return doc(
    db,
    "users",
    currentUser.uid
  );

}


// ============================================================
// FIRESTORE'A YÜKLE
// ============================================================

async function uploadCloud() {

  if (!currentUser) {
    return;
  }

  const ref =
    userDoc();

  await setDoc(
    ref,
    {
      items: items,
      settings: settings,
      updatedAt: new Date().toISOString(),
      email: currentUser.email || "",
      displayName: currentUser.displayName || ""
    },
    {
      merge: true
    }
  );

}


// ============================================================
// FIRESTORE'DAN AL
// ============================================================

async function downloadCloud() {

  if (!currentUser) {
    return false;
  }

  const ref =
    userDoc();

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {
    return false;
  }

  const data =
    snap.data();

  if (Array.isArray(data.items)) {
    items = data.items;
  }

  if (
    data.settings &&
    typeof data.settings === "object"
  ) {
    settings = data.settings;
  }

  saveLocal();

  return true;

}


// ============================================================
// LOCAL + CLOUD SENKRONİZASYONU
// ============================================================

async function syncCloud() {

  if (!currentUser) {
    return;
  }

  try {

    const ref =
      userDoc();

    const snap =
      await getDoc(ref);


    // İlk kez giriş
    if (!snap.exists()) {

      await uploadCloud();

      console.log(
        "İlk yerel veriler Firebase'e aktarıldı."
      );

      return;
    }


    const cloud =
      snap.data();


    // --------------------------------------------------------
    // Bulutta kayıt varsa yerel kayıtlarla birleştir
    // --------------------------------------------------------

    if (Array.isArray(cloud.items)) {

      const map =
        new Map();

      for (const x of cloud.items) {

        if (x?.id != null) {
          map.set(
            String(x.id),
            x
          );
        }

      }

      for (const x of items) {

        if (x?.id != null) {

          const id =
            String(x.id);

          if (!map.has(id)) {
            map.set(id, x);
          }

        }

      }

      items =
        Array.from(
          map.values()
        );

    }


    if (
      cloud.settings &&
      typeof cloud.settings === "object"
    ) {

      settings =
        cloud.settings;

    }


    saveLocal();

    await uploadCloud();

    render();

    console.log(
      "Firebase senkronizasyonu tamamlandı."
    );


  } catch (error) {

    console.error(
      "Firebase senkronizasyon hatası:",
      error
    );

    alert(
      "Firebase veri senkronizasyonu başarısız:\n\n" +
      error.code +
      "\n\n" +
      error.message
    );

  }

}


// ============================================================
// ANA EKRANI ÇİZ
// ============================================================

function render() {

  const m =
    currentMonth();

  const label =
    monthLabel(m);

  const current =
    items.filter(
      x =>
        x.date?.startsWith(m)
    );


  const income =
    current
      .filter(
        x =>
          x.type === "Gelir"
      )
      .reduce(
        (s, x) =>
          s + Number(x.amount || 0),
        0
      );


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


  const cardExpense =
    items.reduce(
      (s, x) =>
        s + due(x, m),
      0
    );


  const expense =
    cashExpense +
    cardExpense;


  const transfer =
    current
      .filter(
        x =>
          x.type === "Kasa Transferi"
      )
      .reduce(
        (s, x) =>
          s + Number(x.amount || 0),
        0
      );


  if ($("totalIncome")) {
    $("totalIncome").textContent =
      money(income);
  }

  if ($("totalExpense")) {
    $("totalExpense").textContent =
      money(expense);
  }

  if ($("net")) {
    $("net").textContent =
      money(
        income -
        expense -
        transfer
      );
  }

  if ($("totalTransfer")) {
    $("totalTransfer").textContent =
      money(transfer);
  }

  if ($("currentMonthLabel")) {
    $("currentMonthLabel").textContent =
      label;
  }

  if ($("transactionsTitle")) {
    $("transactionsTitle").textContent =
      `${label} İşlemleri`;
  }


  // ----------------------------------------------------------
  // Kart özeti
  // ----------------------------------------------------------

  if ($("cardSummary")) {

    $("cardSummary").innerHTML =
      settings.cards
        .map(
          (c, i) => {

            const value =
              items.reduce(
                (s, x) =>
                  s +
                  (
                    x.card === "c" + i
                      ? due(x, m)
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
                <span>${esc(c.name)}</span>

                <strong>
                  ${money(value)}
                </strong>

                <small>
                  Bu ay harcama
                </small>

                <small>
                  Limit: ${money(limit)}
                  · Kalan: ${money(remaining)}
                </small>
              </div>
            `;

          }
        )
        .join("");

  }


  if ($("monthIncome")) {

    $("monthIncome").textContent =
      money(income);

  }

  if ($("monthExpense")) {

    $("monthExpense").textContent =
      money(expense);

  }

  if ($("monthNet")) {

    $("monthNet").textContent =
      money(
        income -
        expense -
        transfer
      );

  }

  if ($("monthTransfer")) {

    $("monthTransfer").textContent =
      money(transfer);

  }


  // ----------------------------------------------------------
  // İşlem listesi
  // ----------------------------------------------------------

  const sorted =
    current
      .slice()
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            ) ||
          Number(b.id || 0) -
          Number(a.id || 0)
      );


  if ($("list")) {

    $("list").innerHTML =
      sorted
        .map(
          x => `
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
                  data-id="${x.id}"
                >
              </td>

              <td>
                ${
                  x.date
                    ? new Date(
                        x.date +
                        "T00:00:00"
                      ).toLocaleDateString(
                        "tr-TR"
                      )
                    : "-"
                }
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
                  x.payment ||
                  "-"
                )}
              </td>

              <td>
                ${
                  isCard(x)
                    ? esc(
                        settings
                          .cards[
                            Number(
                              x.card.slice(1)
                            )
                          ]?.name ||
                        "-"
                      )
                    : "-"
                }
              </td>

              <td>
                ${
                  isCard(x)
                    ? (
                        installments(x) > 1
                          ? installments(x) +
                            " taksit"
                          : "Tek çekim"
                      )
                    : "-"
                }
              </td>

              <td class="amount">
                ${money(
                  isCard(x)
                    ? Number(x.amount) /
                      installments(x)
                    : Number(x.amount)
                )}
              </td>

            </tr>
          `
        )
        .join("");

  }


  if ($("empty")) {

    $("empty").style.display =
      sorted.length
        ? "none"
        : "block";

  }

}


// ============================================================
// FORM SENKRONİZASYONU
// ============================================================

function sync() {

  if (!$("type") || !$("payment")) {
    return;
  }

  const g =
    $("type").value === "Gider";

  const c =
    g &&
    $("payment").value ===
      "Kredi Kartı";


  $("payment").disabled =
    !g;

  if ($("card")) {

    $("card").disabled =
      !c;

  }

  if ($("installmentBox")) {

    $("installmentBox").hidden =
      !c;

  }

  populateCategories();

}


// ============================================================
// KARTLARI YÜKLE
// ============================================================

function populateCards() {

  if (!$("card")) {
    return;
  }

  $("card").innerHTML =
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
// YENİ İŞLEM
// ============================================================

function setupForm() {

  if (!$("form")) {
    return;
  }


  if ($("date")) {

    $("date").value =
      currentMonth() +
      "-" +
      String(
        new Date().getDate()
      ).padStart(2, "0");

  }


  populateCards();
  sync();


  $("type").onchange =
    sync;

  $("payment").onchange =
    sync;


  if ($("installment")) {

    $("installment").onchange =
      () => {

        $("installmentFields").hidden =
          !$("installment").checked;

        if ($("amount")) {
          $("amount").dispatchEvent(
            new Event("input")
          );
        }

      };

  }


  if ($("amount")) {

    $("amount").oninput =
      () => {

        const box =
          $("installmentPreview");

        if (!box) {
          return;
        }

        if (
          !$("installment") ||
          !$("installment").checked
        ) {

          box.textContent = "";

          return;
        }

        const a =
          Number(
            $("amount").value
          );

        const n =
          Number(
            $("installmentCount")?.value
          ) || 1;

        box.textContent =
          a > 0
            ? `Aylık taksit: ${money(a / n)}`
            : "";

      };

  }


  if ($("installmentCount")) {

    $("installmentCount").onchange =
      () => {

        if ($("amount")) {
          $("amount").dispatchEvent(
            new Event("input")
          );
        }

      };

  }


  $("form").onsubmit =
    async e => {

      e.preventDefault();


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
        $("installment")?.checked
          ? Number(
              $("installmentCount").value
            ) || 1
          : 1;


      const newItem = {

        id: Date.now(),

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


      items.push(
        newItem
      );

      saveLocal();


      // Firebase'e de kaydet
      if (currentUser) {

        try {

          await uploadCloud();

        } catch (error) {

          console.error(
            error
          );

          alert(
            "İşlem telefona/bilgisayara kaydedildi fakat Firebase'e gönderilemedi:\n\n" +
            error.message
          );

        }

      }


      $("description").value =
        "";

      $("amount").value =
        "";


      if ($("installment")) {
        $("installment").checked =
          false;
      }

      if ($("installmentFields")) {
        $("installmentFields").hidden =
          true;
      }

      if ($("installmentPreview")) {
        $("installmentPreview").textContent =
          "";
      }


      render();

    };

}


// ============================================================
// SİLME
// ============================================================

function setupDeleteButtons() {

  if ($("clearBtn")) {

    $("clearBtn").onclick =
      async () => {

        const ids =
          [
            ...document.querySelectorAll(
              ".sel:checked"
            )
          ]
            .map(
              x =>
                Number(
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


        items =
          items.filter(
            x =>
              !ids.includes(
                Number(x.id)
              )
          );


        saveLocal();


        if (currentUser) {

          try {
            await uploadCloud();
          } catch (error) {
            console.error(error);
          }

        }


        render();

      };

  }


  if ($("clearAllBtn")) {

    $("clearAllBtn").onclick =
      async () => {

        if (
          !confirm(
            "Tüm kayıtlar silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"
          )
        ) {
          return;
        }


        items = [];

        saveLocal();


        if (currentUser) {

          try {
            await uploadCloud();
          } catch (error) {
            console.error(error);
          }

        }


        render();

      };

  }

}


// ============================================================
// YEDEKLE
// ============================================================

function setupExport() {

  if (!$("exportBtn")) {
    return;
  }

  $("exportBtn").onclick =
    () => {

      const a =
        document.createElement("a");

      const data =
        JSON.stringify(
          {
            items,
            settings
          },
          null,
          2
        );


      const u =
        URL.createObjectURL(
          new Blob(
            [data],
            {
              type:
                "application/json"
            }
          )
        );


      a.href = u;

      a.download =
        "gelir-gider-yedek.json";

      a.click();

      URL.revokeObjectURL(u);

    };

}


// ============================================================
// BAŞLAT
// ============================================================

async function startApp() {

  loadLocal();

  createAuthUI();

  setupForm();

  setupDeleteButtons();

  setupExport();

  render();


  // Firebase kullanıcı durumunu izle
  onAuthStateChanged(
    auth,
    async user => {

      currentUser =
        user || null;

      updateAuthUI(
        currentUser
      );


      if (currentUser) {

        try {

          await syncCloud();

        } catch (error) {

          console.error(
            "Firebase başlangıç hatası:",
            error
          );

        }

        render();

      }

    }
  );

}


// ============================================================
// ÇALIŞTIR
// ============================================================

startApp();
