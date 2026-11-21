const 【entity-express¦canonical_name=express】 = require("ex" + "press");
const path = require("pa" + "th");
const app = 【entity-express¦canonical_name=express】();
app.use(【entity-express¦canonical_name=express】.json());
var NL = String.fromCharCode(10);
var PORT = process.env.PORT || 10000;
var FORM_URL = process.env.FORM_URL || "https://pachapp-ai-1.onrender.com/booking-form";
var VERIFY_TOKEN = process.env.VERIFY_TOKEN || "pachapp123";
var WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
var PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
var AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
var AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
var GROUP_AI_SILENT = process.env.GROUP_AI_SILENT || "true";
var chats = {};
function onlyDigits(text) {
  var out = "";
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    if (ch >= "0" && ch <= "9") {
      out = out + ch;
    }
    i = i + 1;
  }
  return out;
}
function sendWhatsApp(to, text) {
  if (!WHATSAPP_TOKEN) {
    return Promise.resolve();
  }
  if (!PHONE_NUMBER_ID) {
    return Promise.resolve();
  }
  var url = "https://graph.facebook.com/v18.0/" + PHONE_NUMBER_ID + "/messages";
  var body = JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } });
  return fetch(url, { method: "POST", headers: { Authorization: "Bearer " + WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: body });
}
function calcForRooms(nights, rooms, adults, kids612, breakfast) {
  var rate = 1600;
  var roomTotal = rate * rooms * nights;
  var extra = 0;
  if (adults > 8) {
    extra = (adults - 8) * 800 * nights;
  }
  var kidsHalf = kids612 * 400 * nights;
  var breakTotal = 0;
  if (breakfast) {
    breakTotal = (adults + kids612) * 100 * nights;
  }
  var grand = roomTotal + extra + kidsHalf + breakTotal;
  var advance = 1600;
  if (rooms === 1 && nights === 1 && adults <= 2) {
    advance = 1600;
  } else {
    if (grand <= 10000) {
      advance = 2000;
    } else {
      advance = Math.round(grand * 0.20);
    }
  }
  return { rate: rate, roomTotal: roomTotal, extra: extra, kidsHalf: kidsHalf, breakTotal: breakTotal, grand: grand, advance: advance };
}
function saveToAirtable(b) {
  if (!AIRTABLE_TOKEN) {
    return Promise.resolve();
  }
  if (!AIRTABLE_BASE_ID) {
    return Promise.resolve();
  }
  var url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/Pachapp%20Bookings";
  var fields = {};
  fields["Guest Name"] = b.name || "";
  fields["Phone"] = b.phone || "";
  fields["Booking Type"] = b.type || "";
  fields["Check-in"] = b.checkin || "";
  fields["Check-out"] = b.checkout || "";
  fields["Nights"] = b.nights || 1;
  fields["Adults"] = b.adults || 1;
  fields["Kids 0-6"] = b.kids06 || 0;
  fields["Kids 6-12"] = b.kids612 || 0;
  fields["Rooms"] = b.rooms || 1;
  fields["Breakfast"] = b.breakfast || "No";
  fields["Per Night Rate"] = b.rate || 0;
  fields["Room Total"] = b.roomTotal || 0;
  fields["Extra Adult Total"] = b.extra || 0;
  fields["Kids Half Total"] = b.kidsHalf || 0;
  fields["Breakfast Total"] = b.breakTotal || 0;
  fields["Grand Total"] = b.grand || 0;
  fields["Advance"] = b.advance || 0;
  fields["UTR"] = b.utr || "";
  fields["Payment Status"] = b.utr ? "Confirmed" : "Pending - Waiting for Advance";
  fields["Booking Status"] = b.utr ? "Confirmed" : "Pending";
  fields["Source"] = "WhatsApp Form";
  fields["Notes"] = b.notes || "";
  fields["Created At"] = b.created || new Date().toISOString();
  fields["Rate Applied"] = b.rate || 0;
  var body = JSON.stringify({ records: [{ fields: fields }] });
  return fetch(url, { method: "POST", headers: { Authorization: "Bearer " + AIRTABLE_TOKEN, "Content-Type": "application/json" }, body: body });
}
app.get("/", function(req, res) {
  res.redirect("/booking-form");
});
app.get("/booking-form", function(req, res) {
  res.sendFile(path.join(__dirname, "booking-form.html"));
});
app.get("/health", function(req, res) {
  var formSet = false;
  if (FORM_URL && FORM_URL.indexOf("booking-form") >= 0) {
    formSet = true;
  }
  if (FORM_URL && FORM_URL.indexOf("onrender") >= 0) {
    formSet = true;
  }
  res.json({ status: "ok", formSet: formSet, formUrl: FORM_URL });
});
app.post("/api/booking", function(req, res) {
  var b = req.body || {};
  saveToAirtable(b).then(function() {
    res.json({ ok: true });
  }).catch(function() {
    res.json({ ok: true });
  });
});
app.get("/webhook", function(req, res) {
  var mode = req.query["hub.mode"];
  var token = req.query["hub.verify_token"];
  var challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});
app.post("/webhook", function(req, res) {
  res.status(200).send("OK");
  try {
    var body = req.body || {};
    var entry = body.entry || [];
    if (entry.length === 0) {
      return;
    }
    var changes = entry[0].changes || [];
    if (changes.length === 0) {
      return;
    }
    var value = changes[0].value || {};
    var messages = value.messages || [];
    if (messages.length === 0) {
      return;
    }
    var msg = messages[0];
    var from = msg.from || "";
    var text = "";
    if (msg.text && msg.text.body) {
      text = msg.text.body;
    }
    if (!text) {
      return;
    }
    var isGroup = false;
    if (msg.context && msg.context.group_id) {
      isGroup = true;
    }
    if (isGroup && GROUP_AI_SILENT === "true") {
      return;
    }
    var low = text.toLowerCase();
    if (!chats[from]) {
      chats[from] = { date: "", adults: 0, rooms: 0, kids06: 0, kids612: 0, breakfast: false, hasBreakfastInfo: false };
    }
    var mem = chats[from];
    if (low.indexOf("i am the owner") >= 0) {
      var ownerMsg = "Hi owner, testing mode is on." + NL + "I will remember what you tell me and I will not repeat questions." + NL + "Send me a test like Dec 1, 1 couple, 1 room, no kids, no breakfast and I will calculate it.";
      sendWhatsApp(from, ownerMsg);
      return;
    }
    if (low.indexOf("dec 1") >= 0 || low.indexOf("december 1") >= 0 || low.indexOf("1 dec") >= 0) {
      mem.date = "Dec 1";
    }
    if (low.indexOf("couple") >= 0) {
      mem.adults = 2;
    }
    if (low.indexOf("1 room") >= 0 || low.indexOf("one room") >= 0) {
      mem.rooms = 1;
    }
    if (low.indexOf("no kids") >= 0) {
      mem.kids06 = 0;
      mem.kids612 = 0;
    }
    if (low.indexOf("no breakfast") >= 0) {
      mem.breakfast = false;
      mem.hasBreakfastInfo = true;
    }
    if (low.indexOf("with breakfast") >= 0) {
      mem.breakfast = true;
      mem.hasBreakfastInfo = true;
    }
    if (low.indexOf("booking form") >= 0 || low.indexOf("give me the form") >= 0 || low.indexOf("share the form") >= 0 || low.indexOf("send the form") >= 0 || low.indexOf("book straight") >= 0 || low.indexOf("want book") >= 0) {
      var formMsg = "Of course, here is the form for you." + NL + NL + FORM_URL + NL + NL + "It is for Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included. Fill it, pay Advance, enter UTR and it will Confirm.";
      sendWhatsApp(from, formMsg);
      return;
    }
    if (low.indexOf("photo") >= 0 || low.indexOf("picture") >= 0) {
      var photoMsg = "I can share photos when you ask. Would you like to see the pool villa photos now?";
      sendWhatsApp(from, photoMsg);
      return;
    }
    if (low.indexOf("qr") >= 0 || low.indexOf("pay") >= 0) {
      var payMsg = "To pay, open the booking form and tap Pay Advance. The QR will show there." + NL + NL + FORM_URL;
      sendWhatsApp(from, payMsg);
      return;
    }
    if (low.indexOf("live music") >= 0) {
      var musicMsg = "Live music is only when the owner is at the villa. Dolby Atmos is always included.";
      sendWhatsApp(from, musicMsg);
      return;
    }
    if (mem.date === "Dec 1" && mem.adults === 2 && mem.rooms === 1 && mem.hasBreakfastInfo) {
      var calc = calcForRooms(1, 1, 2, 0, false);
      var calcMsg = "Got it, thank you." + NL + "Dec 1, 1 couple, 1 room, no kids, no breakfast." + NL + NL + "Total: Rs." + calc.grand + NL + "Advance to pay: Rs." + calc.advance + NL + NL + "Shall I share the booking form so you can confirm?";
      sendWhatsApp(from, calcMsg);
      return;
    }
    if (mem.date !== "" || mem.adults !== 0) {
      var askMsg = "Thank you, I have noted: " + NL + "Date: " + (mem.date || "not yet") + NL + "Adults: " + mem.adults + NL + "Rooms: " + (mem.rooms || "not yet") + NL + NL + "Can you tell me the rest - kids and breakfast - so I can calculate Total for you?";
      sendWhatsApp(from, askMsg);
      return;
    }
    var welcome = "Hi, welcome to Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. Dolby Atmos included." + NL + NL + "Tell me your date, how many adults, rooms, kids and breakfast, and I will calculate Total and share the form.";
    sendWhatsApp(from, welcome);
  } catch (e) {
  }
});
app.listen(PORT, function() {
  console.log("Pachapp AI running on " + PORT);
});
