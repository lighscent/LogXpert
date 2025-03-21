# Notes de Version

## v0.3.2

- Modification du motif par défaut de `filesName` passant de `'YYYY-MM-DD_HH:mm:ss'` à `'YYYY-MM-DD'` afin que le nom des fichiers de logs n'inclue pas les heures, minutes ou secondes.

## v0.3.1

- Ajout de la création automatique du dossier de logs s'il n'existe pas afin d'éviter l'erreur `ENOENT`.

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