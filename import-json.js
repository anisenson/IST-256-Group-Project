// import-json.js
// One-time helper: copies the old JSON data into the MySQL tables.
//
// RUN (after running schema.sql):     npm run import      or      node import-json.js
//
// It reads these files if they exist in the project folder:
//     billing.json           sample orders that are committed to GitHub
//     billing-data.json      orders saved locally by the old JSON server
//     returns-data.json      returns saved locally by the old JSON server
//     submissions-data.json  proposals saved locally by the old JSON server
// The *-data.json files are not on GitHub (they are in .gitignore), so each
// person only imports whatever their own computer has.
//
// It is SAFE TO RUN MORE THAN ONCE: a record whose id already exists in the
// database is skipped, so nothing is duplicated.

const fs = require("fs");
const path = require("path");
const pool = require("./db");

// Read a JSON file that holds an array. Returns [] if the file is missing.
function readArray(fileName) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(data) ? data : [];
}

// Turn "RET-12" into 12. The old JSON files used prefixed ids; the database
// stores just the number.
function numberFromId(value) {
    const match = /(\d+)$/.exec(String(value));
    return match ? Number(match[1]) : null;
}

// Convert a saved timestamp to a Date, or "now" if it is missing or invalid.
function toDate(value) {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? date : new Date();
}

// Each import function returns { added, skipped } so we can print a summary.

async function importSubmissions() {
    const result = { added: 0, skipped: 0 };

    for (const s of readArray("submissions-data.json")) {
        const [existing] = await pool.query("SELECT id FROM submissions WHERE id = ?", [s.id]);
        if (existing.length > 0) {
            result.skipped++;
            continue;
        }
        try {
            await pool.query(
                "INSERT INTO submissions (id, title, speaker, email, category, abstract, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [s.id, s.title, s.speaker, s.email, s.category, s.abstract, s.status || "pending", toDate(s.createdAt)]
            );
            result.added++;
        } catch (error) {
            console.warn("  Skipped a submission (" + s.id + "): " + error.message);
            result.skipped++;
        }
    }
    return result;
}

async function importReturns() {
    const result = { added: 0, skipped: 0 };

    for (const r of readArray("returns-data.json")) {
        const id = numberFromId(r.id);
        const [existing] = await pool.query("SELECT id FROM product_returns WHERE id = ?", [id]);
        if (id === null || existing.length > 0) {
            result.skipped++;
            continue;
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(
                "INSERT INTO product_returns (id, customer_name, email, reason, item_condition, comments, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [id, r.customerName, r.email, r.reason, r.condition, r.comments || "", r.total || 0, toDate(r.createdAt)]
            );
            for (const item of r.items || []) {
                await connection.query(
                    "INSERT INTO return_items (return_id, product_id, product_name, price) VALUES (?, ?, ?, ?)",
                    [id, String(item.productId), item.productName, item.price]
                );
            }
            await connection.commit();
            result.added++;
        } catch (error) {
            await connection.rollback();
            console.warn("  Skipped a return (" + r.id + "): " + error.message);
            result.skipped++;
        } finally {
            connection.release();
        }
    }
    return result;
}

async function importBilling() {
    const result = { added: 0, skipped: 0 };
    // billing.json first (the shared sample data), then any local orders.
    const records = readArray("billing.json").concat(readArray("billing-data.json"));

    for (const b of records) {
        const id = numberFromId(b.id);
        const [existing] = await pool.query("SELECT id FROM billing WHERE id = ?", [id]);
        if (id === null || existing.length > 0) {
            result.skipped++;
            continue;
        }
        const payment = b.payment || {};
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(
                "INSERT INTO billing (id, full_name, address, city, state, zip, card_last4, card_expiration, shipping_method, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    id, b.fullName, b.address, b.city, b.state, b.zip,
                    payment.cardLast4, payment.expiration,
                    b.shippingMethod || "Standard", b.total, toDate(b.createdAt)
                ]
            );
            for (const item of b.items || []) {
                // Old records used "title" (cart items) or "name" for the product name.
                await connection.query(
                    "INSERT INTO billing_items (billing_id, product_id, title, price, quantity) VALUES (?, ?, ?, ?, ?)",
                    [id, item.id || item.productId || null, item.title || item.name, item.price, item.quantity || 1]
                );
            }
            await connection.commit();
            result.added++;
        } catch (error) {
            await connection.rollback();
            console.warn("  Skipped a billing record (" + b.id + "): " + error.message);
            result.skipped++;
        } finally {
            connection.release();
        }
    }
    return result;
}

async function main() {
    try {
        const tables = [
            ["submissions", importSubmissions],
            ["returns", importReturns],
            ["billing", importBilling]
        ];
        for (const [name, run] of tables) {
            const r = await run();
            console.log(name + ": " + r.added + " added, " + r.skipped + " skipped");
        }
    } catch (error) {
        console.error("Import failed: " + error.message);
        console.error("Did you run schema.sql and set up your .env file?");
        process.exitCode = 1;
    } finally {
        await pool.end(); // close the connections so the script can exit
    }
}

main();
