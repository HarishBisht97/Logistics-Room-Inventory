import 'fake-indexeddb/auto';
import { Workbook } from 'exceljs';
import { replaceAllData, parseBackup } from '../src/db/backupService';
import { db } from '../src/db/database';
import { getDashboardStats, listTakenItems } from '../src/db/itemService';
import { listTransactions, listTransactionsByDate, listTransactionsByDateRange, registerTransaction } from '../src/db/transactionService';
import { formatDateKey, formatLongDate, shiftDateKey } from '../src/utils/dateUtils';
import { buildInventoryWorkbook } from '../src/utils/excelExport';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function reset() {
  await db.transactions.clear();
  await db.items.clear();
}

async function main() {
  await reset();

  await registerTransaction({
    barcode: '890123456',
    name: 'Rahul',
    reason: 'Lab Work',
    action: 'TAKING',
  });

  let failed = false;
  try {
    await registerTransaction({
      barcode: '890123456',
      name: 'Amit',
      reason: 'Another take',
      action: 'TAKING',
    });
  } catch (error) {
    failed = true;
    assert(error instanceof Error && error.message.includes('Rahul'), 'duplicate take names the holder');
  }
  assert(failed, 'second take should fail');
  assert((await db.transactions.count()) === 1, 'failed take must not add a transaction');

  failed = false;
  try {
    await registerTransaction({
      barcode: 'missing',
      name: 'Rahul',
      reason: 'Done',
      action: 'RETURNING',
    });
  } catch {
    failed = true;
  }
  assert(failed, 'return of unknown item should fail');

  await registerTransaction({
    barcode: '890123456',
    name: 'Rahul',
    reason: 'Finished',
    action: 'RETURNING',
  });

  const returned = await db.items.get('890123456');
  assert(returned?.status === 'AVAILABLE', 'returned item is available');
  assert(returned?.currentHolder === null && returned?.reason === null && returned?.takenAt === null, 'return clears holder');
  assert((await listTakenItems()).length === 0, 'taken list is empty after return');

  failed = false;
  try {
    await registerTransaction({
      barcode: '890123456',
      name: 'Rahul',
      reason: 'Again',
      action: 'RETURNING',
    });
  } catch {
    failed = true;
  }
  assert(failed, 'second return should fail');
  assert((await db.transactions.count()) === 2, 'failed return must not add a transaction');

  await registerTransaction({
    barcode: '890123457',
    name: 'Amit',
    reason: 'Event Setup',
    action: 'TAKING',
  });

  const taken = await listTakenItems();
  assert(taken.length === 1 && taken[0]?.barcode === '890123457', 'only Amit’s item is out');
  const stats = await getDashboardStats();
  assert(stats.uniqueItems === 2, 'two unique items');
  assert(stats.taken === 1 && stats.available === 1, 'one taken and one available');
  assert(stats.transactionsToday === 3, 'three transactions today');

  const history = await listTransactions();
  assert(history[0]?.barcode === '890123457', 'history is newest first');

  const blob = await buildInventoryWorkbook(await db.transactions.toArray(), taken);
  const workbook = new Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  const historySheet = workbook.getWorksheet('Transaction History');
  const takenSheet = workbook.getWorksheet('Currently Taken Items');
  assert(historySheet && takenSheet, 'workbook has both sheets');
  assert(historySheet.rowCount === 4, 'header plus three transactions');
  assert(String(historySheet.getRow(1).getCell(1).value) === 'S.No.', 'history header');
  assert(String(historySheet.getRow(2).getCell(7).value) === 'Taking', 'oldest row is the first take');
  assert(String(takenSheet.getRow(1).getCell(2).value) === 'Taken By', 'taken header');
  assert(String(takenSheet.getRow(2).getCell(1).value) === '890123457', 'taken barcode');
  assert(String(takenSheet.getRow(2).getCell(6).value) === 'Taken', 'taken status');
  assert(takenSheet.rowCount === 2, 'only currently taken rows');

  const backup = {
    app: 'logistics-inventory' as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    items: await db.items.toArray(),
  };
  await registerTransaction({
    barcode: '999',
    name: 'Sam',
    reason: 'Temp',
    action: 'TAKING',
  });
  await replaceAllData(parseBackup(backup));
  assert((await db.transactions.count()) === 3, 'restore replaces newer history');
  assert((await db.items.get('999')) === undefined, 'restore removes items added after the backup');

  let rejected = false;
  try {
    parseBackup({ app: 'other', version: 1, transactions: [], items: [] });
  } catch {
    rejected = true;
  }
  assert(rejected, 'invalid backup is rejected');
  assert((await db.transactions.count()) === 3, 'rejected backup does not change data');

  await reset();
  await registerTransaction({
    barcode: '123',
    name: 'Rahul',
    reason: 'Event Setup',
    action: 'TAKING',
    transactionDate: '2026-12-01',
  });
  await registerTransaction({
    barcode: '123',
    name: 'Rahul',
    reason: 'Event finished',
    action: 'RETURNING',
    transactionDate: '2026-12-03',
  });
  await registerTransaction({
    barcode: '123',
    name: 'Amit',
    reason: 'Lab',
    action: 'TAKING',
    transactionDate: '2026-12-05',
  });

  const december1 = await listTransactionsByDate('2026-12-01');
  const december2 = await listTransactionsByDate('2026-12-02');
  const december3 = await listTransactionsByDate('2026-12-03');
  const firstWeek = await listTransactionsByDateRange('2026-12-01', '2026-12-03');
  assert(december1.length === 1 && december1[0]?.action === 'TAKING' && december1[0]?.name === 'Rahul', 'December 1 shows Rahul taking');
  assert(december1[0]?.transactionDate === '2026-12-01', 'selected date is stored separately');
  assert(december2.length === 0, 'December 2 has no records');
  assert(december3.length === 1 && december3[0]?.action === 'RETURNING', 'December 3 shows the return');
  assert(firstWeek.length === 2, 'date range is inclusive and does not include December 5');
  const currentItem = await db.items.get('123');
  assert(currentItem?.status === 'TAKEN' && currentItem.currentHolder === 'Amit', 'current holder is Amit');
  assert(currentItem?.lastTransactionDate === '2026-12-05', 'current status follows the latest take');

  let retrospective = false;
  try {
    await registerTransaction({
      barcode: '123',
      name: 'Priya',
      reason: 'Old date',
      action: 'TAKING',
      transactionDate: '2026-12-01',
    });
  } catch (error) {
    retrospective = true;
    assert(error instanceof Error && error.message.includes('Amit'), 'a past date still checks the current holder');
  }
  assert(retrospective, 'taking an item that is already out fails');
  assert((await listTransactionsByDate('2026-12-01')).length === 1, 'rejected historical take is not stored');

  await registerTransaction({
    barcode: '555',
    name: 'Neha',
    reason: 'Kit',
    action: 'TAKING',
    transactionDate: '2026-12-02',
    idempotencyKey: 'idem-1',
  });
  await registerTransaction({
    barcode: '555',
    name: 'Neha',
    reason: 'Kit',
    action: 'TAKING',
    transactionDate: '2026-12-02',
    idempotencyKey: 'idem-1',
  });
  assert(await db.transactions.where('barcode').equals('555').count() === 1, 'the same save key is not stored twice');

  assert(shiftDateKey('2026-12-01', 1) === '2026-12-02', 'next day stays on the calendar date');
  assert(shiftDateKey('2026-01-31', 1) === '2026-02-01', 'calendar math rolls into the next month');
  assert(formatLongDate('2026-12-01') === 'December 1, 2026', 'long date label');

  const dayBlob = await buildInventoryWorkbook(december1, [], { history: true, taken: false });
  const dayWorkbook = new Workbook();
  await dayWorkbook.xlsx.load(Buffer.from(await dayBlob.arrayBuffer()));
  const daySheet = dayWorkbook.getWorksheet('Transaction History');
  assert(daySheet && !dayWorkbook.getWorksheet('Currently Taken Items'), 'a date export is only that date');
  assert(daySheet.rowCount === 2, 'one transaction for December 1');
  assert(String(daySheet.getRow(1).getCell(2).value) === 'Transaction Date', 'transaction date column');
  assert(String(daySheet.getRow(2).getCell(2).value) === formatDateKey('2026-12-01'), 'exported date is December 1');

  console.log('verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
