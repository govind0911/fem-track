/**
 * Saku - Minimalist Period Tracker
 * Pure vanilla JavaScript with offline-first local storage persistence,
 * cycle prediction logic, calendar management, and statistics.
 */

// --- STATE MANAGEMENT ---
const state = {
  defaults: {
    cycleLength: 28,
    periodLength: 5,
    enableNotifications: false
  },
  cycles: [], // Array of completed cycle intervals: [{ id, startDate, endDate, duration }]
  dailyLogs: {}, // Map of daily logs keyed by YYYY-MM-DD: { date, isPeriodDay, flow, mood, pain, symptoms:[], weight, temp, notes }
  selectedDate: '', // Active date being viewed or logged (YYYY-MM-DD)
  currentYear: 0, // Year being viewed in the calendar
  currentMonth: 0, // Month being viewed in the calendar (0-indexed)
  activeTab: 'screen-home',
  selectedSymptomChips: [] // Temporary storage for currently selected chips in log modal
};

// --- CONFIGURATION CONSTANTS & HELPERS ---
const MOTIVATIONAL_QUOTES = [
  { text: "Be gentle with yourself. You are doing the best you can.", author: "Saku Affirmation" },
  { text: "Your body is a beautiful, self-regulating ecosystem of natural cycles.", author: "Wellness Wisdom" },
  { text: "Rest is not a luxury, it is a biological necessity. Listen to your body.", author: "Self Care Guide" },
  { text: "Every phase of your cycle brings its own unique strengths.", author: "Empower Daily" },
  { text: "Honor the seasons of your body. Embrace the quiet times.", author: "Nature's Rhythm" },
  { text: "Embrace where you are today. You are strong and resilient.", author: "Saku Comfort" },
  { text: "A cozy tea, a warm wrap, and deep breaths can work wonders today.", author: "Cozy Support" }
];

// Formatting helper: YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert date string YYYY-MM-DD to Date object
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Calculate days difference between two date strings (date2 - date1)
function dateDiffInDays(dateStr1, dateStr2) {
  const d1 = parseLocalDate(dateStr1);
  const d2 = parseLocalDate(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Add/subtract days from a date string, returning YYYY-MM-DD
function addDaysToDate(dateStr, days) {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

// Format date into a friendly format e.g., "June 27, 2026"
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '--';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Format month and year
function formatMonthYear(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Get greeting based on time of day
function getGreetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

// --- LOCAL STORAGE SERVICES ---
function loadDataFromStorage() {
  const storedDefaults = localStorage.getItem('saku_defaults');
  state.defaults = storedDefaults ? JSON.parse(storedDefaults) : { ...state.defaults };

  const storedCycles = localStorage.getItem('saku_cycles');
  state.cycles = storedCycles ? JSON.parse(storedCycles) : [];

  const storedLogs = localStorage.getItem('saku_daily_logs');
  state.dailyLogs = storedLogs ? JSON.parse(storedLogs) : {};
}

function saveDataToStorage() {
  localStorage.setItem('saku_defaults', JSON.stringify(state.defaults));
  localStorage.setItem('saku_cycles', JSON.stringify(state.cycles));
  localStorage.setItem('saku_daily_logs', JSON.stringify(state.dailyLogs));
}

// --- CORE PREDICTION ENGINE ---
function runPredictionEngine() {
  const defaultC = parseInt(state.defaults.cycleLength, 10) || 28;
  const defaultP = parseInt(state.defaults.periodLength, 10) || 5;
  
  let avgCycleLength = defaultC;
  let avgPeriodLength = defaultP;

  // If we have tracked cycles, compute empirical averages
  if (state.cycles.length > 0) {
    // 1. Calculate average period length
    let sumPeriod = 0;
    state.cycles.forEach(c => {
      const duration = dateDiffInDays(c.startDate, c.endDate) + 1;
      sumPeriod += duration;
    });
    avgPeriodLength = Math.round(sumPeriod / state.cycles.length) || defaultP;

    // 2. Calculate average cycle length (gap between consecutive cycle starts)
    if (state.cycles.length >= 2) {
      // Sort cycles by start date ascending
      const sorted = [...state.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
      let sumCycle = 0;
      let countCycle = 0;
      
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = dateDiffInDays(sorted[i].startDate, sorted[i+1].startDate);
        // Exclude unreasonable gaps (e.g., missed logging or double-logging) to ensure accuracy
        if (gap >= 15 && gap <= 45) {
          sumCycle += gap;
          countCycle++;
        }
      }
      
      if (countCycle > 0) {
        avgCycleLength = Math.round(sumCycle / countCycle);
      }
    }
  }

  // Find the last known period start date
  let lastPeriodStart = '';
  if (state.cycles.length > 0) {
    const sorted = [...state.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
    lastPeriodStart = sorted[sorted.length - 1].startDate;
  } else {
    // If no cycle structures exist yet, search daily logs for the most recent period day
    const periodDays = Object.keys(state.dailyLogs)
      .filter(d => state.dailyLogs[d].isPeriodDay)
      .sort();
    if (periodDays.length > 0) {
      lastPeriodStart = periodDays[periodDays.length - 1];
    }
  }

  // If no bleeding has ever been recorded, default reference is today
  const referenceDate = lastPeriodStart || getLocalDateString();

  // Predict next occurrences
  const nextPeriodStart = addDaysToDate(referenceDate, avgCycleLength);
  const nextPeriodEnd = addDaysToDate(nextPeriodStart, avgPeriodLength - 1);
  const ovulationDate = addDaysToDate(nextPeriodStart, -14);
  const fertileStart = addDaysToDate(ovulationDate, -5);
  const fertileEnd = addDaysToDate(ovulationDate, 1);

  return {
    avgCycleLength,
    avgPeriodLength,
    lastPeriodStart,
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    fertileStart,
    fertileEnd
  };
}

// --- AUTOMATIC CYCLE SYNCHRONIZATION LOGIC ---
/**
 * Scans all daily logs where 'isPeriodDay' is true and reconstructs/groups
 * them into coherent cycle intervals saved in state.cycles.
 * This ensures that when users log individual period days, the app instantly
 * generates the historic cycle ranges, averages, and future predictions.
 */
function rebuildCyclesFromDailyLogs() {
  // Extract all dates flagged as period flow
  const periodDates = Object.keys(state.dailyLogs)
    .filter(dateKey => state.dailyLogs[dateKey].isPeriodDay)
    .sort();

  if (periodDates.length === 0) {
    state.cycles = [];
    saveDataToStorage();
    return;
  }

  const generatedCycles = [];
  let currentStart = periodDates[0];
  let currentPrev = periodDates[0];

  for (let i = 1; i < periodDates.length; i++) {
    const nextDate = periodDates[i];
    const gap = dateDiffInDays(currentPrev, nextDate);

    // If gap between consecutive period days is > 3 days, we treat it as a new cycle/period event
    if (gap > 4) {
      generatedCycles.push({
        id: parseLocalDate(currentStart).getTime().toString(),
        startDate: currentStart,
        endDate: currentPrev
      });
      currentStart = nextDate;
    }
    currentPrev = nextDate;
  }

  // Push final cycle interval
  generatedCycles.push({
    id: parseLocalDate(currentStart).getTime().toString(),
    startDate: currentStart,
    endDate: currentPrev
  });

  state.cycles = generatedCycles;
  saveDataToStorage();
}

/**
 * Opposite sync: When a user manually logs a past cycle range (startDate to endDate),
 * we automatically write dailyLogs for each date in that range, flag them as
 * period days, and save.
 */
function writePeriodRangeToDailyLogs(start, end) {
  let curr = start;
  const limitDays = dateDiffInDays(start, end);
  
  for (let i = 0; i <= limitDays; i++) {
    const dateStr = addDaysToDate(start, i);
    if (!state.dailyLogs[dateStr]) {
      state.dailyLogs[dateStr] = {
        date: dateStr,
        isPeriodDay: true,
        flow: 'medium',
        mood: 'normal',
        pain: 3,
        symptoms: [],
        weight: '',
        temp: '',
        notes: ''
      };
    } else {
      state.dailyLogs[dateStr].isPeriodDay = true;
    }
  }
}

// --- SCHEDULER & NOTIFICATIONS ---
/**
 * Checks predictions relative to today's date and shows simulated reminders
 * in a card or sends system Web Notifications if permission is granted.
 */
function runReminderService(predictions) {
  const todayStr = getLocalDateString();
  const banner = document.getElementById('reminder-banner');
  const bannerText = document.getElementById('reminder-banner-text');

  if (!state.defaults.enableNotifications) {
    banner.classList.add('hidden');
    return;
  }

  const daysToPeriod = dateDiffInDays(todayStr, predictions.nextPeriodStart);
  const daysToOvulation = dateDiffInDays(todayStr, predictions.ovulationDate);

  let message = '';
  if (daysToPeriod === 1) {
    message = "Your period is predicted to start tomorrow. Consider carrying logging supplies!";
  } else if (daysToPeriod === 0) {
    message = "Your period is predicted to start today. Stay comfortable!";
  } else if (daysToOvulation === 1) {
    message = "Ovulation is predicted tomorrow. You are entering peak fertility!";
  } else if (daysToOvulation === 0) {
    message = "Ovulation day! Highly fertile window is active today.";
  } else if (todayStr >= predictions.fertileStart && todayStr <= predictions.fertileEnd) {
    message = "You are currently in your predicted fertile window. Take note!";
  }

  if (message) {
    bannerText.innerHTML = `<strong>Saku Reminder:</strong> ${message}`;
    banner.classList.remove('hidden');

    // Trigger System Notification if API exists and is granted
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Saku Cycle Tracker", {
        body: message,
        icon: "/favicon.ico"
      });
    }
  } else {
    banner.classList.add('hidden');
  }
}

function triggerSimulatedTestNotification() {
  const message = "Saku Test Alert: Cycle alerts are functioning perfectly! Saku will keep you informed of upcoming period days.";
  
  // Try Web Notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Saku Test Notification", { body: message });
  } else {
    // Fallback to simple banner modal or immediate app popup
    const banner = document.getElementById('reminder-banner');
    const bannerText = document.getElementById('reminder-banner-text');
    bannerText.innerHTML = `<strong>Saku Test Alert:</strong> ${message}`;
    banner.classList.remove('hidden');
    banner.scrollIntoView({ behavior: 'smooth' });
  }
}

// --- VIEW CONTROLLERS (Navigation, Rendering) ---

// Handle Tab Navigation switching
function switchTab(targetId) {
  // Hide all screens
  document.querySelectorAll('.app-screen').forEach(screen => {
    screen.classList.remove('active');
  });

  // Deactivate all navigation buttons
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // Activate targeted screen and tab button
  const screen = document.getElementById(targetId);
  if (screen) {
    screen.classList.add('active');
    state.activeTab = targetId;
  }

  const tabBtn = document.querySelector(`[data-target="${targetId}"]`);
  if (tabBtn) {
    tabBtn.classList.add('active');
  }

  // Render updates for specific screens on load
  if (targetId === 'screen-home') {
    renderHomeScreen();
  } else if (targetId === 'screen-calendar') {
    renderCalendar();
  } else if (targetId === 'screen-history') {
    renderHistoryScreen();
  } else if (targetId === 'screen-statistics') {
    renderStatisticsScreen();
  } else if (targetId === 'screen-settings') {
    renderSettingsScreen();
  }
}

// Render 1: HOME SCREEN
function renderHomeScreen() {
  const predictions = runPredictionEngine();
  const todayStr = getLocalDateString();

  // Greeting
  document.getElementById('header-greeting-time').textContent = getGreetingPrefix();

  // Cycle Ring Dasharray calculation
  const ring = document.getElementById('cycle-ring-progress');
  const dayDisplay = document.getElementById('cycle-day-display');
  const stateLabel = document.getElementById('cycle-state-label');
  const countdownDisplay = document.getElementById('cycle-countdown-display');

  if (predictions.lastPeriodStart) {
    const elapsedDays = dateDiffInDays(predictions.lastPeriodStart, todayStr);
    
    if (elapsedDays >= 0) {
      const cycleDay = elapsedDays + 1;
      dayDisplay.textContent = cycleDay;
      
      // Calculate fraction of standard cycle complete
      const fraction = Math.min(cycleDay / predictions.avgCycleLength, 1);
      const dashOffset = 534 - (534 * fraction);
      ring.style.strokeDashoffset = dashOffset;

      // Classify current day phase
      let currentPhase = "Follicular Phase";
      if (todayStr >= predictions.fertileStart && todayStr <= predictions.fertileEnd) {
        currentPhase = "Fertile Window";
        stateLabel.style.backgroundColor = "var(--fertile-color)";
        stateLabel.style.color = "var(--dark-text)";
      } else if (todayStr === predictions.ovulationDate) {
        currentPhase = "Ovulation Day";
        stateLabel.style.backgroundColor = "var(--ovulation-color)";
        stateLabel.style.color = "white";
      } else {
        const isPeriod = state.dailyLogs[todayStr]?.isPeriodDay || 
          state.cycles.some(c => todayStr >= c.startDate && todayStr <= c.endDate);
        if (isPeriod) {
          currentPhase = "Period Day";
          stateLabel.style.backgroundColor = "var(--period-color)";
          stateLabel.style.color = "white";
        } else {
          // Luteal is usually post ovulation (approx 14 days before next period)
          const daysToPeriod = dateDiffInDays(todayStr, predictions.nextPeriodStart);
          if (daysToPeriod <= 14 && daysToPeriod > 0) {
            currentPhase = "Luteal Phase";
            stateLabel.style.backgroundColor = "var(--luteal-color)";
            stateLabel.style.color = "var(--dark-text)";
          } else {
            stateLabel.style.backgroundColor = "var(--follicular-color)";
            stateLabel.style.color = "var(--dark-text)";
          }
        }
      }
      stateLabel.textContent = currentPhase;
    } else {
      // Future logged starting date
      dayDisplay.textContent = "--";
      stateLabel.textContent = "Upcoming Period";
      ring.style.strokeDashoffset = 534;
    }
  } else {
    dayDisplay.textContent = "1";
    stateLabel.textContent = "New Cycle";
    ring.style.strokeDashoffset = 534;
  }

  // Days until next period prediction
  const daysToNext = dateDiffInDays(todayStr, predictions.nextPeriodStart);
  if (daysToNext > 0) {
    countdownDisplay.textContent = `Period in ${daysToNext} day${daysToNext > 1 ? 's' : ''}`;
  } else if (daysToNext === 0) {
    countdownDisplay.textContent = `Period predicted today!`;
  } else {
    countdownDisplay.textContent = `Period is late by ${Math.abs(daysToNext)} day${Math.abs(daysToNext) > 1 ? 's' : ''}`;
  }

  // Key prediction text fields
  document.getElementById('home-pred-period').textContent = formatFriendlyDate(predictions.nextPeriodStart);
  document.getElementById('home-pred-ovulation').textContent = formatFriendlyDate(predictions.ovulationDate);

  // Phase bar proportional dimensions
  const totalLength = predictions.avgCycleLength;
  const periodW = (predictions.avgPeriodLength / totalLength) * 100;
  const fertileW = (7 / totalLength) * 100; // fertile window standard length is 7 days
  const lutealW = (14 / totalLength) * 100; // luteal standard is 14 days
  const follicularW = 100 - (periodW + fertileW + lutealW);

  document.getElementById('phase-bar-period').style.width = `${periodW}%`;
  document.getElementById('phase-bar-follicular').style.width = `${Math.max(follicularW, 5)}%`;
  document.getElementById('phase-bar-fertile').style.width = `${fertileW}%`;
  document.getElementById('phase-bar-luteal').style.width = `${lutealW}%`;

  document.getElementById('home-prediction-range-desc').innerHTML = 
    `Your next predicted period start date is <strong>${formatFriendlyDate(predictions.nextPeriodStart)}</strong>. Your peak fertile window is estimated from <strong>${formatFriendlyDate(predictions.fertileStart)}</strong> to <strong>${formatFriendlyDate(predictions.fertileEnd)}</strong>.`;

  // Random support quotes carousel
  const randomQuoteIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  document.getElementById('motivational-quote').textContent = MOTIVATIONAL_QUOTES[randomQuoteIndex].text;
  document.getElementById('motivational-author').textContent = `— ${MOTIVATIONAL_QUOTES[randomQuoteIndex].author}`;

  // Execute reminder alert matching
  runReminderService(predictions);
}

// Render 2: CALENDAR SCREEN
function renderCalendar() {
  const container = document.getElementById('calendar-days-grid');
  container.innerHTML = '';

  const predictions = runPredictionEngine();
  const year = state.currentYear;
  const month = state.currentMonth;

  // Render Month title
  document.getElementById('calendar-month-year').textContent = formatMonthYear(year, month);

  // Get first day of the week & total days of current active month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days of previous month for filling empty starting spaces
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const todayStr = getLocalDateString();

  // Fill in days of the previous month (visual trailing)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const cell = document.createElement('div');
    cell.classList.add('calendar-day-cell', 'other-month-day');
    cell.textContent = dayNum;
    container.appendChild(cell);
  }

  // Fill in active month days
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.classList.add('calendar-day-cell');
    cell.textContent = day;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Highlight: Current Today
    if (dateStr === todayStr) {
      cell.classList.add('current-today');
    }

    // Highlight: Selected Active Day
    if (dateStr === state.selectedDate) {
      cell.classList.add('selected-active');
    }

    // Checking if this date falls within a logged period cycle range
    const isPeriodDayLogged = state.dailyLogs[dateStr]?.isPeriodDay;
    const isInsideLoggedCycle = state.cycles.some(cycle => dateStr >= cycle.startDate && dateStr <= cycle.endDate);

    if (isPeriodDayLogged || isInsideLoggedCycle) {
      cell.classList.add('day-period');
    } else if (dateStr >= predictions.nextPeriodStart && dateStr <= predictions.nextPeriodEnd) {
      // Highlight: Predicted Period
      cell.classList.add('day-pred-period');
    }

    // Highlight: Predicted Ovulation (avoid overlaps on actual bleeding)
    if (dateStr === predictions.ovulationDate && !cell.classList.contains('day-period')) {
      cell.classList.add('day-ovulation');
    } else if (dateStr >= predictions.fertileStart && dateStr <= predictions.fertileEnd && !cell.classList.contains('day-period')) {
      // Highlight: Fertile Window
      cell.classList.add('day-fertile');
    }

    // Log indicator dot
    if (state.dailyLogs[dateStr]) {
      const dot = document.createElement('span');
      dot.classList.add('logged-dot-indicator');
      cell.appendChild(dot);
    }

    // Interactive event listeners
    cell.addEventListener('click', () => {
      // Deselect old
      const oldSelected = container.querySelector('.selected-active');
      if (oldSelected) oldSelected.classList.remove('selected-active');
      
      // Select new
      cell.classList.add('selected-active');
      state.selectedDate = dateStr;
      
      renderSelectedDayDetails(dateStr);
    });

    container.appendChild(cell);
  }

  // Fill details box
  renderSelectedDayDetails(state.selectedDate);
}

// Selected Day details panel inside Calendar Screen
function renderSelectedDayDetails(dateStr) {
  const title = document.getElementById('selected-date-label');
  const content = document.getElementById('selected-day-content');

  title.textContent = formatFriendlyDate(dateStr);

  const log = state.dailyLogs[dateStr];
  
  // Check if date falls in a logged or predicted cycle as a period day
  const predictions = runPredictionEngine();
  const isPeriodLogged = log?.isPeriodDay || state.cycles.some(c => dateStr >= c.startDate && dateStr <= c.endDate);
  const isPeriodPredicted = dateStr >= predictions.nextPeriodStart && dateStr <= predictions.nextPeriodEnd;

  if (!log && !isPeriodLogged && !isPeriodPredicted) {
    content.innerHTML = `<div class="empty-state-message">No logs tracked for this day. Click 'Log / Edit' to log flow, mood, symptoms, or vitals.</div>`;
    return;
  }

  let html = '';

  // Period / Flow block
  if (isPeriodLogged || log?.flow || isPeriodPredicted) {
    let flowLabel = log?.flow ? log.flow.charAt(0).toUpperCase() + log.flow.slice(1) : 'Medium';
    let flowClass = log?.flow || 'medium';
    let label = isPeriodLogged ? 'Logged Period Day' : 'Predicted Period Day';

    html += `
      <div class="log-summary-box">
        <span class="summary-box-label">${label}</span>
        <span class="summary-box-val">
          <span class="flow-color-tag ${flowClass}"></span>
          Flow: ${flowLabel}
        </span>
      </div>
    `;
  }

  if (log) {
    // Mood Block
    let moodEmoji = '😐';
    if (log.mood === 'happy') moodEmoji = '😊';
    else if (log.mood === 'normal') moodEmoji = '😐';
    else if (log.mood === 'sad') moodEmoji = '😢';
    else if (log.mood === 'irritated') moodEmoji = '😡';
    else if (log.mood === 'tired') moodEmoji = '😴';
    else if (log.mood === 'anxious') moodEmoji = '😰';

    html += `
      <div class="day-log-grid">
        <div class="log-summary-box">
          <span class="summary-box-label">Mood</span>
          <span class="summary-box-val">${moodEmoji} ${log.mood ? log.mood.charAt(0).toUpperCase() + log.mood.slice(1) : 'Normal'}</span>
        </div>
        <div class="log-summary-box">
          <span class="summary-box-label">Pain Level</span>
          <span class="summary-box-val">💥 ${log.pain ?? 0} / 10</span>
        </div>
      </div>
    `;

    // Symptoms Block
    if (log.symptoms && log.symptoms.length > 0) {
      const symList = log.symptoms.map(s => `<span class="summary-sym-chip">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`).join('');
      html += `
        <div class="log-summary-box">
          <span class="summary-box-label">Logged Symptoms</span>
          <div class="symptoms-summary-list">${symList}</div>
        </div>
      `;
    }

    // Weight & Vitals Basal Temperature
    if (log.weight || log.temp) {
      html += `
        <div class="day-log-grid">
          ${log.weight ? `
            <div class="log-summary-box">
              <span class="summary-box-label">Weight</span>
              <span class="summary-box-val">⚖️ ${log.weight} kg</span>
            </div>
          ` : ''}
          ${log.temp ? `
            <div class="log-summary-box">
              <span class="summary-box-label">Basal Temperature</span>
              <span class="summary-box-val">🌡️ ${log.temp} °C</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Notes
    if (log.notes) {
      html += `
        <div class="notes-summary-box">
          <span class="summary-box-label">Personal Notes</span>
          <p style="margin-top: 4px; font-weight: 500;">${log.notes}</p>
        </div>
      `;
    }
  }

  content.innerHTML = html || `<div class="empty-state-message">Predicted period window day. No individual logs recorded.</div>`;
}

// Render 3: HISTORY SCREEN
function renderHistoryScreen() {
  const container = document.getElementById('cycle-history-list');
  container.innerHTML = '';

  if (state.cycles.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">🌸</div>
        <h3>No completed cycles tracked yet</h3>
        <p>Start logging your period using the "Log Period Dates" button or Quick Log to see your historical cycles here.</p>
      </div>
    `;
    return;
  }

  // Sort cycles descending by date to show most recent first
  const sortedCycles = [...state.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));

  sortedCycles.forEach((cycle, index) => {
    const card = document.createElement('div');
    card.classList.add('cycle-history-card');

    const duration = dateDiffInDays(cycle.startDate, cycle.endDate) + 1;
    
    // Find previous cycle to calculate cycle gap length
    let cycleLengthLabel = '--';
    const nextChronologicalCycle = sortedCycles[sortedCycles.length - 1 - index + 1]; // chronological previous
    if (index < sortedCycles.length - 1) {
      const prevCycle = sortedCycles[index + 1];
      const gap = dateDiffInDays(prevCycle.startDate, cycle.startDate);
      cycleLengthLabel = `${gap} days`;
    }

    // Aggregate statistics across daily logs within this range
    let aggregatePain = 0;
    let painCount = 0;
    let loggedSymptoms = new Set();
    let sampleNotes = [];

    let scanDate = cycle.startDate;
    const maxDays = dateDiffInDays(cycle.startDate, cycle.endDate);
    for (let d = 0; d <= maxDays; d++) {
      const dateKey = addDaysToDate(cycle.startDate, d);
      const log = state.dailyLogs[dateKey];
      if (log) {
        if (log.pain !== undefined) {
          aggregatePain += parseInt(log.pain, 10);
          painCount++;
        }
        if (log.symptoms) {
          log.symptoms.forEach(s => loggedSymptoms.add(s));
        }
        if (log.notes) {
          sampleNotes.push(log.notes);
        }
      }
    }

    const avgPain = painCount > 0 ? (aggregatePain / painCount).toFixed(1) : '--';
    const symArray = Array.from(loggedSymptoms);
    const symptomsString = symArray.length > 0 
      ? symArray.slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') + (symArray.length > 3 ? '...' : '')
      : 'None recorded';

    card.innerHTML = `
      <div class="cycle-card-header">
        <span class="cycle-card-dates">${formatFriendlyDate(cycle.startDate)} - ${formatFriendlyDate(cycle.endDate)}</span>
        <button class="btn-delete-cycle" data-id="${cycle.id}" aria-label="Delete cycle entry">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="cycle-stats-row">
        <div class="cycle-stat-col">
          <span class="cycle-stat-val">${duration} days</span>
          <span class="cycle-stat-lbl">Period Duration</span>
        </div>
        <div class="cycle-stat-col">
          <span class="cycle-stat-val">${cycleLengthLabel}</span>
          <span class="cycle-stat-lbl">Cycle Length</span>
        </div>
      </div>
      <div class="cycle-details-grid">
        <div class="cycle-detail-snippet">
          <span class="cycle-detail-lbl">Average Pain:</span>
          <span>${avgPain !== '--' ? `💥 ${avgPain} / 10` : 'Not logged'}</span>
        </div>
        <div class="cycle-detail-snippet">
          <span class="cycle-detail-lbl">Top Symptoms:</span>
          <span>${symptomsString}</span>
        </div>
        ${sampleNotes.length > 0 ? `
          <div class="cycle-detail-snippet">
            <span class="cycle-detail-lbl">Journal snippet:</span>
            <span style="font-style: italic;">"${sampleNotes[0].slice(0, 45)}${sampleNotes[0].length > 45 ? '...' : ''}"</span>
          </div>
        ` : ''}
      </div>
    `;

    // Hook up delete listener
    card.querySelector('.btn-delete-cycle').addEventListener('click', (e) => {
      const cycleId = e.currentTarget.getAttribute('data-id');
      confirmDeleteCycle(cycleId);
    });

    container.appendChild(card);
  });
}

function confirmDeleteCycle(cycleId) {
  if (confirm("Are you sure you want to delete this period cycle entry? This will also remove period flags from daily logs in this range.")) {
    const cycleToDelete = state.cycles.find(c => c.id === cycleId);
    if (cycleToDelete) {
      // Clear period flow flag on daily logs in that date range
      let scanDate = cycleToDelete.startDate;
      const days = dateDiffInDays(cycleToDelete.startDate, cycleToDelete.endDate);
      for (let i = 0; i <= days; i++) {
        const dateStr = addDaysToDate(cycleToDelete.startDate, i);
        if (state.dailyLogs[dateStr]) {
          state.dailyLogs[dateStr].isPeriodDay = false;
        }
      }

      state.cycles = state.cycles.filter(c => c.id !== cycleId);
      saveDataToStorage();
      renderHistoryScreen();
    }
  }
}

// Render 4: STATISTICS SCREEN
function renderStatisticsScreen() {
  const predictions = runPredictionEngine();

  // Primary stats card updates
  document.getElementById('stat-avg-cycle').textContent = predictions.avgCycleLength;
  document.getElementById('stat-avg-period').textContent = predictions.avgPeriodLength;
  document.getElementById('stat-total-tracked').textContent = state.cycles.length;

  // Compute longest/shortest cycle
  let longest = '--';
  let shortest = '--';
  if (state.cycles.length >= 2) {
    const sorted = [...state.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const gaps = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = dateDiffInDays(sorted[i].startDate, sorted[i+1].startDate);
      if (gap >= 15 && gap <= 45) {
        gaps.push(gap);
      }
    }
    if (gaps.length > 0) {
      longest = Math.max(...gaps);
      shortest = Math.min(...gaps);
    }
  }
  document.getElementById('stat-longest-cycle').textContent = longest;
  document.getElementById('stat-shortest-cycle').textContent = shortest;

  // Calculate Streak of consecutive monthly tracked cycles
  let streak = 0;
  if (state.cycles.length > 0) {
    const sorted = [...state.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
    streak = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = dateDiffInDays(sorted[i+1].startDate, sorted[i].startDate);
      // If gap between consecutive start dates is <= 40 days, streak continues
      if (gap <= 40) {
        streak++;
      } else {
        break; // streak broken
      }
    }
  }
  document.getElementById('stat-current-streak').textContent = streak;

  // 1. Generate Symptoms Frequency Chart
  const symContainer = document.getElementById('symptoms-chart-container');
  symContainer.innerHTML = '';

  const symptomCounts = {};
  let totalLogsWithSymptoms = 0;

  Object.values(state.dailyLogs).forEach(log => {
    if (log.symptoms && log.symptoms.length > 0) {
      totalLogsWithSymptoms++;
      log.symptoms.forEach(sym => {
        symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
      });
    }
  });

  const allSymptomsList = ['cramps', 'headache', 'acne', 'bloating', 'fatigue', 'nausea', 'backpain', 'breasttenderness', 'foodcravings', 'moodswings'];
  
  if (totalLogsWithSymptoms > 0) {
    // Sort symptoms by frequency
    const sortedSymptoms = allSymptomsList.map(symName => {
      const count = symptomCounts[symName] || 0;
      const pct = Math.round((count / totalLogsWithSymptoms) * 100);
      return { name: symName, percentage: pct, count: count };
    }).sort((a, b) => b.percentage - a.percentage);

    sortedSymptoms.forEach(sym => {
      const barRow = document.createElement('div');
      barRow.classList.add('chart-bar-row');
      
      // Friendly formatted name
      let friendlyName = sym.name;
      if (sym.name === 'backpain') friendlyName = 'Back Pain';
      else if (sym.name === 'breasttenderness') friendlyName = 'Breast Tenderness';
      else if (sym.name === 'foodcravings') friendlyName = 'Food Cravings';
      else if (sym.name === 'moodswings') friendlyName = 'Mood Swings';
      else friendlyName = sym.name.charAt(0).toUpperCase() + sym.name.slice(1);

      barRow.innerHTML = `
        <div class="chart-bar-labels">
          <span class="bar-name">${friendlyName}</span>
          <span>${sym.percentage}% (${sym.count} log${sym.count > 1 ? 's' : ''})</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${sym.percentage}%;"></div>
        </div>
      `;
      symContainer.appendChild(barRow);
    });
  } else {
    symContainer.innerHTML = `<div class="empty-state-message">Add symptoms in your daily logs to generate frequency tracking.</div>`;
  }

  // 2. Basal Vitals & Pain Insights
  let lastWeight = '--';
  let lastTemp = '--';
  let sumPain = 0;
  let countPain = 0;

  // Retrieve logs sorted chronologically
  const chronologicalLogs = Object.values(state.dailyLogs).sort((a,b) => a.date.localeCompare(b.date));
  
  // Find last weight
  for (let i = chronologicalLogs.length - 1; i >= 0; i--) {
    if (chronologicalLogs[i].weight) {
      lastWeight = `${chronologicalLogs[i].weight} kg`;
      break;
    }
  }

  // Find last temp
  for (let i = chronologicalLogs.length - 1; i >= 0; i--) {
    if (chronologicalLogs[i].temp) {
      lastTemp = `${chronologicalLogs[i].temp} °C`;
      break;
    }
  }

  // Average Pain
  chronologicalLogs.forEach(log => {
    if (log.pain !== undefined) {
      sumPain += parseInt(log.pain, 10);
      countPain++;
    }
  });
  const avgPain = countPain > 0 ? (sumPain / countPain).toFixed(1) : '0.0';

  document.getElementById('insight-weight').textContent = lastWeight;
  document.getElementById('insight-temp').textContent = lastTemp;
  document.getElementById('insight-avg-pain').textContent = `${avgPain} / 10`;
}

// Render 5: SETTINGS SCREEN
function renderSettingsScreen() {
  document.getElementById('setting-cycle-length').value = state.defaults.cycleLength;
  document.getElementById('setting-period-length').value = state.defaults.periodLength;
  document.getElementById('setting-reminders-toggle').checked = state.defaults.enableNotifications;

  const testPanel = document.getElementById('notifications-test-panel');
  if (state.defaults.enableNotifications) {
    testPanel.style.opacity = '1';
    testPanel.style.pointerEvents = 'auto';
  } else {
    testPanel.style.opacity = '0.5';
    testPanel.style.pointerEvents = 'none';
  }
}

// --- LOGGING MODAL FORM SERVICE ---
function openQuickLogModal(targetDate = getLocalDateString()) {
  state.selectedDate = targetDate;
  state.selectedSymptomChips = [];

  // Title update
  document.getElementById('log-modal-title').textContent = `Log Status: ${formatFriendlyDate(targetDate)}`;
  document.getElementById('log-date').value = targetDate;

  // Clear Form fields
  const logForm = document.getElementById('log-form');
  logForm.reset();

  // If previous log exists, hydrate form values
  const log = state.dailyLogs[targetDate];
  const flowSection = document.getElementById('flow-section-group');

  if (log) {
    document.getElementById('log-is-period').checked = log.isPeriodDay || false;
    
    if (log.flow) {
      const radio = document.querySelector(`input[name="flow-intensity"][value="${log.flow}"]`);
      if (radio) radio.checked = true;
    }
    
    if (log.mood) {
      const radio = document.querySelector(`input[name="mood"][value="${log.mood}"]`);
      if (radio) radio.checked = true;
    }

    document.getElementById('log-pain').value = log.pain ?? 3;
    document.getElementById('pain-value-indicator').textContent = `${log.pain ?? 3} / 10`;

    // Hydrate symptoms
    state.selectedSymptomChips = log.symptoms ? [...log.symptoms] : [];

    document.getElementById('log-weight').value = log.weight || '';
    document.getElementById('log-temp').value = log.temp || '';
    document.getElementById('log-notes').value = log.notes || '';
  } else {
    // Default hydration
    document.getElementById('log-is-period').checked = false;
    document.getElementById('flow-medium').checked = true;
    document.getElementById('mood-happy').checked = true;
    document.getElementById('log-pain').value = 3;
    document.getElementById('pain-value-indicator').textContent = "3 / 10";
    document.getElementById('log-weight').value = '';
    document.getElementById('log-temp').value = '';
    document.getElementById('log-notes').value = '';
  }

  // Visual highlights on chips
  document.querySelectorAll('.symptom-toggle-chip').forEach(chip => {
    const symName = chip.getAttribute('data-symptom');
    if (state.selectedSymptomChips.includes(symName)) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });

  // Adjust flow selector visibility dynamically based on 'isPeriod' checkbox
  toggleFlowVisibility(document.getElementById('log-is-period').checked);

  // Show Modal Overlay
  document.getElementById('log-modal').classList.remove('hidden');
}

function toggleFlowVisibility(isPeriod) {
  const flowGrp = document.getElementById('flow-section-group');
  if (isPeriod) {
    flowGrp.style.display = 'block';
    flowGrp.style.animation = 'slide-down 0.25s ease';
  } else {
    flowGrp.style.display = 'none';
  }
}

function saveDailyLogForm() {
  const dateStr = document.getElementById('log-date').value;
  if (!dateStr) return;

  const isPeriod = document.getElementById('log-is-period').checked;
  const flowVal = isPeriod ? document.querySelector('input[name="flow-intensity"]:checked').value : '';
  const moodVal = document.querySelector('input[name="mood"]:checked').value;
  const painVal = parseInt(document.getElementById('log-pain').value, 10);
  const weightVal = document.getElementById('log-weight').value;
  const tempVal = document.getElementById('log-temp').value;
  const notesVal = document.getElementById('log-notes').value;

  // Build dailyLog entry
  state.dailyLogs[dateStr] = {
    date: dateStr,
    isPeriodDay: isPeriod,
    flow: flowVal,
    mood: moodVal,
    pain: painVal,
    symptoms: [...state.selectedSymptomChips],
    weight: weightVal ? parseFloat(weightVal) : '',
    temp: tempVal ? parseFloat(tempVal) : '',
    notes: notesVal
  };

  saveDataToStorage();

  // Run dynamic background rebuilds of cycles from consecutive bleeding days
  rebuildCyclesFromDailyLogs();

  // Hide Modal
  document.getElementById('log-modal').classList.add('hidden');

  // Rerender active context screen
  if (state.activeTab === 'screen-home') {
    renderHomeScreen();
  } else if (state.activeTab === 'screen-calendar') {
    renderCalendar();
  } else if (state.activeTab === 'screen-history') {
    renderHistoryScreen();
  } else if (state.activeTab === 'screen-statistics') {
    renderStatisticsScreen();
  }
}

// --- EVENT ROUTING & BOOTSTRAPPING ---
function initializeEventListeners() {
  // 1. Tab Bar Navigation clicks
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetScreen = tab.getAttribute('data-target');
      switchTab(targetScreen);
    });
  });

  // 2. Header close reminder banner action
  document.getElementById('btn-close-banner').addEventListener('click', () => {
    document.getElementById('reminder-banner').classList.add('hidden');
  });

  // 3. Home Screen CTA buttons
  document.getElementById('btn-open-quick-log').addEventListener('click', () => {
    openQuickLogModal(getLocalDateString());
  });

  // 4. Calendar Screen Navigator arrows
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear--;
    }
    renderCalendar();
  });

  document.getElementById('btn-next-month').addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear++;
    }
    renderCalendar();
  });

  // Edit selected calendar day button
  document.getElementById('btn-edit-selected-day').addEventListener('click', () => {
    openQuickLogModal(state.selectedDate);
  });

  // 5. Past Cycle Modal triggers (History page)
  document.getElementById('btn-add-past-cycle').addEventListener('click', () => {
    document.getElementById('cycle-start-date').value = getLocalDateString();
    document.getElementById('cycle-end-date').value = getLocalDateString();
    document.getElementById('cycle-range-modal').classList.remove('hidden');
  });

  document.getElementById('btn-close-range-modal').addEventListener('click', () => {
    document.getElementById('cycle-range-modal').classList.add('hidden');
  });
  document.getElementById('btn-cancel-range').addEventListener('click', () => {
    document.getElementById('cycle-range-modal').classList.add('hidden');
  });

  // Handle Past Range save
  document.getElementById('cycle-range-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const start = document.getElementById('cycle-start-date').value;
    const end = document.getElementById('cycle-end-date').value;

    if (!start || !end) return;
    if (start > end) {
      alert("Error: Start date cannot be after end date.");
      return;
    }

    // Dual-Write Syncing: Add cycle & write dailyLogs
    writePeriodRangeToDailyLogs(start, end);
    saveDataToStorage();

    // Rebuild coherent cycle bounds
    rebuildCyclesFromDailyLogs();

    // Close and refresh
    document.getElementById('cycle-range-modal').classList.add('hidden');
    renderHistoryScreen();
  });

  // 6. Settings Screen triggers
  document.getElementById('btn-save-defaults').addEventListener('click', () => {
    const cycleLen = document.getElementById('setting-cycle-length').value;
    const periodLen = document.getElementById('setting-period-length').value;

    state.defaults.cycleLength = Math.max(parseInt(cycleLen, 10) || 28, 10);
    state.defaults.periodLength = Math.max(parseInt(periodLen, 10) || 5, 2);

    saveDataToStorage();
    alert("Preferences saved successfully!");
  });

  document.getElementById('setting-reminders-toggle').addEventListener('change', (e) => {
    state.defaults.enableNotifications = e.target.checked;
    saveDataToStorage();

    const testPanel = document.getElementById('notifications-test-panel');
    if (e.target.checked) {
      testPanel.style.opacity = '1';
      testPanel.style.pointerEvents = 'auto';

      // Request browser notification API permissions
      if ("Notification" in window) {
        Notification.requestPermission();
      }
    } else {
      testPanel.style.opacity = '0.5';
      testPanel.style.pointerEvents = 'none';
      document.getElementById('reminder-banner').classList.add('hidden');
    }
  });

  document.getElementById('btn-test-notification').addEventListener('click', () => {
    triggerSimulatedTestNotification();
  });

  // Clear data safely
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm("⚠️ CRITICAL WARNING: This will permanently delete all your tracked cycles, daily logs, notes, and preferences. This action is irreversible. Proceed?")) {
      localStorage.clear();
      state.cycles = [];
      state.dailyLogs = {};
      state.defaults = {
        cycleLength: 28,
        periodLength: 5,
        enableNotifications: false
      };
      saveDataToStorage();
      alert("App data reset successfully!");
      location.reload();
    }
  });

  // 7. Quick Log Modal inner interactivity handlers
  document.getElementById('btn-close-log-modal').addEventListener('click', () => {
    document.getElementById('log-modal').classList.add('hidden');
  });
  document.getElementById('btn-cancel-log').addEventListener('click', () => {
    document.getElementById('log-modal').classList.add('hidden');
  });

  document.getElementById('log-is-period').addEventListener('change', (e) => {
    toggleFlowVisibility(e.target.checked);
  });

  // Pain Level Slider indicator label update
  const painSlider = document.getElementById('log-pain');
  painSlider.addEventListener('input', (e) => {
    document.getElementById('pain-value-indicator').textContent = `${e.target.value} / 10`;
  });

  // Symptoms grid chip selector toggles
  document.querySelectorAll('.symptom-toggle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const symName = chip.getAttribute('data-symptom');
      if (state.selectedSymptomChips.includes(symName)) {
        state.selectedSymptomChips = state.selectedSymptomChips.filter(s => s !== symName);
        chip.classList.remove('selected');
      } else {
        state.selectedSymptomChips.push(symName);
        chip.classList.add('selected');
      }
    });
  });

  // Submit Logger Form handler
  document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveDailyLogForm();
  });
}

// --- APP INITIALIZER BOOT ---
function appBoot() {
  loadDataFromStorage();

  // Set default selection dates to today
  const todayStr = getLocalDateString();
  state.selectedDate = todayStr;

  const today = new Date();
  state.currentYear = today.getFullYear();
  state.currentMonth = today.getMonth();

  initializeEventListeners();

  // Render entry home screen
  switchTab('screen-home');
}

// Kick off
window.addEventListener('DOMContentLoaded', appBoot);
