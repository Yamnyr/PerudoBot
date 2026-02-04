const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../perudo.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT,
    wins INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    dice_lost INTEGER DEFAULT 0,
    bluffs_called_success INTEGER DEFAULT 0,
    bluffs_called_fail INTEGER DEFAULT 0,
    calzas_success INTEGER DEFAULT 0,
    calzas_fail INTEGER DEFAULT 0
  )
`);

module.exports = {
    getPlayer: (id) => db.prepare('SELECT * FROM players WHERE id = ?').get(id),

    updatePlayerAtEnd: (id, username, isWinner) => {
        const player = db.prepare('SELECT id FROM players WHERE id = ?').get(id);
        if (!player) {
            db.prepare('INSERT INTO players (id, username) VALUES (?, ?)').run(id, username);
        }
        db.prepare(`
            UPDATE players 
            SET username = ?, 
                wins = wins + ?, 
                games_played = games_played + 1 
            WHERE id = ?
        `).run(username, isWinner ? 1 : 0, id);
    },

    incStat: (id, username, statName) => {
        const player = db.prepare('SELECT id FROM players WHERE id = ?').get(id);
        if (!player) {
            db.prepare('INSERT INTO players (id, username) VALUES (?, ?)').run(id, username);
        }
        db.prepare(`UPDATE players SET ${statName} = ${statName} + 1 WHERE id = ?`).run(id);
    },

    getLeaderboard: (limit = 10) => {
        return db.prepare('SELECT * FROM players ORDER BY wins DESC, games_played ASC LIMIT ?').all(limit);
    }
};
