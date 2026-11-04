const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfToday(): number {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

export function toDateKey(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = date.getHours() >= 12 ? 'PM' : 'AM';
  const hours = date.getHours() % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]}, ${formatTime(iso)}`;
}
