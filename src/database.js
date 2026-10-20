const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const configuredDataDir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
const dataDir = configuredDataDir
  ? path.resolve(configuredDataDir)
  : path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS riot_profiles (
  user_id TEXT PRIMARY KEY,
  riot_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS giveaways (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  winners INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  ended INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS giveaway_entries (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
CREATE TABLE IF NOT EXISTS role_panels (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS role_panel_messages (
  guild_id TEXT NOT NULL,
  category TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY (guild_id, category)
);
CREATE TABLE IF NOT EXISTS temporary_bans (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS invite_joins (
  guild_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  inviter_id TEXT,
  invite_code TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, member_id)
);
`);

module.exports = {
  db,
  setRiotId: db.prepare(`INSERT INTO riot_profiles(user_id, riot_id, updated_at)
    VALUES(?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET riot_id=excluded.riot_id, updated_at=excluded.updated_at`),
  getRiotId: db.prepare('SELECT riot_id FROM riot_profiles WHERE user_id = ?'),
  createGiveaway: db.prepare(`INSERT INTO giveaways(message_id, channel_id, guild_id, host_id, prize, winners, ends_at)
    VALUES(@message_id, @channel_id, @guild_id, @host_id, @prize, @winners, @ends_at)`),
  getGiveaway: db.prepare('SELECT * FROM giveaways WHERE message_id = ?'),
  activeGiveaways: db.prepare('SELECT * FROM giveaways WHERE ended = 0'),
  endGiveaway: db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?'),
  claimGiveawayFinish: db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ? AND ended = 0'),
  addEntry: db.prepare(`INSERT OR IGNORE INTO giveaway_entries(message_id, user_id)
    SELECT ?, ? WHERE EXISTS (
      SELECT 1 FROM giveaways WHERE message_id = ? AND ended = 0 AND ends_at > ?
    )`),
  entries: db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id = ?'),
  entryCount: db.prepare('SELECT COUNT(*) AS total FROM giveaway_entries WHERE message_id = ?'),
  saveRolePanel: db.prepare(`INSERT INTO role_panel_messages(guild_id, category, channel_id, message_id)
    VALUES(?, ?, ?, ?) ON CONFLICT(guild_id, category) DO UPDATE SET channel_id=excluded.channel_id, message_id=excluded.message_id`),
  getRolePanel: db.prepare('SELECT * FROM role_panel_messages WHERE message_id = ?'),
  deleteRolePanel: db.prepare('DELETE FROM role_panel_messages WHERE message_id = ?'),
  setTemporaryBan: db.prepare(`INSERT INTO temporary_bans(guild_id, user_id, reason, banned_by, expires_at)
    VALUES(?, ?, ?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET reason=excluded.reason, banned_by=excluded.banned_by, expires_at=excluded.expires_at`),
  getTemporaryBan: db.prepare('SELECT * FROM temporary_bans WHERE guild_id = ? AND user_id = ?'),
  expiredTemporaryBans: db.prepare('SELECT * FROM temporary_bans WHERE expires_at <= ?'),
  deleteTemporaryBan: db.prepare('DELETE FROM temporary_bans WHERE guild_id = ? AND user_id = ?'),
  recordInviteJoin: db.prepare(`INSERT OR IGNORE INTO invite_joins(guild_id, member_id, inviter_id, invite_code, joined_at)
    VALUES(?, ?, ?, ?, ?)`),
  countInvitedMembers: db.prepare('SELECT COUNT(*) AS total FROM invite_joins WHERE guild_id = ? AND inviter_id = ?')
};
