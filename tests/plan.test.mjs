import assert from 'node:assert/strict';
import { extractPlan, normalizePlan, budgetTotal, buildPrompt, addDays } from '../js/plan.js';

const good = { title: 'Manali', destination: 'Manali', origin: 'Delhi', startDate: '2026-12-01', endDate: '2026-12-04', travellers: 2, budget: 15000,
  days: [{ title: 'Arrive', morning: 'Drive', afternoon: 'Mall Road', evening: 'Dinner', estCost: 1500 }, { title: 'Solang', morning: 'Paragliding' }],
  budgetEstimate: { transport: 4000, accommodation: 5000, food: 2000, bogus: 5, activities: -3 }, assumptions: ['Prices are rough'] };
const reply = `Here is a plan.\n\n\`\`\`wayfarer-plan\n${JSON.stringify(good)}\n\`\`\`\nEnjoy`;
const r = extractPlan(reply);
assert.ok(r.plan && !r.invalid); assert.equal(r.plan.days.length, 2);
assert.equal(r.plan.days[1].date, '2026-12-02'); assert.equal(r.plan.endDate, '2026-12-04');
assert.deepEqual(r.plan.budgetEstimate, { transport: 4000, accommodation: 5000, food: 2000 });
assert.equal(budgetTotal(r.plan.budgetEstimate), 11000);
assert.ok(!r.text.includes('wayfarer-plan'));
assert.equal(extractPlan('Just text, which city?').plan, null);
assert.equal(extractPlan('```wayfarer-plan\n{not json}\n```').invalid, true);
assert.equal(normalizePlan({ destination: 'X', days: [] }), null);
assert.equal(normalizePlan({ days: [{ title: 'a' }] }), null);
assert.equal(normalizePlan([]), null);
assert.equal(normalizePlan({ destination: 'X', travellers: 999, days: [{ title: 'a' }] }).travellers, 1);
const big = normalizePlan({ destination: 'X', days: Array.from({ length: 80 }, () => ({ title: 'd' })) }); assert.equal(big.days.length, 30);
assert.equal(normalizePlan({ destination: 'X', startDate: '2026-02-30', days: [{ title: 'a' }] }).startDate, '');
assert.equal(addDays('2026-12-30', 3), '2027-01-02');
const first = buildPrompt({ message: 'hi', profile: { interests: ['trekking'] }, firstTurn: true });
assert.match(first, /wayfarer-plan/); assert.match(first, /trekking/);
assert.doesNotMatch(buildPrompt({ message: 'hi', firstTurn: false }), /Never invent flight/);
const withTrip = buildPrompt({ message: 'x', trip: { id: 't1', destination: 'Goa', days: [] }, firstTurn: false }); assert.match(withTrip, /"t1"/);
console.log('plan tests passed');
