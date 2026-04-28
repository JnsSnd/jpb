// ════════════════════════════════
//  DATA LAYER
// ════════════════════════════════
const DB={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let gdriveToken=null; // declared early so persist() can reference it

function defaultCats(){return[
  {id:uid(),name:'Food & Dining',color:'#FF6B6B',icon:'bi-cup-hot'},
  {id:uid(),name:'Transport',color:'#3399FF',icon:'bi-car-front'},
  {id:uid(),name:'Utilities',color:'#F59E0B',icon:'bi-lightning-charge'},
  {id:uid(),name:'Entertainment',color:'#A855F7',icon:'bi-film'},
  {id:uid(),name:'Health',color:'#10B981',icon:'bi-heart-pulse'},
  {id:uid(),name:'Shopping',color:'#EC4899',icon:'bi-bag'},
  {id:uid(),name:'Salary',color:'#10B981',icon:'bi-briefcase'},
  {id:uid(),name:'Savings',color:'#3399FF',icon:'bi-piggy-bank'},
  {id:uid(),name:'Others',color:'#94A3B8',icon:'bi-three-dots'},
]}
function defaultNeeds(){return[
  {id:uid(),name:'Internet Bill',amount:1500,catId:'',active:true},
  {id:uid(),name:'Electricity',amount:2000,catId:'',active:true},
  {id:uid(),name:'Water Bill',amount:500,catId:'',active:true},
]}
function defaultWants(){return[
  {id:uid(),name:'Netflix',amount:549,catId:'',active:true},
  {id:uid(),name:'Spotify',amount:179,catId:'',active:true},
]}

function loadState(){return{
  transactions:DB.get('jns_tx')||[],
  categories:DB.get('jns_cats')||defaultCats(),
  goals:DB.get('jns_goals')||[],
  needsItems:DB.get('jns_needs')||defaultNeeds(),
  wantsItems:DB.get('jns_wants')||defaultWants(),
  needsPaid:DB.get('jns_needs_paid')||{},
  period:DB.get('jns_period')||{type:'monthly',startDay:1},
  currency:DB.get('jns_cur')||{symbol:'₱',format:'en'},
  dark:DB.get('jns_dark')||false,
  budgetRule:DB.get('jns_budget_rule')||{needs:50,wants:30,savings:20},
}}
function persist(){
  DB.set('jns_tx',S.transactions);DB.set('jns_cats',S.categories);DB.set('jns_goals',S.goals);
  DB.set('jns_needs',S.needsItems);DB.set('jns_wants',S.wantsItems);
  DB.set('jns_needs_paid',S.needsPaid);
  DB.set('jns_period',S.period);DB.set('jns_cur',S.currency);DB.set('jns_dark',S.dark);
  DB.set('jns_budget_rule',S.budgetRule);
  // Auto-sync to Google Drive if enabled
  if(gdriveToken&&localStorage.getItem('jns_gdrive_autosync')==='1'){
    gdriveSyncNow();
  }
}
let S=loadState();

// Auto-inject Savings category for existing users who don't have it yet
(function ensureSavingsCategory(){
  const hasSavings=S.categories.some(c=>c.name.toLowerCase().includes('saving'));
  if(!hasSavings){
    S.categories.push({id:uid(),name:'Savings',color:'#3399FF',icon:'bi-piggy-bank'});
    persist();
  }
})();

// ════════════════════════════════
//  HELPERS
// ════════════════════════════════
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function fmt(n){const sym=S.currency.symbol;const v=Number(n).toLocaleString(S.currency.format==='de'?'de-DE':'en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return sym+v}
function getCat(id){return S.categories.find(c=>c.id===id)||{name:'Unknown',color:'#94A3B8',icon:'bi-question'}}
function sortedCats(){return[...S.categories].sort((a,b)=>a.name.localeCompare(b.name))}
function catIcon(cat,size=14){return`<i class="bi ${cat.icon}" style="color:${cat.color};font-size:${size}px"></i>`}

function toast(msg,type='info'){
  const t=document.getElementById('toast');
  t.innerHTML=`<i class="bi bi-${type==='success'?'check-circle-fill':type==='error'?'x-circle-fill':'info-circle-fill'}" style="color:${type==='success'?'var(--green)':type==='error'?'var(--red)':'var(--accent)'}"></i> ${msg}`;
  t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);
}

function getPeriodTxs(){
  const now=new Date(),p=S.period;
  return S.transactions.filter(tx=>{
    const d=new Date(tx.date);
    if(p.type==='monthly'){
      let start=new Date(now.getFullYear(),now.getMonth(),p.startDay||1);
      if(start>now)start.setMonth(start.getMonth()-1);
      const end=new Date(start);end.setMonth(end.getMonth()+1);
      return d>=start&&d<end;
    } else {
      const sd=p.startDay||1;
      const todayDiff=(now.getDay()-sd+7)%7;
      const weekStart=new Date(now);weekStart.setDate(now.getDate()-todayDiff);weekStart.setHours(0,0,0,0);
      const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+7);
      return d>=weekStart&&d<weekEnd;
    }
  });
}

function getMonthTxs(year,month){
  return S.transactions.filter(tx=>{
    const d=new Date(tx.date);
    return d.getFullYear()===year&&d.getMonth()===month;
  });
}

function getPeriodLabel(){
  const p=S.period;
  if(p.type==='weekly')return`Weekly budget period`;
  return`Monthly budget period`;
}

// ════════════════════════════════
//  DARK MODE
// ════════════════════════════════
function toggleDark(){
  S.dark=!S.dark;persist();applyDark();
}
function applyDark(){
  document.documentElement.setAttribute('data-theme',S.dark?'dark':'light');
  document.getElementById('darkIcon').className='bi bi-'+(S.dark?'sun':'moon')+' nav-icon';
  document.getElementById('darkLabel').textContent=S.dark?'Light Mode':'Dark Mode';
}

// ════════════════════════════════
//  SIDEBAR (mobile)
// ════════════════════════════════
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ════════════════════════════════
//  NAVIGATION
// ════════════════════════════════
const PAGE_TITLES={dashboard:'Dashboard',transactions:'Transactions',calendar:'Calendar',split:'Budget Rule',goals:'Budget Goals',reports:'Reports',settings:'Settings'};
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{if(n.getAttribute('onclick')?.includes("'"+page+"'"))n.classList.add('active')});
  document.getElementById('topbarTitle').textContent=PAGE_TITLES[page]||page;
  closeSidebar();
  if(page==='dashboard'){initDashFilters();renderDashboard();}
  if(page==='transactions'){fillTxFilters();renderTransactions();}
  if(page==='calendar'){initCalSelects();renderCalendar();}
  if(page==='split'){initSplitSelects();renderSplit();}
  if(page==='goals')renderGoals();
  if(page==='reports'){initReportFilters();renderReports();}
  if(page==='settings')renderSettings();
}

function initDashFilters(){
  const yEl=document.getElementById('dashFilterYear');
  if(yEl.options.length<=1){
    const now=new Date();
    const years=new Set(S.transactions.map(t=>t.date.slice(0,4)));
    years.add(String(now.getFullYear()));
    const sorted=[...years].sort().reverse();
    yEl.innerHTML=sorted.map(y=>`<option value="${y}" ${y===String(now.getFullYear())?'selected':''}>${y}</option>`).join('');
    document.getElementById('dashFilterMonth').value=now.getMonth();
  }
}
function onDashFilterModeChange(){
  const mode=document.getElementById('dashFilterMode').value;
  const yEl=document.getElementById('dashFilterYear');
  const mEl=document.getElementById('dashFilterMonth');
  yEl.style.display=mode==='month'?'':'none';
  mEl.style.display=mode==='month'?'':'none';
  renderDashboard();
}

// ════════════════════════════════
//  DASHBOARD
// ════════════════════════════════
let pieInst=null;
function getDashTxs(){
  const mode=document.getElementById('dashFilterMode')?.value||'period';
  if(mode==='month'){
    const year=parseInt(document.getElementById('dashFilterYear')?.value||new Date().getFullYear());
    const month=parseInt(document.getElementById('dashFilterMonth')?.value??new Date().getMonth());
    return getMonthTxs(year,month);
  }
  return getPeriodTxs();
}
function getDashLabel(){
  const mode=document.getElementById('dashFilterMode')?.value||'period';
  if(mode==='month'){
    const year=document.getElementById('dashFilterYear')?.value||new Date().getFullYear();
    const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month=parseInt(document.getElementById('dashFilterMonth')?.value??new Date().getMonth());
    return`${monthNames[month]} ${year}`;
  }
  return getPeriodLabel();
}
function renderDashboard(){
  initDashFilters();
  document.getElementById('dashPeriodLabel').textContent=getDashLabel();
  const txs=getDashTxs();
  const inc=txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const exp=txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
  const bal=inc-exp;
  document.getElementById('dashIncome').textContent=fmt(inc);
  document.getElementById('dashExpense').textContent=fmt(exp);
  const bel=document.getElementById('dashBalance');
  bel.textContent=fmt(bal);
  bel.className='stat-number '+(bal>=0?'blue':'red');
  document.getElementById('dashTxCount').textContent=txs.length;

  // Recent (always show last 6 overall)
  const rec=document.getElementById('recentTxList');
  const last5=[...S.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  if(!last5.length){rec.innerHTML='<div class="empty-state" style="padding:24px"><i class="bi bi-inbox"></i><p>No transactions yet</p></div>';return;}
  rec.innerHTML=last5.map(t=>{
    const cat=getCat(t.catId);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">
      <div class="gap-6">${catIcon(cat,13)}<span style="font-size:13px;color:var(--text)">${t.desc}</span></div>
      <span style="font-size:13px;font-weight:600;color:${t.type==='income'?'var(--green)':'var(--red)'}">${t.type==='expense'?'-':'+'}${fmt(t.amount)}</span>
    </div>`;
  }).join('');

  // Pie
  const expTxs=txs.filter(t=>t.type==='expense');
  const catMap={};expTxs.forEach(t=>{catMap[t.catId]=(catMap[t.catId]||0)+t.amount});
  const pl=[],pd=[],pc=[];
  Object.keys(catMap).forEach(id=>{const c=getCat(id);pl.push(c.name);pd.push(catMap[id]);pc.push(c.color)});
  if(pieInst)pieInst.destroy();
  const ctx=document.getElementById('catPieChart').getContext('2d');
  if(pd.length){
    pieInst=new Chart(ctx,{type:'doughnut',data:{labels:pl,datasets:[{data:pd,backgroundColor:pc,borderWidth:0,hoverOffset:4}]},options:{plugins:{legend:{position:'bottom',labels:{color:getComputedStyle(document.documentElement).getPropertyValue('--text2'),font:{family:'DM Sans',size:11},boxWidth:10,padding:12}}},cutout:'65%',responsive:true,maintainAspectRatio:false}});
  }

  // Goals
  const ge=document.getElementById('dashGoalBars');
  if(!S.goals.length){ge.innerHTML='<p class="text-sm">No goals set. <a href="#" onclick="navigate(\'goals\')" style="color:var(--accent)">Add a goal</a></p>';return;}
  ge.innerHTML=S.goals.map(g=>{
    const cat=getCat(g.catId);
    const spent=txs.filter(t=>t.type==='expense'&&t.catId===g.catId).reduce((a,t)=>a+t.amount,0);
    const pct=Math.min(100,Math.round(spent/g.limit*100));
    const over=spent>g.limit;
    return`<div style="margin-bottom:16px">
      <div class="progress-label">
        <span class="gap-6">${catIcon(cat,12)}<span>${cat.name}</span></span>
        <span>${fmt(spent)} / ${fmt(g.limit)}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${over?'var(--red)':'var(--green)'}"></div></div>
      ${over?`<div style="font-size:11.5px;color:var(--red);margin-top:4px"><i class="bi bi-exclamation-triangle-fill"></i> Over by ${fmt(spent-g.limit)}</div>`:''}
    </div>`;
  }).join('');
}

// ════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════
let editTxId=null;
function openTxModal(id){
  editTxId=id||null;
  const tx=id?S.transactions.find(t=>t.id===id):null;
  document.getElementById('txModalTitle').textContent=id?'Edit Transaction':'Add Transaction';
  document.getElementById('txType').value=tx?.type||'expense';
  document.getElementById('txAmount').value=tx?.amount||'';
  document.getElementById('txDesc').value=tx?.desc||'';
  document.getElementById('txDate').value=tx?.date||new Date().toISOString().slice(0,10);
  populateTxCatSelect(tx?.type||'expense', tx?.catId||null);
  document.getElementById('txModal').classList.add('open');
}
function populateTxCatSelect(type, selectedCatId){
  const sel=document.getElementById('txCat');
  sel.innerHTML=sortedCats().map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(selectedCatId){
    sel.value=selectedCatId;
  } else if(type==='income'){
    // Default to Salary category for income
    const salaryCat=S.categories.find(c=>c.name.toLowerCase()==='salary');
    if(salaryCat)sel.value=salaryCat.id;
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('txType').addEventListener('change',function(){
    if(!editTxId) populateTxCatSelect(this.value, null);
  });
});
function closeTxModal(){document.getElementById('txModal').classList.remove('open')}
function getWantsBudgetInfo(date,excludeTxId){
  const d=new Date(date);
  const year=d.getFullYear(),month=d.getMonth();
  const txs=getMonthTxs(year,month);
  const income=txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const br=S.budgetRule||{needs:50,wants:30,savings:20};
  const w30=income*(br.wants/100);
  const aW=S.wantsItems.filter(w=>w.active);
  const wFixed=aW.reduce((a,w)=>a+w.amount,0);
  const savingsCatIds=S.categories.filter(c=>c.name.toLowerCase().includes('saving')).map(c=>c.id);
  const wantsTxTotal=txs
    .filter(t=>t.type==='expense'&&!savingsCatIds.includes(t.catId)&&t.id!==excludeTxId&&!t._needsKey)
    .reduce((a,t)=>a+t.amount,0);
  const usedSoFar=wFixed+wantsTxTotal;
  return{alloc:w30,used:usedSoFar,remaining:w30-usedSoFar};
}

let _pendingTxData=null;
function saveTx(){
  const type=document.getElementById('txType').value;
  const amount=parseFloat(document.getElementById('txAmount').value);
  const desc=document.getElementById('txDesc').value.trim();
  const catId=document.getElementById('txCat').value;
  const date=document.getElementById('txDate').value;
  if(!amount||isNaN(amount)||!desc||!date){toast('Please fill all fields','error');return;}

  // Check wants budget warning only for non-savings expense transactions
  if(type==='expense'){
    const savingsCatIds=S.categories.filter(c=>c.name.toLowerCase().includes('saving')).map(c=>c.id);
    if(!savingsCatIds.includes(catId)){
      const budget=getWantsBudgetInfo(date,editTxId||null);
      if(budget.alloc>0&&amount>budget.remaining){
        // Store pending data and show warning modal
        _pendingTxData={type,amount,desc,catId,date};
        const overBy=amount-(budget.remaining>0?budget.remaining:0);
        document.getElementById('warnBudgetMsg').innerHTML=
          `You are about to record an expense of <strong>${fmt(amount)}</strong> which exceeds your available Wants budget for this month.<br><br>`+
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;font-size:13px">`+
          `<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Wants Budget</div><div style="font-weight:700;font-size:16px;color:var(--yellow)">${fmt(budget.alloc)}</div></div>`+
          `<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.06em">Remaining</div><div style="font-weight:700;font-size:16px;color:${budget.remaining<=0?'var(--red)':'var(--text)'}">${fmt(budget.remaining)}</div></div>`+
          `</div>`+
          `<div style="margin-top:14px;padding:10px 14px;background:var(--red-soft);border-radius:8px;font-size:13px;color:var(--red)"><i class="bi bi-exclamation-triangle-fill"></i> This transaction exceeds your remaining budget by <strong>${fmt(overBy)}</strong>.</div>`;
        document.getElementById('warnBudgetModal').classList.add('open');
        return;
      }
    }
  }
  commitSaveTx({type,amount,desc,catId,date});
}

function commitSaveTx(data){
  const{type,amount,desc,catId,date}=data||_pendingTxData;
  if(editTxId){
    const i=S.transactions.findIndex(t=>t.id===editTxId);
    S.transactions[i]={...S.transactions[i],type,amount,desc,catId,date};
    toast('Transaction updated','success');
  } else {
    S.transactions.push({id:uid(),type,amount,desc,catId,date});
    toast('Transaction added','success');
  }
  _pendingTxData=null;
  persist();closeTxModal();renderTransactions();renderDashboard();
}

function closeWarnBudgetModal(){
  document.getElementById('warnBudgetModal').classList.remove('open');
  _pendingTxData=null;
}
function proceedAnyway(){
  document.getElementById('warnBudgetModal').classList.remove('open');
  commitSaveTx();
}
function deleteTx(id){
  if(!confirm('Delete this transaction?'))return;
  S.transactions=S.transactions.filter(t=>t.id!==id);
  persist();renderTransactions();renderDashboard();toast('Deleted','success');
}
function fillTxFilters(){
  const sel=document.getElementById('txFilterCat');
  sel.innerHTML='<option value="">All Categories</option>'+sortedCats().map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  // Year filter
  const yEl=document.getElementById('txFilterYear');
  const now=new Date();
  const years=new Set(S.transactions.map(t=>t.date.slice(0,4)));
  years.add(String(now.getFullYear()));
  const sortedYears=[...years].sort().reverse();
  yEl.innerHTML='<option value="">All Years</option>'+sortedYears.map(y=>`<option value="${y}" ${y===String(now.getFullYear())?'selected':''}>${y}</option>`).join('');
  // Default month filter to current month (only on first load)
  const mEl=document.getElementById('txFilterMonth');
  if(mEl.dataset.initialized!=='1'){
    mEl.value=String(now.getMonth());
    mEl.dataset.initialized='1';
  }
}
function renderTransactions(){
  const search=document.getElementById('txSearch').value.toLowerCase();
  const type=document.getElementById('txFilterType').value;
  const catId=document.getElementById('txFilterCat').value;
  const filterYear=document.getElementById('txFilterYear').value;
  const filterMonth=document.getElementById('txFilterMonth').value;
  let txs=[...S.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(search)txs=txs.filter(t=>t.desc.toLowerCase().includes(search));
  if(type)txs=txs.filter(t=>t.type===type);
  if(catId)txs=txs.filter(t=>t.catId===catId);
  if(filterYear)txs=txs.filter(t=>t.date.startsWith(filterYear));
  if(filterMonth!=='')txs=txs.filter(t=>new Date(t.date).getMonth()===parseInt(filterMonth));
  document.getElementById('txEmpty').style.display=txs.length?'none':'block';
  document.getElementById('txTableBody').innerHTML=txs.map(t=>{
    const cat=getCat(t.catId);
    return`<tr>
      <td style="color:var(--text3);white-space:nowrap">${t.date}</td>
      <td style="font-weight:500">${t.desc}</td>
      <td><span class="badge badge-neutral gap-6">${catIcon(cat,11)} ${cat.name}</span></td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td class="${t.type==='income'?'amount-positive':'amount-negative'}">${t.type==='expense'?'-':'+'}${fmt(t.amount)}</td>
      <td><div class="gap-6">
        <button class="btn btn-icon btn-sm" onclick="openTxModal('${t.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-icon btn-sm" onclick="deleteTx('${t.id}')"><i class="bi bi-trash3"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════
//  CALENDAR
// ════════════════════════════════
function initCalSelects(){
  const yEl=document.getElementById('calYear');
  const now=new Date();
  if(!yEl.options.length){
    for(let y=now.getFullYear()-3;y<=now.getFullYear()+1;y++){
      yEl.innerHTML+=`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`;
    }
  }
  document.getElementById('calMonth').value=now.getMonth();
}
function calToday(){
  const now=new Date();
  document.getElementById('calYear').value=now.getFullYear();
  document.getElementById('calMonth').value=now.getMonth();
  renderCalendar();
}
function renderCalendar(){
  const year=parseInt(document.getElementById('calYear').value);
  const month=parseInt(document.getElementById('calMonth').value);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('calDayHeaders').innerHTML=days.map(d=>`<div class="cal-header-day">${d}</div>`).join('');
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const today=new Date();
  const txs=getMonthTxs(year,month);
  // build day map
  const dayMap={};
  txs.forEach(tx=>{
    const d=new Date(tx.date).getDate();
    if(!dayMap[d])dayMap[d]={income:[],expense:[]};
    dayMap[d][tx.type].push(tx);
  });
  let html='';
  for(let i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;
    const data=dayMap[d];
    const hasInc=data&&data.income.length>0;
    const hasExp=data&&data.expense.length>0;
    const incTotal=hasInc?data.income.reduce((a,t)=>a+t.amount,0):0;
    const expTotal=hasExp?data.expense.reduce((a,t)=>a+t.amount,0):0;
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html+=`<div class="cal-day${isToday?' today':''}${hasInc||hasExp?' has-data':''}${hasInc?' has-income':''}${hasExp?' has-expense':''}" onclick="openCalDayModal('${dateStr}')">
      <div class="cal-date">${d}</div>
      ${hasInc?`<div class="cal-entry income"><i class="bi bi-arrow-down-short"></i>${fmt(incTotal)}</div>`:''}
      ${hasExp?`<div class="cal-entry expense"><i class="bi bi-arrow-up-short"></i>${fmt(expTotal)}</div>`:''}
    </div>`;
  }
  document.getElementById('calGrid').innerHTML=html;
  // stats
  const totalInc=txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const totalExp=txs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
  document.getElementById('calIncomeStat').textContent=fmt(totalInc);
  document.getElementById('calExpenseStat').textContent=fmt(totalExp);
}

function openCalDayModal(dateStr){
  const dayTxs=S.transactions.filter(t=>t.date===dateStr).sort((a,b)=>a.type.localeCompare(b.type));
  const d=new Date(dateStr+'T00:00:00');
  const label=d.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const incTotal=dayTxs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const expTotal=dayTxs.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);

  let rows='';
  if(!dayTxs.length){
    rows=`<div class="empty-state" style="padding:28px 0"><i class="bi bi-calendar-x" style="font-size:32px;color:var(--text3)"></i><p style="margin-top:8px;color:var(--text3)">No transactions on this day</p></div>`;
  } else {
    rows=dayTxs.map(t=>{
      const cat=getCat(t.catId);
      return`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          ${catIcon(cat,14)}
          <div style="min-width:0">
            <div style="font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.desc}</div>
            <div style="font-size:11.5px;color:var(--text3)">${cat.name}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px">
          <span style="font-size:13.5px;font-weight:600;color:${t.type==='income'?'var(--green)':'var(--red)'}">${t.type==='expense'?'-':'+'}${fmt(t.amount)}</span>
          <button class="btn btn-icon btn-sm" onclick="closeCalDayModal();openTxModal('${t.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-icon btn-sm" onclick="calDeleteTx('${t.id}','${dateStr}')"><i class="bi bi-trash3"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  const summaryHtml=dayTxs.length?`
    <div style="display:flex;gap:10px;margin-bottom:16px">
      ${incTotal>0?`<div style="flex:1;background:var(--green-soft);border-radius:8px;padding:10px 14px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Income</div><div style="font-weight:700;color:var(--green)">${fmt(incTotal)}</div></div>`:''}
      ${expTotal>0?`<div style="flex:1;background:var(--red-soft);border-radius:8px;padding:10px 14px"><div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Expenses</div><div style="font-weight:700;color:var(--red)">${fmt(expTotal)}</div></div>`:''}
    </div>`:'';

  document.getElementById('calDayModalTitle').textContent=label;
  document.getElementById('calDayModalBody').innerHTML=summaryHtml+rows;
  document.getElementById('calDayAddBtn').onclick=()=>{closeCalDayModal();openTxModal();document.getElementById('txDate').value=dateStr;};
  document.getElementById('calDayModal').classList.add('open');
}
function closeCalDayModal(){document.getElementById('calDayModal').classList.remove('open');}
function calDeleteTx(id,dateStr){
  if(!confirm('Delete this transaction?'))return;
  S.transactions=S.transactions.filter(t=>t.id!==id);
  persist();renderTransactions();renderDashboard();renderCalendar();
  openCalDayModal(dateStr); // refresh the modal in place
  toast('Deleted','success');
}

// ════════════════════════════════
//  50/30/20 SPLIT
// ════════════════════════════════
function initSplitSelects(){
  const yEl=document.getElementById('splitYear');
  const now=new Date();
  if(!yEl.options.length){
    for(let y=now.getFullYear()-3;y<=now.getFullYear()+1;y++){
      yEl.innerHTML+=`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`;
    }
  }
  document.getElementById('splitMonth').value=now.getMonth();
}
function getNeedsPaidKey(itemId,year,month){return`${itemId}_${year}_${month}`;}
function toggleNeedsPaid(itemId){
  const year=parseInt(document.getElementById('splitYear').value);
  const month=parseInt(document.getElementById('splitMonth').value);
  const key=getNeedsPaidKey(itemId,year,month);
  const nowPaid=!S.needsPaid[key];
  S.needsPaid[key]=nowPaid;
  const item=S.needsItems.find(n=>n.id===itemId);
  if(item){
    const txKey='jns_needs_tx_'+key;
    if(nowPaid){
      // Create an expense transaction dated today
      const today=new Date().toISOString().slice(0,10);
      const newTx={id:uid(),type:'expense',amount:item.amount,desc:item.name+' (Needs)',catId:item.catId||'',date:today,_needsKey:key};
      S.transactions.push(newTx);
      S.needsPaid[txKey]=newTx.id; // store the txId so we can delete it later
    } else {
      // Remove the auto-created transaction
      const txId=S.needsPaid[txKey];
      if(txId)S.transactions=S.transactions.filter(t=>t.id!==txId);
      delete S.needsPaid[txKey];
    }
  }
  persist();renderSplit();renderDashboard();
}
function isNeedsPaid(itemId,year,month){
  return !!S.needsPaid[getNeedsPaidKey(itemId,year,month)];
}

function renderSplit(){
  const year=parseInt(document.getElementById('splitYear').value);
  const month=parseInt(document.getElementById('splitMonth').value);
  const txs=getMonthTxs(year,month);
  const income=txs.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  document.getElementById('splitIncomeDisplay').textContent=fmt(income);
  const br=S.budgetRule||{needs:50,wants:30,savings:20};
  const nPct=br.needs/100,wPct=br.wants/100,sPct=br.savings/100;
  const n50=income*nPct,w30=income*wPct,s20=income*sPct;

  // Needs: only active items that are marked PAID this month
  const aN=S.needsItems.filter(n=>n.active);
  const nPaidItems=aN.filter(n=>isNeedsPaid(n.id,year,month));
  const nFixed=nPaidItems.reduce((a,n)=>a+n.amount,0);

  // Wants: fixed wants items + expense transactions that are NOT in a Savings category
  const aW=S.wantsItems.filter(w=>w.active);
  const wFixed=aW.reduce((a,w)=>a+w.amount,0);
  const savingsCatIds=S.categories.filter(c=>c.name.toLowerCase().includes('saving')).map(c=>c.id);
  const expenseTxs=txs.filter(t=>t.type==='expense');
  const wantsTxTotal=expenseTxs.filter(t=>!savingsCatIds.includes(t.catId)&&!t._needsKey).reduce((a,t)=>a+t.amount,0);
  const wTotal=wFixed+wantsTxTotal;

  // Savings: expense transactions in Savings category
  const savingsTxTotal=expenseTxs.filter(t=>savingsCatIds.includes(t.catId)).reduce((a,t)=>a+t.amount,0);

  document.getElementById('splitBuckets').innerHTML=
    renderNeedsBucket(n50,aN,year,month)+
    renderWantsBucket(w30,wTotal,wFixed,wantsTxTotal,aW)+
    renderSavingsBucket(s20,savingsTxTotal);
}

function renderNeedsBucket(alloc,items,year,month){
  const paidItems=items.filter(n=>isNeedsPaid(n.id,year,month));
  const unpaidItems=items.filter(n=>!isNeedsPaid(n.id,year,month));
  const paidTotal=paidItems.reduce((a,n)=>a+n.amount,0);
  const rem=alloc-paidTotal;
  const over=paidTotal>alloc;
  const usedPct=alloc>0?Math.min(100,Math.round(paidTotal/alloc*100)):0;
  const renderItem=n=>{
    const paid=isNeedsPaid(n.id,year,month);
    return`<div class="bucket-item-row" style="opacity:${paid?1:0.6}">
      <span style="display:flex;align-items:center;gap:8px;flex:1">
        <i class="bi bi-${paid?'check-circle-fill':'circle'}" style="color:${paid?'var(--green)':'var(--text3)'}"></i>
        <span style="${paid?'text-decoration:line-through;color:var(--text3)':''}">${n.name}</span>
        ${paid?'<span class="badge" style="background:var(--green-soft);color:var(--green);font-size:10px">Paid</span>':'<span class="badge" style="background:var(--yellow-soft);color:var(--yellow);font-size:10px">Unpaid</span>'}
      </span>
      <span style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:600;color:${paid?'var(--text3)':'var(--text)'}">${paid?'−':''} ${fmt(n.amount)}</span>
        <button onclick="toggleNeedsPaid('${n.id}')" class="btn btn-sm" style="padding:3px 10px;font-size:11px;background:${paid?'var(--red-soft)':'var(--green-soft)'};color:${paid?'var(--red)':'var(--green)'};border:none;border-radius:6px;cursor:pointer">
          ${paid?'Mark Unpaid':'Mark Paid'}
        </button>
      </span>
    </div>`;
  };
  return`<div class="bucket">
    <div class="bucket-header">
      <div class="bucket-info">
        <div class="bucket-tag needs"><i class="bi bi-house"></i> Needs — 50%</div>
        <div class="bucket-amount needs">${fmt(alloc)}</div>
      </div>
      <div class="bucket-right">
        <div class="deducted"><i class="bi bi-dash-circle-fill"></i> ${fmt(paidTotal)} deducted</div>
        <div class="remaining">Remaining: <strong style="color:${over?'var(--red)':'var(--green)'}">${fmt(rem)}</strong></div>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${usedPct}%;background:var(--${over?'red':'green'})"></div></div>
    ${items.length?`<div class="bucket-items">${items.map(renderItem).join('')}</div>`:'<p class="text-sm" style="margin-top:10px">No fixed needs items. Add them in Settings.</p>'}
    ${paidItems.length&&unpaidItems.length?`<div style="font-size:12px;color:var(--text3);margin-top:8px"><i class="bi bi-info-circle"></i> ${unpaidItems.length} unpaid item(s) not yet deducted</div>`:''}
  </div>`;
}

function renderWantsBucket(alloc,wTotal,wFixed,wantsTxTotal,fixedItems){
  const rem=alloc-wTotal;
  const over=wTotal>alloc;
  const usedPct=alloc>0?Math.min(100,Math.round(wTotal/alloc*100)):0;
  return`<div class="bucket">
    <div class="bucket-header">
      <div class="bucket-info">
        <div class="bucket-tag wants"><i class="bi bi-stars"></i> Wants — 30%</div>
        <div class="bucket-amount wants">${fmt(alloc)}</div>
      </div>
      <div class="bucket-right">
        <div class="deducted"><i class="bi bi-dash-circle-fill"></i> ${fmt(wTotal)} deducted</div>
        <div class="remaining">Remaining: <strong style="color:${over?'var(--red)':'var(--green)'}">${fmt(rem)}</strong></div>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${usedPct}%;background:var(--${over?'red':'green'})"></div></div>
    <div class="bucket-items">
      ${fixedItems.map(i=>`<div class="bucket-item-row"><span><i class="bi bi-pin-angle" style="color:var(--text3)"></i> ${i.name}</span><span>− ${fmt(i.amount)}</span></div>`).join('')}
      ${wantsTxTotal>0?`<div class="bucket-item-row"><span><i class="bi bi-arrow-left-right" style="color:var(--text3)"></i> Expense Transactions</span><span>− ${fmt(wantsTxTotal)}</span></div>`:''}
      ${!fixedItems.length&&!wantsTxTotal?'<p class="text-sm" style="padding:8px 0">No wants spending this month.</p>':''}
    </div>
  </div>`;
}

function renderSavingsBucket(alloc,savingsTxTotal){
  const rem=alloc-savingsTxTotal;
  const over=savingsTxTotal>alloc;
  const usedPct=alloc>0?Math.min(100,Math.round(savingsTxTotal/alloc*100)):0;
  return`<div class="bucket">
    <div class="bucket-header">
      <div class="bucket-info">
        <div class="bucket-tag savings"><i class="bi bi-piggy-bank"></i> Savings — 20%</div>
        <div class="bucket-amount savings">${fmt(alloc)}</div>
      </div>
      <div class="bucket-right">
        <div class="deducted"><i class="bi bi-dash-circle-fill"></i> ${fmt(savingsTxTotal)} saved</div>
        <div class="remaining">Remaining target: <strong style="color:${over?'var(--accent)':'var(--green)'}">${fmt(Math.abs(rem))}</strong></div>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${usedPct}%;background:var(--accent)"></div></div>
    <div class="bucket-items">
      ${savingsTxTotal>0?`<div class="bucket-item-row"><span><i class="bi bi-piggy-bank" style="color:var(--accent)"></i> Savings Transactions</span><span style="color:var(--accent)">− ${fmt(savingsTxTotal)}</span></div>`:'<p class="text-sm" style="padding:8px 0">No savings transactions yet. Add a transaction with a Savings category.</p>'}
    </div>
    ${savingsTxTotal>=alloc?`<div style="font-size:12px;color:var(--green);margin-top:8px"><i class="bi bi-check-circle-fill"></i> Savings goal reached!</div>`:''}
  </div>`;
}

// ════════════════════════════════
//  GOALS
// ════════════════════════════════
let editGoalId=null;
function openGoalModal(id){
  editGoalId=id||null;
  const g=id?S.goals.find(g=>g.id===id):null;
  document.getElementById('goalModalTitle').textContent=id?'Edit Goal':'Add Budget Goal';
  const sel=document.getElementById('goalCat');
  sel.innerHTML=sortedCats().map(c=>`<option value="${c.id}" ${g?.catId===c.id?'selected':''}>${c.name}</option>`).join('');
  document.getElementById('goalAmount').value=g?.limit||'';
  document.getElementById('goalModal').classList.add('open');
}
function closeGoalModal(){document.getElementById('goalModal').classList.remove('open')}
function saveGoal(){
  const catId=document.getElementById('goalCat').value;
  const limit=parseFloat(document.getElementById('goalAmount').value);
  if(!limit||isNaN(limit)){toast('Enter a valid amount','error');return;}
  if(editGoalId){
    const i=S.goals.findIndex(g=>g.id===editGoalId);
    S.goals[i]={...S.goals[i],catId,limit};
  } else {
    if(S.goals.find(g=>g.catId===catId)){toast('Goal already exists for this category','error');return;}
    S.goals.push({id:uid(),catId,limit});
  }
  persist();closeGoalModal();renderGoals();toast('Goal saved','success');
}
function deleteGoal(id){
  if(!confirm('Delete this goal?'))return;
  S.goals=S.goals.filter(g=>g.id!==id);persist();renderGoals();toast('Deleted','success');
}
function renderGoals(){
  const el=document.getElementById('goalsList');
  const txs=getPeriodTxs();
  if(!S.goals.length){el.innerHTML='<div class="card empty-state"><i class="bi bi-trophy"></i><p>No goals yet.</p></div>';return;}
  el.innerHTML=S.goals.map(g=>{
    const cat=getCat(g.catId);
    const spent=txs.filter(t=>t.type==='expense'&&t.catId===g.catId).reduce((a,t)=>a+t.amount,0);
    const pct=Math.min(100,Math.round(spent/g.limit*100));
    const over=spent>g.limit;
    return`<div class="goal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="gap-8">${catIcon(cat,16)}<div><div class="fw-600">${cat.name}</div><div class="text-xs">Limit: ${fmt(g.limit)}</div></div></div>
        <div class="gap-6">
          <button class="btn btn-icon btn-sm" onclick="openGoalModal('${g.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-icon btn-sm" onclick="deleteGoal('${g.id}')"><i class="bi bi-trash3"></i></button>
        </div>
      </div>
      <div class="progress-label"><span>Spent: ${fmt(spent)}</span><span style="color:${over?'var(--red)':'var(--text3)'}">${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${over?'var(--red)':'var(--green)'}"></div></div>
      <div style="font-size:12px;margin-top:6px;color:${over?'var(--red)':'var(--green)'}">
        <i class="bi bi-${over?'exclamation-triangle-fill':'check-circle-fill'}"></i>
        ${over?`Over budget by ${fmt(spent-g.limit)}`:`Remaining: ${fmt(g.limit-spent)}`}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════
//  REPORTS
// ════════════════════════════════
let trendInst=null,rPieInst=null;
function initReportFilters(){
  const yEl=document.getElementById('reportFilterYear');
  const now=new Date();
  if(yEl&&!yEl.options.length){
    const years=new Set(S.transactions.map(t=>t.date.slice(0,4)));
    years.add(String(now.getFullYear()));
    const sorted=[...years].sort().reverse();
    yEl.innerHTML='<option value="">All Years</option>'+sorted.map(y=>`<option value="${y}" ${y===String(now.getFullYear())?'selected':''}>${y}</option>`).join('');
    // Default month to current month
    const mEl=document.getElementById('reportFilterMonth');
    if(mEl)mEl.value=String(now.getMonth());
  }
}
function getReportTxs(){
  const filterYear=document.getElementById('reportFilterYear')?.value||'';
  const filterMonth=document.getElementById('reportFilterMonth')?.value??'';
  let txs=[...S.transactions];
  if(filterYear)txs=txs.filter(t=>t.date.startsWith(filterYear));
  if(filterMonth!=='')txs=txs.filter(t=>new Date(t.date).getMonth()===parseInt(filterMonth));
  return txs;
}
function renderReports(){
  initReportFilters();
  const allTxs=getReportTxs();
  const months={};
  allTxs.forEach(t=>{
    const m=t.date.slice(0,7);
    if(!months[m])months[m]={income:0,expense:0};
    months[m][t.type]+=t.amount;
  });
  const sorted=Object.keys(months).sort();
  document.getElementById('monthSummaryBody').innerHTML=sorted.length?sorted.reverse().map(m=>{
    const d=months[m];const net=d.income-d.expense;
    return`<tr><td>${m}</td><td class="amount-positive">${fmt(d.income)}</td><td class="amount-negative">${fmt(d.expense)}</td><td style="font-weight:600;color:${net>=0?'var(--green)':'var(--red)'}">${fmt(net)}</td></tr>`;
  }).join(''):`<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">No data yet</td></tr>`;
  // Trend — show last 12 months relative to filter or overall
  const filterYear=document.getElementById('reportFilterYear')?.value||'';
  const filterMonth=document.getElementById('reportFilterMonth')?.value??'';
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let last12;
  // Update chart title dynamically
  const trendTitleEl=document.querySelector('#page-reports .grid-2 .card:first-child .card-label');
  if(filterYear&&filterMonth!==''){
    // Single month selected — show daily breakdown as bar chart
    const yr=parseInt(filterYear),mo=parseInt(filterMonth);
    if(trendTitleEl)trendTitleEl.textContent=`Daily Breakdown — ${monthNames[mo]} ${yr}`;
    const days=new Date(yr,mo+1,0).getDate();
    last12=Array.from({length:days},(_,i)=>`${filterYear}-${String(mo+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
    const dayInc=last12.map(d=>allTxs.filter(t=>t.date===d&&t.type==='income').reduce((a,t)=>a+t.amount,0));
    const dayExp=last12.map(d=>allTxs.filter(t=>t.date===d&&t.type==='expense').reduce((a,t)=>a+t.amount,0));
    if(trendInst)trendInst.destroy();
    trendInst=new Chart(document.getElementById('trendChart').getContext('2d'),{
      type:'bar',data:{labels:last12.map(d=>d.slice(8)),datasets:[
        {label:'Income',data:dayInc,backgroundColor:'rgba(16,185,129,0.7)',borderRadius:4},
        {label:'Expense',data:dayExp,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:4},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'var(--text2)',font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:'var(--text3)'},grid:{display:false}},y:{ticks:{color:'var(--text3)'},grid:{color:'var(--border)'}}}}
    });
  } else if(filterYear){
    if(trendTitleEl)trendTitleEl.textContent=`Monthly Trend — ${filterYear}`;
    last12=getLast12();
    const incD=last12.map(m=>months[m]?.income||0);
    const expD=last12.map(m=>months[m]?.expense||0);
    if(trendInst)trendInst.destroy();
    trendInst=new Chart(document.getElementById('trendChart').getContext('2d'),{
      type:'bar',data:{labels:last12.map(m=>m.slice(5)),datasets:[
        {label:'Income',data:incD,backgroundColor:'rgba(16,185,129,0.7)',borderRadius:4},
        {label:'Expense',data:expD,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:4},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'var(--text2)',font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:'var(--text3)'},grid:{display:false}},y:{ticks:{color:'var(--text3)'},grid:{color:'var(--border)'}}}}
    });
  } else {
    if(trendTitleEl)trendTitleEl.textContent='Monthly Trend (Last 12 Months)';
    last12=getLast12();
    const incD=last12.map(m=>months[m]?.income||0);
    const expD=last12.map(m=>months[m]?.expense||0);
    if(trendInst)trendInst.destroy();
    trendInst=new Chart(document.getElementById('trendChart').getContext('2d'),{
      type:'bar',data:{labels:last12.map(m=>m.slice(5)),datasets:[
        {label:'Income',data:incD,backgroundColor:'rgba(16,185,129,0.7)',borderRadius:4},
        {label:'Expense',data:expD,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:4},
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'var(--text2)',font:{family:'DM Sans',size:11}}}},scales:{x:{ticks:{color:'var(--text3)'},grid:{display:false}},y:{ticks:{color:'var(--text3)'},grid:{color:'var(--border)'}}}}
    });
  }
  // Pie — filtered
  const catMap={};
  allTxs.filter(t=>t.type==='expense').forEach(t=>{catMap[t.catId]=(catMap[t.catId]||0)+t.amount});
  const pl=[],pd=[],pc=[];
  Object.keys(catMap).forEach(id=>{const c=getCat(id);pl.push(c.name);pd.push(catMap[id]);pc.push(c.color)});
  if(rPieInst)rPieInst.destroy();
  if(pd.length)rPieInst=new Chart(document.getElementById('reportPieChart').getContext('2d'),{
    type:'doughnut',data:{labels:pl,datasets:[{data:pd,backgroundColor:pc,borderWidth:0}]},
    options:{plugins:{legend:{position:'bottom',labels:{color:'var(--text2)',font:{family:'DM Sans',size:11},boxWidth:10,padding:12}}},cutout:'65%',responsive:true,maintainAspectRatio:false}
  });
}
function getLast12(){
  const r=[];const now=new Date();
  for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);r.push(d.toISOString().slice(0,7));}
  return r;
}
function exportCSV(){
  const rows=[['Date','Type','Category','Description','Amount']];
  S.transactions.forEach(t=>{const cat=getCat(t.catId);rows.push([t.date,t.type,cat.name,t.desc,t.amount])});
  const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='jns-budget-export.csv';a.click();
}

// ════════════════════════════════
//  SETTINGS
// ════════════════════════════════
function stab(tab,el){
  document.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.spanel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+tab).classList.add('active');
}
function renderSettings(){
  document.getElementById('settingPeriod').value=S.period.type||'monthly';
  document.getElementById('settingCurrency').value=S.currency.symbol||'₱';
  document.getElementById('settingNumFormat').value=S.currency.format||'en';
  renderPeriodOpts();renderCatList();renderNeedsList();renderWantsList();renderGdriveUI();
  renderBudgetRulePanel();
  updateNeedsWantsPanelDesc();
}
function savePeriod(){
  const type=document.getElementById('settingPeriod').value;
  const startDay=parseInt(document.getElementById('periodStart')?.value)||1;
  S.period={type,startDay};persist();toast('Period saved','success');
}
function saveCurrency(){
  S.currency={symbol:document.getElementById('settingCurrency').value,format:document.getElementById('settingNumFormat').value};
  persist();toast('Currency saved','success');
}
function renderPeriodOpts(){
  const type=document.getElementById('settingPeriod').value;
  document.getElementById('periodOpts').innerHTML=type==='monthly'
    ?`<div class="form-group"><label class="form-label">Start Day of Month</label><input class="form-control" type="number" id="periodStart" min="1" max="28" value="${S.period.startDay||1}"/></div>`
    :`<div class="form-group"><label class="form-label">Start Day of Week</label><select class="form-control" id="periodStart"><option value="1">Monday</option><option value="2">Tuesday</option><option value="0">Sunday</option></select></div>`;
}

// CATEGORIES
let editCatId=null;
function openCatModal(id){
  editCatId=id||null;
  const cat=id?S.categories.find(c=>c.id===id):null;
  document.getElementById('catModalTitle').textContent=id?'Edit Category':'Add Category';
  document.getElementById('catName').value=cat?.name||'';
  document.getElementById('catColor').value=cat?.color||'#3399FF';
  document.getElementById('catIcon').value=cat?.icon||'bi-tag';
  updateCatPreview();
  document.getElementById('catModal').classList.add('open');
}
function closeCatModal(){document.getElementById('catModal').classList.remove('open')}
function updateCatPreview(){
  const name=document.getElementById('catName').value||'Category Name';
  const color=document.getElementById('catColor').value;
  const icon=document.getElementById('catIcon').value||'bi-tag';
  document.getElementById('catPreview').innerHTML=`<i class="bi ${icon}" style="color:${color};font-size:20px"></i><span style="font-weight:500">${name}</span><span class="badge badge-neutral" style="margin-left:auto">${icon}</span>`;
}
document.getElementById('catName').addEventListener('input',updateCatPreview);
document.getElementById('catColor').addEventListener('input',updateCatPreview);
document.getElementById('catIcon').addEventListener('input',updateCatPreview);
function saveCat(){
  const name=document.getElementById('catName').value.trim();
  const color=document.getElementById('catColor').value;
  const icon=document.getElementById('catIcon').value.trim()||'bi-tag';
  if(!name){toast('Enter a category name','error');return;}
  if(editCatId){const i=S.categories.findIndex(c=>c.id===editCatId);S.categories[i]={...S.categories[i],name,color,icon};}
  else S.categories.push({id:uid(),name,color,icon});
  persist();closeCatModal();renderCatList();toast('Category saved','success');
}
function deleteCat(id){
  if(!confirm('Delete this category?'))return;
  S.categories=S.categories.filter(c=>c.id!==id);persist();renderCatList();toast('Deleted','success');
}
function renderCatList(){
  document.getElementById('catList').innerHTML=sortedCats().map(c=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="gap-8"><i class="bi ${c.icon}" style="color:${c.color};font-size:16px"></i><span style="font-weight:500">${c.name}</span></div>
      <div class="gap-6">
        <button class="btn btn-icon btn-sm" onclick="openCatModal('${c.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-icon btn-sm" onclick="deleteCat('${c.id}')"><i class="bi bi-trash3"></i></button>
      </div>
    </div>`).join('');
}

// NEEDS
let editNeedsId=null;
function openNeedsModal(id){
  editNeedsId=id||null;
  const item=id?S.needsItems.find(n=>n.id===id):null;
  document.getElementById('needsModalTitle').textContent=id?'Edit Needs Item':'Add Needs Item';
  document.getElementById('needsName').value=item?.name||'';
  document.getElementById('needsAmount').value=item?.amount||'';
  const sel=document.getElementById('needsCat');
  sel.innerHTML='<option value="">— No Category —</option>'+sortedCats().map(c=>`<option value="${c.id}" ${item?.catId===c.id?'selected':''}>${c.name}</option>`).join('');
  document.getElementById('needsModal').classList.add('open');
}
function closeNeedsModal(){document.getElementById('needsModal').classList.remove('open')}
function saveNeedsItem(){
  const name=document.getElementById('needsName').value.trim();
  const amount=parseFloat(document.getElementById('needsAmount').value);
  const catId=document.getElementById('needsCat').value;
  if(!name||isNaN(amount)){toast('Fill all fields','error');return;}
  if(editNeedsId){const i=S.needsItems.findIndex(n=>n.id===editNeedsId);S.needsItems[i]={...S.needsItems[i],name,amount,catId};}
  else S.needsItems.push({id:uid(),name,amount,catId,active:true});
  persist();closeNeedsModal();renderNeedsList();toast('Saved','success');
}
function deleteNeedsItem(id){
  if(!confirm('Delete?'))return;
  S.needsItems=S.needsItems.filter(n=>n.id!==id);persist();renderNeedsList();toast('Deleted','success');
}
function toggleNeeds(id){
  const i=S.needsItems.findIndex(n=>n.id===id);S.needsItems[i].active=!S.needsItems[i].active;persist();renderNeedsList();
}
function renderNeedsList(){
  const el=document.getElementById('needsList');
  if(!S.needsItems.length){el.innerHTML='<p class="text-sm" style="padding:12px">No fixed needs items yet.</p>';return;}
  el.innerHTML=S.needsItems.map(n=>{
    const cat=n.catId?getCat(n.catId):null;
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
      <div class="gap-8">
        ${cat?`<i class="bi ${cat.icon}" style="color:${cat.color};font-size:15px"></i>`:'<i class="bi bi-pin-angle" style="color:var(--text3)"></i>'}
        <div><div style="font-weight:500;opacity:${n.active?1:0.5}">${n.name}</div>${cat?`<div class="text-xs">${cat.name}</div>`:''}</div>
      </div>
      <div class="gap-6">
        <span style="font-weight:600;opacity:${n.active?1:0.5}">${fmt(n.amount)}</span>
        <button class="btn btn-icon btn-sm" onclick="toggleNeeds('${n.id}')" title="${n.active?'Deactivate':'Activate'}">
          <i class="bi bi-${n.active?'toggle-on':'toggle-off'}" style="color:${n.active?'var(--accent)':'var(--text3)'}"></i>
        </button>
        <button class="btn btn-icon btn-sm" onclick="openNeedsModal('${n.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-icon btn-sm" onclick="deleteNeedsItem('${n.id}')"><i class="bi bi-trash3"></i></button>
      </div>
    </div>`;
  }).join('');
}

// WANTS
let editWantsId=null;
function openWantsModal(id){
  editWantsId=id||null;
  const item=id?S.wantsItems.find(w=>w.id===id):null;
  document.getElementById('wantsModalTitle').textContent=id?'Edit Wants Item':'Add Wants Item';
  document.getElementById('wantsName').value=item?.name||'';
  document.getElementById('wantsAmount').value=item?.amount||'';
  const sel=document.getElementById('wantsCat');
  sel.innerHTML='<option value="">— No Category —</option>'+sortedCats().map(c=>`<option value="${c.id}" ${item?.catId===c.id?'selected':''}>${c.name}</option>`).join('');
  document.getElementById('wantsModal').classList.add('open');
}
function closeWantsModal(){document.getElementById('wantsModal').classList.remove('open')}
function saveWantsItem(){
  const name=document.getElementById('wantsName').value.trim();
  const amount=parseFloat(document.getElementById('wantsAmount').value);
  const catId=document.getElementById('wantsCat').value;
  if(!name||isNaN(amount)){toast('Fill all fields','error');return;}
  if(editWantsId){const i=S.wantsItems.findIndex(w=>w.id===editWantsId);S.wantsItems[i]={...S.wantsItems[i],name,amount,catId};}
  else S.wantsItems.push({id:uid(),name,amount,catId,active:true});
  persist();closeWantsModal();renderWantsList();toast('Saved','success');
}
function deleteWantsItem(id){
  if(!confirm('Delete?'))return;
  S.wantsItems=S.wantsItems.filter(w=>w.id!==id);persist();renderWantsList();toast('Deleted','success');
}
function toggleWants(id){
  const i=S.wantsItems.findIndex(w=>w.id===id);S.wantsItems[i].active=!S.wantsItems[i].active;persist();renderWantsList();
}
function renderWantsList(){
  const el=document.getElementById('wantsList');
  if(!S.wantsItems.length){el.innerHTML='<p class="text-sm" style="padding:12px">No fixed wants items yet.</p>';return;}
  el.innerHTML=S.wantsItems.map(w=>{
    const cat=w.catId?getCat(w.catId):null;
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
      <div class="gap-8">
        ${cat?`<i class="bi ${cat.icon}" style="color:${cat.color};font-size:15px"></i>`:'<i class="bi bi-pin-angle" style="color:var(--text3)"></i>'}
        <div><div style="font-weight:500;opacity:${w.active?1:0.5}">${w.name}</div>${cat?`<div class="text-xs">${cat.name}</div>`:''}</div>
      </div>
      <div class="gap-6">
        <span style="font-weight:600;opacity:${w.active?1:0.5}">${fmt(w.amount)}</span>
        <button class="btn btn-icon btn-sm" onclick="toggleWants('${w.id}')" title="${w.active?'Deactivate':'Activate'}">
          <i class="bi bi-${w.active?'toggle-on':'toggle-off'}" style="color:${w.active?'var(--accent)':'var(--text3)'}"></i>
        </button>
        <button class="btn btn-icon btn-sm" onclick="openWantsModal('${w.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-icon btn-sm" onclick="deleteWantsItem('${w.id}')"><i class="bi bi-trash3"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════
//  BUDGET RULE SETTINGS
// ════════════════════════════════
function renderBudgetRulePanel(){
  const br=S.budgetRule||{needs:50,wants:30,savings:20};
  document.getElementById('brNeeds').value=br.needs;
  document.getElementById('brWants').value=br.wants;
  document.getElementById('brSavings').value=br.savings;
  validateBudgetRule();
}
function updateNeedsWantsPanelDesc(){
  const br=S.budgetRule||{needs:50,wants:30,savings:20};
  const nd=document.getElementById('needsPanelDesc');
  const wd=document.getElementById('wantsPanelDesc');
  if(nd)nd.textContent=`Auto-deducted from your ${br.needs}% Needs budget each month`;
  if(wd)wd.textContent=`Auto-deducted from your ${br.wants}% Wants budget each month`;
}
function validateBudgetRule(){
  const n=parseInt(document.getElementById('brNeeds').value)||0;
  const w=parseInt(document.getElementById('brWants').value)||0;
  const s=parseInt(document.getElementById('brSavings').value)||0;
  const total=n+w+s;
  const msgEl=document.getElementById('brValidationMsg');
  const saveBtn=document.getElementById('brSaveBtn');
  if(total===100){
    msgEl.innerHTML=`<span style="color:var(--green)"><i class="bi bi-check-circle-fill"></i> Total: ${total}% — Ready to save</span>`;
    if(saveBtn)saveBtn.disabled=false;
  } else {
    msgEl.innerHTML=`<span style="color:${total>100?'var(--red)':'var(--yellow)'}"><i class="bi bi-exclamation-triangle-fill"></i> Total: ${total}% — Must equal 100%</span>`;
    if(saveBtn)saveBtn.disabled=true;
  }
}
function onBudgetRuleInput(){validateBudgetRule();}
function saveBudgetRule(){
  const n=parseInt(document.getElementById('brNeeds').value)||0;
  const w=parseInt(document.getElementById('brWants').value)||0;
  const s=parseInt(document.getElementById('brSavings').value)||0;
  if(n+w+s!==100){toast('Percentages must total 100%','error');return;}
  S.budgetRule={needs:n,wants:w,savings:s};
  persist();
  updateNeedsWantsPanelDesc();
  toast('Budget Rule saved','success');
}
function resetBudgetRule(){
  S.budgetRule={needs:50,wants:30,savings:20};
  persist();
  renderBudgetRulePanel();
  updateNeedsWantsPanelDesc();
  toast('Reset to 50/30/20','success');
}

// ════════════════════════════════
//  DATA MANAGEMENT
// ════════════════════════════════
function exportData(){
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(S,null,2));
  a.download='jns-budget-backup.json';a.click();toast('Backup exported','success');
}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{try{const imp=JSON.parse(ev.target.result);if(!imp.transactions)throw 0;S=imp;persist();navigate('dashboard');toast('Data imported','success');}catch{toast('Invalid backup file','error');}};
  r.readAsText(file);
}
function clearAllData(){
  if(!confirm('Delete ALL data permanently?'))return;
  localStorage.clear();S=loadState();navigate('dashboard');toast('All data cleared');
}

// ════════════════════════════════
//  GOOGLE DRIVE SYNC
// ════════════════════════════════
const GDRIVE_FILE_NAME='jns-budget-cloud.json';
const GDRIVE_MIME='application/json';

function saveGdriveClientId(){
  const val=document.getElementById('gdriveClientId').value.trim();
  localStorage.setItem('jns_gdrive_client_id',val);
}
function toggleAutoSync(on){
  localStorage.setItem('jns_gdrive_autosync',on?'1':'0');
  toast('Auto-sync '+(on?'enabled':'disabled'),'success');
}

function renderGdriveUI(){
  const connected=!!gdriveToken;
  document.getElementById('gdriveSignInBtn').style.display=connected?'none':'';
  document.getElementById('gdriveSyncBtn').style.display=connected?'':'none';
  document.getElementById('gdriveRestoreBtn').style.display=connected?'':'none';
  document.getElementById('gdriveSignOutBtn').style.display=connected?'':'none';
  const statusEl=document.getElementById('gdriveSyncStatus');
  if(connected){
    statusEl.innerHTML=`<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--green-soft);color:var(--green);border-radius:8px;font-size:13px;font-weight:600"><i class="bi bi-cloud-check-fill"></i> Connected to Google Drive</div>`;
  } else {
    statusEl.innerHTML=`<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--surface2);color:var(--text3);border-radius:8px;font-size:13px"><i class="bi bi-cloud-slash"></i> Not connected</div>`;
  }
  // restore saved client id
  const savedId=localStorage.getItem('jns_gdrive_client_id')||'';
  const cidEl=document.getElementById('gdriveClientId');
  if(cidEl)cidEl.value=savedId;
  // restore autosync toggle
  const autoEl=document.getElementById('gdriveAutoSync');
  if(autoEl)autoEl.checked=localStorage.getItem('jns_gdrive_autosync')==='1';
}

function gdriveSignIn(){
  const clientId=document.getElementById('gdriveClientId')?.value.trim()||localStorage.getItem('jns_gdrive_client_id')||'';
  if(!clientId){
    toast('Enter your Google OAuth Client ID first','error');
    return;
  }
  if(typeof google==='undefined'||!google.accounts){
    toast('Google Sign-In not loaded. Check your internet connection.','error');
    return;
  }
  google.accounts.oauth2.initTokenClient({
    client_id:clientId,
    scope:'https://www.googleapis.com/auth/drive.appdata',
    callback:(resp)=>{
      if(resp.error){toast('Sign-in failed: '+resp.error,'error');return;}
      gdriveToken=resp.access_token;
      localStorage.setItem('jns_gdrive_token_hint','connected');
      renderGdriveUI();
      toast('Connected to Google Drive!','success');
    }
  }).requestAccessToken();
}

function gdriveSignOut(){
  if(gdriveToken&&typeof google!=='undefined'){
    google.accounts.oauth2.revoke(gdriveToken,()=>{});
  }
  gdriveToken=null;
  localStorage.removeItem('jns_gdrive_token_hint');
  renderGdriveUI();
  toast('Disconnected from Google Drive','info');
}

async function gdriveFindFile(){
  const r=await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27'+encodeURIComponent(GDRIVE_FILE_NAME)+'%27&fields=files(id,name,modifiedTime)',{
    headers:{Authorization:'Bearer '+gdriveToken}
  });
  const data=await r.json();
  return data.files&&data.files.length?data.files[0]:null;
}

async function gdriveSyncNow(){
  if(!gdriveToken){toast('Connect Google Drive first','error');return;}
  const btn=document.getElementById('gdriveSyncBtn');
  btn.disabled=true;btn.innerHTML='<i class="bi bi-arrow-repeat spin"></i> Syncing...';
  try{
    const json=JSON.stringify(S,null,2);
    const existing=await gdriveFindFile();
    let url,method;
    if(existing){
      url=`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
      method='PATCH';
    } else {
      // Create with metadata in appDataFolder
      const meta=new Blob([JSON.stringify({name:GDRIVE_FILE_NAME,parents:['appDataFolder']})],{type:'application/json'});
      const content=new Blob([json],{type:GDRIVE_MIME});
      const form=new FormData();
      form.append('metadata',meta);
      form.append('file',content);
      const cr=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
        method:'POST',headers:{Authorization:'Bearer '+gdriveToken},body:form
      });
      if(!cr.ok)throw new Error('Create failed');
      const now=new Date().toLocaleString();
      document.getElementById('gdriveSyncLog').innerHTML=`<i class="bi bi-check-circle" style="color:var(--green)"></i> Last synced: ${now}`;
      toast('Synced to Google Drive!','success');
      btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-up"></i> Sync Now';
      return;
    }
    const r2=await fetch(url,{method,headers:{Authorization:'Bearer '+gdriveToken,'Content-Type':GDRIVE_MIME},body:json});
    if(!r2.ok)throw new Error('Upload failed');
    const now=new Date().toLocaleString();
    document.getElementById('gdriveSyncLog').innerHTML=`<i class="bi bi-check-circle" style="color:var(--green)"></i> Last synced: ${now}`;
    toast('Synced to Google Drive!','success');
  }catch(e){
    toast('Sync failed: '+e.message,'error');
    document.getElementById('gdriveSyncLog').innerHTML=`<i class="bi bi-x-circle" style="color:var(--red)"></i> Sync failed: ${e.message}`;
  }
  btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-up"></i> Sync Now';
}

async function gdriveRestore(){
  if(!gdriveToken){toast('Connect Google Drive first','error');return;}
  if(!confirm('Restore data from Google Drive? This will overwrite your current local data.'))return;
  const btn=document.getElementById('gdriveRestoreBtn');
  btn.disabled=true;btn.innerHTML='<i class="bi bi-arrow-repeat spin"></i> Restoring...';
  try{
    const file=await gdriveFindFile();
    if(!file){toast('No backup found in Google Drive','error');btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-down"></i> Restore from Drive';return;}
    const r=await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,{
      headers:{Authorization:'Bearer '+gdriveToken}
    });
    const imp=await r.json();
    if(!imp.transactions)throw new Error('Invalid backup');
    S=imp;persist();navigate('dashboard');
    toast('Data restored from Google Drive!','success');
  }catch(e){
    toast('Restore failed: '+e.message,'error');
  }
  btn.disabled=false;btn.innerHTML='<i class="bi bi-cloud-arrow-down"></i> Restore from Drive';
}

// ════════════════════════════════
//  INIT
// ════════════════════════════════
applyDark();
initDashFilters();
renderDashboard();