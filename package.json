const http = require('http');
const fs = require('fs');
const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'pachapp_verify';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
let gq = null;
try { const { Groq } = require('groq-sdk'); if (process.env.GROQ_API_KEY) gq = new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch (e) {}
const SYSTEM_PROMPT = 'You are Pachapp Pool Villa AI Host. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green. PRICING Full Villa Private: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Weekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800. Breakfast Rs.100 per head for Rooms. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000, Total over Rs.10000 20 percent. Reply in guest language. Never give price without date. Answer real answer first, then ask date and guests.';
function formatPrice(n) { return 'Rs.' + Number(n).toLocaleString('en-IN'); }
function calcAdvance(total) { if (total <= 1600) return 1600; if (total <= 10000) return 2000; return Math.round(total * 0.20); }
function parseDate(text) {
  if (!text) return null;
  text = text.toLowerCase().trim();
  const months = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  let m;
  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if (m && months[m[2]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[2]], parseInt(m[1])); if (d < now) d = new Date(y + 1, months[m[2]], parseInt(m[1])); return d; }
  m = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (m && months[m[1]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[1]], parseInt(m[2])); if (d < now) d = new Date(y + 1, months[m[1]], parseInt(m[2])); return d; }
  if (text.includes('tomorrow')) { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
  if (text.includes('today')) return new Date();
  return null;
}
function getDateType(text) {
  const d = parseDate(text);
  if (!d) return 'weekday';
  const day = d.getDay();
  if (day === 0 || day === 6 || day === 5) return 'weekend';
  return 'weekday';
}
async function askAI(userMsg, history) {
  if (!gq) return null;
  try {
    const c = await gq.chat.completions.create({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: 600 });
    return c.choices[0].message.content || null;
  } catch (e) { console.log('GQ error ' + e.message); return null; }
}
function fallbackReply(text) {
  const lower = text.toLowerCase();
  const hasDate = parseDate(text);
  if (lower.includes('price') || lower.includes('rate') || lower.includes('cost')) {
    if (!hasDate) return 'Price depends on date. Full Villa Weekday Rs.6400, Weekend Rs.8000. Which date? How many guests?';
    const type = getDateType(text);
    const price = type === 'weekday' ? 6400 : 8000;
    return 'For ' + text + ' - ' + type + ' - Full Villa ' + formatPrice(price) + '. Advance ' + formatPrice(calcAdvance(price)) + '. Shall I hold this date? How many guests?';
  }
  return 'Welcome to Pachapp Pool Villa! Lucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms. Which date? How many guests?';
}
const chatHistories = new Map();
const pendingBookings = new Map();
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log('No WhatsApp token'); return false; }
  try {
    const res = await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } }) });
    const data = await res.text();
    console.log('Send to ' + to + ' ' + res.status + ' ' + data.slice(0, 200));
    return res.ok;
  } catch (e) { console.log('Send failed ' + e.message); return false; }
}
async function handleMessage(senderNumber, senderName, text, msg) {
  if (!senderNumber || !text) return;
  const isGroup = !!(msg && msg.context && msg.context.group_id);
  if (isGroup) { console.log('Group ignored'); return; }
  const lower = text.toLowerCase();
  console.log('CLOUD MESSAGE from ' + senderNumber + ' ' + text.slice(0, 200));
  if (senderNumber === OWNER_NUMBER && (lower.trim() === 'yes' || lower.trim() === 'no')) {
    let targetPhone = null;
    let targetBooking = null;
    for (const pair of pendingBookings) { targetPhone = pair[0]; targetBooking = pair[1]; }
    if (targetBooking) {
      if (lower.trim() === 'yes') {
        await sendWhatsApp(targetBooking.phone, 'Booking CONFIRMED - Pachapp Pool Villa! Date: ' + targetBooking.date + ' Total: ' + formatPrice(targetBooking.total) + ' Advance received. Maps: ' + MAPS_LINK);
        await sendWhatsApp(senderNumber, 'Confirmed to guest ' + targetBooking.name);
        pendingBookings.delete(targetPhone);
      } else { await sendWhatsApp(senderNumber, 'Not confirmed.'); }
      return;
    }
  }
  if (!chatHistories.has(senderNumber)) chatHistories.set(senderNumber, []);
  const history = chatHistories.get(senderNumber);
  history.push({ role: 'user', content: text });
  let reply = await askAI(text, history);
  if (!reply) reply = fallbackReply(text);
  history.push({ role: 'assistant', content: reply });
  const parsedDate = parseDate(text);
  if (parsedDate) {
    const type = getDateType(text);
    const price = type === 'weekday' ? 6400 : 8000;
    pendingBookings.set(senderNumber, { name: senderName, phone: senderNumber, date: parsedDate.toISOString().slice(0, 10), guests: text, total: price, advance: calcAdvance(price) });
  }
  await sendWhatsApp(senderNumber, reply);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', method: 'Cloud API', has_token: !!WHATSAPP_TOKEN, has_phone_id: !!PHONE_NUMBER_ID })); return; }
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === VERIFY_TOKEN) { res.writeHead(200); res.end(challenge); return; }
      res.writeHead(403); res.end('Verify failed'); return;
    }
    if (req.method === 'POST' && url.pathname === '/webhook') {
      let body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('end', async function () {
        try {
          const data = JSON.parse(body || '{}');
          for (const entry of (data.entry || [])) {
            for (const change of (entry.changes || [])) {
              const value = change.value || {};
              const contacts = value.contacts || [];
              for (const m of (value.messages || [])) {
                const senderNumber = m.from || '';
                let senderName = 'Guest';
                for (const c of contacts) { if (c.wa_id === senderNumber && c.profile && c.profile.name) senderName = c.profile.name; }
                let text = '';
                if (m.type === 'text' && m.text) text = m.text.body || '';
                if (m.type === 'image' && m.image && m.image.caption) text = m.image.caption || '';
                if (text) await handleMessage(senderNumber, senderName, text, m);
              }
            }
          }
        } catch (e) { console.log('Webhook error ' + e.message); }
        res.writeHead(200); res.end('EVENT_RECEIVED');
      });
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/booking-form.html' || url.pathname === '/')) {
      try { const html = fs.readFileSync('./booking-form.html', 'utf8'); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } catch (e) { res.writeHead(200); res.end('Pachapp Cloud API Running'); return; }
    }
    res.writeHead(200); res.end('Pachapp Cloud API Running');
  } catch (e) { res.writeHead(500); res.end('Error'); }
});
server.listen(PORT, function () { console.log('Health server on ' + PORT + ' Cloud API'); });
