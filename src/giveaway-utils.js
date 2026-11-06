function giveawayDuration(amount, unit) {
  const units = {
    minutes: { milliseconds: 60000, maximum: 10080, label: 'minute' },
    hours: { milliseconds: 3600000, maximum: 168, label: 'heure' },
    days: { milliseconds: 86400000, maximum: 365, label: 'jour' },
    weeks: { milliseconds: 604800000, maximum: 52, label: 'semaine' },
    months: { milliseconds: 30 * 86400000, maximum: 12, label: 'mois' }
  };
  const details = units[unit];
  if (!details || !Number.isInteger(amount) || amount < 1 || amount > details.maximum) return null;
  return {
    milliseconds: amount * details.milliseconds,
    label: `${amount} ${details.label}${amount > 1 && unit !== 'months' ? 's' : ''}`
  };
}

function giveawayEligibility({
  requiredRoleId,
  minAccountAgeDays = 0,
  requireServerTag = false,
  serverTagGuildId,
  serverTagEnabled,
  guildId,
  requireServerBoost = false,
  isServerBooster = false,
  memberRoleIds,
  accountCreatedAt,
  now = Date.now()
}) {
  if (requireServerTag && (serverTagGuildId !== guildId || serverTagEnabled !== true)) {
    return 'server_tag';
  }
  if (requireServerBoost && !isServerBooster) return 'server_boost';
  if (requiredRoleId && !memberRoleIds?.has(requiredRoleId)) return 'required_role';
  if (minAccountAgeDays > 0) {
    if (!Number.isFinite(accountCreatedAt)) return 'account_age_unknown';
    if (now - accountCreatedAt < minAccountAgeDays * 86400000) return 'account_too_new';
  }
  return null;
}

module.exports = { giveawayDuration, giveawayEligibility };
