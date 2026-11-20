// =====================================================
// Pachapp AI - FULL CODE - Final
// Form: Pachapp Bookings Form (locked)
// Airtable Table: Pachapp Bookings
// Rule: Pay before Confirm. No UTR = Pending.
// Rule: Never invent links. Only use FORM_URL.
// =====================================================

const express = require('express');
const app = express();
app.use(express.json());

// =====================================================
// 1. CHANGE HERE - EASY TO CHANGE - ONLY THIS PART
// =====================================================
const CONFIG = {
  // Paste Share link of Pachapp Bookings Form here
  // Example: https://your-share-link
  FORM_URL: process.env.FORM_URL || "PASTE_YOUR_PACHAPP_BOOKINGS_FORM_SHARE_LINK_HERE",

  OWNER_PHONE: "918943666911",      // Uday Hue
  CARETAKER_PHONE: "91894366911",   // Sreejith
  AIRTABLE_TABLE: "Pachapp Bookings",
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "pachapp-verify",

  // true = Group AI stays silent, DM AI replies
  // false = Group AI also replies
  GROUP_AI_SILENT: true,
};
// =====================================================
// END CHANGE HERE - You can stop here, rest is ready
// =====================================================

const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";

const sessions = new Map();
const groupPaused = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) sessions.set(phone, { asked: new Set(), lastDates: "" });
  return sessions.get(phone);
}
function cleanPhone(p) { return String(p || "").replace(/\D/g, ""); }
function isOwner(phone) {
  const c = cleanPhone(phone);
  return c === cleanPhone(CONFIG.OWNER_PHONE) || c === cleanPhone(CONFIG.CARETAKER_PHONE);
}

// =====================================================
// 2. PRICING - Same as locked form, do not change
// =====================================================
function calcTotal(o) {
  const n = Math.max(1, Math.min(7, o.nights || 1));
  const isFull = o.bookingType === "Full Villa";
  let roomTotal = 0;
  let perNightRate = 1600;
  if (isFull) {
    perNightRate = 6400; // Weekend 8000 is handled in form per-night split
    roomTotal = perNightRate * n;
  } else {
    roomTotal = 1600 * (o.rooms || 1) * n;
  }
  const extraCount = Math.max(0, (o.adults || 0) - 8);
  const extraTotal = extraCount * 800 * n;
  const kidsHalfTotal = (o.kidsHalf || 0) * 400 * n; // Half of 800
  const breakfastTotal = isFull ? 0 : (o.breakfastCount || 0) * 100;
  const grandTotal = roomTotal + extraTotal + kidsHalfTotal + breakfastTotal;
  let advance = 0;
  if (!isFull && (o.rooms || 1) === 1 && n === 1 && (o.adults || 0) <= 2 && (o.kidsHalf || 0) === 0) advance = 1600;
  else if (grandTotal <= 10000) advance = 2000;
  else advance = Math.round(grandTotal * 0.20);
  return { perNightRate, roomTotal, extraCount, extraTotal, kidsHalfTotal, breakfastTotal, grandTotal, advance, nights: n };
}

// =====================================================
// 3. AIRTABLE - Form -> Pachapp Bookings
// =====================================================
async function createAirtableBooking(d) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.log("Airtable not set - skip Airtable");
    return null;
  }
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
// 4. WHATSAPP SEND - Fixed, no space bug
// =====================================================
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log("WhatsApp not set, would send to", to, text);
    return;
  }
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
      })
    });
    const out = await res.json().catch(() => ({}));
    console.log("WhatsApp send", res.status, JSON.stringify(out).slice(0, 200));
  } catch (e) {
    console.log("Send failed", e.message);
  }
}

function formLink() {
  if (!CONFIG.FORM_URL || CONFIG.FORM_URL.includes("PASTE_YOUR")) return "Booking form link is being updated. Please ask owner for latest link.";
  return CONFIG.FORM_URL;
}

// =====================================================
// 5. PAGES
// =====================================================
app.get("/", (req, res) => res.send("Pachapp AI is running"));
app.get("/health", (req, res) => res.json({ ok: true, form: CONFIG.FORM_URL, airtable: CONFIG.AIRTABLE_TABLE }));

app.get("/booking", (req, res) => {
  if (CONFIG.FORM_URL && !CONFIG.FORM_URL.includes("PASTE_YOUR")) return res.redirect(CONFIG.FORM_URL);
  return res.send("FORM_URL not set. Set it in Section 1 or in Render Environment.");
});

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
  } catch (e) {
    console.log(e);
    return res.status(500).json({ ok: false, error: "Could not save booking" });
  }
});

// =====================================================
// 6. WHATSAPP WEBHOOK
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

    // Group silent - AI stays silent in group while you test manually
    // If you are testing in a Group, use DM instead. Group will not reply when GROUP_AI_SILENT is true.
    const isGroupMsg = !!msg.context?.group_id;
    if (isGroupMsg && CONFIG.GROUP_AI_SILENT && !isOwner(from)) return;
    if (groupPaused.get(from) === true && !isOwner(from)) return;

    if (lower === "pause ai" && isOwner(from)) {
      groupPaused.set(from, true);
      await sendWhatsApp(from, "AI paused. I will stay silent. Send RESUME AI to start again.");
      return;
    }
    if (lower === "resume ai" && isOwner(from)) {
      groupPaused.set(from, false);
      await sendWhatsApp(from, "AI resumed.");
      return;
    }

    const s = getSession(from);

    // BOOK NOW - send form immediately, do NOT ask again. Fixes Reshmai case.
    if (lower.includes("book now") || lower.includes("i want to pay and book now") || lower.includes("pay and book") || lower.includes("want to book")) {
      if (text.length > 5) s.lastDates = text;
      const dateLine = s.lastDates ? "Got it - " + s.lastDates + ". " : "";
      await sendWhatsApp(from, dateLine + "Here is the Pachapp Pool Villa booking form. Please fill it and pay the advance to confirm.\n\n" + formLink() + "\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      return;
    }

    // QR / PAY - only when guest asks to pay
    if (lower.includes("qr") || lower.includes("pay") || lower.includes("upi") || lower.includes("advance") || lower.includes("payment")) {
      await sendWhatsApp(from, "To pay, please open the booking form and tap Pay Advance. The QR code is inside the form. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking. Without UTR, your booking stays as Pending - Waiting for Advance.\n\n" + formLink());
      return;
    }

    // PHOTOS - only when guest asks
    if (lower.includes("photo") || lower.includes("pic") || lower.includes("image") || lower.includes("video")) {
      await sendWhatsApp(from, "Photos and videos are in the booking form and on our page. Tell me which room / view you want and I will share it. Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      return;
    }

    // PRICE
    if (lower.includes("price") || lower.includes("rate") || lower.includes("cost") || lower.includes("how much")) {
      await sendWhatsApp(from, "Pachapp Pool Villa:\nFull Villa - Weekday Rs.6400 / night, Weekend Fri/Sat/Sun Rs.8000 / night\nRooms - Rs.1600 per room per night\nExtra Adult - Rs.800 per night (above 8 adults)\nKids 0-6 Free, Kids 6-12 Half Price Rs.400 per kid per night\nBreakfast - Full Villa Free, Rooms Rs.100 each\nDolby Atmos included. Live music only when owner is at the villa.\n\nTo check total for your dates, please fill the form:\n" + formLink());
      return;
    }

    // DATES - do not ask again and again
    if (lower.includes("available") || lower.includes("dec") || lower.includes("jan") || lower.includes("date")) {
      if (s.lastDates && s.asked.has("dates")) {
        await sendWhatsApp(from, "You already shared " + s.lastDates + ". Please fill the form with those dates, I will not ask again:\n" + formLink());
        return;
      }
      s.asked.add("dates");
      s.lastDates = text;
      await sendWhatsApp(from, "Thanks for sharing your dates. Please fill the booking form with those dates to check total and pay advance:\n" + formLink());
      return;
    }

    // MUSIC
    if (lower.includes("music") || lower.includes("dj") || lower.includes("live")) {
      await sendWhatsApp(from, "Live music is only when the owner is at the villa. Dolby Atmos is always included. Please tell me your dates in the form and we will confirm.");
      return;
    }

    // DEFAULT - human way
    if (!s.asked.has("greeted")) {
      s.asked.add("greeted");
      await sendWhatsApp(from, "Hi, this is Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nIf you want to book, please fill this form - it shows total, advance, and QR:\n" + formLink() + "\n\nTell me your dates if you want, I will not ask again and again.");
    } else {
      await sendWhatsApp(from, "Thanks for your message. Please fill the booking form to confirm - it has total, advance, and QR:\n" + formLink());
    }
  } catch (e) { console.log("Webhook error", e); }
});

app.listen(PORT, () => console.log("Pachapp AI running on", PORT));
