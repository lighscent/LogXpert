# LogXpert v1.0.0 LTS

LogXpert est une bibliothèque de logs puissante pour Node.js qui offre des méthodes de log simples à utiliser avec une sortie colorée et, en option, l'enregistrement dans un fichier. Cette version est la version LTS (Long Term Support) avec une API stable et des options de configuration améliorées.

## Table des Matières
- [Installation](#installation)
- [Utilisation](#utilisation)
  - [Journalisation de base](#journalisation-de-base)
  - [Journalisation avancée : Fichiers de logs & Personnalisation de l'horodatage en console](#journalisation-avancee-fichiers-de-logs--personnalisation-de-lhorodatage-en-console)
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

### Journalisation avancée : Fichiers de logs & Personnalisation de l'horodatage en console

LogXpert supporte la journalisation dans des fichiers via [winston](https://github.com/winstonjs/winston) et [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file). Vous pouvez configurer l'enregistrement dans un fichier ainsi que personnaliser l'horodatage en console grâce à `log.settings()`.

Exemple de configuration :

```js
const log = require('logxpert');

log.settings({ 
    console: { 
        enableTimestamp: true,
        timestampFormat: 'YYYY-MM-DD HH:mm:ss',
        timestampPrefix: '[START] ',
        timestampSuffix: ' [END]'
    },
    files: { 
        folder: 'logs', 
        filesName: 'YYYY-MM-DD', 
        maxFile: '14d', 
        maxSize: '20m', 
        zippedArchive: false
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

- **log.settings(options: object):**  
  Configure les options d'enregistrement dans un fichier et de personnalisation de la sortie console.  
  **Options Console:**
  - `enableTimestamp` (boolean) : Active/désactive l'horodatage (par défaut : `true`).
  - `timestampFormat` (string) : Format de l'horodatage (par défaut : `'YYYY-MM-DD HH:mm:ss'`).
  - `timestampPrefix` (string) : Préfixe de l'horodatage.
  - `timestampSuffix` (string) : Suffixe de l'horodatage.
  
  **Options Fichiers:**
  - `folder` (string) : Répertoire où les fichiers de logs seront stockés (par défaut : `'logs'`).
  - `filesName` (string) : Motif de date pour le nom des fichiers de logs (par défaut : `'YYYY-MM-DD'`).
  - `maxFile` (string) : Durée maximale de rétention des fichiers (par défaut : `'14d'`).
  - `maxSize` (string) : Taille maximale par fichier de log (par défaut : `'20m'`).
  - `zippedArchive` (boolean) : Archive les logs au format zip (par défaut : `false`).

## Informations Supplémentaires

- [Version Anglaise](./README.md)
- [Notes de Version](./PATCHNOTE.fr.md)

## Licence

Ce projet est sous licence MIT.