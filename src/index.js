require('dotenv').config();
const fs = require('node:fs');
const { Client, GatewayIntentBits, Events, EmbedBuilder, Partials } = require('discord.js');
const { configureHandlers, handleCommand, handleButton, handleSelect, handleModal, handleReaction, finishGiveaway, processExpiredBans, onboardingRow } = require('./handlers');
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
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildInvites],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});
const inviteSnapshots = new Map();
const inviteJoinQueues = new Map();

async function cacheGuildInvites(guild) {
  const invites = await guild.invites.fetch();
  inviteSnapshots.set(guild.id, new Map([...invites.values()].map(invite => [invite.code, invite.uses || 0])));
}

async function logMemberInvite(member) {
  const guild = member.guild;
  const previous = inviteSnapshots.get(guild.id);
  let usedInvite = null;
  const invites = await guild.invites.fetch().catch(error => {
    console.warn(`Impossible de lire les invitations de ${guild.name}. Vérifie la permission Gérer le serveur.`, error.message);
    return null;
  });
  if (invites) {
    if (previous) {
      const changed = [...invites.values()].filter(invite =>
        previous.has(invite.code) && (invite.uses || 0) === previous.get(invite.code) + 1
      );
      if (changed.length === 1) usedInvite = changed[0];
    }
    inviteSnapshots.set(guild.id, new Map([...invites.values()].map(invite => [invite.code, invite.uses || 0])));
  }

  const inviter = usedInvite?.inviter || null;
  const recorded = store.recordInviteJoin.run(guild.id, member.id, inviter?.id || null, usedInvite?.code || null, Date.now());
  if (!recorded.changes) return;

  const channelId = cfg.inviteLogChannelId || cfg.welcomeChannelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel?.isTextBased()) return;

  const totalInvites = inviter ? store.countInvitedMembers.get(guild.id, inviter.id).total : null;
  const createdAt = Math.floor(member.user.createdTimestamp / 1000);
  const inviteLink = usedInvite ? (usedInvite.url || `https://discord.gg/${usedInvite.code}`) : 'Lien non identifié';
  const inviteDetails = usedInvite
    ? `${usedInvite.uses || 0} utilisation(s) · ${usedInvite.maxUses ? `limité à ${usedInvite.maxUses}` : 'sans limite'}${usedInvite.temporary ? ' · invitation temporaire' : ''}`
    : 'Le lien n’a pas pu être identifié avec certitude.';
  const embed = new EmbedBuilder().setColor(0x35A675).setTitle('📨 Nouvelle arrivée — suivi des invitations')
    .setDescription(`${member} a rejoint **${guild.name}**.`)
    .addFields(
      { name: 'Nouveau membre', value: `${member.user.tag} (${member.id})` },
      { name: 'Invité par', value: inviter ? `${inviter} (${inviter.tag})` : 'Invitateur indéterminé', inline: true },
      { name: 'Invitations confirmées', value: totalInvites === null ? 'Non disponible' : `${totalInvites}`, inline: true },
      { name: 'Lien utilisé', value: inviteLink, inline: false },
      { name: 'Détails du lien', value: inviteDetails, inline: true },
      { name: 'Compte Discord créé', value: `<t:${createdAt}:F> (<t:${createdAt}:R>)`, inline: true },
      { name: 'Arrivée sur le serveur', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setFooter({ text: 'Les invitations sont identifiées à partir de leurs compteurs Discord.' }).setTimestamp();
  const allowedUsers = [member.id, inviter?.id].filter(Boolean);
  await channel.send({ embeds: [embed], allowedMentions: { users: allowedUsers } });
}

function queueInviteLog(member) {
  const guildId = member.guild.id;
  const previous = inviteJoinQueues.get(guildId) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => logMemberInvite(member));
  inviteJoinQueues.set(guildId, current);
  return current.finally(() => {
    if (inviteJoinQueues.get(guildId) === current) inviteJoinQueues.delete(guildId);
  });
}

client.once(Events.ClientReady, async c => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  for (const guild of c.guilds.cache.values()) {
    await cacheGuildInvites(guild).catch(error => {
      console.warn(`Impossible d’initialiser les invitations de ${guild.name}. Le bot doit avoir Gérer le serveur.`, error.message);
    });
  }
  // Traite les giveaways arrivés à échéance pendant l'arrêt du bot.
  for (const g of store.activeGiveaways.all()) {
    if (g.ends_at <= Date.now()) await finishGiveaway(client, g.message_id).catch(console.error);
  }
  await processExpiredBans(client);
  setInterval(async () => {
    for (const g of store.activeGiveaways.all()) {
      if (g.ends_at <= Date.now()) await finishGiveaway(client, g.message_id).catch(console.error);
    }
  }, 15000);
  setInterval(() => processExpiredBans(client).catch(console.error), 60000);
});

client.on(Events.InviteCreate, invite => {
  const guildId = invite.guild?.id || invite.guildId;
  const snapshot = inviteSnapshots.get(guildId);
  if (snapshot) snapshot.set(invite.code, invite.uses || 0);
});
client.on(Events.InviteDelete, invite => {
  const guildId = invite.guild?.id || invite.guildId;
  inviteSnapshots.get(guildId)?.delete(invite.code);
});

client.on(Events.GuildMemberAdd, async member => {
  await queueInviteLog(member).catch(console.error);
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

client.on(Events.MessageReactionAdd, (reaction, user) => {
  handleReaction(reaction, user, true).catch(console.error);
});
client.on(Events.MessageReactionRemove, (reaction, user) => {
  handleReaction(reaction, user, false).catch(console.error);
});

client.login(process.env.DISCORD_TOKEN);
