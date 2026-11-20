// ===== PACHAPP - WHOLE CODE - LOCKED FORM + GROUP SILENT - NO DOWNLOAD =====
require('dotenv').config();
const 【entity-express¦canonical_name=express】 = require('【entity-express¦canonical_name=express】');
const app = 【entity-express¦canonical_name=express】();
app.use(【entity-express¦canonical_name=express】.json());
app.use(【entity-express¦canonical_name=express】.urlencoded({ extended: true }));

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "606463179209554";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "pachapp123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const OWNER_NUMBER = "918943666911";
const CARETAKER = "0091 894366911";

// FORM_URL = your Render link + /booking, e.g. https://pachapp-ai-1.onrender.com/booking
const FORM_URL = (process.env.FORM_URL || "https://pachapp-ai-1.onrender.com/booking").trim();
const IS_FORM_URL_VALID = FORM_URL && !FORM_URL.includes("example.com") && !FORM_URL.includes("meta.ai") && FORM_URL.startsWith("http");

const DRIVE = {
  MAIN: "YOUR_MAIN_DRIVE_LINK",
  OUTDOOR: "YOUR_OUTDOOR_DRIVE_LINK",
  POOL: "YOUR_POOL_DRIVE_LINK",
  ROOMS: "YOUR_ROOMS_DRIVE_LINK",
  QR: "YOUR_QR_CODE_DRIVE_LINK"
};

// ===== GROUP AI SILENT - DO NOT CHANGE TO TEST =====
let AI_PAUSED = false;
let GROUP_AI_PAUSED = true; // Group / Agents will NOT be answered
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

// ===== LOCKED BOOKING FORM - PREMIUM DESIGN =====
app.get("/booking", (req, res) => {
  const qCheckin = req.query.checkin || "";
  const qCheckout = req.query.checkout || "";
  const qType = req.query.type || "Full Villa";
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pachapp - Booking</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:linear-gradient(180deg,#2f9fe0 0%,#2f9fe0 28%,#2e8b57 68%,#1f7a4a 100%);min-height:100vh;padding:18px 12px 28px}
    .card{max-width:560px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.28)}
    .banner{background:linear-gradient(180deg,#38a8e8 0%,#2e9a7a 55%,#2e8b57 100%);padding:28px 18px 22px;text-align:center}
    .logo{font-family:'Segoe Script','Brush Script MT',cursive;font-size:54px;line-height:1;letter-spacing:2px;color:#6a7d1f;text-shadow:0 1px 0 rgba(255,255,255,.7);transform:scaleY(1.18);display:block}
    .be{font-family:Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:8px;color:#111;margin-top:2px;text-transform:lowercase}
    .addr{font-size:12px;color:#fff;margin-top:10px;letter-spacing:.4px;opacity:.95}
    .sub{margin-top:14px;display:inline-block;background:rgba(255,255,255,.22);color:#fff;font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px}
    .body{padding:20px 20px 22px}
    .step{font-size:11px;font-weight:800;letter-spacing:1.2px;color:#2e8b57;margin:20px 0 8px;text-transform:uppercase}
    .step:first-child{margin-top:0}
    label{font-size:13px;font-weight:700;display:block;margin:12px 0 6px;color:#222}
    input,select{width:100%;padding:13px 12px;border:1.5px solid #e2e2e2;border-radius:12px;font-size:15px;background:#fbfbfb;outline:none}
    input:focus,select:focus{border-color:#2e8b57;background:#fff}
    .row{display:flex;gap:12px}.row>div{flex:1}
    .hint{font-size:12px;color:#777;margin-top:6px;line-height:1.5}
    .bfFree{display:none;background:#eaf7ee;border:1px solid #bfe6c8;color:#1a6b3a;padding:12px;border-radius:12px;font-size:13px;font-weight:700;margin-top:10px}
    .total{margin-top:18px;background:linear-gradient(180deg,#eaf7ee,#dff2e6);border:1px solid #2e8b57;border-radius:14px;padding:14px;width:50%;min-width:210px}
    .total .lbl{font-size:11px;font-weight:800;letter-spacing:1px;color:#2e8b57}
    .total b{font-size:22px;color:#111}
    .total .small{font-size:12px;color:#555;margin-top:4px;line-height:1.5}
    button{width:100%;padding:15px;border:0;border-radius:13px;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px}
    .pay{background:#2e8b57;color:#fff;box-shadow:0 8px 18px rgba(46,139,87,.35)}
    .confirm{background:#111;color:#fff}
    #qrBox{display:none;text-align:center;margin-top:14px;border:1.5px dashed #9a9a9a;padding:16px;border-radius:14px;background:#fffdf0}
    #msg{font-size:13px;color:#222;margin-top:12px;line-height:1.5;font-weight:600}
    .rule{font-size:12px;color:#555;background:#f6f6f6;padding:11px;border-radius:11px;line-height:1.6;margin-top:8px}
    @media(max-width:480px){.logo{font-size:46px}.row{flex-direction:column;gap:0}.total{width:100%}}
  </style></head><body><div class="card">
  <div class="banner"><span class="logo">Pachapp</span><div class="be">be nowhere</div><div class="addr">Lucky Hill, Meppadi, Wayanad, Kerala</div><div class="sub">Pool Villa Booking</div></div>
  <div class="body">
  <div class="step">Step 1 &mdash; Booking Type</div>
  <label>Booking Type</label><select id="type"><option ${qType==="Full Villa"?"selected":""}>Full Villa</option><option ${qType==="Separate"?"selected":""}>Separate</option></select>
  <div class="step">Step 2 &mdash; Dates</div><div class="row"><div><label>Check-in</label><input type="date" id="checkin" value="${qCheckin}"></div><div><label>Check-out</label><input type="date" id="checkout" value="${qCheckout}"></div></div><div id="nightsText" class="hint"></div>
  <div class="step">Step 3 &mdash; Guests</div><div class="row"><div><label>Adults (1-20)</label><input type="number" id="adults" min="1" max="20" value="2"></div><div><label>Kids below 6 (free)</label><input type="number" id="kids" min="0" max="20" value="0"></div></div>
  <div class="step">Step 4 &mdash; Rooms &amp; Breakfast</div><label>Rooms</label><select id="rooms"><option>1</option><option>2</option><option>3</option><option>4</option></select><div id="roomHint" class="hint"></div>
  <div id="bfWrap"><label>Breakfast &mdash; Rs.100 each (only for Separate)</label><select id="breakfast"><option value="0">No Breakfast</option><option value="1">1 Breakfast</option><option value="2">2 Breakfast</option><option value="3">3 Breakfast</option><option value="4">4 Breakfast</option><option value="6">6 Breakfast</option><option value="8">8 Breakfast</option></select></div>
  <div id="bfFree" class="bfFree">Breakfast included FREE with Full Villa</div>
  <div class="step">Step 5 &mdash; Your Details</div><label>Guest Name</label><input id="name" placeholder="Full name"><label>Phone</label><input id="phone" placeholder="10 digit phone"><label>Notes (optional)</label><input id="notes" placeholder="Any request">
  <div class="total"><div class="lbl">GRAND TOTAL</div><b id="totalText">Rs.0</b><div id="advText" class="small"></div><div id="perNight" class="small"></div></div>
  <div class="step">Step 6 &mdash; Pay &amp; Confirm</div>
  <div class="rule">Pay before confirm: Fill form, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. No payment / No UTR = Pending - Waiting for Advance, not Confirmed.</div>
  <button class="pay" onclick="showQR()">Pay Advance - Show QR Code</button>
  <div id="qrBox"><p style="font-weight:800;margin:0">Scan and Pay Advance</p><p style="font-size:13px;color:#666">QR Code will be shown by owner - please ask for QR on WhatsApp if not visible</p><p id="qrAmt" style="font-weight:800"></p></div>
  <label>UTR / Transaction ID (after payment)</label><input id="utr" placeholder="Enter UTR, e.g. TEST123">
  <button class="confirm" onclick="confirmBooking()">I Have Paid - Confirm My Booking</button>
  <p id="msg"></p>
  </div></div>
  <script>
  const typeEl=document.getElementById('type'), checkinEl=document.getElementById('checkin'), checkoutEl=document.getElementById('checkout'), adultsEl=document.getElementById('adults'), roomsEl=document.getElementById('rooms'), bfEl=document.getElementById('breakfast'), totalText=document.getElementById('totalText'), advText=document.getElementById('advText'), perNight=document.getElementById('perNight'), nightsText=document.getElementById('nightsText'), roomHint=document.getElementById('roomHint');
  function calc(){
    const type=typeEl.value; const ci=new Date(checkinEl.value); const co=new Date(checkoutEl.value);
    let nights=1; if(checkinEl.value && checkoutEl.value){ nights=Math.round((co-ci)/86400000); if(nights<1) nights=1; if(nights>7) nights=7; }
    nightsText.textContent = checkinEl.value ? 'Nights: '+nights+'  |  Check-out: '+(checkoutEl.value||'') : 'Select check-in, check-out will auto-show.';
    let adults=parseInt(adultsEl.value||2); if(adults<1) adults=1; if(adults>20) adults=20;
    let autoRooms = adults<=2?1:adults<=4?2:adults<=6?3:adults<=8?4:4;
    let extraBeds = adults>8 ? ' + extra beds for '+(adults-8)+' extra adults' : '';
    if(document.activeElement!==roomsEl) roomsEl.value=autoRooms;
    roomHint.textContent='Suggested for '+adults+' adults: '+autoRooms+' rooms'+extraBeds+' (you can change manually)';
    let isWeekend=false; if(checkinEl.value){ const d=ci.getDay(); if(d===0||d===6) isWeekend=true; }
    let perNightVal=0; if(type==='Full Villa'){ if(isWeekend) perNightVal=8000; else perNightVal=6400; } else { perNightVal=parseInt(roomsEl.value)*1600; if(adults>8) perNightVal+=(adults-8)*800; }
    let bfCount = type==='Full Villa'?0:parseInt(bfEl.value||0); let bfAmt = bfCount*100;
    let total = perNightVal*nights + bfAmt;
    let advance = total>10000?Math.round(total*0.2): total>0?2000:0; if(type!=='Full Villa' && adults<=2 && nights===1) advance=1600;
    totalText.textContent='Rs.'+total; advText.textContent='Advance to pay: Rs.'+advance; perNight.textContent='Per night: Rs.'+perNightVal+'  |  Breakfast: Rs.'+bfAmt;
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

    // OWNER COMMANDS
    if (sender === OWNER_NUMBER) {
      const low = text.toLowerCase();
      if (low === "pause ai") { AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "AI paused. Send RESUME AI to start."); return; }
      if (low === "resume ai") { AI_PAUSED = false; GROUP_AI_PAUSED = false; await sendWhatsApp(OWNER_NUMBER, "AI resumed."); return; }
      if (low === "pause group ai") { GROUP_AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "Group AI paused. Guest DM still working."); return; }
      if (isGroup) { groupPause[chatId] = Date.now(); return; }
      return;
    }

    if (AI_PAUSED) return;
    if (manualPause[chatId] && Date.now() - manualPause[chatId] < 60*60*1000) return;

    // ===== GROUP / AGENTS - SILENT, NO REPLY - FOR YOUR TESTING =====
    if (isGroup) {
      return; // Group AI is paused, do not talk to agents from group
    }

    // GUEST DM ONLY
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
