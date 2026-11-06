const test = require('node:test');
const assert = require('node:assert/strict');
const { giveawayDuration, giveawayEligibility } = require('./giveaway-utils');

test('giveaway durations support minutes, hours, days, weeks, and 30-day months', () => {
  assert.deepEqual(giveawayDuration(2, 'hours'), { milliseconds: 7200000, label: '2 heures' });
  assert.deepEqual(giveawayDuration(3, 'days'), { milliseconds: 259200000, label: '3 jours' });
  assert.deepEqual(giveawayDuration(1, 'weeks'), { milliseconds: 604800000, label: '1 semaine' });
  assert.deepEqual(giveawayDuration(2, 'months'), { milliseconds: 5184000000, label: '2 mois' });
  assert.equal(giveawayDuration(13, 'months'), null);
  assert.equal(giveawayDuration(0, 'hours'), null);
  assert.equal(giveawayDuration(1, 'semaines'), null);
});

test('giveaway role condition requires the configured Discord role', () => {
  assert.equal(giveawayEligibility({
    requiredRoleId: 'role-1',
    memberRoleIds: new Set(['role-2']),
    accountCreatedAt: 0
  }), 'required_role');
  assert.equal(giveawayEligibility({
    requiredRoleId: 'role-1',
    memberRoleIds: new Set(['role-1']),
    accountCreatedAt: 0
  }), null);
});

test('giveaway server-tag condition requires this guild tag to be equipped', () => {
  const base = {
    requireServerTag: true,
    guildId: 'giveaway-guild',
    serverTagGuildId: 'giveaway-guild',
    serverTagEnabled: true
  };
  assert.equal(giveawayEligibility(base), null);
  assert.equal(giveawayEligibility({ ...base, serverTagEnabled: false }), 'server_tag');
  assert.equal(giveawayEligibility({ ...base, serverTagGuildId: 'another-guild' }), 'server_tag');
  assert.equal(giveawayEligibility({ ...base, serverTagGuildId: undefined }), 'server_tag');
  assert.equal(giveawayEligibility({ requireServerTag: false }), null);
});

test('giveaway server-boost condition is optional and requires an active boost', () => {
  const base = { requireServerBoost: true };
  assert.equal(giveawayEligibility({ ...base, isServerBooster: true }), null);
  assert.equal(giveawayEligibility({ ...base, isServerBooster: false }), 'server_boost');
  assert.equal(giveawayEligibility({ requireServerBoost: false, isServerBooster: false }), null);
});

test('giveaway account-age condition rejects too-new or unverifiable accounts', () => {
  const now = 100 * 86400000;
  assert.equal(giveawayEligibility({
    minAccountAgeDays: 30,
    accountCreatedAt: now - 29 * 86400000,
    now
  }), 'account_too_new');
  assert.equal(giveawayEligibility({
    minAccountAgeDays: 30,
    accountCreatedAt: Number.NaN,
    now
  }), 'account_age_unknown');
  assert.equal(giveawayEligibility({
    minAccountAgeDays: 30,
    accountCreatedAt: now - 30 * 86400000,
    now
  }), null);
});
