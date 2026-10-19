const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes'),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Publie le panneau de tickets').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('ticket-close').setDescription('Ferme le ticket actuel'),
  new SlashCommandBuilder().setName('roles-panel').setDescription('Publie le menu de choix des rôles').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('rules').setDescription('Publie le règlement configuré').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('announce').setDescription('Publie une annonce').addStringOption(o=>o.setName('titre').setDescription('Titre').setRequired(true).setMaxLength(200)).addStringOption(o=>o.setName('message').setDescription('Contenu').setRequired(true).setMaxLength(4000)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('riotid').setDescription('Enregistre ou modifie ton Riot ID').addStringOption(o=>o.setName('riot_id').setDescription('Exemple : Pseudo#TAG').setRequired(true).setMaxLength(80)),
  new SlashCommandBuilder().setName('valorant').setDescription('Affiche le Riot ID déclaré d’un membre').addUserOption(o=>o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  new SlashCommandBuilder().setName('giveaway-create').setDescription('Crée un giveaway').addStringOption(o=>o.setName('prix').setDescription('Lot à gagner').setRequired(true).setMaxLength(200)).addIntegerOption(o=>o.setName('minutes').setDescription('Durée en minutes').setRequired(true).setMinValue(1).setMaxValue(10080)).addIntegerOption(o=>o.setName('gagnants').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1).setMaxValue(20)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('giveaway-end').setDescription('Termine un giveaway').addStringOption(o=>o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('giveaway-reroll').setDescription('Relance le tirage d’un giveaway terminé').addStringOption(o=>o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('ban-role').setDescription('Masque les salons au membre via le rôle BANNED').addUserOption(o=>o.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('unban-role').setDescription('Retire le rôle BANNED').addUserOption(o=>o.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('mute-role').setDescription('Applique le rôle MUTE').addUserOption(o=>o.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('unmute-role').setDescription('Retire le rôle MUTE').addUserOption(o=>o.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('kick').setDescription('Expulse un membre').addUserOption(o=>o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(500)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('clear').setDescription('Supprime des messages récents').addIntegerOption(o=>o.setName('nombre').setDescription('Nombre (1 à 100)').setRequired(true).setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(c=>c.toJSON());

module.exports = commands;
