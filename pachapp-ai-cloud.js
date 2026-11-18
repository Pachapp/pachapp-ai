// Pachapp Official API - Webhook Mode - No Baileys, No QR - FIXED 18 Nov 2026
// Fixes: Groq model llama-3.1-8b-instant -> llama-3.3-70b-versatile
// Fixes: Token / Phone ID - accepts all common env names, logs what's missing
const http = require('http');
const https = require('https');
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'pachapp123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TEMP_TOKEN || process.env.META_TOKEN || process.env.ACCESS_TOKEN || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || process.env.META_PHONE_NUMBER_ID || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
console.log('Pachapp Official API - Webhook Mode - No Baileys, No QR');
console.log('VERIFY_TOKEN present: ' + (!!VERIFY_TOKEN) + ' value=' + VERIFY_TOKEN);
console.log('WHATSAPP_TOKEN present: ' + (!!WHATSAPP_TOKEN) + ' length=' + WHATSAPP_TOKEN.length);
console.log('PHONE_ID present: ' + (!!PHONE_ID) + ' value=' + (PHONE_ID || 'MISSING - set WHATSAPP_PHONE_NUMBER_ID=1423879287477304'));
console.log('GROQ_API_KEY present: ' + (!!process.env.GROQ_API_KEY));
console.log('GROQ_MODEL: ' + GROQ_MODEL);
if (!WHATSAPP_TOKEN) console.log('ERROR: WhatsApp token missing - copy fresh Temporary Token from 【entity-Meta¦canonical_name=Meta】 Step 1 and set WHATSAPP_TOKEN in Render');
if (!PHONE_ID) console.log('ERROR: Phone ID missing - set WHATSAPP_PHONE_NUMBER_ID=1423879287477304 in Render');
const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600, separate1: 1600, separate2: 3200, separate3: 4800 };
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-10-02','2026-10-20','2026-10-21','2026-04-14','2026-05-01','2026-08-15']);
function isFestival(d) { return FESTIVALS.has(d.toISOString().slice(0,10)); }
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function parseDate(text) {
  if (!text) return null;
  text = text.toLowerCase().trim();
  const months = { jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11 };
  let m;
  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { let y = parseInt(m[3]); if (y < 100) y += 2000; return new Date(y, parseInt(m[2])-1, parseInt(m[1])); }
  m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (m && months[m[2]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[2]], parseInt(m[1])); if (d < now) d = new Date(y+1, months[m[2]], parseInt(m[1])); return d; }
  m = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (m && months[m[1]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[1]], parseInt(m[2])); if (d < now) d = new Date(y+1, months[m[1]], parseInt(m[2])); return d; }
  if (text.includes('tomorrow')) { const d = new Date(); d.setDate(d.getDate()+1); return d; }
  if (text.includes('today')) return new Date();
  return null;
}
function getDateType(text) { const d = parseDate(text); if (!d) return 'weekday'; if (isFestival(d)) return 'festival'; if (isWeekend(d)) return 'weekend'; return 'weekday'; }
function calcAdvance(total) { if (total <= 1600) return 1600; if (total <= 10000) return 2000; return Math.round(total * 0.20); }
function formatPrice(n) { return 'Rs.' + n.toLocaleString('en-IN'); }
let dbBase = null;
try { if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) { const AT = require('airtable'); dbBase = new AT({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID); } } catch(e) { console.log('Airtable init failed ' + e.message); }
let gq = null;
try { const { Groq } = require('groq-sdk'); if (process.env.GROQ_API_KEY) { gq = new Groq({ apiKey: process.env.GROQ_API_KEY }); console.log('Groq connected'); } } catch(e) { console.log('Groq init failed ' + e.message); }
const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation + QR. Booking +91 8943666911`;
function fallbackReply(text) {
  const lower = (text||'').toLowerCase();
  const d = parseDate(text);
  if (d) {
    const type = getDateType(text);
    const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
    return `Pachapp Pool Villa - ${d.toDateString()} - Full Villa Private ${formatPrice(price)} (Weekday 6400 / Weekend 8000 / Festival 9600)\n\nIncludes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800.\n\nHow many guests? Which interest - nature, music, trek, food?\n\nMaps: ${MAPS_LINK}\nNearby: ${NEARBY_LINK}`;
  }
  if (lower.includes('price') || lower.includes('cost') || lower.includes('rate')) return `Which date please? Price depends on date:\nFull Villa - Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600. Includes breakfast for 8 adults.\nSeparate rooms weekday only - 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800.\n\nTell me date + guests, I will give exact price.`;
  if (lower.includes('photo') || lower.includes('video') || lower.includes('pics')) return `Photos & videos here: ${WEBSITE} 📸\nMaps: ${MAPS_LINK}`;
  return `Welcome to Pachapp Pool Villa! 🌿 Wayanad - Lucky Hill, Meppadi.\n\nTell me - which date, how many guests, what is your interest - nature, music, trek?\nI will give exact price + plan.\n\nWebsite: ${WEBSITE}\nMaps: ${MAPS_LINK}`;
}
async function askAI(userMsg, history) {
  if (!gq) return null;
  try {
    const c = await gq.chat.completions.create({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...(history||[]).slice(-8), { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: 600 });
    return c.choices[0]?.message?.content || null;
  } catch(e) { console.log('GQ error ' + e.status + ' ' + JSON.stringify(e.error || e.message)); return null; }
}
const chatHistories = new Map();
function sendWhatsApp(to, text) {
  return new Promise((resolve) => {
    if (!WHATSAPP_TOKEN || !PHONE_ID) { console.log('WhatsApp token / Phone ID missing, cannot send - TOKEN present=' + (!!WHATSAPP_TOKEN) + ' PHONE_ID=' + (PHONE_ID || 'MISSING')); resolve(false); return; }
    const payload = JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } });
    const req = https.request({ hostname: 'graph.facebook.com', path: '/v21.0/' + PHONE_ID + '/messages', method: 'POST', headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { console.log('WhatsApp send status ' + res.statusCode + ' ' + data.slice(0,200)); resolve(res.statusCode < 300); });
    });
    req.on('error', (e) => { console.log('WhatsApp send error ' + e.message); resolve(false); });
    req.write(payload); req.end();
  });
}
async function handleIncoming(from, text, name) {
  console.log('MESSAGE from ' + from + ' : ' + text);
  if (!chatHistories.has(from)) chatHistories.set(from, []);
  const history = chatHistories.get(from);
  history.push({ role: 'user', content: text });
  let reply = await askAI(text, history);
  if (!reply) { console.log('AI null, using fallback'); reply = fallbackReply(text); }
  else { console.log('AI replied: ' + reply.slice(0,120)); }
  history.push({ role: 'assistant', content: reply });
  if (history.length > 16) chatHistories.set(from, history.slice(-16));
  const ok = await sendWhatsApp(from, reply);
  console.log(ok ? 'Replied OK to ' + from : 'Replied FAILED to ' + from + ' - check WHATSAPP_TOKEN / PHONE_ID in Render');
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/webhook' && req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) { console.log('Webhook VERIFIED'); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(challenge); return; }
    else { console.log('Webhook verify FAILED - got token=' + token + ' expected=' + VERIFY_TOKEN); res.writeHead(403); res.end('Forbidden'); return; }
  }
  if (url.pathname === '/webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', async () => {
      res.writeHead(200); res.end('EVENT_RECEIVED');
      try {
        const data = JSON.parse(body);
        const entry = data.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const msg = value?.messages?.[0];
        if (!msg || msg.type !== 'text') { console.log('Webhook event no text message - type=' + (change?.field || 'unknown')); return; }
        const from = msg.from;
        const text = msg.text?.body || '';
        const name = value?.contacts?.[0]?.profile?.name || 'Guest';
        await handleIncoming(from, text, name);
      } catch(e) { console.log('Webhook parse error ' + e.message); }
    });
    return;
  }
  if (url.pathname === '/qr' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h2>Pachapp AI - Official API - Webhook Mode - LIVE</h2><p>Webhook: /webhook<br>Token present: ' + (!!WHATSAPP_TOKEN) + '<br>Phone ID: ' + (PHONE_ID || 'MISSING') + '<br>Groq model: ' + GROQ_MODEL + '</p>'); return;
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(PORT, () => console.log('Pachapp Official API server on ' + PORT + ' - Webhook ready'));
