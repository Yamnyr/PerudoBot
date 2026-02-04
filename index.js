require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load commands
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Une erreur est survenue lors de l\'exécution de cette commande !', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de cette commande !', ephemeral: true });
            }
        }
        return;
    }

    // 2. Buttons
    if (interaction.isButton()) {
        const perudoCommand = client.commands.get('perudo');
        if (perudoCommand && perudoCommand.handleButtons) {
            await perudoCommand.handleButtons(interaction);
        }
        return;
    }

    // 3. Modals
    if (interaction.isModalSubmit()) {
        const perudoCommand = client.commands.get('perudo');
        if (perudoCommand && perudoCommand.handleModal) {
            await perudoCommand.handleModal(interaction);
        }
        return;
    }
});

if (!process.env.DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN is missing in .env');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
