// db.js
// Creates ONE shared connection pool to MySQL and exports it.
//
// A "pool" keeps a few connections open and hands them out as needed, which is
// faster than opening a new connection for every request. Any file that needs
// the database does:   const pool = require("./db");
//
// Connection settings come from a file named .env in the project folder
// (see .env.example). The .env file is listed in .gitignore, so each person's
// password stays on their own computer and is never pushed to GitHub.

require("dotenv").config(); // reads .env and puts its values into process.env

const mysql = require("mysql2/promise"); // "/promise" lets us use async/await

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "coding_club",

    waitForConnections: true, // queue requests when all connections are busy
    connectionLimit: 10,

    // Treat every date as UTC when converting between JavaScript Date objects
    // and MySQL DATETIME values, so timestamps are the same on every computer.
    timezone: "Z",

    // Hosted databases (for example TiDB Cloud) require an encrypted connection.
    // Set DB_SSL=true in .env to turn that on. Leave it unset for local MySQL.
    ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined
});

// Make MySQL itself use UTC for CURRENT_TIMESTAMP defaults (created_at etc.),
// so they agree with the JavaScript side above. Runs once per new connection.
pool.on("connection", function (connection) {
    connection.query("SET time_zone = '+00:00'");
});

// ---------------------------------------------------------------------------
// Query logging
// Prints one line in the terminal for every successful query, for example:
//     [14:02:31] [DB] INSERT members -> 1 row(s) added, id 3
//     [14:02:31] [DB] SELECT members -> 3 row(s)
// Use these lines as the "server log" screenshots for the project. Set
// DB_LOG=off in .env to switch the logging off.
// ---------------------------------------------------------------------------

// Build the text for one finished query. `result` is what MySQL sent back:
// an array of rows for a SELECT, or a status object for INSERT/UPDATE/DELETE.
function describeQuery(sql, result) {
    const text = sql.replace(/\s+/g, " ").trim();
    const verb = text.split(" ")[0].toUpperCase();
    const found = /(?:FROM|INTO|UPDATE)\s+(\w+)/i.exec(text);
    const table = found ? found[1] : "";

    if (/^SELECT 1$/i.test(text)) {
        return null; // the connection check at startup is not worth logging
    }
    if (Array.isArray(result)) {
        return verb + " " + table + " -> " + result.length + " row(s)";
    }
    if (verb === "INSERT") {
        return "INSERT " + table + " -> " + result.affectedRows + " row(s) added, id " + result.insertId;
    }
    return verb + " " + table + " -> " + result.affectedRows + " row(s) affected";
}

// Replace target.query (a pool or one connection) with a version that logs
// after the real query succeeds. Failed queries are not logged here; the error
// handler in server.js reports those. A mistake in the logging code can never
// break a query, because it is wrapped in try/catch.
function addLogging(target) {
    if (process.env.DB_LOG === "off" || target.loggingAdded) {
        return target;
    }
    const originalQuery = target.query.bind(target);

    target.query = async function (sql, params) {
        const result = await originalQuery(sql, params); // [rows or status, fields]
        try {
            const line = describeQuery(String(sql), result[0]);
            if (line) {
                console.log("[" + new Date().toLocaleTimeString() + "] [DB] " + line);
            }
        } catch (error) {
            // ignore: logging must never stop the app
        }
        return result;
    };

    target.loggingAdded = true; // never wrap the same object twice
    return target;
}

addLogging(pool);

// server.js borrows single connections for transactions (saving an order and
// its items together). Those connections need the same logging.
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function () {
    return addLogging(await originalGetConnection());
};

module.exports = pool;
