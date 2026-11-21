const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
var PORT = process.env.PORT || 10000;
var FORM_URL = process.env.FORM_URL || "https://pachapp-ai-1.onrender.com/booking-form";
app.get("/", function(req, res) {
res.redirect("/booking-form");
});
app.get("/booking-form", function(req, res) {
res.sendFile(path.join(__dirname, "booking-form.html"));
});
app.get("/health", function(req, res) {
res.json({ status: "ok", formSet: true, formUrl: FORM_URL });
});
app.post("/api/booking", function(req, res) {
res.json({ ok: true });
});
app.listen(PORT, function() {
console.log("Pachapp AI running on " + PORT);
});
