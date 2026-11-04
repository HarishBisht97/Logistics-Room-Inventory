# IPT Logbook

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
4. Sign in once as the first administrator, then set that user's document as described below.

## Staff approval

New accounts are regular users with status `PENDING`. They stay on a waiting screen until an administrator approves them. Approved accounts use role `USER` until an administrator promotes them. Rejected accounts cannot open the logbook. Signing in again does not create a second profile.

The app never makes the first person an administrator. After the rules are deployed, create that admin in the Firebase console:

1. Sign in once with the administrator's email so the app creates `users/{uid}`. The waiting screen shows that Account ID.
2. Open that document in Firestore. The document id is the Account ID.
3. Set `status` to `APPROVED` and `role` to `ADMIN`. Leave `uid`, `name`, `email`, `createdAt`, and `updatedAt` as they are.
4. The waiting screen unlocks when the document is saved. That person can then approve other staff from Manage Users, and can grant or remove admin access.

Every admin has the same authority. Nobody can change their own role or approval status. Those checks are in `firestore.rules`. Hiding a button is not the only protection.

Deploy the rules and this version of the app together. People who already have Firebase accounts become pending the next time they sign in, until an administrator approves them. Logistics records stay closed to anyone who is not approved.

`firestore.rules` allows approved users to read logistics records and add transactions. Transaction history still cannot be edited or deleted.

Without the environment variables, the app keeps working on this device and shows that cloud sync is not configured.

## Dates and status

Each transaction stores a calendar date (`transactionDate`, `YYYY-MM-DD`) separately from the time it was submitted (`createdAt`). The dashboard and history follow the selected date. Currently Taken Items always shows the latest item status.

Taking an item that is already out, or returning an item that is already in the room, is rejected. A past date does not bypass that check.

## Existing records

The first time a signed-in user opens a configured app, it offers to upload IndexedDB records. Upload is confirmed first, uses stable document ids so a refresh does not duplicate them, and leaves the local copies in place.

## Export

Excel export can download one date, a date range, every transaction, or the items that are currently out.
