class Player {
    constructor(user) {
        this.user = user;
        this.id = user.id;
        this.username = user.username;
        this.dice = []; // Array of numbers
        this.diceCount = 5;
        this.eliminated = false;
    }

    /**
     * Rolls the dice for this player
     */
    rollDice() {
        if (this.eliminated) {
            this.dice = [];
            return;
        }
        this.dice = [];
        for (let i = 0; i < this.diceCount; i++) {
            this.dice.push(Math.floor(Math.random() * 6) + 1);
        }
        // Sort for easier reading
        this.dice.sort((a, b) => a - b);
    }

    /**
     * Removes a die from the player
     * @returns {boolean} true if eliminated
     */
    loseDie() {
        if (this.diceCount > 0) {
            this.diceCount--;
        }
        if (this.diceCount === 0) {
            this.eliminated = true;
        }
        return this.eliminated;
    }

    /**
     * Adds a die to the player (max 5)
     */
    gainDie() {
        if (this.diceCount < 5) {
            this.diceCount++;
        }
    }

    /**
     * Get string representation of dice (for DM)
     */
    getDiceString(emojis) {
        return this.dice.map(d => emojis[d]).join(' ');
    }
}

module.exports = Player;
