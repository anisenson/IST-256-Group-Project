// server.js - Node.js service for the Returns page. Run: node server.js  then open http://localhost:3000/returns.html
const express = require("express");
const fs = require("fs");

const app = express();
const FILE = "returns-data.json";

app.use(express.json());
app.use(express.static(__dirname));

function readReturns() {
    return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
}

// List every saved return
app.get("/api/returns", function (req, res) {
    res.json(readReturns());
});

// Save a new return
app.post("/api/returns", function (req, res) {
    const body = req.body;

    if (!body.customerName || !body.email || !body.reason || !body.condition || !body.items || body.items.length === 0) {
        return res.status(400).json({ error: "Missing required return details." });
    }

    const returns = readReturns();
    const saved = Object.assign({ id: "RET-" + (returns.length + 1) }, body);

    returns.push(saved);
    fs.writeFileSync(FILE, JSON.stringify(returns, null, 2));
    res.status(201).json(saved);
});

app.listen(3000, function () {
    console.log("Server running at http://localhost:3000");
});