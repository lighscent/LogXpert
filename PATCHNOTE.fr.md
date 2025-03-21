# Notes de Version

## v1.0.0 LTS

- **Stabilité & Support:** Cette version est désormais la version LTS, offrant une API stable pour une utilisation en production sur le long terme.
- **Configuration Améliorée:** Ajout d'options avancées pour personnaliser l'horodatage en console, incluant le format, le préfixe et le suffixe personnalisables.
- **Amélioration de la Journalisation dans les Fichiers:** Mise à jour des réglages pour l'enregistrement dans les fichiers et création automatique du dossier de logs s'il n'existe pas.
- **Documentation:** Mise à jour du README et de la référence API pour plus de clarté et de complétude.
- **Compatibilité Rétroactive:** Conservation de toutes les fonctionnalités des versions précédentes, incluant les méthodes pour la journalisation générale, d'erreur, d'avertissement, d'information et de débogage.

## Versions Précédentes

### v0.3.2
- Modification du motif par défaut de `filesName` passant de `'YYYY-MM-DD_HH:mm:ss'` à `'YYYY-MM-DD'`.

### v0.3.1
- Ajout de la création automatique du dossier de logs s'il n'existe pas afin d'éviter l'erreur `ENOENT`.

### v0.3.0
- Ajout du support de l'enregistrement dans des fichiers via winston et winston-daily-rotate-file.
- Introduction de la méthode `log.settings()` pour configurer l'enregistrement dans les fichiers.
- Mise à jour des options de configuration pour utiliser `filesName` à la place de l'ancienne propriété.