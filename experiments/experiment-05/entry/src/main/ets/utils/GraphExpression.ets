export class GraphSample {
  value: number = NaN;
  valid: boolean = true;
  boundaries: number[] = [];
}

// Evaluate directly while reading; no intermediate expression tree or executable code.
export class GraphExpression {
  private source: string;
  private position: number = 0;
  private depth: number = 0;
  private x: number = 0;
  private sample: GraphSample = new GraphSample();

  constructor(source: string) {
    this.source = source.trim();
  }

  evaluate(x: number): GraphSample {
    this.position = 0;
    this.depth = 0;
    this.x = x;
    this.sample = new GraphSample();
    if (this.source.length === 0 || this.source.length > 256) {
      this.sample.valid = false;
      return this.sample;
    }
    this.sample.value = this.sum();
    this.space();
    if (this.position !== this.source.length) { this.sample.valid = false; }
    return this.sample;
  }

  private space(): void {
    while (this.position < this.source.length && /\s/.test(this.source.charAt(this.position))) {
      this.position++;
    }
  }

  private take(token: string): boolean {
    this.space();
    if (this.source.charAt(this.position) !== token) { return false; }
    this.position++;
    return true;
  }

  private sum(): number {
    let value = this.product();
    while (this.sample.valid) {
      if (this.take('+')) { value += this.product(); }
      else if (this.take('-')) { value -= this.product(); }
      else { break; }
    }
    return value;
  }

  private product(): number {
    let value = this.unary();
    while (this.sample.valid) {
      if (this.take('*')) { value *= this.unary(); }
      else if (this.take('/')) {
        const divisor = this.unary();
        this.sample.boundaries.push(divisor);
        value /= divisor;
      } else { break; }
    }
    return value;
  }

  private unary(): number {
    this.depth++;
    if (this.depth > 32) { this.sample.valid = false; this.depth--; return NaN; }
    let value: number;
    if (this.take('+')) { value = this.unary(); }
    else if (this.take('-')) { value = -this.unary(); }
    else {
      value = this.primary();
      if (this.sample.valid && this.take('^')) { value = Math.pow(value, this.unary()); }
    }
    this.depth--;
    return value;
  }

  private primary(): number {
    if (this.take('(')) {
      const value = this.sum();
      if (!this.take(')')) { this.sample.valid = false; }
      return value;
    }
    this.space();
    const remaining = this.source.substring(this.position);
    const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(remaining);
    if (numeric !== null) { this.position += numeric[0].length; return Number(numeric[0]); }
    if (this.take('π')) { return Math.PI; }
    const identifier = /^[a-z]+/.exec(remaining);
    if (identifier === null) { this.sample.valid = false; return NaN; }
    const name = identifier[0];
    this.position += name.length;
    if (name === 'x') { return this.x; }
    if (name === 'e') { return Math.E; }
    if (!this.take('(')) { this.sample.valid = false; return NaN; }
    const argument = this.sum();
    if (!this.take(')')) { this.sample.valid = false; }
    switch (name) {
      case 'sin': return Math.sin(argument);
      case 'cos': return Math.cos(argument);
      case 'tan':
        const cosine = Math.cos(argument);
        this.sample.boundaries.push(cosine);
        return Math.abs(cosine) < 1e-12 ? NaN : Math.tan(argument);
      case 'sqrt': return Math.sqrt(argument);
      case 'abs': return Math.abs(argument);
      case 'ln': return Math.log(argument);
      case 'log': return Math.log(argument) / Math.LN10;
      case 'exp': return Math.exp(argument);
      default: this.sample.valid = false; return NaN;
    }
  }
}

export class GraphPoint {
  x: number;
  y: number;
  connect: boolean;
  constructor(x: number, y: number, connect: boolean) {
    this.x = x;
    this.y = y;
    this.connect = connect;
  }
}

function continuous(a: GraphSample, b: GraphSample): boolean {
  if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) { return false; }
  for (let i = 0; i < a.boundaries.length; i++) {
    const left = a.boundaries[i];
    const right = b.boundaries[i];
    if (!Number.isFinite(left) || !Number.isFinite(right) || left === 0 || right === 0 ||
      (left < 0) !== (right < 0)) { return false; }
  }
  return true;
}

export function sampleGraph(expression: GraphExpression): GraphPoint[] {
  const points: GraphPoint[] = [];
  let previous = expression.evaluate(-10);
  for (let i = 0; i <= 600; i++) {
    const x = -10 + i / 30;
    const current = expression.evaluate(x);
    if (!current.valid) { return []; }
    const midpoint = expression.evaluate(x - 1 / 60);
    const visible = Number.isFinite(current.value) && Math.abs(current.value) <= 10;
    const connect = i > 0 && visible && Math.abs(previous.value) <= 10 &&
      continuous(previous, midpoint) && continuous(midpoint, current) &&
      Math.abs(midpoint.value) <= 10;
    points.push(new GraphPoint(x, visible ? current.value : NaN, connect));
    previous = current;
  }
  return points;
}
