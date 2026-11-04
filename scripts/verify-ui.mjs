import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import exceljs from 'exceljs';

const { Workbook } = exceljs;

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:5174/';
const shots = '/tmp/logistics-verify';
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.getByText('No transactions yet').waitFor();
  await assertNav(page, 'mobile');
  await page.screenshot({ path: `${shots}/01-dashboard-mobile.png`, fullPage: true });

  await page.getByRole('link', { name: 'SCAN BARCODE' }).click();
  await page.getByRole('heading', { name: 'Scan barcode' }).waitFor();
  await page.getByLabel('Barcode / Item ID').waitFor();
  await page.getByText('Starting camera').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: `${shots}/02-scanner-mobile.png`, fullPage: true });

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Enter a barcode to continue.').waitFor();

  await page.getByLabel('Barcode / Item ID').fill('890123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Register transaction' }).waitFor();
  const barcode = page.locator('#barcode');
  if ((await barcode.inputValue()) !== '890123456') throw new Error('barcode was not filled');
  if (!(await barcode.evaluate((element) => element.readOnly))) throw new Error('scanned barcode should be read-only');

  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText("Enter the person's name.").waitFor();
  await page.getByText('Enter a reason.').waitFor();
  await page.getByText('Select Taking or Submitting Back.').waitFor();
  await page.screenshot({ path: `${shots}/03-validation-mobile.png`, fullPage: true });

  await page.getByLabel('Name').fill('Rahul');
  await page.getByLabel('Reason').fill('Lab Work');
  await page.locator('#action').selectOption('TAKING');
  const save = page.getByRole('button', { name: 'Save transaction' });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const cancel = page.getByRole('button', { name: 'Cancel' });
  const cancelBox = await cancel.boundingBox();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const navBox = await nav.boundingBox();
  if (!cancelBox || !navBox) throw new Error('missing cancel button or navigation box');
  if (cancelBox.y + cancelBox.height > navBox.y + 1) {
    throw new Error(`Cancel button is covered by the bottom nav (${cancelBox.y + cancelBox.height} > ${navBox.y})`);
  }
  await page.screenshot({ path: `${shots}/04-form-mobile.png`, fullPage: true });
  await save.click();

  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.getByText('890123456 marked as taken.').waitFor();
  await expectStat(page, 'Unique items', '1');
  await expectStat(page, 'Currently taken', '1');
  await expectStat(page, 'Available', '0');
  await expectStat(page, 'Transactions today', '1');
  await page.getByText('Rahul').waitFor();
  await page.screenshot({ path: `${shots}/05-dashboard-after-take.png`, fullPage: true });

  await page.getByRole('link', { name: 'Taken' }).click();
  await page.getByRole('heading', { name: 'Currently taken items' }).waitFor();
  await page.getByText('Lab Work').waitFor();
  await page.getByText('Taken', { exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/06-taken-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Submit back' }).click();

  await page.getByRole('heading', { name: 'Register transaction' }).waitFor();
  if ((await page.locator('#barcode').inputValue()) !== '890123456') throw new Error('return barcode missing');
  if ((await page.getByLabel('Name').inputValue()) !== 'Rahul') throw new Error('return name was not prefilled');
  if ((await page.locator('#action').inputValue()) !== 'RETURNING') throw new Error('return action was not prefilled');
  await page.getByLabel('Reason').fill('Finished');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await page.getByRole('heading', { name: 'Currently taken items' }).waitFor();
  await page.getByText('All items are back').waitFor();
  await page.screenshot({ path: `${shots}/07-taken-empty.png`, fullPage: true });

  await page.getByRole('link', { name: 'Scan' }).click();
  await page.getByLabel('Barcode / Item ID').fill('890123457');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Name').fill('Amit');
  await page.getByLabel('Reason').fill('Event Setup');
  await page.locator('#action').selectOption('TAKING');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();

  await page.getByRole('link', { name: 'Scan' }).click();
  await page.getByLabel('Barcode / Item ID').fill('890123457');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Name').fill('Amit');
  await page.getByLabel('Reason').fill('Duplicate');
  await page.locator('#action').selectOption('TAKING');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText('already taken by Amit').waitFor();

  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('heading', { name: 'Transaction history' }).waitFor();
  await page.getByText('3 transactions').waitFor();
  await page.screenshot({ path: `${shots}/08-history-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Taking', exact: true }).click();
  await page.getByText('2 transactions').waitFor();
  await page.getByRole('button', { name: 'Submitting Back', exact: true }).click();
  await page.getByText('1 transaction').waitFor();
  await page.getByText('Finished').waitFor();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByPlaceholder('Search by barcode or name').fill('amit');
  await page.getByText('1 transaction').waitFor();
  await page.getByText('Event Setup').waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByText('3 transactions').waitFor();

  const today = localDateKey();
  await page.locator('input[type="date"]').nth(0).fill(today);
  await page.locator('input[type="date"]').nth(1).fill(today);
  await page.getByText('3 transactions').waitFor();
  await page.locator('input[type="date"]').nth(0).fill('2099-01-01');
  await page.getByText('No matching transactions').waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  const excel = await download(page, page.getByRole('button', { name: 'Export to Excel' }));
  const workbook = new Workbook();
  await workbook.xlsx.readFile(excel);
  const history = workbook.getWorksheet('Transaction History');
  const taken = workbook.getWorksheet('Currently Taken Items');
  if (!history || !taken) throw new Error('workbook is missing a sheet');
  if (history.rowCount !== 4) throw new Error(`expected 4 history rows, got ${history.rowCount}`);
  if (String(taken.getRow(2).getCell(1).value) !== '890123457') throw new Error('taken sheet has the wrong barcode');
  if (String(taken.getRow(2).getCell(6).value) !== 'Taken') throw new Error('taken status missing');

  const backupPath = `${shots}/backup.json`;
  const backup = await download(page, page.getByRole('button', { name: 'JSON backup' }), backupPath);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'SCAN BARCODE' }).click();
  await page.getByLabel('Barcode / Item ID').fill('999');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Name').fill('Sam');
  await page.getByLabel('Reason').fill('Temp');
  await page.locator('#action').selectOption('TAKING');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText('999 marked as taken.').waitFor();

  await restore(page, backup, 'Keep current data');
  await page.getByText('Sam').waitFor();

  await restore(page, backup, 'Replace existing data');
  await page.getByText('Backup restored on this device.').waitFor();
  await page.getByText('Sam').waitFor({ state: 'hidden' });
  await expectStat(page, 'Unique items', '2');

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await expectStat(page, 'Currently taken', '1');
  await page.getByText('Amit').waitFor();
  await page.screenshot({ path: `${shots}/09-after-reload.png`, fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await assertNav(page, 'desktop');
  await page.screenshot({ path: `${shots}/10-dashboard-desktop.png`, fullPage: true });
  await page.getByRole('link', { name: 'History' }).click();
  await page.locator('table').waitFor();
  await page.screenshot({ path: `${shots}/11-history-desktop.png`, fullPage: true });
  await page.getByRole('link', { name: 'Taken' }).click();
  await page.getByText('Event Setup').waitFor();
  await page.screenshot({ path: `${shots}/12-taken-desktop.png`, fullPage: true });

  if (pageErrors.length > 0) throw new Error(`page errors:\n${pageErrors.join('\n')}`);
  console.log('ui verification passed');
} catch (error) {
  await page.screenshot({ path: `${shots}/failure.png`, fullPage: true }).catch(() => {});
  console.error(pageErrors);
  throw error;
} finally {
  await browser.close();
}

async function expectStat(page, label, value) {
  const card = page.locator('article', { hasText: label });
  const actual = (await card.locator('p').first().innerText()).trim();
  if (actual !== value) throw new Error(`${label} expected ${value} but was ${actual}`);
}

async function assertNav(page, mode) {
  const navs = page.getByRole('navigation', { name: 'Primary' });
  const count = await navs.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await navs.nth(index).isVisible()) visible += 1;
  }
  if (visible !== 1) throw new Error(`${mode} should show one navigation, saw ${visible}`);
}

function localDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function download(page, locator, forcedPath) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    locator.click(),
  ]);
  const path = forcedPath ?? `${shots}/${file.suggestedFilename()}`;
  await file.saveAs(path);
  return path;
}

async function restore(page, backupPath, choice) {
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'Restore backup' }).waitFor();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Restore backup' }).click(),
  ]);
  await chooser.setFiles(backupPath);
  await page.getByRole('dialog', { name: 'Replace data on this device?' }).waitFor();
  await page.getByRole('button', { name: choice }).click();
}
