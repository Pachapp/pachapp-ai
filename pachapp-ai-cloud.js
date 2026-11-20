// ===== PACHAPP POOL VILLA - WHOLE FINAL CODE =====
// Guest AI = Full human way | Group AI = PAUSED | Memory Fix | Pay Before Confirm | Form -> Airtable
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "606463179209554";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "pachapp123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const FORM_URL = process.env.FORM_URL || "";
const OWNER_NUMBER = "918943666911";
const BOT_NUMBER = "971529100668";
const CARETAKER = "0091 894366911";

// ===== DRIVE LINKS - REPLACE WITH YOUR REAL DRIVE LINKS =====
const DRIVE = {
  MAIN: "YOUR_MAIN_DRIVE_LINK",
  OUTDOOR: "YOUR_OUTDOOR_DRIVE_LINK",
  POOL: "YOUR_POOL_DRIVE_LINK",
  ROOMS: "YOUR_ROOMS_DRIVE_LINK",
  QR: "YOUR_QR_CODE_DRIVE_LINK"
};

// ===== LIVE PAUSE FLAGS =====
let AI_PAUSED = false;
let GROUP_AI_PAUSED = true;
const manualPause = {};
const groupPause = {};

// ===== MEMORY - STOPS REPEATED QUESTIONS =====
const guestMemory = {};

function extractDetails(phone, text) {
  if (!guestMemory[phone]) guestMemory[phone] = {};
  const m = guestMemory[phone];
  const low = text.toLowerCase();
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

// ===== PRICING =====
function getPrice(type, adults, nights, isWeekend, isFestival) {
  let perNight = 0;
  if (type === "Full Villa") {
    if (isFestival) perNight = 9600;
    else if (isWeekend) perNight = 8000;
    else perNight = 6400;
  } else {
    let rooms = adults <= 2 ? 1 : adults <= 4 ? 2 : 3;
    perNight = rooms * 1600;
    if (adults > 8) perNight += (adults - 8) * 800;
  }
  let total = perNight * nights;
  let advance = 0;
  if (total > 10000) advance = Math.round(total * 0.2);
  else if (total > 0) advance = 2000;
  if (type !== "Full Villa" && adults <= 2 && nights === 1) advance = 1600;
  return { perNight, total, advance, rooms: type === "Full Villa" ? 4 : (adults <= 2 ? 1 : adults <= 4 ? 2 : 3) };
}

// ===== SEND WHATSAPP =====
async function sendWhatsApp(to, text) {
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } })
  });
}

// ===== AIRTABLE - FORM -> AIRTABLE =====
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

app.post("/api/booking", async (req, res) => {
  try {
    const booking = req.body;
    const result = await saveToAirtable(booking);
    await sendWhatsApp(OWNER_NUMBER, `New booking: ${booking.name}, ${booking.checkin}, ${booking.adults} adults, Total Rs.${booking.total}, Advance Rs.${booking.advance}, Status: ${result.status}`);
    res.json({ ok: true, status: result.status });
  } catch (e) { console.log("Airtable error", e); res.json({ ok: false }); }
});

// ===== AI - GUEST HUMAN WAY WITH MEMORY RULE =====
async function callAI(guestText, mem) {
  const prompt = `You are Pachapp Pool Villa assistant. Reply in guest's same language and script.
CRITICAL MEMORY RULES:
- Guest already gave: Check-in ${mem.checkin || "not yet"}, Check-out ${mem.checkout || "not yet"}, Type ${mem.type || "not yet"}, Adults ${mem.adults || "not yet"}. NEVER ask again for what is already given.
- If guest says book now, pay now, dont confuse me, no time to waste - DO NOT ASK ANY QUESTION. The system will send form directly, you must not ask.
- Ask MAX 1 question at a time. Never ask 3 questions together. If guest is angry, apologize in 1 line and send form.
- Be warm, human, versatile, never same template. Do NOT invent numbers, room names, dates.
Facts: 4 rooms, 8 adults + 8 kids below 6 free, capacity up to 20 with extra beds.
Pricing: Full Villa weekday Rs.6400, weekend Rs.8000, festival Rs.9600. Separate: 1 room Rs.1600, 2 rooms Rs.3200, 3 rooms Rs.4800. Extra adult Rs.800. Breakfast free with Full Villa, Rs.100 each for Separate.
Advance: 1 room Rs.1600, up to Rs.10000 min Rs.2000, over Rs.10000 20%.
Music: Dolby Atmos always available. Live music only if owner Uday Hue is at villa - he is musician, composer, poet, singer, chance to hear his original compositions.
Caretaker Sreejith: ${CARETAKER}. Owner Uday Hue: ${OWNER_NUMBER}.
Photos: Send ONLY if guest explicitly asks. Use Drive links only, no Imgur. Main: ${DRIVE.MAIN}, Outdoor/Activities: ${DRIVE.OUTDOOR}, Pool: ${DRIVE.POOL}, Rooms: ${DRIVE.ROOMS}.
QR: Send ONLY if guest asks for paying. Send instantly then: ${DRIVE.QR}. Do NOT send QR automatically.
Booking: Pay Before Confirm. No payment = Pending, not Confirmed. If guest fills form but no UTR, say Pending. If guest sends UTR, say Confirmed. If guest wants to book, send form link: ${FORM_URL}.
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

// ===== WEBHOOK VERIFY =====
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// ===== WEBHOOK - MESSAGES =====
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;
    const sender = msg.from;
    const text = (msg.text?.body || "").trim();
    const isGroup = msg.from.endsWith("@g.us") || !!msg.context?.group_id;
    const chatId = sender;

    // Owner commands - Live Pause
    if (sender === OWNER_NUMBER || sender === BOT_NUMBER) {
      const low = text.toLowerCase();
      if (low === "pause ai") { AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "AI paused. I will not reply now. Send RESUME AI to start."); return; }
      if (low === "resume ai") { AI_PAUSED = false; GROUP_AI_PAUSED = false; await sendWhatsApp(OWNER_NUMBER, "AI resumed. I will reply to guests now."); return; }
      if (low === "pause group ai") { GROUP_AI_PAUSED = true; await sendWhatsApp(OWNER_NUMBER, "Group AI paused. Guest DM AI still working."); return; }
      if (isGroup) groupPause[chatId] = Date.now();
      return;
    }

    if (AI_PAUSED) return;
    if (manualPause[chatId] && Date.now() - manualPause[chatId] < 60*60*1000) return;

    // GROUP / AGENT - PAUSED + LIMITED
    if (isGroup) {
      if (GROUP_AI_PAUSED) return;
      if (groupPause[chatId] && Date.now() - groupPause[chatId] < 60*60*1000) return;
      await sendWhatsApp(sender, `Date: ${text}\nRooms: As per guests\nPrice: Please share guests/date for exact price`);
      return;
    }

    // GUEST DM - MEMORY + BOOK NOW FIX
    let guestText = text;
    if (msg.type === "audio") guestText = text || "Guest sent voice note";
    const mem = extractDetails(sender, guestText);
    const lower = guestText.toLowerCase();
    const wantsToBook = lower.includes("book now") || lower.includes("pay and book") || lower.includes("i want to pay") || lower.includes("dont confuse") || lower.includes("don't confuse") || lower.includes("no time to waste") || lower.includes("i want to book it now");

    if (wantsToBook) {
      const link = `${FORM_URL}?checkin=${mem.checkin || ""}&checkout=${mem.checkout || ""}&type=${encodeURIComponent(mem.type || "Full Villa")}`;
      await sendWhatsApp(sender, `Sorry, no more questions. Here is your booking form, already filled for you:\n${link}\n\nAfter filling, tap Pay Advance - Show QR Code, pay, enter UTR, tap I Have Paid - Confirm My Booking. Your booking will be Confirmed.`);
      return;
    }

    const aiReply = await callAI(guestText, mem);
    await sendWhatsApp(sender, aiReply);
  } catch (e) { console.log(e); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Pachapp AI live on " + PORT));
