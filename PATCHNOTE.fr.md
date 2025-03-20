# Notes de Version

## v0.3.0

- Ajout du support de l'enregistrement dans des fichiers via [winston](https://github.com/winstonjs/winston) et [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file).
- Introduction de la méthode `log.settings()` pour configurer l'enregistrement dans les fichiers.
- Mise à jour des options de configuration pour utiliser `filesName` à la place de l'ancienne propriété.
- Réglages par défaut :
  - Dossier : `logs`
  - Motif de date (`filesName`) : `YYYY-MM-DD_HH:mm:ss`
  - Rétention maximale des fichiers : `14d`
  - Taille maximale par fichier : `20m`
  - `zippedArchive` : par défaut `false` à moins qu'une autre valeur soit fournie.
- La journalisation dans la console conserve une sortie colorée et formatée.