# 06 — Docker local, CI GitHub et Compose OVH

## Organisation

| Emplacement | Rôle |
| --- | --- |
| `frontend/` | Application Nuxt et Dockerfile avec cibles development / production |
| `cms/` | Strapi, modèles éditoriaux et Dockerfile avec les mêmes cibles |
| `content/initial.json` | Instantané des contenus publics repris, éditables ensuite dans Strapi |
| `compose.yaml` | Développement local avec sources montées et volumes persistants |
| `.github/workflows/images.yaml` | Vérifications, construction et publication des deux images |
| `deploy/compose.production.yaml` | Exécution des images sur OVH, sans compilation sur le serveur |
| `deploy/compose.traefik.yaml` | Raccordement optionnel au reverse proxy Traefik existant |

Le principe est celui du projet [canin_premiere_langue](https://github.com/jjehl/canin_premiere_langue),
dont la configuration a été lue dans la copie locale : images versionnées dans un
registre, puis Compose sur OVH. Le registre choisi ici est **GHCR** et le
déploiement est **manuel**. Aucun secret du projet de référence n’a été réutilisé.

## Développement local

Depuis la racine, avec Docker Compose v2.24.4 ou ultérieur et Node.js :

```bash
node scripts/init-env.mjs
docker compose up --build -d --wait --wait-timeout 300
```

Le script crée `.env` avec des secrets aléatoires et des droits restreints ; il
conserve un fichier existant. Le fichier n’est pas suivi par Git. Les ports se
modifient avec `WEB_PORT` et `CMS_PORT` dans ce fichier.

Le [guide de l’assistant de publication](12-assistant-administration.md) décrit
les paramètres Mistral facultatifs et la fourniture de la clé privée sur OVH.
La CI teste ce parcours avec un fournisseur simulé. La construction ne nécessite
aucune clé IA ; un workflow séparé peut déployer la clé de production depuis les
Secrets GitHub.

Site : <http://localhost:3000>. CMS : <http://localhost:1337/admin>.
La base n’expose aucun port sur l’hôte. Les services HTTP écoutent uniquement sur
l’interface locale de l’hôte, et non sur tout le réseau.

Créer le premier administrateur dans Strapi, puis ouvrir le Content Manager pour
modifier les publications et les informations stables du club. L’API publique
`/api/site-content` renvoie uniquement une sélection de champs des contenus
publiés. Aucun droit public d’écriture n’est accordé. Les brouillons restent
absents du site public.

`SEED_CONTENT=true` insère les contenus manquants par slug au démarrage local,
sans écraser les contenus déjà présents. La migration vers les publications est marquée en base et ne les recrée pas après suppression. Mettre cette variable à `false` dans
Compose si l’on souhaite supprimer définitivement un contenu initial. Le jeu initial contient les 38 pages, 31 articles et 30 événements du site public ;
les fichiers associés sont repris dans la médiathèque avec `IMPORT_MEDIA=true`. Voir le [guide d’administration](10-administration-medias-et-horaires.md).

Les volumes `postgres_data` et `uploads` sont conservés lors de `docker compose
down`. La commande avec `-v` supprimerait les données : elle ne fait pas partie
du cycle de développement ordinaire.

```bash
docker compose logs -f cms web
docker compose exec web npm run test
docker compose exec web npm run typecheck
docker compose exec web npm run build
```

Pour les tests navigateur locaux (installation dans le conteneur de développement) :

```bash
docker compose exec web npx playwright install --with-deps chromium
docker compose exec web npx playwright test
```

Après changement de `package.json`, régénérer son verrou npm avec Node 24, puis
relancer `docker compose up --build -d`. Node 24 est fourni par les images ; la
version Node de l’hôte n’a pas besoin d’exécuter Nuxt ou Strapi.

## GitHub Actions

Le workflow est déclenché sur pull request vers `main`, push sur `main`, tag `v*`
et lancement manuel.

1. Installer les dépendances verrouillées du frontend, lancer tests de dates et vérification TypeScript.
2. Générer des images de recette légères, démarrer Compose sur une base isolée, tester téléversements/publications/remplacements puis exécuter les parcours Playwright sur le site connecté à Strapi. Les 1,5 Go d’originaux ne sont pas téléchargés par la CI.
3. Construire les images de production `linux/amd64` du frontend et du CMS.
4. Publier sur GHCR seulement hors pull request, avec le `GITHUB_TOKEN` et la permission `packages: write`.

Les images sont nommées à partir du dépôt GitHub, en minuscules :

```text
ghcr.io/<propriétaire>/<dépôt>-web:sha-<SHA complet>
ghcr.io/<propriétaire>/<dépôt>-cms:sha-<SHA complet>
```

Un tag Git `v0.1.0` ajoute ce même tag aux deux images. Le SHA est le choix préféré
pour fixer une version. Aucun tag `latest` n’est requis. Si le serveur OVH utilise
ARM, ajouter cette architecture au build après validation des dépendances natives.

Le workflow est fourni dans le dépôt ; sa première exécution distante dépendra du
push sur GitHub. La visibilité des packages GHCR et les droits de lecture du
serveur devront être configurés dans GitHub. Pour un registre privé, utiliser un
jeton disposant de `read:packages` sur le serveur, transmis à `docker login` via
stdin. La construction des images n’utilise aucune clé SSH. Un
[workflow séparé](../.github/workflows/deploy-mistral-secret.yaml), lancé depuis
Actions sur `main`, transmet la clé Mistral des Secrets GitHub vers OVH puis
recrée le CMS. Les secrets, variables et accès SSH à préparer sont décrits dans
le [guide de l’assistant](12-assistant-administration.md#ovh--clé-déployée-depuis-les-secrets-github).

## Installation OVH

Copier les fichiers de `deploy/` sur le serveur. Créer un fichier
`.env.production` à partir de l’exemple avec **de nouveaux secrets**, le préfixe
d’image et le tag exact produit par la CI. Les deux images doivent utiliser le
même tag. Les fichiers de secrets restent sur le serveur, hors Git. La clé
Mistral peut rester vide à cette étape : le workflow de déploiement la renseigne
ensuite depuis GitHub, sans saisie manuelle de cette clé sur OVH.

Depuis le répertoire contenant les Compose de production :

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml pull
docker compose --env-file .env.production -f compose.production.yaml up -d --wait
```

Les ports web et CMS restent liés à `127.0.0.1`. Pour publier le site derrière un
Traefik **déjà installé** : renseigner domaine, nom du réseau externe et resolver,
puis utiliser les deux fichiers :

```bash
docker compose --env-file .env.production -f compose.production.yaml -f compose.traefik.yaml pull
docker compose --env-file .env.production -f compose.production.yaml -f compose.traefik.yaml up -d --wait
```

Traefik doit disposer des entrypoints `web` / `websecure`, d’un resolver ACME et
du réseau indiqué. Le fichier proposé ne crée pas ce reverse proxy. L’exemple
configure un domaine unique ; ajouter les variantes `www` et leur redirection au
moment de la bascule DNS.

Le CMS reste privé dans cette version. Depuis son poste, créer un tunnel vers le
serveur pour accéder à l’administration :

```bash
ssh -L 1337:127.0.0.1:1337 utilisateur@serveur-ovh
```

Ouvrir ensuite <http://localhost:1337/admin>. Un accès HTTPS pour les bénévoles
sera à préparer avant usage réel en production. L’import initial est désactivé par défaut en production (`SEED_CONTENT=false`).
Pour reprendre l’instantané public sur une nouvelle base, activer temporairement
`SEED_CONTENT=true` dans `.env.production`, démarrer le CMS, puis remettre `false`
et le recréer après vérification. Pour une base vierge, activer aussi `IMPORT_MEDIA=true` et fournir le dossier de galerie. Après migration, remettre cette variable à `false`. Les médias affichés par le site proviennent du volume `uploads` de Strapi. Restaurer ensemble ce volume et la base permet de conserver toutes les publications et leurs fichiers.

## Sauvegarde et mises à jour

Sauvegarder PostgreSQL et les fichiers de `uploads` ensemble avant toute mise à
jour du CMS. Exemple de sauvegarde de base (hors dépôt) :

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T db pg_dump -U vertical -d vertical > vertical.sql
```

Compléter par l’archivage du volume de médias et une copie hors serveur. Tester
la restauration dans une instance séparée. Conserver les fichiers de
configuration et les secrets de façon sécurisée.

L’image CMS de production utilise l’utilisateur `node` (UID/GID 1000). Après une
restauration du volume de médias depuis le développement ou une archive créée
par `root`, rendre les fichiers de `uploads` accessibles en écriture à cet
utilisateur avant de tester les téléversements. Un volume neuf créé depuis
l’image de production possède déjà les droits de son répertoire d’origine.

Pour mettre à jour, sauvegarder, changer `IMAGE_TAG`, tirer les deux images puis
recréer les services. Revenir aux anciennes images ne suffit pas toujours après
une migration de base Strapi : le retour arrière doit inclure une restauration
compatible. Les versions majeures PostgreSQL exigent leur propre procédure de
migration de données.

## Données de la galerie

Les originaux de galerie ne sont pas inclus dans Git ou dans les images Docker.
En local, `frontend/public/gallery/` est monté en lecture seule dans le **CMS** sous
`/app/legacy-gallery` pour la migration initiale. Sur OVH, copier ce dossier et
renseigner `GALLERY_DIRECTORY` avant la première migration, avec `IMPORT_MEDIA=true`.
Ensuite, le site utilise les médias gérés dans `uploads`, sans montage photo dans
Nuxt. Voir les [instructions de reprise](08-reprise-des-contenus.md) et le
[guide d’administration](10-administration-medias-et-horaires.md).
