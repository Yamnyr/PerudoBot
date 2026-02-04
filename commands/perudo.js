const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const GameManager = require('../game/GameManager');
const config = require('../config');
const { createEmbed, createErrorEmbed, createGameEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perudo')
        .setDescription('Jouer au Perudo')
        .addSubcommand(sub => sub.setName('create').setDescription('Créer une nouvelle partie'))
        .addSubcommand(sub => sub.setName('join').setDescription('Rejoindre la partie en cours'))
        .addSubcommand(sub => sub.setName('start').setDescription('Lancer la partie'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Arrêter la partie'))
        .addSubcommand(sub => sub.setName('mise').setDescription('Placer une enchère (via commande)').addIntegerOption(o => o.setName('q').setDescription('Quantité').setRequired(true)).addIntegerOption(o => o.setName('v').setDescription('Valeur').setRequired(true)))
        .addSubcommand(sub => sub.setName('dudo').setDescription('Douter (via commande)'))
        .addSubcommand(sub => sub.setName('calza').setDescription('Annoncer Tout Pile (Calza)'))
        .addSubcommand(sub => sub.setName('stats').setDescription('Voir vos statistiques'))
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Voir le classement des meilleurs joueurs')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channelId = interaction.channelId;

        // --- CREATE ---
        if (subcommand === 'create') {
            if (GameManager.getGame(channelId)) return interaction.reply({ embeds: [createErrorEmbed("Partie déjà en cours ici.")], ephemeral: true });

            const game = GameManager.createGame(channelId, interaction.user);
            setupGameListeners(game, interaction.channel);

            const embed = createEmbed('🎲 Nouvelle Partie de Perudo', `Créée par **${interaction.user.username}**.\nRejoignez avec \`/perudo join\` !`, config.colors.success);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_join').setLabel('Rejoindre').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_start').setLabel('Lancer').setStyle(ButtonStyle.Secondary)
            );
            const initialReply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
            game.lobbyMessage = initialReply;
            return;
        }

        const game = GameManager.getGame(channelId);
        if (!game) return interaction.reply({ embeds: [createErrorEmbed("Aucune partie. `/perudo create` ?")], ephemeral: true });

        // --- JOIN ---
        if (subcommand === 'join') {
            if (game.addPlayer(interaction.user)) {
                return interaction.reply({ embeds: [createEmbed('Joueur rejoint', `**${interaction.user.username}** fait partie du jeu !`, config.colors.success)] });
            }
            return interaction.reply({ embeds: [createErrorEmbed("Impossible de rejoindre (Partie pleine ou déjà fait).")], ephemeral: true });
        }

        // --- START ---
        if (subcommand === 'start') {
            try { game.start(); interaction.reply({ content: 'La partie commence !', ephemeral: true }); }
            catch (e) { interaction.reply({ embeds: [createErrorEmbed(e.message)], ephemeral: true }); }
            return;
        }

        // --- STOP ---
        if (subcommand === 'stop') {
            GameManager.deleteGame(channelId);
            return interaction.reply({ embeds: [createEmbed('Fin de partie', 'La partie a été annulée.', config.colors.danger)] });
        }

        // --- COMMAND FALLBACKS ---
        if (subcommand === 'mise') {
            const q = interaction.options.getInteger('q');
            const v = interaction.options.getInteger('v');
            const res = game.processBid(interaction.user.id, q, v);
            if (!res.success) return interaction.reply({ embeds: [createErrorEmbed(res.message)], ephemeral: true });
            return interaction.reply({ content: '👌', ephemeral: true });
        }

        if (subcommand === 'dudo') {
            const res = game.processDudo(interaction.user.id);
            if (!res.success) return interaction.reply({ embeds: [createErrorEmbed(res.message)], ephemeral: true });
            return interaction.reply({ content: '❗', ephemeral: true });
        }

        // --- STATS ---
        if (subcommand === 'stats') {
            const db = require('../utils/db');
            const data = db.getPlayer(interaction.user.id);
            if (!data) return interaction.reply({ content: "Tu n'as pas encore de statistiques ! Joue une partie pour commencer.", ephemeral: true });

            const embed = createEmbed(`📊 Stats de ${interaction.user.username}`, `
**🏆 Victoires :** ${data.wins}
**🎮 Parties :** ${data.games_played}
**🎲 Dés perdus :** ${data.dice_lost}

**🎭 Bluff :**
• Réussis : ${data.bluffs_called_success}
• Ratés : ${data.bluffs_called_fail}

**⚖️ Calzas :**
• Réussis : ${data.calzas_success}
• Ratés : ${data.calzas_fail}
            `, config.colors.info);
            embed.setThumbnail(interaction.user.displayAvatarURL());
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- LEADERBOARD ---
        if (subcommand === 'leaderboard') {
            const db = require('../utils/db');
            const top = db.getLeaderboard();
            if (top.length === 0) return interaction.reply({ content: "Le classement est vide pour le moment !", ephemeral: true });

            let list = top.map((p, i) => `**${i + 1}. ${p.username}** — ${p.wins} victoires (${p.games_played} prts)`).join('\n');
            const embed = createEmbed('🏆 Classement Perudo', list, config.colors.warning);
            return interaction.reply({ embeds: [embed] });
        }
    },

    // --- BUTTONS ---
    async handleButtons(interaction) {
        const game = GameManager.getGame(interaction.channelId);
        if (!game) return interaction.reply({ content: 'Partie terminée ou inexistante.', ephemeral: true });

        const action = interaction.customId;

        // JOIN/START (Lobby)
        if (action === 'btn_join') {
            if (game.state !== 'LOBBY') return interaction.reply({ content: 'Trop tard !', ephemeral: true });
            if (game.addPlayer(interaction.user)) {
                await interaction.reply({ content: `✅ Tu as rejoint la partie ! (${game.players.length} joueurs)`, ephemeral: true });
            } else {
                await interaction.reply({ content: 'Déjà rejoint ou complet.', ephemeral: true });
            }
        }
        else if (action === 'btn_start') {
            try {
                game.start();
                await interaction.deferUpdate();
            } catch (e) {
                await interaction.reply({ content: e.message, ephemeral: true });
            }
        }

        // VIEW DICE (Universal)
        else if (action === 'btn_view_dice') {
            try {
                const dice = game.getPlayerDice(interaction.user.id);
                if (!dice) return interaction.reply({ content: 'Tu ne joues pas ou tu es éliminé.', ephemeral: true });

                const diceStr = dice.map(d => config.emojis.dice[d]).join(' ');
                const embed = createEmbed(
                    `🎲 Tes dés — Manche ${game.round}`,
                    `${diceStr}\n\n🔒 Visible uniquement par toi\n😏 Bluffe intelligemment`,
                    config.colors.secret // Premium Purple
                );
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (e) {
                console.error('View Dice Error:', e);
                if (!interaction.replied) await interaction.reply({ content: "❌ Erreur API.", ephemeral: true });
            }
        }

        // DUDO
        else if (action === 'btn_dudo') {
            const res = game.processDudo(interaction.user.id);
            if (!res.success) return interaction.reply({ content: res.message, ephemeral: true });
            await interaction.deferUpdate();
        }

        // CALZA
        else if (action === 'btn_calza') {
            const res = game.processCalza(interaction.user.id);
            if (!res.success) return interaction.reply({ content: res.message, ephemeral: true });
            await interaction.deferUpdate();
        }

        // BID (Open Modal)
        else if (action === 'btn_bid') {
            const modal = new ModalBuilder().setCustomId('modal_bid').setTitle('Faire une annonce');
            const row1 = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bid_qty').setLabel("Quantité").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 3").setRequired(true));
            const row2 = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bid_face').setLabel("Valeur (1-6)").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 5").setRequired(true));
            modal.addComponents(row1, row2);
            await interaction.showModal(modal);
        }
    },

    // --- MODAL ---
    async handleModal(interaction) {
        if (interaction.customId !== 'modal_bid') return;
        const game = GameManager.getGame(interaction.channelId);
        if (!game) return interaction.reply({ content: 'Partie terminée.', ephemeral: true });

        const q = parseInt(interaction.fields.getTextInputValue('bid_qty'));
        const v = parseInt(interaction.fields.getTextInputValue('bid_face'));

        if (isNaN(q) || isNaN(v)) return interaction.reply({ content: 'Nombres invalides.', ephemeral: true });

        const res = game.processBid(interaction.user.id, q, v);
        if (!res.success) return interaction.reply({ content: res.message, ephemeral: true });

        await interaction.deferUpdate();
    }
};

// --- EVENTS & UI HELPER ---
function setupGameListeners(game, channel) {

    // --- HELPERS ---
    const sendTurnControls = async () => {
        const currentPlayer = game.players[game.currentTurnIndex];

        let historyText = game.history.length > 0
            ? `\n**📜 Historique :**\n${game.history.map(h => `• ${h.username} : ${h.quantity}x ${config.emojis.dice[h.face]}`).join('\n')}`
            : '';

        let desc = `C'est au tour de **${currentPlayer.user}** !${historyText}`;
        if (game.lastBid) {
            desc = `📢 **Dernière annonce :** **${game.lastBid.quantity}x** ${config.emojis.dice[game.lastBid.face]} par ${game.lastBid.player.username}\n` + desc;
        }

        const embed = createGameEmbed(game.round, game.players.filter(p => !p.eliminated).length, desc);
        embed.setThumbnail(currentPlayer.user.displayAvatarURL());

        const rowActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_bid').setLabel('Miser').setStyle(ButtonStyle.Primary).setEmoji(config.emojis.actions.bid),
            new ButtonBuilder().setCustomId('btn_dudo').setLabel('Dudo').setStyle(ButtonStyle.Danger).setEmoji(config.emojis.actions.dudo).setDisabled(!game.lastBid),
            new ButtonBuilder().setCustomId('btn_calza').setLabel('Calza').setStyle(ButtonStyle.Success).setEmoji(config.emojis.actions.calza).setDisabled(!game.lastBid)
        );

        const rowView = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_view_dice').setLabel('Voir mes dés').setStyle(ButtonStyle.Secondary).setEmoji(config.emojis.actions.view)
        );

        await channel.send({ embeds: [embed], components: [rowActions, rowView] });
    };

    // --- HANDLERS ---

    game.on('roundStart', async ({ round, palifico, currentPlayer }) => {
        const title = `🎲 Manche ${round} COMMENCE !`;
        const desc = `${palifico ? '🍬 **MODE PALIFICO**\n' : ''}Tout le monde a ses dés.\n\nC'est à **${currentPlayer.user}** de commencer.`;

        const embed = createEmbed(title, desc, config.colors.warning);
        await channel.send({ embeds: [embed] });
        await sendTurnControls();
    });

    game.on('bidPlaced', () => {
        sendTurnControls();
    });

    game.on('nextTurn', () => { });

    game.on('dudoResult', ({ doubter, bidder, bid, actualTotal, success, loser, eliminated, allDice }) => {
        let revealStr = '';
        for (const [name, dice] of Object.entries(allDice)) {
            revealStr += `**${name}** : ${dice.map(d => config.emojis.dice[d]).join(' ')}\n`;
        }

        const title = success ? `✅ Dudo RÉUSSI par ${doubter.username} !` : `❌ Dudo RATÉ par ${doubter.username} !`;
        const info = success ? `Il n'y avait que **${actualTotal}** dés (Mise: ${bid.quantity})` : `Il y avait **${actualTotal}** dés (Mise: ${bid.quantity})`;

        const embed = createEmbed(
            title,
            `${info}\n\n${revealStr}\n💥 **${loser.username}** perd un dé ! ${eliminated ? '💀 **ÉLIMINÉ**' : ''}`,
            success ? config.colors.success : config.colors.danger
        );

        channel.send({ embeds: [embed] });
    });

    game.on('calzaResult', ({ calzer, bid, actualTotal, success, eliminated, allDice }) => {
        let revealStr = '';
        for (const [name, dice] of Object.entries(allDice)) {
            revealStr += `**${name}** : ${dice.map(d => config.emojis.dice[d]).join(' ')}\n`;
        }

        const title = success ? `⚖️ Calza RÉUSSI par ${calzer.username} !` : `❌ Calza RATÉ par ${calzer.username} !`;
        const info = success ? `Il y avait pile **${actualTotal}** dés ! (Mise: ${bid.quantity})` : `Il y avait **${actualTotal}** dés (Mise: ${bid.quantity})`;
        const bonus = success ? `\n🎉 **${calzer.username}** gagne un dé !` : `\n💥 **${calzer.username}** perd un dé ! ${eliminated ? '💀 **ÉLIMINÉ**' : ''}`;

        const embed = createEmbed(
            title,
            `${info}\n\n${revealStr}${bonus}`,
            success ? config.colors.success : config.colors.danger
        );

        channel.send({ embeds: [embed] });
    });

    game.on('gameOver', (winner) => {
        const embed = createEmbed('🏆 VICTOIRE !', `**${winner.username}** remporte la partie !`, config.colors.warning);
        channel.send({ embeds: [embed] });
        GameManager.deleteGame(game.channelId);
    });

    game.on('playerJoined', async (player) => {
        if (!game.lobbyMessage) return;

        const playerList = game.players.map(p => `• ${p.user.username}`).join('\n');
        const count = game.players.length;
        const max = config.game.maxPlayers;

        const embed = createEmbed(
            '🎲 Nouvelle Partie de Perudo',
            `Créée par l'Hôte.\n\n**Joueurs (${count}/${max}) :**\n${playerList}\n\nRejoignez avec \`/perudo join\` ou le bouton !`,
            config.colors.success
        );

        // Keep components same
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_join').setLabel('Rejoindre').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_start').setLabel('Lancer').setStyle(ButtonStyle.Secondary)
        );

        try {
            await game.lobbyMessage.edit({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("Failed to edit lobby message", e);
        }
    });
}
