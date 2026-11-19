// server.js
// REST API for the Coding Club site, storing its data in MySQL.
//
// RUN:   node server.js     then open  http://localhost:3000
//
// Three entities, each with full CRUD (Create, Read, Update, Delete):
//
//   Entity        Table(s)                       URL
//   ------------  -----------------------------  ---------------------
//   Submissions   submissions                    /api/submissions
//   Returns       product_returns + return_items /api/returns
//   Billing       billing + billing_items        /api/billing
//
//   Operation   HTTP method   URL                        Meaning
//   ---------   -----------   -------------------------  ---------------------------
//   Create      POST          /api/<entity>              add a new record
//   Read        GET           /api/<entity>              list every record
//   Read        GET           /api/<entity>/:id          one record
//   Update      PUT           /api/<entity>/:id          change a record's fields
//   Update      PATCH         /api/submissions/:id       approve / reject (status only)
//   Delete      DELETE        /api/<entity>/:id          remove a record
//
// The JSON each route sends back has the same shape as before the database was
// added (same field names, ids like "RET-1" and "BILL-1"), so the existing pages
// keep working without changes.
//
// This file relies on Express 5: when an async route handler throws or a
// database call fails, Express 5 passes the error to the error handler at the
// bottom of this file automatically. (Express 4 would NOT do this.)

require("dotenv").config(); // load DB_* settings from .env
const express = require("express");
const { randomUUID } = require("crypto");
const path = require("path");
const pool = require("./db"); // shared MySQL connection pool

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies into req.body.
app.use(express.json());

// Serve the HTML/CSS/JS pages from the /public folder only.
// dotfiles: "deny" makes sure a file like .env can never be downloaded.
app.use(express.static(path.join(__dirname, "public"), { dotfiles: "deny" }));

// ===========================================================================
// Shared helpers
// ===========================================================================

// Return a trimmed string, or "" if the value is not a string.
function text(value) {
    return typeof value === "string" ? value.trim() : "";
}

// Round to 2 decimal places so money does not pick up floating-point noise
// (for example 0.1 + 0.2 becomes 0.3, not 0.30000000000000004).
function roundMoney(number) {
    return Math.round(number * 100) / 100;
}

// The database stores plain numbers (1, 2, 3) but the API shows prefixed ids
// ("RET-1"). formatId builds the prefixed id; parseId reverses it.
function formatId(prefix, number) {
    return prefix + "-" + number;
}

// parseId("RET", "RET-12") -> 12.  Returns null if the text is not a valid id.
function parseId(prefix, value) {
    const match = new RegExp("^" + prefix + "-(\\d+)$").exec(String(value));
    return match ? Number(match[1]) : null;
}

// Check string lengths against the column sizes in schema.sql.
// Without this, an over-long value would make MySQL fail with a 500 error;
// this way the user gets a clear 400 message instead.
// Returns an error message, or null when everything fits.
function checkLengths(data, limits) {
    for (const field of Object.keys(limits)) {
        if (data[field].length > limits[field]) {
            return field + " must be " + limits[field] + " characters or fewer.";
        }
    }
    return null;
}

// Run several queries as ONE all-or-nothing unit (a transaction).
// Saving a return or an order writes to two tables; if the second write fails,
// the first is undone, so we never end up with an order that has no items.
// `work` receives a connection and must use it for every query inside.
async function inTransaction(work) {
    const connection = await pool.getConnection(); // borrow one connection
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit(); // make all the changes permanent
        return result;
    } catch (error) {
        await connection.rollback(); // undo everything since beginTransaction
        throw error; // let the error handler respond with a 500
    } finally {
        connection.release(); // always give the connection back to the pool
    }
}

// ===========================================================================
// SUBMISSIONS  (submission.html and approval.html)
// ===========================================================================

const SUBMISSION_CATEGORIES = ["Python", "HTML/CSS", "JavaScript", "SQL", "Other"];

// Column sizes from schema.sql (abstract is validated separately below).
const SUBMISSION_LIMITS = { title: 100, speaker: 100, email: 254 };

// Turn a database row (snake_case column names) into the JSON the pages expect.
function toSubmission(row) {
    return {
        id: row.id,
        title: row.title,
        speaker: row.speaker,
        email: row.email,
        category: row.category,
        abstract: row.abstract,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at // null until the proposal is edited
    };
}

// Copy only the expected fields out of the request body, trimmed.
// Anything else the client sends (such as a fake "status") is ignored.
function readSubmissionFields(body) {
    const data = {};
    ["title", "speaker", "email", "category", "abstract"].forEach(function (field) {
        data[field] = text((body || {})[field]);
    });
    return data;
}

// Server-side validation, in case someone skips the page's own checks.
// Returns an error message, or null if the data is valid.
function validateSubmission(data) {
    if (data.title.length < 3 || data.title.length > 100) {
        return "Title must be between 3 and 100 characters.";
    }
    if (data.speaker.length < 2 || data.speaker.length > 100) {
        return "Speaker name must be between 2 and 100 characters.";
    }
    if (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return "A valid email address is required.";
    }
    if (!SUBMISSION_CATEGORIES.includes(data.category)) {
        return "Please select a valid category.";
    }
    if (data.abstract.length < 20 || data.abstract.length > 1000) {
        return "Description must be between 20 and 1000 characters.";
    }
    return null;
}

// Fetch one submission by id, or undefined if it does not exist.
async function findSubmission(id) {
    const [rows] = await pool.query("SELECT * FROM submissions WHERE id = ?", [id]);
    return rows.length > 0 ? toSubmission(rows[0]) : undefined;
}

// READ (list): every proposal, oldest first. Used by approval.html.
app.get("/api/submissions", async function (req, res) {
    const [rows] = await pool.query("SELECT * FROM submissions ORDER BY created_at, id");
    res.json(rows.map(toSubmission));
});

// READ (one): a single proposal.
app.get("/api/submissions/:id", async function (req, res) {
    const submission = await findSubmission(req.params.id);
    if (!submission) {
        return res.status(404).json({ error: "Proposal not found." });
    }
    res.json(submission);
});

// CREATE: save a new proposal. New proposals always start as "pending".
app.post("/api/submissions", async function (req, res) {
    const data = readSubmissionFields(req.body);
    const problem = validateSubmission(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const id = randomUUID();
    // The ? marks are filled from the array, in order. The driver escapes the
    // values, which prevents SQL injection. Never build SQL by joining strings.
    await pool.query(
        "INSERT INTO submissions (id, title, speaker, email, category, abstract) VALUES (?, ?, ?, ?, ?, ?)",
        [id, data.title, data.speaker, data.email, data.category, data.abstract]
    );

    res.status(201).json(await findSubmission(id));
});

// UPDATE (edit): replace a proposal's text fields. Status is NOT changed here;
// use the PATCH route below for approve / reject.
app.put("/api/submissions/:id", async function (req, res) {
    if (!(await findSubmission(req.params.id))) {
        return res.status(404).json({ error: "Proposal not found." });
    }

    const data = readSubmissionFields(req.body);
    const problem = validateSubmission(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    await pool.query(
        "UPDATE submissions SET title = ?, speaker = ?, email = ?, category = ?, abstract = ? WHERE id = ?",
        [data.title, data.speaker, data.email, data.category, data.abstract, req.params.id]
    );

    res.json(await findSubmission(req.params.id));
});

// UPDATE (status only): approve or reject a proposal. Used by approval.html.
app.patch("/api/submissions/:id", async function (req, res) {
    const status = (req.body || {}).status;
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be approved or rejected." });
    }

    if (!(await findSubmission(req.params.id))) {
        return res.status(404).json({ error: "Proposal not found." });
    }

    await pool.query("UPDATE submissions SET status = ? WHERE id = ?", [status, req.params.id]);

    res.json(await findSubmission(req.params.id));
});

// DELETE: remove a proposal. 204 means "done, nothing to send back".
app.delete("/api/submissions/:id", async function (req, res) {
    if (!(await findSubmission(req.params.id))) {
        return res.status(404).json({ error: "Proposal not found." });
    }

    await pool.query("DELETE FROM submissions WHERE id = ?", [req.params.id]);
    res.status(204).end();
});

// ===========================================================================
// RETURNS  (returns.html)
// A return is one row in product_returns plus one row per product in return_items.
// ===========================================================================

const RETURN_LIMITS = { customerName: 100, email: 254, reason: 255, condition: 100 };

// Build the API shape from a product_returns row and its return_items rows.
function toReturn(row, itemRows) {
    return {
        id: formatId("RET", row.id),
        customerName: row.customer_name,
        email: row.email,
        reason: row.reason,
        condition: row.item_condition,
        comments: row.comments || "",
        items: itemRows.map(function (item) {
            return {
                productId: item.product_id,
                productName: item.product_name,
                price: Number(item.price) // MySQL returns DECIMAL as text
            };
        }),
        total: Number(row.total),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// Load returns together with their items. Pass a numeric id for one return,
// or nothing for all of them. Always returns an array (empty if none found).
// Uses two queries (returns, then all their items) instead of one query per
// return, which would be much slower for long lists.
async function findReturns(id) {
    const [rows] =
        id === undefined
            ? await pool.query("SELECT * FROM product_returns ORDER BY id")
            : await pool.query("SELECT * FROM product_returns WHERE id = ?", [id]);

    if (rows.length === 0) {
        return [];
    }

    // "IN (?)" with an array expands to IN (1, 2, 3).
    const [items] = await pool.query(
        "SELECT * FROM return_items WHERE return_id IN (?) ORDER BY id",
        [rows.map(function (row) { return row.id; })]
    );

    return rows.map(function (row) {
        return toReturn(row, items.filter(function (item) { return item.return_id === row.id; }));
    });
}

// Read the editable return fields (not the items) from a request body.
function readReturnFields(body) {
    const b = body || {};
    return {
        customerName: text(b.customerName),
        email: text(b.email),
        reason: text(b.reason),
        condition: text(b.condition),
        comments: text(b.comments)
    };
}

// Same rules as the original server: these four fields are required.
function validateReturnFields(data) {
    if (!data.customerName || !data.email || !data.reason || !data.condition) {
        return "Missing required return details.";
    }
    return checkLengths(data, RETURN_LIMITS);
}

// Clean up the items array from the request. Returns { items } when valid,
// or { error } with a message when it is not.
function readReturnItems(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { error: "Missing required return details." };
    }

    const items = [];
    for (const raw of rawItems) {
        const item = {
            productId: String((raw || {}).productId === undefined ? "" : raw.productId).trim(),
            productName: text((raw || {}).productName),
            price: Number((raw || {}).price)
        };
        if (!item.productId || !item.productName || !Number.isFinite(item.price) || item.price < 0) {
            return { error: "Each returned item needs a product id, a name, and a price." };
        }
        if (item.productId.length > 50 || item.productName.length > 150) {
            return { error: "A product id or name is too long." };
        }
        items.push(item);
    }
    return { items: items };
}

// READ (list)
app.get("/api/returns", async function (req, res) {
    res.json(await findReturns());
});

// READ (one)
app.get("/api/returns/:id", async function (req, res) {
    const id = parseId("RET", req.params.id);
    const found = id === null ? [] : await findReturns(id);
    if (found.length === 0) {
        return res.status(404).json({ error: "Return not found." });
    }
    res.json(found[0]);
});

// CREATE: save a new return and its items in one transaction.
app.post("/api/returns", async function (req, res) {
    const data = readReturnFields(req.body);
    const problem = validateReturnFields(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const parsed = readReturnItems((req.body || {}).items);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    // The server works out the total itself instead of trusting the browser.
    const total = roundMoney(
        parsed.items.reduce(function (sum, item) { return sum + item.price; }, 0)
    );

    const newId = await inTransaction(async function (connection) {
        const [result] = await connection.query(
            "INSERT INTO product_returns (customer_name, email, reason, item_condition, comments, total) VALUES (?, ?, ?, ?, ?, ?)",
            [data.customerName, data.email, data.reason, data.condition, data.comments, total]
        );

        // "VALUES ?" with an array of arrays inserts many rows in one statement.
        await connection.query(
            "INSERT INTO return_items (return_id, product_id, product_name, price) VALUES ?",
            [parsed.items.map(function (item) {
                return [result.insertId, item.productId, item.productName, item.price];
            })]
        );

        return result.insertId; // the id MySQL just generated
    });

    const saved = await findReturns(newId);
    res.status(201).json(saved[0]);
});

// UPDATE: change the customer details, reason, condition and comments.
// The returned items are not editable; delete the return and create a new one.
app.put("/api/returns/:id", async function (req, res) {
    const id = parseId("RET", req.params.id);
    if (id === null || (await findReturns(id)).length === 0) {
        return res.status(404).json({ error: "Return not found." });
    }

    const data = readReturnFields(req.body);
    const problem = validateReturnFields(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    await pool.query(
        "UPDATE product_returns SET customer_name = ?, email = ?, reason = ?, item_condition = ?, comments = ? WHERE id = ?",
        [data.customerName, data.email, data.reason, data.condition, data.comments, id]
    );

    res.json((await findReturns(id))[0]);
});

// DELETE: remove a return. Its return_items rows are deleted automatically
// because of ON DELETE CASCADE in schema.sql.
app.delete("/api/returns/:id", async function (req, res) {
    const id = parseId("RET", req.params.id);
    if (id === null || (await findReturns(id)).length === 0) {
        return res.status(404).json({ error: "Return not found." });
    }

    await pool.query("DELETE FROM product_returns WHERE id = ?", [id]);
    res.status(204).end();
});

// ===========================================================================
// BILLING  (billing.html)
// An order is one row in billing plus one row per product in billing_items.
// For safety, the full card number and security code are never saved:
// only the last 4 digits and the expiration date.
// ===========================================================================

const BILLING_LIMITS = { fullName: 100, address: 255, city: 100, state: 50, zip: 20, shippingMethod: 50 };

function toBilling(row, itemRows) {
    return {
        id: formatId("BILL", row.id),
        fullName: row.full_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        payment: {
            cardLast4: row.card_last4,
            expiration: row.card_expiration
        },
        items: itemRows.map(function (item) {
            return {
                id: item.product_id,
                title: item.title,
                price: Number(item.price),
                quantity: item.quantity
            };
        }),
        shippingMethod: row.shipping_method,
        total: Number(row.total),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// Same two-query pattern as findReturns. Pass a numeric id or nothing for all.
async function findBilling(id) {
    const [rows] =
        id === undefined
            ? await pool.query("SELECT * FROM billing ORDER BY id")
            : await pool.query("SELECT * FROM billing WHERE id = ?", [id]);

    if (rows.length === 0) {
        return [];
    }

    const [items] = await pool.query(
        "SELECT * FROM billing_items WHERE billing_id IN (?) ORDER BY id",
        [rows.map(function (row) { return row.id; })]
    );

    return rows.map(function (row) {
        return toBilling(row, items.filter(function (item) { return item.billing_id === row.id; }));
    });
}

// Read the editable billing fields (name, address, shipping) from a request body.
function readBillingFields(body) {
    const b = body || {};
    return {
        fullName: text(b.fullName),
        address: text(b.address),
        city: text(b.city),
        state: text(b.state),
        zip: text(b.zip),
        shippingMethod: text(b.shippingMethod) || "Standard"
    };
}

function validateBillingFields(data) {
    if (!data.fullName || !data.address || !data.city || !data.state || !data.zip) {
        return "Missing name or address.";
    }
    return checkLengths(data, BILLING_LIMITS);
}

// Clean up the order items. The cart page sends { id, title, price, quantity }.
// Returns { items } when valid, or { error } when not.
function readBillingItems(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { error: "The order has no items." };
    }

    const items = [];
    for (const raw of rawItems) {
        const r = raw || {};
        const productId = r.id === undefined || r.id === null ? null : String(r.id).trim();
        const item = {
            productId: productId || null,
            title: text(r.title),
            price: Number(r.price),
            quantity: r.quantity === undefined ? 1 : Number(r.quantity)
        };
        if (
            !item.title ||
            !Number.isFinite(item.price) || item.price < 0 ||
            !Number.isInteger(item.quantity) || item.quantity < 1
        ) {
            return { error: "Each order item needs a title, a price, and a whole-number quantity." };
        }
        if (item.title.length > 150 || (item.productId && item.productId.length > 50)) {
            return { error: "An item title or id is too long." };
        }
        items.push(item);
    }
    return { items: items };
}

// READ (list)
app.get("/api/billing", async function (req, res) {
    res.json(await findBilling());
});

// READ (one)
app.get("/api/billing/:id", async function (req, res) {
    const id = parseId("BILL", req.params.id);
    const found = id === null ? [] : await findBilling(id);
    if (found.length === 0) {
        return res.status(404).json({ error: "Billing record not found." });
    }
    res.json(found[0]);
});

// CREATE: receive billing details from billing.html and save the order.
app.post("/api/billing", async function (req, res) {
    const b = req.body || {};
    const cardDigits = String(b.cardNumber || "").replace(/\D/g, "");

    // Checks the page already makes, repeated here in case someone skips the page.
    const data = readBillingFields(b);
    const problem = validateBillingFields(data);
    if (problem) {
        return res.status(400).json({ error: problem });
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

    const parsed = readBillingItems(b.items);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    // The total includes shipping, which only the page knows, so we accept the
    // browser's number but make sure it is a sensible non-negative amount.
    const total = Number(b.total);
    if (!Number.isFinite(total) || total < 0) {
        return res.status(400).json({ error: "The order total is not valid." });
    }

    const newId = await inTransaction(async function (connection) {
        const [result] = await connection.query(
            "INSERT INTO billing (full_name, address, city, state, zip, card_last4, card_expiration, shipping_method, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                data.fullName, data.address, data.city, data.state, data.zip,
                cardDigits.slice(-4), // ONLY the last 4 digits are kept
                b.expiration,
                data.shippingMethod,
                roundMoney(total)
            ]
        );

        await connection.query(
            "INSERT INTO billing_items (billing_id, product_id, title, price, quantity) VALUES ?",
            [parsed.items.map(function (item) {
                return [result.insertId, item.productId, item.title, item.price, item.quantity];
            })]
        );

        return result.insertId;
    });

    const saved = await findBilling(newId);
    res.status(201).json(saved[0]);
});

// UPDATE: correct the name, address or shipping method on an order.
// Card details, items and total cannot be edited after the order is saved.
app.put("/api/billing/:id", async function (req, res) {
    const id = parseId("BILL", req.params.id);
    if (id === null || (await findBilling(id)).length === 0) {
        return res.status(404).json({ error: "Billing record not found." });
    }

    const data = readBillingFields(req.body);
    const problem = validateBillingFields(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    await pool.query(
        "UPDATE billing SET full_name = ?, address = ?, city = ?, state = ?, zip = ?, shipping_method = ? WHERE id = ?",
        [data.fullName, data.address, data.city, data.state, data.zip, data.shippingMethod, id]
    );

    res.json((await findBilling(id))[0]);
});

// DELETE: remove an order. billing_items rows go with it (ON DELETE CASCADE).
app.delete("/api/billing/:id", async function (req, res) {
    const id = parseId("BILL", req.params.id);
    if (id === null || (await findBilling(id)).length === 0) {
        return res.status(404).json({ error: "Billing record not found." });
    }

    await pool.query("DELETE FROM billing WHERE id = ?", [id]);
    res.status(204).end();
});

// ===========================================================================
// PRODUCTS AND SHOPPING CART (Nasser Almalki)
// ===========================================================================

// Turn a products row into the same JSON shape as products.json.
function toProduct(row) {
    return {
        id: row.id,
        title: row.title,
        category: row.category,
        format: row.format,
        price: Number(row.price), // MySQL returns DECIMAL as text
        notes: row.notes || ""
    };
}

// Read and check product fields. Returns { data } or { error }.
function readProduct(body) {
    const b = body || {};
    const data = {
        title: text(b.title),
        category: text(b.category),
        format: text(b.format),
        price: Number(b.price),
        notes: text(b.notes)
    };
    if (!data.title || !data.category || !data.format) {
        return { error: "Title, category, and format are required." };
    }
    if (!Number.isFinite(data.price) || data.price < 0) {
        return { error: "Price must be 0 or more." };
    }
    if (data.title.length > 150 || data.category.length > 50 ||
        data.format.length > 50 || data.notes.length > 255) {
        return { error: "One of the fields is too long." };
    }
    data.price = roundMoney(data.price);
    return { data: data };
}

// READ: list every product (the cart page can load these instead of products.json)
app.get("/api/products", async function (req, res) {
    const [rows] = await pool.query("SELECT * FROM products ORDER BY id");
    res.json(rows.map(toProduct));
});

// READ: one product
app.get("/api/products/:id", async function (req, res) {
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
        return res.status(404).json({ error: "Product not found." });
    }
    res.json(toProduct(rows[0]));
});

// CREATE: add a new product. The id must look like P009.
app.post("/api/products", async function (req, res) {
    const id = text((req.body || {}).id).toUpperCase();
    if (!/^P\d{3,}$/.test(id)) {
        return res.status(400).json({ error: "Product id must look like P009." });
    }
    const parsed = readProduct(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    const [taken] = await pool.query("SELECT id FROM products WHERE id = ?", [id]);
    if (taken.length > 0) {
        return res.status(409).json({ error: "That product id is already used." });
    }
    const p = parsed.data;
    await pool.query(
        "INSERT INTO products (id, title, category, format, price, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [id, p.title, p.category, p.format, p.price, p.notes || null]
    );
    res.status(201).json({ id: id, title: p.title, category: p.category, format: p.format, price: p.price, notes: p.notes });
});

// UPDATE: change a product's details (the id stays the same)
app.put("/api/products/:id", async function (req, res) {
    const parsed = readProduct(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    const p = parsed.data;
    const [result] = await pool.query(
        "UPDATE products SET title = ?, category = ?, format = ?, price = ?, notes = ? WHERE id = ?",
        [p.title, p.category, p.format, p.price, p.notes || null, req.params.id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Product not found." });
    }
    res.json({ id: req.params.id, title: p.title, category: p.category, format: p.format, price: p.price, notes: p.notes });
});

// DELETE: remove a product
app.delete("/api/products/:id", async function (req, res) {
    const [result] = await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Product not found." });
    }
    res.status(204).end();
});

// Turn a carts row and its item rows into JSON. Cart ids look like CART-1.
function toCart(row, itemRows) {
    return {
        id: formatId("CART", row.id),
        items: itemRows.map(function (item) {
            return {
                id: item.product_id,
                title: item.title,
                price: Number(item.price),
                quantity: item.quantity,
                subtotal: roundMoney(Number(item.price) * item.quantity)
            };
        }),
        total: Number(row.total),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// Load carts with their items. Pass a number for one cart, or nothing for all.
async function findCarts(id) {
    const [rows] =
        id === undefined
            ? await pool.query("SELECT * FROM carts ORDER BY id")
            : await pool.query("SELECT * FROM carts WHERE id = ?", [id]);
    if (rows.length === 0) {
        return [];
    }
    const [items] = await pool.query(
        "SELECT * FROM cart_items WHERE cart_id IN (?) ORDER BY id",
        [rows.map(function (row) { return row.id; })]
    );
    return rows.map(function (row) {
        return toCart(row, items.filter(function (item) { return item.cart_id === row.id; }));
    });
}

// Check the cart items. cart.html sends an array of items; { items: [...] } also works.
// Returns { items, total } or { error }.
function readCartItems(body) {
    const list = Array.isArray(body) ? body : (body || {}).items;
    if (!Array.isArray(list) || list.length === 0) {
        return { error: "The cart is empty." };
    }
    const items = [];
    let total = 0;
    for (const raw of list) {
        const r = raw || {};
        const item = {
            id: text(String(r.id || "")),
            title: text(r.title),
            price: Number(r.price),
            quantity: Number(r.quantity)
        };
        if (!item.id || !item.title || item.id.length > 10 || item.title.length > 150) {
            return { error: "Each cart item needs a product id and a title." };
        }
        if (!Number.isFinite(item.price) || item.price < 0) {
            return { error: "Each cart item needs a price of 0 or more." };
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            return { error: "Quantity must be a whole number of 1 or more." };
        }
        // The server works out the total itself instead of trusting the browser.
        total += item.price * item.quantity;
        items.push(item);
    }
    return { items: items, total: roundMoney(total) };
}

// Save cart items for one cart (used by create and update).
async function insertCartItems(connection, cartId, items) {
    await connection.query(
        "INSERT INTO cart_items (cart_id, product_id, title, price, quantity) VALUES ?",
        [items.map(function (item) {
            return [cartId, item.id, item.title, item.price, item.quantity];
        })]
    );
}

// READ: list every saved cart
app.get("/api/cart", async function (req, res) {
    res.json(await findCarts());
});

// READ: one cart
app.get("/api/cart/:id", async function (req, res) {
    const id = parseId("CART", req.params.id);
    const found = id === null ? [] : await findCarts(id);
    if (found.length === 0) {
        return res.status(404).json({ error: "Cart not found." });
    }
    res.json(found[0]);
});

// CREATE: save the cart sent by the "Submit Cart" button on cart.html
app.post("/api/cart", async function (req, res) {
    const parsed = readCartItems(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    const newId = await inTransaction(async function (connection) {
        const [result] = await connection.query("INSERT INTO carts (total) VALUES (?)", [parsed.total]);
        await insertCartItems(connection, result.insertId, parsed.items);
        return result.insertId;
    });
    res.status(201).json((await findCarts(newId))[0]);
});

// UPDATE: replace the items in a saved cart (for example, new quantities)
app.put("/api/cart/:id", async function (req, res) {
    const id = parseId("CART", req.params.id);
    if (id === null || (await findCarts(id)).length === 0) {
        return res.status(404).json({ error: "Cart not found." });
    }
    const parsed = readCartItems(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }
    await inTransaction(async function (connection) {
        await connection.query("DELETE FROM cart_items WHERE cart_id = ?", [id]);
        await insertCartItems(connection, id, parsed.items);
        await connection.query("UPDATE carts SET total = ? WHERE id = ?", [parsed.total, id]);
    });
    res.json((await findCarts(id))[0]);
});

// DELETE: remove a cart. Its cart_items rows go with it (ON DELETE CASCADE).
app.delete("/api/cart/:id", async function (req, res) {
    const id = parseId("CART", req.params.id);
    if (id === null || (await findCarts(id)).length === 0) {
        return res.status(404).json({ error: "Cart not found." });
    }
    await pool.query("DELETE FROM carts WHERE id = ?", [id]);
    res.status(204).end();
});
// ===========================================================================
// SHIPPING
// One row per shipping address saved from the shipping form.
// ===========================================================================

const SHIPPING_LIMITS = { fullName: 100, address: 150, city: 60, state: 30, zip: 10, country: 60 };

// Turn a shipping row into JSON. Ids look like SHIP-1.
function toShipping(row) {
    return {
        id: formatId("SHIP", row.id),
        fullName: row.full_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        country: row.country,
        createdAt: row.created_at
    };
}

// Read the shipping fields from a request body.
function readShipping(body) {
    const b = body || {};
    return {
        fullName: text(b.fullName),
        address: text(b.address),
        city: text(b.city),
        state: text(b.state),
        zip: text(b.zip),
        country: text(b.country) || "USA"
    };
}

// Returns an error message, or "" when everything is fine.
function validateShipping(data) {
    if (!data.fullName || !data.address || !data.city || !data.state || !data.zip) {
        return "Name, address, city, state and ZIP are required.";
    }
    if (!/^\d{5}(-\d{4})?$/.test(data.zip)) {
        return "ZIP code must look like 16801 or 16801-1234.";
    }
    const tooLong = checkLengths(data, SHIPPING_LIMITS);
    return tooLong || "";
}

// READ: list every saved shipping address
app.get("/api/shipping", async function (req, res) {
    const [rows] = await pool.query("SELECT * FROM shipping ORDER BY id");
    res.json(rows.map(toShipping));
});

// READ: one shipping address
app.get("/api/shipping/:id", async function (req, res) {
    const id = parseId("SHIP", req.params.id);
    const [rows] = id === null ? [[]] : await pool.query("SELECT * FROM shipping WHERE id = ?", [id]);
    if (rows.length === 0) {
        return res.status(404).json({ error: "Shipping record not found." });
    }
    res.json(toShipping(rows[0]));
});

// CREATE: save a new shipping address
app.post("/api/shipping", async function (req, res) {
    const data = readShipping(req.body);
    const problem = validateShipping(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const [result] = await pool.query(
        "INSERT INTO shipping (full_name, address, city, state, zip, country) VALUES (?, ?, ?, ?, ?, ?)",
        [data.fullName, data.address, data.city, data.state, data.zip, data.country]
    );
    const [rows] = await pool.query("SELECT * FROM shipping WHERE id = ?", [result.insertId]);
    res.status(201).json(toShipping(rows[0]));
});

// UPDATE: change a saved shipping address
app.put("/api/shipping/:id", async function (req, res) {
    const id = parseId("SHIP", req.params.id);
    const data = readShipping(req.body);
    const problem = validateShipping(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const [result] = id === null ? [{ affectedRows: 0 }] : await pool.query(
        "UPDATE shipping SET full_name = ?, address = ?, city = ?, state = ?, zip = ?, country = ? WHERE id = ?",
        [data.fullName, data.address, data.city, data.state, data.zip, data.country, id]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Shipping record not found." });
    }
    const [rows] = await pool.query("SELECT * FROM shipping WHERE id = ?", [id]);
    res.json(toShipping(rows[0]));
});

// DELETE: remove a saved shipping address
app.delete("/api/shipping/:id", async function (req, res) {
    const id = parseId("SHIP", req.params.id);
    const [result] = id === null ? [{ affectedRows: 0 }] : await pool.query("DELETE FROM shipping WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Shipping record not found." });
    }
    res.status(204).end();
});

// ===========================================================================
// RSVPS  (rsvp.html)
// ===========================================================================

const RSVP_LIMITS = { name: 100, email: 254, activityId: 10, activityTitle: 150, participation: 50, notes: 500 };

function toRsvp(row) {
    return {
        id: formatId("RSVP", row.id),
        name: row.name,
        email: row.email,
        activityId: row.activity_id,
        activityTitle: row.activity_title,
        participation: row.participation,
        notes: row.notes || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function readRsvpFields(body) {
    const b = body || {};
    return {
        name: text(b.name),
        email: text(b.email),
        activityId: text(b.activityId),
        activityTitle: text(b.activityTitle),
        participation: text(b.participation),
        notes: text(b.notes)
    };
}

function validateRsvp(data) {
    if (!data.name || !data.email || !data.activityId || !data.activityTitle || !data.participation) {
        return "Name, email, activity and participation are required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return "A valid email address is required.";
    }
    return checkLengths(data, RSVP_LIMITS);
}

async function findRsvps(id) {
    const [rows] =
        id === undefined
            ? await pool.query("SELECT * FROM rsvps ORDER BY id")
            : await pool.query("SELECT * FROM rsvps WHERE id = ?", [id]);
    return rows.map(toRsvp);
}

// READ (list)
app.get("/api/rsvp", async function (req, res) {
    res.json(await findRsvps());
});

// READ (one)
app.get("/api/rsvp/:id", async function (req, res) {
    const id = parseId("RSVP", req.params.id);
    const found = id === null ? [] : await findRsvps(id);
    if (found.length === 0) {
        return res.status(404).json({ error: "RSVP not found." });
    }
    res.json(found[0]);
});

// CREATE: the RSVP form on rsvp.html posts here
app.post("/api/rsvp", async function (req, res) {
    const data = readRsvpFields(req.body);
    const problem = validateRsvp(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }
    const [result] = await pool.query(
        "INSERT INTO rsvps (name, email, activity_id, activity_title, participation, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [data.name, data.email, data.activityId, data.activityTitle, data.participation, data.notes || null]
    );
    res.status(201).json((await findRsvps(result.insertId))[0]);
});

// UPDATE
app.put("/api/rsvp/:id", async function (req, res) {
    const id = parseId("RSVP", req.params.id);
    if (id === null || (await findRsvps(id)).length === 0) {
        return res.status(404).json({ error: "RSVP not found." });
    }
    const data = readRsvpFields(req.body);
    const problem = validateRsvp(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }
    await pool.query(
        "UPDATE rsvps SET name = ?, email = ?, activity_id = ?, activity_title = ?, participation = ?, notes = ? WHERE id = ?",
        [data.name, data.email, data.activityId, data.activityTitle, data.participation, data.notes || null, id]
    );
    res.json((await findRsvps(id))[0]);
});

// DELETE
app.delete("/api/rsvp/:id", async function (req, res) {
    const id = parseId("RSVP", req.params.id);
    if (id === null || (await findRsvps(id)).length === 0) {
        return res.status(404).json({ error: "RSVP not found." });
    }
    await pool.query("DELETE FROM rsvps WHERE id = ?", [id]);
    res.status(204).end();
});

// ===========================================================================
// MEMBERS  (signup.html)
// ===========================================================================

const MEMBER_LIMITS = { fullName: 100, email: 254, address: 255, phone: 30 };

function toMember(row) {
    return {
        id: formatId("MEM", row.id),
        fullName: row.full_name,
        email: row.email,
        age: row.age,
        address: row.address,
        phone: row.phone || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function readMemberFields(body) {
    const b = body || {};
    return {
        fullName: text(b.fullName),
        email: text(b.email),
        age: Number(b.age),
        address: text(b.address),
        phone: text(b.phone)
    };
}

// Server-side validation (same rules as validation.js, in case the page is skipped).
function validateMember(data) {
    if (!data.fullName || !data.email || !data.address) {
        return "Name, email and address are required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return "A valid email address is required.";
    }
    if (!Number.isInteger(data.age) || data.age < 16 || data.age > 99) {
        return "Age must be a whole number from 16 to 99.";
    }
    return checkLengths(data, MEMBER_LIMITS);
}

// One member (numeric id) or all members (no argument). Always returns an array.
async function findMembers(id) {
    const [rows] =
        id === undefined
            ? await pool.query("SELECT * FROM members ORDER BY id")
            : await pool.query("SELECT * FROM members WHERE id = ?", [id]);
    return rows.map(toMember);
}

// READ (list)
app.get("/api/members", async function (req, res) {
    res.json(await findMembers());
});

// READ (one)
app.get("/api/members/:id", async function (req, res) {
    const id = parseId("MEM", req.params.id);
    const found = id === null ? [] : await findMembers(id);
    if (found.length === 0) {
        return res.status(404).json({ error: "Member not found." });
    }
    res.json(found[0]);
});

// CREATE
app.post("/api/members", async function (req, res) {
    const data = readMemberFields(req.body);
    const problem = validateMember(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }
    try {
        const [result] = await pool.query(
            "INSERT INTO members (full_name, email, age, address, phone) VALUES (?, ?, ?, ?, ?)",
            [data.fullName, data.email, data.age, data.address, data.phone || null]
        );
        res.status(201).json((await findMembers(result.insertId))[0]);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "That email is already signed up." });
        }
        throw error; // anything else goes to the error handler (500)
    }
});

// UPDATE
app.put("/api/members/:id", async function (req, res) {
    const id = parseId("MEM", req.params.id);
    if (id === null || (await findMembers(id)).length === 0) {
        return res.status(404).json({ error: "Member not found." });
    }
    const data = readMemberFields(req.body);
    const problem = validateMember(data);
    if (problem) {
        return res.status(400).json({ error: problem });
    }
    try {
        await pool.query(
            "UPDATE members SET full_name = ?, email = ?, age = ?, address = ?, phone = ? WHERE id = ?",
            [data.fullName, data.email, data.age, data.address, data.phone || null, id]
        );
        res.json((await findMembers(id))[0]);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "That email is already signed up." });
        }
        throw error;
    }
});

// DELETE
app.delete("/api/members/:id", async function (req, res) {
    const id = parseId("MEM", req.params.id);
    if (id === null || (await findMembers(id)).length === 0) {
        return res.status(404).json({ error: "Member not found." });
    }
    await pool.query("DELETE FROM members WHERE id = ?", [id]);
    res.status(204).end();
});
// ===========================================================================
// Error handler and startup
// ===========================================================================

// Express recognizes an error handler by its FOUR parameters. Any error thrown
// inside a route above (a failed query, malformed JSON, ...) ends up here.
app.use(function (error, req, res, next) {
    // Errors with a 4xx status are the client's fault (for example, a request
    // body that is not valid JSON). Everything else is a server error.
    const clientError = error.status >= 400 && error.status < 500;

    if (!clientError) {
        console.error("Request failed:", req.method, req.originalUrl, "-", error.message);
    }

    res.status(clientError ? error.status : 500).json({
        error: clientError ? "The request could not be read." : "Something went wrong on the server."
    });
});

// Check the database connection BEFORE accepting requests, so a setup problem
// shows up immediately with a clear message instead of failing on the first click.
async function start() {
    try {
        await pool.query("SELECT 1");
    } catch (error) {
        console.error("Could not connect to MySQL: " + error.message);
        if (error.code === "ECONNREFUSED") {
            console.error("-> MySQL does not seem to be running. Start the MySQL server.");
        } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
            console.error("-> Wrong DB_USER or DB_PASSWORD. Check your .env file.");
        } else if (error.code === "ER_BAD_DB_ERROR") {
            console.error("-> The database does not exist yet. Run schema.sql first.");
        }
        process.exit(1);
    }

    app.listen(PORT, function () {
        console.log("Connected to MySQL. Server running at http://localhost:" + PORT);
    });
}

start();
