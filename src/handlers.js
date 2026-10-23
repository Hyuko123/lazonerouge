const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ChannelType, PermissionFlagsBits, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const store = require('./database');

const tempVoiceChannels = new Map();

const COLOR = 0x5865F2;
let cfg = {};
function configureHandlers(config) {
  cfg = config;
}
const staffAllowed = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  Boolean(cfg.ticketStaffRoleId && interaction.member?.roles?.cache?.has(cfg.ticketStaffRoleId));
const announcementStaffAllowed = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  Boolean(cfg.announcementStaffRoleId && interaction.member?.roles?.cache?.has(cfg.announcementStaffRoleId));

const ticketTypes = {
  support: { label: 'Aide et support', emoji: '🛠️' },
  report: { label: 'Signaler un problème', emoji: '🚩' },
  partnership: { label: 'Partenariat', emoji: '🤝' },
  other: { label: 'Autre demande', emoji: '💬' }
};
const rolePanelCategories = {
  rang: {
    title: '🏆 Rôles de rang',
    description: 'Choisis ton rang Valorant actuel. Clique sur sa réaction pour recevoir le rôle ; retire ta réaction si tu veux l’enlever ou changer de rang.'
  },
  profil: {
    title: '👤 Sexe et âge',
    description: 'Choisis les rôles de profil et de tranche d’âge que tu souhaites afficher. Clique sur une réaction pour ajouter le rôle et retire-la pour le supprimer. Ces choix sont facultatifs.'
  },
  notifications: {
    title: '🔔 Notifications',
    description: 'Choisis les sujets pour lesquels tu souhaites recevoir des notifications. Ajoute une réaction pour t’abonner, retire-la pour te désabonner. Tu peux choisir plusieurs notifications.'
  }
};

async function log(guild, message) {
  if (!cfg.logChannelId) return;
  const channel = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
  if (channel?.isTextBased()) channel.send({ content: message, allowedMentions: { parse: [] } }).catch(() => {});
}
async function sendAnnouncement(guild, author, title, content, fallbackChannel, pingEveryone = false) {
  const channel = cfg.announcementChannelId
    ? await guild.channels.fetch(cfg.announcementChannelId).catch(() => null)
    : fallbackChannel;
  if (!channel?.isTextBased()) return null;

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ 
      name: '✨ Annonce Officielle',
      iconURL: guild.iconURL({ size: 256 }) 
    })
    .setTitle(title)
    .setDescription(content)
    .setThumbnail(guild.iconURL({ size: 512 }))
    .setImage(guild.bannerURL({ size: 1024 }) || null)
    .addFields(
      { name: '👤 Auteur', value: `${author}`, inline: true },
      { name: '🏠 Serveur', value: guild.name, inline: true },
      { name: '📅 Date', value: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), inline: true }
    )
    .setFooter({ 
      text: `Publié le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      iconURL: author.displayAvatarURL({ size: 128 }) 
    })
    .setTimestamp();

  const message = await channel.send({ 
    content: pingEveryone ? '@everyone' : null,
    embeds: [embed], 
    allowedMentions: pingEveryone ? { parse: ['everyone'] } : { parse: [] } 
  });
  await log(guild, `📣 Annonce publiée par ${author.tag} dans ${channel}.`);
  return message;
}
function announcementPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('announcement:create').setLabel('📝 Rédiger une annonce').setStyle(ButtonStyle.Primary).setEmoji('✍️'),
    new ButtonBuilder().setCustomId('announcement:help').setLabel('❓ Aide').setStyle(ButtonStyle.Secondary).setEmoji('📚')
  );
}
function onboardingRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`welcome:riot:${userId}`).setLabel('Enregistrer mon Riot ID').setStyle(ButtonStyle.Secondary).setEmoji('🎮'),
    new ButtonBuilder().setCustomId(`welcome:accept:${userId}`).setLabel('Accepter le règlement').setStyle(ButtonStyle.Success).setEmoji('✅')
  );
}
function isValidRiotId(riotId) {
  return /^.{1,32}#[^#\s]{1,16}$/u.test(riotId);
}
function parseBanDuration(input) {
  const value = input.trim().toLowerCase();
  if (['permanent', 'permanente', 'perm', 'illimite', 'illimité'].includes(value)) {
    return { expiresAt: null, label: 'Permanent' };
  }
  const match = value.match(/^(\d{1,5})\s*(m|min|mins|minute|minutes|h|hr|heure|heures|d|j|jour|jours|w|sem|semaine|semaines)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const isMinute = ['m', 'min', 'mins', 'minute', 'minutes'].includes(unit);
  const isHour = ['h', 'hr', 'heure', 'heures'].includes(unit);
  const isWeek = ['w', 'sem', 'semaine', 'semaines'].includes(unit);
  const factor = isMinute ? 60000 : isHour ? 3600000 : isWeek ? 604800000 : 86400000;
  const unitLabel = isMinute ? 'minute' : isHour ? 'heure' : isWeek ? 'semaine' : 'jour';
  const milliseconds = amount * factor;
  if (!amount || milliseconds > 3650 * 86400000) return null;
  return {
    expiresAt: Date.now() + milliseconds,
    label: `${amount} ${unitLabel}${amount > 1 ? 's' : ''}`
  };
}
function giveawayDuration(amount, unit) {
  const units = {
    minutes: { milliseconds: 60000, maximum: 10080, label: 'minute' },
    heures: { milliseconds: 3600000, maximum: 168, label: 'heure' },
    jours: { milliseconds: 86400000, maximum: 365, label: 'jour' },
    semaines: { milliseconds: 604800000, maximum: 52, label: 'semaine' }
  };
  const details = units[unit];
  if (!details || !Number.isInteger(amount) || amount < 1 || amount > details.maximum) return null;
  return { milliseconds: amount * details.milliseconds, label: `${amount} ${details.label}${amount > 1 ? 's' : ''}` };
}
function banNotificationEmbed(guild, target, reason, duration, moderator) {
  const endDate = duration.expiresAt
    ? `<t:${Math.floor(duration.expiresAt / 1000)}:F> (<t:${Math.floor(duration.expiresAt / 1000)}:R>)`
    : 'Aucune date de fin définie.';
  const durationInfo = duration.expiresAt
    ? `La mesure prendra fin automatiquement à l’échéance indiquée ci-dessous. Un nouveau lien d’invitation pourra être nécessaire pour rejoindre le serveur.`
    : 'Le bannissement est permanent et restera actif jusqu’à une éventuelle révision par l’équipe de modération.';
  return new EmbedBuilder().setColor(0xB42318).setTitle(`Notification de bannissement — ${guild.name}`)
    .setDescription([
      `Bonjour ${target.username},`,
      '',
      'Après examen de la situation, l’équipe de modération a décidé de vous retirer l’accès à ce serveur. Cette notification précise le motif communiqué et la durée de la mesure.',
      '',
      durationInfo,
      '',
      'Si vous estimez qu’il s’agit d’une erreur, vous pouvez demander un réexamen au staff par le moyen de contact ou de recours prévu par le serveur.'
    ].join('\n'))
    .addFields(
      { name: 'Raison', value: reason.slice(0, 1024) },
      { name: 'Durée', value: duration.label, inline: true },
      { name: 'Fin prévue', value: endDate, inline: true },
      { name: 'Décision prise par', value: moderator.tag }
    )
    .setFooter({ text: 'Message automatique de l’équipe de modération' }).setTimestamp();
}
async function banMember(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({ content: 'Tu n’as pas la permission de bannir des membres.', ephemeral: true });
  }
  const target = interaction.options.getUser('joueur');
  const reason = interaction.options.getString('raison').trim();
  const duration = parseBanDuration(interaction.options.getString('duree'));
  if (!duration) return interaction.reply({ content: 'Durée invalide. Utilise par exemple `30m`, `12h`, `7j` ou `permanent` (maximum : 10 ans).', ephemeral: true });
  if (!reason) return interaction.reply({ content: 'La raison du bannissement ne peut pas être vide.', ephemeral: true });
  if (target.id === interaction.user.id) return interaction.reply({ content: 'Tu ne peux pas te bannir toi-même.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const previous = store.getTemporaryBan.get(interaction.guild.id, target.id);
  if (duration.expiresAt) {
    store.setTemporaryBan.run(interaction.guild.id, target.id, reason, interaction.user.id, duration.expiresAt);
  } else {
    store.deleteTemporaryBan.run(interaction.guild.id, target.id);
  }
  try {
    await interaction.guild.members.ban(target.id, {
      reason: `Banni par ${interaction.user.tag}: ${reason}`.slice(0, 512)
    });
  } catch (error) {
    if (previous) store.setTemporaryBan.run(previous.guild_id, previous.user_id, previous.reason, previous.banned_by, previous.expires_at);
    else store.deleteTemporaryBan.run(interaction.guild.id, target.id);
    console.error('Échec du bannissement Discord.', error);
    return interaction.editReply('Le bannissement a échoué. Vérifie que le bot a la permission « Bannir des membres » et que sa hiérarchie de rôles le permet.');
  }

  const embed = banNotificationEmbed(interaction.guild, target, reason, duration, interaction.user);
  const notified = await target.send({ embeds: [embed], allowedMentions: { parse: [] } }).then(() => true).catch(() => false);
  await log(interaction.guild, `🔨 ${target.tag} banni par ${interaction.user.tag} (${duration.label}). Raison : ${reason}`);
  const end = duration.expiresAt ? ` jusqu’au <t:${Math.floor(duration.expiresAt / 1000)}:F>` : ' de façon permanente';
  return interaction.editReply(`${target.tag} a été banni${end}. ${notified ? 'La notification privée a été envoyée.' : 'Ses MP sont fermés : la notification privée n’a pas pu être envoyée.'}`);
}
async function processExpiredBans(client) {
  for (const ban of store.expiredTemporaryBans.all(Date.now())) {
    const guild = await client.guilds.fetch(ban.guild_id).catch(error => {
      console.error(`Impossible de charger le serveur ${ban.guild_id} pour le débannissement automatique.`, error);
      return null;
    });
    if (!guild) continue;
    try {
      await guild.members.unban(ban.user_id, 'Fin du bannissement temporaire');
      store.deleteTemporaryBan.run(ban.guild_id, ban.user_id);
      await log(guild, `⏱️ Le bannissement temporaire de <@${ban.user_id}> est arrivé à échéance.`);
    } catch (error) {
      if (error.code === 10026 || error.status === 404) {
        store.deleteTemporaryBan.run(ban.guild_id, ban.user_id);
      } else {
        console.error(`Échec du débannissement automatique de ${ban.user_id}. Il sera réessayé.`, error);
      }
    }
  }
}
function ticketMenu() {
  const menu = new StringSelectMenuBuilder().setCustomId('ticket:create')
    .setPlaceholder('Choisis le motif de ta demande').setMinValues(1).setMaxValues(1)
    .addOptions(Object.entries(ticketTypes).map(([type, details]) => ({
      label: details.label, value: type, emoji: details.emoji,
      description: `Créer un ticket : ${details.label.toLowerCase()}`
    })));
  return new ActionRowBuilder().addComponents(menu);
}
function ticketControls(claimedUserId) {
  const claim = new ButtonBuilder().setCustomId('ticket:claim')
    .setLabel(claimedUserId ? 'Libérer le ticket' : 'Prendre en charge')
    .setStyle(claimedUserId ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('🧑‍💻');
  return [new ActionRowBuilder().addComponents(
    claim,
    new ButtonBuilder().setCustomId('ticket:add-member').setLabel('Ajouter un membre').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcription').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒')
  )];
}
function closeConfirmationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close-confirm').setLabel('Confirmer la fermeture').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:close-cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
  );
}
function ticketOwnerId(channel) {
  return channel?.topic?.match(/\((\d+)\)/)?.[1] || channel?.name?.match(/^ticket-(\d+)$/)?.[1] || null;
}
function ticketName(username, userId) {
  const slug = username.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'membre';
  return `ticket-${slug}-${userId.slice(-4)}`;
}
function isTicketChannel(channel) {
  return channel?.type === ChannelType.GuildText && channel.name.startsWith('ticket-');
}
function isTicketMember(interaction) {
  return staffAllowed(interaction) || ticketOwnerId(interaction.channel) === interaction.user.id;
}
async function requestTicketClose(interaction) {
  if (!isTicketChannel(interaction.channel)) return interaction.reply({ content: 'Ce salon n’est pas un ticket.', ephemeral: true });
  if (!isTicketMember(interaction)) return interaction.reply({ content: 'Seul l’auteur du ticket ou le staff peut le fermer.', ephemeral: true });
  return interaction.reply({ content: 'Confirmer la fermeture de ce ticket ?', components: [closeConfirmationRow()], ephemeral: true });
}
async function openTicket(interaction, client, type) {
  const details = ticketTypes[type] || ticketTypes.support;
  const existing = interaction.guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText && ticketOwnerId(channel) === interaction.user.id
  );
  if (existing) return interaction.reply({ content: `Tu as déjà un ticket : ${existing}`, ephemeral: true });
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
  ];
  if (cfg.ticketStaffRoleId) overwrites.push({ id: cfg.ticketStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  const channel = await interaction.guild.channels.create({
    name: ticketName(interaction.user.username, interaction.user.id),
    type: ChannelType.GuildText,
    parent: cfg.ticketCategoryId || undefined,
    permissionOverwrites: overwrites,
    topic: `Ticket ouvert par ${interaction.user.tag} (${interaction.user.id}) | Type: ${details.label}`
  });
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`${details.emoji} ${details.label}`)
    .setDescription(`Bonjour ${interaction.user}, décris ta demande en détail. Le staff pourra prendre en charge ce ticket, ajouter un membre ou t’envoyer une transcription en message privé.`)
    .setFooter({ text: `Ticket de ${interaction.user.username}` }).setTimestamp();
  await channel.send({ content: cfg.ticketStaffRoleId ? `<@&${cfg.ticketStaffRoleId}>` : '', embeds: [embed], components: ticketControls() });
  return interaction.reply({ content: `Ton ticket est créé : ${channel}`, ephemeral: true });
}
function giveawayRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:join:${id}`).setLabel('🎉 PARTICIPER AU CONCOURS').setStyle(ButtonStyle.Success)
  );
}
const giveawayCountUpdates = new Map();
function updateGiveawayParticipantCount(client, messageId) {
  const previous = giveawayCountUpdates.get(messageId) || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const giveaway = store.getGiveaway.get(messageId);
    if (!giveaway) return;
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message?.embeds[0]) return;
    const embed = EmbedBuilder.from(message.embeds[0]);
    const fields = (embed.data.fields || []).filter(field => field.name !== '👥 Participants');
    fields.push({ name: '👥 Participants', value: `${store.entryCount.get(messageId).total}`, inline: true });
    await message.edit({ embeds: [embed.setFields(fields)] });
  });
  giveawayCountUpdates.set(messageId, current);
  return current.finally(() => {
    if (giveawayCountUpdates.get(messageId) === current) giveawayCountUpdates.delete(messageId);
  });
}
async function finishGiveaway(client, messageId, forceChannelId) {
  const g = store.getGiveaway.get(messageId);
  if (!g || g.ended) return { ok: false, message: 'Concours introuvable ou déjà terminé.' };
  if (!store.claimGiveawayFinish.run(messageId).changes) return { ok: false, message: 'Ce concours vient déjà d’être terminé.' };
  const channel = await client.channels.fetch(forceChannelId || g.channel_id).catch(() => null);
  const entries = store.entries.all(messageId).map(x => x.user_id);
  const winners = [];
  const pool = [...new Set(entries)];
  while (pool.length && winners.length < g.winners) {
    winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  if (channel?.isTextBased()) {
    const original = await channel.messages.fetch(messageId).catch(() => null);
    if (original) {
      const embed = EmbedBuilder.from(original.embeds[0] || new EmbedBuilder().setTitle('Concours'))
        .setColor(0xFFD700)
        .setTitle('🏆 CONCOURS TERMINÉ')
        .setDescription([
          `**Lot :** ${g.prize}`,
          '',
          winners.length
            ? `🎉 **Gagnant${winners.length > 1 ? 's' : ''} :** ${winners.map(id => `<@${id}>`).join(', ')}`
            : '❌ Aucune participation',
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n'))
        .setFooter({ text: 'Le concours est maintenant terminé. Merci à tous les participants !' });
      await original.edit({ embeds: [embed], components: [] }).catch(() => {});
    }
    await channel.send(winners.length
      ? `🎉 **Félicitations !** Le concours pour **${g.prize}** est terminé.\n\n🏆 Gagnant${winners.length > 1 ? 's' : ''} : ${winners.map(id => `<@${id}>`).join(', ')}`
      : `❌ Le concours pour **${g.prize}** est terminé sans participation.`).catch(() => {});
  }
  return { ok: true, winners };
}

async function publishRolePanel(interaction, category) {
  const details = rolePanelCategories[category];
  const channel = cfg.roleMenuChannelId
    ? await interaction.guild.channels.fetch(cfg.roleMenuChannelId).catch(() => null)
    : interaction.channel;
  const options = (cfg.roleMenuOptions || []).filter(option => option.category === category && option.roleId);
  const emojis = options.map(option => option.emoji);
  if (!channel?.isTextBased()) return interaction.reply({ content: 'Configure un salon de rôles valide.', ephemeral: true });
  if (!options.length || options.some(option => !option.label || !option.emoji) || new Set(emojis).size !== emojis.length) {
    return interaction.reply({ content: `Vérifie les rôles et les emojis de la catégorie « ${category} » dans config.json.`, ephemeral: true });
  }
  const description = [
    details.description,
    '',
    '**Rôles de cette catégorie**',
    ...options.map(option => `${option.emoji}  ${option.label}`),
    '',
    'Clique sur une réaction pour ajouter le rôle correspondant. Retire ta réaction pour le supprimer.'
  ].join('\n');
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(details.title)
    .setDescription(description.slice(0, 4000)).setFooter({ text: 'Tu peux modifier tes choix à tout moment.' });
  await interaction.deferReply({ ephemeral: true });
  const message = await channel.send({ embeds: [embed] });
  store.saveRolePanel.run(interaction.guild.id, category, channel.id, message.id);
  try {
    for (const option of options) await message.react(option.emoji);
  } catch (error) {
    await message.delete().catch(() => {});
    store.deleteRolePanel.run(message.id);
    throw error;
  }
  return interaction.editReply(`Panneau « ${details.title} » publié avec ses réactions.`);
}

async function handleCommand(i, client) {
  const guild = i.guild;
  switch (i.commandName) {
    case 'aide': {
      const embed = new EmbedBuilder().setColor(COLOR).setTitle('📚 Commandes du bot').setDescription([
        '**Général**', '`/aide` `/riot-id` `/valorant`',
        '**Tickets & rôles**', '`/panneau-tickets` `/fermer-ticket` `/panneau-roles-rang` `/panneau-roles-profil` `/panneau-roles-notifications`',
        '**Modération**', '`/ban` `/role-bannir` `/role-debannir` `/role-muter` `/role-demuter` `/expulser` `/nettoyer`',
        '**Communauté**', '`/publier-reglement` `/panneau-annonces` `/annonce`',
        '**Concours**', '`/concours-creer` `/concours-terminer` `/concours-relancer`'
      ].join('\n')).setFooter({ text: 'Les commandes de gestion nécessitent les permissions appropriées.' });
      return i.reply({ embeds: [embed], ephemeral: true });
    }
    case 'panneau-tickets': {
      const channel = cfg.ticketPanelChannelId ? await guild.channels.fetch(cfg.ticketPanelChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({ content: 'Configure un salon de tickets valide.', ephemeral: true });
      const panel = new EmbedBuilder().setColor(COLOR).setTitle('🎫 Centre d’assistance')
        .setDescription([
          'Besoin d’aide ou envie de contacter l’équipe ? Ouvre une demande privée : seuls toi et les personnes autorisées pourront lire la conversation.',
          '',
          '**Avant d’ouvrir un ticket**',
          '• Choisis le motif le plus proche de ta demande dans le menu ci-dessous.',
          '• Explique clairement la situation et ajoute les captures ou liens utiles.',
          '• Le staff te répondra directement dans ce salon privé. Pense à activer les notifications.',
          '',
          '**Demandes disponibles**',
          '🛠️ Aide et support · 🚩 Signalement · 🤝 Partenariat · 💬 Autre demande',
          '',
          'Un seul ticket ouvert par membre. Merci de ne pas créer plusieurs demandes pour le même sujet.'
        ].join('\n')).setFooter({ text: 'Le staff ne te demandera jamais ton mot de passe ou un code de connexion.' });
      await channel.send({ embeds: [panel], components: [ticketMenu()] });
      return i.reply({ content: 'Panneau de tickets publié.', ephemeral: true });
    }
    case 'fermer-ticket': {
      return requestTicketClose(i);
    }
    case 'panneau-roles-rang':
      return publishRolePanel(i, 'rang');
    case 'panneau-roles-profil':
      return publishRolePanel(i, 'profil');
    case 'panneau-roles-notifications':
      return publishRolePanel(i, 'notifications');
    case 'publier-reglement': {
      const channel = cfg.rulesChannelId ? await guild.channels.fetch(cfg.rulesChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({content:'Configure rulesChannelId.',ephemeral:true});
      const description = (cfg.rules || []).map((r,n)=>`**${n+1}.** ${r}`).join('\n\n').slice(0,4000);
      await channel.send({embeds:[new EmbedBuilder().setColor(COLOR).setTitle('📜 Règlement du serveur').setDescription(description)]});
      return i.reply({content:'Règlement publié.',ephemeral:true});
    }
    case 'panneau-annonces': {
      const channel = cfg.announcementPanelChannelId ? await guild.channels.fetch(cfg.announcementPanelChannelId).catch(() => null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({ content: 'Configure un salon valide pour le panneau staff des annonces.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ 
          name: 'Centre des Annonces',
          iconURL: guild.iconURL({ size: 256 }) 
        })
        .setTitle('📢 Gestion des Annonces')
        .setDescription('Utilisez les boutons ci-dessous pour créer une annonce officielle.')
        .addFields(
          { name: '✨ Fonctionnalités', value: 'Mise en forme professionnelle\nHorodatage automatique\nThumbnail et bannière', inline: true },
          { name: '⚠️ Règles', value: 'Réservé au staff\nVérifiez avant publication', inline: true }
        )
        .setThumbnail(guild.iconURL({ size: 512 }))
        .setFooter({ 
          text: guild.name,
          iconURL: i.user.displayAvatarURL({ size: 128 }) 
        })
        .setTimestamp();
      await channel.send({ embeds: [embed], components: [announcementPanelRow()] });
      return i.reply({ content: 'Panneau staff publié.', ephemeral: true });
    }
    case 'annonce': {
      const ping = i.options.getBoolean('ping') || false;
      const message = await sendAnnouncement(guild, i.user, i.options.getString('titre'), i.options.getString('message'), i.channel, ping);
      if (!message) return i.reply({content:'Configure un salon d’annonces valide.',ephemeral:true});
      return i.reply({content:'Annonce publiée.',ephemeral:true});
    }
    case 'riot-id': {
      const riotId = i.options.getString('riot_id').trim();
      if (!isValidRiotId(riotId)) return i.reply({content:'Format invalide. Exemple : Pseudo#TAG',ephemeral:true});
      store.setRiotId.run(i.user.id, riotId, Date.now());
      return i.reply({content:`Ton Riot ID est enregistré : **${riotId}**. Utilise \`/valorant\` pour l'afficher.`,ephemeral:true});
    }
    case 'valorant': {
      const user = i.options.getUser('membre') || i.user;
      const profile = store.getRiotId.get(user.id);
      const embed = new EmbedBuilder().setColor(COLOR).setTitle(`Profil Valorant — ${user.username}`)
        .setThumbnail(user.displayAvatarURL({size:256}))
        .addFields({name:'Membre Discord',value:`${user}`,inline:true},{name:'Riot ID',value:profile?.riot_id || 'Non renseigné',inline:true})
        .setFooter({text:'Riot ID déclaré par le membre, non vérifié par Riot Games.'});
      return i.reply({embeds:[embed],ephemeral:false});
    }
    case 'concours-creer': {
      const prize = i.options.getString('prix');
      const duration = giveawayDuration(i.options.getInteger('duree'), i.options.getString('unite'));
      const winners = i.options.getInteger('gagnants');
      if (!duration) return i.reply({ content: 'Durée invalide : maximum 7 jours en minutes/heures, 365 jours ou 52 semaines.', ephemeral: true });
      const channel = cfg.giveawayChannelId ? await guild.channels.fetch(cfg.giveawayChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({content:'Configure le canal giveawayChannelId.',ephemeral:true});
      const endsAt = Date.now() + duration.milliseconds;
      const embed = new EmbedBuilder()
        .setColor(0xB7F34A)
        .setAuthor({ name: '✨ CONCOURS EXCLUSIF', iconURL: i.user.displayAvatarURL({ size: 128 }) })
        .setTitle(`🎁 ${prize}`)
        .setDescription([
          `**Organisé par** ${i.user}`,
          '',
          `⏱️ **Durée :** ${duration.label}`,
          `📅 **Fin :** <t:${Math.floor(endsAt/1000)}:F> (<t:${Math.floor(endsAt/1000)}:R>)`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          `🏆 **${winners} Gagnant${winners > 1 ? 's' : ''}**`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'Clique sur le bouton ci-dessous pour participer !\nUne seule participation par personne.'
        ].join('\n'))
        .addFields(
          { name: '👥 Participants', value: '0', inline: true },
          { name: '🎯 Gagnants', value: `${winners}`, inline: true },
          { name: '⏳ Temps restant', value: `<t:${Math.floor(endsAt/1000)}:R>`, inline: true }
        )
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setFooter({ text: 'Bonne chance à tous ! 🍀', iconURL: client.user.displayAvatarURL({ size: 128 }) })
        .setTimestamp();
      const msg = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      store.createGiveaway.run({message_id:msg.id,channel_id:channel.id,guild_id:guild.id,host_id:i.user.id,prize,winners,ends_at:endsAt});
      await msg.edit({components:[giveawayRow(msg.id)]});
      return i.reply({content:`Concours créé : ${msg.url}`,ephemeral:true});
    }
    case 'concours-terminer': {
      const id = i.options.getString('message_id');
      const result = await finishGiveaway(client,id);
      if (!result.ok) return i.reply({content:result.message,ephemeral:true});
      return i.reply({content:'Concours terminé.',ephemeral:true});
    }
    case 'concours-relancer': {
      const id = i.options.getString('message_id');
      const g = store.getGiveaway.get(id);
      if (!g || !g.ended) return i.reply({content:'Concours terminé introuvable.',ephemeral:true});
      const pool = [...new Set(store.entries.all(id).map(x=>x.user_id))];
      const winners = [];
      while(pool.length && winners.length < g.winners) winners.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
      if (!winners.length) return i.reply({content:'Aucune participation à tirer.',ephemeral:true});
      const ch = await client.channels.fetch(g.channel_id).catch(()=>null);
      await ch?.send(`🔁 Nouveau tirage pour **${g.prize}** : ${winners.map(id=>`<@${id}>`).join(', ')}`);
      return i.reply({content:'Nouveau tirage effectué.',ephemeral:true});
    }
    case 'ban': {
      return banMember(i);
    }
    case 'role-bannir':
    case 'role-debannir':
    case 'role-muter':
    case 'role-demuter': {
      const targetUser = i.options.getUser('membre');
      const member = await guild.members.fetch(targetUser.id).catch(()=>null);
      if (!member) return i.reply({content:'Membre introuvable.',ephemeral:true});
      const isBanCommand = i.commandName === 'role-bannir' || i.commandName === 'role-debannir';
      const roleId = isBanCommand ? cfg.bannedRoleId : cfg.mutedRoleId;
      const role = roleId ? await guild.roles.fetch(roleId).catch(()=>null) : null;
      if (!role) return i.reply({content:`Configure le rôle ${isBanCommand?'BANNED':'MUTE'} dans config.json.`,ephemeral:true});
      const remove = i.commandName === 'role-debannir' || i.commandName === 'role-demuter';
      await member.roles[remove?'remove':'add'](role, `Commande ${i.commandName} par ${i.user.tag}`);
      await log(guild, `🛡️ ${i.user.tag} a ${remove?'retiré':'attribué'} ${role.name} à ${targetUser.tag}.`);
      return i.reply({content:`Rôle **${role.name}** ${remove?'retiré de':'attribué à'} ${targetUser}.`,ephemeral:true});
    }
    case 'expulser': {
      const user = i.options.getUser('membre');
      const member = await guild.members.fetch(user.id).catch(()=>null);
      if (!member?.kickable) return i.reply({content:'Ce membre ne peut pas être expulsé (hiérarchie ou permissions).',ephemeral:true});
      await member.kick(i.options.getString('raison') || `Par ${i.user.tag}`);
      await log(guild, `👢 ${user.tag} expulsé par ${i.user.tag}.`);
      return i.reply({content:`${user.tag} a été expulsé.`,ephemeral:true});
    }
    case 'nettoyer': {
      const amount = i.options.getInteger('nombre');
      if (!i.channel?.bulkDelete) return i.reply({content:'Salon incompatible.',ephemeral:true});
      const deleted = await i.channel.bulkDelete(amount,true);
      return i.reply({content:`${deleted.size} message(s) supprimé(s).`,ephemeral:true});
    }
    case 'ghost-ping': {
      if (!cfg.memberRoleId) return i.reply({content:'Configure memberRoleId dans config.json.',ephemeral:true});
      await i.deferReply({ephemeral:true});
      const message = await i.channel.send({content:`<@&${cfg.memberRoleId}>`,allowedMentions:{roles:[cfg.memberRoleId]}}).catch(console.error);
      if (message) {
        setTimeout(() => message.delete().catch(console.error), 5000);
        return i.editReply('Ghost ping envoyé et supprimé après 5 secondes.');
      }
      return i.editReply('Échec de l\'envoi du ghost ping.');
    }
    case 'panneau-vocal': {
      if (!cfg.voiceJoinChannelId || !cfg.voiceManagementRoleId) return i.reply({content:'Configure voiceJoinChannelId et voiceManagementRoleId dans config.json.',ephemeral:true});
      const channel = i.channel;
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎤 Gestion des Vocaux Temporaires')
        .setDescription([
          'Rejoignez le salon vocal pour créer votre propre vocal temporaire.',
          '',
          '**Comment créer un vocal :**',
          '1. Rejoignez le salon "Créer un vocal"',
          '2. Un vocal sera créé automatiquement avec votre nom',
          '3. Vous serez déplacé automatiquement',
          '',
          '**Gestion :**',
          'Utilisez le menu ci-dessous pour gérer votre vocal.',
          '',
          '*Le vocal sera supprimé quand il sera vide.*'
        ].join('\n'))
        .setFooter({ text: 'Système de vocaux temporaires' });
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('voice:management')
        .setPlaceholder('Gestion vocale')
        .addOptions([
          { label: '🔒 Verrouiller le vocal', value: 'lock', description: 'Empêcher les autres de rejoindre' },
          { label: '🔓 Déverrouiller le vocal', value: 'unlock', description: 'Autoriser les autres à rejoindre' },
          { label: '👤 Inviter un membre', value: 'invite', description: 'Donner l\'accès à un membre' },
          { label: '🚫 Retirer un membre', value: 'remove', description: 'Retirer l\'accès à un membre' },
          { label: '🏷️ Renommer le vocal', value: 'rename', description: 'Changer le nom du vocal' },
          { label: '👥 Limiter le nombre', value: 'limit', description: 'Limite le nombre de personnes' },
          { label: '♾️ Supprimer la limite', value: 'unlimit', description: 'Retire la limite de personnes' }
        ]);
      await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
      return i.reply({ content: 'Panneau vocal publié.', ephemeral: true });
    }
  }
}

async function handleButton(i, client) {
  if (i.customId.startsWith('welcome:riot:')) {
    const memberId = i.customId.split(':')[2];
    if (i.user.id !== memberId) return i.reply({ content: 'Ce panneau est réservé au nouveau membre concerné.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`welcome:riot-modal:${memberId}`).setTitle('Enregistrer ton Riot ID');
    const input = new TextInputBuilder().setCustomId('riot_id').setLabel('Riot ID (Pseudo#TAG)')
      .setPlaceholder('Exemple : Joueur#EUW').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(49);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return i.showModal(modal);
  }
  if (i.customId.startsWith('welcome:accept:')) {
    const memberId = i.customId.split(':')[2];
    if (i.user.id !== memberId) return i.reply({ content: 'Ce panneau est réservé au nouveau membre concerné.', ephemeral: true });
    if (!store.getRiotId.get(memberId)) return i.reply({ content: 'Enregistre d’abord ton Riot ID avec le bouton prévu, puis accepte le règlement.', ephemeral: true });
    const member = await i.guild.members.fetch(memberId);
    const memberRoleId = cfg.memberRoleId || cfg.welcomeRoleId;
    if (!memberRoleId) return i.reply({ content: 'Le rôle membre n’est pas configuré. Contacte le staff.', ephemeral: true });
    const role = await i.guild.roles.fetch(memberRoleId).catch(() => null);
    if (!role) return i.reply({ content: 'Le rôle membre configuré est introuvable. Contacte le staff.', ephemeral: true });
    await member.roles.add(role, 'Règlement accepté et Riot ID enregistré');
    if (cfg.pendingRoleId) {
      const pendingRole = await i.guild.roles.fetch(cfg.pendingRoleId).catch(() => null);
      if (pendingRole) await member.roles.remove(pendingRole, 'Règlement accepté');
    }
    return i.update({ content: `${member} a enregistré son Riot ID et accepté le règlement.`, embeds: [], components: [] });
  }
  if (i.customId === 'announcement:create') {
    if (!announcementStaffAllowed(i)) return i.reply({ content: 'Cette action est réservée au staff.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('announcement:create-modal').setTitle('Rédiger une annonce');
    const title = new TextInputBuilder().setCustomId('title').setLabel('Titre').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
    const content = new TextInputBuilder().setCustomId('content').setLabel('Message').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
    const ping = new TextInputBuilder().setCustomId('ping').setLabel('Ping @everyone ? (oui/non)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(3).setPlaceholder('oui ou non');
    modal.addComponents(new ActionRowBuilder().addComponents(title), new ActionRowBuilder().addComponents(content), new ActionRowBuilder().addComponents(ping));
    return i.showModal(modal);
  }
  if (i.customId === 'announcement:help') {
    const embed = new EmbedBuilder()
      .setColor(0xFF2D55)
      .setTitle('❓ Aide - Annonces')
      .setDescription([
        '**Comment créer une annonce ?**',
        'Cliquez sur "📝 Rédiger une annonce" et remplissez les champs.',
        '',
        '**Formatage :**',
        'Utilisez **gras**, *italique*, `code` et les sauts de ligne.',
        '',
        '**Maximum :** 4000 caractères'
      ].join('\n'))
      .setFooter({ text: i.guild.name })
      .setTimestamp();
    return i.reply({ embeds: [embed], ephemeral: true });
  }
  if (i.customId.startsWith('ticket:open')) {
    return openTicket(i, client, i.customId.split(':')[2] || 'support');
  }
  if (i.customId === 'ticket:close') {
    return requestTicketClose(i);
  }
  if (i.customId === 'ticket:close-cancel') {
    return i.update({ content: 'Fermeture annulée.', components: [] });
  }
  if (i.customId === 'ticket:close-confirm') {
    if (!isTicketChannel(i.channel)) return i.reply({ content: 'Ce salon n’est plus un ticket.', ephemeral: true });
    if (!isTicketMember(i)) return i.reply({ content: 'Seul l’auteur du ticket ou le staff peut le fermer.', ephemeral: true });
    await i.update({ content: 'Ticket fermé. Suppression du salon dans 5 secondes.', components: [] });
    setTimeout(()=>i.channel.delete(`Ticket fermé par ${i.user.tag}`).catch(()=>{}),5000);
    return;
  }
  if (i.customId === 'ticket:claim') {
    if (!isTicketChannel(i.channel)) return i.reply({ content: 'Ce salon n’est pas un ticket.', ephemeral: true });
    if (!staffAllowed(i)) return i.reply({ content: 'Seul le staff peut prendre en charge un ticket.', ephemeral: true });
    const claimedId = i.channel.topic?.match(/\| Pris en charge: (\d+)/)?.[1];
    if (claimedId && claimedId !== i.user.id) return i.reply({ content: `Ce ticket est déjà pris en charge par <@${claimedId}>.`, ephemeral: true });
    const nextClaimedId = claimedId ? null : i.user.id;
    const topic = (i.channel.topic || '').replace(/ \| Pris en charge: \d+/, '');
    await i.channel.setTopic(nextClaimedId ? `${topic} | Pris en charge: ${nextClaimedId}` : topic);
    await i.update({ components: ticketControls(nextClaimedId) });
    return i.followUp({ content: nextClaimedId ? `Ticket pris en charge par ${i.user}.` : 'Tu as libéré ce ticket.', ephemeral: true });
  }
  if (i.customId === 'ticket:add-member') {
    if (!isTicketChannel(i.channel)) return i.reply({ content: 'Ce salon n’est pas un ticket.', ephemeral: true });
    if (!isTicketMember(i)) return i.reply({ content: 'Seul l’auteur du ticket ou le staff peut ajouter un membre.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('ticket:add-member-modal').setTitle('Ajouter un membre au ticket');
    const input = new TextInputBuilder().setCustomId('member').setLabel('ID ou mention Discord')
      .setPlaceholder('Exemple : 123456789012345678').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return i.showModal(modal);
  }
  if (i.customId === 'ticket:transcript') {
    if (!isTicketChannel(i.channel)) return i.reply({ content: 'Ce salon n’est pas un ticket.', ephemeral: true });
    if (!isTicketMember(i)) return i.reply({ content: 'Seul l’auteur du ticket ou le staff peut consulter la transcription.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    const messages = await i.channel.messages.fetch({ limit: 100 });
    const transcript = [...messages.values()].reverse().map(message => {
      const content = message.content || '';
      const attachments = [...message.attachments.values()].map(file => file.url).join(' ');
      return `[${message.createdAt.toISOString()}] ${message.author.tag}: ${content}${attachments ? ` ${attachments}` : ''}`;
    }).join('\n');
    try {
      const ticketOwner = await i.client.users.fetch(ticketOwnerId(i.channel));
      await ticketOwner.send({ content: `Transcription du ticket **${i.channel.name}** (100 derniers messages) :`, files: [{ attachment: Buffer.from(transcript || 'Aucun message.'), name: `${i.channel.name}-transcription.txt` }] });
      return i.editReply(`La transcription vient d’être envoyée en MP à <@${ticketOwner.id}>.`);
    } catch {
      return i.editReply('Je ne peux pas t’envoyer de MP. Autorise les messages privés du serveur puis réessaie.');
    }
  }
  if (i.customId.startsWith('giveaway:join:')) {
    const id = i.customId.split(':')[2];
    const g = store.getGiveaway.get(id);
    if (!g) return i.reply({ content: 'Ce concours n’est plus enregistré dans la base du bot. Contacte le staff pour qu’il le recrée.', ephemeral: true });
    if (g.ended || g.ends_at <= Date.now()) return i.reply({content:'Ce concours est terminé.',ephemeral:true});
    const result = store.addEntry.run(id, i.user.id, id, Date.now());
    if (result.changes) {
      await i.deferReply({ ephemeral: true });
      await updateGiveawayParticipantCount(client, id).catch(console.error);
      return i.editReply('Participation enregistrée ! Bonne chance 🍀');
    }
    const current = store.getGiveaway.get(id);
    return i.reply({content:!current || current.ended || current.ends_at <= Date.now() ? 'Ce concours est terminé.' : 'Tu participes déjà à ce concours.',ephemeral:true});
  }
  if (i.customId === 'voice:management') {
    const action = i.values[0];
    const voiceChannel = i.member.voice.channel;
    if (!voiceChannel) return i.reply({ content: 'Tu dois être dans un vocal temporaire pour utiliser cette commande.', ephemeral: true });

    if (action === 'lock') {
      await voiceChannel.permissionOverwrites.edit(i.guild.roles.everyone.id, { Connect: false });
      return i.reply({ content: 'Vocal verrouillé.', ephemeral: true });
    }
    if (action === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(i.guild.roles.everyone.id, { Connect: null });
      return i.reply({ content: 'Vocal déverrouillé.', ephemeral: true });
    }
    if (action === 'invite') {
      const modal = new ModalBuilder().setCustomId('voice:invite-modal').setTitle('Inviter un membre');
      const input = new TextInputBuilder().setCustomId('member').setLabel('Mention ou ID du membre').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }
    if (action === 'remove') {
      const modal = new ModalBuilder().setCustomId('voice:remove-modal').setTitle('Retirer un membre');
      const input = new TextInputBuilder().setCustomId('member').setLabel('Mention ou ID du membre').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }
    if (action === 'rename') {
      const modal = new ModalBuilder().setCustomId('voice:rename-modal').setTitle('Renommer le vocal');
      const input = new TextInputBuilder().setCustomId('name').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }
    if (action === 'limit') {
      const modal = new ModalBuilder().setCustomId('voice:limit-modal').setTitle('Limiter le vocal');
      const input = new TextInputBuilder().setCustomId('limit').setLabel('Nombre maximum').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }
    if (action === 'unlimit') {
      await voiceChannel.setUserLimit(null);
      return i.reply({ content: 'Limite supprimée.', ephemeral: true });
    }
  }
}
async function handleModal(i) {
  const onboardingMatch = i.customId.match(/^welcome:riot-modal:(\d+)$/);
  if (onboardingMatch) {
    if (i.user.id !== onboardingMatch[1]) return i.reply({ content: 'Ce formulaire est réservé au nouveau membre concerné.', ephemeral: true });
    const riotId = i.fields.getTextInputValue('riot_id').trim();
    if (!isValidRiotId(riotId)) return i.reply({ content: 'Format invalide. Exemple : Pseudo#TAG', ephemeral: true });
    store.setRiotId.run(i.user.id, riotId, Date.now());
    return i.reply({ content: `Riot ID enregistré : **${riotId}**. Tu peux maintenant accepter le règlement sur le panneau d’accueil.`, ephemeral: true });
  }
  if (i.customId === 'announcement:create-modal') {
    if (!announcementStaffAllowed(i)) return i.reply({ content: 'Cette action est réservée au staff.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    const pingValue = i.fields.getTextInputValue('ping')?.trim().toLowerCase();
    const ping = pingValue === 'oui' || pingValue === 'yes' || pingValue === 'true';
    const message = await sendAnnouncement(i.guild, i.user, i.fields.getTextInputValue('title').trim(), i.fields.getTextInputValue('content').trim(), null, ping);
    return i.editReply(message ? `Annonce publiée dans ${message.channel}.` : 'Configure un salon d’annonces valide.');
  }
  if (i.customId === 'voice:invite-modal') {
    const voiceChannel = i.member.voice.channel;
    if (!voiceChannel) return i.reply({ content: 'Tu dois être dans un vocal temporaire.', ephemeral: true });
    const input = i.fields.getTextInputValue('member').trim();
    const match = input.match(/^(?:<@!?(\d+)>|(\d+))$/);
    const userId = match?.[1] || match?.[2];
    if (!userId) return i.reply({ content: 'Entre une mention valide ou un ID.', ephemeral: true });
    await voiceChannel.permissionOverwrites.edit(userId, { Connect: true, Speak: true });
    return i.reply({ content: 'Membre invité.', ephemeral: true });
  }
  if (i.customId === 'voice:remove-modal') {
    const voiceChannel = i.member.voice.channel;
    if (!voiceChannel) return i.reply({ content: 'Tu dois être dans un vocal temporaire.', ephemeral: true });
    const input = i.fields.getTextInputValue('member').trim();
    const match = input.match(/^(?:<@!?(\d+)>|(\d+))$/);
    const userId = match?.[1] || match?.[2];
    if (!userId) return i.reply({ content: 'Entre une mention valide ou un ID.', ephemeral: true });
    await voiceChannel.permissionOverwrites.edit(userId, { Connect: false });
    const member = await i.guild.members.fetch(userId).catch(() => null);
    if (member && member.voice.channel?.id === voiceChannel.id) {
      await member.voice.disconnect().catch(console.error);
    }
    return i.reply({ content: 'Membre retiré.', ephemeral: true });
  }
  if (i.customId === 'voice:rename-modal') {
    const voiceChannel = i.member.voice.channel;
    if (!voiceChannel) return i.reply({ content: 'Tu dois être dans un vocal temporaire.', ephemeral: true });
    const name = i.fields.getTextInputValue('name').trim();
    await voiceChannel.setName(name);
    return i.reply({ content: 'Vocal renommé.', ephemeral: true });
  }
  if (i.customId === 'voice:limit-modal') {
    const voiceChannel = i.member.voice.channel;
    if (!voiceChannel) return i.reply({ content: 'Tu dois être dans un vocal temporaire.', ephemeral: true });
    const limit = parseInt(i.fields.getTextInputValue('limit'));
    if (isNaN(limit) || limit < 1) return i.reply({ content: 'Entre un nombre valide.', ephemeral: true });
    await voiceChannel.setUserLimit(limit);
    return i.reply({ content: `Limite fixée à ${limit}.`, ephemeral: true });
  }
  if (i.customId !== 'ticket:add-member-modal') return;
  if (!isTicketChannel(i.channel) || !isTicketMember(i)) return i.reply({ content: 'Tu ne peux pas ajouter de membre à ce ticket.', ephemeral: true });
  const input = i.fields.getTextInputValue('member').trim();
  const match = input.match(/^(?:<@!?(\d+)>|(\d+))$/);
  const userId = match?.[1] || match?.[2];
  if (!userId) return i.reply({ content: 'Entre une mention Discord valide ou un ID numérique.', ephemeral: true });
  const member = await i.guild.members.fetch(userId).catch(() => null);
  if (!member) return i.reply({ content: 'Ce membre est introuvable sur le serveur.', ephemeral: true });
  await i.channel.permissionOverwrites.edit(member.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true
  });
  await i.channel.send(`${member} a été ajouté au ticket par ${i.user}.`);
  return i.reply({ content: `${member.user.tag} peut maintenant accéder au ticket.`, ephemeral: true });
}
async function handleSelect(i, client) {
  if (i.customId === 'ticket:create') return openTicket(i, client, i.values[0]);
  if (i.customId !== 'roles:select') return;
  const allowed = cfg.roleMenuOptions || [];
  const selected = new Set(i.values);
  const changes = [];
  for (const opt of allowed) {
    if (!opt.roleId) continue;
    const role = await i.guild.roles.fetch(opt.roleId).catch(()=>null);
    if (!role) continue;
    const has = i.member.roles.cache.has(role.id);
    const wants = selected.has(opt.value);
    if (wants && !has) { await i.member.roles.add(role).catch(()=>{}); changes.push(`+ ${role.name}`); }
    if (!wants && has) { await i.member.roles.remove(role).catch(()=>{}); changes.push(`- ${role.name}`); }
  }
  return i.reply({content:changes.length?`Choix mis à jour : ${changes.join(', ')}`:'Aucun changement.',ephemeral:true});
}
function matchesRoleEmoji(configured, emoji) {
  return configured === emoji.name || configured === emoji.id || configured === emoji.toString();
}
async function handleReaction(reaction, user, added) {
  if (user.partial) user = await user.fetch().catch(() => null);
  if (!user) return;
  if (user.bot) return;
  if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
  if (!reaction) return;
  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message) return;
  const panel = store.getRolePanel.get(message.id);
  if (!panel || message.guildId !== panel.guild_id || message.channelId !== panel.channel_id) return;
  const option = (cfg.roleMenuOptions || []).find(item =>
    item.category === panel.category && item.roleId && item.emoji && matchesRoleEmoji(item.emoji, reaction.emoji)
  );
  if (!option) return;
  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  const role = await message.guild.roles.fetch(option.roleId).catch(() => null);
  if (!role) return;
  if (added) await member.roles.add(role, 'Rôle attribué par réaction');
  else await member.roles.remove(role, 'Rôle retiré par réaction');
}
module.exports = { configureHandlers, handleCommand, handleButton, handleSelect, handleModal, handleReaction, finishGiveaway, processExpiredBans, parseBanDuration, giveawayDuration, updateGiveawayParticipantCount, onboardingRow };
