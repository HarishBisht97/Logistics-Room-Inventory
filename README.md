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

`firestore.rules` is the access control. Signing in to Firebase is not enough: the account also needs an active profile in the `users` collection. Deploy rules and indexes after pulling these changes:

```bash
firebase deploy --only firestore
```

The first super admin is not chosen in the app. `firestore.rules` names one bootstrap email, `26m0307@iitb.ac.in`. Change that email if it is not the account you use, deploy the rules, then sign in with it. That sign-in creates the protected super admin profile. Nobody else can grant themselves that role.

Details, including what the browser cannot do, are in [docs/access-control.md](docs/access-control.md).

Without the environment variables, the app keeps working on this device and shows that cloud sync is not configured.

## Dates and status

Each transaction stores a calendar date (`transactionDate`, `YYYY-MM-DD`) separately from the time it was submitted (`createdAt`). The dashboard and history follow the selected date. Currently Taken Items always shows the latest item status.

Taking an item that is already out, or returning an item that is already in the room, is rejected. A past date does not bypass that check.

## Existing records

A super admin who still has records in IndexedDB on this device is offered a one-time upload. Upload is confirmed first, uses stable document ids so a refresh does not duplicate them, and leaves the local copies in place. Those imported transactions are attributed to the super admin who uploads them.

## Access

Admin, in the navigation, is limited to active admin and super admin profiles. Invitations are stored in Firestore. This app does not send invitation email. The invited person creates a password account with that exact email, then a super admin approves them. Suspending or removing someone blocks Firestore access and keeps their history. It does not delete the Firebase Authentication account.

## Export

Excel export can download one date, a date range, every transaction, or the items that are currently out.
