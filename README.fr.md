# LogXpert

LogXpert est une bibliothèque de logs puissante pour Node.js qui offre des méthodes de log simples à utiliser avec une sortie colorée et, en option, l'enregistrement dans un fichier. Cette documentation explique l'installation et l'utilisation du module.

## Table des Matières
- [Installation](#installation)
- [Utilisation](#utilisation)
  - [Journalisation de base](#journalisation-de-base)
  - [Journalisation avancée : Fichiers de logs](#journalisation-avancee-fichiers-de-logs)
- [Référence API](#référence-api)
- [Informations Supplémentaires](#informations-supplémentaires)
- [Licence](#licence)

## Installation

Installez LogXpert via npm :

```sh
npm install logxpert
```

## Utilisation

### Journalisation de base

Importez LogXpert dans votre projet et utilisez-le pour enregistrer des messages :

```js
const log = require('logxpert');

// Journalisation d'un message général
log('Ceci est un message de log général.');

// Journalisation d'un message d'erreur
log.error("Ceci est un message d'erreur.");

// Journalisation d'un message d'avertissement
log.warn("Ceci est un message d'avertissement.");

// Journalisation d'un message d'information
log.info("Ceci est un message d'information.");

// Journalisation d'un message de debug
log.debug("Ceci est un message de debug.");
```

### Journalisation avancée : Fichiers de logs

LogXpert supporte l'enregistrement des logs dans des fichiers à l'aide de [winston](https://github.com/winstonjs/winston) et [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file). Pour activer l'enregistrement dans un fichier, configurez les paramètres via la méthode `log.settings()`. Si non configuré, seule la journalisation dans la console est active.

Exemple de configuration pour activer l'enregistrement dans un fichier :

```js
const log = require('logxpert');

log.settings({ 
    files: { 
        folder: 'logs', 
        filesName: 'YYYY-MM-DD_HH:mm:ss', 
        maxFile: '14d', 
        maxSize: '20m', 
        zippedArchive: true 
    }
});
```

## Référence API

- **log(message: string):**  
  Enregistre un message général avec le niveau `info`.

- **log.error(message: string):**  
  Enregistre un message d'erreur.

- **log.warn(message: string):**  
  Enregistre un message d'avertissement.

- **log.info(message: string):**  
  Enregistre un message d'information.

- **log.debug(message: string):**  
  Enregistre un message de debug.

- **log.settings(options: Object):**  
  Configure les options d'enregistrement des logs dans un fichier. L'objet doit contenir la propriété `files` avec les options suivantes :

  - `folder` (string) : Répertoire où les fichiers de logs seront stockés (par défaut : `'logs'`).
  - `filesName` (string) : Motif de date utilisé dans le nom des fichiers de log (par défaut : `'YYYY-MM-DD_HH:mm:ss'`).
  - `maxFile` (string) : Durée de rétention maximale des fichiers (par défaut : `'14d'`).
  - `maxSize` (string) : Taille maximale par fichier de log (par défaut : `'20m'`).
  - `zippedArchive` (boolean) : Archive les logs au format zip (par défaut : `false`).

## Informations Supplémentaires

- [Version Anglaise](./README.md)
- [Notes de Version](./PATCHNOTE.fr.md)

## Licence

Ce projet est sous licence MIT.