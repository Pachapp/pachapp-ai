const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'pachapp_verify';

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
async function saveToDB(【entity-booking¦canonical_name=Booking】) {
  if (!dbBase) return false;
  try {
    const existing = await dbBase('【entity-Booking¦canonical_name=Booking】').select({ filterByFormula: `AND({Date}='${booking.date}', {Phone}='${booking.phone}', {Name}='${booking.name}')` }).firstPage();
    if (existing && existing.length > 0) return true;
    await dbBase('【entity-Booking¦canonical_name=Booking】').create([{ fields: { Name: 【entity-booking¦canonical_name=Booking】.name || 'Guest', Phone: 【entity-booking¦canonical_name=Booking】.phone || '', Date: 【entity-booking¦canonical_name=Booking】.date || '', Guests: 【entity-booking¦canonical_name=Booking】.guests || '', Rooms: 【entity-booking¦canonical_name=Booking】.rooms || 'Full Villa', Total: 【entity-booking¦canonical_name=Booking】.total || 0, Advance: 【entity-booking¦canonical_name=Booking】.advance || 0, Status: 【entity-booking¦canonical_name=Booking】.status || 'Pending', UTR: 【entity-booking¦canonical_name=Booking】.utr || '', Source: 'WA AI' } }]);
    return true;
  } catch(e) { return false; }
}

let gq = null;
try { const { Groq } = require('groq-sdk'); if (process.env.GROQ_API_KEY) gq = new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch(e) {}

const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. Host is creative person, original compositions, talk literature, cinema, AI, philosophy, history. Inspire about Wayanad. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For DIRECT guests: elaborated humane, photos/videos between answers. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation. No Air-bnb automation. Booking +91 8943666911`;

async function askAI(userMsg, history) {
  if (!gq) return null;
  try {
    const c = await gq.chat.completions.create({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: SYSTEM_PROMPT + '\nMODE: DIRECT GUEST - Elaborated humane, inspiring.' }, ...(history || []).slice(-8), { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: 600 });
    return c.choices[0]?.message?.content || null;
  } catch(e) { console.log('GQ error ' + e.message); return null; }
}

function fallbackReply(text) {
  const lower = text.toLowerCase();
  const hasDate = parseDate(text);
  if (lower.includes('pool') || lower.includes('swim')) {
    return 'Yes! Private pool just for you - no sharing. 🏊\n\nPachapp has beautiful private pool with Wayanad hills view.\n\nWhich date? How many guests? What do you love in Wayanad?';
  }
  if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('charge')) {
    if (!hasDate) {
      return 'Price depends on date, so I can give exact price. 😊\n\nFull Private Villa: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 (Breakfast FREE, 8 adults + 8 kids below 6)\nWeekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800\n\nWhich date? How many guests?';
    }
    const type = getDateType(text);
    const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
    return 'For ' + text + ' - ' + type + ' - Full Private Villa ' + formatPrice(price) + ' ✨\n\nPrivate whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults + 8 kids below 6. Extra adult Rs.800.\n\nAdvance ' + formatPrice(calcAdvance(price)) + ', balance before check-in.\n\nShall I hold this date? How many guests exactly?';
  }
  return 'Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view.\n\nWhich date? How many guests? What brings you to Wayanad?';
}

const chatHistories = new Map();
const pendingBookings = new Map();

async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log('No WhatsApp token or phone id, cannot send'); return false; }
  try {
    const res = await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } })
    });
    const data = await res.text();
    console.log('Send to ' + to + ' status ' + res.status + ' ' + data.slice(0, 200));
    return res.ok;
  } catch(e) { console.log('Send failed: ' + e.message); return false; }
}

async function handleMessage(senderNumber, senderName, text, msg) {
  try {
    if (!senderNumber || !text) return;
    const isGroup = !!(msg && msg.context && msg.context.group_id) || text.includes('@g.us');
    if (isGroup) { console.log('Group message ignored, silent'); return; }
    const lower = text.toLowerCase();
    console.log('CLOUD MESSAGE from ' + senderNumber + ' : ' + text.slice(0, 200));
    if (senderNumber === OWNER_NUMBER && (lower.trim() === 'yes' || lower.trim() === 'no' || lower.includes('confirm') || lower.includes('verified'))) {
      let targetPhone = null, targetBooking = null;
      for (const [phone, b] of pendingBookings) { targetPhone = phone; targetBooking = b; }
      if (targetBooking) {
        if (lower.trim() === 'yes' || lower.includes('confirm') || lower.includes('verified')) {
          targetBooking.status = 'Confirmed';
          await saveToDB(targetBooking);
          await sendWhatsApp(targetBooking.phone, 'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: ' + targetBooking.date + '\nGuests: ' + targetBooking.guests + '\nTotal: ' + formatPrice(targetBooking.total) + '\nAdvance: ' + formatPrice(targetBooking.advance) + ' received\nBalance before check-in.\n\nMaps: ' + MAPS_LINK + '\nNearby: ' + NEARBY_LINK + '\n\nWelcome to Pachapp! 🌿');
          await sendWhatsApp(senderNumber, 'Confirmed to guest ' + targetBooking.name);
          pendingBookings.delete(targetPhone);
        } else { await sendWhatsApp(senderNumber, 'Not confirmed.'); }
        return;
      }
    }
    const hasUTR = lower.match(/utr|transaction|ref/i) || lower.match(/\b\d{10,18}\b/);
    if (hasUTR && lower.includes('paid')) {
      const utrMatch = text.match(/\b\d{10,18}\b/);
      const utr = utrMatch ? utrMatch[0] : 'Screenshot received';
      const pending = { name: senderName, phone: senderNumber, date: pendingBookings.get(senderNumber)?.date || 'To confirm', guests: pendingBookings.get(senderNumber)?.guests || '', total: pendingBookings.get(senderNumber)?.total || 0, advance: pendingBookings.get(senderNumber)?.advance || 0, utr: utr, status: 'Pending' };
      pendingBookings.set(senderNumber, pending);
      await sendWhatsApp(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: ' + senderName + ' (' + senderNumber + ')\nDate: ' + pending.date + '\nUTR: ' + utr + '\nAdvance: ' + formatPrice(pending.advance) + '\n\nReply YES to confirm, NO to reject.');
      await sendWhatsApp(senderNumber, 'Payment screenshot + UTR ' + utr + ' received. ✅\n\nOwner will verify and I will confirm your booking in a moment.');
      return;
    }
    if (!chatHistories.has(senderNumber)) chatHistories.set(senderNumber, []);
    const history = chatHistories.get(senderNumber);
    history.push({ role: 'user', content: text });
    let reply = await askAI(text, history);
    if (!reply) { console.log('AI null, using fallback'); reply = fallbackReply(text); }
    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) chatHistories.set(senderNumber, history.slice(-16));
    const parsedDate = parseDate(text);
    if (parsedDate) {
      const type = getDateType(text);
      const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival;
      pendingBookings.set(senderNumber, { name: senderName, phone: senderNumber, date: parsedDate.toISOString().slice(0, 10), guests: text, total: price, advance: calcAdvance(price), status: 'Enquiry' });
    }
    await sendWhatsApp(senderNumber, reply);
    if (lower.includes('photo') || lower.includes('video') || lower.includes('pics')) {
      await sendWhatsApp(senderNumber, 'Photos & videos here: ' + WEBSITE + ' 📸\nMaps: ' + MAPS_LINK);
    }
  } catch(e) { console.log('handleMessage error ' + e.message); }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', villa: VILLA_NAME, method: 'Cloud API', has_token: !!WHATSAPP_TOKEN, has_phone_id: !!PHONE_NUMBER_ID }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === VERIFY_TOKEN) { res.writeHead(200); res.end(challenge); return; }
      res.writeHead(403); res.end('Verify failed'); return;
    }
    if (req.method === 'POST' && url.pathname === '/webhook') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          for (const entry of (data.entry || [])) {
            for (const change of (entry.changes || [])) {
              const value = change.value || {};
              const contacts = value.contacts || [];
              for (const m of (value.messages || [])) {
                const senderNumber = m.from || '';
                const contact = contacts.find(c => c.wa_id === senderNumber);
                const senderName = (contact && contact.profile && contact.profile.name) || 'Guest';
                let text = '';
                if (m.type === 'text' && m.text) text = m.text.body || '';
                if (m.type === 'image' && m.image && m.image.caption) text = m.image.caption || '';
                if (m.type === 'video' && m.video && m.video.caption) text = m.video.caption || '';
                if (text) await handleMessage(senderNumber, senderName, text, m);
              }
            }
          }
        } catch(e) { console.log('Webhook parse error ' + e.message); }
        res.writeHead(200); res.end('EVENT_RECEIVED');
      });
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/booking-form.html' || url.pathname === '/')) {
      try {
        const html = fs.readFileSync('./booking-form.html', 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
      } catch(e) {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Pachapp AI Agent - Cloud API - Running');
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Pachapp AI Agent - Cloud API - Running');
  } catch(e) { res.writeHead(500); res.end('Error'); }
});
server.listen(PORT, () => console.log('Health server on ' + PORT + ' Cloud API'));
