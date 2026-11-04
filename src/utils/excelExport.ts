import type { Worksheet } from 'exceljs';
import type { ItemRecord, TransactionRecord } from '../types';
import { downloadBlob } from './download';
import { formatDate, formatDateKey, formatTime, transactionClock, transactionDay } from './dateUtils';
import { actionLabel } from './labels';

const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ExcelExportScope =
  | { kind: 'date'; date: string }
  | { kind: 'range'; start: string; end: string }
  | { kind: 'all' }
  | { kind: 'taken' };

interface WorkbookSheets {
  history?: boolean;
  taken?: boolean;
}

export async function downloadInventoryExcel(scope: ExcelExportScope = { kind: 'all' }): Promise<void> {
  const transactionsApi = await import('../services/transactionService');
  const itemsApi = await import('../services/itemService');
  let transactions: TransactionRecord[] = [];
  let taken: ItemRecord[] = [];

  if (scope.kind === 'date') transactions = await transactionsApi.getTransactionsByDate(scope.date);
  else if (scope.kind === 'range') transactions = await transactionsApi.getTransactionsByDateRange(scope.start, scope.end);
  else if (scope.kind === 'all') {
    [transactions, taken] = await Promise.all([
      transactionsApi.getAllTransactions(),
      itemsApi.getCurrentlyTakenItems(),
    ]);
  } else {
    taken = await itemsApi.getCurrentlyTakenItems();
  }

  const blob = await buildInventoryWorkbook(transactions, taken, {
    history: scope.kind !== 'taken',
    taken: scope.kind === 'all' || scope.kind === 'taken',
  });
  downloadBlob(blob, workbookName(scope));
}

export async function buildInventoryWorkbook(
  transactions: TransactionRecord[],
  takenItems: ItemRecord[],
  sheets: WorkbookSheets = { history: true, taken: true },
): Promise<Blob> {
  const includeHistory = sheets.history !== false;
  const includeTaken = sheets.taken !== false;
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'IPT Logbook';
  workbook.created = new Date();

  if (includeHistory) {
    const history = workbook.addWorksheet('Transaction History');
    history.columns = [
      { header: 'S.No.', key: 'sno', width: 8 },
      { header: 'Transaction Date', key: 'date', width: 20 },
      { header: 'Transaction Time', key: 'time', width: 18 },
      { header: 'Barcode', key: 'barcode', width: 24 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Reason', key: 'reason', width: 36 },
      { header: 'Action', key: 'action', width: 20 },
    ];
    [...transactions].sort(oldestFirst).forEach((transaction, index) => {
      history.addRow({
        sno: index + 1,
        date: formatDateKey(transactionDay(transaction)),
        time: transactionClock(transaction),
        barcode: transaction.barcode,
        name: transaction.name,
        reason: transaction.reason,
        action: actionLabel(transaction.action),
      });
    });
    styleSheet(history, 7);
    colorActionColumn(history);
  }

  if (includeTaken) {
    const taken = workbook.addWorksheet('Currently Taken Items');
    taken.columns = [
      { header: 'Barcode / Item ID', key: 'barcode', width: 24 },
      { header: 'Taken By', key: 'takenBy', width: 22 },
      { header: 'Reason', key: 'reason', width: 36 },
      { header: 'Date Taken', key: 'dateTaken', width: 16 },
      { header: 'Time Taken', key: 'timeTaken', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    takenItems
      .filter((item) => item.status === 'TAKEN')
      .sort((left, right) => (right.takenAt ?? '').localeCompare(left.takenAt ?? ''))
      .forEach((item) => {
        taken.addRow({
          barcode: item.barcode,
          takenBy: item.currentHolder ?? '',
          reason: item.reason ?? '',
          dateTaken: item.lastTransactionDate ? formatDateKey(item.lastTransactionDate) : item.takenAt ? formatDate(item.takenAt) : '',
          timeTaken: item.takenAt ? formatTime(item.takenAt) : '',
          status: 'Taken',
        });
      });
    styleSheet(taken, 6);
    taken.getColumn('status').eachCell((cell, rowNumber) => {
      if (rowNumber === 1) return;
      cell.font = { bold: true, color: { argb: 'FFC2410C' } };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: SHEET_TYPE });
}

function oldestFirst(left: TransactionRecord, right: TransactionRecord): number {
  const day = transactionDay(left).localeCompare(transactionDay(right));
  if (day !== 0) return day;
  return left.timestamp.localeCompare(right.timestamp);
}

function workbookName(scope: ExcelExportScope): string {
  if (scope.kind === 'date') return `Logistics_Inventory_${scope.date}.xlsx`;
  if (scope.kind === 'range') return `Logistics_Inventory_${scope.start}_to_${scope.end}.xlsx`;
  if (scope.kind === 'taken') return 'Logistics_Currently_Taken.xlsx';
  return 'Logistics_Inventory_Records.xlsx';
}

function styleSheet(sheet: Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  header.alignment = { vertical: 'middle' };
  header.height = 24;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (rowNumber > 1) cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
}

function colorActionColumn(sheet: Worksheet): void {
  sheet.getColumn('action').eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    if (cell.value === 'Taking') {
      cell.font = { bold: true, color: { argb: 'FFC2410C' } };
    } else if (cell.value === 'Submitting Back') {
      cell.font = { bold: true, color: { argb: 'FF047857' } };
    }
  });
}
