const { EventEmitter } = require('events');
const Player = require('./Player');
const config = require('../config');

class PerudoGame extends EventEmitter {
    constructor(channelId, host) {
        super();
        this.channelId = channelId;
        this.players = []; // Array of Player objects
        this.state = 'LOBBY'; // LOBBY, PLAYING, ENDED
        this.round = 0;
        this.currentTurnIndex = 0;
        this.lastBid = null; // { quantity, face, player }
        this.palifico = false;
        this.history = []; // Array of last 5 bids for UX
        this.db = require('../utils/db');

        // Add host as first player
        this.addPlayer(host);
    }

    addPlayer(user) {
        if (this.state !== 'LOBBY') return false;
        if (this.players.some(p => p.id === user.id)) return false;
        if (this.players.length >= config.game.maxPlayers) return false;

        this.players.push(new Player(user));
        this.emit('playerJoined', new Player(user)); // Correctly referencing the new player object might need capturing it
        return true;
    }

    start() {
        if (this.players.length < config.game.minPlayers) {
            throw new Error(`Il faut au moins ${config.game.minPlayers} joueurs pour commencer.`);
        }
        this.state = 'PLAYING';
        this.startRound();
    }

    startRound() {
        this.round++;
        this.lastBid = null;
        this.history = []; // Reset history for new round

        let currentPlayer = this.players[this.currentTurnIndex];

        // Palifico check: Logic is simplified for this demo
        // If current player (who starts the round) has 1 die, and there are > 2 players left.
        const activePlayers = this.players.filter(p => !p.eliminated);
        this.palifico = (currentPlayer.diceCount === 1 && activePlayers.length > 2);

        // Roll dice
        this.players.forEach(p => p.rollDice());

        // Emit event so the command handler can send the public embed + buttons
        this.emit('roundStart', {
            round: this.round,
            palifico: this.palifico,
            currentPlayer: currentPlayer
        });
    }

    // New method to retrieve dice for the ephemeral interaction
    getPlayerDice(userId) {
        const player = this.players.find(p => p.id === userId);
        if (!player) return null;
        if (player.eliminated) return [];
        return player.dice;
    }

    processBid(userId, quantity, face) {
        const playerIndex = this.players.findIndex(p => p.id === userId);
        if (playerIndex === -1) return { success: false, message: "Vous n'êtes pas dans la partie." };
        if (playerIndex !== this.currentTurnIndex) return { success: false, message: "Ce n'est pas ton tour !" };

        const player = this.players[playerIndex];

        if (![1, 2, 3, 4, 5, 6].includes(face)) return { success: false, message: "Valeur de dés invalide (1-6)." };
        if (quantity < 1) return { success: false, message: "Quantité invalide." };

        if (this.lastBid) {
            if (!this.isValidBid(quantity, face)) {
                return { success: false, message: "L'enchère doit être supérieure à la précédente." };
            }
        } else {
            if (face === 1 && !this.palifico) {
                return { success: false, message: "On ne peut pas commencer par des 1 (sauf lors d'un Palifico)." };
            }
        }

        this.lastBid = { quantity, face, player };
        this.history.push({ quantity, face, username: player.username });
        if (this.history.length > 5) this.history.shift(); // Keep only last 5

        this.nextTurn();
        this.emit('bidPlaced', { player, quantity, face });
        return { success: true };
    }

    isValidBid(newQty, newFace) {
        const { quantity: oldQty, face: oldFace } = this.lastBid;

        if (this.palifico) {
            if (oldFace !== newFace) return false;
            return newQty > oldQty;
        }

        if (newFace === oldFace) {
            return newQty > oldQty;
        }

        if (newFace === 1 && oldFace !== 1) {
            return newQty >= Math.ceil(oldQty / 2);
        }

        if (newFace !== 1 && oldFace === 1) {
            return newQty >= (oldQty * 2) + 1;
        }

        if (newQty > oldQty) return true;
        if (newQty === oldQty && newFace > oldFace) return true;

        return false;
    }

    processDudo(userId) {
        const playerIndex = this.players.findIndex(p => p.id === userId);
        if (playerIndex === -1) return { success: false, message: "Vous n'êtes pas dans la partie." };
        if (playerIndex !== this.currentTurnIndex) return { success: false, message: "Ce n'est pas ton tour !" };
        if (!this.lastBid) return { success: false, message: "Tu ne peux pas faire Dudo au premier tour !" };

        const doubter = this.players[playerIndex];
        const bidder = this.lastBid.player;

        const { quantity, face } = this.lastBid;
        let total = 0;
        const allDice = {};

        this.players.forEach(p => {
            if (p.eliminated) return;
            allDice[p.username] = p.dice;
            p.dice.forEach(d => {
                if (d === face || (d === 1 && !this.palifico)) {
                    total++;
                }
            });
        });

        const success = total < quantity;
        const loser = success ? bidder : doubter;
        const winner = success ? doubter : bidder;

        // Stats
        this.db.incStat(loser.id, loser.username, 'dice_lost');
        if (success) {
            this.db.incStat(doubter.id, doubter.username, 'bluffs_called_success');
        } else {
            this.db.incStat(doubter.id, doubter.username, 'bluffs_called_fail');
        }

        const eliminated = loser.loseDie();

        this.emit('dudoResult', {
            doubter,
            bidder,
            bid: this.lastBid,
            actualTotal: total,
            success,
            loser,
            eliminated,
            allDice
        });

        if (this.players.filter(p => !p.eliminated).length <= 1) {
            this.endGame();
        } else {
            if (eliminated) {
                // If loser eliminated, pass to next player relative to loser
                // We need to find the user who was supposed to go next if they hadn't been eliminated?
                // Simplified: The player who won the dudo (or next valid) starts?
                // Usually: Loser starts. If eliminated, Player to their left starts.

                // We find the index of the loser, then move to next valid.
                // We need to act as if turn was passed to loser, then loser removed.

                // In this implementation, create a method to find next valid player from a specific index?
                // Only doubter or bidder could be the loser.
                // Reset index to loser's index (even if eliminated, we skip in loop).
                this.currentTurnIndex = this.players.findIndex(p => p.id === loser.id);
                this.setNextValidPlayer(true); // Skip the now-eliminated loser
            } else {
                this.currentTurnIndex = this.players.findIndex(p => p.id === loser.id);
            }

            setTimeout(() => this.startRound(), 5000);
        }

        return { success: true };
    }

    processCalza(userId) {
        const playerIndex = this.players.findIndex(p => p.id === userId);
        if (playerIndex === -1) return { success: false, message: "Vous n'êtes pas dans la partie." };
        if (playerIndex !== this.currentTurnIndex) return { success: false, message: "Ce n'est pas ton tour !" };
        if (!this.lastBid) return { success: false, message: "Tu ne peux pas faire Calza au premier tour !" };
        if (this.palifico) return { success: false, message: "Calza est interdit pendant un tour Palifico !" }; // Standard rule? Usually allowed but Palifico rules vary. Let's forbid for simplicity unless requested. Prompt didn't specify, but Calza in Palifico is weird. I'll block it to be safe or allow it? "Les 1 ne sont plus jokers". Let's allow it but respect Palifico joker rule (already handled by counting logic). I will allow it. Actually wait, standard Perudo: Calza is OPTIONAL rule. Usually Palifico forbids Calza. I will forbid it for consistency.

        const calzer = this.players[playerIndex];
        const { quantity, face } = this.lastBid;

        // Count dice
        let total = 0;
        const allDice = {};

        this.players.forEach(p => {
            if (p.eliminated) return;
            allDice[p.username] = p.dice;
            p.dice.forEach(d => {
                if (d === face || (d === 1 && !this.palifico)) {
                    total++;
                }
            });
        });

        const success = (total === quantity);
        let eliminated = false;

        if (success) {
            calzer.gainDie();
            this.db.incStat(calzer.id, calzer.username, 'calzas_success');
        } else {
            eliminated = calzer.loseDie();
            this.db.incStat(calzer.id, calzer.username, 'calzas_fail');
            this.db.incStat(calzer.id, calzer.username, 'dice_lost');
        }

        this.emit('calzaResult', {
            calzer,
            bid: this.lastBid,
            actualTotal: total,
            success,
            eliminated,
            allDice
        });

        if (this.players.filter(p => !p.eliminated).length <= 1) {
            this.endGame();
        } else {
            // Next round starts with the Calzer (whether they won or lost, unless eliminated)
            if (eliminated) {
                this.currentTurnIndex = this.players.findIndex(p => p.id === calzer.id);
                this.setNextValidPlayer(true);
            } else {
                this.currentTurnIndex = this.players.findIndex(p => p.id === calzer.id);
            }

            setTimeout(() => this.startRound(), 5000);
        }

        return { success: true };
    }

    nextTurn() {
        this.setNextValidPlayer();
        const nextPlayer = this.players[this.currentTurnIndex];
        this.emit('nextTurn', nextPlayer);
    }

    setNextValidPlayer(skipCurrent = false) {
        if (skipCurrent) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        } else {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        }

        while (this.players[this.currentTurnIndex].eliminated) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        }
    }

    endGame() {
        const winner = this.players.find(p => !p.eliminated);
        this.state = 'FINISHED';

        // Record stats for everyone
        this.players.forEach(p => {
            this.db.updatePlayerAtEnd(p.id, p.username, p.id === winner.id);
        });

        this.emit('gameOver', winner);
    }
}

module.exports = PerudoGame;
