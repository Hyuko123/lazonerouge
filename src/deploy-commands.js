require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./commands');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Configure DISCORD_TOKEN et CLIENT_ID dans .env');
  process.exit(1);
}
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`Commandes déployées (${commands.length}).`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
