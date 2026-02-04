const PerudoGame = require('./PerudoGame');

class GameManager {
    constructor() {
        this.games = new Map(); // channelId -> PerudoGame
    }

    createGame(channelId, host) {
        if (this.games.has(channelId)) {
            return null; // Game already exists
        }
        const game = new PerudoGame(channelId, host);
        this.games.set(channelId, game);
        return game;
    }

    getGame(channelId) {
        return this.games.get(channelId);
    }

    deleteGame(channelId) {
        this.games.delete(channelId);
    }
}

module.exports = new GameManager(); // Singleton
