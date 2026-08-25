import { firebaseReady, getSettings, saveSettings } from "./firebase-core.js";

let s;
const defaults={cards:[{name:"Kart 1",limit:0},{name:"Kart 2",limit:0},{name:"Kart 3",limit:0}],incomeCategories:["Maaş","Ek Ders","Diğer Gelir"],expenseCategories:["Kira","Market","Fatura","Yakıt","Nakit","Diğer Gider"]};
const $=id=>document.getElementById(id);
function draw(listId,arr){const el=$(listId);el.innerHTML=arr.map((x,i)=>`<div class="category-item"><span>${String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}</span>${arr.length>1?`<button type="button" data-i="${i}" class="danger-outline cat-del">Sil</button>`:""}</div>`).join("");el.querySelectorAll(".cat-del").forEach(b=>b.onclick=async()=>{arr.splice(+b.dataset.i,1);await save();draw("incomeCategories",s.incomeCategories);draw("expenseCategories",s.expenseCategories)})}
async function save(){s.cards=[1,2,3].map(i=>({name:$("cardName"+i).value.trim()||"Kart "+i,limit:+$("cardLimit"+i).value||0}));await saveSettings(s)}
async function main(){s=await firebaseReady().then(()=>getSettings());for(let i=1;i<=3;i++){$("cardName"+i).value=s.cards[i-1].name||("Kart "+i);$("cardLimit"+i).value=s.cards[i-1].limit||""}
draw("incomeCategories",s.incomeCategories);draw("expenseCategories",s.expenseCategories);
$("saveCardsBtn").onclick=async()=>{try{await save();alert("Kart ayarları kaydedildi.")}catch(e){alert("Kaydedilemedi: "+e.message)}};
$("addIncomeCategoryBtn").onclick=async()=>{const el=$("newIncomeCategory"),v=el.value.trim();if(v&&!s.incomeCategories.includes(v)){s.incomeCategories.push(v);await save();draw("incomeCategories",s.incomeCategories);el.value=""}};
$("addExpenseCategoryBtn").onclick=async()=>{const el=$("newExpenseCategory"),v=el.value.trim();if(v&&!s.expenseCategories.includes(v)){s.expenseCategories.push(v);await save();draw("expenseCategories",s.expenseCategories);el.value=""}};
}
main().catch(e=>alert("Firebase bağlantısı kurulamadı: "+e.message));
