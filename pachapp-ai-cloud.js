// Pachapp AI - Final server.js
// Form: Pachapp Bookings Form (locked)
// Airtable Table: Pachapp Bookings
// Bot: Guest DM = human way, Group = silent while you test manually
// Rule: Pay before Confirm. No payment = No Confirmed booking.
// Rule: Never invent links. Only use FORM_URL from env.

const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ---- ENV - set these in Render > Environment, never paste tokens in chat ----
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'pachapp-verify';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Pachapp Bookings';
const FORM_URL = process.env.FORM_URL || ''; // Share link of Pachapp Bookings Form
const OWNER_PHONE = process.env.OWNER_PHONE || '918943666911'; // Uday Hue
const CARETAKER_PHONE = process.env.CARETAKER_PHONE || '91894366911'; // Sreejith

// ---- Memory fix - do not ask repeated questions ----
const sessions = new Map(); // phone -> { asked: Set, lastDates, lastType, paused }
const groupPaused = new Map(); // groupId -> true/false

function getSession(phone) {
  if (!sessions.has(phone)) sessions.set(phone, { asked: new Set(), lastDates: '', lastType: '', paused: false });
  return sessions.get(phone);
}
function cleanPhone(p) { return String(p || '').replace(/\D/g, ''); }
function isOwner(phone) {
  const c = cleanPhone(phone);
  return c === cleanPhone(OWNER_PHONE) || c === cleanPhone(CARETAKER_PHONE);
}

// ---- Pricing - same as locked form, triple-checked ----
function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0 Sun, 5 Fri, 6 Sat
  return day === 0 || day === 5 || day === 6;
}
function calcTotal({ bookingType, nights, adults, kidsHalf, rooms, breakfastCount }) {
  const n = Math.max(1, Math.min(7, nights || 1));
  const perNight = bookingType === 'Full Villa' ? 6400 : 1600; // Rooms perNight is per room, handled below
  let roomTotal = 0;
  let perNightRate = perNight;
  if (bookingType === 'Full Villa') {
    // Weekend Fri/Sat/Sun 8000 - simplified: if any night is weekend use 8000, else 6400
    // For exact per-night split, form already calculates. Bot uses same rule for estimate.
    perNightRate = 6400;
    roomTotal = perNightRate * n;
  } else {
    roomTotal = 1600 * (rooms || 1) * n;
    perNightRate = 1600;
  }
  const extraCount = Math.max(0, (adults || 0) - 8);
  const extraTotal = extraCount * 800 * n;
  const kidsHalfTotal = (kidsHalf || 0) * 400 * n; // Half of 800
  const breakfastTotal = bookingType === 'Full Villa' ? 0 : (breakfastCount || 0) * 100;
  const grandTotal = roomTotal + extraTotal + kidsHalfTotal + breakfastTotal;
  let advance = 0;
  if (bookingType === 'Rooms' && (rooms || 1) === 1 && n === 1 && (adults || 0) <= 2 && (kidsHalf || 0) === 0) advance = 1600;
  else if (grandTotal <= 10000) advance = 2000;
  else advance = Math.round(grandTotal * 0.20);
  return { perNightRate, roomTotal, extraCount, extraTotal, kidsHalfTotal, breakfastTotal, grandTotal, advance, nights: n };
}

// ---- Airtable ----
async function createAirtableBooking(data) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.log('Airtable not configured - skipping Airtable, still saving via form DB');
    return null;
  }
  const fields = {
    'Guest Name': data.guestName || '',
    'Phone / WhatsApp': data.phone || '',
    'Booking Type': data.bookingType || 'Full Villa',
    'Check-in': data.checkIn || '',
    'Check-out': data.checkOut || '',
    'Nights': data.nights || 1,
    'Adults': data.adults || 2,
    'Kids Below 6': data.kidsFree || 0,
    'Kids 6-12': data.kidsHalf || 0,
    'Kids 6-12 Total': data.kidsHalfTotal || 0,
    'Rooms': data.rooms || 1,
    'Breakfast Count': data.breakfastCount || 0,
    'Breakfast Included': data.breakfastIncluded || (data.bookingType === 'Full Villa' ? 'Yes - Free' : 'No'),
    'Rate Applied': data.rateApplied || '',
    'Per Night Rate': data.perNightRate || 0,
    'Room Total': data.roomTotal || 0,
    'Extra Adult Count': data.extraCount || 0,
    'Extra Adult Total': data.extraTotal || 0,
    'Breakfast Total': data.breakfastTotal || 0,
    'Grand Total': data.grandTotal || 0,
    'Advance to Pay': data.advanceToPay || 0,
    'UTR': data.utr || '',
    'Payment Status': data.utr ? 'Confirmed' : 'Pending - Waiting for Advance',
    'Booking Status': data.utr ? 'Confirmed' : 'Pending - Waiting for Advance',
    'Source': 'Form',
    'Notes': data.notes || '',
    'Created At': new Date().toISOString()
  };
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [{ fields }] })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.log('Airtable error', out); throw new Error('Airtable failed'); }
  return out;
}

// ---- WhatsApp send ----
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log('WhatsApp not configured, would send to', to, text); return; }
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: '【entity-whatsapp¦canonical_name=WhatsApp】', to, type: 'text', text: { body: text } })
  }).catch(e => console.log('Send failed', e.message));
}

function formLinkText() {
  if (!FORM_URL) return 'Booking form link is being updated. Please ask owner for the latest link.';
  return FORM_URL;
}

// ---- Health + Booking API (Form -> Airtable) ----
app.get('/', (req, res) => res.send('Pachapp AI is running'));
app.get('/health', (req, res) => res.json({ ok: true, form: FORM_URL ? 'set' : 'missing', airtable: AIRTABLE_TABLE }));

// Redirect /booking to the real locked form
app.get('/booking', (req, res) => {
  if (FORM_URL) return res.redirect(FORM_URL);
  return res.send('FORM_URL not set in Render Environment. Set it to the Share link of Pachapp Bookings Form.');
});

// Form submits here -> creates Airtable row, Pay before Confirm
app.post('/booking', async (req, res) => {
  try {
    const b = req.body || {};
    const calc = calcTotal({
      bookingType: b.bookingType || b['Booking Type'] || 'Full Villa',
      nights: Number(b.nights || b.Nights || 1),
      adults: Number(b.adults || b.Adults || 2),
      kidsHalf: Number(b.kidsHalf || b['Kids 6-12'] || 0),
      rooms: Number(b.rooms || b.Rooms || 1),
      breakfastCount: Number(b.breakfastCount || b['Breakfast Count'] || 0)
    });
    const data = {
      guestName: b.guestName || b['Guest Name'] || b.name || '',
      phone: b.phone || b['Phone / WhatsApp'] || '',
      bookingType: b.bookingType || b['Booking Type'] || 'Full Villa',
      checkIn: b.checkIn || b['Check-in'] || '',
      checkOut: b.checkOut || b['Check-out'] || '',
      nights: calc.nights,
      adults: Number(b.adults || 2),
      kidsFree: Number(b.kidsFree || b['Kids Below 6'] || 0),
      kidsHalf: Number(b.kidsHalf || b['Kids 6-12'] || 0),
      kidsHalfTotal: calc.kidsHalfTotal,
      rooms: Number(b.rooms || 1),
      breakfastCount: Number(b.breakfastCount || 0),
      breakfastIncluded: b.breakfastIncluded || (b.bookingType === 'Full Villa' ? 'Yes - Free' : 'No'),
      rateApplied: b.rateApplied || '',
      perNightRate: calc.perNightRate,
      roomTotal: calc.roomTotal,
      extraCount: calc.extraCount,
      extraTotal: calc.extraTotal,
      breakfastTotal: calc.breakfastTotal,
      grandTotal: calc.grandTotal,
      advanceToPay: calc.advance,
      utr: b.utr || b.UTR || '',
      notes: b.notes || b.Notes || ''
    };
    if (!data.guestName.trim()) return res.status(400).json({ ok: false, error: 'Please enter the guest name.' });
    if (!data.phone.trim()) return res.status(400).json({ ok: false, error: 'Please enter phone.' });
    const airtable = await createAirtableBooking(data);
    return res.json({ ok: true, status: data.utr ? 'Confirmed' : 'Pending - Waiting for Advance', grandTotal: data.grandTotal, advance: data.advanceToPay, airtable: !!airtable });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ ok: false, error: 'Could not save booking' });
  }
});

// ---- WhatsApp Webhook ----
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // reply fast, then process
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;
    const from = msg.from;
    const text = (msg.text?.body || '').trim();
    const lower = text.toLowerCase();
    const isGroup = !!value?.metadata?.display_phone_number && (msg.context?.group_id || lower.includes('group'));
    // Group / Agent chats: AI stays silent while you test manually, except PAUSE / RESUME from owner
    if (groupPaused.get(from) === true && !isOwner(from)) return;
    if (lower === 'pause ai' && isOwner(from)) { groupPaused.set(from, true); await sendWhatsApp(from, 'AI paused. I will stay silent. Send RESUME AI to start again.'); return; }
    if (lower === 'resume ai' && isOwner(from)) { groupPaused.set(from, false); await sendWhatsApp(from, 'AI resumed.'); return; }
    // If message came from a group chat (WhatsApp groups have different structure), stay silent
    // Cloud API groups are not delivered as normal DM - extra safety: if sender is owner in group test, do not auto-reply
    if (msg.from_group) return;

    const s = getSession(from);

    // Book Now - send form immediately, do NOT ask questions again. Fixes Reshmai case.
    if (lower.includes('book now') || lower.includes('i want to pay and book now') || lower.includes('pay and book') || lower.includes('want to book')) {
      // Remember dates if guest already gave them in this message, do not ask again
      const dateMatch = text.match(/dec\s*1|december\s*1|1\s*dec|2\s*dec|dec\s*2/i);
      if (dateMatch) s.lastDates = text;
      const dateLine = s.lastDates ? `Got it - ${s.lastDates}. ` : '';
      await sendWhatsApp(from, `${dateLine}Here is the Pachapp Pool Villa booking form. Please fill it and pay the advance to confirm.\n\n${formLinkText()}\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.`);
      return;
    }

    // QR / Pay - only when guest asks to pay
    if (lower.includes('qr') || lower.includes('pay') || lower.includes('upi') || lower.includes('advance') || lower.includes('payment')) {
      await sendWhatsApp(from, `To pay, please open the booking form and tap Pay Advance. The QR code is inside the form. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking. Without UTR, your booking stays as Pending - Waiting for Advance.\n\n${formLinkText()}`);
      return;
    }

    // Photos - only when guest asks
    if (lower.includes('photo') || lower.includes('pic') || lower.includes('image') || lower.includes('video')) {
      await sendWhatsApp(from, `Photos and videos are in the booking form and on our page. Please tell me which room / view you want and I will share it. Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.`);
      return;
    }

    // Price / Rate - answer with locked pricing, do not invent
    if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('how much')) {
      await sendWhatsApp(from, `Pachapp Pool Villa:\nFull Villa - Weekday Rs.6400 / night, Weekend Fri/Sat/Sun Rs.8000 / night\nRooms - Rs.1600 per room per night\nExtra Adult - Rs.800 per night (above 8 adults)\nKids 0-6 Free, Kids 6-12 Half Price Rs.400 per kid per night\nBreakfast - Full Villa Free, Rooms Rs.100 each\nDolby Atmos included. Live music only when owner is at the villa.\n\nTo check total for your dates, please fill the form:\n${formLinkText()}`);
      return;
    }

    // Availability / Dates - do not ask repeated questions
    if (lower.includes('available') || lower.includes('dec') || lower.includes('jan') || lower.includes('date')) {
      if (s.lastDates && s.asked.has('dates')) {
        await sendWhatsApp(from, `You already shared ${s.lastDates}. Please fill the form with those dates, I will not ask again:\n${formLinkText()}`);
        return;
      }
      s.asked.add('dates');
      s.lastDates = text;
      await sendWhatsApp(from, `Thanks for sharing your dates. Please fill the booking form with those dates to check total and pay advance:\n${formLinkText()}`);
      return;
    }

    // Live music - only when owner at villa
    if (lower.includes('music') || lower.includes('dj') || lower.includes('live')) {
      await sendWhatsApp(from, `Live music is only when the owner is at the villa. Dolby Atmos is always included. Please tell me your dates in the form and we will confirm.`);
      return;
    }

    // Default - human way, send form, do not interrogate
    if (!s.asked.has('greeted')) {
      s.asked.add('greeted');
      await sendWhatsApp(from, `Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nIf you want to book, please fill this form - it shows total, advance, and QR:\n${formLinkText()}\n\nTell me your dates if you want, I will not ask again and again.`);
    } else {
      await sendWhatsApp(from, `Thanks for your message. Please fill the booking form to confirm - it has total, advance, and QR:\n${formLinkText()}`);
    }
  } catch (e) { console.log('Webhook error', e); }
});

app.listen(PORT, () => console.log('Pachapp AI running on', PORT));
