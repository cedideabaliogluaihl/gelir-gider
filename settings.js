const K="gelirGiderSettingsV1";
const defaults={
  cards:[{name:"Kart 1",limit:0},{name:"Kart 2",limit:0},{name:"Kart 3",limit:0}],
  incomeCategories:["Maaş","Ek Ders","Diğer Gelir"],
  expenseCategories:["Kira","Market","Fatura","Yakıt","Nakit","Diğer Gider"]
};
let s;
try{s=JSON.parse(localStorage.getItem(K)||JSON.stringify(defaults))}catch{s=defaults}
s.cards=s.cards?.length===3?s.cards:defaults.cards;
s.incomeCategories=Array.isArray(s.incomeCategories)&&s.incomeCategories.length?s.incomeCategories:defaults.incomeCategories;
s.expenseCategories=Array.isArray(s.expenseCategories)&&s.expenseCategories.length?s.expenseCategories:defaults.expenseCategories;

for(let i=1;i<=3;i++){
  document.getElementById("cardName"+i).value=s.cards[i-1].name||("Kart "+i);
  document.getElementById("cardLimit"+i).value=s.cards[i-1].limit||"";
}
function draw(listId,arr){
  const el=document.getElementById(listId);
  el.innerHTML=arr.map((x,i)=>`<div class="category-item"><span>${x}</span>${arr.length>1?`<button type="button" data-i="${i}" class="danger-outline cat-del">Sil</button>`:""}</div>`).join("");
  el.querySelectorAll(".cat-del").forEach(b=>b.onclick=()=>{
    arr.splice(+b.dataset.i,1);save();draw("incomeCategories",s.incomeCategories);draw("expenseCategories",s.expenseCategories);
  });
}
function save(){
  s.cards=[1,2,3].map(i=>({name:document.getElementById("cardName"+i).value.trim()||"Kart "+i,limit:+document.getElementById("cardLimit"+i).value||0}));
  localStorage.setItem(K,JSON.stringify(s));
}
document.getElementById("saveCardsBtn").onclick=()=>{save();alert("Kart ayarları kaydedildi.")};
document.getElementById("addIncomeCategoryBtn").onclick=()=>{
  const el=document.getElementById("newIncomeCategory"),v=el.value.trim();
  if(v&&!s.incomeCategories.includes(v)){s.incomeCategories.push(v);save();draw("incomeCategories",s.incomeCategories);el.value=""}
};
document.getElementById("addExpenseCategoryBtn").onclick=()=>{
  const el=document.getElementById("newExpenseCategory"),v=el.value.trim();
  if(v&&!s.expenseCategories.includes(v)){s.expenseCategories.push(v);save();draw("expenseCategories",s.expenseCategories);el.value=""}
};
draw("incomeCategories",s.incomeCategories);draw("expenseCategories",s.expenseCategories);