const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const manageGuild = PermissionFlagsBits.ManageGuild;
const manageRoles = PermissionFlagsBits.ManageRoles;

const commands = [
  new SlashCommandBuilder().setName('aide').setDescription('Affiche les commandes du bot'),
  new SlashCommandBuilder().setName('panneau-tickets').setDescription('Publie le panneau de tickets').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('fermer-ticket').setDescription('Ferme le ticket actuel'),
  new SlashCommandBuilder().setName('panneau-roles-rang').setDescription('Publie le panneau des rangs').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('panneau-roles-profil').setDescription('Publie le panneau sexe et âge').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('panneau-roles-notifications').setDescription('Publie le panneau des notifications').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('publier-reglement').setDescription('Publie le règlement configuré').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('panneau-annonces').setDescription('Publie le panneau staff des annonces').setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('annonce').setDescription('Publie une annonce').addStringOption(option => option.setName('titre').setDescription('Titre').setRequired(true).setMaxLength(200)).addStringOption(option => option.setName('message').setDescription('Contenu').setRequired(true).setMaxLength(4000)).setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('riot-id').setDescription('Enregistre ou modifie ton Riot ID').addStringOption(option => option.setName('riot_id').setDescription('Exemple : Pseudo#TAG').setRequired(true).setMaxLength(80)),
  new SlashCommandBuilder().setName('valorant').setDescription('Affiche le Riot ID déclaré d\'un membre').addUserOption(option => option.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  new SlashCommandBuilder().setName('concours-creer').setDescription('Crée un concours').addStringOption(option => option.setName('prix').setDescription('Lot à gagner').setRequired(true).setMaxLength(200)).addIntegerOption(option => option.setName('duree').setDescription('Durée du concours').setRequired(true).setMinValue(1).setMaxValue(525600)).addStringOption(option => option.setName('unite').setDescription('Unité de la durée').setRequired(true).addChoices({ name: 'Minutes', value: 'minutes' }, { name: 'Heures', value: 'heures' }, { name: 'Jours', value: 'jours' }, { name: 'Semaines', value: 'semaines' })).addIntegerOption(option => option.setName('gagnants').setDescription('Nombre de gagnants').setRequired(true).setMinValue(1).setMaxValue(20)).setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('concours-terminer').setDescription('Termine un concours').addStringOption(option => option.setName('message_id').setDescription('ID du message du concours').setRequired(true)).setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('concours-relancer').setDescription('Relance le tirage d’un concours terminé').addStringOption(option => option.setName('message_id').setDescription('ID du message du concours').setRequired(true)).setDefaultMemberPermissions(manageGuild),
  new SlashCommandBuilder().setName('ban').setDescription('Bannit un membre avec notification privée et durée définie').addUserOption(option => option.setName('joueur').setDescription('Joueur à bannir').setRequired(true)).addStringOption(option => option.setName('raison').setDescription('Raison du bannissement').setRequired(true).setMaxLength(500)).addStringOption(option => option.setName('duree').setDescription('Exemples : 30m, 12h, 7j ou permanent').setRequired(true).setMaxLength(32)).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('role-bannir').setDescription('Masque les salons au membre via le rôle BANNED').addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder().setName('role-debannir').setDescription('Retire le rôle BANNED').addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder().setName('role-muter').setDescription('Applique le rôle MUTE').addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder().setName('role-demuter').setDescription('Retire le rôle MUTE').addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true)).setDefaultMemberPermissions(manageRoles),
  new SlashCommandBuilder().setName('expulser').setDescription('Expulse un membre').addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(option => option.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(500)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('nettoyer').setDescription('Supprime des messages récents').addIntegerOption(option => option.setName('nombre').setDescription('Nombre (1 à 100)').setRequired(true).setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

module.exports = commands;