# LogXpert

LogXpert est une bibliothèque de log puissante pour Node.js qui offre des méthodes de log simples à utiliser avec un affichage coloré et formaté.

## Installation

Installez LogXpert via npm :

```sh
npm install logxpert
```

## Utilisation

Importez LogXpert dans votre projet :

```js
const log = require('logxpert');

// Log global
log('Ceci est un message de log général.');

// Log d'erreur
log.error("Ceci est un message d'erreur.");

// Log d'avertissement
log.warn("Ceci est un message d'avertissement.");

// Log d'info
log.info("Ceci est un message d'information.");

// Log de debug
log.debug("Ceci est un message de debug.");
```

## Structure du Projet

- [main.js](c:\Users\x\Desktop\powerlogs\main.js) - Point d'entrée avec la fonctionnalité de log.
- [package.json](c:\Users\x\Desktop\powerlogs\package.json) - Configuration du package.

## Licence

Ce projet est sous licence MIT.