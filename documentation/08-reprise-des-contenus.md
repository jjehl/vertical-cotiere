# 08 — Reprise des contenus, des horaires et de l’agenda

Import effectué le **7 novembre 2026**, depuis les interfaces publiques du site.

Les 31 articles, 30 événements et 55 albums sont désormais administrés comme
**116 publications**. Leurs anciennes adresses redirigent vers le fil commun.
Voir le [fonctionnement actuel et la migration](11-publications-vie-du-club.md). Les quantités ci-dessous décrivent les sources reprises.
Les pages du nouveau site ne renvoient plus vers l’ancien hébergement pour lire
les informations, consulter un planning ou télécharger un document.

## Contenus repris

| Contenu | Quantité | Accès dans le nouveau site |
| --- | --- | --- |
| Pages publiques | 38 | `/ressources`, pages du club, inscriptions, contact et horaires |
| Articles | 31 | `/actualites` et fiches complètes |
| Événements | 30 | `/agenda`, vues liste/mois/jour et fiches complètes |
| Fichiers | 141 | Médiathèque Strapi, anciennes adresses `/imports/` redirigées |
| Documents téléchargeables parmi ces fichiers | 39 | `/documents` et liens dans les contenus |
| Créneaux hebdomadaires | 23 | Tableau HTML sur `/horaires-et-acces#horaires` |
| Albums photo publics Piwigo | 55 | `/albums` |
| Photos de la galerie | 1 105 | Médiathèque Strapi, originaux et miniatures conservés |

Les 38 pages correspondent à toutes les pages publiées exposées par l’API
WordPress. Les 31 articles correspondent à tous les articles publiés exposés par
la même API. La requête de calendrier couvre 1900–2100 et renvoie 30 événements,
de septembre 2025 à novembre 2026. Aucun événement supplémentaire n’a été inventé.

Les documents reliés directement au menu du site sont également téléchargés,
notamment le règlement intérieur et le procès-verbal de l’assemblée générale.
Les contenus datés anciens restent des archives ; leur reprise ne les transforme
pas en consignes valables pour la saison actuelle.

## Horaires et calendrier UFRAPS

Les horaires 2026–2027 sont retranscrits depuis le planning en image publié dans
la page horaires, avec jours, heures, public, années de naissance et capacité
indiquée. Le libellé adulte du mercredi est explicité car la source répète le
libellé « Mercredi 5 ». Une capacité non publiée reste vide. Les plannings
d’origine et le PDF du jeudi sont disponibles localement en complément.

Le calendrier UFRAPS reprend l’ouverture de saison, la fermeture d’été, les quatre
périodes de vacances et les jours fériés/pont de l’Ascension. La liste des samedis
d’ouverture est calculée à partir de ces règles, pour le créneau de 10 h à 12 h.
Les samedis 1er et 8 mai 2027 sont exclus. Les horaires HelloAsso restent la
référence indiquée par le club pour choisir un créneau lors de l’inscription.

La transcription initiale reste dans `content/timetable.json`. Elle a été migrée vers le type unique **Horaires et UFRAPS** de Strapi : créneaux, dates, heures, périodes et jours de fermeture disposent de formulaires dédiés. Le tableau et la liste des ouvertures lisent ce type unique ; l’ancien JSON est masqué et ne pilote plus le site. Voir le [guide d’administration](10-administration-medias-et-horaires.md).

## Agenda

- Dates et horaires d’origine conservés, instants convertis en UTC avec affichage dans `Europe/Paris`.
- Journées entières stockées avec dates civiles et fin exclusive pour l’export ICS.
- Événements multi-jours visibles dans chaque journée et chaque mois traversé.
- Catégorie principale, thèmes d’origine, recherche, choix direct du mois et vue journalière.
- Export du mois filtré, export individuel et abonnement au flux complet ou à une catégorie/thème.
- Les UID ICS historiques sont conservés, y compris leur domaine d’origine : ce sont des identifiants, pas des liens vers l’ancien site.
- Les événements dont l’heure de fin égale l’heure de début ne reçoivent pas de durée inventée ; le flux omet alors `DTEND`.

Les abonnements utilisent `/api/agenda.ics`. L’application de calendrier doit
pouvoir joindre l’adresse utilisée ; un abonnement créé sur `localhost` doit être
remplacé par l’adresse publique après mise en ligne.

## Liens et anciennes adresses

Les liens internes ont été réécrits vers les pages locales ou les fichiers
téléchargés. Les anciennes adresses telles que `/horaires/`, `/inscriptions_25-26/`,
`/event/<slug>/`, les anciennes vues d’agenda et les URL de fichiers possèdent des
redirections locales. Les identifiants WordPress `?p=` et `?page_id=` connus sont
également repris. Les abonnements historiques `?ical=1` rejoignent le nouveau flux.

Les services extérieurs utiles restent extérieurs : HelloAsso, Framadate,
Framaforms, fédération, itinéraires et sites des partenaires. Aucun service
WordPress n’est requis pour afficher ou exploiter les contenus importés.

## Limites constatées sur la source

Quatre fichiers liés par l’ancien site répondent déjà en **404** :

- `2018/11/Verticot-affiche-téléthon-2018.png`
- `2018/12/Verticontest-2019-règlement.docx`
- `2018/03/ResultatsOpenRégional-BaB-2018.pdf`
- `2019/11/Nœud-8.pdf`

Plusieurs liens d’archives pointent aussi vers des pages supprimées (compétitions
2018/2019, anciens forums, anciens événements et sortie en salle). La page réseaux sociaux est vide. La galerie Piwigo, distincte de WordPress, a été
explorée séparément et intégralement reprise : 55 albums et 1 105 photos publiques.
Les liens indisponibles sont retirés du HTML importé, en conservant leur texte.
Ces éléments ne peuvent être recréés fidèlement à partir d’une réponse 404 ; leur
récupération nécessitera une sauvegarde du site ou les fichiers originaux.

Le rapport exact, les sources et les tables de correspondance sont dans
[`content/import-report.json`](../content/import-report.json).

## Rejouer l’import et alimenter Strapi

`python3 scripts/import-public-site.py` reconstruit l’instantané depuis les API
publiques et télécharge les fichiers manquants. Un cache de téléchargement est
utilisé dans `/tmp/vertical-cotiere-import`. Cette commande ne modifie pas la base.

Au démarrage avec `SEED_CONTENT=true`, Strapi crée les contenus manquants, sans
écraser les entrées déjà présentes ou modifiées par les bénévoles. Une migration
supprime uniquement les anciennes entrées de prototype dont tous les champs sont
encore identiques au jeu d’origine, conservé dans `content/prototype.json`.

En local, le démarrage Compose réalise cet import automatiquement. En production,
mettre temporairement `SEED_CONTENT=true` et `IMPORT_MEDIA=true` dans `.env.production` au premier
démarrage, puis remettre `false` et recréer le CMS. La base et les médias doivent
être sauvegardés avant toute reprise sur une instance existante. Un rafraîchissement
ultérieur du site source ne remplace pas automatiquement les contenus déjà édités
dans Strapi ; il doit être rapproché des modifications du club.

## Galerie photo et fichiers volumineux

La galerie Piwigo publique a été reprise par `scripts/import-public-gallery.py`,
avec ses légendes, ses 55 albums, ses 1 105 photos originales et ses miniatures.
L’import n’utilise aucun compte et ne consulte pas les albums privés. Aucun
échec de téléchargement n’a été constaté. La galerie permet la recherche d’albums,
la pagination, la visionneuse au clavier et le téléchargement de l’original.
Les anciennes adresses Piwigo de catégories et de photos sont redirigées.

Les métadonnées sont dans `content/gallery.json`, les correspondances dans
`content/gallery-redirects.json` et le bilan dans `content/gallery-report.json`.
Strapi propose une collection Album photo ; le bootstrap importe les albums
manquants sans écraser les modifications existantes.

Les 2 210 fichiers représentent environ **1,5 Go**. Ils restent dans
`frontend/public/gallery/`, ignoré par Git et par les builds Docker. Les images
Docker contiennent le code et les métadonnées, pas ces fichiers volumineux. Le
CMS les lit depuis `/app/legacy-gallery` lors de la reprise initiale, puis les copie dans son volume `uploads` et les inscrit dans la médiathèque. Nuxt les sert via ses routes `/media/<id>`, à partir des contenus publiés. Aucun téléchargement depuis l’ancien site n’a lieu à l’exécution.

Avant de démarrer sur OVH, copier le dossier par exemple avec :

```bash
rsync -av --progress frontend/public/gallery/ utilisateur@serveur-ovh:/srv/vertical-cotiere/gallery/
```

Renseigner `GALLERY_DIRECTORY=/srv/vertical-cotiere/gallery` dans `.env.production`.
Après la migration, sauvegarder ensemble **la base et le volume `uploads`** : c’est le stockage actif, y compris pour les nouvelles photos. Conserver le dossier source comme archive indépendante. Le conserver avant d’arrêter l’ancien hébergement : les scripts d’import
ne remplacent pas une sauvegarde indépendante des originaux.
