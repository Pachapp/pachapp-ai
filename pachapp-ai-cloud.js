const 【entity-express¦canonical_name=express】 = require("【entity-express¦canonical_name=express】");
const app = 【entity-express¦canonical_name=express】();
app.use(【entity-express¦canonical_name=express】.json());
const CONFIG = {
  FORM_URL: process.env.FORM_URL || "https://www.meta.ai/share/a/b70443aa-2c84-4d7c-bd75-33bae9dbe5d0",
  OWNER_PHONE: "918943666911",
  CARETAKER_PHONE: "91894366911",
  AIRTABLE_TABLE: "Pachapp Bookings",
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "pachapp-verify",
  GROUP_AI_SILENT: true
};
const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
function isFormUrlSet() {
  return CONFIG.FORM_URL && CONFIG.FORM_URL.indexOf("PASTE_YOUR") === -1 && CONFIG.FORM_URL.indexOf("http") === 0;
}
function formLink() {
  if (isFormUrlSet()) {
    return CONFIG.FORM_URL;
  }
  return "";
}
const sessions = new Map();
const groupPaused = new Map();
function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { asked: {}, lastDates: "", greeted: false, formSent: false, qaMode: false, details: null, guestName: "" });
  }
  return sessions.get(phone);
}
function resetSession(phone) {
  sessions.set(phone, { asked: {}, lastDates: "", greeted: false, formSent: false, qaMode: false, details: null, guestName: "" });
  return sessions.get(phone);
}
function cleanPhone(p) {
  return String(p || "").replace(/\D/g, "");
}
function isOwner(phone) {
  const c = cleanPhone(phone);
  return c === cleanPhone(CONFIG.OWNER_PHONE) || c === cleanPhone(CONFIG.CARETAKER_PHONE);
}
function formatPrice(n) {
  return "Rs." + Number(n || 0).toLocaleString("en-IN");
}
function calcTotal(o) {
  let n = Math.max(1, Math.min(7, o.nights || 1));
  let isFull = o.bookingType === "Full Villa";
  let roomTotal = 0;
  let perNightRate = 1600;
  if (isFull) {
    perNightRate = 6400;
    roomTotal = perNightRate * n;
  } else {
    roomTotal = 1600 * (o.rooms || 1) * n;
  }
  let extraCount = Math.max(0, (o.adults || 0) - 8);
  let extraTotal = extraCount * 800 * n;
  let kidsHalfTotal = (o.kidsHalf || 0) * 400 * n;
  let breakfastTotal = 0;
  if (!isFull) {
    breakfastTotal = (o.breakfastCount || 0) * 100;
  }
  let grandTotal = roomTotal + extraTotal + kidsHalfTotal + breakfastTotal;
  let advance = 0;
  if (!isFull && (o.rooms || 1) === 1 && n === 1 && (o.adults || 0) <= 2 && (o.kidsHalf || 0) === 0) {
    advance = 1600;
  } else if (grandTotal <= 10000) {
    advance = 2000;
  } else {
    advance = Math.round(grandTotal * 0.20);
  }
  return { perNightRate: perNightRate, roomTotal: roomTotal, extraCount: extraCount, extraTotal: extraTotal, kidsHalfTotal: kidsHalfTotal, breakfastTotal: breakfastTotal, grandTotal: grandTotal, advance: advance, nights: n };
}
function parseDetails(text) {
  const lower = text.toLowerCase();
  let adults = null;
  let rooms = null;
  let kids = null;
  let breakfast = null;
  let dateText = "";
  let guestName = "";
  const nameMatch = text.match(/(?:i am|my name is|this is)\s+([A-Za-z ]{2,30})/i);
  if (nameMatch) {
    guestName = nameMatch[1].trim().split(" ").slice(0, 2).join(" ");
  }
  if (lower.indexOf("couple") !== -1) {
    adults = 2;
  }
  if (lower.indexOf("2 couple") !== -1 || lower.indexOf("two couple") !== -1) {
    adults = 4;
  }
  if (lower.indexOf("3 couple") !== -1) {
    adults = 6;
  }
  const adultsMatch = lower.match(/(\d+)\s*adult/);
  if (adultsMatch) {
    adults = parseInt(adultsMatch[1]);
  }
  const peopleMatch = lower.match(/(\d+)\s*(people|person|guest|pax)/);
  if (peopleMatch && adults === null) {
    adults = parseInt(peopleMatch[1]);
  }
  const roomsMatch = lower.match(/(\d+)\s*room/);
  if (roomsMatch) {
    rooms = parseInt(roomsMatch[1]);
  }
  if (lower.indexOf("no kid") !== -1 || lower.indexOf("without kid") !== -1 || lower.indexOf("0 kid") !== -1) {
    kids = 0;
  }
  if (lower.indexOf("no breakfast") !== -1 || lower.indexOf("without breakfast") !== -1 || lower.indexOf("no food") !== -1) {
    breakfast = 0;
  }
  if (lower.indexOf("with breakfast") !== -1 || lower.indexOf("need breakfast") !== -1) {
    breakfast = 1;
  }
  const decMatch = lower.match(/dec(?:ember)?\s*(\d{1,2})/) || lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*dec/);
  if (decMatch) {
    dateText = "Dec " + decMatch[1];
  }
  const janMatch = lower.match(/jan(?:uary)?\s*(\d{1,2})/) || lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*jan/);
  if (janMatch) {
    dateText = "Jan " + janMatch[1];
  }
  if (lower.indexOf("tomorrow") !== -1) {
    dateText = "Tomorrow";
  }
  if (lower.indexOf("today") !== -1) {
    dateText = "Today";
  }
  let hasDetails = false;
  if (dateText !== "" && (adults !== null || rooms !== null)) {
    hasDetails = true;
  }
  if (adults !== null && rooms !== null) {
    hasDetails = true;
  }
  if (dateText !== "" && lower.indexOf("book") !== -1) {
    hasDetails = true;
  }
  if (guestName !== "") {
    hasDetails = true;
  }
  return { hasDetails: hasDetails, adults: adults, rooms: rooms, kids: kids, breakfast: breakfast, dateText: dateText, guestName: guestName };
}
function detailsSummary(d) {
  let parts = [];
  if (d.dateText) {
    parts.push(d.dateText);
  }
  if (d.adults !== null && d.adults !== undefined) {
    if (d.adults === 2) {
      parts.push("1 couple (2 adults)");
    } else {
      parts.push(d.adults + " adults");
    }
  }
  if (d.rooms !== null && d.rooms !== undefined) {
    parts.push(d.rooms + " room");
  }
  if (d.kids === 0) {
    parts.push("no kids");
  }
  if (d.breakfast === 0) {
    parts.push("no breakfast");
  }
  return parts.join(", ");
}
async function createAirtableBooking(d) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.log("Airtable not set");
    return null;
  }
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
    "Breakfast Included": d.breakfastIncluded || "No",
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
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + AIRTABLE_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ records: [{ fields: fields }] }) });
  const out = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    console.log("Airtable error " + JSON.stringify(out));
    throw new Error("Airtable failed");
  }
  return out;
}
async function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log("WhatsApp not set");
    return;
  }
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages", {
      method: "POST",
      headers: { "Authorization": "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } })
    });
    const out = await res.json().catch(function() { return {}; });
    console.log("WhatsApp send " + res.status + " " + JSON.stringify(out).slice(0, 300));
  } catch (e) {
    console.log("Send failed " + e.message);
  }
}
async function askGroq(userMsg) {
  if (!GROQ_API_KEY) {
    return null;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are Pachapp Pool Villa AI Host - warm, humane, creative, not a robot. Villa: Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad, Kerala. Owners Uday Hue, Reshma. Talk about Wayanad, pool, Dolby Atmos. NEVER give price without date. NEVER say let me check calendar. Reply in guest language. Always answer real answer first, then ask which day, how many guests. Pricing: Full Villa Weekday Rs.6400, Weekend Fri Sat Sun Rs.8000, Rooms Rs.1600 per room per night, Extra Adult Rs.800 above 8 adults, Kids 0-6 Free, Kids 6-12 Rs.400, Breakfast Full Villa Free, Rooms Rs.100. Advance: 1 room 1 night 2 adults Rs.1600, else total up to Rs.10000 Rs.2000, else 20 percent. No UTR is Pending, With UTR is Confirmed. Never invent links." },
          { role: "user", content: userMsg }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await res.json().catch(function() { return {}; });
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    return null;
  } catch (e) {
    return null;
  }
}
app.get("/", function(req, res) { res.send("Pachapp AI is running"); });
app.get("/health", function(req, res) { res.json({ ok: true, formSet: isFormUrlSet(), form: isFormUrlSet() ? CONFIG.FORM_URL : "NOT SET", airtable: CONFIG.AIRTABLE_TABLE }); });
app.get("/booking", function(req, res) {
  if (isFormUrlSet()) {
    return res.redirect(CONFIG.FORM_URL);
  }
  return res.send("Booking form link is being updated. Please message owner on +91 89436 66911 for the latest form.");
});
app.post("/booking", async function(req, res) {
  try {
    const b = req.body || {};
    const calc = calcTotal({ bookingType: b.bookingType || "Full Villa", nights: Number(b.nights || 1), adults: Number(b.adults || 2), kidsHalf: Number(b.kidsHalf || 0), rooms: Number(b.rooms || 1), breakfastCount: Number(b.breakfastCount || 0) });
    const data = {
      guestName: b.guestName || b.name || "",
      phone: b.phone || "",
      bookingType: b.bookingType || "Full Villa",
      checkIn: b.checkIn || "",
      checkOut: b.checkOut || "",
      nights: calc.nights,
      adults: Number(b.adults || 2),
      kidsFree: Number(b.kidsFree || 0),
      kidsHalf: Number(b.kidsHalf || 0),
      kidsHalfTotal: calc.kidsHalfTotal,
      rooms: Number(b.rooms || 1),
      breakfastCount: Number(b.breakfastCount || 0),
      breakfastIncluded: b.breakfastIncluded || "No",
      rateApplied: b.rateApplied || "",
      perNightRate: calc.perNightRate,
      roomTotal: calc.roomTotal,
      extraCount: calc.extraCount,
      extraTotal: calc.extraTotal,
      breakfastTotal: calc.breakfastTotal,
      grandTotal: calc.grandTotal,
      advanceToPay: calc.advance,
      utr: b.utr || "",
      notes: b.notes || ""
    };
    if (!data.guestName.trim()) {
      return res.status(400).json({ ok: false, error: "Please enter the guest name." });
    }
    if (!data.phone.trim()) {
      return res.status(400).json({ ok: false, error: "Please enter phone." });
    }
    const airtable = await createAirtableBooking(data);
    return res.json({ ok: true, status: data.utr ? "Confirmed" : "Pending - Waiting for Advance", grandTotal: data.grandTotal, advance: data.advanceToPay, airtable: !!airtable });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ ok: false, error: "Could not save booking" });
  }
});
app.get("/webhook", function(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});
app.post("/webhook", async function(req, res) {
  res.sendStatus(200);
  try {
    let body = req.body || {};
    let entry = body.entry && body.entry[0];
    let change = entry && entry.changes && entry.changes[0];
    let value = change && change.value;
    let msg = value && value.messages && value.messages[0];
    if (!msg || msg.type !== "text") {
      return;
    }
    const from = msg.from;
    const text = (msg.text && msg.text.body || "").trim();
    const lower = text.toLowerCase();
    let isGroupMsg = false;
    if (msg.context && msg.context.group_id) {
      isGroupMsg = true;
    }
    if (isGroupMsg && CONFIG.GROUP_AI_SILENT && !isOwner(from)) {
      return;
    }
    if (groupPaused.get(from) === true && !isOwner(from)) {
      return;
    }
    if (lower === "pause ai" && isOwner(from)) {
      groupPaused.set(from, true);
      await sendWhatsApp(from, "AI paused. I will stay silent. Send RESUME AI to start again.");
      return;
    }
    if (lower === "resume ai" && isOwner(from)) {
      groupPaused.set(from, false);
      await sendWhatsApp(from, "AI resumed. Welcome back.");
      return;
    }
    let s = getSession(from);
    if (lower.indexOf("i am the owner") !== -1 || lower.indexOf("i am owner") !== -1 || lower.indexOf("owner testing") !== -1 || lower.indexOf("testing the ai") !== -1) {
      s = resetSession(from);
      await sendWhatsApp(from, "Okay owner, testing mode - I have reset everything, fresh start.\n\nHere is the beautiful form again to check:\n\n" + formLink() + "\n\nTell me what you want to test - for example Dec 1, 1 couple, 1 room - and I will calculate it for you. Or just say - give me the booking form.");
      return;
    }
    if ((lower.indexOf("ask") !== -1 && lower.indexOf("question") !== -1) || lower.indexOf("so many question") !== -1 || lower.indexOf("just asking") !== -1 || lower.indexOf("not book") !== -1 || lower.indexOf("only asking") !== -1 || lower.indexOf("just want to know") !== -1) {
      s.qaMode = true;
      await sendWhatsApp(from, "Of course, please ask me anything, I am here for you. No need to fill the form until you are ready, take your time.\n\nYou can ask me about price, rooms, dates, pool, breakfast, check-in, photos, Wayanad places, anything. What would you like to know first?");
      return;
    }
    if (lower.indexOf("form") !== -1) {
      s.qaMode = false;
      let sum = "";
      if (s.details) {
        sum = "I have your details - " + detailsSummary(s.details) + ". ";
      }
      let namePart = "Hi, ";
      if (s.guestName) {
        namePart = "Hi " + s.guestName + ", ";
      }
      await sendWhatsApp(from, namePart + "here you go - " + sum + "this is the Pachapp Pool Villa booking form. You can edit it right on the form itself - change dates, adults, rooms, it will calculate the total for you. Please fill it when you are ready.\n\n" + formLink() + "\n\nPachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included. Welcome!");
      s.formSent = true;
      return;
    }
    let isBookingIntent = lower.indexOf("book now") !== -1 || lower.indexOf("want book") !== -1 || lower.indexOf("want to book") !== -1 || lower.indexOf("pay and book") !== -1 || lower.indexOf("book straight") !== -1 || lower.indexOf("can book") !== -1 || lower.indexOf("book your room") !== -1 || lower.indexOf("i want book") !== -1 || lower.indexOf("book room") !== -1 || lower.indexOf("book it") !== -1 || lower.indexOf("book for") !== -1 || lower.indexOf("i want to book") !== -1 || lower.indexOf("book my") !== -1 || lower.indexOf("confirm my booking") !== -1;
    if (isBookingIntent) {
      s.qaMode = false;
      if (text.length > 5) {
        s.lastDates = text;
      }
      let sum = "";
      if (s.details) {
        sum = "Got it - " + detailsSummary(s.details) + ". ";
      }
      if (s.details && s.details.adults !== null) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Welcome back, so lovely that you have been here before. Yes, you can book straight away, no need to wait. " + sum + "For 1 night, Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + ". Here is the form to confirm - you can edit it on the form itself:\n\n" + formLink() + "\n\nIf you want a different date or more rooms, just tell me, I will recalculate.");
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, sum + "Yes, you can book straight away, I will help you. Here is the Pachapp Pool Villa booking form. You can edit it on the form. It shows total, advance, and the original QR.\n\n" + formLink() + "\n\nTell me your dates and guests if you want me to calculate first.");
      s.formSent = true;
      return;
    }
    const parsed = parseDetails(text);
    if (parsed.guestName) {
      s.guestName = parsed.guestName;
    }
    if (parsed.hasDetails) {
      if (parsed.adults !== null || parsed.rooms !== null || parsed.dateText) {
        let old = s.details || {};
        s.details = { adults: parsed.adults !== null ? parsed.adults : old.adults, rooms: parsed.rooms !== null ? parsed.rooms : old.rooms, kids: parsed.kids !== null ? parsed.kids : old.kids, breakfast: parsed.breakfast !== null ? parsed.breakfast : old.breakfast, dateText: parsed.dateText || old.dateText || "" };
      }
      if (parsed.dateText) {
        s.lastDates = parsed.dateText;
      }
      let adults = (s.details && s.details.adults) || 2;
      let rooms = (s.details && s.details.rooms) || 1;
      const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: adults, kidsHalf: 0, rooms: rooms, breakfastCount: 0 });
      let sum = detailsSummary(s.details);
      let namePart = "Perfect, ";
      if (s.guestName) {
        namePart = "Thanks " + s.guestName + ", ";
      }
      await sendWhatsApp(from, namePart + "got it - " + sum + ".\n\nFor 1 night: Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + " (1 room, 1 night, 2 adults, no kids, no breakfast - if that is your plan).\n\nShall I share the booking form to confirm? Just say - give me the booking form, or Book Now - and I will send it right away.");
      return;
    }
    if (lower.indexOf("given my details") !== -1 || lower.indexOf("given details") !== -1 || lower.indexOf("i have given") !== -1 || lower.indexOf("i gave") !== -1 || lower.indexOf("already told") !== -1) {
      if (s.details) {
        const c = calcTotal({ bookingType: "Rooms", nights: 1, adults: s.details.adults || 2, kidsHalf: 0, rooms: s.details.rooms || 1, breakfastCount: 0 });
        await sendWhatsApp(from, "Yes, I have your details, I remember - " + detailsSummary(s.details) + ". I will not ask again. Total " + formatPrice(c.grandTotal) + ", Advance " + formatPrice(c.advance) + ". Here is the form to confirm:\n\n" + formLink() + "\n\nYou can edit anything on the form itself.");
        s.formSent = true;
        return;
      }
      await sendWhatsApp(from, "Thanks so much, I noted it. Can you tell me once again - date, how many adults, how many rooms? For example: Dec 1, 1 couple, 1 room, no kids, no breakfast. I will remember it this time and calculate for you.");
      return;
    }
    if (lower.indexOf("qr") !== -1 || lower.indexOf("pay") !== -1 || lower.indexOf("upi") !== -1 || lower.indexOf("advance") !== -1 || lower.indexOf("payment") !== -1 || lower.indexOf("utr") !== -1) {
      await sendWhatsApp(from, "To pay, please open the booking form and tap Pay Advance. The original QR code is inside the form - 【entity-PhonePe¦canonical_name=PhonePe】, UDAYABHANU RAMACHANDRAN. Pay the advance, enter your UTR, then tap I Have Paid - Confirm My Booking.\n\nWithout UTR, your booking stays as Pending - Waiting for Advance. With UTR, it becomes Confirmed.\n\nHere is the form again:\n\n" + formLink());
      return;
    }
    if (lower.indexOf("photo") !== -1 || lower.indexOf("pic") !== -1 || lower.indexOf("image") !== -1 || lower.indexOf("video") !== -1) {
      await sendWhatsApp(from, "Of course, I would love to show you. Photos and videos are in the booking form and on our page.\n\nTell me which view you want - pool view, room inside, full villa, or Wayanad surroundings - and I will share that one. Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.");
      return;
    }
    if (lower.indexOf("price") !== -1 || lower.indexOf("rate") !== -1 || lower.indexOf("cost") !== -1 || lower.indexOf("how much") !== -1 || lower.indexOf("charge") !== -1 || lower.indexOf("tariff") !== -1) {
      await sendWhatsApp(from, "Sure, happy to explain clearly:\n\nFull Villa - Weekday " + formatPrice(6400) + " / night, Weekend Fri Sat Sun " + formatPrice(8000) + " / night\nRooms - " + formatPrice(1600) + " per room per night\nExtra Adult - " + formatPrice(800) + " per night (above 8 adults)\nKids 0-6 Free, Kids 6-12 Half Price " + formatPrice(400) + " per kid per night\nBreakfast - Full Villa Free, Rooms " + formatPrice(100) + " each\nDolby Atmos included. Live music only when owner is at the villa.\n\nTell me your dates and guests, I will calculate your exact total. No need to fill the form yet.");
      return;
    }
    if (lower.indexOf("room") !== -1 || lower.indexOf("villa") !== -1 || lower.indexOf("pool") !== -1 || lower.indexOf("how many") !== -1 || lower.indexOf("capacity") !== -1 || lower.indexOf("people") !== -1) {
      if (s.details) {
        await sendWhatsApp(from, "You already shared - " + detailsSummary(s.details) + ". I remember. Do you want me to share the form to confirm that? Just say - give me the booking form.");
        return;
      }
      await sendWhatsApp(from, "Pachapp Pool Villa has 4 rooms in the whole villa, with a private pool. You can book Full Villa (whole villa) or Rooms (1 to 4 rooms). Dolby Atmos included, so evenings are beautiful here.\n\nTell me how many adults, kids, and dates you have, I will tell you how many rooms you need and your total. For example: Dec 1, 1 couple, 1 room, no kids, no breakfast.");
      return;
    }
    if (lower.indexOf("breakfast") !== -1 || lower.indexOf("food") !== -1 || lower.indexOf("meal") !== -1 || lower.indexOf("eat") !== -1) {
      await sendWhatsApp(from, "Breakfast is Free for Full Villa. For Rooms, it is " + formatPrice(100) + " each. It is simple, fresh, Kerala style.\n\nTell me if you want breakfast and for how many people, I will add it to your total for you.");
      return;
    }
    if (lower.indexOf("check") !== -1 || lower.indexOf("time") !== -1 || lower.indexOf("arrive") !== -1) {
      await sendWhatsApp(from, "Check-in / Check-out times are shown in the booking form, so you can see them clearly there.\n\nTell me your dates and I will check availability for you. What dates are you thinking of?");
      return;
    }
    if (lower.indexOf("available") !== -1 || lower.indexOf("dec") !== -1 || lower.indexOf("jan") !== -1 || lower.indexOf("feb") !== -1 || lower.indexOf("date") !== -1 || lower.indexOf("december") !== -1 || lower.indexOf("january") !== -1) {
      if (s.lastDates && s.asked && s.asked.dates) {
        await sendWhatsApp(from, "You already shared " + s.lastDates + ". I remember it, I will not ask again. Do you want me to calculate total for those dates? Just tell me how many adults and kids.");
        return;
      }
      if (!s.asked) {
        s.asked = {};
      }
      s.asked.dates = true;
      s.lastDates = text;
      await sendWhatsApp(from, "Thanks for sharing your dates - " + text + ". I have noted it, thank you.\n\nNow tell me how many adults and kids, and I will calculate your total for you right away.");
      return;
    }
    if (lower.indexOf("music") !== -1 || lower.indexOf("dj") !== -1 || lower.indexOf("live") !== -1) {
      await sendWhatsApp(from, "Live music is only when the owner is at the villa - it is a special, intimate evening then. Dolby Atmos is always included, so music and movies sound beautiful here.\n\nWhat else would you like to know?");
      return;
    }
    if (lower === "hi" || lower === "hello" || lower === "hey" || lower === "hii" || lower.indexOf("hi ") === 0 || lower.indexOf("hello ") === 0) {
      if (!s.greeted) {
        s.greeted = true;
        await sendWhatsApp(from, "Hi, welcome to Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included, pool is waiting for you.\n\nYou can ask me anything - price, rooms, dates, photos. Or if you want to book, just say Book Now and I will share the form. What would you like to know?");
        return;
      } else {
        await sendWhatsApp(from, "Hi again, I am here. Please ask anything, take your time. What would you like to know?");
        return;
      }
    }
    if (!s.greeted) {
      s.greeted = true;
      await sendWhatsApp(from, "Hi, welcome to Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included.\n\nYou can ask me anything - price, rooms, dates, photos, Wayanad places. Or say Book Now when you are ready. What would you like to know?");
    } else {
      const groqReply = await askGroq(text);
      if (groqReply) {
        await sendWhatsApp(from, groqReply + "\n\nIf you want to book, just say - give me the booking form - and I will send it.");
      } else if (s.formSent) {
        await sendWhatsApp(from, "I am here, listening. What would you like to know? You can ask about price, rooms, dates, anything. The form is already shared above when you are ready to book. If you want it again, just say - give me the booking form - and I will resend it happily.");
      } else {
        await sendWhatsApp(from, "Thanks for your message, I hear you. What would you like to know? You can ask about price, rooms, dates, pool, breakfast, Wayanad, anything. Say Book Now or give me the booking form only when you are ready to book - no rush at all.");
      }
    }
  } catch (e) {
    console.log("Webhook error " + e.message);
  }
});
app.listen(PORT, function() { console.log("Pachapp AI running on " + PORT); });
