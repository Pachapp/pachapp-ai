// ===== PACHAPP - WHOLE CODE - FORM INSIDE BOT - NO DOWNLOAD NEEDED =====
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "606463179209554";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "pachapp123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const OWNER_NUMBER = "918943666911";
const CARETAKER = "0091 894366911";

// FORM_URL = your Render link + /booking
const FORM_URL = (process.env.FORM_URL || "https://pachapp-ai-1.onrender.com/booking").trim();
const IS_FORM_URL_VALID = FORM_URL && !FORM_URL.includes("example.com") && !FORM_URL.includes("meta.ai") && FORM_URL.startsWith("http");

const DRIVE = {
  MAIN: "YOUR_MAIN_DRIVE_LINK",
  OUTDOOR: "YOUR_OUTDOOR_DRIVE_LINK",
  POOL: "YOUR_POOL_DRIVE_LINK",
  ROOMS: "YOUR_ROOMS_DRIVE_LINK",
  QR: "YOUR_QR_CODE_DRIVE_LINK"
};

let AI_PAUSED = false;
let GROUP_AI_PAUSED = true;
const manualPause = {};
const groupPause = {};
const guestMemory = {};

function extractDetails(phone, text) {
  if (!guestMemory[phone]) guestMemory[phone] = {};
  const m = guestMemory[phone];
  const dateMatch = text.match(/dec\s*(\d{1,2})/gi);
  if (dateMatch && dateMatch.length >= 1) {
    if (!m.checkin) m.checkin = "2026-12-" + dateMatch[0].replace(/\D/g, "").padStart(2, "0");
    if (dateMatch.length >= 2) m.checkout = "2026-12-" + dateMatch[1].replace(/\D/g, "").padStart(2, "0");
  }
  if (/full villa/i.test(text)) m.type = "Full Villa";
  if (/separate/i.test(text)) m.type = "Separate";
  const adultMatch = text.match(/(\d+)\s*adult/i);
  if (adultMatch) m.adults = adultMatch[1];
  return m;
}

async function sendWhatsApp(to, text) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } })
  });
}

async function saveToAirtable(b) {
  const table = encodeURIComponent(process.env.AIRTABLE_TABLE || "Pachapp Bookings");
  const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${table}`;
  const status = b.utr && b.utr.trim() !== "" ? "Confirmed" : "Pending - Waiting for Advance";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      "Guest Name": b.name, "Phone": b.phone, "Booking Type": b.type,
      "Check-in": b.checkin, "Check-out": b.checkout,
      "Nights": Number(b.nights), "Adults": Number(b.adults), "Kids": Number(b.kids || 0),
      "Rooms": Number(b.rooms), "Breakfast": Number(b.breakfast || 0),
      "Total": Number(b.total), "Advance": Number(b.advance),
      "UTR": b.utr || "", "Status": status, "Source": "Form", "Notes": b.notes || ""
    }})
  });
  const data = await res.json();
  return { data, status };
}

// ===== BOOKING FORM - LIVES INSIDE BOT - NO DOWNLOAD =====
app.get("/booking", (req, res) => {
  const qCheckin = req.query.checkin || "";
  const qCheckout = req.query.checkout || "";
  const qType = req.query.type || "Full Villa";
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pachapp Pool Villa - Booking</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:linear-gradient(180deg,#2ea5e0 0%,#2ea5e0 35%,#2e8b57 100%);min-height:100vh;padding:16px;box-sizing:border-box}
    .card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.2)}
    .banner{background:linear-gradient(180deg,#3aa7e6,#2e8b57);padding:22px 16px;text-align:center;color:#fff}
    .logo{font-size:42px;font-weight:300;letter-spacing:6px;line-height:1;font-style:italic}
    .logo small{display:block;font-size:18px;letter-spacing:2px;font-style:normal;color:#000;font-weight:700;margin-top:4px}
    .addr{font-size:11px;opacity:.9;margin-top:6px}
    .body{padding:18px}
    label{font-size:13px;font-weight:700;display:block;margin:14px 0 6px}
    input,select{width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box}
    .row{display:flex;gap:10px}.row>div{flex:1}
    .total{margin-top:16px;background:#e8f8ef;border:1px solid #2e8b57;border-radius:12px;padding:12px;width:50%;box-sizing:border-box}
    .total b{font-size:18px}
    button{width:100%;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:12px}
    .pay{background:#2e8b57;color:#fff}.confirm{background:#111;color:#fff}
    #qrBox{display:none;text-align:center;margin-top:14px;border:1px dashed #aaa;padding:12px;border-radius:12px}
    #qrBox img{max-width:200px}
    .hint{font-size:12px;color:#666;margin-top:6px}
    .step{font-size:12px;color:#2e8b57;font-weight:700}
  </style></head><body><div class="card">
  <div class="banner"><div class="logo">Pachapp<small>be nowhere</small></div><div class="addr">Lucky Hill, Meppadi, Wayanad, Kerala</div><div style="margin-top:10px;font-size:14px">Pool Villa Booking</div></div>
  <div class="body">
  <div class="step">STEP 1 - BOOKING TYPE</div>
  <label>Booking Type</label><select id="type"><option ${qType==="Full Villa"?"selected":""}>Full Villa</option><option ${qType==="Separate"?"selected":""}>Separate</option></select>
  <div class="step">STEP 2 - DATES</div><div class="row"><div><label>Check-in</label><input type="date" id="checkin" value="${qCheckin}"></div><div><label>Check-out</label><input type="date" id="checkout" value="${qCheckout}"></div></div>
  <div id="nightsText" class="hint"></div>
  <div class="step">STEP 3 - GUESTS</div><div class="row"><div><label>Adults (1-20)</label><input type="number" id="adults" min="1" max="20" value="2"></div><div><label>Kids below 6 (free)</label><input type="number" id="kids" min="0" max="20" value="0"></div></div>
  <div class="step">STEP 4 - ROOMS & BREAKFAST</div><label>Rooms</label><select id="rooms"><option>1</option><option>2</option><option>3</option><option>4</option></select><div id="roomHint" class="hint"></div>
  <div id="bfWrap"><label>Breakfast (Rs.100 each, only for Separate)</label><select id="breakfast"><option value="0">No Breakfast</option><option value="1">1 Breakfast</option><option value="2">2 Breakfast</option><option value="4">4 Breakfast</option></select></div>
  <div id="bfFree" style="display:none;background:#e8f8ef;padding:10px;border-radius:10px;margin-top:10px;font-size:13px">Breakfast included FREE with Full Villa</div>
  <div class="step">STEP 5 - YOUR DETAILS</div><label>Guest Name</label><input id="name" placeholder="Full name"><label>Phone</label><input id="phone" placeholder="10 digit phone"><label>Notes (optional)</label><input id="notes" placeholder="Any request">
  <div class="total"><div>Grand Total</div><b id="totalText">Rs.0</b><div id="advText" style="font-size:12px"></div><div id="perNight" style="font-size:12px;color:#555"></div></div>
  <div class="step">STEP 6 - PAY & CONFIRM</div>
  <p class="hint">Rule: Pay Before Confirm. Fill form, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. No payment / No UTR = Pending - Waiting for Advance, not Confirmed.</p>
  <button class="pay" onclick="showQR()">Pay Advance - Show QR Code</button>
  <div id="qrBox"><p>Scan and Pay Advance</p><p id="qrImgText">QR Code will be shown by owner - please ask for QR on WhatsApp if not visible</p><p id="qrAmt" style="font-weight:700"></p></div>
  <label>UTR / Transaction ID (after payment)</label><input id="utr" placeholder="Enter UTR, e.g. TEST123">
  <button class="confirm" onclick="confirmBooking()">I Have Paid - Confirm My Booking</button>
  <p id="msg" class="hint"></p>
  </div></div>
  <script>
  const typeEl=document.getElementById('type'), checkinEl=document.getElementById('checkin'), checkoutEl=document.getElementById('checkout'), adultsEl=document.getElementById('adults'), roomsEl=document.getElementById('rooms'), bfEl=document.getElementById('breakfast'), totalText=document.getElementById('totalText'), advText=document.getElementById('advText'), perNight=document.getElementById('perNight'), nightsText=document.getElementById('nightsText'), roomHint=document.getElementById('roomHint');
  function calc(){
    const type=typeEl.value; const ci=new Date(checkinEl.value); const co=new Date(checkoutEl.value);
    let nights=1; if(checkinEl.value && checkoutEl.value){ nights=Math.round((co-ci)/86400000); if(nights<1) nights=1; if(nights>7) nights=7; }
    nightsText.textContent = checkinEl.value ? 'Nights: '+nights+' | Check-out auto: '+(checkoutEl.value||'') : '';
    let adults=parseInt(adultsEl.value||2); let autoRooms = adults<=2?1:adults<=4?2:adults<=6?3:4; roomsEl.value=autoRooms; roomHint.textContent='Suggested rooms for '+adults+' adults: '+autoRooms+' (you can change manually)';
    let isWeekend=false, isFestival=false; if(checkinEl.value){ const d=ci.getDay(); if(d===0||d===6) isWeekend=true; }
    let perNightVal=0; if(type==='Full Villa'){ if(isFestival) perNightVal=9600; else if(isWeekend) perNightVal=8000; else perNightVal=6400; } else { perNightVal=parseInt(roomsEl.value)*1600; if(adults>8) perNightVal+=(adults-8)*800; }
    let bfCount = type==='Full Villa'?0:parseInt(bfEl.value||0); let bfAmt = bfCount*100;
    let total = perNightVal*nights + bfAmt;
    let advance = total>10000?Math.round(total*0.2): total>0?2000:0; if(type!=='Full Villa' && adults<=2 && nights===1) advance=1600;
    totalText.textContent='Rs.'+total; advText.textContent='Advance to pay: Rs.'+advance; perNight.textContent='Per night: Rs.'+perNightVal+' | Breakfast: Rs.'+bfAmt;
    document.getElementById('bfWrap').style.display = type==='Full Villa'?'none':'block'; document.getElementById('bfFree').style.display = type==='Full Villa'?'block':'none';
    window._calc={type,nights,adults,rooms:parseInt(roomsEl.value),total,advance,perNightVal,bfCount};
  }
  [typeEl,checkinEl,checkoutEl,adultsEl,roomsEl,bfEl].forEach(e=>e.addEventListener('change',calc));
  checkinEl.addEventListener('change',()=>{ if(checkinEl.value && !checkoutEl.value){ const d=new Date(checkinEl.value); d.setDate(d.getDate()+1); checkoutEl.value=d.toISOString().slice(0,10); } calc(); });
  function showQR(){ calc(); document.getElementById('qrBox').style.display='block'; document.getElementById('qrAmt').textContent='Pay Advance: Rs.'+window._calc.advance; }
  async function confirmBooking(){
    calc(); const c=window._calc; const name=document.getElementById('name').value.trim(); const phone=document.getElementById('phone').value.trim(); const utr=document.getElementById('utr').value.trim(); const notes=document.getElementById('notes').value.trim(); const kids=document.getElementById('kids').value||0;
    if(!name||!phone||!checkinEl.value||!checkoutEl.value){ document.getElementById('msg').textContent='Please fill Name, Phone, Check-in, Check-out.'; return; }
    document.getElementById('msg').textContent='Saving...';
    const res=await fetch('/api/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,type:c.type,checkin:checkinEl.value,checkout:checkoutEl.value,nights:c.nights,adults:c.adults,kids:parseInt(kids),rooms:c.rooms,breakfast:c.bfCount,total:c.total,advance:c.advance,utr,notes})});
    const d=await res.json(); document.getElementById('msg').textContent = d.status==='Confirmed' ? 'Confirmed! Your booking is Confirmed. Owner will message you.' : 'Saved as Pending - Waiting for Advance. Please pay advance and enter UTR to Confirm.';
  }
  calc();
  </script></body></html>`);
});

app.post("/api/booking", async (req, res) => {
  try {
    const booking = req.body;
    const result = await saveToAirtable(booking);
    await sendWhatsApp(OWNER_NUMBER, `New booking: ${booking.name}, ${booking.checkin}, ${booking.adults} adults, Total Rs.${booking.total}, Advance Rs.${booking.advance}, Status: ${result.status}`);
    res.json({ ok: true, status: result.status });
  } catch (e) { console.log("Airtable error", e); res.json({ ok: false }); }
});

async function callAI(guestText, mem) {
  const prompt = `You are Pachapp Pool Villa assistant. Reply in guest's same language.
CRITICAL: Guest already gave Check-in ${mem.checkin || "not yet"}, Check-out ${mem.checkout || "not yet"}, Type ${mem.type || "not yet"}, Adults ${mem.adults || "not yet"}. NEVER ask again.
Ask MAX 1 question. FORM LINK RULE: Use ONLY this exact link: ${FORM_URL}. Never invent, never use example.com, never use meta.ai/share. If FORM_URL empty, do NOT send link.
Facts: 4 rooms, 8 adults + 8 kids below 6 free, up to 20 with extra beds. Pricing Full Villa weekday Rs.6400, weekend Rs.8000, festival Rs.9600. Separate 1 room Rs.1600, 2 rooms Rs.3200, 3 rooms Rs.4800. Extra adult Rs.800. Breakfast free Full Villa, Rs.100 Separate. Advance 1 room Rs.1600, up to Rs.10000 min Rs.2000, over Rs.10000 20%. Music Dolby Atmos always, live music only if owner Uday Hue is there. Caretaker ${CARETAKER}.
Photos ONLY if asked. QR ONLY if guest asks to pay. Booking Pay Before Confirm. No UTR = Pending.
Guest says: ${guestText}`;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: prompt }], temperature: 0.8 })
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || "Sorry, please try again.";
  } catch (e) { return "Sorry, please try again."; }
}

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;
    const sender = msg.from;
    const text = (msg.text?.body || "").trim();
    const isGroup = msg.from.endsWith("@g.us") || !!msg.context?.group_id;
    const chatId = sender;
    if (sender === OWNER_NUMBER) {
      const low = text.toLowerCase();
      if (low === "pause ai") { AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "AI paused. Send RESUME AI to start."); return; }
      if (low === "resume ai") { AI_PAUSED = false; GROUP_AI_PAUSED = false; await sendWhatsApp(OWNER_NUMBER, "AI resumed."); return; }
      if (low === "pause group ai") { GROUP_AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "Group AI paused."); return; }
      if (isGroup) groupPause[chatId] = Date.now();
      return;
    }
    if (AI_PAUSED) return;
    if (manualPause[chatId] && Date.now() - manualPause[chatId] < 60*60*1000) return;
    if (isGroup) { if (GROUP_AI_PAUSED) return; return; }
    let guestText = text;
    if (msg.type === "audio") guestText = text || "Guest sent voice note";
    const mem = extractDetails(sender, guestText);
    const lower = guestText.toLowerCase();
    const wantsToBook = lower.includes("book now") || lower.includes("pay and book") || lower.includes("i want to pay") || lower.includes("dont confuse") || lower.includes("don't confuse") || lower.includes("no time to waste") || lower.includes("i want to book it now");
    if (wantsToBook) {
      if (!IS_FORM_URL_VALID) { await sendWhatsApp(sender, `Sorry, no more questions. Your form link will be sent in a moment.`); return; }
      let link = FORM_URL;
      const params = new URLSearchParams();
      if (mem.checkin) params.append("checkin", mem.checkin);
      if (mem.checkout) params.append("checkout", mem.checkout);
      if (mem.type) params.append("type", mem.type);
      if (params.toString()) link += "?" + params.toString();
      await sendWhatsApp(sender, `Sorry, no more questions. Here is your booking form, already filled for you:\n${link}\n\nAfter filling, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. Your booking will be Confirmed.`);
      return;
    }
    const aiReply = await callAI(guestText, mem);
    await sendWhatsApp(sender, aiReply);
  } catch (e) { console.log(e); }
});

app.get("/", (req, res) => res.send("Pachapp AI live. Form at /booking"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Pachapp AI live on " + PORT));
