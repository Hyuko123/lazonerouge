const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDir = path.join(process.cwd(), 'data');
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
  saveRolePanel: db.prepare(`INSERT INTO role_panels(guild_id, channel_id, message_id)
    VALUES(?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id, message_id=excluded.message_id`),
  getRolePanel: db.prepare('SELECT * FROM role_panels WHERE message_id = ?'),
  deleteRolePanel: db.prepare('DELETE FROM role_panels WHERE message_id = ?')
};
