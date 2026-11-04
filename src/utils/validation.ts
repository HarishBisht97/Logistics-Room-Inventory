import type { TransactionAction } from '../types';
import { isDateKey } from './dateUtils';

export interface TransactionInput {
  barcode: string;
  name: string;
  reason: string;
  action: TransactionAction | '';
  transactionDate?: string;
}

export interface FieldErrors {
  barcode?: string;
  name?: string;
  reason?: string;
  action?: string;
  transactionDate?: string;
}

export function validateTransaction(input: TransactionInput): FieldErrors {
  const errors: FieldErrors = {};
  const barcode = input.barcode.trim();
  const name = input.name.trim();
  const reason = input.reason.trim();

  if (!barcode) errors.barcode = 'Enter the barcode or item ID.';
  else if (barcode.length > 128) errors.barcode = 'Barcode must be 128 characters or less.';

  if (!name) errors.name = "Enter the person's name.";
  else if (name.length > 80) errors.name = 'Name must be 80 characters or less.';

  if (!reason) errors.reason = 'Enter a reason.';
  else if (reason.length > 300) errors.reason = 'Reason must be 300 characters or less.';

  if (input.action !== 'TAKING' && input.action !== 'RETURNING') {
    errors.action = 'Select Taking or Submitting Back.';
  }

  if (input.transactionDate !== undefined && !isDateKey(input.transactionDate)) {
    errors.transactionDate = 'Choose a valid transaction date.';
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function firstError(errors: FieldErrors): string | null {
  return errors.barcode ?? errors.name ?? errors.reason ?? errors.action ?? errors.transactionDate ?? null;
}
