module.exports = {
    colors: {
        primary: '#2B2D31', // Discord dark background (Neutral)
        success: '#57F287', // Green
        danger: '#ED4245', // Red
        warning: '#FEE75C', // Yellow
        info: '#5865F2',    // Blurple
        palifico: '#EB459E', // Magenta
        secret: '#9B59B6'   // Amethyst for secret dice reveal
    },
    emojis: {
        dice: {
            1: '1️⃣',
            2: '2️⃣',
            3: '3️⃣',
            4: '4️⃣',
            5: '5️⃣',
            6: '6️⃣',
            hidden: '🎲'
        },
        actions: {
            bid: '🔼',
            dudo: '❗',
            calza: '⚖️',
            view: '👀'
        }
    },
    game: {
        maxDice: 5,
        minPlayers: 2,
        maxPlayers: 10,
        dmTimeout: 60000 * 5
    }
};
