import 'fake-indexeddb/auto';
import { Workbook } from 'exceljs';
import { replaceAllData, parseBackup } from '../src/db/backupService';
import { db } from '../src/db/database';
import { getDashboardStats, listTakenItems } from '../src/db/itemService';
import { listTransactions, registerTransaction } from '../src/db/transactionService';
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

  console.log('verification passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
