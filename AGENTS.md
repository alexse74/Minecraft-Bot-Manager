# Minecraft Bot Manager — consignes Codex

## Règles de travail
- Toujours répondre en français, clairement et simplement.
- Les fichiers locaux sont la référence, même s'ils diffèrent de GitHub. Lire le code concerné et examiner les changements existants avant toute modification ; ne pas écraser le travail en cours.
- Préférer des changements ciblés. Préserver les fonctionnalités, l'apparence et les données existantes ; éviter les réécritures et dépendances inutiles.
- Sans demande explicite : ne pas installer de dépendances, changer l'authentification ou la version Minecraft, effectuer d'action destructive, créer de commit/tag, pousser sur GitHub ou publier une release.
- Ne pas supprimer les sauvegardes ni changer leur format sans migration compatible. Ne pas modifier les versions des dépendances sans raison vérifiée.
- Après une modification, indiquer les fichiers concernés, le comportement changé, les vérifications réalisées et les étapes de test manuel. Ne jamais présenter une simulation comme un test en jeu.

## Architecture
- Application Windows Electron, JavaScript CommonJS. Vérifier la version actuelle et les scripts dans `package.json`.
- `main.js` : fenêtre, menu natif, sauvegardes, IPC et instance unique de `BotManager`.
- `bot.js` : `BotManager` / `EventEmitter`, Mineflayer, commandes, suivi, véhicules, autorisations et nettoyage.
- `preload.js` : API `window.minecraftBot` via `contextBridge`. Conserver `contextIsolation: true` et `nodeIntegration: false`.
- `renderer.js`, `index.html`, `style.css` : écrans serveurs, édition, pseudo et contrôle du bot ; deux thèmes.
- `server-status.js` : requêtes de statut via le protocole déjà fourni par Mineflayer, sans connexion de joueur.
- Chaîne d'une fonctionnalité interactive : interface → preload → IPC/main → logique métier, puis événements en sens inverse. Vérifier tous les niveaux concernés et l'inclusion des nouveaux modules dans `build.files`.
- Sauvegardes dans `app.getPath('userData')` : `servers.json` et `config.json` (dernier pseudo). Thème dans `localStorage` (`app-theme`), synchronisé avec le menu Affichage > Thème.

## Fonctionnalités présentes
- Ajout, modification et suppression confirmée des serveurs avec nom, adresse, port et icône ; dernier pseudo conservé, validation UI `[a-zA-Z0-9_]{1,16}`.
- Statut des serveurs à l'ouverture de la liste et par bouton d'actualisation : vérification, en ligne avec nombre de joueurs si fourni, hors ligne ou inaccessible. Délai de 5 s, jusqu'à quatre requêtes par lot ; ignorer les réponses d'un ancien rendu. Une absence de réponse ne prouve pas que le serveur est arrêté.
- Connexion avec `auth: 'offline'`, `version: '26.3'` ; états connecting/connected/disconnected/error, logs, exclusions et tentative d'acceptation des packs de ressources.
- Coordonnées toutes les 500 ms, listes de joueurs et suivi toutes les secondes, console réinitialisée à chaque connexion, formulaire séparé d'envoi au chat public.
- Commandes à conserver : `aide`, `suivre PSEUDO`, `arreter`, `vehicule`/`véhicule`, `pos`, `sauter`, `dire MESSAGE`, `deconnecter`/`stop`.
- Deux listes distinctes : joueurs visibles pour suivre ; tous les joueurs connus connectés pour choisir l'unique joueur autorisé aux `/msg`.
- Fenêtre redimensionnable 1350 × 900, minimum 1100 × 750 ; thèmes Défaut/Classique et icône `assets/icon.ico`.
- Non implémentés : suivi à travers les portails du Nether, anti-AFK, multibot. Ne pas les commencer sans demande.

## Zones critiques et régressions à éviter
- **Suivi** : retrouver l'entité actuelle par `targetName` dans `updateFollowing()`. À sa disparition, arrêter l'ancien objectif sans désactiver le suivi ; reprendre avec la nouvelle entité. Ne pas conserver seulement une référence devenue obsolète. `GoalFollow` utilise 2 blocs ; préserver les réglages de déplacement et `canDig = false` (ne pas détruire de blocs).
- **Bateaux — comportement validé en jeu par l'utilisateur** : conserver le paquet serveur `set_passengers`, `boatPassengers`, `handlePassengerUpdate()` et `findFollowedPlayerBoat()` comme source de vérité. Monter uniquement dans le bateau identifié du joueur suivi, jamais un autre bateau proche.
- La descente automatique exige le retrait explicite du joueur de la liste des passagers du bateau confirmé (`confirmedFollowBoatId`), et le bot doit être à bord du même bateau monté automatiquement (`autoBoardedVehicleId`). Une information absente, une entité déchargée ou un paquet pour un autre bateau ne prouvent pas une descente. Ne pas remplacer cette logique par la distance, les positions ou `entityDetach` : anciennes causes de descentes intempestives et de boucles montée/descente.
- L'état du bouton véhicule provient de `mount`/`dismount`, pas du clic. Préserver `dismount()` et la libération systématique de `sneak` après son éventuelle impulsion courte.
- Pendant le suivi, désactiver le bouton véhicule ET refuser les commandes manuelles dans le backend. Préserver `vehicleOperation`, `vehicleAttemptActive`, `autoVehicleRetryAt`, `autoVehiclePaused` et les contrôles d'identité de session après les opérations asynchrones.
- Les `/msg` n'exécutent une commande que si `authorizedPlayer` est explicitement défini et correspond sans tenir compte de la casse. Retirer l'autorisation au départ du joueur et au nettoyage de session.
- L'interface déduit actuellement l'état du suivi de certains textes de logs dans `onLog` : changer ces messages peut casser les boutons. Préserver aussi la synchronisation des thèmes et la séparation des listes de joueurs.
- Déconnexion/nettoyage : arrêter les intervalles, annuler les opérations obsolètes, réinitialiser suivi, passagers, véhicule et autorisation ; éviter qu'un délai d'une ancienne session agisse sur une nouvelle connexion ou laisse une touche active.

## Vérifications
- Syntaxe : `node --check` sur chaque fichier JavaScript modifié. Vérifier imports/exports, IPC et identifiants HTML concernés.
- Aucun script de test automatisé n'est actuellement déclaré. Ajouter des simulations ciblées quand elles vérifient un comportement utile ; les tests réels sur serveur Minecraft sont effectués par l'utilisateur.
- `npm.cmd start` lance Electron ; `npm.cmd run build` génère l'installateur Windows NSIS dans `dist/`. Ne pas les lancer pour une simple lecture du projet. Sous PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué.
- Pour une évolution du suivi/véhicule, faire tester : disparition/réapparition du joueur, plusieurs bateaux proches, maintien à bord, descente réelle même près du bateau, reprise à pied, absence de sneak bloqué, refus du contrôle manuel et déconnexion pendant une opération.
