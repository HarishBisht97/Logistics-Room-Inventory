# Access control

Firestore security rules in `firestore.rules` decide who can read and write. Hiding a button does not grant or remove access.

## Bootstrap super admin

The rules file contains one bootstrap email. Only that Firebase Authentication account can create a profile with role `SUPER_ADMIN`. The profile is marked `protected`. No admin, and not the account itself, can change that role or status.

To use a different account, edit `bootstrapEmail()` in `firestore.rules` and deploy the rules before that person signs in. Do not put this privilege in `.env` or local storage. The client may try to create a super admin profile, and the rules reject every account except the bootstrap email.

There is always that one protected super admin, so the last super admin cannot be removed or demoted. A super admin may appoint other super admins. Those extra accounts are not protected and can be changed by a super admin. Nobody can change their own role.

## Roles

- `SUPER_ADMIN` can manage users, roles, permissions, and application settings.
- `ADMIN` can approve, suspend, reject, and remove regular users, and can invite regular users. An admin cannot change roles, edit another admin, or touch a super admin.
- `USER` can use the operational screens allowed by their permission map.

Open registration, when a super admin turns it on, can create only `USER` profiles. Admin access comes from an invitation or a later role change.

## Account status

`ACTIVE` profiles can use operational data. `PENDING_APPROVAL`, `SUSPENDED`, `REJECTED`, and `REMOVED` profiles can read their own user document and nothing else in the logistics collections. Suspended and removed accounts keep their old transactions.

Removing someone sets `REMOVED` and stops future access for that uid. The Firebase Authentication user remains, because the browser SDK cannot delete or disable another person’s Authentication account. That needs the Admin SDK on a trusted server, which this app does not include. Do not put a service account key in the frontend.

## Invitations

An invitation is a document in `invitations`, keyed by the lowercase email. It is not an email message. The app does not pretend to send mail. Ask the person to open the app and create a password account with that exact email. If approval is required, they stay on the waiting screen until a super admin or admin approves them.

`sendSignInLinkToEmail` could send Firebase’s own sign-in mail, but that is a separate Authentication provider and is not wired up here.

## Permissions

Each user document has a `permissions` map. Rules treat a super admin as allowed for every action. For everyone else, the matching flag must be true. A super admin changes flags under Admin → Access. Those writes are rejected for any other role.

Application-wide feature switches live in `appSettings/config`. Only a super admin can write that document. Turning a feature off stops other roles in the rules. The super admin can still read and write, so a switch cannot lock them out.

Excel export is a download of records the account is already allowed to read. Rules can deny the read, which also stops the export. They cannot stop a modified browser from copying data the account was allowed to see.

Recording a transaction requires reading the item’s current status. An account that can record can therefore read items, even when the currently-taken screen is hidden.

## Transactions

New transactions must set `createdBy` to the signed-in uid, `createdByEmail` to the authentication email, and `createdByName` to the name on that person’s profile. `createdAt` must be the server time. Clients cannot assign the record to someone else.

The display name is editable by that person, so the name is a label. The uid and email are the identity.

Older transactions may have no name or email. They remain readable. New writes cannot omit those fields.

Transaction documents cannot be deleted. Updates stay off unless a super admin enables the correction switch. Even then, the original creator, email, name, and creation time cannot be changed. The scan form does not include an edit action.

Uploading old IndexedDB rows is limited to a super admin. Those rows are marked `legacyImport` and are attributed to the super admin who uploads them.

## Activity log

`auditLogs` can be created, not updated or deleted, by any role. The `userId` and `userEmail` must match the signed-in account. A modified client can omit a log or write a misleading description, so the log is not tamper-proof. It does record which account wrote the row.

Login and logout are written by the browser after authentication. A suspended account can still write those two actions so the attempt is visible. A client that never calls the log function leaves no row.

## Collections

- `users/{uid}` — profile, role, status, permissions
- `invitations/{email}` — pending invitations
- `appSettings/config` — name, branding, registration, feature switches
- `auditLogs/{id}` — append-only activity
- `transactions/{id}` and `items/{id}` — existing logistics data

Deploy with:

```bash
firebase deploy --only firestore
```
