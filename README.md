# Bot Discord communautaire — Gaming / e-sport

Bot communautaire en **Node.js 20+ / Discord.js 14**, avec une identité visuelle bleu-violet et des commandes slash.

## Fonctionnalités

- Tickets privés avec bouton d'ouverture et de fermeture.
- Rôle automatique et message de bienvenue.
- Menu de choix de rôles.
- Rôle `BANNED` (masquage des salons via les permissions à configurer).
- Rôle `MUTE` et commandes de modération.
- `/help` : récapitulatif des commandes.
- `/riotid` et `/valorant` : Riot ID déclaré par le membre, avatar Discord et profil.
- Giveaways enregistrés en SQLite, avec tirage à la fin.
- Publication du règlement préconfiguré.
- Annonces staff.
- Logs simples de modération.

> Le profil Valorant affiche le Riot ID que le membre a lui-même déclaré. Il ne vérifie pas l'identité auprès de Riot Games et ne récupère pas de statistiques.

## Prérequis

- Node.js 20 ou supérieur.
- Une application créée dans le [Discord Developer Portal](https://discord.com/developers/applications).
- Le token du bot, l'ID de l'application et l'ID du serveur pour un déploiement de commandes rapide.

## Installation locale

1. Copie `.env.example` vers `.env`.
2. Renseigne `DISCORD_TOKEN`, `CLIENT_ID` et `GUILD_ID`.
3. Modifie `config.json` avec les IDs de tes salons et rôles Discord.
4. Installe et lance :
   ```bash
   npm install
   npm run deploy
   npm start
   ```

Pour un déploiement global des commandes, retire `GUILD_ID` du fichier `.env` ; les commandes globales peuvent prendre un certain temps à apparaître.

## Déploiement cloud avec Render

Le dépôt contient `render.yaml` pour créer un **Background Worker**. C'est un bot qui reste connecté à Discord sans serveur web.

1. Pousse le dossier sur GitHub.
2. Dans Render, choisis **New + → Blueprint** et sélectionne ton dépôt.
3. Ajoute les variables d'environnement demandées :
   - `DISCORD_TOKEN` : token secret du bot.
   - `CLIENT_ID` : ID de l'application Discord.
   - `GUILD_ID` : ID du serveur (utile pour déployer rapidement les commandes).
   - `CONFIG_JSON` : contenu JSON complet de `config.json`, collé comme valeur de variable.
4. Lance le déploiement.
5. Pour enregistrer les commandes, exécute `npm run deploy` une fois depuis un terminal local avec le même `.env`, ou ajoute une étape de déploiement de commandes à ton processus de publication.

**Stockage :** SQLite écrit dans `data/bot.sqlite`. Sur un service cloud sans disque persistant, la base peut être perdue lors d'un redéploiement. Pour garder les Riot ID et les giveaways entre déploiements, attache un disque persistant Render au chemin `/opt/render/project/src/data` (vérifie le chemin de travail du service) ou remplace SQLite par une base PostgreSQL persistante. Ne déploie pas en production avant d'avoir configuré le stockage persistant.

## Discord Developer Portal

- Scopes OAuth2 : `bot` et `applications.commands`.
- Active **Server Members Intent** pour le rôle automatique et le message de bienvenue.
- Place le rôle du bot au-dessus des rôles qu'il doit attribuer ou retirer.
- Accorde uniquement les permissions nécessaires : gérer les rôles, gérer les salons, envoyer des messages, intégrer des liens, lire l'historique, expulser si nécessaire.
- Les commandes slash n'ont pas besoin de l'intent Message Content.

## Configuration des permissions

### Rôle `BANNED`
Crée un rôle `BANNED`, puis refuse-lui `View Channel` sur les catégories/salons ordinaires. Autorise explicitement un salon de recours si tu le souhaites. Vérifie toutes les permissions des catégories et salons privés : une autorisation donnée à un autre rôle peut rendre un salon visible.

### Rôle `MUTE`
Crée un rôle `MUTE` et configure les salons textuels pour refuser `Send Messages`, `Add Reactions` et les permissions d'envoi associées. Pour les salons vocaux, refuse `Speak` et `Connect`. Répète la configuration pour les catégories et salons futurs. Le bot attribue le rôle, mais ne peut pas corriger automatiquement toutes les permissions existantes.

### Tickets
Configure `ticketCategoryId`, `ticketStaffRoleId` et `ticketPanelChannelId`. Le membre, le bot et le rôle staff doivent avoir les accès nécessaires.

## Commandes

- `/help`
- `/ticket-panel`
- `/ticket-close`
- `/roles-panel`
- `/rules`
- `/announce`
- `/riotid`
- `/valorant`
- `/giveaway-create`
- `/giveaway-end`
- `/giveaway-reroll`
- `/ban-role`
- `/unban-role`
- `/mute-role`
- `/unmute-role`
- `/kick`
- `/clear`

## GitHub et sécurité

- `.env` et `data/` sont exclus de Git via `.gitignore`.
- Ne publie jamais ton token Discord ou une clé API. Si un token est exposé, régénère-le immédiatement.
- `config.json` ne doit contenir que des IDs et des réglages non secrets. Sur Render, préfère la variable `CONFIG_JSON`.
- Teste les permissions, les tickets et les commandes de modération sur un serveur de test avant le serveur principal.
