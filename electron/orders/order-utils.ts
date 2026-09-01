import type { DealCandidate, ProjectFolder, RevenueSummary, Transaction } from './order-types.js';

export function matchesRemarkPrefix(remarkName: string, prefixes = ['鱼', '书']): boolean {
  const value = remarkName.trim();
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function parseFolderName(name: string, year: number): ProjectFolder {
  const match = name.match(/^(\d{2})[-_](\d{2})[-_](.+)$/);
  return { name, path: '', year, datePrefix: match ? `${match[1]}-${match[2]}` : null };
}

export function formatFolderName(date: Date, projectName: string, separator = '_'): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const safe = projectName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '');
  return `${month}-${day}${separator}${safe || '未命名项目'}`;
}

export function renderFolderTemplate(template: string, date: Date, projectName: string): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear());
  const safe = projectName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '') || '未命名项目';
  return template
    .replaceAll('{YYYY}', year)
    .replaceAll('{MM}', month)
    .replaceAll('{DD}', day)
    .replaceAll('{MM-DD}', `${month}-${day}`)
    .replaceAll('{projectName}', safe);
}

export function nextAvailableFolderName(baseName: string, existingNames: Iterable<string>): string {
  const names = new Set(existingNames);
  if (!names.has(baseName)) return baseName;
  let index = 2;
  while (names.has(`${baseName}-${index}`)) index += 1;
  return `${baseName}-${index}`;
}

export function summarizeRevenue(transactions: Transaction[], candidates: DealCandidate[] = []): RevenueSummary {
  let gross = 0;
  let refunds = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'refund') refunds += Math.abs(transaction.amount);
    else gross += Math.max(0, transaction.amount);
  }
  return {
    gross,
    refunds,
    net: gross - refunds,
    orderCount: new Set(transactions.map((transaction) => transaction.id.split(':')[0])).size,
    pendingCandidateCount: candidates.filter((candidate) => candidate.status === 'candidate').length,
  };
}
