require('dotenv').config();
const fs = require('node:fs');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const { configureHandlers, handleCommand, handleButton, handleSelect, handleModal, finishGiveaway, onboardingRow } = require('./handlers');
const store = require('./database');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}
let cfg;
try {
  // Sur une plateforme cloud, CONFIG_JSON peut contenir le JSON complet.
  // En local, le bot lit config.json.
  cfg = process.env.CONFIG_JSON ? JSON.parse(process.env.CONFIG_JSON) : require('../config.json');
} catch (error) {
  console.error('Configuration invalide. Vérifie config.json ou la variable CONFIG_JSON.', error.message);
  process.exit(1);
}
configureHandlers(cfg);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] });

client.once(Events.ClientReady, async c => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  // Traite les giveaways arrivés à échéance pendant l'arrêt du bot.
  for (const g of store.activeGiveaways.all()) {
    if (g.ends_at <= Date.now()) await finishGiveaway(client, g.message_id).catch(console.error);
  }
  setInterval(async () => {
    for (const g of store.activeGiveaways.all()) {
      if (g.ends_at <= Date.now()) await finishGiveaway(client, g.message_id).catch(console.error);
    }
  }, 15000);
});

client.on(Events.GuildMemberAdd, async member => {
  if (cfg.pendingRoleId) {
    const pendingRole = await member.guild.roles.fetch(cfg.pendingRoleId).catch(() => null);
    if (pendingRole) await member.roles.add(pendingRole).catch(console.error);
  }
  if (cfg.welcomeRoleId && !cfg.onboardingChannelId) {
    const role = await member.guild.roles.fetch(cfg.welcomeRoleId).catch(() => null);
    if (role) await member.roles.add(role).catch(console.error);
  }
  const channelId = cfg.onboardingChannelId || cfg.welcomeChannelId;
  const channel = channelId ? await member.guild.channels.fetch(channelId).catch(() => null) : null;
  if (channel?.isTextBased()) {
    if (cfg.onboardingChannelId) {
      const rules = (cfg.rules || []).map((rule, index) => `**${index + 1}.** ${rule}`).join('\n\n').slice(0, 3500);
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Bienvenue sur ${member.guild.name}`)
        .setDescription([
          `Bienvenue ${member} ! Avant d’accéder au serveur, enregistre ton Riot ID puis confirme avoir lu le règlement.`,
          '', '**Règlement**', rules || 'Respecte les membres et les décisions du staff.',
          '', '**Étape 1 :** enregistre ton Riot ID au format `Pseudo#TAG`.',
          '**Étape 2 :** accepte le règlement pour recevoir le rôle membre.'
        ].join('\n')).setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'Ton Riot ID est enregistré par ce serveur et peut être modifié plus tard avec /riot-id.' });
      channel.send({ content: `${member}`, embeds: [embed], components: [onboardingRow(member.id)] }).catch(console.error);
      return;
    }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('Bienvenue !').setDescription(`Bienvenue ${member} sur **${member.guild.name}** !`).setThumbnail(member.user.displayAvatarURL({size:256})).setFooter({text:`Membre #${member.guild.memberCount}`});
    channel.send({embeds:[embed]}).catch(console.error);
  }
});

client.on(Events.InteractionCreate, async i => {
  try {
    if (i.isChatInputCommand()) await handleCommand(i, client);
    else if (i.isButton()) await handleButton(i, client);
    else if (i.isStringSelectMenu()) await handleSelect(i, client);
    else if (i.isModalSubmit()) await handleModal(i);
  } catch (error) {
    console.error(error);
    const message = 'Une erreur est survenue. Vérifie la configuration et les permissions du bot.';
    if (i.deferred || i.replied) await i.followUp({content:message,ephemeral:true}).catch(()=>{});
    else await i.reply({content:message,ephemeral:true}).catch(()=>{});
  }
});

client.login(process.env.DISCORD_TOKEN);
