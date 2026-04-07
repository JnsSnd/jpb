// ============================================================
//  MY BUDGET — Google Apps Script Backend
//  Paste this entire file into your Google Sheet's Script Editor
//  Then deploy as a Web App (see instructions below)
// ============================================================

const SHEET_NAME_TX      = 'Transactions';
const SHEET_NAME_BUD     = 'Budgets';
const SHEET_NAME_NEEDS   = 'Needs';
const SHEET_NAME_NEEDSHX = 'NeedsHistory';
const TX_HEADERS         = ['ID','Date','Type','Category','Description','Amount','Notes'];
const BUD_HEADERS        = ['Category','Limit'];
const NEEDS_HEADERS      = ['ID','Title','Description','Price','Status'];
const NEEDSHX_HEADERS    = ['ID','NeedID','NeedTitle','FromStatus','ToStatus','Price','Timestamp'];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter || {};
  const body   = parseBody(e);
  const action = params.action || body.action;

  try {
    let result;
    switch (action) {
      case 'getAll':        result = getAll();                    break;
      case 'addTx':         result = addTransaction(body);        break;
      case 'deleteTx':      result = deleteTransaction(body.id);  break;
      case 'saveBudget':    result = saveBudget(body);            break;
      case 'addNeed':          result = addNeed(body);               break;
      case 'updateNeed':       result = updateNeed(body);            break;
      case 'deleteNeed':       result = deleteNeed(body.id);         break;
      case 'addNeedsHistory':  result = addNeedsHistory(body);       break;
      default:              result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function parseBody(e) {
  try {
    if (e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (_) {}
  return e.parameter || {};
}

function jsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── SHEET HELPERS ───────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (first[0] !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

// ─── ACTIONS ─────────────────────────────────────────────────

function getAll() {
  const txSheet    = getSheet(SHEET_NAME_TX);
  const budSheet   = getSheet(SHEET_NAME_BUD);
  const needsSheet = getSheet(SHEET_NAME_NEEDS);
  const hxSheet    = getSheet(SHEET_NAME_NEEDSHX);
  ensureHeaders(txSheet,    TX_HEADERS);
  ensureHeaders(budSheet,   BUD_HEADERS);
  ensureHeaders(needsSheet, NEEDS_HEADERS);
  ensureHeaders(hxSheet,    NEEDSHX_HEADERS);

  const txData    = txSheet.getDataRange().getValues();
  const budData   = budSheet.getDataRange().getValues();
  const needsData = needsSheet.getDataRange().getValues();
  const hxData    = hxSheet.getDataRange().getValues();

  const transactions = txData.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id:       String(r[0]),
      date:     String(r[1]),
      type:     String(r[2]),
      category: String(r[3]),
      desc:     String(r[4]),
      amount:   parseFloat(r[5]) || 0,
      notes:    String(r[6] || ''),
    }));

  const budgets = {};
  budData.slice(1).forEach(r => {
    if (r[0]) budgets[String(r[0])] = parseFloat(r[1]) || 0;
  });

  const needs = needsData.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id:     String(r[0]),
      title:  String(r[1]),
      desc:   String(r[2] || ''),
      price:  parseFloat(r[3]) || 0,
      status: String(r[4] || 'unpaid'),
    }));

  const needsHistory = hxData.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id:         String(r[0]),
      needId:     String(r[1]),
      needTitle:  String(r[2]),
      fromStatus: String(r[3]),
      toStatus:   String(r[4]),
      price:      parseFloat(r[5]) || 0,
      timestamp:  String(r[6]),
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return { transactions, budgets, needs, needsHistory };
}

function addTransaction(body) {
  const sheet = getSheet(SHEET_NAME_TX);
  ensureHeaders(sheet, TX_HEADERS);
  const row = [
    body.id, body.date, body.type,
    body.category, body.desc,
    parseFloat(body.amount), body.notes || ''
  ];
  sheet.appendRow(row);
  return { success: true };
}

function deleteTransaction(id) {
  const sheet = getSheet(SHEET_NAME_TX);
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Row not found: ' + id };
}

function saveBudget(body) {
  const sheet = getSheet(SHEET_NAME_BUD);
  ensureHeaders(sheet, BUD_HEADERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.category)) {
      sheet.getRange(i + 1, 2).setValue(parseFloat(body.limit) || 0);
      return { success: true };
    }
  }
  // Not found — append new row
  sheet.appendRow([body.category, parseFloat(body.limit) || 0]);
  return { success: true };
}

// ─── NEEDS ───────────────────────────────────────────────────

function addNeed(body) {
  const sheet = getSheet(SHEET_NAME_NEEDS);
  ensureHeaders(sheet, NEEDS_HEADERS);
  sheet.appendRow([
    body.id,
    body.title,
    body.desc   || '',
    parseFloat(body.price) || 0,
    body.status || 'unpaid',
  ]);
  return { success: true };
}

function updateNeed(body) {
  const sheet = getSheet(SHEET_NAME_NEEDS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        body.id,
        body.title,
        body.desc   || '',
        parseFloat(body.price) || 0,
        body.status || 'unpaid',
      ]]);
      return { success: true };
    }
  }
  return { error: 'Need not found: ' + body.id };
}

function deleteNeed(id) {
  const sheet = getSheet(SHEET_NAME_NEEDS);
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Need not found: ' + id };
}
function addNeedsHistory(body) {
  const sheet = getSheet(SHEET_NAME_NEEDSHX);
  ensureHeaders(sheet, NEEDSHX_HEADERS);
  sheet.appendRow([
    body.id,
    body.needId,
    body.needTitle,
    body.fromStatus,
    body.toStatus,
    parseFloat(body.price) || 0,
    body.timestamp,
  ]);
  return { success: true };
}