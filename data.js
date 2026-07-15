/**
 * Calendario Raccolta Rifiuti - Uggiate con Ronago 2026/2027
 * Logica derivata dal calendario ufficiale (utenze DOMESTICHE).
 * Le date "VETRO* UND" (utenze NON domestiche, raccolta settimanale) sono
 * escluse: per le utenze domestiche il vetro e' quindicinale (VETRO liscio).
 *
 * Regola settimanale (validata contro il calendario ufficiale marzo-agosto
 * 2026 e dicembre 2026/gennaio 2027, nessuna discrepanza):
 *   Lunedi'   -> PSA
 *   Martedi'  -> UMIDO
 *   Mercoledi'-> VETRO (solo settimane pari rispetto al 2026-03-04)
 *   Giovedi'  -> CARTA (settimane pari rispetto al 2026-03-05) altrimenti SECCO
 *   Venerdi'  -> UMIDO + PLASTICA
 *   Sabato/Domenica -> nessuna raccolta
 * Eccezioni: 25 dicembre 2026 e 1 gennaio 2027 -> raccolta SOSPESA (festivita').
 */

const WASTE_TYPES = {
  PSA: {
    label: 'PSA',
    fullLabel: 'Prodotti Sanitari Assorbenti',
    bin: 'Sacco arancione',
    color: '#e05a4e',
  },
  UMIDO: {
    label: 'Umido',
    fullLabel: 'Umido / organico',
    bin: 'Bidone marrone',
    color: '#3a7d3a',
  },
  VETRO: {
    label: 'Vetro',
    fullLabel: 'Vetro e lattine',
    bin: 'Bidone verde',
    color: '#2f8fc2',
  },
  CARTA: {
    label: 'Carta',
    fullLabel: 'Carta e cartone',
    bin: 'Bidone blu',
    color: '#1f6f78',
  },
  SECCO: {
    label: 'Secco',
    fullLabel: 'Residuo secco indifferenziato',
    bin: 'Sacco grigio',
    color: '#7a7a7a',
  },
  PLASTICA: {
    label: 'Plastica',
    fullLabel: 'Plastica e imballaggi',
    bin: 'Sacco giallo',
    color: '#e0b400',
  },
};

const VETRO_REF = Date.UTC(2026, 2, 4); // 2026-03-04, settimana VETRO (mese 0-indicizzato: 2 = marzo)
const CARTA_REF = Date.UTC(2026, 2, 5); // 2026-03-05, settimana CARTA

const SOSPESO_DATES = new Set(['2026-12-25', '2027-01-01']);

const CALENDAR_START = '2026-03-01';
const CALENDAR_END = '2027-02-28';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

// Restituisce { sospeso: bool, items: [WASTE_TYPES key, ...] } per una data ISO 'YYYY-MM-DD'
function getCollectionForDate(iso) {
  if (SOSPESO_DATES.has(iso)) {
    return { sospeso: true, items: [] };
  }

  const { y, m, d } = parseISODate(iso);
  const utcMs = Date.UTC(y, m, d);
  const dow = new Date(utcMs).getUTCDay(); // 0=Dom ... 6=Sab

  const items = [];

  if (dow === 1) {
    items.push('PSA');
  } else if (dow === 2) {
    items.push('UMIDO');
  } else if (dow === 3) {
    const weeksSinceRef = Math.round((utcMs - VETRO_REF) / (7 * 86400000));
    if (weeksSinceRef % 2 === 0) items.push('VETRO');
    // settimane dispari = VETRO* UND (utenze non domestiche): escluso di proposito
  } else if (dow === 4) {
    const weeksSinceRef = Math.round((utcMs - CARTA_REF) / (7 * 86400000));
    items.push(weeksSinceRef % 2 === 0 ? 'CARTA' : 'SECCO');
  } else if (dow === 5) {
    items.push('UMIDO');
    items.push('PLASTICA');
  }

  return { sospeso: false, items };
}

function addDaysISO(iso, days) {
  const { y, m, d } = parseISODate(iso);
  const ms = Date.UTC(y, m, d) + days * 86400000;
  const dt = new Date(ms);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function todayISO(timeZone = 'Europe/Rome') {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA locale => YYYY-MM-DD
}

// UMD-ish export: funziona sia come <script> globale (browser) sia come CommonJS (Node/GitHub Actions)
const WasteCalendar = {
  WASTE_TYPES,
  CALENDAR_START,
  CALENDAR_END,
  getCollectionForDate,
  addDaysISO,
  todayISO,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WasteCalendar;
}
if (typeof window !== 'undefined') {
  window.WasteCalendar = WasteCalendar;
}
