const KEY = "gelirGiderV4";
const SET = "gelirGiderSettingsV1";

const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmb5RK2NQCBPEv692-lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311790",
  appId: "1:682384311790:web:2ba8621cec98145232faff"
};

const FB_VERSION = "12.18.0";

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

let firebaseApp = null;
let auth = null;
let db = null;
let firebaseReady = false;
let currentUser = null;

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
   LOCAL VERİ
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

  } catch (e) {

    console.error(e);

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
   KREDİ KARTI
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


function ym(d) {

  return String(d).slice(0, 7);

}


function due(x, month) {

  if (!isCard(x)) {
    return 0;
  }

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
      '<option value="Kasa Transferi">Kasa Transferi</option>';

    return;

  }

  const list =
    type === "Gelir"
      ? settings.incomeCategories
      : settings.expenseCategories;

  select.innerHTML =
    list
      .map(
        x =>
          `<option value="${esc(x)}">${esc(x)}</option>`
      )
      .join("");

}


/* =========================================================
   FORM SENKRONİZASYONU
========================================================= */

function sync() {

  if (!$("type")) {
    return;
  }

  const isExpense =
    $("type").value === "Gider";

  const isCardPayment =
    isExpense &&
    $("payment").value === "Kredi Kartı";

  $("payment").disabled =
    !isExpense;

  $("card").disabled =
    !isCardPayment;

  $("installmentBox").hidden =
    !isCardPayment;

  if (!isCardPayment) {

    $("installment").checked =
      false;

    $("installmentFields").hidden =
      true;

    $("installmentPreview").textContent =
      "";

  }

  populateCategories();

}


/* =========================================================
   ANA EKRAN
========================================================= */

function render() {

  const month = currentMonth();
  const label = monthLabel(month);

  const current =
    items.filter(
      x =>
        x.date &&
        x.date.startsWith(month)
    );


  const income =
    current
      .filter(x => x.type === "Gelir")
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
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
        (sum, x) =>
          sum + Number(x.amount || 0),
        0
      );


  const cardExpense =
    items.reduce(
      (sum, x) =>
        sum + due(x, month),
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
        (sum, x) =>
          sum + Number(x.amount || 0),
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


  /* KART ÖZETİ */

  if ($("cardSummary")) {

    $("cardSummary").innerHTML =
      settings.cards
        .map((card, index) => {

          const value =
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
            limit - value;


          return `
            <div>
              <span>
                ${esc(card.name)}
              </span>

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

        })
        .join("");

  }


  /* AYLIK ÖZET */

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


  /* İŞLEM LİSTESİ */

  const sorted =
    current
      .slice()
      .sort(
        (a, b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
          ||
          Number(b.id) -
          Number(a.id)
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
                      x.card.slice(1)
                    )
                  ]?.name || "-"
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


          const amount =
            isCard(x)
              ? Number(x.amount) /
                installments(x)
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
                ${esc(installmentText)}
              </td>

              <td class="amount">
                ${money(amount)}
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
   FIREBASE BAŞLATMA
========================================================= */

async function initFirebase() {

  try {

    const firebase =
      await import(
        `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`
      );


    firebaseApp =
      firebase.initializeApp(
        firebaseConfig
      );


    const authModule =
      await import(
        `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`
      );


    /*
      BURADA getAuth KULLANIYORUZ.

      initializeAuth + popup kombinasyonunu
      tamamen kaldırdık.
    */

    auth =
      authModule.getAuth(
        firebaseApp
      );


    await authModule.setPersistence(
      auth,
      authModule.browserLocalPersistence
    );


    firebaseReady = true;


    createLoginButton(
      authModule
    );


    /*
      REDIRECT SONUCUNU KONTROL ET
    */

    try {

      await authModule.getRedirectResult(
        auth
      );

    } catch (error) {

      console.error(
        "Redirect sonucu:",
        error
      );

      if (
        error &&
        error.code
      ) {

        console.error(
          "Firebase kodu:",
          error.code
        );

      }

    }


    /*
      OTURUM DURUMU
    */

    authModule.onAuthStateChanged(
      auth,
      async user => {

        currentUser =
          user;

        updateLoginButton();


        if (user) {

          createStatus(
            "Google hesabına giriş yapıldı."
          );


          await loadCloud();

        } else {

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
      "Firebase bağlantısı kurulamadı."
    );

    render();

  }

}


/* =========================================================
   FIRESTORE
========================================================= */

async function firestoreModule() {

  return await import(
    `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`
  );

}


async function loadCloud() {

  if (!currentUser) {
    render();
    return;
  }


  try {

    const firestore =
      await firestoreModule();


    if (!db) {

      db =
        firestore.getFirestore(
          firebaseApp
        );

    }


    const reference =
      firestore.doc(
        db,
        "users",
        currentUser.uid,
        "data",
        "main"
      );


    const snapshot =
      await firestore.getDoc(
        reference
      );


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

      render();

      createStatus(
        "Bulut verileri yüklendi."
      );

    } else {

      await saveCloud();

    }


  } catch (error) {

    console.error(
      "Firestore okuma hatası:",
      error
    );


    alert(
      "Google girişi başarılı fakat Firestore okunamadı.\n\n" +
      error.message
    );

  }

}


async function saveCloud() {

  saveLocal();

  render();


  if (
    !firebaseReady ||
    !currentUser
  ) {

    return;

  }


  try {

    const firestore =
      await firestoreModule();


    if (!db) {

      db =
        firestore.getFirestore(
          firebaseApp
        );

    }


    const reference =
      firestore.doc(
        db,
        "users",
        currentUser.uid,
        "data",
        "main"
      );


    await firestore.setDoc(
      reference,
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
      "Firestore yazma hatası:",
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

function createLoginButton(authModule) {

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
    $("firebaseLogin")
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

        /*
          POPUP YOK.

          REDIRECT KULLANIYORUZ.
        */

        const provider =
          new authModule.GoogleAuthProvider();


        provider.setCustomParameters({
          prompt: "select_account"
        });


        await authModule.signInWithRedirect(
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
          error.code +
          "\n\n" +
          error.message
        );

      }

    };


  actions.appendChild(
    button
  );

}


/* =========================================================
   GİRİŞ BUTONU
========================================================= */

function updateLoginButton() {

  const button =
    $("firebaseLogin");

  if (!button) {
    return;
  }


  if (currentUser) {

    button.textContent =
      "Çıkış · " +
      (
        currentUser.displayName ||
        currentUser.email ||
        "Google"
      );

    button.onclick =
      async () => {

        try {

          const authModule =
            await import(
              `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`
            );


          await authModule.signOut(
            auth
          );


          currentUser =
            null;

          updateLoginButton();

          render();


        } catch (error) {

          alert(
            "Çıkış yapılamadı:\n\n" +
            error.message
          );

        }

      };

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
   FORM
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

      $("installmentFields").hidden =
        !$("installment").checked;


      if ($("amount")) {
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
              $("installmentCount").value
            ) || 1
          : 1;


      items.push({

        id:
          Date.now(),

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
          type === "Kasa Transferi"
            ? "Kasa Transferi"
            : $("category").value,

        amount:
          amount,

        installments:
          count

      });


      $("description").value =
        "";

      $("amount").value =
        "";

      $("installment").checked =
        false;

      $("installmentFields").hidden =
        true;

      $("installmentPreview").textContent =
        "";


      await saveCloud();

    };

}


/* =========================================================
   SEÇİLİ SİL
========================================================= */

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


      await saveCloud();

    };

}


/* =========================================================
   TÜMÜNÜ SİL
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


if ($("date")) {

  $("date").value =
    currentMonth() +
    "-" +
    String(
      new Date().getDate()
    ).padStart(2, "0");

}


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


sync();

render();

initFirebase();
