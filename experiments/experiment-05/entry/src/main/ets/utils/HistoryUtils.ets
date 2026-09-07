import { CalculationState } from './CalculatorUtils';

export interface HistoryEntry {
  id: number;
  module: string;
  formula: string;
  answer: string;
  angle: string;
  state: CalculationState;
}

export function addHistory(items: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  let count = 0;
  return [entry, ...items].filter((item: HistoryEntry) => {
    if (item.module !== entry.module) { return true; }
    return ++count <= 10;
  });
}

export function filterHistory(items: HistoryEntry[], module: string, query: string): HistoryEntry[] {
  const search = query.trim().toLowerCase();
  return items.filter((item: HistoryEntry) => (module === 'ALL' || item.module === module) &&
    `${item.formula} ${item.answer}`.toLowerCase().includes(search));
}
