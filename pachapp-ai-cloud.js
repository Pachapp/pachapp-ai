require('dotenv').config();
var express = require('express');
var app = express();
app.use(express.json());

var PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '606463179209554';
var VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
var WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
var OWNER_NUMBER = '918943666911';
var CARETAKER = '0091 894366911';

var FORM_URL = (process.env.FORM_URL || '').trim();
var IS_FORM_URL_VALID = FORM_URL !== '' && FORM_URL.indexOf('example.com') === -1 && FORM_URL.indexOf('http') === 0;

var DRIVE_QR = 'YOUR_QR_CODE_DRIVE_LINK';

var AI_PAUSED = false;
var GROUP_AI_PAUSED = true;
var guestMemory = {};

function extractDetails(phone, text) {
  if (!guestMemory[phone]) {
    guestMemory[phone] = {};
  }
  var m = guestMemory[phone];
  var low = text.toLowerCase();
  if (low.indexOf('full villa') !== -1) {
    m.type = 'Full Villa';
  }
  if (low.indexOf('separate') !== -1) {
    m.type = 'Separate';
  }
  var adultMatch = text.match(/(\d+)\s*adult/i);
  if (adultMatch) {
    m.adults = adultMatch[1];
  }
  var dateMatch = text.match(/dec\s*(\d{1,2})/gi);
  if (dateMatch && dateMatch.length >= 1) {
    if (!m.checkin) {
      m.checkin = '2026-12-' + dateMatch[0].replace(/\D/g, '').padStart(2, '0');
    }
    if (dateMatch.length >= 2) {
      m.checkout = '2026-12-' + dateMatch[1].replace(/\D/g, '').padStart(2, '0');
    }
  }
  return m;
}

async function sendWhatsApp(to, text) {
  await fetch('https://graph.facebook.com/v19.0/' + PHONE_NUMBER_ID + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } })
  });
}

async function saveToAirtable(b) {
  var table = encodeURIComponent(process.env.AIRTABLE_TABLE || 'Pachapp Bookings');
  var url = 'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/' + table;
  var status = (b.utr && b.utr.trim() !== '') ? 'Confirmed' : 'Pending - Waiting for Advance';
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      'Guest Name': b.name,
      'Phone': b.phone,
      'Booking Type': b.type,
      'Check-in': b.checkin,
      'Check-out': b.checkout,
      'Nights': Number(b.nights),
      'Adults': Number(b.adults),
      'Kids': Number(b.kids || 0),
      'Rooms': Number(b.rooms),
      'Breakfast': Number(b.breakfast || 0),
      'Total': Number(b.total),
      'Advance': Number(b.advance),
      'UTR': b.utr || '',
      'Status': status,
      'Source': 'Form',
      'Notes': b.notes || ''
    } })
  });
  var data = await res.json();
  return { data: data, status: status };
}

app.post('/api/booking', async function(req, res) {
  try {
    var booking = req.body;
    var result = await saveToAirtable(booking);
    await sendWhatsApp(OWNER_NUMBER, 'New booking: ' + booking.name + ', ' + booking.checkin + ', ' + booking.adults + ' adults, Total Rs.' + booking.total + ', Advance Rs.' + booking.advance + ', Status: ' + result.status);
    res.json({ ok: true, status: result.status });
  } catch (e) {
    console.log('Airtable error', e);
    res.json({ ok: false });
  }
});

async function callAI(guestText, mem) {
  var prompt = 'You are Pachapp Pool Villa assistant. Reply in guest same language. '
    + 'Guest already gave Check-in ' + (mem.checkin || 'not yet') + ', Check-out ' + (mem.checkout || 'not yet') + ', Type ' + (mem.type || 'not yet') + ', Adults ' + (mem.adults || 'not yet') + '. NEVER ask again for what is already given. '
    + 'Ask MAX 1 question. '
    + 'FORM LINK RULE: Use ONLY this exact link as-is, no extra params: ' + FORM_URL + '. Never invent, never use example.com. If FORM_URL empty, do NOT send link. '
    + 'Facts: 4 rooms, 8 adults + 8 kids below 6 free, up to 20 with extra beds. Pricing Full Villa weekday Rs.6400, weekend Rs.8000, festival Rs.9600. Separate 1 room Rs.1600, 2 rooms Rs.3200, 3 rooms Rs.4800. Extra adult Rs.800. Breakfast free Full Villa, Rs.100 Separate. Advance 1 room Rs.1600, up to Rs.10000 min Rs.2000, over Rs.10000 20 percent. '
    + 'Music Dolby Atmos always, live music only if owner Uday Hue is there. Caretaker ' + CARETAKER + '. '
    + 'Photos ONLY if asked. QR ONLY if guest asks to pay. Booking Pay Before Confirm. No UTR = Pending. '
    + 'Guest says: ' + guestText;
  try {
    var r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], temperature: 0.8 })
    });
    var d = await r.json();
    if (d.choices && d.choices[0] && d.choices[0].message) {
      return d.choices[0].message.content;
    }
    return 'Sorry, please try again.';
  } catch (e) {
    return 'Sorry, please try again.';
  }
}

app.get('/webhook', function(req, res) {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', async function(req, res) {
  res.sendStatus(200);
  try {
    if (!req.body.entry || !req.body.entry[0] || !req.body.entry[0].changes || !req.body.entry[0].changes[0] || !req.body.entry[0].changes[0].value || !req.body.entry[0].changes[0].value.messages) {
      return;
    }
    var msg = req.body.entry[0].changes[0].value.messages[0];
    if (!msg) {
      return;
    }
    var sender = msg.from;
    var text = '';
    if (msg.text && msg.text.body) {
      text = msg.text.body.trim();
    }
    var isGroup = false;
    if (msg.from && msg.from.indexOf('@g.us') !== -1) {
      isGroup = true;
    }
    if (msg.context && msg.context.group_id) {
      isGroup = true;
    }

    if (sender === OWNER_NUMBER) {
      var low = text.toLowerCase();
      if (low === 'pause ai') {
        AI_PAUSED = true;
        await sendWhatsApp(OWNER_NUMBER, 'AI paused. Send RESUME AI to start.');
        return;
      }
      if (low === 'resume ai') {
        AI_PAUSED = false;
        GROUP_AI_PAUSED = false;
        await sendWhatsApp(OWNER_NUMBER, 'AI resumed.');
        return;
      }
      if (low === 'pause group ai') {
        GROUP_AI_PAUSED = true;
        await sendWhatsApp(OWNER_NUMBER, 'Group AI paused. Guest DM still working.');
        return;
      }
      if (isGroup) {
        return;
      }
      return;
    }

    if (AI_PAUSED) {
      return;
    }

    if (isGroup) {
      return;
    }

    var guestText = text;
    if (msg.type === 'audio') {
      guestText = text || 'Guest sent voice note';
    }
    var mem = extractDetails(sender, guestText);
    var lower = guestText.toLowerCase();
    var wantsToBook = lower.indexOf('book now') !== -1 || lower.indexOf('pay and book') !== -1 || lower.indexOf('i want to pay') !== -1 || lower.indexOf('dont confuse') !== -1 || lower.indexOf('no time to waste') !== -1 || lower.indexOf('i want to book it now') !== -1;

    if (wantsToBook) {
      if (!IS_FORM_URL_VALID) {
        await sendWhatsApp(sender, 'Sorry, no more questions. Your form link will be sent in a moment.');
        return;
      }
      await sendWhatsApp(sender, 'Sorry, no more questions. Here is your booking form:\n' + FORM_URL + '\n\nFill it, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. Your booking will be Confirmed.');
      return;
    }

    var aiReply = await callAI(guestText, mem);
    await sendWhatsApp(sender, aiReply);
  } catch (e) {
    console.log(e);
  }
});

app.get('/', function(req, res) {
  res.send('Pachapp AI live.');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Pachapp AI live on ' + PORT);
});
