/* ============================================================
   CONSTANTS
   ============================================================ */
const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQXNDCi3Kk4CGeuqp1j_uU9EtRsI3JKznBXXp-9ikkCOWt_odbPLp32EIeqHoWadgJCQ/exec';

const CATS = [
  { id: 'food',          label: 'Food',          emoji: '🍔', color: '#ff8c42' },
  { id: 'transport',     label: 'Transport',      emoji: '🚌', color: '#4da6ff' },
  { id: 'shopping',      label: 'Shopping',       emoji: '🛍️', color: '#c77dff' },
  { id: 'health',        label: 'Health',         emoji: '💊', color: '#ff5e5e' },
  { id: 'bills',         label: 'Bills',          emoji: '💡', color: '#ffaa00' },
  { id: 'entertainment', label: 'Entertainment',  emoji: '🎮', color: '#4ecdc4' },
  { id: 'education',     label: 'Education',      emoji: '📚', color: '#a78bfa' },
  { id: 'other',         label: 'Other',          emoji: '📦', color: '#888888' },
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const BUCKET_RULES = { needs: 0.50, wants: 0.30, savings: 0.20 };

/* ============================================================
   STATE
   ============================================================ */
let SCRIPT_URL = '';
let STATE = {
  transactions:  [],
  currentMonth:  new Date().getMonth(),
  currentYear:   new Date().getFullYear(),
  selectedType:  'expense',
  selectedCat:   'food',
  selectedBucket: 'needs',
  theme:         'dark',
};

/* ============================================================
   API
   ============================================================ */
async function api(action, body = {}) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ============================================================
   SETUP & CONNECTION
   ============================================================ */
async function connectScript() {
  const url    = document.getElementById('script-url').value.trim();
  const errEl  = document.getElementById('setup-error');
  errEl.style.display = 'none';

  if (!url || !url.includes('script.google.com')) {
    errEl.textContent = 'Please paste a valid Apps Script Web App URL.';
    errEl.style.display = 'block';
    return;
  }

  SCRIPT_URL = url;
  showLoading('Connecting to your sheet…');

  try {
    const data = await api('getAll');
    STATE.transactions = (data.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem('budget_script_url', url);
    launchApp();
  } catch (e) {
    hideLoading();
    errEl.textContent = 'Could not connect. Make sure the script is saved, deployed as Web App, and access is set to "Anyone". Error: ' + e.message;
    errEl.style.display = 'block';
    SCRIPT_URL = '';
  }
}

function launchApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  hideLoading();
  buildCatSelect();
  buildHistoryFilters();
  buildAnalyticsFilters();
  renderDashboard();
  setDateDefault();
  toast('Connected! Welcome back. 👋', 'success');
}

function disconnect() {
  if (!confirm('Lock the app?')) return;
  sessionStorage.removeItem('budget_auth');
  location.reload();
}

/* ============================================================
   LOADING & SYNC INDICATORS
   ============================================================ */
function showLoading(txt) {
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('loading-text').textContent = txt;
}
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

function setSyncing(s) {
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  dot.className  = 'sync-dot ' + s;
  text.textContent = s === 'syncing' ? 'saving…' : s === 'error' ? 'error' : 'live';
}

let _toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = '', 3000);
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('budget_theme', STATE.theme);
  updateThemeIcons();
}

function updateThemeIcons() {
  const isDark = STATE.theme === 'dark';
  document.querySelectorAll('.icon-moon').forEach(el => el.style.display = isDark ? '' : 'none');
  document.querySelectorAll('.icon-sun').forEach(el  => el.style.display = isDark ? 'none' : '');
}

/* ============================================================
   VIEW ROUTING
   ============================================================ */
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  add: 'Add Entry',
  budget50: '5.3.2 Plan',
  history: 'History',
  analytics: 'Analytics',
};

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(t => {
    t.classList.toggle('active', t.dataset.view === name);
  });
  document.getElementById('view-' + name).classList.add('active');

  // Update mobile topbar title
  const titleEl = document.getElementById('mobile-page-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[name] || '';

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) closeSidebar();

  if (name === 'dashboard') renderDashboard();
  if (name === 'budget50')  renderBudget50();
  if (name === 'history')   { buildHistoryFilters(); renderHistory(); }
  if (name === 'analytics') { buildAnalyticsFilters(); renderAnalytics(); }
}

/* ============================================================
   FORMATTING
   ============================================================ */
function fmt(n) {
  return '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n) {
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return '₱' + (n / 1000).toFixed(1) + 'k';
  return fmt(n);
}
function catInfo(id) {
  return CATS.find(c => c.id === id) || CATS[CATS.length - 1];
}

/* ============================================================
   MONTH NAVIGATION
   ============================================================ */
function changeMonth(dir) {
  STATE.currentMonth += dir;
  if (STATE.currentMonth < 0)  { STATE.currentMonth = 11; STATE.currentYear--; }
  if (STATE.currentMonth > 11) { STATE.currentMonth = 0;  STATE.currentYear++; }

  // update all month labels
  const label = `${MONTHS[STATE.currentMonth]} ${STATE.currentYear}`;
  document.querySelectorAll('#month-label, #budget-month-label').forEach(el => el.textContent = label);

  // re-render active view
  const active = document.querySelector('.view.active');
  if (active) {
    const id = active.id.replace('view-', '');
    if (id === 'dashboard') renderDashboard();
    if (id === 'budget50')  renderBudget50();
  }
}

function monthTxns(m, y) {
  return STATE.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const { currentMonth: m, currentYear: y } = STATE;
  const label = `${MONTHS[m]} ${y}`;
  document.querySelectorAll('#month-label, #budget-month-label').forEach(el => el.textContent = label);

  const txns    = monthTxns(m, y);
  const expenses = txns.filter(t => t.type === 'expense');
  const incomes  = txns.filter(t => t.type === 'income');
  const spent   = expenses.reduce((s, t) => s + t.amount, 0);
  const income  = incomes.reduce((s, t)  => s + t.amount, 0);
  const balance = income - spent;

  document.getElementById('dash-spent').textContent     = fmt(spent);
  document.getElementById('dash-tx-count').textContent  = `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}`;
  document.getElementById('dash-income').textContent    = fmt(income);
  document.getElementById('dash-inc-count').textContent = `${incomes.length} entr${incomes.length !== 1 ? 'ies' : 'y'}`;
  const balEl = document.getElementById('dash-balance');
  balEl.textContent = (balance >= 0 ? '+' : '-') + fmt(balance);
  balEl.style.color = balance >= 0 ? 'var(--accent)' : 'var(--danger)';

  // Category breakdown
  const totals = {};
  expenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const max    = Math.max(...Object.values(totals), 1);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  document.getElementById('cat-breakdown').innerHTML = sorted.length
    ? sorted.map(([id, amt]) => {
        const cat = catInfo(id);
        const pct = (amt / max * 100).toFixed(1);
        return `<div class="cat-row">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <div class="cat-name">${cat.label}</div>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div></div>
          <div class="cat-amount" style="color:${cat.color}">${fmt(amt)}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state" style="padding:1rem 0"><p>No expenses this month</p></div>';

  // Recent transactions
  const recent = txns.slice(0, 8);
  document.getElementById('recent-txns').innerHTML = recent.length
    ? recent.map(t => {
        const cat = t.type === 'income'
          ? { emoji: '💰', color: 'var(--accent)', label: 'Income' }
          : catInfo(t.category);
        return `<div class="txn-item">
          <div class="txn-icon" style="background:${cat.color}22">${cat.emoji}</div>
          <div class="txn-info">
            <div class="txn-desc">${t.desc || cat.label}</div>
            <div class="txn-meta">${cat.label} · ${t.date}</div>
          </div>
          <div class="txn-amount ${t.type === 'income' ? 'positive' : ''}">
            ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-state" style="padding:1rem 0"><p>No activity this month</p></div>';
}

/* ============================================================
   ADD FORM
   ============================================================ */
function buildCatSelect() {
  const sel = document.getElementById('cat-select');
  sel.innerHTML = CATS.map(c =>
    `<option value="${c.id}">${c.emoji} ${c.label}</option>`
  ).join('');
  sel.value = STATE.selectedCat;
}

function setDateDefault() {
  document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
}

function setType(type) {
  STATE.selectedType = type;
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('type-income').classList.toggle('active', type === 'income');
  document.getElementById('cat-group').style.display        = type === 'income' ? 'none' : 'block';
  document.getElementById('budget-bucket-group').style.display = type === 'income' ? 'none' : 'block';
}

function selectBucket(bucket) {
  STATE.selectedBucket = bucket;
  document.querySelectorAll('.bucket-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bucket === bucket);
  });
}

async function submitEntry() {
  const amount = parseFloat(document.getElementById('add-amount').value);
  const date   = document.getElementById('add-date').value;
  const desc   = document.getElementById('add-desc').value.trim();
  const notes  = document.getElementById('add-notes').value.trim();
  const cat    = document.getElementById('cat-select').value;

  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (!date)                  { toast('Select a date', 'error'); return; }
  if (!desc)                  { toast('Add a description', 'error'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';
  setSyncing('syncing');

  const id       = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const category = STATE.selectedType === 'income' ? 'income' : cat;
  const bucket   = STATE.selectedType === 'expense' ? STATE.selectedBucket : null;
  const entry    = { id, date, type: STATE.selectedType, category, desc, amount, notes, bucket };

  try {
    await api('addTx', entry);
    STATE.transactions.unshift(entry);
    STATE.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Reset form
    document.getElementById('add-amount').value = '';
    document.getElementById('add-desc').value   = '';
    document.getElementById('add-notes').value  = '';
    setDateDefault();

    setSyncing('live');
    toast('Entry saved! ✓', 'success');
    showView('dashboard');
  } catch (e) {
    setSyncing('error');
    toast('Save failed: ' + e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Entry';
  }
}

/* ============================================================
   50/30/20 BUDGET VIEW
   ============================================================ */
function renderBudget50() {
  const { currentMonth: m, currentYear: y } = STATE;
  const txns    = monthTxns(m, y);
  const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'expense');

  const noIncomeMsg = document.getElementById('no-income-msg');
  const content     = document.getElementById('budget50-content');

  noIncomeMsg.style.display = income === 0 ? 'flex' : 'none';

  // Always show content, just with 0s if no income
  const needs   = income * BUCKET_RULES.needs;
  const wants   = income * BUCKET_RULES.wants;
  const savings = income * BUCKET_RULES.savings;

  document.getElementById('b50-income').textContent    = fmt(income);
  document.getElementById('b50-needs-target').textContent   = fmt(needs);
  document.getElementById('b50-wants-target').textContent   = fmt(wants);
  document.getElementById('b50-savings-target').textContent = fmt(savings);

  // Separate expenses by bucket (manual selection)
  const needsTxns   = expenses.filter(t => t.bucket === 'needs');
  const wantsTxns   = expenses.filter(t => t.bucket === 'wants');
  const savingsTxns = expenses.filter(t => t.bucket === 'savings');
  // Unassigned fallback
  const unassigned  = expenses.filter(t => !t.bucket);

  const needsSpent   = needsTxns.reduce((s, t) => s + t.amount, 0);
  const wantsSpent   = wantsTxns.reduce((s, t) => s + t.amount, 0);
  const savingsSpent = savingsTxns.reduce((s, t) => s + t.amount, 0);

  const totalAllocated = needsSpent + wantsSpent + savingsSpent;
  const remaining = income - totalAllocated;

  document.getElementById('b50-allocated').textContent = fmt(totalAllocated);
  const remEl = document.getElementById('b50-remaining');
  remEl.textContent = (remaining >= 0 ? '' : '-') + fmt(remaining);
  remEl.style.color = remaining >= 0 ? 'var(--accent)' : 'var(--danger)';

  // Progress bars
  function setPct(barId, spentId, pctId, spent, target, bucketColor) {
    const pct = target > 0 ? Math.min(spent / target * 100, 100) : 0;
    const over = target > 0 && spent > target;
    const bar  = document.getElementById(barId);
    bar.style.width = pct + '%';
    if (over) bar.style.background = 'var(--danger)';
    document.getElementById(spentId).textContent = fmt(spent) + (over ? ' ⚠ Over!' : ' spent');
    document.getElementById(pctId).textContent   = pct.toFixed(0) + '%';
  }

  setPct('b50-needs-bar',   'b50-needs-spent',   'b50-needs-pct',   needsSpent,   needs,   'needs');
  setPct('b50-wants-bar',   'b50-wants-spent',   'b50-wants-pct',   wantsSpent,   wants,   'wants');
  setPct('b50-savings-bar', 'b50-savings-spent', 'b50-savings-pct', savingsSpent, savings, 'savings');

  // Transaction lists
  function renderBucketTxns(containerId, txnsList) {
    const el = document.getElementById(containerId);
    if (!txnsList.length) {
      el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:0.5rem 0">No entries yet</div>';
      return;
    }
    el.innerHTML = txnsList.slice(0, 5).map(t => {
      const cat = catInfo(t.category);
      return `<div class="bucket-txn-item">
        <span style="margin-right:6px">${cat.emoji}</span>
        <span class="bucket-txn-desc">${t.desc}</span>
        <span class="bucket-txn-amt">-${fmt(t.amount)}</span>
      </div>`;
    }).join('') + (txnsList.length > 5
      ? `<div style="font-size:11px;color:var(--muted);padding:0.4rem 0;text-align:center">+${txnsList.length - 5} more</div>`
      : '');
  }

  renderBucketTxns('b50-needs-txns',   needsTxns);
  renderBucketTxns('b50-wants-txns',   wantsTxns);
  renderBucketTxns('b50-savings-txns', savingsTxns);
}

/* ============================================================
   HISTORY
   ============================================================ */
function buildHistoryFilters() {
  const months = [...new Set(STATE.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  document.getElementById('hist-month').innerHTML =
    '<option value="">All months</option>' +
    months.map(m => `<option value="${m}">${MONTHS[parseInt(m.split('-')[1]) - 1]} ${m.split('-')[0]}</option>`).join('');

  document.getElementById('hist-cat').innerHTML =
    '<option value="">All categories</option>' +
    CATS.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('') +
    '<option value="income">💰 Income</option>';
}

function renderHistory() {
  const mF   = document.getElementById('hist-month').value;
  const cF   = document.getElementById('hist-cat').value;
  const tF   = document.getElementById('hist-type').value;

  const txns = STATE.transactions.filter(t => {
    if (mF && !t.date.startsWith(mF)) return false;
    if (cF && t.category !== cF)      return false;
    if (tF && t.type !== tF)          return false;
    return true;
  });

  const el = document.getElementById('history-table');

  if (!txns.length) {
    el.innerHTML = '<div class="empty-state"><div class="ei">📭</div><p>No transactions match</p></div>';
    return;
  }

  el.innerHTML = `<table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Category</th>
        <th>Bucket</th>
        <th>Type</th>
        <th style="text-align:right">Amount</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${txns.map(t => {
        const cat = t.type === 'income'
          ? { emoji: '💰', label: 'Income', color: 'var(--accent)' }
          : catInfo(t.category);
        const bucketMap = { needs: '🏠 Needs', wants: '🎉 Wants', savings: '💰 Savings' };
        const bucketLabel = t.bucket ? bucketMap[t.bucket] : '—';
        return `<tr>
          <td style="font-family:'Roboto Mono',monospace;font-size:12px;color:var(--muted)">${t.date}</td>
          <td style="font-weight:500">${t.desc}</td>
          <td><span class="badge" style="background:${cat.color}22;color:${cat.color}">${cat.emoji} ${cat.label}</span></td>
          <td style="font-size:12px;color:var(--muted)">${bucketLabel}</td>
          <td style="color:var(--muted);font-size:12px;text-transform:capitalize">${t.type}</td>
          <td style="text-align:right;font-family:'Roboto Mono',monospace;color:${t.type === 'income' ? 'var(--accent)' : 'var(--text)'}">
            ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
          </td>
          <td><button class="delete-btn" onclick="deleteEntry('${t.id}')">×</button></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  setSyncing('syncing');
  try {
    await api('deleteTx', { id });
    STATE.transactions = STATE.transactions.filter(t => t.id !== id);
    setSyncing('live');
    toast('Deleted', 'success');
    renderHistory();
    renderDashboard();
  } catch (e) {
    setSyncing('error');
    toast('Delete failed: ' + e.message, 'error');
  }
}

/* ============================================================
   ANALYTICS
   ============================================================ */
function buildAnalyticsFilters() {
  const months = [...new Set(STATE.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  document.getElementById('analytics-month').innerHTML =
    '<option value="">All months</option>' +
    months.map(m => `<option value="${m}">${MONTHS[parseInt(m.split('-')[1]) - 1]} ${m.split('-')[0]}</option>`).join('');
}

function renderAnalytics() {
  const mF = document.getElementById('analytics-month').value;

  let txns = STATE.transactions;
  if (mF) txns = txns.filter(t => t.date.startsWith(mF));

  renderTrendChart(txns, mF);
  renderIncomeVsExpenseChart(txns, mF);
  renderAnalyticsCatBreakdown(txns);
}

function renderTrendChart(allTxns, monthFilter) {
  const wrap = document.getElementById('chart-trend');

  // Build monthly data
  const monthMap = {};
  allTxns.filter(t => t.type === 'expense').forEach(t => {
    const key = t.date.slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + t.amount;
  });

  const months = Object.keys(monthMap).sort();
  if (!months.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:2rem 0"><p>No data yet</p></div>';
    return;
  }

  const max = Math.max(...Object.values(monthMap), 1);
  const bars = months.slice(-12).map(m => {
    const pct = (monthMap[m] / max * 100);
    const label = MONTHS[parseInt(m.split('-')[1]) - 1].slice(0, 3) + ' ' + m.split('-')[0].slice(2);
    return `<div class="chart-bar-col">
      <div class="chart-bar" style="height:${Math.max(pct, 2)}%;background:var(--accent);opacity:0.85"
           data-tip="${label}: ${fmtShort(monthMap[m])}"></div>
      <div class="chart-bar-lbl">${label}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="chart-bars">${bars}</div>`;
}

function renderIncomeVsExpenseChart(allTxns, monthFilter) {
  const wrap = document.getElementById('chart-income-vs-expense');

  const monthMap = {};
  allTxns.forEach(t => {
    const key = t.date.slice(0, 7);
    if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
    if (t.type === 'income')  monthMap[key].income  += t.amount;
    if (t.type === 'expense') monthMap[key].expense += t.amount;
  });

  const months = Object.keys(monthMap).sort();
  if (!months.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:2rem 0"><p>No data yet</p></div>';
    return;
  }

  const allVals = months.flatMap(m => [monthMap[m].income, monthMap[m].expense]);
  const max     = Math.max(...allVals, 1);

  const bars = months.slice(-12).map(m => {
    const d     = monthMap[m];
    const iPct  = (d.income  / max * 100);
    const ePct  = (d.expense / max * 100);
    const label = MONTHS[parseInt(m.split('-')[1]) - 1].slice(0, 3);
    return `<div class="double-bar-col">
      <div class="double-bars">
        <div class="double-bar" style="height:${Math.max(iPct, 2)}%;background:var(--accent);opacity:0.85"
             data-tip="Income ${label}: ${fmtShort(d.income)}"></div>
        <div class="double-bar" style="height:${Math.max(ePct, 2)}%;background:var(--danger);opacity:0.85"
             data-tip="Expense ${label}: ${fmtShort(d.expense)}"></div>
      </div>
      <div class="chart-bar-lbl">${label}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="chart-bars">${bars}</div>
    <div class="chart-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div>Income</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--danger)"></div>Expenses</div>
    </div>`;
}

function renderAnalyticsCatBreakdown(txns) {
  const expenses = txns.filter(t => t.type === 'expense');
  const totals   = {};
  expenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);
  const max    = Math.max(...sorted.map(([, v]) => v), 1);

  const el = document.getElementById('analytics-cat-breakdown');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state" style="padding:1.5rem 0"><p>No expense data</p></div>';
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;padding:0.5rem 0">
    ${sorted.map(([id, amt]) => {
      const cat = catInfo(id);
      const pct = (amt / total * 100).toFixed(1);
      const barPct = (amt / max * 100).toFixed(1);
      return `<div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span>${cat.emoji}</span>
          <span style="font-size:13px;font-weight:500;flex:1">${cat.label}</span>
          <span style="font-family:'Roboto Mono',monospace;font-size:12px;color:${cat.color}">${fmt(amt)}</span>
          <span style="font-family:'Roboto Mono',monospace;font-size:10px;color:var(--muted)">${pct}%</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${barPct}%;background:${cat.color}"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ============================================================
   SIDEBAR TOGGLE
   ============================================================ */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

/* Close sidebar when a nav item is clicked on mobile */
(function patchShowView() {
  const orig = window.showView;
  window._showViewOrig = orig;
})();

/* ============================================================
   AUTH
   ============================================================ */
const PASSWORD_HASH = '688787d8ff144c502c7f5cffaafe2cc588d86079f9de88304c26b0cb99ce91c6';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function submitLogin() {
  const pw    = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!pw) {
    errEl.textContent = 'Please enter your password.';
    errEl.style.display = 'block';
    return;
  }

  const hash = await sha256(pw);
  if (hash !== PASSWORD_HASH) {
    errEl.textContent = 'Incorrect password. Try again.';
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    return;
  }

  // Store session (tab-only)
  sessionStorage.setItem('budget_auth', '1');
  document.getElementById('login-screen').style.display = 'none';
  bootApp();
}

async function bootApp() {
  // Restore theme
  const savedTheme = localStorage.getItem('budget_theme') || 'dark';
  STATE.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons();

  selectBucket('needs');

  SCRIPT_URL = HARDCODED_SCRIPT_URL;
  showLoading('Loading your data…');
  try {
    const data = await api('getAll');
    STATE.transactions = (data.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    launchApp();
  } catch (e) {
    hideLoading();
    document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:sans-serif;background:var(--bg);color:var(--text)">
      <div style="max-width:400px;text-align:center">
        <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
        <div style="font-weight:700;margin-bottom:0.5rem">Could not connect</div>
        <div style="color:var(--muted);font-size:13px">${e.message}</div>
        <button onclick="location.reload()" style="margin-top:1.5rem;padding:0.75rem 1.5rem;background:var(--accent);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-weight:700">Retry</button>
      </div>
    </div>`;
  }
}

/* ============================================================
   INIT
   ============================================================ */
(async function init() {
  // Restore theme early so login screen is themed correctly
  const savedTheme = localStorage.getItem('budget_theme') || 'dark';
  STATE.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons();

  // Check session
  if (sessionStorage.getItem('budget_auth') === '1') {
    document.getElementById('login-screen').style.display = 'none';
    bootApp();
  } else {
    // Show login, focus the input
    setTimeout(() => {
      const el = document.getElementById('login-password');
      if (el) el.focus();
    }, 100);
  }
})();