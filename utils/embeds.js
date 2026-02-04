const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Creates a standard embed with the bot's styling
 * @param {string} title - The title of the embed
 * @param {string} description - The main content
 * @param {string} color - Hex color code (default: primary)
 * @returns {EmbedBuilder}
 */
function createEmbed(title, description, color = config.colors.primary) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: 'PerudoBot • Liar\'s Dice', iconURL: 'https://cdn-icons-png.flaticon.com/512/566/566294.png' }) // Generic dice icon or bot avatar
        .setTimestamp();
}

/**
 * Creates an error embed
 * @param {string} message - Error message
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message) {
    return createEmbed('Erreur', `❌ ${message}`, config.colors.danger);
}

/**
 * Creates a game status embed
 * @param {string} gameInfo - Info about the round/turn
 * @param {string} boardState - The state of the board (last bid, etc)
 * @returns {EmbedBuilder}
 */
function createGameEmbed(round, playerCount, content, color = config.colors.info) {
    return createEmbed(`🎲 Manche ${round} — ${playerCount} Joueurs`, content, color);
}

module.exports = {
    createEmbed,
    createErrorEmbed,
    createGameEmbed
};
