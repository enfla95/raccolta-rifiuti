# Raccolta Rifiuti - Uggiate con Ronago

PWA (web app installabile) con il calendario 2026/2027 della raccolta rifiuti
di Uggiate con Ronago, per **utenze domestiche** (il vetro "VETRO* UND",
riservato alle utenze non domestiche, e' escluso di proposito: per le case
resta valido solo il "VETRO" quindicinale).

Include:
- vista mensile e vista "prossimi giorni" con i colori per tipo di rifiuto;
- card "oggi" / "stasera porta fuori (domani)";
- promemoria push la sera prima, inviato automaticamente da GitHub Actions
  tramite **Web Push standard (VAPID)** — nessun servizio di terze parti,
  nessun account da creare: solo il protocollo push nativo del browser.

## Struttura di questa cartella

Tutti i file sono allo stesso livello, nessuna sottocartella, **tranne
un'eccezione obbligata da GitHub**: il file `notify.yml` deve finire, una
volta caricato su GitHub, dentro il percorso `.github/workflows/notify.yml`
(due sottocartelle) — GitHub riconosce i workflow automatici *solo* se stanno
in quel percorso esatto, non e' negoziabile. Vedi il punto 1 sotto per come
farlo in pratica.

## Limite importante sulle notifiche

Su iOS **non esiste** un modo per rendere una notifica "non rimovibile"
dalla schermata di blocco tramite una web app — nemmeno le app native
possono farlo per notifiche normali (l'unica eccezione reale sono le
*Live Activity*, che richiedono un'app nativa Swift con Xcode, non una PWA
pubblicata su GitHub). Questa app usa quindi una **notifica push normale**:
rimovibile con uno swipe come qualsiasi altra, ma inviata solo la sera prima
e **assente** nei giorni in cui non c'e' nulla da portare fuori.

## 1. Pubblicare su GitHub Pages

1. Crea un repository GitHub (pubblico), es. `raccolta-rifiuti`.
2. Carica **tutti** i file di questa cartella nella radice del repo, tranne
   `notify.yml`: quello va caricato nel percorso `.github/workflows/notify.yml`
   (su GitHub, mentre crei/carichi il file, scrivi il percorso completo
   `.github/workflows/notify.yml` nel nome — GitHub crea le due sottocartelle
   da solo).
   - Con `git`, da terminale, e' automatico:
     ```powershell
     cd "$HOME\Desktop\RaccoltaRifiuti"
     mkdir .github\workflows
     move notify.yml .github\workflows\notify.yml
     git init
     git add .
     git commit -m "Prima versione app raccolta rifiuti"
     git branch -M main
     git remote add origin https://github.com/TUO-USERNAME/raccolta-rifiuti.git
     git push -u origin main
     ```
3. Nel repo: **Settings → Pages → Build and deployment → Source**: scegli
   `Deploy from a branch`, branch `main`, cartella `/ (root)`.
4. Dopo qualche minuto il sito sara' online su
   `https://<tuo-utente>.github.io/<nome-repo>/`.

## 2. Attivare le notifiche (Web Push, nessun account esterno)

Le notifiche usano il protocollo Web Push standard, autenticato da una
coppia di chiavi **VAPID** (pubblica + privata). La chiave pubblica non e'
un segreto (va nel codice, la trovi gia' hardcoded in `app.js` e
`send-notification.js`). **La chiave privata invece non deve mai finire in
un file del repository** (il repo e' pubblico): genera la tua coppia e
metti la privata *solo* nei GitHub Secrets, mai in un commit.

**Genera la tua coppia di chiavi** (un minuto, nella Console del browser -
tasto destro sulla pagina → Ispeziona → tab Console — su una pagina
qualsiasi, anche questa del repo):

```js
crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']).then(async k=>{
  const pub=await crypto.subtle.exportKey('raw',k.publicKey);
  const priv=await crypto.subtle.exportKey('jwk',k.privateKey);
  const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  console.log('PUBLIC:', b64url(pub));
  console.log('PRIVATE:', priv.d);
});
```

Poi:

1. Sostituisci il valore di `VAPID_PUBLIC_KEY` con la tua chiave **pubblica**
   in due file: [`app.js`](app.js) (riga con `const VAPID_PUBLIC_KEY = ...`)
   e [`send-notification.js`](send-notification.js) (stessa costante). Fai
   commit di questa modifica: la chiave pubblica puo' stare tranquillamente
   nel codice.
2. Nel repository GitHub vai su **Settings → Secrets and variables →
   Actions → New repository secret** e crea il secret `VAPID_PRIVATE_KEY`
   incollando la chiave **privata** generata sopra. Non scriverla mai in
   nessun file del progetto.
3. Apri l'app da iPhone **dopo** averla aggiunta alla schermata Home (punto 3
   qui sotto) e tocca **"Attiva promemoria serale"**. iOS chiede il permesso
   di notifica: concedilo.
4. L'app mostra un riquadro con un testo tipo `{"endpoint": "...", "keys": {...}}`:
   tocca **Copia**.
5. Torna su **Settings → Secrets and variables → Actions** e crea un secondo
   secret `PUSH_SUBSCRIPTION`, incollando esattamente quel testo copiato.
6. Fatto. Il workflow (una volta al percorso `.github/workflows/notify.yml`
   su GitHub, vedi sezione 1) ora puo' girare ogni sera — due orari cron
   coprono ora legale/solare; lo script `send-notification.js` invia solo
   se e' davvero ~20:00 a Roma e solo se domani c'e' qualcosa da raccogliere.
7. Per testare subito senza aspettare la sera: nel repo vai su **Actions →
   Notifica raccolta rifiuti → Run workflow**.

Se disattivi le notifiche e le riattivi (o cambi telefono), il testo al
punto 4 cambia: ripeti i punti 3-5 e aggiorna il secret `PUSH_SUBSCRIPTION`.

## 3. Aggiungere l'app alla schermata Home (iPhone)

1. Apri Safari (deve essere Safari, non Chrome) e vai all'URL GitHub Pages.
2. Tocca l'icona **Condividi** → **Aggiungi a Home**.
3. Apri l'app dalla nuova icona in Home (parte a schermo intero, senza le
   barre di Safari).
4. Tocca **"Attiva promemoria serale"** e conferma il permesso di notifica
   quando richiesto da iOS. Serve iOS 16.4 o superiore e l'app deve essere
   stata aperta almeno una volta dalla schermata Home (i permessi push non
   funzionano se apri il sito solo dentro Safari, senza averlo installato).
   Poi segui il punto 2 della sezione precedente per collegare il dispositivo.

## Come funziona il calendario (`data.js`)

Le date non sono scritte a mano una per una: sono calcolate da una regola
fissa validata riga per riga contro il calendario ufficiale (marzo-agosto
2026 e dicembre 2026/gennaio 2027, corrispondenza esatta):

| Giorno | Raccolta |
|---|---|
| Lunedi' | PSA |
| Martedi' | Umido |
| Mercoledi' | Vetro (una settimana si', una no — utenze domestiche) |
| Giovedi' | Carta / Secco (alternati ogni settimana) |
| Venerdi' | Umido + Plastica |
| Sabato/Domenica | nessuna raccolta |

Uniche eccezioni: **25 dicembre 2026** e **1 gennaio 2027**, raccolta
sospesa per festivita'.

Se il Comune pubblica un calendario diverso per gli anni successivi, basta
aggiornare le costanti `VETRO_REF`, `CARTA_REF`, `SOSPESO_DATES`,
`CALENDAR_START`/`CALENDAR_END` in [`data.js`](data.js).

## Anteprima locale

Non serve Node/Python installato: c'e' un piccolo server statico in
PowerShell (`serve.ps1`) gia' pronto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

e poi apri `http://localhost:8080`.

## Nota sulle icone

L'icona dell'app (`icon.svg`) e' in SVG. Funziona su Android/Chrome; su
alcune versioni di iOS l'icona sulla schermata Home potrebbe non essere
perfetta. Se vuoi un'icona PNG piu' fedele, genera un `icon-192.png` /
`icon-512.png` con un qualsiasi tool online (es. un convertitore SVG→PNG) e
aggiorna i riferimenti in `manifest.json` e `index.html`.
