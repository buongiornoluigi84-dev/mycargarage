# MyCarGarage v1.0.0 — Istruzioni di installazione

Gestione manutenzione, spese e scadenze veicoli.
Stack: PWA su GitHub Pages + Google Apps Script + Google Sheet su Drive.

---

## PARTE 1 — Backend (Google Drive)

1. Vai su Google Drive → **Nuovo → Fogli Google**, chiamalo **MyCarGarage DB**
2. Nel foglio: **Estensioni → Apps Script**
3. Cancella il contenuto e incolla tutto il file **Code.gs**
4. Salva (icona dischetto), dai un nome al progetto: `MyCarGarage`
5. In alto seleziona la funzione **`setup`** → premi **Esegui**
   - Autorizza i permessi quando richiesto (Avanzate → Vai a MyCarGarage)
   - Questo crea i 3 fogli: Veicoli, Interventi, Scadenze
6. Seleziona la funzione **`creaTriggerGiornaliero`** → **Esegui**
   - Attiva il controllo email giornaliero delle 8:00
7. **Deploy → Nuova implementazione**:
   - Tipo: **App web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
8. **Copia l'URL** che finisce con `/exec` — ti serve tra poco

> Le email di promemoria arrivano al tuo account Google a **30, 14, 7 e 0 giorni**
> dalla scadenza. Le scadenze già scadute vengono ricordate ogni lunedì.
> Per cambiarle: modifica `GIORNI_PROMEMORIA` in cima a Code.gs.

---

## PARTE 2 — App (GitHub Pages)

1. Crea il repo **mycargarage** su GitHub (buongiornoluigi84-dev)
2. Carica: `index.html`, `manifest.json`, `sw.js`, cartella `icons/`
3. Settings → Pages → Deploy from branch → main → root
4. Apri `index.html` e sostituisci in cima allo script:
   ```js
   const SCRIPT_URL = 'INCOLLA_QUI_URL_APPS_SCRIPT';
   ```
   con l'URL `/exec` copiato prima. Committa.

   *(In alternativa: puoi incollare l'URL direttamente dall'app in ⚙ Impostazioni,
   senza toccare il codice — viene salvato sul dispositivo.)*

5. Apri **https://buongiornoluigi84-dev.github.io/mycargarage/**
6. PIN: **5918**
7. Su telefono: menu browser → **Aggiungi a schermata Home** (PWA installabile)

---

## Uso rapido

- **+** in basso a destra: nuovo intervento / nuova scadenza / nuovo veicolo
- **Card veicolo** → dettaglio con storico interventi e scadenze
- **↻ Rinnova** su una scadenza: la vecchia va in storico, si crea la nuova
  (data attivazione precompilata, scadenza a +1 anno)
- **✎ Modifica** nel dettaglio veicolo: cambia dati, **Archivia** o **Elimina tutto**
- I veicoli archiviati si ripristinano da ⚙ Impostazioni
- Inserendo i km in un intervento, i km del veicolo si aggiornano da soli
- Semaforo: 🟢 oltre 45 giorni · 🟡 entro 45 · 🔴 entro 14 o scaduta

---

## Regola versioni

Ogni modifica futura incrementa la versione (v1.0.0 → v1.0.1)
e il nome cache del service worker (`mycargarage-v1` → `mycargarage-v2`).

## Icona

Le icone attuali (contagiri ambra) sono placeholder. Quando mi passi la tua
immagine di copertina la converto in icon-192.png, icon-512.png e
apple-touch-icon.png.
