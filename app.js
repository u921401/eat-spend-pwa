const STORAGE_KEY = 'eatSpend.meals.v1';
const SETTINGS_KEY = 'eatSpend.settings.v1';

const defaultSettings = { calories: 1800, protein: 100, budget: 400 };
let meals = loadJSON(STORAGE_KEY, []);
let settings = { ...defaultSettings, ...loadJSON(SETTINGS_KEY, {}) };

const $ = (id) => document.getElementById(id);

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatMoney(n) {
  return Math.round(Number(n || 0)).toLocaleString('zh-TW');
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1600);
}

function setPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.target === name));
  if (name === 'add') prepareAddForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prepareAddForm() {
  if (!$('mealDate').value) $('mealDate').value = localDateString();
  if (!$('mealTime').value) $('mealTime').value = currentTimeString();
}

function render() {
  const today = localDateString();
  const dateLabel = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
  $('todayLabel').textContent = dateLabel;

  const todayMeals = meals
    .filter(m => m.date === today)
    .sort((a, b) => b.time.localeCompare(a.time));

  const totals = todayMeals.reduce((acc, m) => {
    acc.calories += Number(m.calories || 0);
    acc.protein += Number(m.protein || 0);
    acc.cost += Number(m.cost || 0);
    return acc;
  }, { calories: 0, protein: 0, cost: 0 });

  const remainingCalories = Math.max(0, settings.calories - totals.calories);
  const remainingBudget = Math.max(0, settings.budget - totals.cost);

  $('remainingCalories').textContent = formatNumber(remainingCalories);
  $('remainingBudget').textContent = `NT$${formatMoney(remainingBudget)}`;
  $('calorieUsed').textContent = formatNumber(totals.calories);
  $('budgetUsed').textContent = formatMoney(totals.cost);
  $('proteinUsed').textContent = formatNumber(totals.protein);
  $('calorieGoalText').textContent = formatNumber(settings.calories);
  $('budgetGoalText').textContent = formatMoney(settings.budget);
  $('proteinGoalText').textContent = formatNumber(settings.protein);

  setProgress('calorie', totals.calories, settings.calories);
  setProgress('budget', totals.cost, settings.budget);
  setProgress('protein', totals.protein, settings.protein);

  $('todayList').innerHTML = renderMealCards(todayMeals, true);
  $('recordsList').innerHTML = renderMealCards([...meals].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)), false);

  $('goalCalories').value = settings.calories;
  $('goalProtein').value = settings.protein;
  $('goalBudget').value = settings.budget;
}

function setProgress(prefix, used, goal) {
  const pct = goal > 0 ? Math.round((used / goal) * 100) : 0;
  $(`${prefix}Pct`).textContent = `${pct}%`;
  $(`${prefix}Bar`).style.width = `${Math.min(100, pct)}%`;
}

function renderMealCards(list, todayMode) {
  if (!list.length) {
    return `<div class="empty"><strong>${todayMode ? '今天還沒有紀錄' : '還沒有任何紀錄'}</strong>${todayMode ? '按「＋ 新增」記下第一餐。' : '新增的餐點會出現在這裡。'}</div>`;
  }

  return list.map(m => `
    <article class="meal-card">
      <div>
        <h3>${escapeHTML(m.food)}</h3>
        <p class="meal-meta">${escapeHTML(m.mealType)} · ${escapeHTML(m.date)} ${escapeHTML(m.time)}</p>
      </div>
      <div class="meal-numbers">
        <strong>${formatNumber(m.calories)} kcal</strong>
        <span>NT$${formatMoney(m.cost)} · ${formatNumber(m.protein)}g 蛋白質</span>
      </div>
      <div class="meal-actions"><button class="small-danger" data-delete="${m.id}">刪除</button></div>
    </article>`).join('');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => setPage(btn.dataset.target));
});

$('quickAddBtn').addEventListener('click', () => setPage('add'));
$('addFromTodayBtn').addEventListener('click', () => setPage('add'));

$('mealForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const meal = {
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    food: $('food').value.trim(),
    mealType: $('mealType').value,
    cost: Number($('cost').value),
    calories: Number($('calories').value),
    protein: Number($('protein').value || 0),
    date: $('mealDate').value,
    time: $('mealTime').value
  };
  meals.push(meal);
  saveState();
  $('mealForm').reset();
  render();
  setPage('today');
  showToast('已加入飲食紀錄');
});

$('settingsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  settings = {
    calories: Number($('goalCalories').value),
    protein: Number($('goalProtein').value),
    budget: Number($('goalBudget').value)
  };
  saveState();
  render();
  showToast('設定已儲存');
});

$('clearDataBtn').addEventListener('click', () => {
  if (!confirm('確定要清除所有測試資料嗎？這個動作無法復原。')) return;
  meals = [];
  saveState();
  render();
  showToast('測試資料已清除');
});

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-delete]');
  if (!btn) return;
  const id = btn.dataset.delete;
  meals = meals.filter(m => m.id !== id);
  saveState();
  render();
  showToast('已刪除');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

prepareAddForm();
render();
