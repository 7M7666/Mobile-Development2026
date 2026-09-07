export function formatNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toPrecision(12)).toString() : 'Error';
}

export function formatAnswer(value: number, mode: string, precision: number): string {
  if (!Number.isFinite(value)) { return 'Error'; }
  const digits = [2, 4, 6, 10].includes(precision) ? precision : 10;
  if (mode === 'Scientific') { return value.toExponential(digits); }
  if (mode === 'Auto') {
    if (value !== 0 && (Math.abs(value) >= 1e12 || Math.abs(value) < Math.pow(10, -digits))) {
      const parts = value.toExponential(digits).split('e');
      return `${Number(parts[0])}e${parts[1]}`;
    }
    return Number(value.toFixed(digits)).toString();
  }
  const fixed = value.toFixed(digits);
  if (!fixed.includes('e')) { return Number(fixed) === 0 ? (0).toFixed(digits) : fixed; }
  const parts = fixed.split('e');
  const sign = value < 0 ? '-' : '';
  const mantissa = parts[0].replace('-', '').split('.');
  const numbers = mantissa.join('');
  const places = Number(parts[1]) - (mantissa[1] || '').length;
  return sign + numbers + '0'.repeat(Math.max(0, places)) + '.' + '0'.repeat(digits);
}

export function formatDMS(value: number, angle: string, precision: number): string {
  const degrees = angle === 'RAD' ? value * 180 / Math.PI : value;
  if (!Number.isFinite(degrees) || Math.abs(degrees) > 1e9) { return 'Error'; }
  const total = Number((Math.abs(degrees) * 3600).toFixed(precision));
  const d = Math.floor(total / 3600);
  const m = Math.floor((total - d * 3600) / 60);
  const s = Number((total - d * 3600 - m * 60).toFixed(precision));
  return `${degrees < 0 && total !== 0 ? '−' : ''}${d}° ${m}′ ${s}″`;
}

export function gcd(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) { return NaN; }
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { const next = a % b; a = b; b = next; }
  return a;
}

export function combinatorics(n: number, r: number, combination: boolean): number {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || n < 0 || r < 0 || r > n) { return NaN; }
  const steps = combination ? Math.min(r, n - r) : r;
  if (steps > 10000) { return NaN; }
  let result = 1;
  for (let i = 1; i <= steps; i++) {
    let numerator = n - i + 1;
    let denominator = combination ? i : 1;
    const factor = gcd(numerator, denominator);
    numerator /= factor; denominator /= factor;
    result = (result / denominator) * numerator;
    if (!Number.isSafeInteger(result)) { return NaN; }
  }
  return result;
}

export interface Group {
  left: number | null;
  operator: string;
  label: string;
  fn: string;
  angle: string;
}

export interface CalculationState {
  value: number;
  left: number | null;
  operator: string;
  label: string;
  term: string;
  display: string;
  expression: string;
  waiting: boolean;
  hasValue: boolean;
  editing: boolean;
  dms: boolean;
  dmsAngle: string;
  groups: Group[];
}

// Immediate execution, with a small saved-state array for explicit parentheses.
export class Calculator {
  display: string = '0';
  expression: string = '';
  record: string = '';
  recordFormula: string = '';
  recordState: CalculationState | null = null;
  private value: number = 0;
  private left: number | null = null;
  private operator: string = '';
  private label: string = '';
  private term: string = '';
  private waiting: boolean = true;
  private finished: boolean = false;
  private hasValue: boolean = false;
  private optionalOpen: boolean = false;
  private groups: Group[] = [];
  private editing: boolean = false;
  private dms: boolean = false;
  private dmsAngle: string = 'DEG';

  answer(mode: string, precision: number): string {
    if (this.display === 'Error') { return 'Error'; }
    if (this.dms) { return formatDMS(this.value, this.dmsAngle, precision); }
    return this.editing ? this.display : formatAnswer(this.value, mode, precision);
  }

  snapshot(): CalculationState {
    return { value: this.value, left: this.left, operator: this.operator, label: this.label,
      term: this.term, display: this.display, expression: this.expression, waiting: this.waiting,
      hasValue: this.hasValue, editing: this.editing, dms: this.dms, dmsAngle: this.dmsAngle,
      groups: this.groups.map((g: Group): Group => ({ left: g.left, operator: g.operator, label: g.label, fn: g.fn, angle: g.angle })) };
  }

  restore(state: CalculationState): void {
    this.clear();
    this.value = state.value; this.left = state.left; this.operator = state.operator;
    this.label = state.label; this.term = state.term; this.display = state.display;
    this.expression = state.expression; this.waiting = state.waiting; this.hasValue = state.hasValue;
    this.editing = state.editing; this.dms = state.dms; this.dmsAngle = state.dmsAngle;
    this.groups = state.groups.map((g: Group): Group => ({ left: g.left, operator: g.operator, label: g.label, fn: g.fn, angle: g.angle }));
  }

  private saveRecord(state: CalculationState): void {
    this.recordFormula = this.term;
    this.record = `${this.term} = ${this.display}`;
    this.recordState = state;
  }

  clear(): void {
    this.display = '0';
    this.expression = '';
    this.value = 0;
    this.left = null;
    this.operator = '';
    this.label = '';
    this.term = '';
    this.waiting = true;
    this.finished = false;
    this.hasValue = false;
    this.optionalOpen = false;
    this.groups = [];
    this.editing = false;
    this.dms = false;
    this.record = '';
    this.recordFormula = '';
    this.recordState = null;
  }

  private fail(): void {
    this.clear();
    this.display = 'Error';
  }

  private setValue(value: number, term: string): void {
    if (!Number.isFinite(value)) {
      this.fail();
      return;
    }
    this.value = value;
    this.display = formatNumber(value);
    this.term = term;
    this.waiting = false;
    this.hasValue = true;
    this.editing = false;
  }

  private calculate(): boolean {
    if (this.left === null || this.operator === '') { return true; }
    if (this.waiting) { this.fail(); return false; }
    let result: number = this.value;
    switch (this.operator) {
      case '+': result = this.left + this.value; break;
      case '−': result = this.left - this.value; break;
      case '×': result = this.left * this.value; break;
      case '÷': result = this.value === 0 ? NaN : this.left / this.value; break;
      case 'xʸ': result = Math.pow(this.left, this.value); break;
      case 'mod': result = this.value === 0 ? NaN : this.left % this.value; break;
      case 'nCr': result = combinatorics(this.left, this.value, true); break;
      case 'nPr': result = combinatorics(this.left, this.value, false); break;
      case 'GCD': result = gcd(this.left, this.value); break;
      case 'LCM': {
        const divisor = gcd(this.left, this.value);
        result = divisor === 0 ? 0 : Math.abs((this.left / divisor) * this.value);
        if (!Number.isSafeInteger(result)) { result = NaN; }
        break;
      }
    }
    const text = `${this.label} ${this.operator === 'xʸ' ? '^' : this.operator} ${this.term}`;
    this.setValue(result, text);
    return this.display !== 'Error';
  }

  private unary(fn: string, value: number, angle: string): number {
    const radians = angle === 'DEG' ? value * Math.PI / 180 : value;
    switch (fn) {
      case 'sin': return Math.sin(radians);
      case 'cos': return Math.cos(radians);
      case 'tan': return Math.abs(Math.cos(radians)) < 1e-12 ? NaN : Math.tan(radians);
      case 'asin': return Math.asin(value) * (angle === 'DEG' ? 180 / Math.PI : 1);
      case 'acos': return Math.acos(value) * (angle === 'DEG' ? 180 / Math.PI : 1);
      case 'atan': return Math.atan(value) * (angle === 'DEG' ? 180 / Math.PI : 1);
      case 'sinh': return Math.sinh(value);
      case 'cosh': return Math.cosh(value);
      case 'tanh': return Math.tanh(value);
      case 'eˣ': return Math.exp(value);
      case '√': return Math.sqrt(value);
      case 'x²': return value * value;
      case 'ln': return Math.log(value);
      case 'log': return Math.log(value) / Math.LN10;
      case '%': return value / 100;
      default: return value;
    }
  }

  private functionLabel(fn: string, term: string, angle: string): string {
    if (fn === '%') { return `(${term})%`; }
    if (fn === 'x²') { return `(${term})²`; }
    const unit = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(fn) ? ` ${angle}` : '';
    return `${fn}(${term}${unit})`;
  }

  private open(fn: string, angle: string): void {
    if (!this.waiting && this.hasValue && !this.finished) { this.fail(); return; }
    if (this.groups.length >= 12) { this.fail(); return; }
    this.groups.push({ left: this.left, operator: this.operator, label: this.label, fn: fn, angle: angle });
    this.left = null;
    this.operator = '';
    this.label = '';
    this.term = '';
    this.hasValue = false;
    this.waiting = true;
    this.finished = false;
    this.value = 0;
    this.display = '0';
  }

  private updateExpression(): void {
    let prefix = '';
    this.groups.forEach((group: Group) => {
      prefix += (group.operator ? `${group.label} ${group.operator} ` : '') + group.fn + '(';
    });
    this.expression = prefix + (this.operator ? `${this.label} ${this.operator} ` : '') +
      (this.waiting ? '' : this.term);
  }

  press(key: string, angle: string = 'DEG'): void {
    this.record = '';
    this.recordState = null;
    if (key === 'AC') { this.clear(); return; }
    if (this.display === 'Error') { this.clear(); }
    if (key === 'DMS') {
      if (!this.hasValue || this.waiting) { this.fail(); return; }
      this.dms = !this.dms;
      this.dmsAngle = angle;
      if (formatDMS(this.value, angle, 10) === 'Error') { this.fail(); return; }
      return;
    }
    this.dms = false;
    if (key === '(' && this.optionalOpen) { this.optionalOpen = false; return; }
    this.optionalOpen = false;
    if (/^[0-9.]$/.test(key)) {
      if (this.finished) { this.clear(); }
      if (this.waiting) { this.display = '0'; }
      if (key === '.' && this.display.includes('.')) { return; }
      if (this.display.length >= 16 && !this.waiting) { return; }
      this.display = key === '.' ? this.display + '.' :
        (this.display === '0' ? key : this.display + key);
      this.value = Number(this.display);
      this.term = this.display;
      this.waiting = false;
      this.hasValue = true;
      this.editing = true;
    } else if (key === '⌫') {
      if (this.finished) { this.clear(); return; }
      if (this.waiting) { return; }
      this.display = this.display.includes('e') ? '0' : this.display.slice(0, -1);
      if (this.display === '' || this.display === '-') { this.display = '0'; }
      this.value = Number(this.display);
      this.term = this.display;
      this.editing = true;
    } else if (key === 'π' || key === 'e') {
      if (this.finished) { this.clear(); }
      this.setValue(key === 'π' ? Math.PI : Math.E, key);
    } else if (['+', '−', '×', '÷', 'xʸ', 'mod', 'nCr', 'nPr', 'GCD', 'LCM'].includes(key)) {
      if (!this.hasValue) {
        if (key !== '−') { this.fail(); return; }
        this.setValue(0, '0');
      }
      if (!this.waiting) {
        if (!this.calculate()) { return; }
        this.left = this.value;
        this.label = this.finished ? this.display : (this.operator ? `(${this.term})` : this.term);
      }
      this.operator = key;
      this.waiting = true;
      this.finished = false;
    } else if (key === '(') {
      if (this.finished) { this.clear(); }
      this.open('', angle);
    } else if (key === ')') {
      if (this.groups.length === 0 || !this.hasValue || this.waiting) { this.fail(); return; }
      if (!this.calculate()) { return; }
      const group = this.groups.pop()!;
      const value = group.fn ? this.unary(group.fn, this.value, group.angle) : this.value;
      const term = group.fn ? this.functionLabel(group.fn, this.term, group.angle) : `(${this.term})`;
      this.left = group.left;
      this.operator = group.operator;
      this.label = group.label;
      this.setValue(value, term);
    } else if (key === '=') {
      if (this.finished) { return; }
      if (this.groups.length > 0 || !this.hasValue || this.waiting) { this.fail(); return; }
      const draft = this.snapshot();
      if (!this.calculate()) { return; }
      this.editing = false;
      this.expression = `${this.term} =`;
      this.saveRecord(draft);
      this.left = null;
      this.operator = '';
      this.finished = true;
      return;
    } else if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'eˣ', '√', 'x²', 'ln', 'log', '%'].includes(key)) {
      if (!this.hasValue || this.waiting) {
        this.open(key, angle);
        this.optionalOpen = true;
      } else {
        const term = this.finished ? this.display : this.term;
        this.finished = false;
        this.setValue(this.unary(key, this.value, angle), this.functionLabel(key, term, angle));
        if (this.display !== 'Error' && this.operator === '' && this.groups.length === 0) {
          this.updateExpression();
          this.saveRecord(this.snapshot());
          this.finished = true;
        }
      }
    } else { this.fail(); return; }
    if (this.display !== 'Error') { this.updateExpression(); }
  }
}

export function graphValue(fn: string, x: number): number {
  switch (fn) {
    case 'sin(x)': return Math.sin(x);
    case 'cos(x)': return Math.cos(x);
    case 'tan(x)': return Math.abs(Math.cos(x)) < 0.025 ? NaN : Math.tan(x);
    case 'x²': return x * x;
    case 'x³': return x * x * x;
    case '√x': return x >= 0 ? Math.sqrt(x) : NaN;
    default: return NaN;
  }
}
