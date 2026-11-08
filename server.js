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

// ===== Billing Details (Nasser Almalki) =====
// Saves billing info to billing-data.json. For safety the full card number
// and security code are never saved, only the last 4 digits of the card.
const BILLING_FILE = "billing-data.json";

function readBilling() {
    return fs.existsSync(BILLING_FILE) ? JSON.parse(fs.readFileSync(BILLING_FILE, "utf8")) : [];
}

// List every saved billing record
app.get("/api/billing", function (req, res) {
    res.json(readBilling());
});

// Receive and process new billing details
app.post("/api/billing", function (req, res) {
    const b = req.body;
    const cardDigits = String(b.cardNumber || "").replace(/\D/g, "");

    // Server-side checks, in case someone skips the page's validation
    if (!b.fullName || !b.address || !b.city || !b.state || !b.zip) {
        return res.status(400).json({ error: "Missing name or address." });
    }
    if (cardDigits.length < 13 || cardDigits.length > 19) {
        return res.status(400).json({ error: "Card number must be 13 to 19 digits." });
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(b.expiration || "")) {
        return res.status(400).json({ error: "Expiration date must be MM/YY." });
    }
    if (!/^\d{3,4}$/.test(b.securityCode || "")) {
        return res.status(400).json({ error: "Security code must be 3 or 4 digits." });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
        return res.status(400).json({ error: "The order has no items." });
    }

    const records = readBilling();

    // Build the record to save (no full card number, no security code)
    const saved = {
        id: "BILL-" + (records.length + 1),
        fullName: b.fullName,
        address: b.address,
        city: b.city,
        state: b.state,
        zip: b.zip,
        payment: {
            cardLast4: cardDigits.slice(-4),
            expiration: b.expiration
        },
        items: b.items,
        shippingMethod: b.shippingMethod || "Standard",
        total: b.total,
        createdAt: new Date().toISOString()
    };

    records.push(saved);
    fs.writeFileSync(BILLING_FILE, JSON.stringify(records, null, 2));
    res.status(201).json(saved);
});
// Approve or reject an existing proposal.
app.patch("/api/submissions/:id", function (req, res) {
    const status = (req.body || {}).status;

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
            error: "Status must be approved or rejected."
        });
    }

    try {
        const submissions = readSubmissions();

        const item = submissions.find(function (proposal) {
            return proposal.id === req.params.id;
        });

        if (!item) {
            return res.status(404).json({
                error: "Proposal not found."
            });
        }

        item.status = status;
        item.updatedAt = new Date().toISOString();

        fs.writeFileSync(
            SUBMISSIONS_FILE,
            JSON.stringify(submissions, null, 2),
            "utf8"
        );

        return res.json(item);
    } catch (error) {
        console.error("Could not update proposal:", error.message);

        return res.status(500).json({
            error: "The proposal could not be updated."
        });
    }
});
app.listen(3000, function () {
    console.log("Server running at http://localhost:3000");
});
// ===== Activity Proposal Submission =====

// Store submissions in a JSON file beside server.js.
const SUBMISSIONS_FILE = require("path").join(
    __dirname,
    "submissions-data.json"
);

const { randomUUID } = require("crypto");

const proposalCategories = [
    "Python",
    "HTML/CSS",
    "JavaScript",
    "SQL",
    "Other"
];

// Read saved proposals.
function readSubmissions() {
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
        return [];
    }

    const data = JSON.parse(
        fs.readFileSync(SUBMISSIONS_FILE, "utf8")
    );

    if (!Array.isArray(data)) {
        throw new Error("Submission data must be an array.");
    }

    return data;
}

// Create a proposal.
app.post("/api/submissions", function (req, res) {
    const body = req.body || {};

    // Only accept the expected text fields.
    const data = {};

    ["title", "speaker", "email", "category", "abstract"].forEach(
        function (field) {
            data[field] =
                typeof body[field] === "string"
                    ? body[field].trim()
                    : "";
        }
    );

    // Server-side validation.
    if (data.title.length < 3 || data.title.length > 100) {
        return res.status(400).json({
            error: "Title must be between 3 and 100 characters."
        });
    }

    if (data.speaker.length < 2 || data.speaker.length > 100) {
        return res.status(400).json({
            error: "Speaker name must be between 2 and 100 characters."
        });
    }

    if (
        data.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
        return res.status(400).json({
            error: "A valid email address is required."
        });
    }

    if (!proposalCategories.includes(data.category)) {
        return res.status(400).json({
            error: "Please select a valid category."
        });
    }

    if (data.abstract.length < 20 || data.abstract.length > 1000) {
        return res.status(400).json({
            error: "Description must be between 20 and 1000 characters."
        });
    }

    try {
        const submissions = readSubmissions();

        const saved = {
            id: randomUUID(),
            ...data,
            status: "pending",
            createdAt: new Date().toISOString()
        };

        submissions.push(saved);

        fs.writeFileSync(
            SUBMISSIONS_FILE,
            JSON.stringify(submissions, null, 2),
            "utf8"
        );

        return res.status(201).json(saved);
    } catch (error) {
        console.error("Could not save proposal:", error.message);

        return res.status(500).json({
            error: "The proposal could not be saved."
        });
    }
});

// List proposals for the approval page.
app.get("/api/submissions", function (req, res) {
    try {
        return res.json(readSubmissions());
    } catch (error) {
        console.error("Could not read proposals:", error.message);

        return res.status(500).json({
            error: "The proposals could not be loaded."
        });
    }
});