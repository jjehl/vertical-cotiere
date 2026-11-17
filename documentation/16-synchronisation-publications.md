# Synchroniser les contenus du site entre environnements par API

La commande `sync-site.sh` fusionne les contenus gérés par le CMS et leurs fichiers
entre deux environnements au choix : **local, re7, prod ou une URL libre**, dans
les deux sens. `sync-publications.sh` reste disponible et conserve son périmètre
initial : les publications uniquement, sauf option `--type` explicite.

| Type (`--type`) | Contenus transférés |
| --- | --- |
| `all` | Tous les types éditoriaux ci-dessous, **sans les membres** ; valeur par défaut de `sync-site.sh` |
| `documents` | Documents du club, PDF, catégories et descriptions |
| `activities` | Activités et présentation des cours, textes et images de couverture |
| `pages` | Pages et ressources, HTML, pièces jointes et relations avec les documents du club |
| `timetable` | Saison, planning des cours, capacités, places historiques occupées, quatre tarifs par cours, activation/date d’ouverture des inscriptions, calendrier UFRAPS, périodes et jours de fermeture |
| `publications` | Publications, brouillons, rendez-vous d’agenda, photos et pièces jointes |
| `members` | Comptes et profils membres, uniquement avec `--type members` |

La page d’inscription utilise les tarifs et disponibilités du planning : ils sont
donc transférés par `timetable`. Les dossiers d’adhésion, paiements HelloAsso,
participants aux sondages, secrets applicatifs et paramètres techniques ne
sont jamais exportés. Les membres sont exclus des transferts éditoriaux et de
`--type all` ; leur procédure dédiée est décrite ci-dessous.
Les réservations et paiements de la cible restent en place ;
les disponibilités sont recalculées à partir de ces dossiers.

Les gabarits et textes écrits directement dans les fichiers Vue (par exemple
les modalités d’inscription, Contact, Informations ou Partenaires), les styles
et les images statiques sont livrés par le **déploiement du code**. Les données
éditoriales des pages et ressources stockées dans Strapi passent par cette commande.
Les anciennes collections masquées d’articles, événements et albums ne sont pas
dupliquées : leurs contenus ont été migrés vers les publications.
Aucun transfert de contenu ne se produit automatiquement lors d’un déploiement.

## Première configuration

1. Installer cette version du CMS sur les environnements utilisés, selon le
   parcours habituel (`main` → CI → re7, release → prod). Les deux CMS doivent
   disposer des nouvelles routes et de modèles de contenus compatibles. La
   commande refuse un ancien export qui ignorerait les nouveaux types.
2. Dans **Paramètres → Jetons API** de chaque CMS pouvant servir de **source**,
   créer un jeton **personnalisé** avec seulement les permissions
   **content-sync → export et download**.
3. Sur chaque CMS pouvant servir de **cible**, créer un autre jeton **personnalisé**
   avec seulement **content-sync → plan, upload et import**. Pour pouvoir utiliser
   un environnement dans les deux rôles, configurer ses deux jetons. Chaque jeton
   appartient à son CMS ; la commande choisit automatiquement celui du bon
   environnement et du bon rôle. Les sessions administrateur et membre ne sont
   pas des jetons API pour ces routes. Le type « lecture seule » générique de
   Strapi ne couvre pas ces actions personnalisées.
4. Sur le poste local, depuis la racine du dépôt :

   ```bash
   cp .env.content-sync.example .env.content-sync
   chmod 600 .env.content-sync
   ```

   Renseigner les URL et jetons des environnements utilisés dans ce fichier,
   ignoré par Git :

   | Profil | URL du CMS par défaut | Jeton de lecture | Jeton d’import |
   | --- | --- | --- | --- |
   | `local` | `http://localhost:1337` | `SYNC_LOCAL_EXPORT_TOKEN` | `SYNC_LOCAL_IMPORT_TOKEN` |
   | `re7` | `https://vertical-cotiere-admin.re7.jehl.org` | `SYNC_RE7_EXPORT_TOKEN` | `SYNC_RE7_IMPORT_TOKEN` |
   | `prod` | `https://vertical-cotiere-admin.jehl.org` | `SYNC_PROD_EXPORT_TOKEN` | `SYNC_PROD_IMPORT_TOKEN` |

   Les variables `SYNC_LOCAL_URL`, `SYNC_RE7_URL` et `SYNC_PROD_URL` permettent
   d’adapter les adresses. Ne pas utiliser le domaine du frontend ni ajouter
   `/api` à ces URL. Les variables d’environnement du shell
   ont priorité sur le fichier. Node.js **22.9 minimum**, ou 24, est requis sur le poste.

## Utilisation

```bash
# Ensemble du site local → recette : aperçu, puis transfert.
./sync-site.sh --from local --to re7 --dry-run
./sync-site.sh --from local --to re7

# Uniquement les pages (leurs documents liés sont traités automatiquement).
./sync-site.sh --from local --to re7 --type pages --dry-run

# Uniquement le planning, les tarifs et les réglages d’inscription.
./sync-site.sh --from local --to re7 --type timetable --dry-run

# Local → recette, aperçu puis transfert.
./sync-publications.sh --from local --to re7 --dry-run
./sync-publications.sh --from local --to re7

# Recette → production.
./sync-publications.sh --from re7 --to prod --dry-run
./sync-publications.sh --from re7 --to prod

# Production → local.
./sync-publications.sh --from prod --to local --dry-run
./sync-publications.sh --from prod --to local

# Limiter à une publication (slug de son brouillon).
./sync-publications.sh --from re7 --to prod --slug sortie-falaise --dry-run
./sync-publications.sh --from re7 --to prod --slug sortie-falaise
```

Les mêmes jetons et le même fichier `.env.content-sync` servent aux deux commandes ;
aucune permission supplémentaire n’est nécessaire pour les types éditoriaux. Le transfert global traite
d’abord les documents du club, puis les activités, pages, planning et publications.
Une page isolée emporte aussi ses documents liés, chacun traité une seule fois par
exécution. Si l’un de ces documents est en conflit ou en erreur, la page n’est pas
importée ; les contenus indépendants continuent à être traités.

Les six sens entre `local`, `re7` et `prod` sont possibles. La commande affiche
les profils et les adresses source/cible avant de commencer. Sans options, le
transfert reste **local → re7**, et `--to re7 --dry-run` reste utilisable.
Deux profils ou URL désignant la même adresse sont refusés ; les API vérifient
également l’identité de l’instance. Le mode `--dry-run` fonctionne aussi pour
une cible de production.

### Autres environnements et URL libres

Pour ajouter un profil, par exemple `staging`, configurer `SYNC_STAGING_URL`,
`SYNC_STAGING_EXPORT_TOKEN` et `SYNC_STAGING_IMPORT_TOKEN`, puis utiliser :

```bash
./sync-publications.sh --from staging --to local --dry-run
```

On peut aussi passer des URL complètes à `--from` et `--to`. Si une URL correspond
à un profil configuré sans ambiguïté, ses jetons sont sélectionnés automatiquement :

```bash
./sync-publications.sh --from https://vertical-cotiere-admin.jehl.org --to local --dry-run
```

Pour des CMS sans profil, définir les paires `SYNC_SOURCE_URL` / `SYNC_SOURCE_TOKEN`
et `SYNC_TARGET_URL` / `SYNC_TARGET_TOKEN` dans `.env.content-sync`, puis lancer la
commande, avec ou sans les URL explicites :

```bash
./sync-publications.sh --from https://cms-source.example.org --to https://cms-cible.example.org --dry-run
```

L’ancienne configuration directionnelle reste acceptée pour ses adresses d’origine.
Un jeton directionnel associé à une URL n’est jamais réutilisé pour une autre
adresse lorsqu’on change `--from` ou `--to`. Les jetons par profil ont priorité.
Les options explicites ont priorité sur les URL directionnelles par défaut.
HTTPS est requis, sauf pour un CMS HTTP sur la boucle locale.

Le rapport affiche `create`, `update`, `unchanged`, `conflict` ou une erreur par
contenu, avec son type et son slug (ou `club-timetable`), puis les totaux.
Le code de sortie est **0** si tout réussit, **2**
si des conflits ou erreurs subsistent et **1** pour une erreur de configuration
ou d’export global. Une erreur sur une publication n’empêche pas les suivantes
d’être traitées. Le transfert n’est pas une transaction globale sur tout le site.

L’aperçu télécharge les originaux dans un dossier temporaire privé pour calculer
leurs empreintes SHA-256 : cela peut être long pour une grande galerie. Il ne
charge rien dans la médiathèque cible et ne modifie aucune publication.
La source initialise une seule fois son identité d’instance lors du premier
export. Strapi met normalement à jour la date d’utilisation des jetons.

Les fichiers temporaires sont supprimés à la fin de la commande. Chaque fichier
est lu une seule fois par exécution, même s’il figure dans plusieurs publications.
La limite de cette commande est **50 Mo par original**. Si un proxy ajoute une
limite plus basse, l’ajuster ou réduire le fichier avant transfert.

## Transfert facultatif des membres

Les membres ne sont **jamais** inclus par défaut, même avec `--type all`.
Déployer cette version du CMS sur les deux environnements avant utilisation.
Dans les jetons API personnalisés déjà configurés, ajouter uniquement si nécessaire :

- sur la source : `content-sync → membersExport` ;
- sur la cible : `content-sync → membersPlan` et `membersImport`.

Les permissions éditoriales `export`, `plan` et `import` n'autorisent pas l'accès
aux membres. Les JWT des membres et sessions d'administration ne sont pas acceptés.
Les noms ci-dessus correspondent aux actions des routes ; l'administration peut
les afficher avec des espaces.

```bash
./sync-site.sh --from local --to re7 --type members --dry-run
./sync-site.sh --from local --to re7 --type members
```

Le transfert comprend les identifiants de connexion, e-mails, coordonnées, licence
FFME, date de naissance d'adhésion, état confirmé/bloqué et rôle membre
(`authenticated`, `contributor`, `member_admin`). Les rôles doivent déjà exister
sur la cible ; leurs permissions ne sont jamais copiées. Plusieurs membres d'une
même famille peuvent partager une adresse e-mail : elle ne sert jamais à fusionner
automatiquement des comptes.

Le mot de passe est transféré sous forme de **hash bcrypt**, jamais en clair, et
reste utilisable sur la cible. Le jeton source autorisé à exporter les membres
doit donc rester réservé à l'administrateur. Les rapports ne contiennent ni profil
ni hash ; l'historique de fusion ne conserve qu'une empreinte du hash. Un mot de
passe modifié uniquement sur la cible est conservé ; des modifications des deux
côtés produisent un conflit.

Les administrateurs Strapi, sessions/JWT, jetons de confirmation, récupération et
invitation, liens Google, inscriptions, paiements, contributions et relations avec
les publications ne sont pas copiés. Les liens Google existants de la cible restent
en place. Un compte source uniquement Google doit utiliser la récupération de mot
de passe ou associer Google depuis la cible pour s'y connecter.

Le premier transfert crée un nouveau compte avec ses propres identifiants
techniques. Un identifiant de connexion déjà présent (sans distinction de casse)
est signalé en conflit ; aucun compte existant n'est adopté automatiquement.
`--slug` et `--adopt-slug` ne sont pas disponibles pour les membres.
Après un premier transfert réussi, les profils suivent une fusion champ par champ
avec détection des changements concurrents. Les comptes supplémentaires ou
supprimés sur la cible ne sont ni effacés ni recréés automatiquement.

RE7 protège le site et ses API éditoriales par mot de passe HTTP. Les routes exactes
de synchronisation restent accessibles avec leurs jetons API dédiés : aucun mot
de passe HTTP supplémentaire n'est requis dans `.env.content-sync`.

## Pages, documents et planning déjà présents sur la cible

Comme pour les publications, un slug identique provoque un conflit au premier
passage. Après avoir vérifié les deux fiches, rapprocher **un type et un contenu** :

```bash
./sync-site.sh --from local --to re7 --type pages --slug presentation --adopt-slug --dry-run
./sync-site.sh --from local --to re7 --type pages --slug presentation --adopt-slug

# Le planning est un contenu unique ; son sélecteur est club-timetable.
./sync-site.sh --from local --to re7 --type timetable --slug club-timetable --adopt-slug --dry-run
./sync-site.sh --from local --to re7 --type timetable --slug club-timetable --adopt-slug
```

Ce premier rapprochement donne priorité aux champs de la source. Les documents,
pièces jointes et cours supplémentaires propres à la cible sont conservés.
`--adopt-slug` n’autorise pas implicitement le rapprochement des documents liés à
une page : traiter d’abord chaque document en conflit avec `--type documents` et
son propre slug. Il n’existe pas de rapprochement global par slug ; `--type all`
et `--slug` ne peuvent pas être combinés.

Après le premier transfert, les champs éditoriaux suivent une fusion à trois
états : dernière source, dernière cible et valeurs actuelles. Le planning compare
les cours par `registrationCode` permanent, puis champ par champ : une modification
locale de tarif peut être transférée tout en conservant une capacité modifiée
sur RE7. Deux modifications incompatibles du même tarif produisent un conflit.
Les cours supplémentaires de la cible et les cours retirés de la source restent
en place ; le calendrier UFRAPS est comparé comme un bloc.

Les identifiants techniques de composants ne sont jamais recopiés. Un planning
déjà présent doit être rapproché explicitement. Une capacité inférieure aux
inscriptions actives de la cible (en tenant compte des places historiques occupées)
est refusée. Un changement de saison est aussi refusé si des paiements de la
saison cible sont en cours. Ces contrôles sont refaits sous le même verrou que
les réservations lors de l’import.

## Règles de fusion des publications

- L’identité d’une publication est le couple **instance source + documentId
  source** ; les identifiants de la cible sont indépendants. Cette correspondance
  et les états du dernier transfert sont conservés dans le core store du CMS de
  cible, donc survivent aux redémarrages et changements de poste.
- Sans correspondance et sans collision de slug, la publication est créée.
- Les champs modifiés seulement sur la source sont transférés. Les modifications
  propres à la cible sont conservées. Si le même champ diffère des deux côtés,
  toute cette publication est laissée intacte et le rapport nomme le conflit,
  par exemple `draft.body`. Les autres publications peuvent être transférées.
- Le rendez-vous est comparé comme un bloc : des modifications concurrentes de
  deux propriétés de ce bloc constituent un conflit. Les versions publiée et
  brouillon sont comparées et fusionnées séparément.
- Les collections de photos et pièces jointes sont fusionnées par ajout, dans
  l’ordre source puis avec les fichiers supplémentaires de la cible. Une suppression
  à la source n’efface aucun fichier cible. La couverture est un champ comparé
  séparément, avec détection de conflit.
- Une dépublication ou une suppression à la source n’est pas propagée. Une publication
  synchronisée puis supprimée sur la cible produit un conflit, sans recréation
  automatique. Une version publiée supprimée sur la cible n’est pas republiée
  automatiquement par le transfert.
- Les photos ajoutées par les membres sur la source sont incluses comme photos
  éditoriales de la publication importée. Leur attribution et les droits du membre
  source ne sont pas transférés. Les contributions déjà présentes sur la cible
  sont conservées.

Pour résoudre un conflit, rapprocher manuellement les valeurs du champ sur les
deux CMS, puis relancer la commande. Il n’existe pas d’option d’écrasement global.
Éviter d’éditer les publications et leurs fichiers pendant un transfert.

### Première reprise d’une publication déjà présente sur la cible

Un slug identique ne suffit pas à prouver qu’il s’agit du même contenu : la commande
signale une collision sans modifier la publication. Après avoir vérifié les deux
fiches, autoriser explicitement leur rapprochement, pour **une seule publication** :

```bash
./sync-publications.sh --from prod --to local --slug sortie-falaise --adopt-slug --dry-run
./sync-publications.sh --from prod --to local --slug sortie-falaise --adopt-slug
```

Lors de ce premier rapprochement, les champs de la source prennent la priorité et
les photos/pièces jointes de la cible sont conservées en complément. Les transferts
suivants utilisent les règles de conflit normales. Ne pas utiliser cette option
pour deux publications différentes qui ont simplement le même slug.

Un transfert inversé ou une chaîne `local → re7 → prod → local` peut rencontrer
des publications déjà présentes mais sans correspondance pour cette nouvelle
source. Dans ce cas, le même rapprochement explicite est nécessaire au premier
passage. Le changement de sens ne transforme pas la commande en synchronisation
continue ni en miroir avec propagation des suppressions.

## Médias, liens et reprise

Les originaux sont téléchargés par l’API source, puis téléversés par l’API cible.

Si Strapi refuse un ancien JPEG à cause d’un segment de pixels endommagé mais
encore décodable, la cible tente un réencodage JPEG en qualité 95, conserve les
métadonnées et valide de nouveau le résultat avec le décodeur strict. L’original
source reste inchangé ; la correspondance utilise son empreinte initiale pour
éviter les doublons lors d’une relance. Cette récupération est signalée dans les
journaux du CMS. Une image irrécupérable est refusée avec un HTTP 422 et son nom ;
remplacer alors le fichier source avant de relancer le transfert. La commande
indique également le nom et l’identifiant source du fichier pour les autres
échecs de téléversement.

Le provider de la cible écrit lui-même dans son stockage (SeaweedFS en local,
S3 OVH en re7/prod) et Strapi régénère les variantes
d’images. L’empreinte reçue est contrôlée avant upload. Les correspondances utilisent
le contenu **et** les métadonnées du fichier : deux fichiers de même contenu mais de
noms ou légendes différents restent distincts. Un fichier déjà présent avant cette
fonctionnalité n’est pas automatiquement rapproché sans correspondance connue.

Les relations `photos`, `attachments` et `coverImage` sont recréées avec les IDs de
la cible. Les liens `/media/:id` intégrés au texte ou au HTML historique sont réécrits.
Les liens historiques connus `/imports/`, `/gallery/` et `/document-files/:slug` sont
convertis en références de fichiers lors de l’export. Les autres liens, dont les liens
externes, restent inchangés. Les dates éditoriales et identifiants de calendrier
sont conservés ; les dates techniques de création/mise à jour sont propres à la cible.
Un fichier uniquement intégré au texte est aussi rattaché à la collection de photos
ou de pièces jointes de sa publication, afin que le proxy public puisse le servir.

Si le réseau coupe, relancer la même commande : les fichiers déjà enregistrés et
les publications déjà importées sont reconnus. Des requêtes de synchronisation
concurrentes sont sérialisées par un verrou PostgreSQL. Les deux versions de la
publication et leur correspondance sont écrites dans la même transaction.

Un upload réussi peut rester dans la médiathèque si l’import de sa publication
échoue ensuite. Il sera réutilisé à la relance ; aucun nettoyage automatique ne
risque de supprimer un fichier partagé. Sauvegarder la cible avant une reprise
importante reste utile pour pouvoir annuler un transfert déjà terminé.

## Contrat API et contrôles

| Route CMS | Permission personnalisée | Rôle |
| --- | --- | --- |
| `GET /api/content-sync/export?page=1&pageSize=10&slug=...` | `export` | Export versionné, paginé, publié et brouillon, avec tous les médias |
| `GET /api/content-sync/files/:id` | `download` | Original de la médiathèque source, y compris les fichiers de brouillons |
| `POST /api/content-sync/plan` | `plan` | Calcul de fusion, conflits et fichiers manquants, sans écriture éditoriale |
| `POST /api/content-sync/files` | `upload` | Multipart `files` et `metadata` JSON, empreinte SHA-256 contrôlée |
| `POST /api/content-sync/import` | `import` | Recalcul de fusion et écriture transactionnelle |

L’export accepte aussi `type=documents|activities|pages|timetable` et renvoie
`{version:2,type,contents,pagination}`. Le format publication v1 est conservé.
Les contenus v2 contiennent leurs versions brouillon/publiée, les fichiers et
les dépendances documentaires. Les relations utilisent les documentId source,
remappés au moyen des correspondances de la cible ; aucun identifiant de composant
n’est accepté. Les champs autorisés sur ces routes sont limités aux types éditoriaux ci-dessus.
Les membres utilisent exclusivement `GET /api/content-sync/members/export`,
`POST /api/content-sync/members/plan` et `POST /api/content-sync/members/import`,
avec leurs permissions dédiées `membersExport`, `membersPlan`, `membersImport`.

`plan` et `import` reçoivent `{publication, adoptSlug}` pour le format v1 ou
`{content, adoptSlug}` pour le format v2. Le jeton d’export donne
accès aux champs éditoriaux historiques privés et aux originaux de la médiathèque :
le réserver à l’administrateur. Les permissions ne sont attribuées à aucun rôle
membre. Les routes éditoriales ne permettent ni d’importer des utilisateurs ni de fournir un
chemin serveur, une URL de téléchargement arbitraire ou des credentials S3.

```bash
docker compose exec -T cms node --test tests/content-sync.test.js tests/content-sync-site.test.js tests/content-sync-members.test.js tests/content-sync-image.test.js
node --test scripts/tests/sync-publications.test.mjs
docker compose cp scripts/sync-publications.mjs cms:/tmp/vertical-sync-client.mjs
docker compose exec -T -e RUN_CONTENT_SYNC_TESTS=true cms node tests/content-sync.integration.js
```

Le test d’intégration crée et supprime sa propre base PostgreSQL et ses objets de
test. Il vérifie les scopes, le refus des JWT membres, les photos communautaires,
les originaux S3, les brouillons, les conflits, l’idempotence, la concurrence,
l’annulation des écritures en cas d’échec de persistance et le script réel face
au CMS de test. Les tests de la commande exécutent aussi les six sens entre trois
CMS HTTP simulés, avec leurs jetons propres, un aperçu et une relance. La CI
exécute ces contrôles.
