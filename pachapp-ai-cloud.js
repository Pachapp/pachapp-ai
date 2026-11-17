const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/' + 'baileys');
const P = require('pino');
const QRC = require('qrcode');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const OWNER_JID = '918943666911@s.whatsapp.net';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';

let AUTH_DIR = './baileys_auth2';
if (fs.existsSync('/app/.wwebjs_auth')) AUTH_DIR = '/app/.wwebjs_auth/baileys2';
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
console.log('Baileys auth dir: ' + AUTH_DIR + ' - NO Chrome, NO lock');

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
try { if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) { const AT = require('airtable'); dbBase = new AT({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID); } } catch(e) {}
async function saveToDB(booking) {
  if (!dbBase) return false;
  try {
    const existing = await dbBase('Booking').select({ filterByFormula: `AND({Date}='${booking.date}', {Phone}='${booking.phone}', {Name}='${booking.name}')` }).firstPage();
    if (existing && existing.length > 0) return true;
    await dbBase('Booking').create([{ fields: { Name: booking.name || 'Guest', Phone: booking.phone || '', Date: booking.date || '', Guests: booking.guests || '', Rooms: booking.rooms || 'Full Villa', Total: booking.total || 0, Advance: booking.advance || 0, Status: booking.status || 'Pending', UTR: booking.utr || '', Source: 'WA AI' } }]);
    return true;
  } catch(e) { return false; }
}

let gq = null;
try { const { Groq } = require('groq-sdk'); if (process.env.GROQ_API_KEY) gq = new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch(e) {}

const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. Host is creative person, original compositions, talk literature, cinema, AI, philosophy, history. Inspire about Wayanad. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For GROUP AGENTS: short crispy 1-2 line replies only, close in 3-4 messages, NEVER private reply in group. 5. For DIRECT guests: elaborated humane, photos/videos between answers. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation + QR. No Air-bnb automation. Booking +91 8943666911`;

async function askAI(userMsg, isGroup, history) {
  if (!gq) return null;
  try {
    const modeNote = isGroup ? 'MODE: GROUP AGENT - 1-2 lines only, crispy.' : 'MODE: DIRECT GUEST - Elaborated humane, inspiring.';
    const c = await gq.chat.completions.create({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: SYSTEM_PROMPT + '\n' + modeNote }, ...(history || []).slice(-8), { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: isGroup ? 120 : 600 });
    return c.choices[0]?.message?.content || null;
  } catch(e) { console.log('GQ error ' + e.message); return null; }
}

function fallbackReply(text, isGroup) {
  const lower = text.toLowerCase();
  const hasDate = parseDate(text);
  if (lower.includes('pool') || lower.includes('swim')) {
    if (isGroup) return 'Yes, private pool, 4 rooms, full villa private. Which date? How many guests?';
    return 'Yes! Private pool just for you - no sharing. 🏊\n\nPachapp has beautiful private pool with Wayanad hills view.\n\nWhich date? How many guests? What do you love in Wayanad?';
  }
  if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('charge')) {
    if (!hasDate) {
      if (isGroup) return 'Price depends on date - weekday / weekend / festival different. Which date? How many guests?';
      return 'Price depends on date, so I can give exact price. 😊\n\nFull Private Villa: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 (Breakfast FREE, 8 adults + 8 kids below 6)\nWeekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800\n\nWhich date? How many guests?';
    }
    const type = getDateType(text);
    const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
    if (isGroup) return type + ' - Full Private Villa ' + formatPrice(price) + ', Breakfast FREE, 8+8 included. Confirm?';
    return 'For ' + text + ' - ' + type + ' - Full Private Villa ' + formatPrice(price) + ' ✨\n\nPrivate whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults + 8 kids below 6. Extra adult Rs.800.\n\nAdvance ' + formatPrice(calcAdvance(price)) + ', balance before check-in.\n\nShall I hold this date? How many guests exactly?';
  }
  if (isGroup) return 'Pachapp Pool Villa, Meppadi, Wayanad - Private villa, pool, 4 rooms. Which date? How many guests?';
  return 'Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view.\n\nWhich date? How many guests? What brings you to Wayanad?';
}

let lastQR = null;
let lastPairCode = null;
let isReady = false;
let sock = null;

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', villa: VILLA_NAME, ready: isReady, method: '【entity-Baileys¦canonical_name=Baileys】' })); return; }
  if (req.url === '/qr' || req.url === '/pair') {
    if (isReady) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h2 style="text-align:center;font-family:sans-serif">Already Linked! Bot is Ready - 【entity-Baileys¦canonical_name=Baileys】.</h2>'); return; }
    let pairHtml = '';
    if (lastPairCode) { pairHtml = '<div style="border:3px solid green;padding:20px;margin:20px;background:#eaffea"><h1 style="font-size:50px;letter-spacing:8px;margin:0">' + lastPairCode + '</h1><p style="font-size:20px"><b>Pairing Code</b><br>On BOT phone 0529100668: WA Business - Linked Devices - Link with phone number - Enter this code</p></div>'; }
    else { pairHtml = '<p style="color:#666">Pairing code loading... Use QR below, or refresh in 20 sec.</p>'; }
    let qrHtml = '';
    if (lastQR) {
      try { const qrImage = await QRC.toDataURL(lastQR, { width: 350, margin: 2 }); qrHtml = '<p><b>SCAN THIS QR:</b></p><img src="' + qrImage + '" style="width:320px;height:320px;border:2px solid #000"/>'; } catch(e) {}
    } else { qrHtml = '<p>QR loading... Refresh in 10 sec.</p>'; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pachapp Pair - Baileys</title></head><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fff"><div style="text-align:center;font-family:sans-serif;max-width:600px"><h2>Pachapp Pool Villa - Link Bot (Baileys - No Chrome)</h2>' + pairHtml + qrHtml + '<p><a href="/qr">Refresh QR</a></p></div><script>setTimeout(()=>location.reload(),60000)</script></body></html>');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pachapp AI Agent - Baileys - Running - Open /qr to scan');
});
server.listen(PORT, () => console.log('Health server on ' + PORT));

const chatHistories = new Map();
const pendingBookings = new Map();

function getText(m) {
  if (!m) return '';
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  return '';
}

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'error' }),
    printQRInTerminal: false,
    browser: ['Pachapp', 'Chrome', '1.0'],
    syncFullHistory: false
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      lastQR = qr;
      isReady = false;
      console.log('BAILEYS QR RECEIVED - Open /qr to scan');
      setTimeout(async () => {
        if (!isReady && !lastPairCode) {
          try { const code = await sock.requestPairingCode(BOT_PHONE); lastPairCode = code; console.log('【entity-Baileys¦canonical_name=Baileys】 Pairing code: ' + code); } catch(e) { console.log('Pairing code not yet: ' + e.message); }
        }
      }, 8000);
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('Baileys connection closed, reconnect=' + shouldReconnect + ' reason=' + (lastDisconnect?.error?.output?.statusCode || 'unknown'));
      if (shouldReconnect) {
        isReady = false;
        setTimeout(startSock, 3000);
      } else {
        console.log('Logged out - delete auth folder and relink once');
        isReady = false;
      }
    }
    if (connection === 'open') {
      isReady = true;
      lastQR = null;
      lastPairCode = null;
      console.log('Pachapp AI Agent Ready - BAILEYS - BOT IS LIVE - No Chrome');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleMessage(msg);
    }
  });
}

async function handleMessage(msg) {
  try {
    const key = msg.key;
    const from = key.remoteJid || '';
    if (!from || from === 'status@broadcast') return;
    if (key.fromMe) return;
    const text = getText(msg.message);
    if (!text) return;
    console.log('BAILEYS MESSAGE from ' + from + ' : ' + text.slice(0, 200));
    try { await sock.readMessages([key]); console.log('Marked seen - blue tick'); } catch(e) {}
    const isGroup = from.endsWith('@g.us');
    let senderNumber = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    let senderName = msg.pushName || 'Guest';
    if (isGroup && key.participant) senderNumber = key.participant.replace('@s.whatsapp.net', '');
    const lower = text.toLowerCase();
    if (senderNumber === OWNER_NUMBER && (lower.trim() === 'yes' || lower.trim() === 'no' || lower.includes('confirm') || lower.includes('verified'))) {
      let targetPhone = null, targetBooking = null;
      for (const [phone, b] of pendingBookings) { targetPhone = phone; targetBooking = b; }
      if (targetBooking) {
        if (lower.trim() === 'yes' || lower.includes('confirm') || lower.includes('verified')) {
          targetBooking.status = 'Confirmed';
          await saveToDB(targetBooking);
          try { await sock.sendMessage(targetBooking.chatId, { text: 'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: ' + targetBooking.date + '\nGuests: ' + targetBooking.guests + '\nTotal: ' + formatPrice(targetBooking.total) + '\nAdvance: ' + formatPrice(targetBooking.advance) + ' received\nBalance before check-in.\n\nMaps: ' + MAPS_LINK + '\nNearby: ' + NEARBY_LINK + '\n\nWelcome to Pachapp! 🌿' }); } catch(e) {}
          try { await sock.sendMessage(from, { text: 'Confirmed to guest ' + targetBooking.name }); } catch(e) {}
          pendingBookings.delete(targetPhone);
        } else { try { await sock.sendMessage(from, { text: 'Not confirmed.' }); } catch(e) {} }
        return;
      }
    }
    const hasMedia = !!(msg.message?.imageMessage || msg.message?.videoMessage);
    const hasUTR = lower.match(/utr|transaction|ref/i) || lower.match(/\b\d{10,18}\b/);
    if ((hasMedia && (hasUTR || lower.includes('paid') || lower.includes('payment') || lower.includes('advance'))) || (hasUTR && lower.includes('paid'))) {
      const utrMatch = text.match(/\b\d{10,18}\b/);
      const utr = utrMatch ? utrMatch[0] : 'Screenshot received';
      const pending = { name: senderName, phone: senderNumber, chatId: from, date: pendingBookings.get(senderNumber)?.date || 'To confirm', guests: pendingBookings.get(senderNumber)?.guests || '', total: pendingBookings.get(senderNumber)?.total || 0, advance: pendingBookings.get(senderNumber)?.advance || 0, utr: utr, status: 'Pending' };
      pendingBookings.set(senderNumber, pending);
      try { await sock.sendMessage(OWNER_JID, { text: 'PAYMENT VERIFICATION NEEDED\nGuest: ' + senderName + ' (' + senderNumber + ')\nDate: ' + pending.date + '\nUTR: ' + utr + '\nAdvance: ' + formatPrice(pending.advance) + '\n\nReply YES to confirm, NO to reject.' }); } catch(e) {}
      try { await sock.sendMessage(from, { text: 'Payment screenshot + UTR ' + utr + ' received. ✅\n\nOwner will verify and I will confirm your booking in a moment.' }); } catch(e) {}
      return;
    }
    if (!chatHistories.has(from)) chatHistories.set(from, []);
    const history = chatHistories.get(from);
    history.push({ role: 'user', content: text });
    let reply = await askAI(text, isGroup, history);
    if (!reply) { console.log('AI null, using fallback'); reply = fallbackReply(text, isGroup); }
    else { console.log('AI replied: ' + reply.slice(0, 80)); }
    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) chatHistories.set(from, history.slice(-16));
    const parsedDate = parseDate(text);
    if (parsedDate) {
      const type = getDateType(text);
      const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
      pendingBookings.set(senderNumber, { name: senderName, phone: senderNumber, chatId: from, date: parsedDate.toISOString().slice(0, 10), guests: text, total: price, advance: calcAdvance(price), status: 'Enquiry' });
    }
    try { await sock.sendMessage(from, { text: reply }); console.log('Replied OK to ' + senderNumber); } catch(e) { console.log('Send failed: ' + e.message); }
    if (!isGroup && (lower.includes('photo') || lower.includes('video') || lower.includes('pics'))) {
      try { await sock.sendMessage(from, { text: 'Photos & videos here: ' + WEBSITE + ' 📸\nMaps: ' + MAPS_LINK }); } catch(e) {}
    }
  } catch(e) { console.log('handleMessage error ' + e.message); }
}

startSock();
