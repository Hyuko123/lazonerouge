# Bot Discord communautaire — Gaming / e-sport

Bot communautaire en **Node.js 20+ / Discord.js 14**, avec une identité visuelle bleu-violet et des commandes slash.

## Fonctionnalités

- Tickets privés avec menu de catégories, noms lisibles, prise en charge staff, ajout de membre, fermeture confirmée et transcription envoyée au propriétaire en MP.
- Accueil des nouveaux membres avec enregistrement du Riot ID et acceptation du règlement avant attribution du rôle membre.
- Journal public des arrivées avec l’invitant, le lien utilisé et le total de membres invités.
- Rôle automatique et message de bienvenue.
- Panneau de rôles par réactions : une réaction ajoute le rôle associé, la retirer enlève le rôle.
- Rôle `BANNED` (masquage des salons via les permissions à configurer).
- Rôle `MUTE` et commandes de modération.
- `/aide` : récapitulatif des commandes.
- `/riot-id` et `/valorant` : Riot ID déclaré par le membre, avatar Discord et profil.
- `/crosshair` : partage le code d’import VALORANT avec un aperçu PNG généré à partir de ses réglages.
- Concours enregistrés en SQLite, avec inscriptions uniques et clôture atomique pour éviter les doubles tirages.
- Publication du règlement préconfiguré.
- Annonces publiées depuis un panneau staff et formatées automatiquement.
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
   npm start
   ```

Au démarrage, le bot enregistre automatiquement les commandes slash dans le serveur indiqué par `GUILD_ID`. Pour un déploiement global, retire `GUILD_ID` ; les commandes globales peuvent prendre un certain temps à apparaître. `npm run deploy` permet aussi de les publier manuellement.

## Déploiement cloud avec Render

Le dépôt contient `render.yaml` pour créer un **Background Worker**. C'est un bot qui reste connecté à Discord sans serveur web.

1. Pousse le dossier sur GitHub.
2. Dans Render, choisis **New + → Blueprint** et sélectionne ton dépôt.
3. Ajoute les variables d'environnement demandées :
   - `DISCORD_TOKEN` : token secret du bot.
   - `CLIENT_ID` : ID de l'application Discord.
   - `GUILD_ID` : ID du serveur (utile pour déployer rapidement les commandes).
    - `CONFIG_JSON` : contenu JSON complet de `config.json`, avec les IDs `onboardingChannelId`, `memberRoleId`, `pendingRoleId`, `announcementPanelChannelId` et `announcementStaffRoleId`.
4. Lance le déploiement.
5. Le démarrage du worker enregistre automatiquement les commandes du serveur indiqué par `GUILD_ID`.

**Stockage :** SQLite écrit dans `data/bot.sqlite`. Sur un service cloud sans disque persistant, la base peut être perdue lors d'un redéploiement. Pour garder les Riot ID et les giveaways entre déploiements, attache un disque persistant Render au chemin `/opt/render/project/src/data` (vérifie le chemin de travail du service) ou remplace SQLite par une base PostgreSQL persistante. Ne déploie pas en production avant d'avoir configuré le stockage persistant.

## Discord Developer Portal

- Scopes OAuth2 : `bot` et `applications.commands`.
- Active **Server Members Intent** pour le rôle automatique et le message de bienvenue.
- Accorde au bot **Manage Server** pour qu’il puisse lire les compteurs des invitations ; active également l’intent **Guild Invites** si le portail le propose.
- Place le rôle du bot au-dessus des rôles qu'il doit attribuer ou retirer.
- Accorde uniquement les permissions nécessaires : bannir des membres, gérer les rôles, gérer les salons, ajouter des réactions, envoyer des messages, intégrer des liens, lire l'historique, expulser si nécessaire.
- Les commandes slash n'ont pas besoin de l'intent Message Content.

## Configuration des permissions

### Rôle `BANNED`
Crée un rôle `BANNED`, puis refuse-lui `View Channel` sur les catégories/salons ordinaires. Autorise explicitement un salon de recours si tu le souhaites. Vérifie toutes les permissions des catégories et salons privés : une autorisation donnée à un autre rôle peut rendre un salon visible.

### Rôle `MUTE`
Crée un rôle `MUTE` et configure les salons textuels pour refuser `Send Messages`, `Add Reactions` et les permissions d'envoi associées. Pour les salons vocaux, refuse `Speak` et `Connect`. Répète la configuration pour les catégories et salons futurs. Le bot attribue le rôle, mais ne peut pas corriger automatiquement toutes les permissions existantes.

### Bannissements
La commande `/ban` demande un joueur, une raison et une durée (`30m`, `12h`, `7j`, ou `permanent`). Un message privé récapitule la décision et l’échéance. Les durées temporaires sont enregistrées en SQLite et le débannissement est exécuté automatiquement, même après un redémarrage du bot. Le bot doit avoir `Ban Members`.

### Concours
`/concours-creer` accepte une durée en minutes, heures, jours ou semaines. La durée maximale est de 365 jours (52 semaines). Le nombre de participants est affiché sur le message du concours et mis à jour à chaque nouvelle inscription.

### Tickets
Configure `ticketCategoryId`, `ticketStaffRoleId` et `ticketPanelChannelId`. Le panneau propose l'aide, les signalements, les partenariats et les autres demandes. Dans chaque ticket, l'auteur et le staff peuvent ajouter un membre, demander une transcription des 100 derniers messages (envoyée en MP au propriétaire) ou fermer le ticket ; seul le staff peut prendre en charge le ticket. Le membre, le bot et le rôle staff doivent avoir les accès nécessaires.

### Accueil et règlement
Configure `onboardingChannelId` pour publier le panneau d'arrivée. `memberRoleId` est le rôle donné après l'enregistrement du Riot ID et l'acceptation du règlement. `pendingRoleId` est facultatif et peut servir à limiter les accès avant validation. Configure les permissions des salons pour que le rôle en attente ne voie que l'accueil et que le rôle membre ait accès au serveur. Le rôle du bot doit être au-dessus de ces rôles. Le règlement vient de la liste `rules`.

### Invitations
Configure `inviteLogChannelId` pour choisir le salon public du journal. Si ce champ est vide, le bot utilise `welcomeChannelId`. Le journal comptabilise chaque membre une fois et indique le lien et son créateur lorsque le compteur permet de les identifier. Si plusieurs compteurs changent en même temps, si le lien est une vanity URL ou si le bot ne peut pas lire les invitations, l’invitant est marqué comme indéterminé plutôt que deviné.

### Crosshairs
Configure `crosshairChannelId` pour le salon où les membres peuvent publier leur viseur. `/crosshair` accepte un code d’import VALORANT, l’affiche pour pouvoir le copier et joint un aperçu PNG généré depuis les réglages reconnus. Cet aperçu reste indicatif pour les paramètres avancés.

### Annonces
Configure `announcementPanelChannelId` pour le panneau staff, `announcementChannelId` pour la destination des annonces et `announcementStaffRoleId` pour autoriser l’usage du bouton. La publication du panneau lui-même reste réservée aux membres ayant `ManageGuild`.
- `/role-bannir`
- `/role-debannir`
- `/role-muter`
- `/role-demuter`
- `/expulser`
- `/nettoyer`

## GitHub et sécurité

- `.env` et `data/` sont exclus de Git via `.gitignore`.
- Ne publie jamais ton token Discord ou une clé API. Si un token est exposé, régénère-le immédiatement.
- `config.json` ne doit contenir que des IDs et des réglages non secrets. Sur Render, préfère la variable `CONFIG_JSON`.
- Teste les permissions, les tickets et les commandes de modération sur un serveur de test avant le serveur principal.
