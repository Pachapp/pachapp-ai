const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.PORT || 10000;
const WA_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '606463179209554';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
const G_KEY = process.env.GROQ_API_KEY || '';
const AT_KEY = process.env.AIRTABLE_API_KEY || '';
const AT_BASE = process.env.AIRTABLE_BASE_ID || '';
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const WEBSITE = 'https://www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
const DRIVE = 'https://drive.google.com/drive/folders/';
const PHOTOS_LINK = DRIVE + '113zNhiOsHIvSWM6Uvt04GQojISQKO1TI';
const POOL_PHOTOS_LINK = DRIVE + '1RUsjNpD0IlyPRAhcKBtXHWVTMU_LcFYh';
const ROOM_PHOTOS_LINK = DRIVE + '10tN84VxjXvNYiuzOx5sT2XHl46su3mgO';
const OUTDOOR_PHOTOS_LINK = DRIVE + '1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const ACTIVITIES_PHOTOS_LINK = DRIVE + '1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const QR_CODE_LINK = DRIVE + '1P2pAgfc36HWsRNKAdswEVW7k8D1cxvCz';
const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600, separate1: 1600, separate2: 3200, separate3: 4800 };
function pickArr(a) { return a[Math.floor(Math.random() * a.length)]; }
const GREETINGS = [
  'Hi, I am Pachapp - how can I help you on this beautiful day?',
  'Hi sir, we are waiting to serve you at Pachapp. What are you planning?',
  'Hello, friends at your service - this is Pachapp Pool Villa, Meppadi. How can I help?',
  'Hey, welcome to Pachapp! Beautiful day in Wayanad. Tell me, when are you planning to come?',
  'Hi there! Pachapp here, at your service. What can I do for you today?',
  'Good day! This is Pachapp Pool Villa, Lucky Hill. We are ready to serve you - which date are you looking at?',
  'Hello! Pachapp family here - happy to help. What are you dreaming of - pool, rooms, music?',
  'Hi, welcome to Pachapp! We are waiting to serve you. How many guests, and which date?'
];
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-10-02','2026-10-20','2026-10-21','2026-04-14','2026-05-01','2026-08-15']);
function isFestival(d) { return FESTIVALS.has(d.toISOString().slice(0, 10)); }
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function parseDate(text) {
  if (!text) return null; text = text.toLowerCase().trim();
  const months = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  let m;
  m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (m) { let y = parseInt(m[3]); if (y < 100) y += 2000; return new Date(y, parseInt(m[2]) - 1, parseInt(m[1])); }
  m = text.match(/(\d{1,2})[\/\-](\d{1,2})\b/); if (m) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, parseInt(m[2]) - 1, parseInt(m[1])); if (d < now) d = new Date(y + 1, parseInt(m[2]) - 1, parseInt(m[1])); return d; }
  m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/); if (m && months[m[2]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[2]], parseInt(m[1])); if (d < now) d = new Date(y + 1, months[m[2]], parseInt(m[1])); return d; }
  m = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/); if (m && months[m[1]] !== undefined) { const now = new Date(); let y = now.getFullYear(); let d = new Date(y, months[m[1]], parseInt(m[2])); if (d < now) d = new Date(y + 1, months[m[1]], parseInt(m[2])); return d; }
  if (text.includes('tomorrow')) { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
  if (text.includes('today')) return new Date();
  return null;
}
function getDateType(text) { const d = parseDate(text); if (!d) return 'weekday'; if (isFestival(d)) return 'festival'; if (isWeekend(d)) return 'weekend'; return 'weekday'; }
function calcAdvance(total) { if (total <= 1600) return 1600; if (total <= 10000) return 2000; return Math.round(total * 0.20); }
function formatPrice(n) { return 'Rs.' + n.toLocaleString('en-IN'); }
function wantsPhotos(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('photo') || l.includes('pics') || l.includes('picture') || l.includes('image') || l.includes('phot')) return true;
  if (/ro+m/.test(l) && l.includes('show')) return true;
  if (l.includes('show') && (l.includes('pool') || l.includes('outdoor') || l.includes('villa'))) return true;
  if (l.includes('send') && (l.includes('pool') || l.includes('outdoor') || l.includes('photo') || /ro+m/.test(l))) return true;
  return false;
}
function wantsQRForPayment(text) {
  const l = (text || '').toLowerCase();
  if (!l.includes('qr')) return false;
  return l.includes('payment') || l.includes('pay') || l.includes('advance') || l.includes('upi') || l.includes('booking') || l.includes('send qr') || l.includes('give qr');
}
let dbBase = null;
try { if (AT_KEY && AT_BASE) { const AT = require('airtable'); dbBase = new AT({ apiKey: AT_KEY }).base(AT_BASE); } } catch (e) {}
async function saveToDB(b) {
  if (!dbBase) return false;
  try {
    const ex = await dbBase('Booking').select({ filterByFormula: "AND({Date}='" + b.date + "', {Phone}='" + b.phone + "', {Name}='" + b.name + "')" }).firstPage();
    if (ex && ex.length > 0) return true;
    await dbBase('Booking').create([{ fields: { Name: b.name || 'Guest', Phone: b.phone || '', Date: b.date || '', Guests: b.guests || '', Rooms: b.rooms || 'Full Villa', Total: b.total || 0, Advance: b.advance || 0, Status: b.status || 'Pending', UTR: b.utr || '', Source: 'WA AI' } }]);
    return true;
  } catch (e) { return false; }
}
let gq = null;
try { const { Groq } = require('groq-sdk'); if (G_KEY) gq = new Groq({ apiKey: G_KEY }); } catch (e) {}
const SYS = "You are Pachapp Pool Villa AI Host - humane, warm, creative, professional, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. Host is creative person, original compositions, talk literature, cinema, AI, philosophy, history. Inspire about Wayanad. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest. 2. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For DIRECT guests: elaborated humane, photos/videos between answers. 5. Vary wording, sound like a real host, not a template. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation + QR. No Air-bnb automation. Booking +91 8943666911. PHOTOS: Only when guest explicitly asks for specific subject. QR: Only when deal nearing close and guest asks QR for payment.";
async function askAI(userMsg, history) {
  if (!gq) return null;
  const MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'];
  for (const model of MODELS) {
    try {
      const c = await gq.chat.completions.create({ model, messages: [{ role: 'system', content: SYS }, ...(history || []).slice(-10), { role: 'user', content: userMsg }], temperature: 0.75, max_tokens: 700 });
      const out = c.choices[0]?.message?.content || null;
      if (out) return out;
    } catch (e) { console.log('AI model ' + model + ' failed: ' + e.message); continue; }
  }
  console.log('All AI models failed, using logical fallback');
  return null;
}
function logicalFallback(text) {
  const lower = text.toLowerCase();
  const hasDate = parseDate(text);
  const roomsRe = /ro+m/;
  const answers = [];
  if ((lower.includes('are you') || lower.includes('are u') || lower.includes('who are')) && (lower.includes('ai') || lower.includes('robot') || lower.includes('human') || lower.includes('bot') || lower.includes('real'))) answers.push('Yes, I am the AI helper for Pachapp - I reply fast here, and Uday himself checks and confirms your booking. Ask me anything, I will answer simply.');
  if (lower.includes('understand') || lower.includes('confusing') || lower.includes('not getting') || lower.includes('way you talking') || lower.includes('dont get')) answers.push('Sorry, my fault. Let me say it very simply. This is Pachapp Pool Villa, a private villa with pool in Meppadi, Wayanad. Tell me which language you like - English, Malayalam, Hindi? I will speak in that language, slowly and clearly.');
  if (lower.includes('where') || lower.includes('locat') || lower.includes('address') || lower.includes('location')) answers.push('This is Pachapp Pool Villa, at Lucky Hill, Meppadi, Wayanad, Kerala. Maps here: ' + MAPS_LINK + ' Nearby: ' + NEARBY_LINK);
  if ((lower.includes('is it') || lower.includes('is this')) && lower.includes('pach')) answers.push('Yes, this is Pachapp Pool Villa itself. You are talking to the right place.');
  if ((lower.includes('few') && lower.includes('question')) || lower.includes('let me ask') || lower.includes('can i ask') || lower.includes('i have question')) answers.push('Yes, please ask. Ask me anything - price, date, pool, rooms, location, music. I am here.');
  if (((lower.includes('how many') || lower.includes('total') || lower.includes('no of') || lower.includes('number of') || lower.includes('many')) && roomsRe.test(lower)) || lower.includes('rooms you have') || lower.includes('rooms are there') || lower.includes('rooms do you')) answers.push('We have 4 rooms in Full Villa - all private, breakfast FREE with Full Villa, pool private. Full Villa fits 8 adults + 8 kids below 6. Separate weekday: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800. Tell me how many rooms you need?');
  if ((lower.includes('how many') || lower.includes('max') || lower.includes('capacity')) && (lower.includes('people') || lower.includes('person') || lower.includes('guest') || lower.includes('adult') || lower.includes('stay') || lower.includes('accommodat') || lower.includes('fit'))) answers.push('Full Villa fits 8 adults + 8 kids below 6. 4 rooms, breakfast FREE. Extra adult Rs.800.');
  if (lower.includes('pool')) answers.push('Yes! Private pool just for you - no sharing. Pool is private, included - all yours. Evening swim under stars at Lucky Hill. Which date? How many guests?');
  if (lower.includes('barbecue') || lower.includes('barbeque') || lower.includes('bbq') || lower.includes('barbe')) answers.push('Barbecue - yes, we can arrange. Tell me veg or non-veg, owner will confirm charge.');
  if (lower.includes('musical') || lower.includes('music') || lower.includes('song')) answers.push('Music - special here. Uday Hue composes his own songs - if he is at the villa that day, you might hear them live. What style do you love?');
  if (lower.includes('breakfast') || lower.includes('food') || lower.includes('meal') || lower.includes('dinner') || lower.includes('lunch')) answers.push('Breakfast is FREE with Full Villa. For separate rooms, breakfast NOT FREE - Rs.100 per head. Tell me with / without breakfast, owner will confirm.');
  if (lower.includes('check')) answers.push('Check-in / check-out timing - tell me your date, owner will confirm exact timing for you, it is flexible.');
  if (lower.includes('how far') || lower.includes('distance') || lower.includes('airport') || lower.includes('railway') || lower.includes('calicut') || lower.includes('kozhikode') || lower.includes('kalpetta')) answers.push('We are at Meppadi, Wayanad - near Kalpetta. Best is to open Maps: ' + MAPS_LINK + ' Tell me from where you are coming, I will tell you the route.');
  if (lower.includes('uday') || lower.includes('owner')) answers.push('Uday Hue is the owner - musician, composer, poet, singer. If he is at the villa, good chance to hear his own original compositions live.');
  if (lower.includes('parking')) answers.push('Parking - tell me your date, I will check with owner and confirm for you.');
  if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet')) answers.push('WiFi - tell me your date, I will check with owner and confirm for you.');
  if (lower.includes('pet') || lower.includes('dog')) answers.push('For pet, tell me your date and pet details, owner will confirm - we will try to help.');
  if (lower.includes('advance')) answers.push('Advance: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in. Owner will confirm exact advance after you confirm date + guests.');
  if (lower.includes('festival')) answers.push('Festival days Full Villa is Rs.9600. If your date is a festival / holiday, owner will confirm if festival price applies to your date.');
  if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('charge')) {
    if (!hasDate) answers.push('Price depends on date. Full Private Villa: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 (Breakfast FREE, 8 adults + 8 kids below 6, Extra adult Rs.800)\nWeekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800 (Breakfast Rs.100 per head, ask with/without)\nWhich date? How many guests?');
    else { const type = getDateType(text); const price = type === 'weekday' ? PRICING.fullWeekday : type === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival; answers.push('For ' + text + ' - ' + type + ' - Full Private Villa ' + formatPrice(price) + '\n\nPrivate whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults + 8 kids below 6. Extra adult Rs.800.\n\nAdvance ' + formatPrice(calcAdvance(price)) + ', balance before check-in.\n\nShall I hold this date? How many guests exactly?'); }
  }
  if (lower.includes('1 room') || lower.includes('one room') || lower.includes('single room')) answers.push('Separate 1 Room weekday is Rs.1600 - tell me date, I will give exact price. Each room 2 adults + 2 kids below 6. Breakfast Rs.100 per head - with / without?');
  if (lower.includes('2 room') || lower.includes('two room')) answers.push('Separate 2 Rooms weekday is Rs.3200 - tell me date, I will give exact price. Each room 2 adults + 2 kids below 6. Breakfast Rs.100 per head - with / without?');
  if (lower.includes('3 room') || lower.includes('three room')) answers.push('Separate 3 Rooms weekday is Rs.4800 - tell me date, I will give exact price. Each room 2 adults + 2 kids below 6. Breakfast Rs.100 per head - with / without?');
  if (wantsPhotos(text)) {
    if (lower.includes('pool')) answers.push('Pool photos - Drive: ' + POOL_PHOTOS_LINK + '\nAll Photos: ' + PHOTOS_LINK + '\nMaps: ' + MAPS_LINK);
    else if (roomsRe.test(lower)) answers.push('Room photos - Drive: ' + ROOM_PHOTOS_LINK + '\nAll Photos: ' + PHOTOS_LINK + '\nMaps: ' + MAPS_LINK);
    else if (lower.includes('activit')) answers.push('Activities photos - Drive: ' + ACTIVITIES_PHOTOS_LINK + ' (in OUTDOOR folder)\nAll Photos: ' + PHOTOS_LINK + '\nMaps: ' + MAPS_LINK);
    else if (lower.includes('outdoor')) answers.push('Outdoor photos - Drive: ' + OUTDOOR_PHOTOS_LINK + '\nAll Photos: ' + PHOTOS_LINK + '\nMaps: ' + MAPS_LINK);
    else answers.push('Photos - Drive: ' + PHOTOS_LINK + '\nPool: ' + POOL_PHOTOS_LINK + '\nRooms: ' + ROOM_PHOTOS_LINK + '\nOutdoor / Activities: ' + OUTDOOR_PHOTOS_LINK + '\nMaps: ' + MAPS_LINK);
  }
  if (wantsQRForPayment(text)) answers.push('Please confirm date and guests first, then I will send QR for advance payment. Which date and how many guests?');
  if (answers.length === 0) answers.push(pickArr(GREETINGS) + '\n\nLucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view.\n\nWhich date? How many guests? What brings you to Wayanad?');
  return answers.join('\n\n');
}
async function sendWA(to, text) {
  try {
    const res = await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + WA_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }) });
    const data = await res.json(); return { status: res.status, data };
  } catch (e) { return { status: 0, data: null }; }
}
async function getMediaUrl(mediaId) {
  const r = await fetch('https://graph.facebook.com/v21.0/' + mediaId, { headers: { 'Authorization': 'Bearer ' + WA_TOKEN } });
  const j = await r.json(); return j.url;
}
async function downloadMediaBuffer(url) {
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + WA_TOKEN } }); return Buffer.from(await r.arrayBuffer());
}
async function transcribeVoice(mediaId, mimeType) {
  try {
    if (!G_KEY) return null;
    const url = await getMediaUrl(mediaId); if (!url) return null;
    const buf = await downloadMediaBuffer(url);
    const form = new FormData();
    const ext = (mimeType || '').includes('mp4') ? 'mp4' : (mimeType || '').includes('mpeg') ? 'mp3' : 'ogg';
    const blob = new Blob([buf], { type: mimeType || 'audio/ogg' });
    form.append('file', blob, 'voice.' + ext); form.append('model', 'whisper-large-v3'); form.append('response_format', 'json'); form.append('temperature', '0');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + G_KEY }, body: form });
    const j = await r.json(); if (j.text) return j.text.trim(); return null;
  } catch (e) { return null; }
}
const chatHistories = new Map(); const pendingBookings = new Map(); const processedIds = new Set(); const buffers = new Map();
async function processCombined(from, senderName, combinedText) {
  try {
    const lower = combinedText.toLowerCase();
    const utrMatch = combinedText.match(/\b\d{12}\b/);
    if (utrMatch && (lower.includes('paid') || lower.includes('utr') || lower.includes('payment') || lower.includes('advance'))) {
      const utr = utrMatch[0];
      const pending = { name: senderName, phone: from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests || '', total: pendingBookings.get(from)?.total || 0, advance: 0, utr, status: 'Pending' };
      pendingBookings.set(from, pending);
      await sendWA(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: ' + senderName + ' (' + from + ')\nDate: ' + pending.date + '\nUTR: ' + utr + '\nTotal: ' + formatPrice(pending.total) + '\n\nReply YES to confirm, NO to reject.');
      await sendWA(from, 'Payment + UTR ' + utr + ' received.\n\nOwner will verify and I will confirm your booking in a moment.');
      return;
    }
    if (!chatHistories.has(from)) chatHistories.set(from, []);
    const history = chatHistories.get(from);
    const isFirstMessage = history.length === 0;
    history.push({ role: 'user', content: combinedText });
    let reply = await askAI(combinedText, history);
    if (!reply) reply = logicalFallback(combinedText);
    if (isFirstMessage) {
      const tr = reply.trim().toLowerCase();
      const alreadyGreeting = tr.startsWith('hi') || tr.startsWith('hello') || tr.startsWith('hey') || tr.startsWith('good day') || tr.startsWith('welcome');
      const onlyGreet = (lower.trim() === 'hi' || lower.trim() === 'hello' || lower.trim() === 'hey' || lower.trim() === 'hii');
      if (onlyGreet) { if (!alreadyGreeting) reply = pickArr(GREETINGS) + ' Which date, how many guests?'; }
      else { if (!alreadyGreeting) reply = pickArr(GREETINGS) + '\n\n' + reply; }
    }
    if (wantsPhotos(combinedText) && !reply.includes('drive.google.com')) {
      if (lower.includes('pool')) reply += '\n\nPool photos - Drive: ' + POOL_PHOTOS_LINK;
      else if (/ro+m/.test(lower)) reply += '\n\nRoom photos - Drive: ' + ROOM_PHOTOS_LINK;
      else reply += '\n\nPhotos - Drive: ' + PHOTOS_LINK;
    }
    if (wantsQRForPayment(combinedText)) {
      const pending = pendingBookings.get(from);
      const dealNearClose = pending && pending.date && pending.date !== 'To confirm' && pending.total && pending.total > 0;
      if (dealNearClose) reply += '\n\nQR for advance - Drive: ' + QR_CODE_LINK + '\nTotal: ' + formatPrice(pending.total) + '\nAdvance: ' + formatPrice(calcAdvance(pending.total));
      else if (!reply.includes('Please confirm date')) reply += '\n\nPlease confirm date and guests first, then I will send QR for advance payment.';
    }
    history.push({ role: 'assistant', content: reply });
    if (history.length > 16) chatHistories.set(from, history.slice(-16));
    const parsedDate = parseDate(combinedText);
    if (parsedDate) { const t = getDateType(combinedText); const price = t === 'weekday' ? PRICING.fullWeekday : t === 'weekend' ? PRICING.fullWeekend : PRICING.fullFestival; pendingBookings.set(from, { name: senderName, phone: from, date: parsedDate.toISOString().slice(0, 10), guests: combinedText, total: price, advance: calcAdvance(price), status: 'Enquiry' }); }
    await sendWA(from, reply);
  } catch (e) { console.log('processCombined error ' + e.message); }
}
function scheduleProcess(from, senderName, text) {
  if (!buffers.has(from)) buffers.set(from, { texts: [], senderName, timer: null });
  const buf = buffers.get(from); buf.texts.push(text); buf.senderName = senderName;
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(async () => { const combined = buf.texts.join('\n'); buf.texts = []; buffers.delete(from); await processCombined(from, buf.senderName, combined); }, 2500);
}
app.get('/webhook', (req, res) => { const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge']; if (mode === 'subscribe' && token === VERIFY_TOKEN) { return res.status(200).send(challenge); } return res.sendStatus(403); });
app.get('/', (req, res) => res.send('Pachapp AI - BEST - Cloud API - LIVE - No Baileys'));
app.get('/health', (req, res) => res.json({ ok: true, phone: BOT_PHONE }));
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') { return res.sendStatus(200); }
    const entry = body.entry?.[0]; const change = entry?.changes?.[0]; const value = change?.value; const messages = value?.messages;
    if (!messages || messages.length === 0) { return res.sendStatus(200); }
    for (const m of messages) {
      const from = m.from; const type = m.type; const senderName = value.contacts?.[0]?.profile?.name || 'Guest';
      if (m.id) { if (processedIds.has(m.id)) continue; processedIds.add(m.id); if (processedIds.size > 500) { const f = processedIds.values().next().value; processedIds.delete(f); } }
      if (from === OWNER_NUMBER && type === 'text') {
        const txt = (m.text?.body || '').toLowerCase().trim();
        if (txt === 'yes' || txt === 'no' || txt.includes('confirm') || txt.includes('verified')) {
          const allPending = Array.from(pendingBookings.entries());
          if (allPending.length > 0) {
            const lastEntry = allPending[allPending.length - 1]; const targetPhone = lastEntry[0]; const targetBooking = lastEntry[1];
            if (txt === 'yes' || txt.includes('confirm') || txt.includes('verified')) { targetBooking.status = 'Confirmed'; await saveToDB(targetBooking); await sendWA(targetBooking.phone, 'Booking CONFIRMED - Pachapp Pool Villa!\n\nDate: ' + targetBooking.date + '\nGuests: ' + targetBooking.guests + '\nTotal: ' + formatPrice(targetBooking.total) + '\nAdvance: Verified by owner\nBalance: Owner will tell you balance before check-in.\n\nMaps: ' + MAPS_LINK + '\nNearby: ' + NEARBY_LINK + '\n\nWelcome to Pachapp!'); await sendWA(from, 'Confirmed to guest ' + targetBooking.name + ' - latest booking.'); pendingBookings.delete(targetPhone); } else { await sendWA(from, 'Not confirmed.'); }
            continue;
          }
        }
      }
      if (type === 'text') { const text = m.text?.body || ''; if (!text) continue; scheduleProcess(from, senderName, text); continue; }
      if (type === 'audio' || type === 'voice') { const mediaId = m.audio?.id || m.voice?.id; const mime = m.audio?.mime_type || m.voice?.mime_type || 'audio/ogg'; const transcribed = await transcribeVoice(mediaId, mime); if (!transcribed) { await sendWA(from, 'I heard your voice note, but could not hear clearly. Could you please send again, or type?'); continue; } scheduleProcess(from, senderName, '[voice] ' + transcribed); continue; }
      if (type === 'image') { const caption = m.image?.caption || ''; const utrMatch = caption.match(/\b\d{12}\b/); const utr = utrMatch ? utrMatch[0] : 'Screenshot received'; const pending = { name: senderName, phone: from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests || '', total: pendingBookings.get(from)?.total || 0, advance: 0, utr, status: 'Pending' }; pendingBookings.set(from, pending); await sendWA(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: ' + senderName + ' (' + from + ')\nDate: ' + pending.date + '\nUTR: ' + utr + '\nTotal: ' + formatPrice(pending.total) + '\n\nReply YES to confirm, NO to reject.'); await sendWA(from, 'Payment screenshot + UTR ' + utr + ' received.\n\nOwner will verify and I will confirm your booking in a moment.'); continue; }
      await sendWA(from, 'Please send text or voice note.');
    }
    return res.sendStatus(200);
  } catch (e) { console.log('Webhook error ' + e.message); return res.sendStatus(200); }
});
app.listen(PORT, () => console.log('Pachapp AI BEST LIVE on ' + PORT));
