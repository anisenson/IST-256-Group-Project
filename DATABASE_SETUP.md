# Database setup (MySQL)

The site stores its data in a MySQL database. Every person runs their own copy of
MySQL on their own computer, so the **data is not shared through GitHub** -- only the
code and the table definitions are. Follow these steps once.

## 1. Install MySQL (skip if you already have it)

Install **MySQL Community Server** and **MySQL Workbench** from <https://dev.mysql.com/downloads/>.
During setup you choose a password for the `root` user. Remember it; you need it below.
Make sure the MySQL server is running (on Windows it runs as a service named `MySQL80` or similar).

## 2. Get the latest code and install packages

```
git pull origin main
npm install
```

## 3. Create your `.env` file

The `.env` file holds YOUR password. It is ignored by git, so it never goes to GitHub.

1. Copy `.env.example` and name the copy `.env` (same folder).
2. Open `.env` and replace `put_your_own_mysql_password_here` with your MySQL root password.
   Leave the other lines alone unless your MySQL uses a different port or user.

## 4. Create the tables

Pick one:

- **Workbench:** connect to your local server, choose File > Open SQL Script, pick `schema.sql`,
  and click the lightning-bolt button.
- **Command line** (from the project folder):
  ```
  mysql -u root -p
  ```
  then at the `mysql>` prompt:
  ```
  source schema.sql
  ```
  (In PowerShell do not use `mysql -u root -p < schema.sql`; PowerShell does not support `<`.)
  If `mysql` is "not recognized", use Workbench instead.

Running `schema.sql` again is safe; it never deletes existing data.

## 5. (Optional) Load the sample data

```
npm run import
```

This copies `billing.json` (and any old local `*-data.json` files) into your database.
It skips anything already there, so it is safe to repeat.

## 6. Start the site

```
node server.js
```

You should see `Connected to MySQL. Server running at http://localhost:3000`.
Open that address in your browser.

## Troubleshooting

| Message | Meaning and fix |
|---|---|
| `MySQL does not seem to be running` | Start the MySQL server (Windows: Services > MySQL80 > Start). |
| `Wrong DB_USER or DB_PASSWORD` | Fix the password in your `.env` file. |
| `The database does not exist yet` | You have not run `schema.sql` (step 4). |
| `Cannot find module 'mysql2'` or `'dotenv'` | Run `npm install`. |

## If someone changes the tables later

The person who changes `schema.sql` tells the group. To apply a change, everyone either
runs the new `ALTER TABLE` statement they were given, or starts fresh:
open a MySQL prompt, run `DROP DATABASE coding_club;`, then run `schema.sql` and
`npm run import` again. (Starting fresh deletes your local data.)

## Look at the data (useful for screenshots)

In Workbench, open the `coding_club` schema and right-click a table > **Select Rows**.
Or in a MySQL prompt: `USE coding_club;` then `SELECT * FROM submissions;`
