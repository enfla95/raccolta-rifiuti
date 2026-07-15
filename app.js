(function () {
  const { WASTE_TYPES, getCollectionForDate, addDaysISO, todayISO, CALENDAR_START, CALENDAR_END } = window.WasteCalendar;

  // Chiave pubblica VAPID: e' pubblica per definizione (va nel client), non e'
  // un segreto. Deve corrispondere alla VAPID_PRIVATE_KEY usata dallo script
  // send-notification.js (vedi README).
  const VAPID_PUBLIC_KEY = 'BKixPv8qXxUZgLMy2Bx_oMuitk1z3I7LEuIRtoWu5sjK_CDJrgFugA1OlvNmM2sWwhJ7SnFxDtsBpRdBAowJ9HY';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];
  const WEEKDAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  const today = todayISO();
  let viewYear = Number(today.slice(0, 4));
  let viewMonth = Number(today.slice(5, 7)) - 1; // 0-indexed

  function formatDateLabel(iso) {
    const { y, m, d } = { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) };
    const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
    return `${WEEKDAY_LABELS_SHORT[dow]} ${d} ${MONTH_NAMES[m].slice(0, 3)}`;
  }

  function renderPills(items, sospeso, container) {
    container.innerHTML = '';
    if (sospeso) {
      const span = document.createElement('span');
      span.className = 'empty';
      span.textContent = 'Raccolta sospesa (festivo)';
      container.appendChild(span);
      return;
    }
    if (!items.length) {
      const span = document.createElement('span');
      span.className = 'empty';
      span.textContent = 'Nessuna raccolta';
      container.appendChild(span);
      return;
    }
    items.forEach((key) => {
      const info = WASTE_TYPES[key];
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.innerHTML = `<span class="dot" style="background:${info.color}"></span>${info.label}`;
      container.appendChild(pill);
    });
  }

  function renderSummaryCards() {
    const tomorrow = addDaysISO(today, 1);
    const todayData = getCollectionForDate(today);
    const tomorrowData = getCollectionForDate(tomorrow);

    document.getElementById('todayDate').textContent = formatDateLabel(today);
    document.getElementById('tomorrowDate').textContent = formatDateLabel(tomorrow);

    renderPills(todayData.items, todayData.sospeso, document.getElementById('todayItems'));
    renderPills(tomorrowData.items, tomorrowData.sospeso, document.getElementById('tomorrowItems'));
  }

  function renderMonth(year, month) {
    document.getElementById('monthLabel').textContent = `${MONTH_NAMES[month]} ${year}`;
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    // getUTCDay: 0=Dom..6=Sab -> vogliamo Lun=0..Dom=6
    const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    for (let i = 0; i < firstWeekday; i++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell empty';
      grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = (new Date(Date.UTC(year, month, d)).getUTCDay() + 6) % 7; // 0=Lun..6=Dom
      const data = getCollectionForDate(iso);

      const cell = document.createElement('div');
      cell.className = 'day-cell';
      if (iso === today) cell.classList.add('today');
      if (dow >= 5) cell.classList.add('weekend');
      if (data.sospeso) cell.classList.add('sospeso');

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = String(d);
      cell.appendChild(num);

      const dots = document.createElement('div');
      dots.className = 'day-dots';
      data.items.forEach((key) => {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = WASTE_TYPES[key].color;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);

      grid.appendChild(cell);
    }
  }

  function renderAgenda() {
    const list = document.getElementById('agendaList');
    list.innerHTML = '';
    let cursor = today;
    let shown = 0;
    let guard = 0;
    while (shown < 14 && guard < 60 && cursor <= CALENDAR_END) {
      const data = getCollectionForDate(cursor);
      if (data.items.length || data.sospeso) {
        const row = document.createElement('div');
        row.className = 'agenda-row' + (cursor === today ? ' today' : '');

        const dateEl = document.createElement('div');
        dateEl.className = 'agenda-date';
        const { d } = { d: Number(cursor.slice(8, 10)) };
        const dow = (new Date(Date.UTC(Number(cursor.slice(0,4)), Number(cursor.slice(5,7))-1, d)).getUTCDay() + 6) % 7;
        dateEl.innerHTML = `<b>${d} ${MONTH_NAMES[Number(cursor.slice(5,7))-1].slice(0,3)}</b>${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][dow]}${cursor === today ? ' · oggi' : ''}`;

        const itemsEl = document.createElement('div');
        itemsEl.className = 'agenda-items';
        renderPills(data.items, data.sospeso, itemsEl);

        row.appendChild(dateEl);
        row.appendChild(itemsEl);
        list.appendChild(row);
        shown++;
      }
      cursor = addDaysISO(cursor, 1);
      guard++;
    }
    if (!shown) {
      const empty = document.createElement('p');
      empty.className = 'agenda-empty';
      empty.textContent = 'Nessuna raccolta programmata nei prossimi giorni.';
      list.appendChild(empty);
    }
  }

  function renderLegend() {
    const grid = document.getElementById('legendGrid');
    grid.innerHTML = '';
    Object.values(WASTE_TYPES).forEach((info) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<span class="dot" style="background:${info.color}"></span><span><div>${info.fullLabel}</div><span class="bin">${info.bin}</span></span>`;
      grid.appendChild(item);
    });
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const view = tab.dataset.view;
        document.getElementById('monthView').hidden = view !== 'month';
        document.getElementById('agendaView').hidden = view !== 'agenda';
      });
    });
  }

  function setupMonthNav() {
    document.getElementById('prevMonth').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderMonth(viewYear, viewMonth);
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderMonth(viewYear, viewMonth);
    });
  }

  async function setupNotifications() {
    const btn = document.getElementById('enableNotifBtn');
    const status = document.getElementById('notifStatus');
    const subBox = document.getElementById('subscriptionBox');
    const subText = document.getElementById('subscriptionText');
    const copyBtn = document.getElementById('copySubscriptionBtn');

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      btn.disabled = true;
      status.textContent = 'Le notifiche push non sono supportate su questo browser.';
      return;
    }

    let registration;
    try {
      registration = await navigator.serviceWorker.register('service-worker.js');
    } catch (err) {
      btn.disabled = true;
      status.textContent = 'Impossibile registrare il service worker.';
      return;
    }

    function showSubscription(subscription) {
      subText.value = JSON.stringify(subscription.toJSON(), null, 2);
      subBox.hidden = false;
    }

    async function refreshStatus() {
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        btn.textContent = '🔔 Promemoria attivo';
        btn.disabled = true;
        status.textContent = 'Copia il codice qui sotto in GitHub (una sola volta) per attivare l\'invio serale.';
        showSubscription(existing);
      } else {
        btn.textContent = '🔔 Attiva promemoria serale';
        btn.disabled = false;
        status.textContent = '';
        subBox.hidden = true;
      }
    }

    await refreshStatus();

    btn.addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        status.textContent = 'Permesso non concesso: niente promemoria.';
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      showSubscription(subscription);
      await refreshStatus();
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(subText.value);
        copyBtn.textContent = 'Copiato!';
        setTimeout(() => { copyBtn.textContent = 'Copia'; }, 1500);
      });
    }
  }

  renderSummaryCards();
  renderMonth(viewYear, viewMonth);
  renderAgenda();
  renderLegend();
  setupTabs();
  setupMonthNav();
  setupNotifications();
})();
