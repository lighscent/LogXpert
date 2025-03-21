# Notes de Version

## v1.0.3

- **Correction de la désactivation de l'horodatage :** Correction du problème où, malgré `enableTimestamp: false`, l'horodatage était toujours affiché. L'horodatage est désormais complètement désactivé en console lorsque requis.
- **Correction de l'horodatage personnalisé avec décoration :** Résolution des problèmes de formatage lors de l'utilisation de formats d'horodatage personnalisés avec des caractères décoratifs (par exemple, des crochets). Des formats comme `"Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - "` s'affichent correctement.
- Toutes les améliorations et fonctionnalités précédentes de la v1.0.2 LTS restent intactes.

## v1.0.2

- **Préservation de la Décoration dans l'Horodatage Personnalisé :** Ajout d'une fonction d'assistance dans le module de log qui permet de conserver les caractères de décoration (tels que [], (), {}) dans le `timestampFormat` tel que défini par l'utilisateur. Cette amélioration permet d'utiliser des formats comme `"Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - "` ou `"date: YYYY-MM-DD heure: HH:mm:ss - "` sans que Moment.js n'échappe automatiquement les crochets.
- **Autres Améliorations et Corrections de Bugs :** Toutes les améliorations et fonctionnalités précédentes de la v1.0.1 LTS restent intactes.


## v1.0.1

- Amélioration de la prise en charge des formats d'horodatage personnalisés en console via Moment.js. Les utilisateurs peuvent désormais fournir des formats entièrement personnalisés (ex. : "Voici la date et l'heure: [YYYY-MM-DD HH:mm:ss] - " ou "date: YYYY-MM-DD heure: HH:mm:ss - ") qui rendent correctement les dates dynamiques et le texte littéral.

## v1.0.0

- **Stabilité & Support:** Cette version est désormais la version LTS, offrant une API stable pour une utilisation en production sur le long terme.
- **Configuration Améliorée:** Ajout d'options avancées pour personnaliser l'horodatage en console, incluant le format, le préfixe et le suffixe personnalisables.
- **Amélioration de la Journalisation dans les Fichiers:** Mise à jour des réglages pour l'enregistrement dans les fichiers et création automatique du dossier de logs s'il n'existe pas.
- **Documentation:** Mise à jour du README et de la référence API pour plus de clarté et de complétude.
- **Compatibilité Rétroactive:** Conservation de toutes les fonctionnalités des versions précédentes, incluant les méthodes pour la journalisation générale, d'erreur, d'avertissement, d'information et de débogage.

### v0.3.2
- Modification du motif par défaut de `filesName` passant de `'YYYY-MM-DD_HH:mm:ss'` à `'YYYY-MM-DD'`.

### v0.3.1
- Ajout de la création automatique du dossier de logs s'il n'existe pas afin d'éviter l'erreur `ENOENT`.

### v0.3.0
- Ajout du support de l'enregistrement dans des fichiers via winston et winston-daily-rotate-file.
- Introduction de la méthode `log.settings()` pour configurer l'enregistrement dans les fichiers.
- Mise à jour des options de configuration pour utiliser `filesName` à la place de l'ancienne propriété.