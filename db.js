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
    timezone: "Z"
});

// Make MySQL itself use UTC for CURRENT_TIMESTAMP defaults (created_at etc.),
// so they agree with the JavaScript side above. Runs once per new connection.
pool.on("connection", function (connection) {
    connection.query("SET time_zone = '+00:00'");
});

module.exports = pool;
