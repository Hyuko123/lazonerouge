const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ChannelType, PermissionFlagsBits, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const cfg = require('../config.json');
const store = require('./database');

const COLOR = 0x5865F2;
const staffAllowed = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  Boolean(cfg.ticketStaffRoleId && interaction.member?.roles?.cache?.has(cfg.ticketStaffRoleId));

const ticketTypes = {
  support: { label: 'Aide et support', emoji: '🛠️' },
  report: { label: 'Signaler un problème', emoji: '🚩' },
  partnership: { label: 'Partenariat', emoji: '🤝' },
  other: { label: 'Autre demande', emoji: '💬' }
};

async function log(guild, message) {
  if (!cfg.logChannelId) return;
  const channel = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
  if (channel?.isTextBased()) channel.send({ content: message }).catch(() => {});
}
function ticketButtons() {
  return new ActionRowBuilder().addComponents(Object.entries(ticketTypes).map(([type, details]) =>
    new ButtonBuilder().setCustomId(`ticket:open:${type}`).setLabel(details.label).setStyle(ButtonStyle.Primary).setEmoji(details.emoji)
  ));
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
  return channel?.name?.match(/^ticket-(\d+)$/)?.[1] || null;
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
function giveawayRow(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:join:${id}`).setLabel('Participer').setStyle(ButtonStyle.Success).setEmoji('🎉')
  );
}
async function finishGiveaway(client, messageId, forceChannelId) {
  const g = store.getGiveaway.get(messageId);
  if (!g || g.ended) return { ok: false, message: 'Giveaway introuvable ou déjà terminé.' };
  const channel = await client.channels.fetch(forceChannelId || g.channel_id).catch(() => null);
  const entries = store.entries.all(messageId).map(x => x.user_id);
  const winners = [];
  const pool = [...new Set(entries)];
  while (pool.length && winners.length < g.winners) {
    winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  store.endGiveaway.run(messageId);
  if (channel?.isTextBased()) {
    const original = await channel.messages.fetch(messageId).catch(() => null);
    if (original) {
      const embed = EmbedBuilder.from(original.embeds[0] || new EmbedBuilder().setTitle('Giveaway'))
        .setColor(0x747F8D).setFooter({ text: 'Giveaway terminé' });
      await original.edit({ embeds: [embed], components: [] }).catch(() => {});
    }
    await channel.send(winners.length
      ? `🎉 Giveaway terminé ! Lot : **${g.prize}** — gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}`
      : `Giveaway terminé pour **${g.prize}** : aucune participation.`).catch(() => {});
  }
  return { ok: true, winners };
}

async function handleCommand(i, client) {
  const guild = i.guild;
  switch (i.commandName) {
    case 'help': {
      const embed = new EmbedBuilder().setColor(COLOR).setTitle('📚 Commandes du bot').setDescription([
        '**Général**', '`/help` `/riotid` `/valorant`',
        '**Tickets & rôles**', '`/ticket-panel` `/ticket-close` `/roles-panel`',
        '**Modération**', '`/ban-role` `/unban-role` `/mute-role` `/unmute-role` `/kick` `/clear`',
        '**Communauté**', '`/rules` `/announce`',
        '**Giveaways**', '`/giveaway-create` `/giveaway-end` `/giveaway-reroll`'
      ].join('\n')).setFooter({ text: 'Les commandes de gestion nécessitent les permissions appropriées.' });
      return i.reply({ embeds: [embed], ephemeral: true });
    }
    case 'ticket-panel': {
      const channel = cfg.ticketPanelChannelId ? await guild.channels.fetch(cfg.ticketPanelChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({ content: 'Configure un salon de tickets valide.', ephemeral: true });
      await channel.send({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🎫 Centre de support').setDescription('Clique sur le bouton ci-dessous pour créer un salon privé avec le staff.')], components: [ticketButtons()] });
      return i.reply({ content: 'Panneau de tickets publié.', ephemeral: true });
    }
    case 'ticket-close': {
      return requestTicketClose(i);
    }
    case 'roles-panel': {
      const channel = cfg.roleMenuChannelId ? await guild.channels.fetch(cfg.roleMenuChannelId).catch(()=>null) : i.channel;
      const options = (cfg.roleMenuOptions || []).filter(x=>x.roleId).slice(0,25).map(x=>({label:x.label,value:x.value,description:`Recevoir le rôle ${x.label}`.slice(0,100)}));
      if (!channel?.isTextBased() || !options.length) return i.reply({ content: 'Configure roleMenuChannelId et au moins un roleId dans config.json.', ephemeral: true });
      const menu = new StringSelectMenuBuilder().setCustomId('roles:select').setPlaceholder('Choisis tes rôles').setMinValues(0).setMaxValues(options.length).addOptions(options);
      await channel.send({ embeds:[new EmbedBuilder().setColor(COLOR).setTitle('🎭 Choix des rôles').setDescription('Sélectionne les rôles que tu souhaites recevoir. Tu peux modifier ton choix plus tard.')], components:[new ActionRowBuilder().addComponents(menu)] });
      return i.reply({ content:'Menu de rôles publié.', ephemeral:true });
    }
    case 'rules': {
      const channel = cfg.rulesChannelId ? await guild.channels.fetch(cfg.rulesChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({content:'Configure rulesChannelId.',ephemeral:true});
      const description = (cfg.rules || []).map((r,n)=>`**${n+1}.** ${r}`).join('\n\n').slice(0,4000);
      await channel.send({embeds:[new EmbedBuilder().setColor(COLOR).setTitle('📜 Règlement du serveur').setDescription(description)]});
      return i.reply({content:'Règlement publié.',ephemeral:true});
    }
    case 'announce': {
      const channel = cfg.announcementChannelId ? await guild.channels.fetch(cfg.announcementChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({content:'Configure announcementChannelId.',ephemeral:true});
      const embed = new EmbedBuilder().setColor(COLOR).setTitle(i.options.getString('titre')).setDescription(i.options.getString('message')).setFooter({text:`Annonce de ${i.user.username}`}).setTimestamp();
      await channel.send({embeds:[embed]});
      await log(guild, `📣 Annonce publiée par ${i.user.tag} dans ${channel}.`);
      return i.reply({content:'Annonce publiée.',ephemeral:true});
    }
    case 'riotid': {
      const riotId = i.options.getString('riot_id').trim();
      if (!/^.{1,32}#[^#\s]{1,16}$/.test(riotId)) return i.reply({content:'Format invalide. Exemple : Pseudo#TAG',ephemeral:true});
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
    case 'giveaway-create': {
      const prize = i.options.getString('prix');
      const minutes = i.options.getInteger('minutes');
      const winners = i.options.getInteger('gagnants');
      const channel = cfg.giveawayChannelId ? await guild.channels.fetch(cfg.giveawayChannelId).catch(()=>null) : i.channel;
      if (!channel?.isTextBased()) return i.reply({content:'Configure giveawayChannelId.',ephemeral:true});
      const endsAt = Date.now() + minutes*60000;
      const embed = new EmbedBuilder().setColor(COLOR).setTitle('🎉 GIVEAWAY').setDescription(`**Lot :** ${prize}\n**Organisé par :** ${i.user}\n**Gagnants :** ${winners}\n**Fin :** <t:${Math.floor(endsAt/1000)}:R>\nClique sur Participer pour entrer.`).setTimestamp();
      const msg = await channel.send({embeds:[embed]});
      store.createGiveaway.run({message_id:msg.id,channel_id:channel.id,guild_id:guild.id,host_id:i.user.id,prize,winners,ends_at:endsAt});
      await msg.edit({components:[giveawayRow(msg.id)]});
      return i.reply({content:`Giveaway créé : ${msg.url}`,ephemeral:true});
    }
    case 'giveaway-end': {
      const id = i.options.getString('message_id');
      const result = await finishGiveaway(client,id);
      if (!result.ok) return i.reply({content:result.message,ephemeral:true});
      return i.reply({content:'Giveaway terminé.',ephemeral:true});
    }
    case 'giveaway-reroll': {
      const id = i.options.getString('message_id');
      const g = store.getGiveaway.get(id);
      if (!g || !g.ended) return i.reply({content:'Giveaway terminé introuvable.',ephemeral:true});
      const pool = [...new Set(store.entries.all(id).map(x=>x.user_id))];
      const winners = [];
      while(pool.length && winners.length < g.winners) winners.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
      if (!winners.length) return i.reply({content:'Aucune participation à tirer.',ephemeral:true});
      const ch = await client.channels.fetch(g.channel_id).catch(()=>null);
      await ch?.send(`🔁 Nouveau tirage pour **${g.prize}** : ${winners.map(id=>`<@${id}>`).join(', ')}`);
      return i.reply({content:'Nouveau tirage effectué.',ephemeral:true});
    }
    case 'ban-role':
    case 'unban-role':
    case 'mute-role':
    case 'unmute-role': {
      const targetUser = i.options.getUser('membre');
      const member = await guild.members.fetch(targetUser.id).catch(()=>null);
      if (!member) return i.reply({content:'Membre introuvable.',ephemeral:true});
      const roleId = i.commandName.includes('ban') ? cfg.bannedRoleId : cfg.mutedRoleId;
      const role = roleId ? await guild.roles.fetch(roleId).catch(()=>null) : null;
      if (!role) return i.reply({content:`Configure le rôle ${i.commandName.includes('ban')?'BANNED':'MUTE'} dans config.json.`,ephemeral:true});
      const remove = i.commandName.startsWith('un');
      await member.roles[remove?'remove':'add'](role, `Commande ${i.commandName} par ${i.user.tag}`);
      await log(guild, `🛡️ ${i.user.tag} a ${remove?'retiré':'attribué'} ${role.name} à ${targetUser.tag}.`);
      return i.reply({content:`Rôle **${role.name}** ${remove?'retiré de':'attribué à'} ${targetUser}.`,ephemeral:true});
    }
    case 'kick': {
      const user = i.options.getUser('membre');
      const member = await guild.members.fetch(user.id).catch(()=>null);
      if (!member?.kickable) return i.reply({content:'Ce membre ne peut pas être expulsé (hiérarchie ou permissions).',ephemeral:true});
      await member.kick(i.options.getString('raison') || `Par ${i.user.tag}`);
      await log(guild, `👢 ${user.tag} expulsé par ${i.user.tag}.`);
      return i.reply({content:`${user.tag} a été expulsé.`,ephemeral:true});
    }
    case 'clear': {
      const amount = i.options.getInteger('nombre');
      if (!i.channel?.bulkDelete) return i.reply({content:'Salon incompatible.',ephemeral:true});
      const deleted = await i.channel.bulkDelete(amount,true);
      return i.reply({content:`${deleted.size} message(s) supprimé(s).`,ephemeral:true});
    }
  }
}

async function handleButton(i, client) {
  if (i.customId.startsWith('ticket:open')) {
    const type = i.customId.split(':')[2] || 'support';
    const details = ticketTypes[type] || ticketTypes.support;
    const existing = i.guild.channels.cache.find(c=>c.type===ChannelType.GuildText && c.name===`ticket-${i.user.id}`);
    if (existing) return i.reply({content:`Tu as déjà un ticket : ${existing}`,ephemeral:true});
    const overwrites = [
      {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
      {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},
      {id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]}
    ];
    if (cfg.ticketStaffRoleId) overwrites.push({id:cfg.ticketStaffRoleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
    const channel = await i.guild.channels.create({name:`ticket-${i.user.id}`,type:ChannelType.GuildText,parent:cfg.ticketCategoryId || undefined,permissionOverwrites:overwrites,topic:`Ticket ouvert par ${i.user.tag} (${i.user.id}) | Type: ${details.label}`});
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(`${details.emoji} ${details.label}`)
      .setDescription(`Bonjour ${i.user}, décris ta demande en détail. Le staff pourra prendre en charge ce ticket, ajouter un membre ou joindre une transcription.`)
      .setFooter({ text: `Ouvert par ${i.user.tag}` }).setTimestamp();
    await channel.send({content:cfg.ticketStaffRoleId?`<@&${cfg.ticketStaffRoleId}>`:'',embeds:[embed],components:ticketControls()});
    return i.reply({content:`Ton ticket est créé : ${channel}`,ephemeral:true});
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
    const messages = await i.channel.messages.fetch({ limit: 100 });
    const transcript = [...messages.values()].reverse().map(message => {
      const content = message.content || '';
      const attachments = [...message.attachments.values()].map(file => file.url).join(' ');
      return `[${message.createdAt.toISOString()}] ${message.author.tag}: ${content}${attachments ? ` ${attachments}` : ''}`;
    }).join('\n');
    return i.reply({ content: 'Transcription des 100 derniers messages :', files: [{ attachment: Buffer.from(transcript || 'Aucun message.'), name: `${i.channel.name}-transcription.txt` }], ephemeral: true });
  }
  if (i.customId.startsWith('giveaway:join:')) {
    const id = i.customId.split(':')[2];
    const g = store.getGiveaway.get(id);
    if (!g || g.ended || g.ends_at <= Date.now()) return i.reply({content:'Ce giveaway est terminé.',ephemeral:true});
    store.addEntry.run(id,i.user.id);
    return i.reply({content:'Participation enregistrée ! Bonne chance 🍀',ephemeral:true});
  }
}
async function handleModal(i) {
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
async function handleSelect(i) {
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
module.exports = { handleCommand, handleButton, handleSelect, handleModal, finishGiveaway };
