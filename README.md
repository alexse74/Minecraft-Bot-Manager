
# Minecraft Bot Manager

Application Windows développée avec **Electron**, **Node.js** et **Mineflayer**, permettant de contrôler un bot Minecraft depuis une interface graphique.

## Fonctionnalités

- **Gestion des serveurs** : ajouter, modifier et supprimer des serveurs Minecraft.
- **Sauvegarde locale** : les serveurs enregistrés sont conservés entre les lancements.
- **Personnalisation** : choix du nom, de l'adresse, du port et du logo de chaque serveur.
- **Deux thèmes** : Défaut (inspiré de Minecraft) et Classique.
- **Connexion du bot** : choix du serveur et du pseudo Minecraft.
- **Position en temps réel** : coordonnées X, Y et Z.
- **Suivi des joueurs** : sélection d'un joueur visible et activation/désactivation du suivi.
- **Console intégrée** : affichage des logs et exécution de commandes.
- **Chat Minecraft** : envoi de messages publics.
- **Commandes privées** : contrôle du bot par un joueur autorisé.

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
| `pos` | Affiche les coordonnées du bot |
| `sauter` | Fait sauter le bot |
| `dire MESSAGE` | Envoie un message dans le chat public |
| `deconnecter` | Déconnecte le bot |

## Données locales

Les serveurs ajoutés dans l'application sont enregistrés localement dans les données utilisateur de Windows.

Aucune adresse IP de serveur personnel n'est incluse dans le code source.

Les données locales ne sont pas nécessaires pour installer ou lancer le projet depuis GitHub.

## À propos

Projet personnel développé par [alexse74](https://github.com/alexse74).

**Version : 1.0.0**
