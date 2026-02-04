# 🎲 PerudoBot

Un bot Discord stylé pour jouer au Perudo (Liar's Dice) avec vos amis.

## ✨ Fonctionnalités
- **Annonces publiques** : Les enchères et actions sont visibles par tous.
- **Dés secrets** : Envoyés en MP à chaque joueur.
- **Dudo & Palifico** : Règles complètes implémentées.
- **Interface visuelle** : Embeds colorés, emojis, et boutons interactifs.
- **Tour par tour fluide** : Validation automatique des règles.

## 🚀 Installation

1. **Prérequis** : Node.js v16+ installé.
2. **Configuration** :
   - Renommez `.env.example` en `.env` (ou créez-le).
   - Ajoutez votre Token Discord et votre Client ID :
     ```env
     DISCORD_TOKEN=votre_token_ici
     CLIENT_ID=votre_client_id_ici
     ```
3. **Installation des dépendances** :
   ```bash
   npm install
   ```
4. **Enregistrement des commandes** (à faire une fois ou après mise à jour des commandes) :
   ```bash
   node deploy-commands.js
   ```
5. **Lancement du bot** :
   ```bash
   node index.js
   ```

## 🎮 Comment jouer ?

1. **Créer une partie** : `/perudo create`
2. **Rejoindre** : `/perudo join`
3. **Lancer** : `/perudo start` (l'hôte lance la partie quand tout le monde est prêt)
4. **Miser** : Utilisez le bouton **Miser** ou `/perudo mise <quantité> <valeur>`
5. **Dudo** : Utilisez le bouton **Dudo !** ou `/perudo dudo`

Bon jeu ! 🎲
