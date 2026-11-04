import type { TransactionAction } from '../types';

export function actionLabel(action: TransactionAction): string {
  return action === 'TAKING' ? 'Taking' : 'Submitting Back';
}
