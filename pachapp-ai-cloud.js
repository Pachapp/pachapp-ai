const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';

console.log('Pachapp Official API - Webhook Mode - No Baileys, No QR');

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
try { if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) { const AT = require('airtable'); dbBase = new AT({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID); console.log('Airtable connected'); } } catch(e) { console.log('Airtable not set: ' + e.message); }
async function saveToDB(booking) {
  if (!dbBase) return false;
  try {
    const existing = await dbBase('Booking').select({ filterByFormula: `AND({Date}='${booking.date}', {Phone}='${booking.phone}', {Name}='${booking.name}')` }).firstPage();
    if (existing && existing.length > 0) return true;
    await dbBase('Booking').create([{ fields: { Name: booking.name || 'Guest', Phone: booking.phone || '', Date: booking.date || '', Guests: booking.guests || '', Rooms: booking.rooms || 'Full Villa', Total: booking.total || 0, Advance: booking.advance || 0, Status: booking.status || 'Pending', UTR: booking.utr || '', Source: 'WA AI Official' } }]);
    console.log('Saved to Airtable: ' + booking.name + ' ' + booking.date);
    return true;
  } catch(e) { console.log('Airtable save fail: ' + e.message); return false; }
}

let gq = null;
try { const { Groq } = require('groq-sdk'); if (process.env.GROQ_API_KEY) { gq = new Groq({ apiKey: process.env.GROQ_API_KEY }); console.log('Groq connected'); } } catch(e) { console.log('Groq not set: ' + e.message); }

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

async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log('WhatsApp token / Phone ID missing, cannot send'); return false; }
  try {
    const res = await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } })
    });
    const data = await res.json();
    console.log('Sent to ' + to + ' : ' + JSON.stringify(data).slice(0, 200));
    return true;
  } catch(e) { console.log('Send fail: ' + e.message); return false; }
}

const chatHistories = new Map();
const pendingBookings = new Map();

async function handleIncoming(from, text, senderName) {
  try {
    console.log('MESSAGE from ' + from + ' : ' + text.slice(0, 200));
    const lower = text.toLowerCase();
    const isGroup = false;
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
      const booking = { name: senderName || 'Guest', phone: from, chatId: from, date: parsedDate.toISOString().slice(0, 10), guests: text, total: price, advance: calcAdvance(price), status: 'Enquiry' };
      pendingBookings.set(from, booking);
      await saveToDB(booking);
    }
    await sendWhatsApp(from, reply);
    console.log('Replied OK to ' + from);
  } catch(e) { console.log('handleIncoming error ' + e.message); }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', villa: VILLA_NAME, method: 'Official WhatsApp Cloud API', phone_id_set: !!PHONE_NUMBER_ID, token_set: !!WHATSAPP_TOKEN }));
    return;
  }
  if (req.url.startsWith('/webhook')) {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook VERIFIED');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(403); res.end('Forbidden');
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const entry = data.entry?.[0];
          const change = entry?.changes?.[0];
          const value = change?.value;
          const messages = value?.messages || [];
          for (const m of messages) {
            const from = m.from;
            const text = m.text?.body || '';
            const senderName = value?.contacts?.[0]?.profile?.name || 'Guest';
            if (text && from) { handleIncoming(from, text, senderName); }
          }
        } catch(e) { console.log('Webhook parse error ' + e.message); }
        res.writeHead(200); res.end('EVENT_RECEIVED');
      });
      return;
    }
  }
  res.writeHead(404); res.end('Not found');
});
server.listen(PORT, () => console.log('Pachapp Official API server on ' + PORT + ' - Webhook ready'));
