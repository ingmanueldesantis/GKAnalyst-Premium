/**
 * ==============================================================================
 * GKANALYTICS - BACKEND DI AUTENTICAZIONE GOOGLE APPS SCRIPT (Code.gs)
 * ==============================================================================
 *
 * Questo script trasforma il tuo Foglio Google in un backend leggero e sicuro
 * per la gestione degli accessi all'app GKAnalytics.
 *
 * STRUTTURA DEL FOGLIO GOOGLE:
 * - Colonna A: Username (es. "mario.rossi", "portiere1")
 * - Colonna B: Password (es. "secret123")
 * - Colonna C: Stato ("ATTIVO" oppure "DISABILITATO")
 * - Colonna D: Ultimo Accesso (aggiornato in automatico dallo script)
 * - Colonna E: Note / Ruolo (opzionale, es. "Portiere Prima Squadra")
 *
 * ==============================================================================
 */

// Nome del foglio contenente gli utenti (se vuoto usa il primo foglio attivo)
var SHEET_NAME = ""; 

/**
 * Gestore per le richieste HTTP GET (consigliato per app web e WebView APK, evita problemi CORS)
 */
function doGet(e) {
  return handleRequest(e ? e.parameter : {});
}

/**
 * Gestore per le richieste HTTP POST
 */
function doPost(e) {
  var params = {};
  if (e) {
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e.parameter) {
      params = e.parameter;
    }
  }
  return handleRequest(params);
}

/**
 * Logica centrale di elaborazione delle richieste
 */
function handleRequest(params) {
  var action = (params.action || "verify").toLowerCase();
  var username = (params.username || "").toString().trim();
  var password = (params.password || "").toString().trim();

  // Test di connessione (Ping)
  if (action === "ping") {
    return createJsonResponse({
      success: true,
      status: "OK",
      message: "Backend GKAnalytics funzionante e connesso al Foglio Google!"
    });
  }

  // Azione 1: Verifica completa (Login con Username e Password)
  if (action === "verify" || action === "login") {
    if (!username || !password) {
      return createJsonResponse({
        success: false,
        status: "INVALID_CREDENTIALS",
        message: "Username e password sono obbligatori."
      });
    }

    var result = authenticateUser(username, password);
    return createJsonResponse(result);
  }

  // Azione 2: Controllo silenzioso in background dello stato (solo Username)
  if (action === "check_status" || action === "status") {
    if (!username) {
      return createJsonResponse({
        success: false,
        status: "NOT_FOUND",
        message: "Username non specificato."
      });
    }

    var statusResult = checkStatusOnly(username);
    return createJsonResponse(statusResult);
  }

  return createJsonResponse({
    success: false,
    status: "UNKNOWN_ACTION",
    message: "Azione non riconosciuta: " + action
  });
}

/**
 * Cerca l'utente nel foglio e confronta password e stato
 */
function authenticateUser(username, password) {
  var sheet = getTargetSheet();
  if (!sheet) {
    return {
      success: false,
      status: "ERROR",
      message: "Errore: Foglio di calcolo non trovato."
    };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      success: false,
      status: "NOT_FOUND",
      message: "Nessun utente registrato nel foglio."
    };
  }

  // Cerca riga per riga a partire dalla riga 2 (la riga 1 è l'intestazione)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var sheetUser = (row[0] || "").toString().trim();
    var sheetPass = (row[1] || "").toString().trim();
    var sheetStatus = (row[2] || "").toString().trim().toUpperCase();

    // Confronto username (case-insensitive)
    if (sheetUser.toLowerCase() === username.toLowerCase()) {
      // Verifica password
      if (sheetPass !== password) {
        return {
          success: false,
          status: "INVALID_PASSWORD",
          message: "Password non corretta."
        };
      }

      // Verifica stato dell'account
      if (sheetStatus !== "ATTIVO") {
        return {
          success: false,
          status: "DISABILITATO",
          message: "Questo account è stato disabilitato dall'amministratore. Contatta il supporto."
        };
      }

      // Se le credenziali sono corrette e l'account è ATTIVO:
      // Registra la data/ora dell'ultimo accesso nella Colonna D
      try {
        var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+1", "yyyy-MM-dd HH:mm:ss");
        sheet.getRange(i + 1, 4).setValue(nowFormatted);
      } catch (err) {
        Logger.log("Errore scrittura data accesso: " + err);
      }

      return {
        success: true,
        status: "ATTIVO",
        username: sheetUser,
        message: "Accesso autorizzato con successo!"
      };
    }
  }

  return {
    success: false,
    status: "NOT_FOUND",
    message: "Nome utente non trovato."
  };
}

/**
 * Verifica solo lo stato dell'account per il controllo silenzioso in background
 */
function checkStatusOnly(username) {
  var sheet = getTargetSheet();
  if (!sheet) {
    return { success: false, status: "ERROR", message: "Foglio non trovato" };
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var sheetUser = (row[0] || "").toString().trim();
    var sheetStatus = (row[2] || "").toString().trim().toUpperCase();

    if (sheetUser.toLowerCase() === username.toLowerCase()) {
      if (sheetStatus === "ATTIVO") {
        return {
          success: true,
          status: "ATTIVO",
          username: sheetUser,
          message: "Account attivo."
        };
      } else {
        return {
          success: false,
          status: "DISABILITATO",
          message: "Account disabilitato dall'amministratore."
        };
      }
    }
  }

  return {
    success: false,
    status: "NOT_FOUND",
    message: "Utente non trovato."
  };
}

/**
 * Ottiene il riferimento al foglio di lavoro corretto
 */
function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME && SHEET_NAME.trim() !== "") {
    var sheet = ss.getSheetByName(SHEET_NAME.trim());
    if (sheet) return sheet;
  }
  return ss.getSheets()[0];
}

/**
 * Restituisce una risposta JSON formattata per chiamate esterne con supporto CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Funzione di utilità per creare automaticamente la struttura della tabella
 * se il foglio è vuoto (eseguibile manualmente dall'editor Apps Script)
 */
function setupUserSheet() {
  var sheet = getTargetSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Username", "Password", "Stato", "Ultimo Accesso", "Note"]);
    sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#38bdf8");
    sheet.appendRow(["demo", "demo123", "ATTIVO", "", "Account dimostrativo"]);
    sheet.setFrozenRows(1);
    SpreadsheetApp.getActiveSpreadsheet().toast("Tabella utenti creata con successo!", "Setup GKAnalytics", 5);
  }
}
