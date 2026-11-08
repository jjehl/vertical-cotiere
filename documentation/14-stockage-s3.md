# Stockage des médias avec S3

Les contenus et utilisateurs restent dans PostgreSQL. Les fichiers de la médiathèque sont stockés dans SeaweedFS en local et dans le bucket S3 OVH `vertical-cotiere-data`, avec des préfixes `re7/` et `prod/` distincts.

## Local

```sh
node scripts/init-env.mjs
docker compose up -d --build
```

Le script ajoute des identifiants S3 aléatoires au `.env` existant sans remplacer les secrets. SeaweedFS 4.52 démarre en mode `mini`, crée le bucket `vertical-media` et conserve les objets dans le volume `seaweedfs_data`. Seul le port S3 est publié sur `127.0.0.1:8333` (modifiable avec `S3_PORT`). Les interfaces d'administration ne sont pas publiées. Les écritures nécessitent les identifiants du `.env` ; les objets sont lisibles anonymement pour les médias publics du site.

Strapi envoie les fichiers à `http://seaweedfs:8333` et enregistre des URL navigateur `http://localhost:8333/vertical-media/...`. Le frontend conserve ses routes `/media/:id` et `/document-files/:slug` : il vérifie l'accès via Strapi, puis lit le bucket par le réseau Docker. Les requêtes vers un autre domaine ou bucket et les redirections sont refusées. La médiathèque d'administration utilise directement l'URL publique.

Une modification de `S3_PORT` ou du domaine public après des uploads nécessite aussi la mise à jour des URL déjà enregistrées en base.

## OVH : recette et production

Le bucket fourni est `vertical-cotiere-data` en région GRA. Utiliser idéalement des clés distinctes limitées aux préfixes de chaque environnement. Les identifiants ne doivent pas être partagés avec le local. Dans `vertical_deployments.re7` et `.prod` de l'inventaire Ansible, renseigner :

```yaml
s3_endpoint: https://s3.gra.io.cloud.ovh.net
s3_region: gra
s3_bucket: vertical-cotiere-data
s3_public_url: https://vertical-cotiere-data.s3.gra.io.cloud.ovh.net
s3_root_path: re7 # prod pour la production
s3_force_path_style: true
migrate_local_media: false
```

Reprendre les valeurs exactes et l'URL publique fournies par OVH ; les exemples ne créent aucun bucket. `s3_public_url` désigne la racine des objets du bucket, sans slash final. Chiffrer `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY` sous `vault_vertical_credentials.re7` et `.prod` dans `vault-vertical.yml` avec `ansible/scripts/set-vault-value.py`. Exécuter depuis `infra-ovh/ansible` pour chaque environnement (remplacer `re7` par `prod` pour la production) :

```sh
python3 scripts/set-vault-value.py inventory/group_vars/all/vault-vertical.yml vault_vertical_credentials.re7.S3_ACCESS_KEY_ID
python3 scripts/set-vault-value.py inventory/group_vars/all/vault-vertical.yml vault_vertical_credentials.re7.S3_SECRET_ACCESS_KEY
```

Le playbook refuse une configuration S3 absente. Les valeurs non secrètes restent dans l'inventaire ; les secrets sont injectés dans le `cms.env` protégé du serveur.

Le provider utilise `public-read` pour les objets : cette configuration concerne uniquement des médias pouvant être publics, y compris ceux téléversés avant publication. Ne pas y placer des documents confidentiels ou réservés aux adhérents. Si OVH impose une politique de bucket pour la lecture publique, l'ajuster au niveau des objets sans autoriser les écritures publiques. Vérifier aussi les CORS pour les domaines du site et de l'administration selon les usages navigateur.

Aucun SeaweedFS n'est installé sur les serveurs. Appliquer le playbook applicatif puis déployer les nouvelles images selon la procédure habituelle. Le Compose autonome `deploy/compose.production.yaml` utilise les mêmes variables S3 mais n'est pas la configuration administrée par Ansible.

## Médias déjà présents

Le volume `uploads` est conservé. Une migration au démarrage transfère les fichiers `provider: local`, avec toutes leurs variantes, puis met à jour les URL sans modifier les identifiants ni les relations. Les sources locales ne sont pas supprimées. Une erreur interrompt le démarrage et laisse la ligne concernée en local ; les lignes déjà transférées sont ignorées au prochain lancement. Ne pas supprimer le bucket pendant une migration.

En local, `MIGRATE_LOCAL_MEDIA=true` est activé pour reprendre les imports historiques après leur création. En recette et production, sauvegarder d'abord **la base et le volume uploads**, puis activer `migrate_local_media: true`, appliquer Ansible et redémarrer le CMS sur la nouvelle image. Après validation des médias et miniatures, désactiver cette option. Une sauvegarde PostgreSQL seule ne sauvegarde pas les objets S3 : prévoir également la protection et la sauvegarde des buckets.

Pour revenir à une sauvegarde antérieure, restaurer ensemble la base et les fichiers correspondants. Désactiver le provider ne réécrit pas les URL S3 existantes.

## Vérifications

```sh
node --test cms/tests/storage.test.js
node --experimental-strip-types --test frontend/tests/media-url.test.ts
docker compose run --rm --no-deps cms node tests/storage.integration.js
docker compose run --rm --no-deps -e S3_ROOT_PATH=re7-check cms node tests/storage.integration.js
```

Le test d'intégration écrit puis supprime un objet temporaire. Il vérifie upload authentifié, lecture publique, HEAD, Range, suppression et refus des écritures anonymes.
