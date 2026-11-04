# IIT Bombay Logistics Management System

A mobile-first app for recording items taken from and returned to the logistics room. The interface is React, TypeScript, and Vite. When Firebase is configured, Cloud Firestore is the shared database. Until then, records stay in IndexedDB on the device.

There is no custom backend. The browser talks to Firebase with the client SDK.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the Firebase web app values. These are client configuration values, not admin credentials. Do not put a service account key in this project.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Vite reads those values at build time. A Netlify deploy needs the same variables, followed by a new build.

In the Firebase console:

1. Create a Firestore database.
2. Enable Email/Password authentication.
3. Deploy the rules and index in this repo: `firebase deploy --only firestore`.

`firestore.rules` requires a signed-in user, allows new transactions, and rejects updates or deletes of transaction history. Create staff accounts from the sign-in screen, then turn off public sign-up in Firebase Authentication if the staff list should stay closed.

Without the environment variables, the app keeps working on this device and shows that cloud sync is not configured.

## Dates and status

Each transaction stores a calendar date (`transactionDate`, `YYYY-MM-DD`) separately from the time it was submitted (`createdAt`). The dashboard and history follow the selected date. Currently Taken Items always shows the latest item status.

Taking an item that is already out, or returning an item that is already in the room, is rejected. A past date does not bypass that check.

## Existing records

The first time a signed-in user opens a configured app, it offers to upload IndexedDB records. Upload is confirmed first, uses stable document ids so a refresh does not duplicate them, and leaves the local copies in place.

## Export

Excel export can download one date, a date range, every transaction, or the items that are currently out.
