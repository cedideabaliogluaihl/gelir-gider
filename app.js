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

let items = [];
let settings = {
  cards: [
    {name:"Kart 1",limit:0},
    {name:"Kart 2",limit:0},
    {name:"Kart 3",limit:0}
  ],
  incomeCategories:["Maaş","Ek Ders","Diğer Gelir"],
  expenseCategories:["Kira","Market","Fatura","Yakıt","Nakit","Diğer Gider"]
};

let firebaseReady = false;
let currentUser = null;
let db = null;
let auth = null;

const $ = id => document.getElementById(id);

const money = n =>
  new Intl.NumberFormat("tr-TR", {
    style:"currency",
    currency:"TRY",
    maximumFractionDigits:2
  }).format(n);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));

function localLoad(){
  try{
    items = JSON.parse(localStorage.getItem(KEY) || "[]");
    settings = JSON.parse(
      localStorage.getItem(SET) || JSON.stringify(settings)
    );
  }catch{}

  if(!Array.isArray(items)) items=[];

  if(!settings.cards || settings.cards.length!==3){
    settings.cards=[
      {name:"Kart 1",limit:0},
      {name:"Kart 2",limit:0},
      {name:"Kart 3",limit:0}
    ];
  }

  if(!Array.isArray(settings.incomeCategories) ||
     !settings.incomeCategories.length){
    settings.incomeCategories=["Maaş","Ek Ders","Diğer Gelir"];
  }

  if(!Array.isArray(settings.expenseCategories) ||
     !settings.expenseCategories.length){
    settings.expenseCategories=[
      "Kira","Market","Fatura","Yakıt","Nakit","Diğer Gider"
    ];
  }
}

function localSave(){
  localStorage.setItem(KEY,JSON.stringify(items));
  localStorage.setItem(SET,JSON.stringify(settings));
}

function isCard(x){
  return x.type==="Gider" &&
         x.payment==="Kredi Kartı" &&
         x.card?.startsWith("c");
}

function installments(x){
  return Math.max(1,Number(x.installments)||1);
}

function ym(d){
  return String(d).slice(0,7);
}

function due(x,m){
  if(!isCard(x)) return 0;

  const s=ym(x.date);

  const diff =
    (+m.slice(0,4)-+s.slice(0,4))*12 +
    (+m.slice(5)-+s.slice(5));

  return diff>=0 && diff<installments(x)
    ? x.amount/installments(x)
    : 0;
}

function currentMonth(){
  return new Date().toISOString().slice(0,7);
}

function monthLabel(m){
  return new Date(m+"-01T00:00:00")
    .toLocaleDateString("tr-TR",{
      month:"long",
      year:"numeric"
    });
}

function populateCategories(){
  const type=$("type")?.value;
  const sel=$("category");

  if(!sel) return;

  if(type==="Kasa Transferi"){
    sel.innerHTML="<option>Kasa Transferi</option>";
    return;
  }

  const arr =
    type==="Gelir"
      ? settings.incomeCategories
      : settings.expenseCategories;

  sel.innerHTML =
    arr.map(x=>`<option>${esc(x)}</option>`).join("");
}

function render(){

  const m=currentMonth();
  const label=monthLabel(m);

  const current =
    items.filter(x=>x.date?.startsWith(m));

  const income =
    current
      .filter(x=>x.type==="Gelir")
      .reduce((s,x)=>s+x.amount,0);

  const cashExpense =
    current
      .filter(x=>x.type==="Gider" && !isCard(x))
      .reduce((s,x)=>s+x.amount,0);

  const cardExpense =
    items.reduce((s,x)=>s+due(x,m),0);

  const expense=cashExpense+cardExpense;

  const transfer =
    current
      .filter(x=>x.type==="Kasa Transferi")
      .reduce((s,x)=>s+x.amount,0);

  if($("totalIncome"))
    $("totalIncome").textContent=money(income);

  if($("totalExpense"))
    $("totalExpense").textContent=money(expense);

  if($("net"))
    $("net").textContent=money(income-expense-transfer);

  if($("totalTransfer"))
    $("totalTransfer").textContent=money(transfer);

  if($("currentMonthLabel"))
    $("currentMonthLabel").textContent=label;

  if($("transactionsTitle"))
    $("transactionsTitle").textContent=`${label} İşlemleri`;

  if($("cardSummary")){
    $("cardSummary").innerHTML =
      settings.cards.map((c,i)=>{

        const value =
          items.reduce(
            (s,x)=>
              s+due(x,m)*(x.card==="c"+i),
            0
          );

        const limit=Number(c.limit)||0;
        const remaining=limit-value;

        return `
        <div>
          <span>${esc(c.name)}</span>
          <strong>${money(value)}</strong>
          <small>Bu ay harcama</small>
          <small>
            Limit: ${money(limit)}
            · Kalan: ${money(remaining)}
          </small>
        </div>`;
      }).join("");
  }

  if($("monthIncome"))
    $("monthIncome").textContent=money(income);

  if($("monthExpense"))
    $("monthExpense").textContent=money(expense);

  if($("monthNet"))
    $("monthNet").textContent=money(income-expense-transfer);

  if($("monthTransfer"))
    $("monthTransfer").textContent=money(transfer);

  const sorted =
    current
      .slice()
      .sort((a,b)=>
        b.date.localeCompare(a.date) ||
        (b.id-a.id)
      );

  if($("list")){
    $("list").innerHTML =
      sorted.map(x=>`

      <tr class="${
        x.type==="Gelir"
          ?"income"
          :x.type==="Gider"
            ?"expense"
            :"transfer"
      }">

        <td>
          <input
            class="sel"
            type="checkbox"
            data-id="${x.id}">
        </td>

        <td>
          ${new Date(
            x.date+"T00:00:00"
          ).toLocaleDateString("tr-TR")}
        </td>

        <td>${esc(x.description)}</td>

        <td>${esc(x.category||"Genel")}</td>

        <td>${esc(x.type)}</td>

        <td>${esc(x.payment||"-")}</td>

        <td>
          ${
            isCard(x)
              ? esc(
                  settings.cards[
                    +x.card.slice(1)
                  ]?.name || "-"
                )
              : "-"
          }
        </td>

        <td>
          ${
            isCard(x)
              ? installments(x)>1
                ? installments(x)+" taksit"
                : "Tek çekim"
              : "-"
          }
        </td>

        <td class="amount">
          ${money(
            isCard(x)
              ? x.amount/installments(x)
              : x.amount
          )}
        </td>

      </tr>
      `).join("");
  }

  if($("empty"))
    $("empty").style.display =
      sorted.length ? "none" : "block";
}

function sync(){

  if(!$("type")) return;

  const g=$("type").value==="Gider";
  const c=
    g &&
    $("payment").value==="Kredi Kartı";

  $("payment").disabled=!g;
  $("card").disabled=!c;

  $("installmentBox").hidden=!c;

  populateCategories();
}

async function firebaseInit(){

  try{

    const {
      initializeApp
    } = await import(
      "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"
    );

    const {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      signOut,
      onAuthStateChanged
    } = await import(
      "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"
    );

    const firestore =
      await import(
        "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js"
      );

    const app=initializeApp(firebaseConfig);

    auth=getAuth(app);
    db=firestore.getFirestore(app);

    const {
      doc,
      getDoc,
      setDoc
    }=firestore;

    firebaseReady=true;

    createLoginUI(
      GoogleAuthProvider,
      signInWithPopup,
      signOut
    );

    onAuthStateChanged(auth,async user=>{

      currentUser=user;

      updateLoginUI();

      if(user){

        await loadCloudData(
          user,
          doc,
          getDoc,
          setDoc
        );

      }else{

        render();

      }

    });

  }catch(error){

    console.error("Firebase başlatılamadı:",error);

    createStatus(
      "Firebase bağlantısı kurulamadı. Yerel kayıt modu aktif."
    );
  }
}

async function loadCloudData(
  user,
  doc,
  getDoc,
  setDoc
){

  try{

    const ref=doc(
      db,
      "users",
      user.uid,
      "data",
      "main"
    );

    const snap=await getDoc(ref);

    if(snap.exists()){

      const data=snap.data();

      if(Array.isArray(data.items))
        items=data.items;

      if(data.settings)
        settings={
          ...settings,
          ...data.settings
        };

      localSave();

    }else{

      await setDoc(ref,{
        items,
        settings,
        updatedAt:new Date().toISOString()
      });

    }

    render();

  }catch(error){

    console.error(
      "Cloud veri okunamadı:",
      error
    );

    alert(
      "Firebase bağlantısı var fakat veriler okunamadı. Firestore kurallarını kontrol et."
    );
  }
}

async function saveCloud(){

  localSave();

  render();

  if(!firebaseReady || !currentUser || !db)
    return;

  try{

    const {
      doc,
      setDoc
    }=await import(
      "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js"
    );

    await setDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "data",
        "main"
      ),
      {
        items,
        settings,
        updatedAt:new Date().toISOString()
      },
      {merge:true}
    );

    createStatus("Buluta kaydedildi.");

  }catch(error){

    console.error(
      "Firebase kayıt hatası:",
      error
    );

    alert(
      "Buluta kayıt yapılamadı: "+error.message
    );
  }
}

function createLoginUI(
  GoogleAuthProvider,
  signInWithPopup,
  signOut
){

  const header=document.querySelector("header");

  if(!header) return;

  const actions=
    header.querySelector(".header-actions");

  if(!actions) return;

  if(document.getElementById("firebaseLogin"))
    return;

  const btn=document.createElement("button");

  btn.id="firebaseLogin";
  btn.className="ghost";
  btn.textContent="Google ile Giriş";

  btn.onclick=async()=>{

    try{

      if(currentUser){

        await signOut(auth);

      }else{

        const provider=
          new GoogleAuthProvider();

        await signInWithPopup(
          auth,
          provider
        );

      }

    }catch(error){

      console.error(error);

      alert(
        "Giriş işlemi başarısız: "+
        error.message
      );
    }
  };

  actions.appendChild(btn);
}

function updateLoginUI(){

  const btn=$("firebaseLogin");

  if(!btn) return;

  if(currentUser){

    btn.textContent=
      "Çıkış · "+
      (currentUser.displayName ||
       currentUser.email ||
       "Google");

  }else{

    btn.textContent="Google ile Giriş";
  }
}

function createStatus(text){

  let el=$("firebaseStatus");

  if(!el){

    el=document.createElement("div");

    el.id="firebaseStatus";

    el.style.cssText=`
      position:fixed;
      bottom:15px;
      right:15px;
      z-index:9999;
      background:#1f4e78;
      color:white;
      padding:10px 14px;
      border-radius:8px;
      font-size:13px;
      box-shadow:0 3px 12px rgba(0,0,0,.2);
    `;

    document.body.appendChild(el);
  }

  el.textContent=text;

  setTimeout(()=>{
    el.remove();
  },2500);
}

if($("type"))
  $("type").onchange=sync;

if($("payment"))
  $("payment").onchange=sync;

if($("installment"))
  $("installment").onchange=()=>{
    $("installmentFields").hidden=
      !$("installment").checked;
  };

if($("amount"))
  $("amount").oninput=()=>{

    const box=$("installmentPreview");

    if(!$("installment").checked){

      box.textContent="";
      return;
    }

    const a=Number($("amount").value);

    const n=
      Number($("installmentCount").value)||1;

    box.textContent=
      a>0
        ?`Aylık taksit: ${money(a/n)}`
        :"";
  };

if($("installmentCount"))
  $("installmentCount").onchange=
    $("amount")?.oninput;

if($("form")){

  $("form").onsubmit=async e=>{

    e.preventDefault();

    const type=$("type").value;

    const amount=
      Number($("amount").value);

    const payment=
      type==="Gider"
        ?$("payment").value
        :"";

    const card=
      payment==="Kredi Kartı"
        ?$("card").value
        :"";

    const description=
      $("description").value.trim();

    if(!description)
      return alert("Açıklama gir.");

    if(!amount || amount<=0)
      return alert("Geçerli tutar gir.");

    if(
      (type==="Gelir" ||
       type==="Gider") &&
      !$("category").value
    )
      return alert("Kategori seç.");

    if(
      payment==="Kredi Kartı" &&
      !card
    )
      return alert("Kart seç.");

    const count=
      payment==="Kredi Kartı" &&
      $("installment").checked
        ?Number(
            $("installmentCount").value
          )||1
        :1;

    items.push({

      id:Date.now(),

      date:$("date").value,

      description,

      type,

      payment,

      card,

      category:
        type==="Kasa Transferi"
          ?"Kasa Transferi"
          :$("category").value,

      amount,

      installments:count
    });

    $("description").value="";
    $("amount").value="";

    $("installment").checked=false;

    $("installmentFields").hidden=true;

    $("installmentPreview").textContent="";

    await saveCloud();
  };
}

if($("clearBtn")){

  $("clearBtn").onclick=async()=>{

    const ids=
      [...document.querySelectorAll(".sel:checked")]
      .map(x=>+x.dataset.id);

    if(!ids.length)
      return alert("Silmek için işlem seç.");

    if(
      confirm(
        "Seçili işlemler silinsin mi?"
      )
    ){

      items=
        items.filter(
          x=>!ids.includes(x.id)
        );

      await saveCloud();
    }
  };
}

if($("clearAllBtn")){

  $("clearAllBtn").onclick=async()=>{

    if(
      confirm(
        "Tüm kayıtlar silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"
      )
    ){

      items=[];

      await saveCloud();
    }
  };
}

if($("exportBtn")){

  $("exportBtn").onclick=()=>{

    const a=document.createElement("a");

    const u=
      URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              items,
              null,
              2
            )
          ],
          {
            type:"application/json"
          }
        )
      );

    a.href=u;

    a.download=
      "gelir-gider-yedek.json";

    a.click();

    URL.revokeObjectURL(u);
  };
}

localLoad();

if($("date")){

  $("date").value=
    currentMonth()+
    "-" +
    String(
      new Date().getDate()
    ).padStart(2,"0");
}

if($("card")){

  $("card").innerHTML=
    '<option value="">Kart seç</option>'+
    settings.cards.map(
      (c,i)=>
        `<option value="c${i}">
          ${esc(c.name)}
        </option>`
    ).join("");
}

sync();
render();
firebaseInit();
