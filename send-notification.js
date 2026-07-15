// Eseguito da GitHub Actions ogni sera. Calcola cosa portare fuori DOMANI e
// invia una push via Web Push standard (nessun servizio terzo, libreria
// "web-push" + chiavi VAPID) solo se c'e' davvero qualcosa da raccogliere.
// Se non c'e' nulla (weekend, o giorno SOSPESO per festivita'), non invia
// nessuna notifica: e' il modo in cui "notifica assente" viene rispettato,
// dato che una vera notifica non rimovibile non e' disponibile su iOS via web.

const path = require('path');
const webpush = require('web-push');
const { getCollectionForDate, addDaysISO, todayISO, WASTE_TYPES } = require(
  path.join(__dirname, 'data.js')
);

const ROME_TZ = 'Europe/Rome';

// Chiave pubblica gemella di quella hardcoded in app.js (non e' un segreto).
const VAPID_PUBLIC_KEY = 'BKixPv8qXxUZgLMy2Bx_oMuitk1z3I7LEuIRtoWu5sjK_CDJrgFugA1OlvNmM2sWwhJ7SnFxDtsBpRdBAowJ9HY';
const VAPID_SUBJECT = 'mailto:uran.gjiza@gmail.com';

function currentRomeHour() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: ROME_TZ,
    hour: '2-digit',
    hour12: false,
  });
  return Number(fmt.format(new Date()));
}

async function main() {
  // Il workflow ha due trigger cron (uno per l'ora legale, uno per l'ora
  // solare) cosi' che uno dei due coincida sempre con le ~20:00 locali.
  // Qui scartiamo l'esecuzione "fuori orario" per evitare doppi invii.
  const hour = currentRomeHour();
  if (hour !== 20) {
    console.log(`Ora locale Europe/Rome = ${hour}, fuori dalla finestra di invio (20). Esco senza inviare.`);
    return;
  }

  const today = todayISO(ROME_TZ);
  const tomorrow = addDaysISO(today, 1);
  const data = getCollectionForDate(tomorrow);

  if (data.sospeso) {
    console.log(`Raccolta sospesa il ${tomorrow} (festivita'). Nessuna notifica inviata.`);
    return;
  }
  if (!data.items.length) {
    console.log(`Nessuna raccolta il ${tomorrow}. Nessuna notifica inviata.`);
    return;
  }

  const labels = data.items.map((key) => WASTE_TYPES[key].label);
  const contents = `Stasera porta fuori: ${labels.join(', ')}`;

  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subscriptionRaw = process.env.PUSH_SUBSCRIPTION;
  if (!privateKey || !subscriptionRaw) {
    throw new Error('Variabili VAPID_PRIVATE_KEY / PUSH_SUBSCRIPTION mancanti (imposta i GitHub Secrets, vedi README).');
  }

  // PUSH_SUBSCRIPTION puo' essere un singolo oggetto (un dispositivo) oppure
  // un array di oggetti (piu' dispositivi/telefoni): entrambi i formati sono
  // accettati, cosi' non serve un secret diverso per ogni telefono.
  let subscriptions;
  try {
    const parsed = JSON.parse(subscriptionRaw);
    subscriptions = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    throw new Error('PUSH_SUBSCRIPTION non e\' un JSON valido: ricopialo dall\'app (bottone "Attiva promemoria serale").');
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

  const payload = JSON.stringify({ title: 'Raccolta rifiuti domani', body: contents });

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => webpush.sendNotification(subscription, payload))
  );

  let anySuccess = false;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      anySuccess = true;
      console.log(`Notifica inviata al dispositivo ${i + 1}/${subscriptions.length} per il ${tomorrow}: "${contents}"`);
    } else {
      const err = result.reason;
      console.error(`Dispositivo ${i + 1}/${subscriptions.length}: invio fallito (${err.statusCode || err.message}).`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.error(`Dispositivo ${i + 1}/${subscriptions.length}: subscription non piu' valida (disattivata/scaduta) - rimuovila o riattivala e aggiorna il secret PUSH_SUBSCRIPTION.`);
      }
    }
  });

  if (!anySuccess) {
    throw new Error('Invio fallito su tutti i dispositivi registrati.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
