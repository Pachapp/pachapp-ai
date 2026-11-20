require('dotenv').config();
var express = require('express');
var app = express();
app.use(express.json());

var PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '606463179209554';
var VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
var WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
var OWNER_NUMBER = '918943666911';
var CARETAKER = '0091 894366911';

var FORM_URL = (process.env.FORM_URL || 'https://pachapp-ai-1.onrender.com/booking').trim();
var IS_FORM_URL_VALID = FORM_URL !== '' && FORM_URL.indexOf('example.com') === -1 && FORM_URL.indexOf('meta.ai') === -1 && FORM_URL.indexOf('http') === 0;

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

app.get('/booking', function(req, res) {
  var h = '';
  h += '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pachapp - Booking</title>';
  h += '<style>';
  h += 'body{margin:0;font-family:Arial,sans-serif;background:#7a8a2e;padding:0}';
  h += '.banner{background:linear-gradient(180deg,#0f3d22 0%,#1a6b3a 35%,#2e9a5a 100%);padding:28px 16px 0;text-align:center;overflow:hidden}';
  h += '.logo{font-family:cursive;font-size:88px;line-height:0.9;color:#1e3d00;margin:0;transform:rotate(-2deg)}';
  h += '.be{font-size:44px;font-weight:900;letter-spacing:12px;color:#000;margin-top:2px}';
  h += '.addr{font-size:19px;letter-spacing:4px;color:#1a2a00;margin-top:10px;font-weight:600}';
  h += '.line{height:14px;background:linear-gradient(90deg,#0a2a1a,#1a3a3a);margin:18px -16px 0}';
  h += '.greenbox{background:linear-gradient(180deg,#2e9a5a,#4ab86e);height:120px;margin:0 -16px}';
  h += '.wrap{padding:16px;background:#7a8a2e}';
  h += '.formbox{background:#1a5c2a;border-radius:18px;padding:22px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.3)}';
  h += '.ftitle{font-size:34px;letter-spacing:6px;font-weight:300;color:#fff;margin:0}';
  h += 'hr{border:0;border-top:1px solid #e8e8a0;margin:16px 0;opacity:.7}';
  h += '.flabel{display:flex;align-items:center;gap:10px;font-size:14px;letter-spacing:2px;color:#e8e8c0;font-weight:700;margin:18px 0 10px}';
  h += '.num{background:#e8e8a0;color:#1a5c2a;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0}';
  h += 'input,select{width:100%;padding:15px 14px;border:1px solid #5a7a8a;border-bottom:2px solid #e8e8a0;border-radius:10px;font-size:16px;color:#fff;background:linear-gradient(90deg,#1a3a3a,#1a4d7a);box-sizing:border-box;outline:none}';
  h += 'select option{color:#000;background:#fff}';
  h += 'input::placeholder{color:#cfe0e0}';
  h += '.row{display:flex;gap:12px}.row>div{flex:1}';
  h += '.hint{font-size:12px;color:#d8e8d8;margin-top:6px;line-height:1.5}';
  h += '.bfFree{display:none;background:#eaf7ee;color:#1a6b3a;padding:12px;border-radius:10px;font-size:13px;font-weight:800;margin-top:10px}';
  h += '.total{margin-top:18px;background:#eaf7ee;color:#111;border-radius:12px;padding:14px;width:50%;min-width:210px}';
  h += '.total b{font-size:22px}';
  h += 'button{width:100%;padding:15px;border:0;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px}';
  h += '.pay{background:#2e8b57;color:#fff}.confirm{background:#111;color:#fff}';
  h += '#qrBox{display:none;text-align:center;margin-top:14px;background:#fffdf0;color:#111;padding:14px;border-radius:12px}';
  h += '#msg{font-size:13px;font-weight:700;margin-top:12px;line-height:1.5}';
  h += '.rule{font-size:12px;color:#d8e8d8;background:rgba(255,255,255,.08);padding:11px;border-radius:10px;line-height:1.6;margin-top:8px}';
  h += '@media(max-width:480px){.logo{font-size:64px}.be{font-size:32px;letter-spacing:8px}.row{flex-direction:column;gap:0}.total{width:100%}}';
  h += '</style></head><body>';
  h += '<div class="banner"><div class="logo">Pachapp</div><div class="be">be nowhere</div><div class="addr">Lucky Hill, Meppadi, Wayanad, Kerala</div><div class="line"></div><div class="greenbox"></div></div>';
  h += '<div class="wrap"><div class="formbox"><div class="ftitle">BOOKING FORM</div><hr>';
  h += '<div class="flabel"><span class="num">1</span> YOUR NAME</div><input id="name" placeholder="Reshma">';
  h += '<div class="flabel"><span class="num">2</span> PHONE / WHATSAPP</div><input id="phone" placeholder="971503672246">';
  h += '<div class="flabel"><span class="num">3</span> BOOKING TYPE</div><select id="type"><option>Full Villa</option><option>Separate</option></select>';
  h += '<div class="flabel"><span class="num">4</span> CHECK-IN / CHECK-OUT</div><div class="row"><div><input type="date" id="checkin"></div><div><input type="date" id="checkout"></div></div><div id="nightsText" class="hint"></div>';
  h += '<div class="flabel"><span class="num">5</span> GUESTS</div><div class="row"><div><input type="number" id="adults" min="1" max="20" value="2" placeholder="Adults 1-20"></div><div><input type="number" id="kids" min="0" max="20" value="0" placeholder="Kids below 6 free"></div></div>';
  h += '<div class="flabel"><span class="num">6</span> ROOMS & BREAKFAST</div><select id="rooms"><option>1</option><option>2</option><option>3</option><option>4</option></select><div id="roomHint" class="hint"></div>';
  h += '<div id="bfWrap" style="margin-top:10px"><select id="breakfast"><option value="0">No Breakfast</option><option value="1">1 Breakfast</option><option value="2">2 Breakfast</option><option value="4">4 Breakfast</option><option value="6">6 Breakfast</option><option value="8">8 Breakfast</option></select></div>';
  h += '<div id="bfFree" class="bfFree">Breakfast included FREE with Full Villa</div>';
  h += '<div class="flabel"><span class="num">7</span> NOTES (OPTIONAL)</div><input id="notes" placeholder="Any request">';
  h += '<div class="total"><div style="font-size:11px;font-weight:800;color:#2e8b57">GRAND TOTAL</div><b id="totalText">Rs.0</b><div id="advText" style="font-size:12px"></div><div id="perNight" style="font-size:12px"></div></div>';
  h += '<div class="rule">Pay before confirm: Fill form, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. No payment / No UTR = Pending - Waiting for Advance, not Confirmed.</div>';
  h += '<button class="pay" onclick="showQR()">Pay Advance - Show QR Code</button>';
  h += '<div id="qrBox"><p style="font-weight:800;margin:0">Scan and Pay Advance</p><p style="font-size:13px">QR Code will be shown by owner - please ask for QR on WhatsApp if not visible</p><p id="qrAmt" style="font-weight:800"></p></div>';
  h += '<div class="flabel"><span class="num">8</span> UTR / TRANSACTION ID</div><input id="utr" placeholder="Enter UTR, e.g. TEST123">';
  h += '<button class="confirm" onclick="confirmBooking()">I Have Paid - Confirm My Booking</button><p id="msg"></p>';
  h += '</div></div>';
  h += '<script>';
  h += 'var typeEl=document.getElementById("type"),checkinEl=document.getElementById("checkin"),checkoutEl=document.getElementById("checkout"),adultsEl=document.getElementById("adults"),roomsEl=document.getElementById("rooms"),bfEl=document.getElementById("breakfast");';
  h += 'function calc(){var type=typeEl.value;var ci=new Date(checkinEl.value);var co=new Date(checkoutEl.value);var nights=1;if(checkinEl.value&&checkoutEl.value){nights=Math.round((co-ci)/86400000);if(nights<1)nights=1;if(nights>7)nights=7;}document.getElementById("nightsText").textContent=checkinEl.value?"Nights: "+nights+" | Check-out: "+(checkoutEl.value||""):"Select check-in, check-out will auto-show.";var adults=parseInt(adultsEl.value||2);if(adults<1)adults=1;if(adults>20)adults=20;var autoRooms=adults<=2?1:adults<=4?2:adults<=6?3:adults<=8?4:4;var extra=adults>8?" + extra beds for "+(adults-8)+" extra adults":"";if(document.activeElement!==roomsEl)roomsEl.value=autoRooms;document.getElementById("roomHint").textContent="Suggested for "+adults+" adults: "+autoRooms+" rooms"+extra+" (you can change manually)";var isWeekend=false;if(checkinEl.value){var d=ci.getDay();if(d===0||d===6)isWeekend=true;}var per=0;if(type==="Full Villa"){per=isWeekend?8000:6400;}else{per=parseInt(roomsEl.value)*1600;if(adults>8)per+=(adults-8)*800;}var bfCount=type==="Full Villa"?0:parseInt(bfEl.value||0);var bfAmt=bfCount*100;var total=per*nights+bfAmt;var adv=total>10000?Math.round(total*0.2):total>0?2000:0;if(type!=="Full Villa"&&adults<=2&&nights===1)adv=1600;document.getElementById("totalText").textContent="Rs."+total;document.getElementById("advText").textContent="Advance to pay: Rs."+adv;document.getElementById("perNight").textContent="Per night: Rs."+per+" | Breakfast: Rs."+bfAmt;document.getElementById("bfWrap").style.display=type==="Full Villa"?"none":"block";document.getElementById("bfFree").style.display=type==="Full Villa"?"block":"none";window._c={type:type,nights:nights,adults:adults,rooms:parseInt(roomsEl.value),total:total,advance:adv,bfCount:bfCount};}';
  h += 'typeEl.addEventListener("change",calc);checkinEl.addEventListener("change",calc);checkoutEl.addEventListener("change",calc);adultsEl.addEventListener("change",calc);roomsEl.addEventListener("change",calc);bfEl.addEventListener("change",calc);';
  h += 'checkinEl.addEventListener("change",function(){if(checkinEl.value&&!checkoutEl.value){var d=new Date(checkinEl.value);d.setDate(d.getDate()+1);checkoutEl.value=d.toISOString().slice(0,10);}calc();});';
  h += 'function showQR(){calc();document.getElementById("qrBox").style.display="block";document.getElementById("qrAmt").textContent="Pay Advance: Rs."+window._c.advance;}';
  h += 'async function confirmBooking(){calc();var c=window._c;var name=document.getElementById("name").value.trim();var phone=document.getElementById("phone").value.trim();var utr=document.getElementById("utr").value.trim();var notes=document.getElementById("notes").value.trim();var kids=document.getElementById("kids").value||0;if(!name||!phone||!checkinEl.value||!checkoutEl.value){document.getElementById("msg").textContent="Please fill Name, Phone, Check-in, Check-out.";return;}document.getElementById("msg").textContent="Saving...";var res=await fetch("/api/booking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,phone:phone,type:c.type,checkin:checkinEl.value,checkout:checkoutEl.value,nights:c.nights,adults:c.adults,kids:parseInt(kids),rooms:c.rooms,breakfast:c.bfCount,total:c.total,advance:c.advance,utr:utr,notes:notes})});var d=await res.json();document.getElementById("msg").textContent=d.status==="Confirmed"?"Confirmed! Your booking is Confirmed. Owner will message you.":"Saved as Pending - Waiting for Advance. Please pay advance and enter UTR to Confirm.";}';
  h += 'calc();';
  h += '</scr' + 'ipt></body></html>';
  res.send(h);
});

async function callAI(guestText, mem) {
  var prompt = 'You are Pachapp Pool Villa assistant. Reply in guest same language. '
    + 'Guest already gave Type ' + (mem.type || 'not yet') + ', Adults ' + (mem.adults || 'not yet') + '. NEVER ask again. '
    + 'Ask MAX 1 question. '
    + 'FORM LINK RULE: Use ONLY this exact link as-is: ' + FORM_URL + '. Never invent, never use example.com, never use meta.ai. '
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
