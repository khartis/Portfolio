/* ---------- Storage ---------- */
const SETTINGS_KEY = 'wt_settings_v1';
const COMPLETIONS_KEY = 'wt_completions_v1';

const DEFAULT_SETTINGS = {
  raceName: 'Half Marathon (21.1km)',
  raceDate: '2026-10-25',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadCompletions() {
  try {
    return JSON.parse(localStorage.getItem(COMPLETIONS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCompletions(c) {
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(c));
}

let settings = loadSettings();
let completions = loadCompletions();

/* ---------- Date helpers ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function startOfDay(d) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function addDays(d, n) { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; }
function diffDays(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 86400000); }
function getMonday(d) {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), diff);
}
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateLabel(d) { return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`; }

function today() { return startOfDay(new Date()); }
function raceDateObj() { return startOfDay(parseDateKey(settings.raceDate)); }

/* ---------- Training plan engine ---------- */
// Templates indexed by "weeks out" from race week (0 = week containing race day).
const WEEK_TEMPLATES = {
  8: { long: '10km long run, easy conversational pace', tempo: '5km incl. 15 min @ tempo effort', easy: '5km @ easy pace', phase: 'Base Building' },
  7: { long: '12km long run, easy pace', tempo: '6km incl. 20 min @ tempo effort', easy: '5km @ easy pace', phase: 'Build Phase' },
  6: { long: '14km long run, easy pace', tempo: '6km incl. 4 x 4 min @ 5K effort (2 min jog recovery)', easy: '6km @ easy pace', phase: 'Build Phase' },
  5: { long: '16km long run, easy pace — last 2km slightly quicker', tempo: '7km incl. 5 x 4 min @ 5K effort', easy: '6km @ easy pace', phase: 'Build Phase' },
  4: { long: '18km long run — your peak long run! Practice race-day fueling.', tempo: '7km incl. 25 min continuous tempo', easy: '6km @ easy pace', phase: 'Peak Week' },
  3: { long: '13km long run, easy & relaxed (cut-back week)', tempo: '6km incl. 4 x 3 min @ 5K effort', easy: '5km @ easy pace', phase: 'Cut-back Week' },
  2: { long: '14km long run, controlled effort', tempo: '6km incl. 20 min @ tempo effort', easy: '5km @ easy pace', phase: 'Taper Begins' },
  1: { long: '10km long run, easy & relaxed', tempo: '4km incl. 6 x 2 min @ race pace', easy: '4km @ easy pace', phase: 'Taper Week' },
};

// Race-week fine schedule, keyed by days remaining before race (1-6).
const RACE_WEEK_TABLE = {
  6: { type: 'run', title: 'Easy Run', detail: '5km @ relaxed, easy pace' },
  5: { type: 'strength', title: 'Light Strength (Optional)', detail: '20 min, bodyweight + light dumbbells, low intensity — just enough to stay loose.' },
  4: { type: 'run', title: 'Easy Run + Strides', detail: '4km easy + 4 x 20s relaxed strides' },
  3: { type: 'rest', title: 'Rest / Mobility', detail: 'Light stretching or full rest. Start thinking about race-day fueling & hydration.' },
  2: { type: 'run', title: 'Shakeout Run', detail: '2-3km very easy, just to keep the legs moving' },
  1: { type: 'rest', title: 'Rest & Prep', detail: 'Full rest. Lay out your race kit, check start time & route, carb-up, hydrate, sleep well.' },
};

function getWeekTemplate(weeksOut) {
  const clamped = Math.min(8, Math.max(1, weeksOut));
  return WEEK_TEMPLATES[clamped];
}

function getDayPlan(date) {
  const race = raceDateObj();

  if (diffDays(date, race) === 0) {
    return { type: 'race', title: `🏁 RACE DAY — ${settings.raceName}`, detail: 'This is it! Trust your training, start conservatively, and enjoy every kilometre.' };
  }

  const daysToRace = diffDays(race, date); // positive = before race, negative = after

  const dateMonday = getMonday(date);
  const raceMonday = getMonday(race);
  const weeksOut = Math.round((raceMonday - dateMonday) / (7 * 86400000));

  if (weeksOut === 0) {
    if (daysToRace < 0) {
      return { type: 'rest', title: 'Recovery', detail: 'Rest, hydrate, and celebrate — you earned it! 🎉' };
    }
    if (RACE_WEEK_TABLE[daysToRace]) return { ...RACE_WEEK_TABLE[daysToRace] };
  }

  const dow = date.getDay(); // 0 Sun .. 6 Sat
  const tmpl = getWeekTemplate(weeksOut);

  switch (dow) {
    case 1: // Monday
      return { type: 'strength', title: 'Strength A — Power & Stability', detail: 'Full home dumbbell session (~35-40 min). See Strength Guide tab.', phase: tmpl.phase };
    case 2: // Tuesday
      return { type: 'run', title: 'Easy Run', detail: tmpl.easy, phase: tmpl.phase };
    case 3: // Wednesday
      return { type: 'rest', title: 'Rest or Mobility', detail: 'Light stretching, foam rolling, or full rest.', phase: tmpl.phase };
    case 4: // Thursday
      return { type: 'run', title: 'Speed / Tempo Run', detail: tmpl.tempo, phase: tmpl.phase };
    case 5: // Friday
      return { type: 'strength', title: 'Strength B — Posterior Chain & Core', detail: 'Full home dumbbell session (~35-40 min). See Strength Guide tab.', phase: tmpl.phase };
    case 6: // Saturday
      return { type: 'rest', title: 'Rest', detail: 'Full rest day — let your legs recover before the long run.', phase: tmpl.phase };
    case 0: // Sunday
      return { type: 'run', title: 'Long Run', detail: tmpl.long, phase: tmpl.phase };
  }
}

/* ---------- Rendering helpers ---------- */
const TYPE_BADGE = { run: 'badge-run', strength: 'badge-strength', rest: 'badge-rest', race: 'badge-race' };
const TYPE_ICON = { run: '🏃', strength: '🏋️', rest: '💤', race: '🏁' };

function dayCardHTML(date) {
  const key = dateKey(date);
  const plan = getDayPlan(date);
  const comp = completions[key] || {};
  const isToday = diffDays(date, today()) === 0;
  const isRace = plan.type === 'race';
  const classes = ['day-card'];
  if (isToday) classes.push('today');
  if (comp.done) classes.push('done');
  if (isRace) classes.push('race-day');

  const badge = `<span class="badge ${TYPE_BADGE[plan.type]}">${TYPE_ICON[plan.type]} ${plan.type}</span>`;
  const canLog = plan.type === 'run' && !isRace;
  const distance = comp.distanceKm != null ? comp.distanceKm : '';
  const duration = comp.durationMin != null ? comp.durationMin : '';
  let pace = '';
  if (comp.distanceKm && comp.durationMin) {
    const p = comp.durationMin / comp.distanceKm;
    const m = Math.floor(p);
    const s = Math.round((p - m) * 60);
    pace = `<p class="day-detail">Logged: ${comp.distanceKm}km in ${comp.durationMin} min &middot; pace ${m}:${pad(s)}/km</p>`;
  }

  return `
  <div class="${classes.join(' ')}" data-date="${key}">
    <div class="day-head">
      <div class="day-head-left">
        <button class="checkbox-btn ${comp.done ? 'checked' : ''}" data-action="toggle" aria-label="Mark done">${comp.done ? '✓' : ''}</button>
        <div class="day-date">${formatDateLabel(date)} <span class="weekday">${isToday ? '(today)' : ''}</span></div>
      </div>
      <div class="day-actions">${badge}</div>
    </div>
    <p class="day-desc"><strong>${plan.title}</strong></p>
    <p class="day-detail">${plan.detail || ''}</p>
    ${pace}
    ${canLog ? `
    <div class="log-form ${comp.done ? 'open' : ''}" data-role="logform">
      <input type="number" min="0" step="0.1" placeholder="distance (km)" data-field="distanceKm" value="${distance}" />
      <input type="number" min="0" step="1" placeholder="time (min)" data-field="durationMin" value="${duration}" />
    </div>` : ''}
  </div>`;
}

function attachDayCardListeners(container) {
  container.querySelectorAll('.day-card').forEach((card) => {
    const key = card.dataset.date;
    const toggleBtn = card.querySelector('[data-action="toggle"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const comp = completions[key] || {};
        comp.done = !comp.done;
        completions[key] = comp;
        saveCompletions(completions);
        renderAll();
      });
    }
    card.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('change', () => {
        const comp = completions[key] || {};
        const val = input.value === '' ? null : Number(input.value);
        comp[input.dataset.field] = val;
        completions[key] = comp;
        saveCompletions(completions);
        renderAll();
      });
    });
  });
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const race = raceDateObj();
  const t = today();
  const daysLeft = diffDays(race, t);

  document.getElementById('raceTitle').textContent = settings.raceName;
  document.getElementById('raceDateLabel').textContent = `Race day: ${formatDateLabel(race)}, ${race.getFullYear()}`;
  document.getElementById('countdownNumber').textContent = daysLeft >= 0 ? daysLeft : 0;
  document.getElementById('bigCountdown').textContent = daysLeft > 0 ? `${daysLeft} days` : (daysLeft === 0 ? 'TODAY!' : 'Completed 🎉');

  const phaseEl = document.getElementById('phaseLabel');
  if (daysLeft < 0) {
    phaseEl.textContent = 'Race complete — nice work!';
  } else {
    const plan = getDayPlan(t);
    phaseEl.textContent = plan.phase ? `${plan.phase}` : (plan.type === 'race' ? 'Race day!' : 'Taper week');
  }

  // This week's days: today .. +6, capped at race date
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, i);
    if (diffDays(d, race) > 0) break;
    days.push(d);
  }

  const dashboardWeek = document.getElementById('dashboardWeek');
  dashboardWeek.innerHTML = days.map(dayCardHTML).join('') || '<p class="empty-msg">Nothing scheduled.</p>';
  attachDayCardListeners(dashboardWeek);

  // Week stats
  let runCount = 0, strengthCount = 0, doneCount = 0;
  days.forEach((d) => {
    const plan = getDayPlan(d);
    if (plan.type === 'run') runCount++;
    if (plan.type === 'strength') strengthCount++;
    if ((completions[dateKey(d)] || {}).done) doneCount++;
  });
  document.getElementById('weekStats').innerHTML = statHTML([
    [runCount, 'Run sessions'],
    [strengthCount, 'Strength sessions'],
    [`${doneCount}/${days.length}`, 'Completed'],
  ]);

  document.getElementById('totalsRow').innerHTML = statHTML(totalsStats());
}

function statHTML(pairs) {
  return pairs.map(([num, lbl]) => `<div class="stat"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
}

function totalsStats() {
  let totalKm = 0, runSessions = 0, strengthSessions = 0, longestRun = 0;
  Object.entries(completions).forEach(([key, comp]) => {
    if (!comp.done) return;
    const plan = getDayPlan(parseDateKey(key));
    if (plan.type === 'run') {
      runSessions++;
      if (comp.distanceKm) {
        totalKm += comp.distanceKm;
        longestRun = Math.max(longestRun, comp.distanceKm);
      }
    } else if (plan.type === 'strength') {
      strengthSessions++;
    }
  });
  return [
    [totalKm.toFixed(1), 'Total km run'],
    [runSessions, 'Runs completed'],
    [strengthSessions, 'Strength sessions'],
    [longestRun ? longestRun.toFixed(1) : '0', 'Longest run (km)'],
  ];
}

function currentStreak() {
  let streak = 0;
  let d = today();
  while (true) {
    const comp = completions[dateKey(d)];
    if (comp && comp.done) {
      streak++;
      d = addDays(d, -1);
    } else {
      break;
    }
  }
  return streak;
}

/* ---------- Plan tab ---------- */
function renderPlan() {
  const race = raceDateObj();
  const container = document.getElementById('planWeeks');
  let html = '';
  let weekStart = getMonday(today());

  while (diffDays(weekStart, race) <= 0) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (diffDays(d, today()) < 0) continue; // skip days already past (before today)
      if (diffDays(d, race) > 0) continue; // skip days after race
      days.push(d);
    }
    if (days.length) {
      const sample = getDayPlan(days[days.length - 1]);
      const label = sample.phase || (sample.type === 'race' ? 'Race Week' : 'Taper Week');
      html += `<div class="week-heading"><h4>Week of ${formatDateLabel(weekStart)}</h4><span>${label}</span></div>`;
      html += `<div class="day-list">${days.map(dayCardHTML).join('')}</div>`;
    }
    weekStart = addDays(weekStart, 7);
  }

  if (!html) {
    html = diffDays(today(), race) > 0
      ? '<p class="empty-msg">🎉 Race day has passed — congratulations on finishing your training block!</p>'
      : '<p class="empty-msg">No upcoming plan — check your race date in Settings.</p>';
  }
  container.innerHTML = html;
  attachDayCardListeners(container);
}

/* ---------- Strength guide ---------- */
const STRENGTH_PROGRAM = [
  {
    key: 'warmup',
    title: '🔥 Warm-Up (5 minutes, before every session)',
    sub: 'Do this before Strength A, Strength B, and any speed/tempo run.',
    exercises: [
      { name: 'Leg swings (front-back & side-side)', detail: '10 each leg' },
      { name: 'Bodyweight walking lunges', detail: '10 steps' },
      { name: 'Glute bridges', detail: '15 reps' },
      { name: 'Arm circles', detail: '20 seconds each way' },
      { name: 'Bodyweight squats', detail: '15 reps' },
    ],
  },
  {
    key: 'A',
    title: '🅰️ Strength A — Power & Stability',
    sub: 'Mondays · ~35-40 min · Dumbbells only',
    exercises: [
      { name: 'Dumbbell Goblet Squat', detail: '3 x 12', tip: 'Hold one dumbbell vertically at chest, squat to depth with control.' },
      { name: 'Dumbbell Romanian Deadlift', detail: '3 x 12', tip: 'Soft knees, hinge at hips, feel the hamstring stretch.' },
      { name: 'Walking Lunges (holding dumbbells)', detail: '3 x 10 / leg', tip: 'Keep torso upright, front knee tracking over toes.' },
      { name: 'Dumbbell Step-Ups', detail: '3 x 10 / leg', tip: 'Use a sturdy chair or step. Drive through the heel.' },
      { name: 'Standing Dumbbell Calf Raise', detail: '3 x 15', tip: 'Pause at the top for a second — key for running economy.' },
      { name: 'Single-Arm Dumbbell Row', detail: '3 x 12 / side', tip: 'Flat back, row to hip, squeeze shoulder blade.' },
      { name: 'Plank', detail: '3 x 30-45s', tip: 'Ribs down, glutes engaged, straight line head-to-heel.' },
      { name: 'Side Plank', detail: '2 x 20-30s / side', tip: 'Builds the hip stability that keeps your running form efficient late in the race.' },
    ],
  },
  {
    key: 'B',
    title: '🅱️ Strength B — Posterior Chain & Core',
    sub: 'Fridays · ~35-40 min · Dumbbells only',
    exercises: [
      { name: 'Dumbbell Single-Leg RDL', detail: '3 x 10 / leg', tip: 'Light weight — balance and hamstring control over speed.' },
      { name: 'Dumbbell Reverse Lunge', detail: '3 x 10 / leg', tip: 'Easier on the knees than forward lunges; step back and lower.' },
      { name: 'Glute Bridge (dumbbell on hips)', detail: '3 x 15', tip: 'Drive hips up, squeeze glutes hard at the top.' },
      { name: 'Dumbbell Deadlift (both legs)', detail: '3 x 12', tip: 'Neutral spine, push the floor away with your feet.' },
      { name: 'Dumbbell Push Press', detail: '3 x 10', tip: 'Slight leg drive to press overhead — builds arm drive for hills.' },
      { name: 'Renegade Rows', detail: '3 x 10 / side', tip: 'From a plank, row one dumbbell at a time. Keep hips square.' },
      { name: 'Dumbbell Russian Twist', detail: '3 x 20 (total)', tip: 'Rotate from the torso, feet can stay grounded if needed.' },
      { name: 'Bird Dog', detail: '3 x 10 / side', tip: 'Opposite arm/leg extension — great for core anti-rotation.' },
    ],
  },
  {
    key: 'cooldown',
    title: '🧊 Cool-Down (5-8 minutes, after every session)',
    sub: 'Static stretches, hold each for 20-30 seconds per side.',
    exercises: [
      { name: 'Standing quad stretch', detail: '20-30s / side' },
      { name: 'Standing hamstring stretch', detail: '20-30s / side' },
      { name: 'Calf stretch against a wall', detail: '20-30s / side' },
      { name: 'Kneeling hip flexor stretch', detail: '20-30s / side' },
      { name: "Child's pose", detail: '30-45s' },
    ],
  },
];

function renderStrengthGuide() {
  const container = document.getElementById('strengthGuide');
  container.innerHTML = STRENGTH_PROGRAM.map((block) => `
    <div class="strength-day">
      <h4>${block.title}</h4>
      <p class="sub">${block.sub}</p>
      <ul class="exercise-list">
        ${block.exercises.map((ex) => `
          <li>
            <span class="ex-name">${ex.name}${ex.tip ? `<span class="ex-tip">${ex.tip}</span>` : ''}</span>
            <span class="ex-detail">${ex.detail}</span>
          </li>`).join('')}
      </ul>
    </div>
  `).join('') + `
    <div class="tips-box">
      <strong>Runner tips:</strong> Keep weights moderate — this is about strength &amp; injury prevention, not maxing out. Do strength sessions at least one day away from your long run. Prioritize single-leg exercises (they translate directly to running mechanics). Stop a rep short of failure on tired legs.
    </div>
  `;
}

/* ---------- History tab ---------- */
function renderHistory() {
  const stats = totalsStats();
  document.getElementById('historyStats').innerHTML = statHTML([[currentStreak(), 'Day streak'], ...stats]);

  const entries = Object.entries(completions)
    .filter(([, c]) => c.done)
    .sort((a, b) => b[0].localeCompare(a[0]));

  const list = document.getElementById('historyList');
  if (!entries.length) {
    list.innerHTML = '<p class="empty-msg">No completed workouts logged yet — check things off in the Dashboard or Plan tab.</p>';
    return;
  }
  list.innerHTML = entries.map(([key, comp]) => {
    const date = parseDateKey(key);
    const plan = getDayPlan(date);
    let extra = '';
    if (comp.distanceKm && comp.durationMin) {
      const p = comp.durationMin / comp.distanceKm;
      const m = Math.floor(p), s = Math.round((p - m) * 60);
      extra = `<p class="day-detail">${comp.distanceKm}km in ${comp.durationMin} min &middot; pace ${m}:${pad(s)}/km</p>`;
    }
    return `
    <div class="day-card done">
      <div class="day-head">
        <div class="day-head-left">
          <div class="day-date">${formatDateLabel(date)}</div>
        </div>
        <span class="badge ${TYPE_BADGE[plan.type]}">${TYPE_ICON[plan.type]} ${plan.type}</span>
      </div>
      <p class="day-desc"><strong>${plan.title}</strong></p>
      ${extra}
    </div>`;
  }).join('');
}

/* ---------- Settings tab ---------- */
function renderSettings() {
  document.getElementById('raceNameInput').value = settings.raceName;
  document.getElementById('raceDateInput').value = settings.raceDate;
}

function initSettingsHandlers() {
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const name = document.getElementById('raceNameInput').value.trim();
    const date = document.getElementById('raceDateInput').value;
    if (name) settings.raceName = name;
    if (date) settings.raceDate = date;
    saveSettings(settings);
    document.getElementById('settingsSaved').textContent = 'Saved!';
    setTimeout(() => { document.getElementById('settingsSaved').textContent = ''; }, 2000);
    renderAll();
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (confirm('This will permanently delete all logged workouts and reset settings. Continue?')) {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(COMPLETIONS_KEY);
      settings = loadSettings();
      completions = loadCompletions();
      renderAll();
    }
  });
}

/* ---------- Tabs ---------- */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

/* ---------- Init ---------- */
function renderAll() {
  renderDashboard();
  renderPlan();
  renderHistory();
  renderSettings();
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettingsHandlers();
  renderStrengthGuide();
  renderAll();
});
