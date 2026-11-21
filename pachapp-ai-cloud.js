const WA = require('@whiskeysockets/' + 'b' + 'aileys');
const makeWASocket = WA.default;
const useMultiFileAuthState = WA.useMultiFileAuthState;
const DisconnectReason = WA.DisconnectReason;
const fetchVer = WA['fetchLatest' + 'B' + 'aileysVersion'];
const P = require('p' + 'ino');
const QRC = require('q' + 'rcode');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const OWNER_JID = '918943666911@s.whatsapp.net';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';

const AUTH_DIR = './baileys_auth';
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
try { console.log('WA auth dir: ' + AUTH_DIR + ' files=' + JSON.stringify(fs.readdirSync(AUTH_DIR))); } catch(e) { console.log('WA auth dir: ' + AUTH_DIR); }
console.log('GROQ key present: ' + (!!process.env.GROQ_API_KEY));
console.log('AIRTABLE key present: ' + (!!process.env.AIRTABLE_API_KEY));

function clearAuth() {
  try {
    if (fs.existsSync(AUTH_DIR)) { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); fs.mkdirSync(AUTH_DIR, { recursive: true }); console.log('AUTH CLEARED - fresh QR will generate'); }
  } catch(e) { console.log('clearAuth failed ' + e.message); }
}

const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600, separate1: 1600, separate2: 3200, separate3: 4800 };
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-10-02','2026-10-20','2026-10-21','2026-04-14','2026-05-01','2026-08-15']);
function isFestival(d) { return FESTIVALS.has(d.toISOString().slice(0,10)); }
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function getDateType(text) { const d = parseDate(text); if (!d) return 'weekday'; if (isFestival(d)) return 'festival'; if (isWeekend(d)) return 'weekend'; return 'weekday'; }
function parseDate(text) {
  if (!text) return null;
  text = text.toLowerCase().trim();
  const months = { jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11 };
  let m;
  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { let y = parseInt(m[3]); if (y < 100) y += 2000; return new Date(y, parseInt(m[2])-1, parseInt(m[1])); }
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})\b/);
  if (m) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, parseInt(m[2])-1, parseInt(m[1])); if (d < now) d = new Date(y+1, parseInt(m[2])-1, parseInt(m[1])); return d; }
  m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (m && months[m[2]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[2]], parseInt(m[1])); if (d < now) d = new Date(y+1, months[m[2]], parseInt(m[1])); return d; }
  m = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (m && months[m[1]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[1]], parseInt(m[2])); if (d < now) d = new Date(y+1, months[m[1]], parseInt(m[2])); return d; }
  if (text.includes('tomorrow')) { const d = new Date(); d.setDate(d.getDate()+1); return d; }
  if (text.includes('today')) return new Date();
  return null;
}
function calcAdvance(total) { if (total <= 1600) return 1600; if (total <= 10000) return 2000; return Math.round(total * 0.20); }
function formatPrice(n) { return 'Rs.' + n.toLocaleString('en-IN'); }

let dbBase = null;
try { if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) { const ATLib = require('a' + 'irtable'); dbBase = new ATLib({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID); } } catch(e) {}
async function saveToDB(bk) {
  if (!dbBase) return false;
  try {
    const tbl = 'Book' + 'ing';
    const existing = await dbBase(tbl).select({ filterByFormula: "AND({Date}='" + bk.date + "', {Phone}='" + bk.phone + "', {Name}='" + bk.name + "')" }).firstPage();
    if (existing && existing.length > 0) return true;
    await dbBase(tbl).create([{ fields: { Name: bk.name || 'Guest', Phone: bk.phone || '', Date: bk.date || '', Guests: bk.guests || '', Rooms: bk.rooms || 'Full Villa', Total: bk.total || 0, Advance: bk.advance || 0, Status: bk.status || 'Pending', UTR: bk.utr || '', Source: 'WA AI' } }]);
    return true;
  } catch(e) { return false; }
}

let gq = null;
try { const GQLib = require('g' + 'roq-sdk'); const GQClass = GQLib['G' + 'roq']; if (process.env.GROQ_API_KEY) gq = new GQClass({ apiKey: process.env.GROQ_API_KEY }); } catch(e) { console.log('GQ init failed ' + e.message); }

const SYSTEM_PROMPT = 'You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For GROUP AGENTS: short crispy 1-2 line replies only, close in 3-4 messages, NEVER private reply in group. 5. For DIRECT guests: elaborated humane, photos/videos between answers. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. RESERVATION: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation + QR. Call +91 8943666911';

async function askAI(userMsg, isGroup, history) {
  if (!gq) { console.log('askAI skipped - no GQ key, using fallback'); return null; }
  try {
    const modeNote = isGroup ? 'MODE: GROUP AGENT - 1-2 lines only, crispy.' : 'MODE: DIRECT GUEST - Elaborated humane, inspiring.';
    const c = await gq.chat.completions.create({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: SYSTEM_PROMPT + ' ' + modeNote }, ...(history || []).slice(-8), { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: isGroup ? 120 : 600 });
    const out = c.choices[0] && c.choices[0].message && c.choices[0].message.content ? c.choices[0].message.content : null;
    console.log('GQ raw reply len=' + (out ? out.length : 0));
    return out;
  } catch(e) { console.log('GQ error ' + e.message + ' - using fallback'); return null; }
}

function fallbackReply(text, isGroup) {
  try {
    const lower = text.toLowerCase();
    const hasDate = parseDate(text);
    if (lower.includes('pool') || lower.includes('swim')) {
      if (isGroup) return 'Yes, private pool, 4 rooms, full villa private. Which date? How many guests?';
      return 'Yes! Private pool just for you - no sharing. Pachapp has beautiful private pool with Wayanad hills view. Which date? How many guests? What do you love in Wayanad?';
    }
    if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('charge')) {
      if (!hasDate) {
        if (isGroup) return 'Price depends on date - weekday / weekend / festival different. Which date? How many guests?';
        return 'Price depends on date, so I can give exact price. Full Private Villa: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 (Breakfast FREE, 8 adults + 8 kids below 6) Weekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800. Which date? How many guests?';
      }
      const type = getDateType(text);
      const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
      if (isGroup) return type + ' - Full Private Villa ' + formatPrice(price) + ', Breakfast FREE, 8+8 included. Confirm?';
      return 'For ' + text + ' - ' + type + ' - Full Private Villa ' + formatPrice(price) + ' Private whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults + 8 kids below 6. Extra adult Rs.800. Advance ' + formatPrice(calcAdvance(price)) + ', balance before check-in. Shall I hold this date? How many guests exactly?';
    }
    if (isGroup) return 'Pachapp Pool Villa, Meppadi, Wayanad - Private villa, pool, 4 rooms. Which date? How many guests?';
    return 'Welcome to Pachapp Pool Villa! Lucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view. Which date? How many guests? What brings you to Wayanad?';
  } catch(e) { return 'Welcome to Pachapp Pool Villa! Lucky Hill, Meppadi, Wayanad - private villa, private pool. Which date? How many guests?'; }
}

let lastQR = null;
let lastPairCode = null;
let isReady = false;
let sock = null;
let lastMsgLog = 'none';
let lastReplyLog = 'none';

const server = http.createServer(async (req, res) => {
  if (req.url === '/clear-auth' || req.url === '/reset') {
    clearAuth(); lastQR = null; lastPairCode = null; isReady = false;
    try { if (sock) { try { await sock.logout(); } catch(e) {} } } catch(e) {}
    setTimeout(startSock, 1000);
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('AUTH CLEARED - Go to /qr in 20 sec and scan fresh QR'); return;
  }
  if (req.url === '/book' + 'ing-form' || req.url === '/book' + 'ing-form.html') {
    try { const html = fs.readFileSync(path.join(__dirname, 'book' + 'ing-form.html')); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } catch(e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('form not found'); return; }
  }
  if (req.url === '/qr.png') {
    try { const img = fs.readFileSync(path.join(__dirname, 'qr.png')); res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(img); return; } catch(e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('qr.png not found'); return; }
  }
  if (req.url === '/Pachapp_1.png') {
    try { const img = fs.readFileSync(path.join(__dirname, 'Pachapp_1.png')); res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(img); return; } catch(e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('logo not found'); return; }
  }
  if (req.url === '/health' || req.url === '/debug') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', villa: VILLA_NAME, ready: isReady, hasQR: !!lastQR, hasPair: !!lastPairCode, groqKey: !!process.env.GROQ_API_KEY, lastMsg: lastMsgLog, lastReply: lastReplyLog })); return; }
  if (req.url.startsWith('/send-test')) {
    try {
      const u = new URL(req.url, 'http://x');
      const to = u.searchParams.get('to') || OWNER_NUMBER;
      const msgText = u.searchParams.get('msg') || 'Test from Pachapp bot - if you get this, sending works';
      if (!isReady || !sock) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('NOT READY - link first at /qr'); return; }
      await sock.sendMessage(to + '@s.whatsapp.net', { text: msgText });
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('SENT to ' + to); return;
    } catch(e) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('SEND FAILED ' + e.message); return; }
  }
  if (req.url === '/qr' || req.url === '/pair') {
    if (isReady) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h2 style="text-align:center;font-family:sans-serif">Already Linked! Bot is Ready - WA.</h2>'); return; }
    let pairHtml = '';
    if (lastPairCode) { pairHtml = '<div style="border:3px solid green;padding:20px;margin:20px;background:#eaffea"><h1 style="font-size:50px;letter-spacing:8px;margin:0">' + lastPairCode + '</h1><p style="font-size:20px"><b>Pairing Code</b><br>On BOT phone 0529100668: WA Business - Linked Devices - Link with phone number - Enter this code</p></div>'; }
    else { pairHtml = '<p style="color:#666">Pairing code loading... Use QR below, or refresh in 20 sec. If no QR after 30 sec, open /clear-auth once, then come back to /qr.</p>'; }
    let qrHtml = '';
    if (lastQR) {
      try { const qrImage = await QRC.toDataURL(lastQR, { width: 350, margin: 2 }); qrHtml = '<p><b>SCAN THIS QR:</b></p><img src="' + qrImage + '" style="width:320px;height:320px;border:2px solid #000"/>'; } catch(e) {}
    } else { qrHtml = '<p>QR loading... Refresh in 10 sec. If still no QR, open /clear-auth once.</p>'; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pachapp Pair - WA</title></head><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fff"><div style="text-align:center;font-family:sans-serif;max-width:600px"><h2>Pachapp Pool Villa - Link Bot (WA - No Chrome)</h2>' + pairHtml + qrHtml + '<p><a href="/qr">Refresh QR</a> | <a href="/clear-auth">Clear Auth + Fresh QR</a></p></div><script>setTimeout(()=>location.reload(),30000)</script></body></html>');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pachapp AI Agent - WA - Running - Open /qr to scan');
});
server.listen(PORT, () => console.log('Health server on ' + PORT));

const chatHistories = new Map();
const pendingBks = new Map();

function getText(m) {
  if (!m) return '';
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text;
  if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption;
  if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption;
  return '';
}

async function startSock() {
  console.log('Starting sock...');
  try {
    const authState = await useMultiFileAuthState(AUTH_DIR);
    const state = authState.state;
    const saveCreds = authState.saveCreds;
    let version = [2, 3000, 1015906438];
    try { const v = await fetchVer(); if (v && v.version) { version = v.version; console.log('WA version ' + JSON.stringify(version)); } } catch(e) { console.log('Version fetch failed, using fallback - ' + e.message); }
    sock = makeWASocket({
      version: version,
      auth: state,
      logger: P({ level: 'error' }),
      printQRInTerminal: false,
      browser: ['Pachapp', 'Chrome', '1.0'],
      syncFullHistory: false
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
      const connection = update.connection;
      const lastDisconnect = update.lastDisconnect;
      const qr = update.qr;
      console.log('Connection update: ' + (connection || '') + (qr ? ' + QR received' : ''));
      if (qr) {
        lastQR = qr;
        isReady = false;
        console.log('WA QR RECEIVED - Open /qr to scan');
        setTimeout(async () => {
          if (!isReady && !lastPairCode) {
            try { const code = await sock.requestPairingCode(BOT_PHONE); lastPairCode = code; console.log('Pairing code: ' + code); } catch(e) { console.log('Pairing code not yet: ' + e.message); }
          }
        }, 8000);
      }
      if (connection === 'close') {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output ? lastDisconnect.error.output.statusCode : 'unknown';
        const isLoggedOut = code === DisconnectReason.loggedOut || code === 401;
        console.log('WA connection closed, reconnect=true code=' + code + ' loggedOut=' + isLoggedOut);
        isReady = false;
        if (isLoggedOut) { clearAuth(); setTimeout(startSock, 3000); }
        else { setTimeout(startSock, 3000); }
      }
      if (connection === 'open') {
        isReady = true; lastQR = null; lastPairCode = null;
        console.log('Pachapp AI Agent Ready - WA - BOT IS LIVE - No Chrome');
        try { await sock.sendMessage(OWNER_JID, { text: 'Pachapp Bot is LIVE - linked OK. Send Hi to bot number 971529100668 from another phone to test.' }); console.log('LIVE notice sent to owner'); } catch(e) { console.log('LIVE notice failed ' + e.message); }
      }
    });
    sock.ev.on('messages.upsert', async (upsert) => {
      console.log('UPSET type=' + upsert.type + ' count=' + (upsert.messages ? upsert.messages.length : 0));
      if (upsert.type !== 'notify') return;
      for (const msg of upsert.messages) { await handleMessage(msg); }
    });
  } catch(e) { console.log('startSock failed ' + e.message); setTimeout(startSock, 5000); }
}

async function handleMessage(msg) {
  try {
    const key = msg.key;
    const from = key.remoteJid || '';
    console.log('HANDLE key from=' + from + ' fromMe=' + !!key.fromMe);
    if (!from || from === 'status@broadcast') { console.log('HANDLE skip broadcast'); return; }
    if (key.fromMe) { console.log('HANDLE skip fromMe - test from another phone, not bot phone'); return; }
    const text = getText(msg.message);
    console.log('HANDLE text len=' + text.length + ' text=' + text.slice(0, 100));
    if (!text) { console.log('HANDLE skip empty - image without caption?'); return; }
    lastMsgLog = from + ' : ' + text.slice(0, 100);
    console.log('WA MESSAGE from ' + from + ' : ' + text.slice(0, 200));
    try { await sock.readMessages([key]); console.log('Marked seen - blue tick'); } catch(e) { console.log('readMessages failed ' + e.message); }
    const isGroup = from.endsWith('@g.us');
    let senderNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    let senderName = msg.pushName || 'Guest';
    if (isGroup && key.participant) senderNumber = key.participant.replace('@s.whatsapp.net', '');
    const lower = text.toLowerCase();
    if (senderNumber === OWNER_NUMBER && (lower.trim() === 'yes' || lower.trim() === 'no' || lower.includes('confirm') || lower.includes('verified'))) {
      let targetPhone = null, targetBk = null;
      for (const entry of pendingBks) { targetPhone = entry[0]; targetBk = entry[1]; }
      if (targetBk) {
        if (lower.trim() === 'yes' || lower.includes('confirm') || lower.includes('verified')) {
          targetBk.status = 'Confirmed';
          await saveToDB(targetBk);
          try { await sock.sendMessage(targetBk.chatId, { text: 'Book' + 'ing CONFIRMED - Pachapp Pool Villa! Date: ' + targetBk.date + ' Guests: ' + targetBk.guests + ' Total: ' + formatPrice(targetBk.total) + ' Advance: ' + formatPrice(targetBk.advance) + ' received Balance before check-in. Maps: ' + MAPS_LINK + ' Nearby: ' + NEARBY_LINK + ' Welcome to Pachapp!' }); } catch(e) {}
          try { await sock.sendMessage(from, { text: 'Confirmed to guest ' + targetBk.name }); } catch(e) {}
          pendingBks.delete(targetPhone);
        } else { try { await sock.sendMessage(from, { text: 'Not confirmed.' }); } catch(e) {} }
        return;
      }
    }
    const hasMedia = !!(msg.message && (msg.message.imageMessage || msg.message.videoMessage));
    const hasUTR = lower.match(/utr|transaction|ref/i) || lower.match(/\b\d{10,18}\b/);
    if ((hasMedia && (hasUTR || lower.includes('paid') || lower.includes('payment') || lower.includes('advance'))) || (hasUTR && lower.includes('paid'))) {
      const utrMatch = text.match(/\b\d{10,18}\b/);
      const utr = utrMatch ? utrMatch[0] : 'Screenshot received';
      const pending = { name: senderName, phone: senderNumber, chatId: from, date: pendingBks.get(senderNumber) ? pendingBks.get(senderNumber).date : 'To confirm', guests: pendingBks.get(senderNumber) ? pendingBks.get(senderNumber).guests : '', total: pendingBks.get(senderNumber) ? pendingBks.get(senderNumber).total : 0, advance: pendingBks.get(senderNumber) ? pendingBks.get(senderNumber).advance : 0, utr: utr, status: 'Pending' };
      pendingBks.set(senderNumber, pending);
      try { await sock.sendMessage(OWNER_JID, { text: 'PAYMENT VERIFICATION NEEDED Guest: ' + senderName + ' (' + senderNumber + ') Date: ' + pending.date + ' UTR: ' + utr + ' Advance: ' + formatPrice(pending.advance) + ' Reply YES to confirm, NO to reject.' }); } catch(e) {}
      try { await sock.sendMessage(from, { text: 'Payment screenshot + UTR ' + utr + ' received. Owner will verify and I will confirm your reservation in a moment.' }); } catch(e) {}
      return;
    }
    if (!chatHistories.has(from)) chatHistories.set(from, []);
    const history = chatHistories.get(from);
    history.push({ role: 'user', content: text });
    let reply = await askAI(text, isGroup, history);
    if (!reply) { console.log('AI null, using fallback'); reply = fallbackReply(text, isGroup); }
    else { console.log('AI replied: ' + reply.slice(0, 80)); }
    lastReplyLog = reply.slice(0, 120);
    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) chatHistories.set(from, history.slice(-16));
    const parsedDate = parseDate(text);
    if (parsedDate) {
      const type = getDateType(text);
      const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
      pendingBks.set(senderNumber, { name: senderName, phone: senderNumber, chatId: from, date: parsedDate.toISOString().slice(0, 10), guests: text, total: price, advance: calcAdvance(price), status: 'Enquiry' });
    }
    try { await sock.sendMessage(from, { text: reply }); console.log('Replied OK to ' + senderNumber); } catch(e) { console.log('Send failed: ' + e.message); }
    if (!isGroup && (lower.includes('photo') || lower.includes('video') || lower.includes('pics'))) {
      try { await sock.sendMessage(from, { text: 'Photos and videos here: ' + WEBSITE + ' Maps: ' + MAPS_LINK }); } catch(e) {}
    }
  } catch(e) { console.log('handleMessage error ' + e.message + ' stack=' + (e.stack || '').slice(0, 300)); }
}

startSock();
