# MediKiosk — Flat GitHub / Render Version

All application files are in the project root. No `frontend/` or `backend/` folders are required.

## Files
- `index.html` — UI shell
- `style.css` — styling
- `script.js` — patient, queue, registration desk and doctor UI logic, plus adaptive current-issue questionnaire
- `server.js` — Express API, authentication, queue, uploads and doctor endpoints
- `db.js` — SQLite database and demo users
- `package.json` — Node dependencies and start command
- `render.yaml` — Render deployment configuration
- `home.jpg`, `registration.jpg`, `queue.jpg`, `doctor.jpg` — UI images

## Run
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

The questionnaire is adaptive: the follow-up questions change based on the patient's main/current problem and the answers are stored as a structured summary for the doctor.

This is a prototype. Do not use real patient medical data in production without appropriate security, privacy, compliance, encryption, audit logging and secure secrets/storage.


## v7 fixes
Doctor document opening now uses authenticated blob requests, and the doctor file view includes automatic AI summary generation. See `AI_API_SETUP.txt`.
