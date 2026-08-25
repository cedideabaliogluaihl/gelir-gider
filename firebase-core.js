import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Firebase Console > Project settings > Your apps > Web app bölümündeki config.
// Bu değerler Firebase web uygulaması için kullanılan istemci bilgileridir.
const firebaseConfig = {
  apiKey: "AIzaSyC8Pk7DCPwmbSRK2NQCBPEV692-Lzeeo4c",
  authDomain: "gelir-gider-546b4.firebaseapp.com",
  projectId: "gelir-gider-546b4",
  storageBucket: "gelir-gider-546b4.firebasestorage.app",
  messagingSenderId: "682384311796",
  appId: "1:682384311796:web:2ba8621cec98145232faff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const ITEMS_KEY = "gelirGiderV4";
const SETTINGS_KEY = "gelirGiderSettingsV1";
const defaultSettings = {
  cards:[{name:"Kart 1",limit:0},{name:"Kart 2",limit:0},{name:"Kart 3",limit:0}],
  incomeCategories:["Maaş","Ek Ders","Diğer Gelir"],
  expenseCategories:["Kira","Market","Fatura","Yakıt","Nakit","Diğer Gider"]
};

let user = null;
let dataCache = { items: [], settings: structuredClone(defaultSettings), exists: false };
let readyPromise;

const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));

function normalizeSettings(s){
  s = s && typeof s === "object" ? s : {};
  const cards = Array.isArray(s.cards) && s.cards.length === 3 ? s.cards : defaultSettings.cards;
  return {
    cards: cards.map((c,i)=>({name:String(c?.name||`Kart ${i+1}`),limit:Number(c?.limit)||0})),
    incomeCategories:Array.isArray(s.incomeCategories)&&s.incomeCategories.length?s.incomeCategories.map(String):[...defaultSettings.incomeCategories],
    expenseCategories:Array.isArray(s.expenseCategories)&&s.expenseCategories.length?s.expenseCategories.map(String):[...defaultSettings.expenseCategories]
  };
}

function readLocal(){
  let items=[]; let settings=structuredClone(defaultSettings);
  try { items=JSON.parse(localStorage.getItem(ITEMS_KEY)||"[]"); } catch {}
  try { settings=normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null")); } catch {}
  return {items:Array.isArray(items)?items:[], settings};
}
function writeLocal(items, settings){
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

function addAuthUi(){
  if(document.getElementById("firebaseAuthBar")) return;
  const bar=document.createElement("div");
  bar.id="firebaseAuthBar";
  bar.style.cssText="position:sticky;top:0;z-index:9999;background:#eef5fb;border-bottom:1px solid #cbd9e6;padding:7px 14px;font:14px Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px";
  bar.innerHTML=`<span id="firebaseUserText">Firebase bağlantısı hazırlanıyor…</span><button id="firebaseLoginBtn" style="display:none;border:0;border-radius:7px;padding:7px 12px;background:#1f4e78;color:#fff;cursor:pointer">Google ile giriş yap</button><button id="firebaseLogoutBtn" style="display:none;border:1px solid #999;border-radius:7px;padding:6px 10px;background:#fff;cursor:pointer">Çıkış</button>`;
  document.body.prepend(bar);
  bar.querySelector("#firebaseLoginBtn").onclick=()=>signInWithPopup(auth,provider).catch(e=>showAuthError(e));
  bar.querySelector("#firebaseLogoutBtn").onclick=()=>signOut(auth);
}
function showAuthError(e){
  const t=document.getElementById("firebaseUserText");
  if(t) t.textContent="Giriş başarısız: "+(e?.code||e?.message||"bilinmeyen hata");
}

function waitForAuth(){
  return new Promise(resolve=>{
    let settled=false;
    onAuthStateChanged(auth, u=>{
      user=u;
      const t=document.getElementById("firebaseUserText");
      const login=document.getElementById("firebaseLoginBtn");
      const logout=document.getElementById("firebaseLogoutBtn");
      if(u){
        if(t)t.textContent=`Bulut: ${u.displayName||u.email||"Google hesabı"}`;
        if(login)login.style.display="none";
        if(logout)logout.style.display="inline-block";
        if(!settled){settled=true;resolve(u);}
      }else{
        if(t)t.textContent="Verilerin PC ve telefonda ortak olması için giriş yapmalısın.";
        if(login)login.style.display="inline-block";
        if(logout)logout.style.display="none";
      }
    });
  });
}

async function syncFromCloud(){
  const ref=doc(db,"users",user.uid);
  const snap=await getDoc(ref);
  const local=readLocal();
  if(snap.exists()){
    const d=snap.data();
    dataCache={items:Array.isArray(d.items)?d.items:[],settings:normalizeSettings(d.settings),exists:true};
    writeLocal(dataCache.items,dataCache.settings);
  }else{
    dataCache={items:local.items,settings:local.settings,exists:false};
    await setDoc(ref,{items:dataCache.items,settings:dataCache.settings,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    dataCache.exists=true;
    writeLocal(dataCache.items,dataCache.settings);
  }
  return dataCache;
}

export async function firebaseReady(){
  addAuthUi();
  if(!readyPromise){
    readyPromise=(async()=>{await waitForAuth();return syncFromCloud();})();
  }
  return readyPromise;
}

export function getUser(){return user;}
export function getItems(){return dataCache.items;}
export function getSettings(){return dataCache.settings;}

export async function saveItems(items){
  dataCache.items=Array.isArray(items)?items:[];
  writeLocal(dataCache.items,dataCache.settings);
  if(!user) throw new Error("Firebase oturumu yok.");
  await setDoc(doc(db,"users",user.uid),{items:dataCache.items,updatedAt:serverTimestamp()},{merge:true});
}
export async function saveSettings(settings){
  dataCache.settings=normalizeSettings(settings);
  writeLocal(dataCache.items,dataCache.settings);
  if(!user) throw new Error("Firebase oturumu yok.");
  await setDoc(doc(db,"users",user.uid),{settings:dataCache.settings,updatedAt:serverTimestamp()},{merge:true});
}

export function legacyBackup(){
  const d=readLocal();
  return {items:d.items,settings:d.settings};
}
