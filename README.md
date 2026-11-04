# Logistics Room Inventory

A mobile-first inventory app for tracking items taken from and returned to a logistics room. It runs entirely in the browser. Transactions and item status are stored in IndexedDB on the device. There is no server, account, or network API.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Use a phone on the same network, or the browser’s device toolbar, to try the camera scanner. If the camera is blocked, type the barcode instead.

## Data

- Refreshing or closing the browser keeps the saved records.
- **Export to Excel** downloads `Logistics_Inventory_Records.xlsx` with transaction history and currently taken items.
- **JSON backup** downloads `Logistics_Inventory_Backup.json`.
- **Restore backup** asks for confirmation before replacing the records already on the device.

To install it on a phone, build the app and open the preview over HTTPS (or localhost), then use the browser’s Add to Home Screen / Install option.

```bash
npm run build
npm run preview
```
# Logistics-Room-Inventory
