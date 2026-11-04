import type { Worksheet } from 'exceljs';
import type { ItemRecord, TransactionRecord } from '../types';
import { downloadBlob } from './download';
import { formatDate, formatTime } from './dateUtils';
import { actionLabel } from './labels';
import { db } from '../db/database';

const EXCEL_NAME = 'Logistics_Inventory_Records.xlsx';
const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function downloadInventoryExcel(): Promise<void> {
  const [transactions, takenItems] = await Promise.all([
    db.transactions.toArray(),
    db.items.where('status').equals('TAKEN').toArray(),
  ]);
  const blob = await buildInventoryWorkbook(transactions, takenItems);
  downloadBlob(blob, EXCEL_NAME);
}

export async function buildInventoryWorkbook(
  transactions: TransactionRecord[],
  takenItems: ItemRecord[],
): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'Logistics Room';
  workbook.created = new Date();

  const history = workbook.addWorksheet('Transaction History');
  history.columns = [
    { header: 'S.No.', key: 'sno', width: 8 },
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Time', key: 'time', width: 14 },
    { header: 'Barcode / Item ID', key: 'barcode', width: 24 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Reason', key: 'reason', width: 36 },
    { header: 'Action', key: 'action', width: 20 },
  ];

  const chronological = [...transactions].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  chronological.forEach((transaction, index) => {
    history.addRow({
      sno: index + 1,
      date: formatDate(transaction.timestamp),
      time: formatTime(transaction.timestamp),
      barcode: transaction.barcode,
      name: transaction.name,
      reason: transaction.reason,
      action: actionLabel(transaction.action),
    });
  });
  styleSheet(history, 7);
  colorActionColumn(history);

  const taken = workbook.addWorksheet('Currently Taken Items');
  taken.columns = [
    { header: 'Barcode / Item ID', key: 'barcode', width: 24 },
    { header: 'Taken By', key: 'takenBy', width: 22 },
    { header: 'Reason', key: 'reason', width: 36 },
    { header: 'Date Taken', key: 'dateTaken', width: 16 },
    { header: 'Time Taken', key: 'timeTaken', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  const current = takenItems
    .filter((item) => item.status === 'TAKEN')
    .sort((left, right) => (right.takenAt ?? '').localeCompare(left.takenAt ?? ''));

  current.forEach((item) => {
    taken.addRow({
      barcode: item.barcode,
      takenBy: item.currentHolder ?? '',
      reason: item.reason ?? '',
      dateTaken: item.takenAt ? formatDate(item.takenAt) : '',
      timeTaken: item.takenAt ? formatTime(item.takenAt) : '',
      status: 'Taken',
    });
  });
  styleSheet(taken, 6);
  taken.getColumn('status').eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    cell.font = { bold: true, color: { argb: 'FFC2410C' } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  return new Blob([bytes], { type: SHEET_TYPE });
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
