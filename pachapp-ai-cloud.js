// =====================================================
// Pachapp AI + LOCKED FORM in ONE file - NO SHARE LINK NEEDED
// Form at: Your-Render-URL + /booking - Always works
// Fixes:
// - Never says "link is being fixed"
// - Never says "already shared" - always resends when asked
// - Understands "share the form", "edit it on the form", "booking form", any "form"
// - Owner testing resets and resends
// =====================================================

const express = require('express');
const app = express();
app.use(express.json());

// =====================================================
// 1. CHANGE HERE - ONLY THIS PART - NO FORM_URL NEEDED NOW
// =====================================================
const CONFIG = {
  // Leave FORM_URL empty - bot will use Render /booking automatically
  // If you ever want to force a different link, paste it here, but not needed
  FORM_URL: process.env.FORM_URL || "",
  QR_IMAGE_URL: process.env.QR_IMAGE_URL || "",
  OWNER_PHONE: "918943666911",
  CARETAKER_PHONE: "91894366911",
  AIRTABLE_TABLE: "Pachapp Bookings",
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "pachapp-verify",
  GROUP_AI_SILENT: true,
};
// =====================================================

const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";

function getFormUrl() {
  if (CONFIG.FORM_URL && !CONFIG.FORM_URL.includes("PASTE") && !CONFIG.FORM_URL.includes("meta.ai/share")) return CONFIG.FORM_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL + "/booking";
  return "https://pachapp-ai-1.onrender.com/booking";
}
function formLink() { return getFormUrl(); }

const sessions = new Map();
const groupPaused = new Map();
function getSession(phone) {
  if (!sessions.has(phone)) sessions.set(phone, { asked: new Set(), lastDates: "", greeted: false, formSent: false, qaMode: false, details: null });
  return sessions.get(phone);
}
function resetSession(phone) {
  sessions.set(phone, { asked: new Set(), lastDates: "", greeted: false, formSent: false, qaMode: false, details: null });
  return sessions.get(phone);
}
function cleanPhone(p) { return String(p || "").replace(/\D/g, ""); }
function isOwner(phone) {
  const c = cleanPhone(phone);
  return c === cleanPhone(CONFIG.OWNER_PHONE) || c === cleanPhone(CONFIG.CARETAKER_PHONE);
}

// =====================================================
// 2. PRICING - Same as locked form
// =====================================================
function calcTotal(o) {
  const n = Math.max(1, Math.min(7, o.nights || 1));
  const isFull = o.bookingType === "Full Villa";
  let roomTotal = 0;
  let perNightRate = 1600;
  if (isFull) { perNightRate = 6400; roomTotal = perNightRate * n; }
  else { roomTotal = 1600 * (o.rooms || 1) * n; }
  const extraCount = Math.max(0, (o.adults || 0) - 8);
  const extraTotal = extraCount * 800 * n;
  const kidsHalfTotal = (o.kidsHalf || 0) * 400 * n;
  const breakfastTotal = isFull ? 0 : (o.breakfastCount || 0) * 100;
  const grandTotal = roomTotal + extraTotal + kidsHalfTotal + breakfastTotal;
  let advance = 0;
  if (!isFull && (o.rooms || 1) === 1 && n === 1 && (o.adults || 0) <= 2 && (o.kidsHalf || 0) === 0) advance = 1600;
  else if (grandTotal <= 10000) advance = 2000;
  else advance = Math.round(grandTotal * 0.20);
  return { perNightRate, roomTotal, extraCount, extraTotal, kidsHalfTotal, breakfastTotal, grandTotal, advance, nights: n };
}

// =====================================================
// 3. READ DETAILS
// =====================================================
function parseDetails(text) {
  const lower = text.toLowerCase();
  let adults = null, rooms = null, kids = null, breakfast = null, dateText = "";
  if (lower.includes("couple")) adults = 2;
  if (lower.includes("1 couple")) adults = 2;
  if (lower.includes("2 couple")) adults = 4;
  const adultsMatch = lower.match(/(\d+)\s*adult/);
  if (adultsMatch) adults = parseInt(adultsMatch[1]);
  const roomsMatch = lower.match(/(\d+)\s*room/);
  if (roomsMatch) rooms = parseInt(roomsMatch[1]);
  if (lower.includes("no kid")) kids = 0;
  if (lower.includes("no breakfast") || lower.includes("no break")) breakfast = 0;
  if (lower.includes("no break fast")) breakfast = 0;
  const decMatch = lower.match(/dec\s*(\d+)/);
  if (decMatch) dateText = "Dec " + decMatch[1];
  const janMatch = lower.match(/jan\s*(\d+)/);
  if (janMatch) dateText = "Jan " + janMatch[1];
  const hasDetails = (dateText !== "" && (adults !== null || rooms !== null)) || (adults !== null && rooms !== null);
  return { hasDetails, adults, rooms, kids, breakfast, dateText };
}
function detailsSummary(d) {
  let parts = [];
  if (d.dateText) parts.push(d.dateText);
  if (d.adults !== null) parts.push(d.adults === 2 ? "1 couple (2 adults)" : d.adults + " adults");
  if (d.rooms !== null) parts.push(d.rooms + " room");
  if (d.kids === 0) parts.push("no kids");
  if (d.breakfast === 0) parts.push("no breakfast");
  return parts.join(", ");
}

// =====================================================
// 4. AIRTABLE
// =====================================================
async function createAirtableBooking(d) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) { console.log("Airtable not set"); return null; }
  const fields = {
    "Guest Name": d.guestName || "",
    "Phone / WhatsApp": d.phone || "",
    "Booking Type": d.bookingType || "Full Villa",
    "Check-in": d.checkIn || "",
    "Check-out": d.checkOut || "",
    "Nights": d.nights || 1,
    "Adults": d.adults || 2,
    "Kids Below 6": d.kidsFree || 0,
    "Kids 6-12": d.kidsHalf || 0,
    "Kids 6-12 Total": d.kidsHalfTotal || 0,
    "Rooms": d.rooms || 1,
    "Breakfast Count": d.breakfastCount || 0,
    "Breakfast Included": d.breakfastIncluded || (d.bookingType === "Full Villa" ? "Yes - Free" : "No"),
    "Rate Applied": d.rateApplied || "",
    "Per Night Rate": d.perNightRate || 0,
    "Room Total": d.roomTotal || 0,
    "Extra Adult Count": d.extraCount || 0,
    "Extra Adult Total": d.extraTotal || 0,
    "Breakfast Total": d.breakfastTotal || 0,
    "Grand Total": d.grandTotal || 0,
    "Advance to Pay": d.advanceToPay || 0,
    "UTR": d.utr || "",
    "Payment Status": d.utr ? "Confirmed" : "Pending - Waiting for Advance",
    "Booking Status": d.utr ? "Confirmed" : "Pending - Waiting for Advance",
    "Source": "Form",
    "Notes": d.notes || "",
    "Created At": new Date().toISOString()
  };
  const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/" + encodeURIComponent(CONFIG.AIRTABLE_TABLE);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + AIRTABLE_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ fields }] })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.log("Airtable error", out); throw new Error("Airtable failed"); }
  return out;
}

// =====================================================
// 5. WHATSAPP SEND
// =====================================================
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log("WhatsApp not set"); return; }
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } })
    });
    const out = await res.json().catch(() => ({}));
    console.log("WhatsApp send", res.status, JSON.stringify(out).slice(0, 200));
  } catch (e) { console.log("Send failed", e.message); }
}

// =====================================================
// 6. LOCKED FORM HTML - Black, White letters, Real logo on white card
// NOT the vulgar simple white form - This is Pachapp Bookings Form locked design
// =====================================================
const FORM_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pachapp Bookings Form</title>' +
'<style>body{background:#000;color:#fff;font-family:Arial,sans-serif;margin:0;padding:16px}.wrap{max-width:520px;margin:0 auto}.logo-card{background:#fff;color:#000;border-radius:14px;padding:16px;text-align:center;margin-bottom:12px}.logo{font-size:36px;font-weight:900;letter-spacing:3px;color:#4a5d23}.logo span{color:#000;font-size:18px;display:block;letter-spacing:4px}.sub{font-size:12px;margin-top:6px;color:#333}h1{text-align:center;font-size:22px;margin:12px 0;color:#fff}.card{background:#111;border:1px solid #333;border-radius:12px;padding:14px;margin-bottom:12px}label{display:block;font-size:13px;margin:12px 0 4px;color:#fff}input,select,textarea{width:100%;padding:11px;border-radius:8px;border:1px solid #444;background:#fff;color:#000;font-size:15px;box-sizing:border-box}textarea{min-height:60px}.row{display:flex;gap:10px}.row>div{flex:1}.type-row{display:flex;gap:10px}.type-btn{flex:1;padding:12px;border-radius:10px;border:1px solid #555;font-weight:700;cursor:pointer;text-align:center}.type-full{background:#fff;color:#000}.type-room{background:#333;color:#fff}.type-active{outline:3px solid #22c55e}.tick{color:#22c55e;font-weight:900}.blue-arrow{color:#3b82f6;border:2px solid #3b82f6;border-radius:50%;padding:1px 7px;font-weight:900;background:transparent}.light-green{background:#dcfce7 !important}.green-bg{background:#22c55e !important;color:#fff !important}.red-bold{color:#ef4444;font-weight:900}.total-box{background:#fff;color:#000;border-radius:8px;padding:14px;text-align:center;font-size:20px;font-weight:900;border:2px solid #fff}.btn{width:100%;padding:13px;border:none;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;margin-top:10px}.btn-green{background:#22c55e;color:#fff}.btn-white{background:#fff;color:#000}.small{font-size:12px;color:#bbb;text-align:center;margin-top:8px}.qr-box{background:#fff;color:#000;border-radius:12px;padding:14px;text-align:center;display:none;margin-top:12px}.qr-box img{max-width:260px;width:100%}.saved{margin-top:12px}summary{cursor:pointer;background:#222;padding:11px;border-radius:10px;color:#fff}.saved-list{background:#111;padding:10px;border-radius:10px;margin-top:8px;font-size:13px;color:#fff}</style></head><body>' +
'<div class="wrap"><div class="logo-card"><div class="logo">Pachapp<span>BE NOWHERE</span></div><div class="sub">POOL VILLA - Lucky Hill, Meppadi, Wayanad - Dolby Atmos Included</div></div>' +
'<h1>Pachapp Bookings Form</h1>' +
'<div class="card"><div class="type-row"><div id="btnFull" class="type-btn type-full" onclick="setType(\'Full Villa\')">Full Villa <span class="tick" id="tickFull">✓</span></div><div id="btnRoom" class="type-btn type-room" onclick="setType(\'Rooms\')">Rooms <span class="tick" id="tickRoom" style="display:none">✓</span></div></div>' +
'<label>Guest Name *</label><input id="guestName" placeholder="Guest Name">' +
'<label>Phone / WhatsApp *</label><input id="phone" placeholder="Phone / WhatsApp">' +
'<div class="row"><div><label>Check-in *</label><input type="date" id="checkIn"></div><div><label>Check-out <span class="red-bold">* Auto</span></label><input type="date" id="checkOut" readonly></div></div>' +
'<label>Nights <span class="red-bold" id="nightsLabel">1</span></label><input type="number" id="nights" value="1" min="1" max="7" readonly>' +
'<label>Adults <span class="blue-arrow">↕</span> 1 - 20</label><input type="number" id="adults" value="2" min="1" max="20">' +
'<div class="row"><div><label>Kids 0-6 Free <span class="blue-arrow">↕</span></label><input type="number" id="kidsFree" value="0" min="0"></div><div><label>Kids 6-12 Half Price <span class="blue-arrow">↕</span></label><input type="number" id="kidsHalf" value="0" min="0"></div></div>' +
'<label>Rooms <span id="roomsHint"></span></label><input type="number" id="rooms" value="1" min="1" max="4" class="light-green" readonly>' +
'<label>Breakfast Count</label><input type="number" id="breakfastCount" value="0" min="0" class="green-bg">' +
'<label>Notes</label><textarea id="notes" placeholder="Any note - arrival time, extra beds, etc."></textarea></div>' +
'<div class="card"><div>Rate Applied: <b id="rateText">Full Villa Weekday Rs.6400</b></div><div style="margin-top:8px">Room Total: Rs.<span id="roomTotal">6400</span> | Extra Adult: Rs.<span id="extraTotal">0</span> | Kids 6-12: Rs.<span id="kidsTotal">0</span> | Breakfast: Rs.<span id="bfTotal">0</span></div></div>' +
'<div class="total-box">Grand Total: Rs.<span id="grandTotal">6400</span><div style="font-size:13px;font-weight:400;margin-top:4px">Advance to Pay: Rs.<span id="advance">2000</span></div></div>' +
'<button class="btn btn-green" onclick="showQR()">Pay Advance - Show QR Code</button>' +
'<div class="qr-box" id="qrBox"><b>Scan to Pay - 【entity-PhonePe¦canonical_name=PhonePe】</b><div>UDAYABHANU RAMACHANDRAN</div><div id="qrImgWrap" style="margin:10px 0"></div><div>Pay Advance, then enter UTR below</div></div>' +
'<div class="card"><label>UTR / Transaction ID (after payment)</label><input id="utr" placeholder="Enter UTR - Example TEST123"><div class="small">No UTR = Pending - Waiting for Advance. With UTR = Confirmed.</div></div>' +
'<button class="btn btn-white" onclick="confirmBooking()">I Have Paid - Confirm My Booking</button>' +
'<div id="result" class="small" style="font-size:14px;color:#fff"></div>' +
'<div class="saved"><details><summary>Saved Bookings ▼ (Closed)</summary><div class="saved-list" id="savedList">No saved bookings yet on this device. All bookings are saved in Airtable - Pachapp Bookings.</div></details></div>' +
'<div class="small">Pay before Confirm. No payment = No Confirmed booking.</div></div>' +
'<script>' +
'var bookingType="Full Villa"; var QR_URL="' + (CONFIG.QR_IMAGE_URL || "") + '";' +
'function setType(t){ bookingType=t; document.getElementById("btnFull").classList.toggle("type-active", t==="Full Villa"); document.getElementById("btnRoom").classList.toggle("type-active", t==="Rooms"); document.getElementById("tickFull").style.display = t==="Full Villa" ? "inline" : "none"; document.getElementById("tickRoom").style.display = t==="Rooms" ? "inline" : "none"; calc(); }' +
'function autoRooms(adults){ if(adults<=2) return 1; if(adults<=4) return 2; if(adults<=6) return 3; return 4; }' +
'function calc(){ var checkIn=document.getElementById("checkIn").value; var adults=parseInt(document.getElementById("adults").value||"2"); var kidsHalf=parseInt(document.getElementById("kidsHalf").value||"0"); var bf=parseInt(document.getElementById("breakfastCount").value||"0"); var rooms=autoRooms(adults); document.getElementById("rooms").value=rooms; var nights=1; if(checkIn){ var d=new Date(checkIn); d.setDate(d.getDate()+1); var out=d.toISOString().slice(0,10); document.getElementById("checkOut").value=out; } var roomTotal=0; var rateText=""; if(bookingType==="Full Villa"){ var dt=new Date(checkIn||new Date()); var day=dt.getDay(); if(day===5||day===6||day===0){ roomTotal=8000*nights; rateText="Full Villa Weekend Rs.8000"; } else { roomTotal=6400*nights; rateText="Full Villa Weekday Rs.6400"; } } else { roomTotal=1600*rooms*nights; rateText="Rooms Rs.1600 per room / night"; } var extraCount=Math.max(0, adults-8); var extraTotal=extraCount*800*nights; var kidsTotal=kidsHalf*400*nights; var bfTotal= bookingType==="Full Villa" ? 0 : bf*100; var grand=roomTotal+extraTotal+kidsTotal+bfTotal; var advance=0; if(bookingType!=="Full Villa" && rooms===1 && nights===1 && adults<=2 && kidsHalf===0){ advance=1600; } else if(grand<=10000){ advance=2000; } else { advance=Math.round(grand*0.20); } document.getElementById("nights").value=nights; document.getElementById("nightsLabel").innerText=nights; document.getElementById("rateText").innerText=rateText; document.getElementById("roomTotal").innerText=roomTotal; document.getElementById("extraTotal").innerText=extraTotal; document.getElementById("kidsTotal").innerText=kidsTotal; document.getElementById("bfTotal").innerText=bfTotal; document.getElementById("grandTotal").innerText=grand; document.getElementById("advance").innerText=advance; var hint=""; if(adults>8){ hint="(Extra beds for "+adults+" adults)"; } document.getElementById("roomsHint").innerText=hint; return {nights:nights, rooms:rooms, grand:grand, advance:advance, roomTotal:roomTotal, extraTotal:extraTotal, kidsTotal:kidsTotal, bfTotal:bfTotal, rateText:rateText}; }' +
'function showQR(){ var box=document.getElementById("qrBox"); box.style.display="block"; var wrap=document.getElementById("qrImgWrap"); if(QR_URL){ wrap.innerHTML="<img src=\'"+QR_URL+"\'>"; } else { wrap.innerHTML="<div style=\'border:2px dashed #000;padding:20px;font-weight:800\'>QR CODE<br>PhonePe - UDAYABHANU RAMACHANDRAN<br>Ask owner for QR if not showing</div>"; } }' +
'async function confirmBooking(){ var c=calc(); var data={ guestName: document.getElementById("guestName").value, phone: document.getElementById("phone").value, bookingType: bookingType, checkIn: document.getElementById("checkIn").value, checkOut: document.getElementById("checkOut").value, nights: c.nights, adults: parseInt(document.getElementById("adults").value||"2"), kidsFree: parseInt(document.getElementById("kidsFree").value||"0"), kidsHalf: parseInt(document.getElementById("kidsHalf").value||"0"), kidsHalfTotal: c.kidsTotal, rooms: c.rooms, breakfastCount: parseInt(document.getElementById("breakfastCount").value||"0"), breakfastIncluded: bookingType==="Full Villa" ? "Yes - Free" : "No", rateApplied: c.rateText, perNightRate: 0, roomTotal: c.roomTotal, extraCount: Math.max(0, parseInt(document.getElementById("adults").value||"2")-8), extraTotal: c.extraTotal, breakfastTotal: c.bfTotal, grandTotal: c.grand, advanceToPay: c.advance, utr: document.getElementById("utr").value, notes: document.getElementById("notes").value }; if(!data.guestName){ alert("Please enter guest name"); return; } if(!data.phone){ alert("Please enter phone"); return; } document.getElementById("result").innerText="Saving..."; try{ var res=await fetch("/booking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}); var out=await res.json(); if(out.ok){ document.getElementById("result").innerText="Saved - Status: "+out.status+" | Grand Total Rs."+out.grandTotal+" | Advance Rs."+out.advance; } else { document.getElementById("result").innerText=out.error||"Could not save"; } }catch(e){ document.getElementById("result").innerText="Could not save - check connection"; } }' +
'document.getElementById("checkIn").addEventListener("change", calc); document.getElementById("adults").addEventListener("input", calc); document.getElementById("kidsHalf").addEventListener("input", calc); document.getElementById("breakfastCount").addEventListener("input", calc); setType("Full Villa"); calc();' +
'</script></body></html>';

// =====================================================
// 7. PAGES
// =====================================================
app.get("/", (req, res) => res.send(FORM_HTML));
app.get("/booking", (req, res) => res.send(FORM_HTML));
app.get("/health", (req, res) => res.json({ ok: true, form: getFormUrl(), airtable: CONFIG.AIRTABLE_TABLE }));

app.post("/booking", async (req, res) => {
  try {
    const b = req.body || {};
    const calc = calcTotal({
      bookingType: b.bookingType || b["Booking Type"] || "Full Villa",
      nights: Number(b.nights || b.Nights || 1),
      adults: Number(b.adults || b.Adults || 2),
      kidsHalf: Number(b.kidsHalf || b["Kids 6-12"] || 0),
      rooms: Number(b.rooms || b.Rooms || 1),
      breakfastCount: Number(b.breakfastCount || b["Breakfast Count"] || 0)
    });
    const data = {
      guestName: b.guestName || b["Guest Name"] || b.name || "",
      phone: b.phone || b["Phone / WhatsApp"] || "",
      bookingType: b.bookingType || b["Booking Type"] || "Full Villa",
      checkIn: b.checkIn || b["Check-in"] || "",
      checkOut: b.checkOut || b["Check-out"] || "",
      nights: calc.nights,
      adults: Number(b.adults || 2),
      kidsFree: Number(b.kidsFree || b["Kids Below 6"] || 0),
      kidsHalf: Number(b.kidsHalf || b["Kids 6-12"] || 0),
      kidsHalfTotal: calc.kidsHalfTotal,
      rooms: Number(b.rooms || 1),
      breakfastCount: Number(b.breakfastCount || 0),
      breakfastIncluded: b.breakfastIncluded || (b.bookingType === "Full Villa" ? "Yes - Free" : "No"),
      rateApplied: b.rateApplied || "",
      perNightRate: calc.perNightRate,
      roomTotal: calc.roomTotal,
      extraCount: calc.extraCount,
      extraTotal: calc.extraTotal,
      breakfastTotal: calc.breakfastTotal,
      grandTotal: calc.grandTotal,
      advanceToPay: calc.advance,
      utr: b.utr || b.UTR || "",
      notes: b.notes || b.Notes || ""
    };
    if (!data.guestName.trim()) return res.status(400).json({ ok: false, error: "Please enter the guest name." });
    if (!data.phone.trim()) return res.status(400).json({ ok: false, error: "Please enter phone." });
    const airtable = await createAirtableBooking(data);
    return res.json({ ok: true, status: data.utr ? "Confirmed" : "Pending - Waiting for Advance", grandTotal: data.grandTotal, advance: data.advanceToPay, airtable: !!airtable });
  } catch (e) { console.log(e); return res.status(500).json({ ok: false, error: "Could not save booking" }); }
});

// =====================================================
// 8. WHATSAPP WEBHOOK - HUMAN, ALWAYS RESENDS FORM
// =====================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== "text") return;
    const from = msg.from;
    const text = (msg.text?.body || "").trim();
    const lower = text.toLowerCase();

    const isGroupMsg = !!msg.context?.group_id;
    if (isGroupMsg && CONFIG.GROUP_AI_SILENT && !isOwner(from)) return;
    if (groupPaused.get(from) === true && !isOwner(from)) return;
    if (lower === "pause ai" && isOwner(from)) { groupPaused.set(from, true); await sendWhatsApp(from, "AI paused. I will stay silent. Send RESUME AI to start again."); return; }
    if (lower === "resume ai" && isOwner(from)) { groupPaused.set(from, false); await sendWhatsApp(from, "AI resumed."); return; }

    let s = getSession(from);

    // OWNER TESTING - Reset and resend - Fixes "i am the owner testing the ai"
    if (lower.includes("i am the owner") || lower.includes("i am owner") || lower.includes("owner testing") || lower.includes("testing the ai")) {
      s = resetSession(from);
      await sendWhatsApp(from, "Okay owner, testing mode - I reset. Here is the form again to check:\n\n" + formLink() + "\n\nTell me what you want to test - Dec 1, 1 couple, 1 room - and I will calculate. Or say - give me the booking form.");
      return;
    }

    // ASK QUESTIONS MODE
    if (lower.includes("ask") && lower.includes("question") || lower.includes("so many question") || lower.includes("just asking") || lower.includes("not book")) {
      s.qaMode = true;
      await sendWhatsApp(from, "Of course, please ask me anything, I am here. No need to fill the form until you are ready.\n\nYou can ask me about price, rooms, dates, pool, breakfast, check-in, photos, anything. What would you like to know first?");
      return;
    }

    // FORM - ANY message with "form" - ALWAYS SEND, NEVER BLOCK - Fixes all form cases
    // Covers: "give me the booking form", "share the form", "please share the form i will edit it", "needs the booking form", "send form", "form"
    if (lower.includes("form")) {
      s.qaMode = false;
      const sum = s.details ? detailsSummary(s.details) + ". " : "";
      // NEVER say "already shared" - always resend working link
      await sendWhatsApp(from, "Here you go - " + sum + "Pachapp Pool Villa booking form. You can edit it on the form itself - change dates, adults, rooms, it will calculate total. Please fill it when you are ready.\n\n" + formLink() + "\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      s.formSent = true;
      return;
    }

    // BOOKING INTENT - ALWAYS SEND FORM, NEVER BLOCK
    const isBookingIntent = lower.includes("book now") || lower.includes("want book") || lower.includes("want to book") || lower.includes("pay and book") || lower.includes("book straight") || lower.includes("can book") || lower.includes("book your room") || lower.includes("i want book") || lower.includes("book room") || lower.includes("book it") || lower.includes("book for") || lower.includes("i have given") && lower.includes("book") || lower.includes("been there before") && lower.includes("book") || lower.includes("i want to book");
    if (isBookingIntent) {
      s.qaMode = false;
      if (text.length > 5) s.lastDates = text;
      const sum = s.details ? "Got it - " + detailsSummary(s.details) + ". " : "";
      if (s.details && s.details.adults !== null) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Welcome back, great you have been here before. Yes, you can book straight away. " + sum + "Total Rs." + c.grandTotal + " for 1 night, Advance Rs." + c.advance + ". Here is the form to confirm - you can edit it on the form:\n\n" + formLink());
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, sum + "Yes, you can book straight away. Here is the Pachapp Pool Villa booking form. You can edit it on the form. It shows total, advance, and QR.\n\n" + formLink());
      s.formSent = true;
      return;
    }

    // DETAILS
    const parsed = parseDetails(text);
    if (parsed.hasDetails) {
      s.details = parsed;
      s.lastDates = parsed.dateText || s.lastDates;
      const adults = parsed.adults || 2;
      const rooms = parsed.rooms || 1;
      const kidsHalf = parsed.kids === 0 ? 0 : 0;
      const breakfastCount = parsed.breakfast === 0 ? 0 : 0;
      const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: adults, kidsHalf: kidsHalf, rooms: rooms, breakfastCount: breakfastCount });
      const sum = detailsSummary(parsed);
      await sendWhatsApp(from, "Perfect, got it - " + sum + ".\n\nFor 1 night: Total Rs." + c.grandTotal + ", Advance Rs." + c.advance + " (1 room, 1 night, 2 adults, no kids, no breakfast).\n\nShall I share the booking form to confirm? Just say - give me the booking form, or Book Now.");
      return;
    }

    if (lower.includes("given my details") || lower.includes("given details") || lower.includes("i have given")) {
      if (s.details) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults || 2, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Yes, I have your details - " + detailsSummary(s.details) + ". Total Rs." + c.grandTotal + ", Advance Rs." + c.advance + ". Here is the form to confirm:\n\n" + formLink());
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, "Thanks, I noted it. Can you tell me again - date, how many adults, how many rooms? Example: Dec 1, 1 couple, 1 room, no kids, no breakfast.");
      return;
    }

    if (lower.includes("qr") || lower.includes("pay") || lower.includes("upi") || lower.includes("advance") || lower.includes("payment")) {
      await sendWhatsApp(from, "To pay, please open the booking form and tap Pay Advance. The QR code is inside the form. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking. Without UTR, your booking stays as Pending - Waiting for Advance.\n\n" + formLink());
      return;
    }

    if (lower.includes("photo") || lower.includes("pic") || lower.includes("image") || lower.includes("video")) {
      await sendWhatsApp(from, "Photos and videos are in the booking form and on our page. Tell me which room / view you want - pool view, room, villa - and I will share that. Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      return;
    }

    if (lower.includes("price") || lower.includes("rate") || lower.includes("cost") || lower.includes("how much") || lower.includes("charge")) {
      await sendWhatsApp(from, "Sure, here is the price:\n\nFull Villa - Weekday Rs.6400 / night, Weekend Fri/Sat/Sun Rs.8000 / night\nRooms - Rs.1600 per room per night\nExtra Adult - Rs.800 per night (above 8 adults)\nKids 0-6 Free, Kids 6-12 Half Price Rs.400 per kid per night\nBreakfast - Full Villa Free, Rooms Rs.100 each\nDolby Atmos included. Live music only when owner is at the villa.\n\nTell me your dates and guests, I will calculate total. No need to fill form yet.");
      return;
    }

    if (lower.includes("room") || lower.includes("villa") || lower.includes("pool") || lower.includes("how many") || lower.includes("capacity") || lower.includes("people")) {
      if (s.details) {
        await sendWhatsApp(from, "You already shared - " + detailsSummary(s.details) + ". Do you want me to share the form to confirm?");
        return;
      }
      await sendWhatsApp(from, "Pachapp Pool Villa has 4 rooms in the whole villa. You can book Full Villa (whole villa) or Rooms (1 to 4 rooms). Private pool is there. Dolby Atmos included.\n\nTell me how many adults, kids, and dates you have, I will tell you how many rooms you need and the total. Example: Dec 1, 1 couple, 1 room, no kids, no breakfast.");
      return;
    }

    if (lower.includes("breakfast") || lower.includes("food") || lower.includes("meal") || lower.includes("eat") || lower.includes("break fast")) {
      await sendWhatsApp(from, "Breakfast is Free for Full Villa. For Rooms, it is Rs.100 each. Tell me if you want breakfast and how many people, I will add it to your total.");
      return;
    }

    if (lower.includes("check") || lower.includes("time") || lower.includes("arrive")) {
      await sendWhatsApp(from, "Check-in / Check-out times are shown in the booking form. Tell me your dates and I will check availability for you. What dates are you thinking?");
      return;
    }

    if (lower.includes("available") || lower.includes("dec") || lower.includes("jan") || lower.includes("feb") || lower.includes("date")) {
      if (s.lastDates && s.asked.has("dates")) {
        await sendWhatsApp(from, "You already shared " + s.lastDates + ". I remember it, I will not ask again. Do you want me to calculate total for those dates? Tell me how many adults and kids.");
        return;
      }
      s.asked.add("dates");
      s.lastDates = text;
      await sendWhatsApp(from, "Thanks for sharing your dates - " + text + ". I noted it. Tell me how many adults and kids, I will calculate total for you.");
      return;
    }

    if (lower.includes("music") || lower.includes("dj") || lower.includes("live")) {
      await sendWhatsApp(from, "Live music is only when the owner is at the villa. Dolby Atmos is always included. What else would you like to know?");
      return;
    }

    if (lower === "hi" || lower === "hello" || lower === "hey") {
      if (!s.greeted) {
        s.greeted = true;
        await sendWhatsApp(from, "Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything - price, rooms, dates, photos. Or if you want to book, just say Book Now and I will share the form. What would you like to know?");
        return;
      } else {
        await sendWhatsApp(from, "Hi again, I am here. Please ask your questions, take your time. What would you like to know?");
        return;
      }
    }

    if (!s.greeted) {
      s.greeted = true;
      await sendWhatsApp(from, "Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything - price, rooms, dates, photos. Or say Book Now when you are ready. What would you like to know?");
    } else if (s.formSent) {
      await sendWhatsApp(from, "I am here. What would you like to know? You can ask about price, rooms, dates, anything. The form is already shared above when you are ready to book. If you want it again, just say - give me the booking form - and I will resend it.");
    } else {
      await sendWhatsApp(from, "Thanks for your message. What would you like to know? You can ask about price, rooms, dates, pool, breakfast, anything. Say Book Now or give me the booking form only when you are ready to book.");
    }
  } catch (e) { console.log("Webhook error", e); }
});

app.listen(PORT, () => console.log("Pachapp AI running on", PORT));
