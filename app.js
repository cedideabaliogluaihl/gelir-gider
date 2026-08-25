const KEY = "gelirGiderV4";
const SET = "gelirGiderSettingsV1";

/* =========================================================
   FIREBASE AYARLARI
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmb5RK2NQCBPEv692-lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311790",
  appId: "1:682384311790:web:2ba8621cec98145232faff"
};

/* Firebase SDK sürümü */
const FB_VERSION = "12.16.0";


/* =========================================================
   UYGULAMA VERİLERİ
========================================================= */

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


/* =========================================================
   FIREBASE DEĞİŞKENLERİ
========================================================= */

let firebaseReady = false;
let currentUser = null;

let firebaseApp = null;
let auth = null;
let db = null;


/* =========================================================
   KISA FONKSİYONLAR
========================================================= */

const $ = id => document.getElementById(id);


const money = n =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(Number(n) || 0);


const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));


/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadLocal() {

  try {

    items = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );

    settings = JSON.parse(
      localStorage.getItem(SET) ||
      JSON.stringify(settings)
    );

  } catch (error) {

    console.error(
      "Local kayıt okunamadı:",
      error
    );

    items = [];

    settings = {
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
  }


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
    settings.incomeCategories.length === 0
  ) {

    settings.incomeCategories = [
      "Maaş",
      "Ek Ders",
      "Diğer Gelir"
    ];
  }


  if (
    !Array.isArray(settings.expenseCategories) ||
    settings.expenseCategories.length === 0
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


/* =========================================================
   KREDİ KARTI / TAKSİT HESAPLARI
========================================================= */

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


function ym(date) {

  return String(date).slice(0, 7);
}


function due(x, month) {

  if (!isCard(x)) {
    return 0;
  }


  const startMonth = ym(x.date);

  const diff =
    (
      Number(month.slice(0, 4)) -
      Number(startMonth.slice(0, 4))
    ) * 12
    +
    (
      Number(month.slice(5)) -
      Number(startMonth.slice(5))
    );


  if (
    diff >= 0 &&
    diff < installments(x)
  ) {

    return (
      Number(x.amount) /
      installments(x)
    );
  }


  return 0;
}


/* =========================================================
   TARİH
========================================================= */

function currentMonth() {

  return new Date()
    .toISOString()
    .slice(0, 7);
}


function monthLabel(month) {

  return new Date(
    month + "-01T00:00:00"
  ).toLocaleDateString(
    "tr-TR",
    {
      month: "long",
      year: "numeric"
    }
  );
}


/* =========================================================
   KATEGORİLER
========================================================= */

function populateCategories() {

  const type = $("type")?.value;

  const select = $("category");

  if (!select) {
    return;
  }


  if (type === "Kasa Transferi") {

    select.innerHTML =
      `<option value="Kasa Transferi">
        Kasa Transferi
      </option>`;

    return;
  }


  const categories =
    type === "Gelir"
      ? settings.incomeCategories
      : settings.expenseCategories;


  select.innerHTML =
    categories
      .map(
        category =>
          `<option value="${esc(category)}">
            ${esc(category)}
          </option>`
      )
      .join("");
}


/* =========================================================
   ANA EKRAN
========================================================= */

function render() {

  const month = currentMonth();

  const label = monthLabel(month);


  const currentItems =
    items.filter(
      x =>
        x.date &&
        x.date.startsWith(month)
    );


  /* GELİR */

  const income =
    currentItems
      .filter(
        x => x.type === "Gelir"
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );


  /* NAKİT GİDER */

  const cashExpense =
    currentItems
      .filter(
        x =>
          x.type === "Gider" &&
          !isCard(x)
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );


  /* KREDİ KARTI GİDER */

  const cardExpense =
    items.reduce(
      (sum, x) =>
        sum + due(x, month),
      0
    );


  const expense =
    cashExpense +
    cardExpense;


  /* KASA TRANSFERİ */

  const transfer =
    currentItems
      .filter(
        x =>
          x.type ===
          "Kasa Transferi"
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );


  /* ÖZET */

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


  /* =====================================================
     KREDİ KARTI ÖZETİ
  ===================================================== */

  if ($("cardSummary")) {

    $("cardSummary").innerHTML =
      settings.cards
        .map((card, index) => {

          const cardValue =
            items.reduce(
              (sum, x) => {

                if (
                  x.card !==
                  "c" + index
                ) {

                  return sum;
                }

                return (
                  sum +
                  due(x, month)
                );
              },
              0
            );


          const limit =
            Number(card.limit) || 0;


          const remaining =
            limit -
            cardValue;


          return `
            <div>

              <span>
                ${esc(card.name)}
              </span>

              <strong>
                ${money(cardValue)}
              </strong>

              <small>
                Bu ay harcama
              </small>

              <small>
                Limit:
                ${money(limit)}
                · Kalan:
                ${money(remaining)}
              </small>

            </div>
          `;

        })
        .join("");
  }


  /* =====================================================
     AYLIK ÖZET
  ===================================================== */

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


  /* =====================================================
     İŞLEMLER
  ===================================================== */

  const sorted =
    currentItems
      .slice()
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
          ||
          (
            Number(b.id) -
            Number(a.id)
          )
      );


  if ($("list")) {

    $("list").innerHTML =
      sorted
        .map(x => {

          const rowClass =
            x.type === "Gelir"
              ? "income"
              : x.type === "Gider"
                ? "expense"
                : "transfer";


          const cardName =
            isCard(x)
              ? (
                  settings.cards[
                    Number(
                      x.card
                        .slice(1)
                    )
                  ]?.name ||
                  "-"
                )
              : "-";


          const installmentText =
            isCard(x)
              ? (
                  installments(x) > 1
                    ? installments(x) +
                      " taksit"
                    : "Tek çekim"
                )
              : "-";


          const displayAmount =
            isCard(x)
              ? (
                  Number(x.amount) /
                  installments(x)
                )
              : Number(x.amount);


          return `
            <tr class="${rowClass}">

              <td>
                <input
                  class="sel"
                  type="checkbox"
                  data-id="${x.id}">
              </td>

              <td>
                ${
                  new Date(
                    x.date +
                    "T00:00:00"
                  ).toLocaleDateString(
                    "tr-TR"
                  )
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
                ${esc(cardName)}
              </td>

              <td>
                ${esc(
                  installmentText
                )}
              </td>

              <td class="amount">
                ${money(displayAmount)}
              </td>

            </tr>
          `;

        })
        .join("");
  }


  if ($("empty")) {

    $("empty").style.display =
      sorted.length
        ? "none"
        : "block";
  }
}


/* =========================================================
   FORM GÖRÜNÜMÜ
========================================================= */

function sync() {

  if (!$("type")) {
    return;
  }


  const isExpense =
    $("type").value === "Gider";


  const isCreditCard =
    isExpense &&
    $("payment").value ===
    "Kredi Kartı";


  $("payment").disabled =
    !isExpense;


  $("card").disabled =
    !isCreditCard;


  $("installmentBox").hidden =
    !isCreditCard;


  if (!isCreditCard) {

    $("installment").checked =
      false;

    $("installmentFields").hidden =
      true;

    $("installmentPreview")
      .textContent = "";
  }


  populateCategories();
}


/* =========================================================
   FIREBASE BAŞLAT
========================================================= */

async function initializeFirebase() {

  try {

    /* ---------------------------------------------
       FIREBASE CORE
    --------------------------------------------- */

    const {
      initializeApp
    } = await import(
      `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`
    );


    firebaseApp =
      initializeApp(
        firebaseConfig
      );


    /* ---------------------------------------------
       AUTH
    --------------------------------------------- */

    const {
      initializeAuth,
      browserLocalPersistence,
      GoogleAuthProvider,
      signInWithPopup,
      signOut,
      onAuthStateChanged
    } = await import(
      `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`
    );


    /*
      ÖNEMLİ:

      IndexedDB yerine browserLocalPersistence
      kullanıyoruz.

      Böylece Google popup açıldığında
      "Database is closing/hidden" sorununa
      takılmıyoruz.
    */

    auth =
      initializeAuth(
        firebaseApp,
        {
          persistence:
            browserLocalPersistence
        }
      );


    firebaseReady = true;


    /* ---------------------------------------------
       GİRİŞ BUTONU
    --------------------------------------------- */

    createLoginButton(
      GoogleAuthProvider,
      signInWithPopup,
      signOut
    );


    /* ---------------------------------------------
       KULLANICI DURUMU
    --------------------------------------------- */

    onAuthStateChanged(
      auth,
      async user => {

        currentUser = user;

        updateLoginButton();


        if (user) {

          createStatus(
            "Google hesabına giriş yapıldı."
          );


          await loadCloudData();

        } else {

          createStatus(
            "Yerel mod aktif."
          );

          render();
        }

      }
    );


  } catch (error) {

    console.error(
      "Firebase başlatma hatası:",
      error
    );


    createStatus(
      "Firebase başlatılamadı. Yerel kayıt kullanılacak."
    );


    render();
  }
}


/* =========================================================
   FIRESTORE MODÜLÜ
========================================================= */

async function getFirestoreModule() {

  return await import(
    `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`
  );
}


/* =========================================================
   FIRESTORE'DAN VERİ OKU
========================================================= */

async function loadCloudData() {

  if (!currentUser) {
    render();
    return;
  }


  try {

    const {
      getFirestore,
      doc,
      getDoc
    } = await getFirestoreModule();


    if (!db) {

      db =
        getFirestore(
          firebaseApp
        );
    }


    const ref =
      doc(
        db,
        "users",
        currentUser.uid,
        "data",
        "main"
      );


    const snapshot =
      await getDoc(ref);


    if (snapshot.exists()) {

      const data =
        snapshot.data();


      if (
        Array.isArray(
          data.items
        )
      ) {

        items =
          data.items;
      }


      if (
        data.settings &&
        typeof data.settings ===
        "object"
      ) {

        settings = {
          ...settings,
          ...data.settings
        };
      }


      saveLocal();


      createStatus(
        "Bulut verileri yüklendi."
      );

    } else {

      await saveCloud();

    }


    render();


  } catch (error) {

    console.error(
      "Firestore okuma hatası:",
      error
    );


    alert(
      "Firebase bağlantısı var fakat Firestore verisi okunamadı.\n\n" +
      error.message
    );


    render();
  }
}


/* =========================================================
   FIRESTORE'A VERİ KAYDET
========================================================= */

async function saveCloud() {

  /* Önce bilgisayara kaydet */
  saveLocal();

  render();


  /* Google girişi yoksa sadece yerel kayıt */
  if (
    !firebaseReady ||
    !currentUser
  ) {

    return;
  }


  try {

    const {
      getFirestore,
      doc,
      setDoc
    } = await getFirestoreModule();


    if (!db) {

      db =
        getFirestore(
          firebaseApp
        );
    }


    const ref =
      doc(
        db,
        "users",
        currentUser.uid,
        "data",
        "main"
      );


    await setDoc(
      ref,
      {
        items: items,
        settings: settings,
        updatedAt:
          new Date().toISOString()
      },
      {
        merge: true
      }
    );


    createStatus(
      "✓ Buluta kaydedildi."
    );


  } catch (error) {

    console.error(
      "Firestore kayıt hatası:",
      error
    );


    alert(
      "Buluta kayıt yapılamadı.\n\n" +
      error.message
    );
  }
}


/* =========================================================
   GOOGLE GİRİŞ BUTONU
========================================================= */

function createLoginButton(
  GoogleAuthProvider,
  signInWithPopup,
  signOut
) {

  const header =
    document.querySelector(
      "header"
    );


  if (!header) {
    return;
  }


  const actions =
    header.querySelector(
      ".header-actions"
    );


  if (!actions) {
    return;
  }


  if (
    document.getElementById(
      "firebaseLogin"
    )
  ) {

    return;
  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "firebaseLogin";


  button.className =
    "ghost";


  button.textContent =
    "Google ile Giriş";


  button.onclick =
    async () => {

      try {

        /* ---------------------------------
           ÇIKIŞ
        --------------------------------- */

        if (currentUser) {

          await signOut(auth);

          createStatus(
            "Çıkış yapıldı."
          );

          return;
        }


        /* ---------------------------------
           GOOGLE GİRİŞ
        --------------------------------- */

        const provider =
          new GoogleAuthProvider();


        provider.setCustomParameters({
          prompt: "select_account"
        });


        await signInWithPopup(
          auth,
          provider
        );


      } catch (error) {

        console.error(
          "Google giriş hatası:",
          error
        );


        alert(
          "Giriş işlemi başarısız:\n\n" +
          error.message
        );
      }
    };


  actions.appendChild(
    button
  );
}


/* =========================================================
   GİRİŞ BUTONU DURUMU
========================================================= */

function updateLoginButton() {

  const button =
    $("firebaseLogin");


  if (!button) {
    return;
  }


  if (currentUser) {

    const name =
      currentUser.displayName ||
      currentUser.email ||
      "Google";


    button.textContent =
      "Çıkış · " + name;

  } else {

    button.textContent =
      "Google ile Giriş";
  }
}


/* =========================================================
   DURUM MESAJI
========================================================= */

function createStatus(text) {

  let box =
    $("firebaseStatus");


  if (!box) {

    box =
      document.createElement(
        "div"
      );


    box.id =
      "firebaseStatus";


    box.style.cssText = `
      position:fixed;
      right:15px;
      bottom:15px;
      z-index:99999;
      background:#1f4e78;
      color:white;
      padding:10px 15px;
      border-radius:8px;
      font-size:13px;
      box-shadow:0 3px 12px rgba(0,0,0,.25);
    `;


    document.body.appendChild(
      box
    );
  }


  box.textContent =
    text;


  clearTimeout(
    box._timer
  );


  box._timer =
    setTimeout(
      () => {

        if (box.parentNode) {
          box.remove();
        }

      },
      3000
    );
}


/* =========================================================
   FORM OLAYLARI
========================================================= */

if ($("type")) {

  $("type").onchange =
    sync;
}


if ($("payment")) {

  $("payment").onchange =
    sync;
}


if ($("installment")) {

  $("installment").onchange =
    () => {

      $("installmentFields")
        .hidden =
        !$("installment").checked;


      if (
        $("amount") &&
        $("amount").value
      ) {

        $("amount").oninput();
      }
    };
}


if ($("amount")) {

  $("amount").oninput =
    () => {

      const preview =
        $("installmentPreview");


      if (
        !$("installment").checked
      ) {

        preview.textContent =
          "";

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


      preview.textContent =
        amount > 0
          ? `Aylık taksit: ${money(
              amount / count
            )}`
          : "";
    };
}


if ($("installmentCount")) {

  $("installmentCount").onchange =
    () => {

      if ($("amount")) {
        $("amount").oninput();
      }
    };
}


/* =========================================================
   YENİ İŞLEM
========================================================= */

if ($("form")) {

  $("form").onsubmit =
    async event => {

      event.preventDefault();


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


      /* ---------------------------------
         KONTROLLER
      --------------------------------- */

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
        payment ===
        "Kredi Kartı" &&
        !card
      ) {

        alert(
          "Kart seç."
        );

        return;
      }


      /* ---------------------------------
         TAKSİT
      --------------------------------- */

      const count =
        payment ===
        "Kredi Kartı" &&
        $("installment").checked
          ? Number(
              $("installmentCount")
                .value
            ) || 1
          : 1;


      /* ---------------------------------
         KAYIT
      --------------------------------- */

      items.push({

        id: Date.now(),

        date:
          $("date").value,

        description:

          description,

        type:
          type,

        payment:
          payment,

        card:
          card,

        category:
          type ===
          "Kasa Transferi"
            ? "Kasa Transferi"
            : $("category").value,

        amount:
          amount,

        installments:
          count
      });


      /* ---------------------------------
         FORMU TEMİZLE
      --------------------------------- */

      $("description")
        .value = "";


      $("amount")
        .value = "";


      $("installment")
        .checked = false;


      $("installmentFields")
        .hidden = true;


      $("installmentPreview")
        .textContent = "";


      /* ---------------------------------
         FIREBASE + LOCAL
      --------------------------------- */

      await saveCloud();
    };
}


/* =========================================================
   SEÇİLİ İŞLEMLERİ SİL
========================================================= */

if ($("clearBtn")) {

  $("clearBtn").onclick =
    async () => {

      const ids =
        [
          ...document
            .querySelectorAll(
              ".sel:checked"
            )
        ]
        .map(
          checkbox =>
            Number(
              checkbox.dataset.id
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
          item =>
            !ids.includes(
              Number(item.id)
            )
        );


      await saveCloud();
    };
}


/* =========================================================
   TÜM KAYITLARI SİL
========================================================= */

if ($("clearAllBtn")) {

  $("clearAllBtn").onclick =
    async () => {

      if (
        !confirm(
          "Tüm kayıtlar silinecek.\n\n" +
          "Bu işlem geri alınamaz.\n\n" +
          "Devam edilsin mi?"
        )
      ) {

        return;
      }


      items = [];


      await saveCloud();
    };
}


/* =========================================================
   YEDEKLE
========================================================= */

if ($("exportBtn")) {

  $("exportBtn").onclick =
    () => {

      const link =
        document.createElement(
          "a"
        );


      const blob =
        new Blob(
          [
            JSON.stringify(
              items,
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


      link.href =
        url;


      link.download =
        "gelir-gider-yedek.json";


      link.click();


      URL.revokeObjectURL(
        url
      );
    };
}


/* =========================================================
   BAŞLANGIÇ
========================================================= */

loadLocal();


/* Tarih */

if ($("date")) {

  $("date").value =
    currentMonth() +
    "-" +
    String(
      new Date().getDate()
    ).padStart(2, "0");
}


/* Kartlar */

if ($("card")) {

  $("card").innerHTML =
    '<option value="">Kart seç</option>' +

    settings.cards
      .map(
        (card, index) =>
          `<option value="c${index}">
            ${esc(card.name)}
          </option>`
      )
      .join("");
}


/* İlk görünüm */

sync();

render();


/* Firebase */

initializeFirebase();
