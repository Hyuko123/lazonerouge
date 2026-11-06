const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const manageGuild = PermissionFlagsBits.ManageGuild;
const manageRoles = PermissionFlagsBits.ManageRoles;

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Affiche les commandes du bot'),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Publie le panneau de tickets').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('close-ticket').setDescription('Ferme le ticket actuel'),
  new SlashCommandBuilder().setName('rank-roles-panel').setDescription('Publie le panneau des rangs').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('profile-roles-panel').setDescription('Publie le panneau sexe et âge').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('notification-roles-panel').setDescription('Publie le panneau des notifications').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('publish-rules').setDescription('Publie le règlement configuré').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('announcement-panel').setDescription('Publie le panneau staff des annonces').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('Publie une annonce')
    .addStringOption(option => option.setName('title').setDescription('Titre').setRequired(true).setMaxLength(200))
    .addStringOption(option => option.setName('message').setDescription('Contenu').setRequired(true).setMaxLength(4000))
    .addBooleanOption(option => option.setName('mention_everyone').setDescription('Ping @everyone').setRequired(false))
    .setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder()
    .setName('riot-id')
    .setDescription('Enregistre ou modifie ton Riot ID')
    .addStringOption(option => option.setName('riot_id').setDescription('Exemple : Pseudo#TAG').setRequired(true).setMaxLength(80)),
  new SlashCommandBuilder()
    .setName('valorant')
    .setDescription('Affiche le Riot ID déclaré d’un membre')
    .addUserOption(option => option.setName('member').setDescription('Membre à consulter').setRequired(false)),
  new SlashCommandBuilder()
    .setName('giveaway-create')
    .setDescription('Crée un giveaway avec des conditions personnalisées')
    .addStringOption(option => option.setName('prize').setDescription('Lot à gagner').setRequired(true).setMaxLength(200))
    .addIntegerOption(option => option.setName('duration').setDescription('Durée numérique').setRequired(true).setMinValue(1).setMaxValue(525600))
    .addStringOption(option => option.setName('duration_unit').setDescription('Unité de durée').setRequired(true).addChoices(
      { name: 'Minutes', value: 'minutes' },
      { name: 'Hours', value: 'hours' },
      { name: 'Days', value: 'days' },
      { name: 'Weeks', value: 'weeks' },
      { name: 'Months (30 days)', value: 'months' }
    ))
    .addIntegerOption(option => option.setName('winners').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1).setMaxValue(20))
    .addRoleOption(option => option.setName('required_role').setDescription('Rôle/tag Discord requis pour participer').setRequired(false))
    .addBooleanOption(option => option.setName('require_server_tag').setDescription('Exiger que le tag de ce serveur soit équipé').setRequired(false))
    .addBooleanOption(option => option.setName('require_server_boost').setDescription('Exiger un boost actif de ce serveur').setRequired(false))
    .addIntegerOption(option => option.setName('min_account_age_days').setDescription('Âge minimum du compte Discord en jours').setRequired(false).setMinValue(0).setMaxValue(3650))
    .setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder()
    .setName('giveaway-end')
    .setDescription('Termine un giveaway')
    .addStringOption(option => option.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
    .setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder()
    .setName('giveaway-reroll')
    .setDescription('Relance le tirage d’un giveaway terminé')
    .addStringOption(option => option.setName('message_id').setDescription('ID du message du giveaway').setRequired(true))
    .setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre avec notification privée et durée définie')
    .addUserOption(option => option.setName('target').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Raison').setRequired(true).setMaxLength(500))
    .addStringOption(option => option.setName('duration').setDescription('Exemples : 30m, 12h, 7d ou permanent').setRequired(true).setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('ban-role')
    .setDescription('Masque les salons au membre via le rôle BANNED')
    .addUserOption(option => option.setName('member').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder()
    .setName('unban-role')
    .setDescription('Retire le rôle BANNED')
    .addUserOption(option => option.setName('member').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder()
    .setName('mute-role')
    .setDescription('Applique le rôle MUTE')
    .addUserOption(option => option.setName('member').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder()
    .setName('unmute-role')
    .setDescription('Retire le rôle MUTE')
    .addUserOption(option => option.setName('member').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre')
    .addUserOption(option => option.setName('member').setDescription('Membre').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Raison').setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime des messages récents')
    .addIntegerOption(option => option.setName('amount').setDescription('Nombre (1 à 100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('ghost-ping').setDescription('Envoie un ghost ping manuel').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('voice-panel').setDescription('Publie le panneau de gestion vocale').setDefaultMemberPermissions(manageGuild)
].map(command => command.toJSON());

module.exports = commands;
