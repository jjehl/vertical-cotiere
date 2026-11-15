# Synchroniser les publications entre environnements par API

La commande `sync-publications.sh` fusionne les publications et leurs fichiers
entre deux CMS au choix : **local, re7, prod ou une URL libre**, dans les deux sens.
Elle ne transfère ni utilisateurs, ni secrets, ni base de données,
ni les autres collections du site. Aucun transfert ne se produit lors d’un déploiement.

## Première configuration

1. Installer cette version du CMS sur les environnements utilisés, selon le
   parcours habituel (`main` → CI → re7, release → prod). Les deux CMS doivent
   disposer des nouvelles routes et de modèles de publications compatibles.
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
publication, puis les totaux. Le code de sortie est **0** si tout réussit, **2**
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

## Règles de fusion

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

`plan` et `import` reçoivent `{publication, adoptSlug}`. Le jeton d’export donne
accès aux champs éditoriaux historiques privés et aux originaux de la médiathèque :
le réserver à l’administrateur. Les permissions ne sont attribuées à aucun rôle
membre. Les routes ne permettent ni d’importer des utilisateurs ni de fournir un
chemin serveur, une URL de téléchargement arbitraire ou des credentials S3.

```bash
node --test cms/tests/content-sync.test.js scripts/tests/sync-publications.test.mjs
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
