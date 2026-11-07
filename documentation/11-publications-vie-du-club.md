# 11 — Une publication, un seul endroit à mettre à jour

Le travail courant se fait dans **Strapi → Content Manager → Publication**.
Une information, un rendez-vous et un compte rendu avec photos utilisent la même
fiche. Il n’y a plus d’album à créer séparément pour raconter une sortie.

## Publier une information ou des photos

1. Créer une **Publication** et saisir son **Titre**.
2. Ajouter le **Texte**, si nécessaire.
3. Ajouter éventuellement des **Photos** et des **Documents joints** dans la médiathèque.
4. Enregistrer puis **Publier**.

La publication apparaît dans [La vie du club](http://localhost:3000/vie-du-club).
Les dernières publications apparaissent aussi sur l’accueil automatiquement.
La première photo sert de couverture. Son ordre est modifiable dans le sélecteur.
Une publication sans photo affiche simplement son texte ; aucun visuel n’est requis.
Plusieurs photos constituent une galerie avec visionneuse et téléchargement de l’original.

La date de publication et l’adresse de la page sont générées automatiquement.
L’adresse reste stable lorsqu’on change le titre. Il n’y a pas de résumé à
rédiger séparément : l’aperçu est extrait du texte. **Thème** et **Autre photo de
couverture** sont facultatifs.

## Ajouter un rendez-vous à l’agenda

Dans la même fiche, ajouter le bloc facultatif **Rendez-vous dans l’agenda**.
Ce bloc est l’option d’ajout à l’agenda : aucune seconde fiche n’est créée.

- Renseigner le **Début du rendez-vous** et éventuellement la **Fin** et le **Lieu**.
- Cocher **Toute la journée** si les heures ne sont pas utiles. Pour plusieurs journées, la fin désigne le dernier jour inclus.
- Si besoin, ajouter un **Lien pour participer** : HelloAsso, Framadate ou autre service, avec une clôture facultative.
- L’**État du rendez-vous** peut être prévu, complet, annulé ou reporté.

Après publication, la même fiche est visible dans le fil et l’agenda. Les prochains
rendez-vous de l’accueil, les exports ICS et les abonnements lisent cette donnée.
Les horaires s’affichent dans le fuseau **Europe/Paris**. Sans heure de fin, aucune
durée n’est inventée. Les fins antérieures au début et les liens de participation
sans protocole HTTP(S) sont refusés.

Pour retirer seulement un rendez-vous de l’agenda, supprimer ce bloc et republier.
Le texte et les photos restent dans le fil. Pour annuler une sortie, choisir
**annulé** et republier : le rendez-vous reste consultable avec son état et le
bouton de participation est désactivé.

## Après une sortie

Rouvrir la même publication, compléter le texte et ajouter les photos, puis
republier. Le rendez-vous passé reste accessible dans l’agenda historique.
Le compte rendu et ses photos sont sur la même page, sans nouvel article ni album.
La date de première publication reste conservée ; une mise à jour ne fait pas
remonter artificiellement toutes les anciennes sorties en tête du fil.

**Enregistrer** prépare un brouillon ; seule la version **publiée** apparaît dans
le fil, l’agenda et les fichiers accessibles par le site. Retirer la publication
retire ces accès. Modifier directement un fichier ou sa légende dans la médiathèque
met toutefois à jour ses usages publiés : pour préparer une nouvelle version en
brouillon, téléverser un nouveau fichier dans le brouillon de la publication.

## Navigation des visiteurs

Le menu principal contient **Le club**, **L’agenda**, **La vie du club**, avec le
bouton **Rejoindre le club**. Les trois activités restent mises en avant sur
l’accueil. Le fil propose une recherche et affiche 24 publications à la fois,
puis un bouton pour les précédentes. Il n’y a pas d’onglet séparé pour les photos.

Les horaires/UFRAPS, documents officiels, activités et pages du club gardent leurs
formulaires dédiés, pour les mises à jour occasionnelles. Voir le
[guide des médias et horaires](10-administration-medias-et-horaires.md).

## Reprise de l’existant

Une sauvegarde SQL a été faite avant migration. **116 publications** ont été reprises :
31 actualités, 30 événements et 55 albums, dont les 1 105 photos historiques.
Les fichiers restent dans le même volume `uploads` ; ils ne sont pas dupliqués.
Les documents déjà repris et les 38 pages restent disponibles.

Les versions publiées et brouillons sont copiées séparément. La reprise est
transactionnelle par document, identifiée par sa source et marquée en base ; un
redémarrage ne réimporte pas les archives et n’écrase pas les modifications.
Les anciennes collections restent en base comme archives, mais sont masquées dans
l’administration et ne pilotent plus les API publiques. Les médias liés uniquement
à ces archives ne sont pas exposés par le site.

Les URL `/actualites/<slug>`, `/agenda/<slug>` et `/albums/<slug>` redirigent vers
`/vie-du-club/<slug>`, en conservant les liens directs de photos. Les anciennes
adresses Piwigo et les UID d’abonnement ICS restent utilisables. La collision
historique « contest-de-rentree » utilise `event-contest-de-rentree` pour le
rendez-vous ; chaque ancienne adresse mène à la bonne publication.

Les articles/albums proches ne sont pas fusionnés automatiquement : leurs textes,
photos et brouillons peuvent différer. Cette séparation concerne seulement les
archives ; les nouvelles publications n’exigent aucune ressaisie.

Pour les dates d’archives, la date d’article, la date du rendez-vous ou une date
complète lisible dans le titre de l’album servent de repère de tri. Les albums
sans date fiable sont signalés comme archives et placés après les contenus datés.
La date de leur import n’est pas présentée comme une nouvelle publication.

La source de **baby-escalade-3** indiquait un début le 25 avril 2026 et une fin le
18 avril 2026. La nouvelle fiche laisse la fin non précisée ; la valeur originale
reste conservée dans l’ancienne collection. L’UID ICS historique est inchangé.

Le HTML importé est conservé tant que le texte d’une archive n’est pas modifié.
Lorsqu’on corrige ce texte dans le formulaire simplifié, le site affiche la nouvelle
version en texte, avec sa galerie et ses pièces jointes ; il ne continue pas
d’afficher silencieusement l’ancien HTML.

## Vérifications

Un [assistant de publication facultatif](12-assistant-administration.md) permet
aussi de créer ces mêmes publications à partir de texte libre, avec aperçu et
confirmation. Les formulaires décrits ici restent disponibles sans IA.

La recette utilise une base isolée. Elle vérifie la création sans adresse manuelle,
la couverture automatique et l’ordre des photos, les légendes, les brouillons,
l’ajout/retrait d’un rendez-vous, les journées entières au changement d’heure,
les exports ICS, la reprise des versions et son caractère rejouable.
Les parcours navigateur contrôlent aussi les anciennes adresses, la recherche,
la galerie et les fichiers. Les instructions de lancement des tests isolés sont
dans le [guide Docker et médias](10-administration-medias-et-horaires.md#recette-et-ci).
