const test = require('node:test');
const assert = require('node:assert/strict');
const commands = require('./commands');

test('all registered slash command names use English identifiers', () => {
  const names = commands.map(command => command.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every(name => /^[a-z0-9-]+$/.test(name)));
  assert.ok(names.includes('clear'));
  assert.ok(names.includes('giveaway-create'));
  assert.ok(names.includes('giveaway-end'));
  assert.ok(names.includes('giveaway-reroll'));
});

test('giveaway creation exposes durations and optional player requirements', () => {
  const command = commands.find(item => item.name === 'giveaway-create');
  const options = new Map(command.options.map(option => [option.name, option]));
  assert.deepEqual(options.get('duration_unit').choices.map(choice => choice.value), [
    'minutes', 'hours', 'days', 'weeks', 'months'
  ]);
  assert.equal(options.get('required_role').required, false);
  assert.equal(options.get('require_server_tag').type, 5);
  assert.equal(options.get('require_server_tag').required, false);
  assert.equal(options.get('require_server_boost').type, 5);
  assert.equal(options.get('require_server_boost').required, false);
  assert.equal(options.get('min_account_age_days').required, false);
});
