// =====================================================
// Pachapp AI - FIXED - NEVER SENDS PLACEHOLDER
// If FORM_URL not set, bot says "link updating" + tells owner what to do
// Beautiful form = Pachapp Booking Form artifact with original QR
// FORM_URL = Share link from that form page Share control
// =====================================================

const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  // PASTE HERE: Share link from Pachapp Booking Form page (beautiful one)
  // Open form above -> Share control on that page -> Copy link -> Paste here
  // AND also set same in Render Environment -> FORM_URL
  // DO NOT paste meta.ai/share link
  FORM_URL: process.env.FORM_URL || "",
  OWNER_PHONE: "918943666911",
  CARETAKER_PHONE: "91894366911",
  AIRTABLE_TABLE: "Pachapp Bookings",
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "pachapp-verify",
  GROUP_AI_SILENT: true,
};

const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";

function isFormUrlSet() {
  return CONFIG.FORM_URL && !CONFIG.FORM_URL.includes("PASTE_YOUR") && !CONFIG.FORM_URL.includes("meta.ai/share") && CONFIG.FORM_URL.startsWith("http");
}
function formLink() { return isFormUrlSet() ? CONFIG.FORM_URL : ""; }

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

function calcTotal(o) {
  const n = Math.max(1, Math.min(7, o.nights || 1));
  const isFull = o.bookingType === "Full Villa";
  let roomTotal = 0; let perNightRate = 1600;
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

async function createAirtableBooking(d) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) { console.log("Airtable not set"); return null; }
  const fields = {
    "Guest Name": d.guestName || "", "Phone / WhatsApp": d.phone || "", "Booking Type": d.bookingType || "Full Villa",
    "Check-in": d.checkIn || "", "Check-out": d.checkOut || "", "Nights": d.nights || 1, "Adults": d.adults || 2,
    "Kids Below 6": d.kidsFree || 0, "Kids 6-12": d.kidsHalf || 0, "Kids 6-12 Total": d.kidsHalfTotal || 0, "Rooms": d.rooms || 1,
    "Breakfast Count": d.breakfastCount || 0, "Breakfast Included": d.breakfastIncluded || (d.bookingType === "Full Villa" ? "Yes - Free" : "No"),
    "Rate Applied": d.rateApplied || "", "Per Night Rate": d.perNightRate || 0, "Room Total": d.roomTotal || 0,
    "Extra Adult Count": d.extraCount || 0, "Extra Adult Total": d.extraTotal || 0, "Breakfast Total": d.breakfastTotal || 0,
    "Grand Total": d.grandTotal || 0, "Advance to Pay": d.advanceToPay || 0, "UTR": d.utr || "",
    "Payment Status": d.utr ? "Confirmed" : "Pending - Waiting for Advance",
    "Booking Status": d.utr ? "Confirmed" : "Pending - Waiting for Advance",
    "Source": "Form", "Notes": d.notes || "", "Created At": new Date().toISOString()
  };
  const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/" + encodeURIComponent(CONFIG.AIRTABLE_TABLE);
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + AIRTABLE_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ fields }] }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { console.log("Airtable error", out); throw new Error("Airtable failed"); }
  return out;
}

async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) { console.log("【entity-WhatsApp¦canonical_name=WHATSAPP】 not set"); return; }
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages", {
      method: "POST", headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "【entity-whatsapp¦canonical_name=WHATSAPP】", to: to, type: "text", text: { body: text } })
    });
    const out = await res.json().catch(() => ({}));
    console.log("WhatsApp send", res.status, JSON.stringify(out).slice(0, 200));
  } catch (e) { console.log("Send failed", e.message); }
}

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
    const data = { guestName: b.guestName || b["Guest Name"] || b.name || "", phone: b.phone || b["Phone / WhatsApp"] || "", bookingType: b.bookingType || b["Booking Type"] || "Full Villa", checkIn: b.checkIn || b["Check-in"] || "", checkOut: b.checkOut || b["Check-out"] || "", nights: calc.nights, adults: Number(b.adults || 2), kidsFree: Number(b.kidsFree || b["Kids Below 6"] || 0), kidsHalf: Number(b.kidsHalf || b["Kids 6-12"] || 0), kidsHalfTotal: calc.kidsHalfTotal, rooms: Number(b.rooms || 1), breakfastCount: Number(b.breakfastCount || 0), breakfastIncluded: b.breakfastIncluded || (b.bookingType === "Full Villa" ? "Yes - Free" : "No"), rateApplied: b.rateApplied || "", perNightRate: calc.perNightRate, roomTotal: calc.roomTotal, extraCount: calc.extraCount, extraTotal: calc.extraTotal, breakfastTotal: calc.breakfastTotal, grandTotal: calc.grandTotal, advanceToPay: calc.advance, utr: b.utr || b.UTR || "", notes: b.notes || b.Notes || "" };
    if (!data.guestName.trim()) return res.status(400).json({ ok: false, error: "Please enter the guest name." });
    if (!data.phone.trim()) return res.status(400).json({ ok: false, error: "Please enter phone." });
    const airtable = await createAirtableBooking(data);
    return res.json({ ok: true, status: data.utr ? "Confirmed" : "Pending - Waiting for Advance", grandTotal: data.grandTotal, advance: data.advanceToPay, airtable: !!airtable });
  } catch (e) { console.log(e); return res.status(500).json({ ok: false, error: "Could not save booking" }); }
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"]; const token = req.query["hub.verify_token"]; const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0]; const change = entry?.changes?.[0]; const value = change?.value; const msg = value?.messages?.[0];
    if (!msg || msg.type !== "text") return;
    const from = msg.from; const text = (msg.text?.body || "").trim(); const lower = text.toLowerCase();
    const isGroupMsg = !!msg.context?.group_id;
    if (isGroupMsg && CONFIG.GROUP_AI_SILENT && !isOwner(from)) return;
    if (groupPaused.get(from) === true && !isOwner(from)) return;
    if (lower === "pause ai" && isOwner(from)) { groupPaused.set(from, true); await sendWhatsApp(from, "AI paused. I will stay silent. Send RESUME AI to start again."); return; }
    if (lower === "resume ai" && isOwner(from)) { groupPaused.set(from, false); await sendWhatsApp(from, "AI resumed."); return; }
    let s = getSession(from);

    // OWNER TESTING - If FORM_URL not set, tell owner exactly what to fix, never send placeholder
    if (lower.includes("i am the owner") || lower.includes("i am owner") || lower.includes("owner testing") || lower.includes("testing the ai")) {
      s = resetSession(from);
      if (!isFormUrlSet()) {
        await sendWhatsApp(from, "Owner, testing mode - I reset. FORM_URL is NOT set yet in Render, so I will NOT send a fake link.\n\nFix: Open Pachapp Booking Form -> Use Share control on that page -> Copy link -> Render Environment -> FORM_URL = paste that link -> Redeploy.\n\nThen test again with - give me the booking form - and I will send the beautiful form with original QR.");
        return;
      }
      await sendWhatsApp(from, "Okay owner, testing mode - I reset. Here is the beautiful form again to check:\n\n" + formLink() + "\n\nTell me what you want to test - Dec 1, 1 couple, 1 room - and I will calculate. Or say - give me the booking form.");
      return;
    }

    if (lower.includes("ask") && lower.includes("question") || lower.includes("so many question") || lower.includes("just asking") || lower.includes("not book")) {
      s.qaMode = true;
      await sendWhatsApp(from, "Of course, please ask me anything, I am here. No need to fill the form until you are ready.\n\nYou can ask me about price, rooms, dates, pool, breakfast, check-in, photos, anything. What would you like to know first?");
      return;
    }

    // FORM - NEVER SEND PLACEHOLDER
    if (lower.includes("form")) {
      s.qaMode = false;
      if (!isFormUrlSet()) {
        await sendWhatsApp(from, "Pachapp Pool Villa booking form is getting ready - link is being updated. Please message owner on +91 89436 66911 and I will share the latest form in a moment. Sorry for the wait.");
        // Alert owner
        await sendWhatsApp(CONFIG.OWNER_PHONE, "Alert: Guest asked for booking form but FORM_URL is NOT set in Render. Set FORM_URL to beautiful form Share link and redeploy. Guest: " + from);
        return;
      }
      const sum = s.details ? detailsSummary(s.details) + ". " : "";
      await sendWhatsApp(from, "Here you go - " + sum + "Pachapp Pool Villa booking form. You can edit it on the form itself - change dates, adults, rooms, it will calculate total. Please fill it when you are ready.\n\n" + formLink() + "\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      s.formSent = true;
      return;
    }

    const isBookingIntent = lower.includes("book now") || lower.includes("want book") || lower.includes("want to book") || lower.includes("pay and book") || lower.includes("book straight") || lower.includes("can book") || lower.includes("book your room") || lower.includes("i want book") || lower.includes("book room") || lower.includes("book it") || lower.includes("book for") || lower.includes("i have given") && lower.includes("book") || lower.includes("been there before") && lower.includes("book") || lower.includes("i want to book");
    if (isBookingIntent) {
      s.qaMode = false;
      if (text.length > 5) s.lastDates = text;
      if (!isFormUrlSet()) {
        await sendWhatsApp(from, "Yes, you can book. Form link is being updated, please message owner on +91 89436 66911 and I will share the latest form in a moment.");
        return;
      }
      const sum = s.details ? "Got it - " + detailsSummary(s.details) + ". " : "";
      if (s.details && s.details.adults !== null) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Welcome back, great you have been here before. Yes, you can book straight away. " + sum + "Total Rs." + c.grandTotal + " for 1 night, Advance Rs." + c.advance + ". Here is the form to confirm - you can edit it on the form:\n\n" + formLink());
        s.formSent = true; return;
      }
      await sendWhatsApp(from, sum + "Yes, you can book straight away. Here is the Pachapp Pool Villa booking form. You can edit it on the form. It shows total, advance, and original QR.\n\n" + formLink());
      s.formSent = true; return;
    }

    const parsed = parseDetails(text);
    if (parsed.hasDetails) {
      s.details = parsed; s.lastDates = parsed.dateText || s.lastDates;
      const adults = parsed.adults || 2; const rooms = parsed.rooms || 1; const kidsHalf = parsed.kids === 0 ? 0 : 0; const breakfastCount = parsed.breakfast === 0 ? 0 : 0;
      const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: adults, kidsHalf: kidsHalf, rooms: rooms, breakfastCount: breakfastCount });
      const sum = detailsSummary(parsed);
      await sendWhatsApp(from, "Perfect, got it - " + sum + ".\n\nFor 1 night: Total Rs." + c.grandTotal + ", Advance Rs." + c.advance + " (1 room, 1 night, 2 adults, no kids, no breakfast).\n\nShall I share the booking form to confirm? Just say - give me the booking form, or Book Now.");
      return;
    }

    if (lower.includes("given my details") || lower.includes("given details") || lower.includes("i have given")) {
      if (s.details) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults || 2, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        if (!isFormUrlSet()) { await sendWhatsApp(from, "Yes, I have your details - " + detailsSummary(s.details) + ". Total Rs." + c.grandTotal + ", Advance Rs." + c.advance + ". Form link is being updated, please message owner."); return; }
        await sendWhatsApp(from, "Yes, I have your details - " + detailsSummary(s.details) + ". Total Rs." + c.grandTotal + ", Advance Rs." + c.advance + ". Here is the form to confirm:\n\n" + formLink());
        s.formSent = true; return;
      }
      await sendWhatsApp(from, "Thanks, I noted it. Can you tell me again - date, how many adults, how many rooms? Example: Dec 1, 1 couple, 1 room, no kids, no breakfast.");
      return;
    }

    if (lower.includes("qr") || lower.includes("pay") || lower.includes("upi") || lower.includes("advance") || lower.includes("payment")) {
      if (!isFormUrlSet()) { await sendWhatsApp(from, "To pay, form link is being updated. Please message owner on +91 89436 66911."); return; }
      await sendWhatsApp(from, "To pay, please open the booking form and tap Pay Advance. The original QR code is inside the form. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking. Without UTR, your booking stays as Pending - Waiting for Advance.\n\n" + formLink());
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
      if (s.details) { await sendWhatsApp(from, "You already shared - " + detailsSummary(s.details) + ". Do you want me to share the form to confirm?"); return; }
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
      if (s.lastDates && s.asked.has("dates")) { await sendWhatsApp(from, "You already shared " + s.lastDates + ". I remember it, I will not ask again. Do you want me to calculate total for those dates? Tell me how many adults and kids."); return; }
      s.asked.add("dates"); s.lastDates = text;
      await sendWhatsApp(from, "Thanks for sharing your dates - " + text + ". I noted it. Tell me how many adults and kids, I will calculate total for you.");
      return;
    }
    if (lower.includes("music") || lower.includes("dj") || lower.includes("live")) {
      await sendWhatsApp(from, "Live music is only when the owner is at the villa. Dolby Atmos is always included. What else would you like to know?");
      return;
    }
    if (lower === "hi" || lower === "hello" || lower === "hey") {
      if (!s.greeted) { s.greeted = true; await sendWhatsApp(from, "Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything - price, rooms, dates, photos. Or if you want to book, just say Book Now and I will share the form. What would you like to know?"); return; }
      else { await sendWhatsApp(from, "Hi again, I am here. Please ask your questions, take your time. What would you like to know?"); return; }
    }
    if (!s.greeted) { s.greeted = true; await sendWhatsApp(from, "Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything - price, rooms, dates, photos. Or say Book Now when you are ready. What would you like to know?"); }
    else if (s.formSent) { await sendWhatsApp(from, "I am here. What would you like to know? You can ask about price, rooms, dates, anything. The form is already shared above when you are ready to book. If you want it again, just say - give me the booking form - and I will resend it."); }
    else { await sendWhatsApp(from, "Thanks for your message. What would you like to know? You can ask about price, rooms, dates, pool, breakfast, anything. Say Book Now or give me the booking form only when you are ready to book."); }
  } catch (e) { console.log("Webhook error", e); }
});

app.listen(PORT, () => console.log("Pachapp AI running on", PORT));
