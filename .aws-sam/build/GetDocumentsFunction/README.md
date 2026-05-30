# UM2 Student Portal — Netlify

Migrated from Google Apps Script to Netlify (static frontend + serverless function).  
The UI is unchanged. Only the backend transport was replaced.

---

## File Structure

```
public/
  index.html              ← Frontend (identical UI; fetch replaces google.script.run)
netlify/
  functions/
    login.js              ← Serverless function (replaces all .gs files)
netlify.toml              ← Build & function config
```

---

## Architecture

### Before (Apps Script)
```
Browser → google.script.run.login() → Code.gs → SpreadsheetApp
```

### After (Netlify)
```
Browser → fetch('/.netlify/functions/login') → login.js → Google Sheets REST API
```

The layer structure from the refactored `.gs` files is preserved inside `login.js`:
- **Config** — column maps at the top of the file
- **DataLayer** — `fetchSheetValues`, `findStudentRowByEmail`, `fetchGradeRowsByStudentId`
- **StudentDomain** — `mapRowToStudent`, `mapRowToGrade`, `formatDate`, auth logic

---

## One-Time Setup

### 1. Create a Google Cloud Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **IAM & Admin → Service Accounts**
2. Create a new service account (e.g. `um2-portal`)
3. Under **Keys**, add a new JSON key — download it
4. From the JSON file, copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key`  → `GOOGLE_PRIVATE_KEY`

### 2. Share your Google Sheet with the service account

Open your Google Sheet → **Share** → paste the service account email → **Viewer** role.

### 3. Set environment variables in Netlify

In your Netlify site: **Site configuration → Environment variables → Add**

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `um2-portal@your-project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | The full PEM key from the JSON file (including `-----BEGIN...-----END...`) |
| `SPREADSHEET_ID` | `1O5yioQfgwFQVAanU-I2dPrQBA3lFCPaYVwJrtJUQSkg` |

> **Tip:** When pasting the private key, Netlify handles the literal `\n` characters correctly.  
> The function automatically converts them to real newlines.

### 4. Deploy

```bash
# Push to your Git repo connected to Netlify, or:
netlify deploy --prod
```

---

## Local Development

```bash
npm install -g netlify-cli
netlify dev          # runs function + frontend at http://localhost:8888
```

Create a `.env` file in the project root for local dev:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=um2-portal@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=1O5yioQfgwFQVAanU-I2dPrQBA3lFCPaYVwJrtJUQSkg
```

---

## Adding Features (same pattern as before)

**New column?**  
→ Update `COL` or `GCOL` at the top of `login.js`.  
→ Update `mapRowToStudent` or `mapRowToGrade`.

**New sheet (e.g. Courses)?**  
→ Add a `fetchSheetValues(token, 'Courses')` call in the handler.  
→ Add a new Netlify function `netlify/functions/courses.js` if the frontend needs a separate endpoint.

**New business rule?**  
→ Add it in `login.js` in the domain section, keeping it out of the fetch/auth plumbing.

---

## Security Notes

- Passwords are still stored and compared as plain text (same as the original).  
  Consider hashing (bcrypt) if upgrading the sheet schema.
- The service account has **read-only** (`spreadsheets.readonly`) scope — it cannot modify the sheet.
- CORS is open (`*`) by default. To restrict to your domain, change  
  `'Access-Control-Allow-Origin': '*'` to `'https://your-site.netlify.app'`.
