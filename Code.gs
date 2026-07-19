/**
 * ============================================================
 *  MyCarGarage - Backend Google Apps Script
 *  Versione: v1.1.0
 * ============================================================
 *  ISTRUZIONI RAPIDE:
 *  1. Crea un nuovo Google Sheet su Drive, chiamalo "MyCarGarage DB"
 *  2. Estensioni > Apps Script, incolla questo codice
 *  3. Esegui una volta la funzione "setup" (autorizza i permessi)
 *  4. Esegui una volta la funzione "creaTriggerGiornaliero"
 *  5. Deploy > Nuova implementazione > App web
 *     - Esegui come: Me
 *     - Chi ha accesso: Chiunque
 *  6. Copia l'URL /exec e incollalo in index.html (SCRIPT_URL)
 * ============================================================
 */

// Se vuoto, le email di promemoria arrivano all'account Google
// proprietario dello script. Altrimenti scrivi qui l'email.
const EMAIL_DESTINATARIO = '';

// Giorni prima della scadenza in cui inviare il promemoria
const GIORNI_PROMEMORIA = [30, 14, 7, 0];

const SHEET_VEICOLI   = 'Veicoli';
const SHEET_INTERVENTI = 'Interventi';
const SHEET_SCADENZE  = 'Scadenze';

const HEADERS = {
  [SHEET_VEICOLI]:    ['ID','Nome','Marca','Modello','Anno','Targa','Km','Colore','Stato','Note','Creato'],
  [SHEET_INTERVENTI]: ['ID','VeicoloID','Data','Tipo','Descrizione','Km','Prezzo','Note','Creato'],
  [SHEET_SCADENZE]:   ['ID','VeicoloID','Tipo','DataInizio','DataScadenza','Prezzo','Stato','Note','Creato']
};

/* ---------------- SETUP ---------------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
    }
  });
  // Rimuove il foglio predefinito vuoto se esiste
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Foglio1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 3) ss.deleteSheet(def);
  return 'Setup completato';
}

function creaTriggerGiornaliero() {
  // Elimina eventuali trigger esistenti per evitare duplicati
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'controllaScadenze') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('controllaScadenze')
    .timeBased().everyDays(1).atHour(8).create();
  return 'Trigger giornaliero creato (ore 8:00)';
}

/* ---------------- API WEB ---------------- */

function doGet(e) {
  return jsonOut({ ok: true, app: 'MyCarGarage', version: '1.1.0' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const req = JSON.parse(e.postData.contents);
    const action = req.action;
    let result;

    switch (action) {
      case 'getAll':          result = getAll(); break;
      case 'addVehicle':      result = addVehicle(req); break;
      case 'updateVehicle':   result = updateVehicle(req); break;
      case 'setVehicleState': result = setVehicleState(req.id, req.stato); break;
      case 'deleteVehicle':   result = deleteVehicle(req.id); break;
      case 'addIntervento':   result = addIntervento(req); break;
      case 'setInterventoTipo': result = setInterventoTipo(req.id, req.tipo); break;
      case 'deleteIntervento':result = deleteRow(SHEET_INTERVENTI, req.id); break;
      case 'addScadenza':     result = addScadenza(req); break;
      case 'renewScadenza':   result = renewScadenza(req); break;
      case 'deleteScadenza':  result = deleteRow(SHEET_SCADENZE, req.id); break;
      default: throw new Error('Azione sconosciuta: ' + action);
    }
    return jsonOut({ ok: true, data: result });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- HELPERS ---------------- */

function sheet(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Foglio mancante: ' + name + ' (esegui setup)');
  return sh;
}

function fmtDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
}

function readAll(name) {
  const sh = sheet(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      if (h === 'Data' || h === 'DataInizio' || h === 'DataScadenza' || h === 'Creato') v = fmtDate(v);
      obj[h] = v;
    });
    return obj;
  }).filter(o => o.ID);
}

function findRowById(name, id) {
  const sh = sheet(name);
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function newId() {
  return Utilities.getUuid().slice(0, 8);
}

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function deleteRow(name, id) {
  const row = findRowById(name, id);
  if (row === -1) throw new Error('Elemento non trovato');
  sheet(name).deleteRow(row);
  return { deleted: id };
}

/* ---------------- AZIONI ---------------- */

function getAll() {
  return {
    veicoli: readAll(SHEET_VEICOLI),
    interventi: readAll(SHEET_INTERVENTI),
    scadenze: readAll(SHEET_SCADENZE)
  };
}

function addVehicle(r) {
  const id = newId();
  sheet(SHEET_VEICOLI).appendRow([
    id, r.nome || '', r.marca || '', r.modello || '', r.anno || '',
    r.targa || '', r.km || 0, r.colore || '#FFB020', 'attiva', r.note || '', today()
  ]);
  return { id: id };
}

function updateVehicle(r) {
  const row = findRowById(SHEET_VEICOLI, r.id);
  if (row === -1) throw new Error('Veicolo non trovato');
  const sh = sheet(SHEET_VEICOLI);
  const cur = sh.getRange(row, 1, 1, HEADERS[SHEET_VEICOLI].length).getValues()[0];
  sh.getRange(row, 1, 1, HEADERS[SHEET_VEICOLI].length).setValues([[
    r.id,
    r.nome !== undefined ? r.nome : cur[1],
    r.marca !== undefined ? r.marca : cur[2],
    r.modello !== undefined ? r.modello : cur[3],
    r.anno !== undefined ? r.anno : cur[4],
    r.targa !== undefined ? r.targa : cur[5],
    r.km !== undefined ? r.km : cur[6],
    r.colore !== undefined ? r.colore : cur[7],
    cur[8],
    r.note !== undefined ? r.note : cur[9],
    fmtDate(cur[10])
  ]]);
  return { updated: r.id };
}

function setVehicleState(id, stato) {
  const row = findRowById(SHEET_VEICOLI, id);
  if (row === -1) throw new Error('Veicolo non trovato');
  sheet(SHEET_VEICOLI).getRange(row, 9).setValue(stato); // colonna Stato
  return { id: id, stato: stato };
}

function deleteVehicle(id) {
  // Elimina il veicolo e tutti i suoi dati collegati
  deleteRow(SHEET_VEICOLI, id);
  [SHEET_INTERVENTI, SHEET_SCADENZE].forEach(name => {
    const sh = sheet(name);
    const last = sh.getLastRow();
    if (last < 2) return;
    const vals = sh.getRange(2, 2, last - 1, 1).getValues(); // colonna VeicoloID
    for (let i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][0]) === String(id)) sh.deleteRow(i + 2);
    }
  });
  return { deleted: id };
}

function addIntervento(r) {
  const id = newId();
  sheet(SHEET_INTERVENTI).appendRow([
    id, r.veicoloId, r.data || today(), r.tipo || 'Altro',
    r.descrizione || '', r.km || '', r.prezzo || 0, r.note || '', today()
  ]);
  // Aggiorna i km del veicolo se superiori a quelli registrati
  if (r.km) {
    const row = findRowById(SHEET_VEICOLI, r.veicoloId);
    if (row !== -1) {
      const sh = sheet(SHEET_VEICOLI);
      const kmAttuali = Number(sh.getRange(row, 7).getValue()) || 0;
      if (Number(r.km) > kmAttuali) sh.getRange(row, 7).setValue(Number(r.km));
    }
  }
  return { id: id };
}

function setInterventoTipo(id, tipo) {
  const row = findRowById(SHEET_INTERVENTI, id);
  if (row === -1) throw new Error('Intervento non trovato');
  sheet(SHEET_INTERVENTI).getRange(row, 4).setValue(tipo); // colonna Tipo = categoria
  return { id: id, tipo: tipo };
}

function addScadenza(r) {
  const id = newId();
  sheet(SHEET_SCADENZE).appendRow([
    id, r.veicoloId, r.tipo || 'Altro', r.dataInizio || today(),
    r.dataScadenza, r.prezzo || 0, 'attiva', r.note || '', today()
  ]);
  return { id: id };
}

function renewScadenza(r) {
  // Segna la vecchia come rinnovata e crea la nuova
  const row = findRowById(SHEET_SCADENZE, r.oldId);
  if (row !== -1) sheet(SHEET_SCADENZE).getRange(row, 7).setValue('rinnovata');
  return addScadenza(r);
}

/* ---------------- PROMEMORIA EMAIL ---------------- */

function controllaScadenze() {
  const veicoli = readAll(SHEET_VEICOLI);
  const scadenze = readAll(SHEET_SCADENZE).filter(s => s.Stato === 'attiva');
  const email = EMAIL_DESTINATARIO || Session.getEffectiveUser().getEmail();
  const tz = Session.getScriptTimeZone();
  const oggi = new Date(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + 'T00:00:00');

  const avvisi = [];
  scadenze.forEach(s => {
    if (!s.DataScadenza) return;
    const d = new Date(s.DataScadenza + 'T00:00:00');
    const giorni = Math.round((d - oggi) / 86400000);
    if (GIORNI_PROMEMORIA.indexOf(giorni) !== -1 || giorni < 0) {
      const v = veicoli.find(x => String(x.ID) === String(s.VeicoloID));
      const nomeV = v ? (v.Nome || (v.Marca + ' ' + v.Modello)) : 'Veicolo';
      avvisi.push({ veicolo: nomeV, tipo: s.Tipo, data: s.DataScadenza, giorni: giorni });
    }
  });

  if (avvisi.length === 0) return;

  // Evita di mandare ogni giorno la stessa email per le scadute:
  // per le scadute (giorni<0) invia solo il lunedì
  const giornoSettimana = new Date().getDay(); // 1 = lunedì
  const daInviare = avvisi.filter(a => a.giorni >= 0 || giornoSettimana === 1);
  if (daInviare.length === 0) return;

  let corpo = 'Ciao Luigi,\n\nPromemoria scadenze MyCarGarage:\n\n';
  daInviare.sort((a, b) => a.giorni - b.giorni).forEach(a => {
    const dataIt = a.data.split('-').reverse().join('/');
    if (a.giorni < 0) {
      corpo += '🔴 SCADUTA - ' + a.veicolo + ': ' + a.tipo + ' scaduta il ' + dataIt + ' (' + Math.abs(a.giorni) + ' giorni fa)\n';
    } else if (a.giorni === 0) {
      corpo += '🔴 OGGI - ' + a.veicolo + ': ' + a.tipo + ' scade OGGI (' + dataIt + ')\n';
    } else {
      const icona = a.giorni <= 7 ? '🔴' : (a.giorni <= 14 ? '🟡' : '🟢');
      corpo += icona + ' ' + a.veicolo + ': ' + a.tipo + ' scade tra ' + a.giorni + ' giorni (' + dataIt + ')\n';
    }
  });
  corpo += '\n— MyCarGarage v1.1.0';

  const urgenti = daInviare.filter(a => a.giorni <= 7).length;
  const oggetto = (urgenti > 0 ? '🔴 ' : '') + 'MyCarGarage: ' + daInviare.length + ' scadenz' + (daInviare.length === 1 ? 'a' : 'e') + ' in arrivo';

  MailApp.sendEmail(email, oggetto, corpo);
}
