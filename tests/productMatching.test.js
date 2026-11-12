const test = require('node:test');
const assert = require('node:assert/strict');
const { matchProduct } = require('../backend/src/services/product-matching/index');
const { runEvaluation } = require('../backend/src/services/product-matching/evaluation');

test('Product Matching Evaluation Suite achieves >95% Top-1 Accuracy across official catalogue', () => {
  const result = runEvaluation();
  assert.ok(result.top1Acc >= 95, `Expected Top-1 accuracy >= 95%, got ${result.top1Acc}%`);
});

test('Pack Size and Requested Quantity are strictly distinguished', () => {
  const res = matchProduct('putty 40kg - 3 bags');
  assert.equal(res.attributes.packSize.canonical, '40KG');
  assert.equal(res.quantity, 3);
  assert.equal(res.unit, 'Bags');

  const res2 = matchProduct('apex 20lt x 2');
  assert.equal(res2.attributes.packSize.canonical, '20LT');
  assert.equal(res2.quantity, 2);

  const res3 = matchProduct('brush 2" 10 nos');
  assert.equal(res3.attributes.packSize.canonical, '2"');
  assert.equal(res3.quantity, 10);
});

test('Hard Negatives: 2 inch brush must not match 1 1/2 inch or 2 1/2 inch', () => {
  const res = matchProduct('brush 2" 5 nos');
  assert.equal(res.matchedProduct.packSize, '2"');
  assert.ok(!res.matchedProduct.item_name.includes('1/2'));
});
