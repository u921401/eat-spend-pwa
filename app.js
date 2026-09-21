const STORAGE_KEY = 'eatSpend.meals.v1';
const SETTINGS_KEY = 'eatSpend.settings.v2';
const PROFILE_KEY = 'eatSpend.profile.v1';
const CHECKIN_KEY = 'eatSpend.checkins.v1';

const defaultSettings = { calories: 1800, budget: 400 };
const defaultProfile = { height: '', weight: '', age: '', sex: '', activity: 1.2 };

let meals = loadJSON(STORAGE_KEY, []);
let settings = { ...defaultSettings, ...loadJSON(SETTINGS_KEY, migrateOldSettings()) };
let profile = { ...defaultProfile, ...loadJSON(PROFILE_KEY, {}) };
let checkins = loadJSON(CHECKIN_KEY, []);

const $ = (id) => document.getElementById(id);

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function migrateOldSettings() {
  const old = loadJSON('eatSpend.settings.v1', {});
  return {
    calories: Number(old.calories || defaultSettings.calories),
    budget: Number(old.budget || defaultSettings.budget)
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkins));
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromLocalString(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, delta) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + delta);
  return copy;
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

function calculateSuggestedCalories() {
  const height = Number($('profileHeight').value);
  const weight = Number($('profileWeight').value);
  const age = Number($('profileAge').value);
  const sex = $('profileSex').value;
  const activity = Number($('profileActivity').value);

  if (!height || !weight || !age || !sex || !activity) {
    showToast('請先填完整基本資料');
    return null;
  }

  const bmr = sex === 'male'
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;

  return Math.round(bmr * activity);
}

function renderEstimate() {
  if (!profile.height || !profile.weight || !profile.age || !profile.sex || !profile.activity) {
    $('estimateBox').hidden = true;
    return;
  }

  const bmr = profile.sex === 'male'
    ? (10 * Number(profile.weight)) + (6.25 * Number(profile.height)) - (5 * Number(profile.age)) + 5
    : (10 * Number(profile.weight)) + (6.25 * Number(profile.height)) - (5 * Number(profile.age)) - 161;
  const estimate = Math.round(bmr * Number(profile.activity));
  $('estimatedCalories').textContent = formatNumber(estimate);
  $('estimateBox').hidden = false;
}

function getStreak() {
  if (!checkins.length) return 0;
  const unique = new Set(checkins);
  const today = new Date();
  const todayKey = localDateString(today);
  let cursor = unique.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;

  while (unique.has(localDateString(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function renderCheckin() {
  const today = localDateString();
  const checked = checkins.includes(today);
  $('streakCount').textContent = getStreak();
  $('totalCheckins').textContent = new Set(checkins).size;
  $('checkinBtn').textContent = checked ? '今天已簽到 ✓' : '今日簽到';
  $('checkinBtn').disabled = checked;
  $('checkinBtn').classList.toggle('done', checked);
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
    acc.cost += Number(m.cost || 0);
    return acc;
  }, { calories: 0, cost: 0 });

  const remainingCalories = Math.max(0, settings.calories - totals.calories);
  const remainingBudget = Math.max(0, settings.budget - totals.cost);

  $('remainingCalories').textContent = formatNumber(remainingCalories);
  $('remainingBudget').textContent = `NT$${formatMoney(remainingBudget)}`;
  $('calorieUsed').textContent = formatNumber(totals.calories);
  $('budgetUsed').textContent = formatMoney(totals.cost);
  $('calorieGoalText').textContent = formatNumber(settings.calories);
  $('budgetGoalText').textContent = formatMoney(settings.budget);

  setProgress('calorie', totals.calories, settings.calories);
  setProgress('budget', totals.cost, settings.budget);

  $('todayList').innerHTML = renderMealCards(todayMeals, true);
  $('recordsList').innerHTML = renderMealCards([...meals].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)), false);

  $('goalCalories').value = settings.calories;
  $('goalBudget').value = settings.budget;
  $('profileHeight').value = profile.height;
  $('profileWeight').value = profile.weight;
  $('profileAge').value = profile.age;
  $('profileSex').value = profile.sex;
  $('profileActivity').value = String(profile.activity || 1.2);

  renderEstimate();
  renderCheckin();
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
        <span>NT$${formatMoney(m.cost)}</span>
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

$('calculateCaloriesBtn').addEventListener('click', () => {
  const estimate = calculateSuggestedCalories();
  if (estimate === null) return;

  profile = {
    height: Number($('profileHeight').value),
    weight: Number($('profileWeight').value),
    age: Number($('profileAge').value),
    sex: $('profileSex').value,
    activity: Number($('profileActivity').value)
  };
  $('estimatedCalories').textContent = formatNumber(estimate);
  $('estimateBox').hidden = false;
  $('goalCalories').value = estimate;
  showToast('已帶入估算熱量');
});

$('settingsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  profile = {
    height: Number($('profileHeight').value) || '',
    weight: Number($('profileWeight').value) || '',
    age: Number($('profileAge').value) || '',
    sex: $('profileSex').value,
    activity: Number($('profileActivity').value) || 1.2
  };
  settings = {
    calories: Number($('goalCalories').value),
    budget: Number($('goalBudget').value)
  };
  saveState();
  render();
  showToast('設定已儲存');
});

$('checkinBtn').addEventListener('click', () => {
  const today = localDateString();
  if (!checkins.includes(today)) checkins.push(today);
  saveState();
  renderCheckin();
  showToast('今日簽到完成');
});

$('clearDataBtn').addEventListener('click', () => {
  if (!confirm('確定要清除所有測試資料嗎？飲食紀錄、簽到與設定都會清除，且無法復原。')) return;
  meals = [];
  settings = { ...defaultSettings };
  profile = { ...defaultProfile };
  checkins = [];
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
