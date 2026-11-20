// =====================================================
// Pachapp AI - FULL CODE - COPY WHOLE FILE - NO EDIT NEEDED
// FORM_URL already set to your beautiful form link below
// Warm, human, remembers details - NOT blunt
// =====================================================

const 【entity-express¦canonical_name=express】 = require('【entity-express¦canonical_name=express】');
const app = 【entity-express¦canonical_name=express】();
app.use(【entity-express¦canonical_name=express】.json());

// =====================================================
// 1. CONFIG - ALREADY SET - DO NOT EDIT
// =====================================================
const CONFIG = {
  FORM_URL: process.env.FORM_URL || "https://www.meta.ai/share/a/b70443aa-2c84-4d7c-bd75-33bae9dbe5d0",
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
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

function isFormUrlSet() {
  return CONFIG.FORM_URL && !CONFIG.FORM_URL.includes("PASTE_YOUR") && CONFIG.FORM_URL.startsWith("http");
}
function formLink() { return isFormUrlSet() ? CONFIG.FORM_URL : ""; }

// ---------- Sessions ----------
const sessions = new Map();
const groupPaused = new Map();
function getSession(phone) {
  if (!sessions.has(phone)) sessions.set(phone, { asked: new Set(), lastDates: "", greeted: false, formSent: false, qaMode: false, details: null, guestName: "" });
  return sessions.get(phone);
}
function resetSession(phone) {
  sessions.set(phone, { asked: new Set(), lastDates: "", greeted: false, formSent: false, qaMode: false, details: null, guestName: "" });
  return sessions.get(phone);
}
function cleanPhone(p) { return String(p || "").replace(/\D/g, ""); }
function isOwner(phone) {
  const c = cleanPhone(phone);
  return c === cleanPhone(CONFIG.OWNER_PHONE) || c === cleanPhone(CONFIG.CARETAKER_PHONE);
}
function formatPrice(n) { return "Rs." + Number(n || 0).toLocaleString("en-IN"); }

// ---------- Pricing - LOCKED ----------
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

// ---------- Parse guest details - understands many ways ----------
function parseDetails(text) {
  const lower = text.toLowerCase();
  let adults = null, rooms = null, kids = null, breakfast = null, dateText = "";
  let guestName = "";
  const nameMatch = text.match(/(?:i am|my name is|this is|i'm)\s+([A-Za-z ]{2,30})/i);
  if (nameMatch) guestName = nameMatch[1].trim().split(" ").slice(0, 2).join(" ");

  if (lower.includes("couple")) adults = 2;
  if (lower.includes("1 couple")) adults = 2;
  if (lower.includes("2 couple") || lower.includes("two couple")) adults = 4;
  if (lower.includes("3 couple")) adults = 6;
  const adultsMatch = lower.match(/(\d+)\s*adult/);
  if (adultsMatch) adults = parseInt(adultsMatch[1]);
  const peopleMatch = lower.match(/(\d+)\s*(people|person|guest|pax)/);
  if (peopleMatch && adults === null) adults = parseInt(peopleMatch[1]);
  const roomsMatch = lower.match(/(\d+)\s*room/);
  if (roomsMatch) rooms = parseInt(roomsMatch[1]);
  if (lower.includes("no kid") || lower.includes("without kid") || lower.includes("0 kid")) kids = 0;
  if (lower.includes("no breakfast") || lower.includes("no break") || lower.includes("without breakfast") || lower.includes("no food")) breakfast = 0;
  if (lower.includes("with breakfast") || lower.includes("need breakfast")) breakfast = 1;

  const decMatch = lower.match(/dec(?:ember)?\s*(\d{1,2})/) || lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*dec/);
  if (decMatch) dateText = "Dec " + decMatch[1];
  const janMatch = lower.match(/jan(?:uary)?\s*(\d{1,2})/) || lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*jan/);
  if (janMatch) dateText = "Jan " + janMatch[1];
  const febMatch = lower.match(/feb(?:ruary)?\s*(\d{1,2})/) || lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*feb/);
  if (febMatch) dateText = "Feb " + febMatch[1];
  if (lower.includes("tomorrow")) dateText = "Tomorrow";
  if (lower.includes("today")) dateText = "Today";

  const hasDetails = (dateText !== "" && (adults !== null || rooms !== null)) || (adults !== null && rooms !== null) || (dateText !== "" && lower.includes("book")) || guestName !== "";
  return { hasDetails, adults, rooms, kids, breakfast, dateText, guestName };
}
function detailsSummary(d) {
  let parts = [];
  if (d.dateText) parts.push(d.dateText);
  if (d.adults !== null) parts.push(d.adults === 2 ? "1 couple (2 adults)" : d.adults + " adults");
  if (d.rooms !== null) parts.push(d.rooms + " room" + (d.rooms > 1 ? "s" : ""));
  if (d.kids === 0) parts.push("no kids");
  if (d.breakfast === 0) parts.push("no breakfast");
  return parts.join(", ");
}

// ---------- Airtable ----------
async function createAirtableBooking(d) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) { console.log("Airtable not set"); return null; }
  const fields = {
    "Guest Name": d.guestName || "",
    "Phone / 【entity-WhatsApp¦canonical_name=WhatsApp】": d.phone || "",
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
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + AIRTABLE_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ fields }] }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.log("Airtable error", out); throw new Error("Airtable failed"); }
  return out;
}

// ---------- WhatsApp Send ----------
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log("WhatsApp not set"); return; }
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } })
    });
    const out = await res.json().catch(() => ({}));
    console.log("WhatsApp send", res.status, JSON.stringify(out).slice(0, 300));
  } catch (e) { console.log("Send failed", e.message); }
}

// ---------- Optional Groq for open questions - falls back to warm templates ----------
async function askGroq(userMsg, history) {
  if (!GROQ_API_KEY) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are Pachapp Pool Villa AI Host - warm, humane, creative, not a robot. Villa: Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad, Kerala. Owners Uday Hue, Reshma. Talk about Wayanad, pool, Dolby Atmos. NEVER give price without date. NEVER say let me check calendar, personal/group, routine. Reply in guest language. For direct guests, elaborated humane. Always answer real answer first, then ask which day, how many guests. Pricing: Full Villa Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000, Rooms Rs.1600 per room per night, Extra Adult Rs.800 above 8 adults, Kids 0-6 Free, Kids 6-12 Rs.400, Breakfast Full Villa Free, Rooms Rs.100. Advance: 1 room 1 night 2 adults Rs.1600, else total up to Rs.10000 Rs.2000, else 20%. No UTR = Pending, With UTR = Confirmed. Never invent links. Booking form link is given separately, do not invent a link." },
          ...(history || []).slice(-8),
          { role: "user", content: userMsg }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await res.json().catch(() => ({}));
    return data.choices?.[0]?.message?.content || null;
  } catch (e) { return null; }
}

// ---------- Pages ----------
app.get("/", (req, res) => res.send("Pachapp AI is running"));
app.get("/health", (req, res) => res.json({ ok: true, formSet: isFormUrlSet(), form: isFormUrlSet() ? CONFIG.FORM_URL : "NOT SET", airtable: CONFIG.AIRTABLE_TABLE }));
app.get("/booking", (req, res) => {
  if (isFormUrlSet()) return res.redirect(CONFIG.FORM_URL);
  return res.send("Booking form link is being updated. Please message owner on +91 89436 66911 for the latest form.");
});

app.post("/booking", async (req, res) => {
  try {
    const b = req.body || {};
    const calc = calcTotal({ bookingType: b.bookingType || b["Booking Type"] || "Full Villa", nights: Number(b.nights || b.Nights || 1), adults: Number(b.adults || b.Adults || 2), kidsHalf: Number(b.kidsHalf || b["Kids 6-12"] || 0), rooms: Number(b.rooms || b.Rooms || 1), breakfastCount: Number(b.breakfastCount || b["Breakfast Count"] || 0) });
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
    if (lower === "resume ai" && isOwner(from)) { groupPaused.set(from, false); await sendWhatsApp(from, "AI resumed. Welcome back."); return; }

    let s = getSession(from);

    // --- OWNER TESTING - reset, warm ---
    if (lower.includes("i am the owner") || lower.includes("i am owner") || lower.includes("owner testing") || lower.includes("testing the ai")) {
      s = resetSession(from);
      await sendWhatsApp(from, "Okay owner, testing mode — I have reset everything, fresh start.\n\nHere is the beautiful form again to check:\n\n" + formLink() + "\n\nTell me what you want to test — for example Dec 1, 1 couple, 1 room — and I will calculate it for you. Or just say — give me the booking form.");
      return;
    }

    // --- Just asking / Q&A mode - do NOT push form ---
    if ((lower.includes("ask") && lower.includes("question")) || lower.includes("so many question") || lower.includes("just asking") || lower.includes("not book") || lower.includes("only asking") || lower.includes("just want to know")) {
      s.qaMode = true;
      await sendWhatsApp(from, "Of course, please ask me anything, I am here for you. No need to fill the form until you are ready, take your time.\n\nYou can ask me about price, rooms, dates, pool, breakfast, check-in, photos, Wayanad places, anything. What would you like to know first?");
      return;
    }

    // --- FORM - ANY form wording - ALWAYS send, NEVER block, NEVER say already shared bluntly ---
    if (lower.includes("form") || lower.includes("booking form") || lower.includes("form please") || lower.includes("send form") || lower.includes("give form")) {
      s.qaMode = false;
      const sum = s.details ? "I have your details — " + detailsSummary(s.details) + ". " : "";
      const namePart = s.guestName ? "Hi " + s.guestName + ", " : "Hi, ";
      await sendWhatsApp(from, namePart + "here you go — " + sum + "this is the Pachapp Pool Villa booking form. You can edit it right on the form itself — change dates, adults, rooms, it will calculate the total for you. Please fill it when you are ready.\n\n" + formLink() + "\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included. Welcome!");
      s.formSent = true;
      return;
    }

    // --- BOOKING INTENT - warm, calculate if details known ---
    const isBookingIntent = lower.includes("book now") || lower.includes("want book") || lower.includes("want to book") || lower.includes("pay and book") || lower.includes("book straight") || lower.includes("can book") || lower.includes("book your room") || lower.includes("i want book") || lower.includes("book room") || lower.includes("book it") || lower.includes("book for") || (lower.includes("i have given") && lower.includes("book")) || (lower.includes("been there before") && lower.includes("book")) || lower.includes("i want to book") || lower.includes("book my") || lower.includes("confirm my booking");
    if (isBookingIntent) {
      s.qaMode = false;
      if (text.length > 5) s.lastDates = text;
      const sum = s.details ? "Got it — " + detailsSummary(s.details) + ". " : "";
      if (s.details && s.details.adults !== null) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Welcome back, so lovely that you have been here before. Yes, you can book straight away, no need to wait. " + sum + "For 1 night, Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + ". Here is the form to confirm — you can edit it on the form itself:\n\n" + formLink() + "\n\nIf you want a different date or more rooms, just tell me, I will recalculate.");
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, sum + "Yes, you can book straight away, I will help you. Here is the Pachapp Pool Villa booking form. You can edit it on the form. It shows total, advance, and the original QR.\n\n" + formLink() + "\n\nTell me your dates and guests if you want me to calculate first.");
      s.formSent = true;
      return;
    }

    // --- DETAILS given - remember, calculate, do NOT ask again ---
    const parsed = parseDetails(text);
    if (parsed.guestName) { s.guestName = parsed.guestName; }
    if (parsed.hasDetails) {
      if (parsed.adults !== null || parsed.rooms !== null || parsed.dateText) {
        s.details = { ...(s.details || {}), adults: parsed.adults ?? s.details?.adults ?? null, rooms: parsed.rooms ?? s.details?.rooms ?? null, kids: parsed.kids ?? s.details?.kids ?? null, breakfast: parsed.breakfast ?? s.details?.breakfast ?? null, dateText: parsed.dateText || s.details?.dateText || "" };
      }
      s.lastDates = parsed.dateText || s.lastDates;
      const adults = s.details.adults || 2;
      const rooms = s.details.rooms || 1;
      const kidsHalf = (s.details.kids === 0) ? 0 : 0;
      const breakfastCount = (s.details.breakfast === 0) ? 0 : 0;
      const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: adults, kidsHalf: kidsHalf, rooms: rooms, breakfastCount: breakfastCount });
      const sum = detailsSummary(s.details);
      const namePart = s.guestName ? "Thanks " + s.guestName + ", " : "Perfect, ";
      await sendWhatsApp(from, namePart + "got it — " + sum + ".\n\nFor 1 night: Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + " (1 room, 1 night, 2 adults, no kids, no breakfast — if that is your plan).\n\nShall I share the booking form to confirm? Just say — give me the booking form, or Book Now — and I will send it right away.");
      return;
    }

    // --- "I have given details" - recall, do NOT ask again ---
    if (lower.includes("given my details") || lower.includes("given details") || lower.includes("i have given") || lower.includes("i gave") || lower.includes("already told")) {
      if (s.details) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults || 2, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Yes, I have your details, I remember — " + detailsSummary(s.details) + ". I will not ask again. Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + ". Here is the form to confirm:\n\n" + formLink() + "\n\nYou can edit anything on the form itself.");
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, "Thanks so much, I noted it. Can you tell me once again — date, how many adults, how many rooms? For example: Dec 1, 1 couple, 1 room, no kids, no breakfast. I will remember it this time and calculate for you.");
      return;
    }

    // --- PAY / QR / UTR ---
    if (lower.includes("qr") || lower.includes("pay") || lower.includes("upi") || lower.includes("advance") || lower.includes("payment") || lower.includes("utr")) {
      await sendWhatsApp(from, "To pay, please open the booking form and tap Pay Advance. The original QR code is inside the form — 【entity-PhonePe¦canonical_name=PhonePe】, UDAYABHANU RAMACHANDRAN. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking.\n\nWithout UTR, your booking stays as Pending - Waiting for Advance. With UTR, it becomes Confirmed.\n\nHere is the form again:\n\n" + formLink());
      return;
    }

    // --- PHOTOS ---
    if (lower.includes("photo") || lower.includes("pic") || lower.includes("image") || lower.includes("video") || lower.includes("photos")) {
      await sendWhatsApp(from, "Of course, I would love to show you. Photos and videos are in the booking form and on our page.\n\nTell me which view you want — pool view, room inside, full villa, or Wayanad surroundings — and I will share that one. Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      return;
    }

    // --- PRICE ---
    if (lower.includes("price") || lower.includes("rate") || lower.includes("cost") || lower.includes("how much") || lower.includes("charge") || lower.includes("tariff")) {
      await sendWhatsApp(from, "Sure, happy to explain clearly:\n\nFull Villa — Weekday " + formatPrice(6400) + " / night, Weekend Fri/Sat/Sun " + formatPrice(8000) + " / night\nRooms — " + formatPrice(1600) + " per room per night\nExtra Adult — " + formatPrice(800) + " per night (above 8 adults)\nKids 0-6 Free, Kids 6-12 Half Price " + formatPrice(400) + " per kid per night\nBreakfast — Full Villa Free, Rooms " + formatPrice(100) + " each\nDolby Atmos included. Live music only when owner is at the villa.\n\nTell me your dates and guests, I will calculate your exact total. No need to fill the form yet.");
      return;
    }

    // --- ROOMS / VILLA / POOL ---
    if (lower.includes("room") || lower.includes("villa") || lower.includes("pool") || lower.includes("how many") || lower.includes("capacity") || lower.includes("people") || lower.includes("accommod")) {
      if (s.details) {
        await sendWhatsApp(from, "You already shared — " + detailsSummary(s.details) + ". I remember. Do you want me to share the form to confirm that? Just say — give me the booking form.");
        return;
      }
      await sendWhatsApp(from, "Pachapp Pool Villa has 4 rooms in the whole villa, with a private pool. You can book Full Villa (whole villa) or Rooms (1 to 4 rooms). Dolby Atmos included, so evenings are beautiful here.\n\nTell me how many adults, kids, and dates you have, I will tell you how many rooms you need and your total. For example: Dec 1, 1 couple, 1 room, no kids, no breakfast.");
      return;
    }

    // --- BREAKFAST / FOOD ---
    if (lower.includes("breakfast") || lower.includes("food") || lower.includes("meal") || lower.includes("eat") || lower.includes("break fast")) {
      await sendWhatsApp(from, "Breakfast is Free for Full Villa. For Rooms, it is " + formatPrice(100) + " each. It is simple, fresh, Kerala style.\n\nTell me if you want breakfast and for how many people, I will add it to your total for you.");
      return;
    }

    // --- CHECK-IN / TIME ---
    if (lower.includes("check") || lower.includes("time") || lower.includes("arrive") || lower.includes("check in") || lower.includes("check out")) {
      await sendWhatsApp(from, "Check-in / Check-out times are shown in the booking form, so you can see them clearly there.\n\nTell me your dates and I will check availability for you. What dates are you thinking of?");
      return;
    }

    // --- DATES / AVAILABLE ---
    if (lower.includes("available") || lower.includes("dec") || lower.includes("jan") || lower.includes("feb") || lower.includes("date") || lower.includes("december") || lower.includes("january")) {
      if (s.lastDates && s.asked.has("dates")) {
        await sendWhatsApp(from, "You already shared " + s.lastDates + ". I remember it, I will not ask again. Do you want me to calculate total for those dates? Just tell me how many adults and kids.");
        return;
      }
      s.asked.add("dates");
      s.lastDates = text;
      await sendWhatsApp(from, "Thanks for sharing your dates — " + text + ". I have noted it, thank you.\n\nNow tell me how many adults and kids, and I will calculate your total for you right away.");
      return;
    }

    // --- MUSIC ---
    if (lower.includes("music") || lower.includes("dj") || lower.includes("live")) {
      await sendWhatsApp(from, "Live music is only when the owner is at the villa — it is a special, intimate evening then. Dolby Atmos is always included, so music and movies sound beautiful here.\n\nWhat else would you like to know?");
      return;
    }

    // --- GREETING ---
    if (lower === "hi" || lower === "hello" || lower === "hey" || lower === "hii" || lower === "haa" || lower.startsWith("hi ") || lower.startsWith("hello ")) {
      if (!s.greeted) {
        s.greeted = true;
        await sendWhatsApp(from, "Hi, welcome to Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included, pool is waiting for you.\n\nYou can ask me anything — price, rooms, dates, photos. Or if you want to book, just say Book Now and I will share the form. What would you like to know?");
        return;
      } else {
        await sendWhatsApp(from, "Hi again, I am here. Please ask anything, take your time. What would you like to know?");
        return;
      }
    }

    // --- FALLBACK - warm, human, try Groq for open questions, else warm template ---
    if (!s.greeted) {
      s.greeted = true;
      await sendWhatsApp(from, "Hi, welcome to Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything — price, rooms, dates, photos, Wayanad places. Or say Book Now when you are ready. What would you like to know?");
    } else {
      // Try Groq for a real human answer if key is set, else warm fallback
      const groqReply = await askGroq(text, []);
      if (groqReply) {
        await sendWhatsApp(from, groqReply + "\n\nIf you want to book, just say — give me the booking form — and I will send it.");
      } else if (s.formSent) {
        await sendWhatsApp(from, "I am here, listening. What would you like to know? You can ask about price, rooms, dates, anything. The form is already shared above when you are ready to book. If you want it again, just say — give me the booking form — and I will resend it happily.");
      } else {
        await sendWhatsApp(from, "Thanks for your message, I hear you. What would you like to know? You can ask about price, rooms, dates, pool, breakfast, Wayanad, anything. Say Book Now or give me the booking form only when you are ready to book — no rush at all.");
      }
    }
  } catch (e) { console.log("Webhook error", e); }
});

app.listen(PORT, () => console.log("Pachapp AI running on", PORT));
