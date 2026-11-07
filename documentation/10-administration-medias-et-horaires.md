# 10 — Administrer les photos, documents et horaires

Les publications, les photos de couverture, les documents et les horaires sont reliés
à **Strapi**. L’administration locale est à <http://localhost:1337/admin>.
Il n’est plus nécessaire d’éditer du JSON ni d’ajouter un fichier dans le code
pour ces usages.

## Photos et médiathèque

Dans **Media Library / Médiathèque**, téléverser les fichiers ou les choisir lors
de l’édition d’une fiche. Les fichiers repris ont été classés dans les dossiers
« Albums du club », « Documents et images du site » et « Illustrations du site ».
Les 1 105 photos, leurs miniatures, les 141 fichiers publics et les quatre
illustrations sont enregistrés dans Strapi, soit **1 250 médias** au total.

Pour les nouvelles informations et photos, ouvrir **Content Manager → Publication**.
Ajouter les photos dans **Photos (facultatif)**, les ordonner puis publier. La
première sert de couverture par défaut. Un rendez-vous et son compte rendu peuvent
partager la même fiche. Les anciennes collections albums, actualités et événements
sont désormais masquées : voir le [guide du formulaire unique](11-publications-vie-du-club.md).

La légende d’un média, modifiable dans la médiathèque, devient le titre de la
photo dans la visionneuse. Elle est commune aux contenus qui utilisent ce média.
Les nouvelles images profitent des miniatures générées par Strapi.

Les activités ont une **Photo de couverture** ; les publications proposent une couverture facultative en complément de leurs photos. Ces
fiches et les pages de ressources disposent aussi d’un sélecteur de **Photos et
documents joints** : les nouveaux fichiers apparaissent à la suite du texte.
Les fichiers déjà intégrés au HTML importé ne sont pas affichés une deuxième fois
sous forme de pièces jointes. Les pages de ressources conservent leur HTML éditable. Pour les publications reprises, le texte se modifie dans le formulaire simplifié et remplace alors le rendu HTML historique ; les photos et pièces jointes sont conservées.
Les illustrations fixes de l’accueil restent dans le code conformément au périmètre.

## Documents téléchargeables

Dans **Content Manager → Document du club** :

1. Renseigner le titre, la rubrique et éventuellement une présentation.
2. Sélectionner un **Fichier** dans la médiathèque.
3. Conserver ou définir son adresse (`slug`), enregistrer et **Publier**.

Le document apparaît dans <http://localhost:3000/documents>. Son adresse publique
est `/document-files/<slug>`. Pour mettre un PDF à jour, sélectionner le nouveau
fichier dans **la même fiche**, conserver le slug, puis publier : les liens vers
cette adresse restent valables. Les documents importés possèdent déjà ces adresses.
Changer le slug exige de mettre à jour les liens qui l’utilisent.

L’ajout à la médiathèque seul ne crée pas une fiche dans la bibliothèque du site :
le média doit être sélectionné dans un document publié. Pour joindre un fichier à
une actualité ou à un événement, utiliser directement ses pièces jointes.
Ne supprimer un média de la médiathèque qu’après vérification de ses utilisations ;
la suppression du fichier est globale.

## Documents présentés dans « Le club »

Dans **Content Manager → Page et ressources**, ouvrir la page **presentation**.
Le champ **Documents à afficher** permet de choisir les fiches Document du club
à proposer aux visiteurs. Les deux fiches initialement sélectionnées sont le
**Règlement intérieur** (version modifiée le 8 septembre 2026) et le
**Procès-verbal de l’AG 2025**. Les PDF sont hébergés dans la médiathèque Strapi ;
les visiteurs ne sont pas renvoyés vers l’ancien site.

Pour remplacer le PV par celui d’une prochaine AG, créer et publier sa fiche
Document du club, puis changer la sélection dans **presentation**, enregistrer
et publier la page. Pour mettre à jour un PDF en conservant son adresse, modifier
le fichier de sa fiche existante et publier cette fiche. Les titres et présentations
affichés sur les cartes proviennent des fiches de documents. Un document non publié
n’est pas proposé, même si la page du club est publiée. Le même champ fonctionne
sur les autres pages de ressources.

La couverture **À chacun sa voie** reste administrée dans **Activité →
cours-escalade → Photo de couverture**. Le texte alternatif et le point focal de
l’image sont lus depuis la médiathèque. La photo d’illustration de Pavel Danilyuk
montre une grimpeuse adulte en salle ; son point focal est placé à droite pour
préserver son visage dans les différents cadrages. Remplacer le média met à jour
ses usages en conservant l’adresse `/media/<id>`.

## Horaires des cours et UFRAPS

Dans **Content Manager → Single Types → Horaires et UFRAPS** :

- **Saison** et **Informations complémentaires** : libellé de saison et note éditoriale.
- **Créneaux de cours** : un bloc par cours, avec nom, jour, heures de début et fin, public, années de naissance, places facultatives et séance encadrée ou non.
- **Ouvertures et fermetures UFRAPS** : dates de saison, jour de la semaine et heures habituelles.
- **Périodes de fermeture** : nom, premier et dernier jours fermés, **dates incluses**.
- **Jours de fermeture exceptionnels** : une date et un motif par jour, notamment jours fériés et ponts.
- **Plannings et documents joints** : fichiers complémentaires consultables sur la page des horaires.

L’ordre des créneaux dans le formulaire est conservé sur le site. Laisser le nombre
de places vide lorsqu’il n’est pas précisé. Pour une période allant du lundi au
dimanche inclus, indiquer ces deux dates ; l’ouverture suivante dépend ensuite du
jour habituel configuré. La liste des ouvertures est calculée automatiquement.
Les heures inversées, les saisons et les périodes de fermeture inversées sont
refusées, y compris lors d’une mise à jour partielle.

**Enregistrer** conserve un brouillon ; **Publier** met à jour
<http://localhost:3000/horaires-et-acces#horaires>. Le JSON historique est conservé
uniquement pour la reprise et masqué dans le formulaire. Il ne pilote plus le site.
Les rendez-vous des publications restent distincts de ce planning.

## Publication et fichiers

Les API du site sélectionnent les versions **publiées**. Un nouveau média doit
être relié à une fiche publiée pour être servi par `/media/<id>` sur le site.
La modification du fichier ou de sa légende dans la médiathèque s’applique à ses
utilisations existantes ; pour préparer un remplacement en brouillon, téléverser
un nouveau fichier et le sélectionner dans le brouillon de la fiche.

Les chemins de stockage `/uploads/...` appartiennent au CMS, dont l’accès réseau
reste privé dans les Compose fournis. La médiathèque n’est pas un stockage de
fichiers confidentiels : Strapi sert ses fichiers statiques à qui peut joindre
son serveur. Le frontend ne publie que les fichiers reliés à un contenu publié.

Les anciennes adresses `/imports/...` et `/gallery/...` redirigent vers les médias
actuels. Aucun téléchargement depuis l’ancien site n’a lieu pendant les visites.

## Reprise et exploitation Docker

Une sauvegarde SQL a été réalisée avant la migration locale. La reprise des médias
et du planning est exécutée une seule fois, avec un marqueur en base. Elle conserve
les versions publiées et brouillons existantes. Une interruption avant la fin peut
être reprise au redémarrage ; les fichiers déjà inscrits sont reconnus par leur
identifiant d’import.

En local, `IMPORT_MEDIA=true` utilise les dossiers sources montés dans le conteneur
CMS. Les originaux de galerie doivent être restaurés avant le premier démarrage
sur une base neuve. Un fichier source manquant fait échouer la reprise plutôt que
de créer un album incomplet. Sur une base existante déjà migrée, aucune nouvelle
copie de la galerie n’est nécessaire au démarrage.

En production, deux possibilités :

- Restaurer ensemble la base PostgreSQL et le volume `uploads` migrés. Laisser `SEED_CONTENT=false` et `IMPORT_MEDIA=false`.
- Sur une base vierge, copier la galerie dans `GALLERY_DIRECTORY`, activer temporairement `SEED_CONTENT=true` et `IMPORT_MEDIA=true`, démarrer et vérifier, puis remettre les deux variables à `false` et recréer le CMS. Les autres fichiers sources sont inclus dans l’image CMS.

Le stockage actif est désormais le volume **`uploads` de Strapi**. Le frontend
n’a plus besoin d’un montage des photos. Sauvegarder la base **avec** ce volume.
Conserver aussi les sources de reprise avant de résilier l’ancien hébergement.
Prévoir temporairement la place pour la source et sa copie dans `uploads`.

## Périmètre conservé dans le code

Les partenaires et logos, certains textes d’accueil, les coordonnées et liens
d’inscription restent définis dans le frontend, conformément au choix du projet.
La page du club utilise une introduction compacte « L’esprit Vertical Côtière »,
puis les détails de la page Strapi `presentation` et les liens pratiques. Le logo
FFME intégré à l’ancien texte est retiré de ce rendu ; il reste dans le pied de page.

## Recette et CI

Les tests utilisent une **base et un volume de médias distincts**. Ne jamais lancer
les tests d’écriture dans la base locale du club.

```bash
CI=true node scripts/create-ci-gallery.mjs .tmp/ci-gallery
export TEST_GALLERY_DIRECTORY="$PWD/.tmp/ci-gallery"
docker compose -p vertical-test -f compose.yaml -f deploy/compose.test.yaml up --build -d --wait --wait-timeout 600
docker compose -p vertical-test -f compose.yaml -f deploy/compose.test.yaml exec -T -e RUN_CONTENT_TESTS=true -e SEED_CONTENT=false -e IMPORT_MEDIA=false cms node tests/content.integration.js
```

Le générateur refuse d’écraser un dossier existant. Ces images légères de recette
remplacent les originaux **uniquement dans le projet de test**. Elles permettent à
GitHub Actions de tester la migration sans télécharger la galerie publique.
La recette vérifie téléversement natif Strapi, légendes, brouillons, publication,
retrait de publication, remplacement d’un document à adresse stable et contrôles
d’horaires. Playwright contrôle aussi les liens, les médias intégrés, la galerie
et les fermetures UFRAPS. Le site de test écoute sur le port 3100.

Après les tests, arrêter et supprimer **uniquement les volumes de recette** :

```bash
docker compose -p vertical-test -f compose.yaml -f deploy/compose.test.yaml down -v
```
