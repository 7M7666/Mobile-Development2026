// node tests/verify-graph.cjs <typescript.js>
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(process.argv[2] || 'typescript');
const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/utils/GraphExpression.ets'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const sandbox = { exports: {} };
vm.runInNewContext(output.outputText, sandbox);
const { GraphExpression, sampleGraph } = sandbox.exports;
let count = 0;
for (const [text, x, expected] of [
  ['2+3*4', 0, 14], ['(2+3)*4', 0, 20], ['2^3^2', 0, 512],
  ['-x^2', 3, -9], ['2^-2', 0, .25], ['(-x)^2', 3, 9],
  ['sin(π/6)', 0, .5], ['cos(x)', 0, 1], ['tan(x)', Math.PI/4, 1],
  ['sqrt(x)', 9, 3], ['abs(-x)', 4, 4], ['ln(e)', 0, 1],
  ['log(100)', 0, 2], ['exp(1)', 0, Math.E], ['x^3', -2, -8],
  [' .5 + 1.25 ', 0, 1.75], ['1e-3*x', 2, .002],
  ['sin(cos(x))+exp(-x^2)', 0, Math.sin(1)+1], ['8/2/2', 0, 2]
]) {
  const result = new GraphExpression(text).evaluate(x);
  assert(result.valid, text);
  assert(Math.abs(result.value-expected) < 1e-10, text);
  count++;
}
for (const text of ['', 'sin((x', 'foo(x)', '2x', 'x y', '1..2', 'sin()',
  'sin(x,2)', 'x+', 'x**2', '()', 'x)', '2^^3', 'Math.sin(x)',
  'x;1', 'sin x', 'e2', 'x'.repeat(257), '('.repeat(40)+'x'+')'.repeat(40)]) {
  assert.equal(new GraphExpression(text).evaluate(0).valid, false, text);
  assert.equal(sampleGraph(new GraphExpression(text)).length, 0, text);
  count++;
}
for (const text of ['1/x', 'sqrt(x)', 'ln(x)', 'tan(x)']) {
  assert(new GraphExpression(text).evaluate(-1).valid, text+' syntax independent of domain'); count++;
}
for (const text of ['sin(x)', 'cos(x)', 'tan(x)', 'x^2', 'x^3', 'sqrt(x)']) {
  const points = sampleGraph(new GraphExpression(text));
  assert.equal(points.length, 601);
  assert(points.some(p => p.connect), text+' renders');
  if (text === 'sqrt(x)') assert(points.filter(p => p.x < 0).every(p => Number.isNaN(p.y)));
  count++;
}
// Poles between sample points must not acquire connecting segments, even at small amplitudes.
for (const [text, pole] of [['1/x',0], ['0.001/(x-0.015)',.015],
  ['0.001/((x-0.015)^2)',.015], ['tan(x)',Math.PI/2], ['0.001*tan(x)',Math.PI/2]]) {
  const points = sampleGraph(new GraphExpression(text));
  const right = points.findIndex(p => p.x >= pole);
  assert(!points[right].connect, text+' pole'); count++;
}
const steep = sampleGraph(new GraphExpression('500*x'));
assert(steep.some(p => Number.isFinite(p.y)), 'steep continuous function survives'); count++;
console.log(`PASS ${count} graph checks`);
