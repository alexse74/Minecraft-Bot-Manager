
# Minecraft Bot Manager

Application Windows développée avec **Electron**, **Node.js** et **Mineflayer**, permettant de contrôler un bot Minecraft depuis une interface graphique.

**Version actuelle : 1.2.0**

## Nouveautés de la version 1.2.0

- Affichage du statut de chaque serveur enregistré : **Vérification…**, **En ligne** ou **Hors ligne ou inaccessible**.
- Nombre de joueurs connectés à côté du statut en ligne, lorsque le serveur fournit cette information.
- Vérification à l'affichage de la liste et bouton **Actualiser les statuts**, sans connecter le bot.
- Délai maximal de 5 secondes par vérification, jusqu'à quatre requêtes en parallèle par lot et prise en charge des enregistrements DNS SRV sur le port par défaut.
- Ajout du fichier `AGENTS.md` pour documenter les consignes de développement et les protections contre les régressions.

Une absence de réponse peut provenir du réseau ou d'un serveur qui bloque les requêtes de statut : elle ne prouve pas toujours que le serveur est arrêté. Le statut et le compteur ont été testés et validés par l'auteur sur son serveur.

## Nouveautés de la version 1.1.0

Cette version rassemble les ajouts et corrections depuis la version 1.0.0.

### Véhicules et suivi en bateau

- Ajout d'un bouton et des commandes `vehicule` / `véhicule` pour monter dans un bateau, un radeau ou un minecart visible à proximité, ou en descendre.
- Le bouton reflète les événements de montée et de descente confirmés par Minecraft et devient rouge lorsque le bot est à bord.
- Pendant le suivi, le bot rejoint le même bateau que le joueur suivi, identifié par son identifiant d'entité.
- La descente automatique repose sur le paquet serveur `set_passengers` : le bot descend lorsque le serveur confirme le retrait du joueur du bateau concerné. Une information absente ou un paquet concernant un autre bateau ne déclenche pas de descente.
- Reprise du suivi à pied après la descente et libération de la touche `sneak` après l'impulsion éventuelle de descente.
- Désactivation des actions manuelles de véhicule pendant le suivi et protections contre les tentatives de montée concurrentes ou devenues obsolètes.

### Reprise du suivi

- Lorsque le joueur devient invisible, le suivi reste en attente et reprend automatiquement quand son entité réapparaît.
- Recherche de l'entité actuelle à partir du pseudo toutes les secondes, avec une distance de suivi de 2 blocs.

### Autorisation des commandes privées

- Le joueur autorisé pour les `/msg` se choisit désormais dans l'interface, à la place d'un pseudo fixé dans le code.
- La sélection utilise tous les joueurs connus comme connectés, y compris ceux qui ne sont pas visibles à proximité.
- Aucun joueur n'est autorisé par défaut. Les messages des autres joueurs sont ignorés, et l'autorisation est retirée lorsque le joueur quitte le serveur ou que la session se termine.
- Les joueurs visibles restent dans une liste distincte destinée au suivi.

### Interface Windows

- Choix des thèmes déplacé dans le menu natif **Affichage > Thème > Défaut / Classique**, avec conservation du choix et synchronisation de la coche du menu.
- Fenêtre désormais redimensionnable : 1350 × 900 pixels au démarrage, minimum 1100 × 750.
- Ajout d'une icône personnalisée pour la fenêtre et l'installateur Windows.

## Fonctionnalités

- **Gestion des serveurs** : ajouter, modifier et supprimer des serveurs Minecraft.
- **Statut des serveurs** : disponibilité et nombre de joueurs connectés, avec actualisation manuelle.
- **Sauvegarde locale** : les serveurs enregistrés sont conservés entre les lancements.
- **Personnalisation** : choix du nom, de l'adresse, du port et du logo de chaque serveur.
- **Deux thèmes** : Défaut (inspiré de Minecraft) et Classique.
- **Connexion du bot** : choix du serveur et du pseudo Minecraft.
- **Position en temps réel** : coordonnées X, Y et Z.
- **Suivi des joueurs** : sélection d'un joueur visible et activation/désactivation du suivi.
- **Véhicules** : montée et descente manuelles, suivi automatique dans le bateau du joueur.
- **Console intégrée** : affichage des logs et exécution de commandes.
- **Chat Minecraft** : envoi de messages publics.
- **Commandes privées** : contrôle du bot par un joueur autorisé.

## Utilisation

1. Ajouter ou sélectionner un serveur, puis choisir le pseudo du bot.
2. Une fois connecté, sélectionner un joueur visible et cliquer sur **Suivre**.
3. Pour autoriser les commandes privées, choisir un joueur dans **Joueur autorisé pour les /msg**. Sélectionner **Aucun joueur autorisé** pour retirer l'autorisation.
4. Pour utiliser manuellement un véhicule, arrêter le suivi, puis utiliser le bouton véhicule.

La connexion utilise actuellement `auth: 'offline'` et la version Minecraft `26.3`. Le serveur doit être compatible avec cette configuration ; l'application ne propose pas d'authentification Microsoft.

Le suivi à travers les portails du Nether, l'anti-AFK et la gestion de plusieurs bots ne sont pas encore disponibles.

## Technologies utilisées

- JavaScript
- Node.js
- Electron
- [Mineflayer](https://github.com/PrismarineJS/mineflayer)
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)
- HTML / CSS

## Installation

### Prérequis

- Windows
- Node.js et npm
- Git (pour cloner le dépôt)

### Lancer depuis le code source

```bash
git clone https://github.com/alexse74/Minecraft-Bot-Manager.git
cd Minecraft-Bot-Manager
npm install
npm start
```

## Générer l'application Windows

Pour créer l'installateur `.exe` :

```bash
npm run build
```

L'installateur sera généré dans le dossier `dist/`.

## Commandes du bot

| Commande | Description |
|---|---|
| `aide` | Affiche les commandes disponibles |
| `suivre PSEUDO` | Suit un joueur visible |
| `arreter` | Arrête le suivi |
| `vehicule` / `véhicule` | Monte dans un véhicule ou en descend, hors suivi automatique |
| `pos` | Affiche les coordonnées du bot |
| `sauter` | Fait sauter le bot |
| `dire MESSAGE` | Envoie un message dans le chat public |
| `deconnecter` / `stop` | Déconnecte le bot |

## Données locales

Les serveurs ajoutés dans l'application sont enregistrés localement dans les données utilisateur de Windows.

Le fichier `servers.json` conserve les serveurs et `config.json` le dernier pseudo utilisé. Le thème est conservé dans le stockage local de l'interface. Ces données sont conservées au passage à la version 1.2.0, sans changement de format.

Aucune adresse IP de serveur personnel n'est incluse dans le code source.

Les données locales ne sont pas nécessaires pour installer ou lancer le projet depuis GitHub.

## À propos

Projet personnel développé par [alexse74](https://github.com/alexse74).

**Version : 1.2.0**
