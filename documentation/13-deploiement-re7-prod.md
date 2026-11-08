# Livraison Ansible sur OVH : re7 et prod

## Contrat de livraison

- Chaque push sur **`main`** lance la CI existante (tests frontend, CMS et
  parcours navigateur), construit les deux images et les publie sur GHCR avec
  le **SHA complet du commit**, puis déploie en **`re7`**.
- Publier une release stable **`X.Y.Z`**, par exemple **`1.0.0`**, déclenche les
  mêmes vérifications puis un déploiement en **`prod`**. Le tag seul ne suffit pas.
- Les tags `v1.0.0`, préversions et brouillons ne déclenchent pas de déploiement
  production valide. Le commit d'une release doit appartenir à `main`.
- Les pull requests et lancements manuels vérifient/construisent sans publier
  ni déployer. Une ancienne CI recette est ignorée si `main` a avancé au moment
  du déploiement ; elle ne remplace donc pas une version plus récente.

Les deux images sont exécutées par digest SHA256, avec contrôle du label de
révision Git. La version SemVer/SHA sert de référence de livraison, pas de
paramètre permettant de choisir un autre dépôt d'images ou un autre Compose.

## 1. Préparer le VPS avec infra-ovh

Le guide `infra-ovh/documentation/deploiement-applicatif.md` décrit l'inventaire,
les quatre domaines, le Vault, les clés et l'installation. Les modèles sont :

- `infra-ovh/ansible/vertical-hosts.example.yml` ;
- `infra-ovh/ansible/vertical-vault.example.yml`.

La configuration crée `deploy_vertical_re7` et `deploy_vertical_prod` et installe
un Compose root par environnement. La CI du site n'utilise ni clé administrateur
ni mot de passe Vault. Les secrets applicatifs (dont Mistral si nécessaire) sont
gérés dans le Vault d'infrastructure, puis écrits dans des fichiers root-only.
Le workflow historique de rotation Mistral est remplacé par ce mécanisme.

Le Compose automatique est maintenu dans `infra-ovh`, et non copié depuis ce dépôt.
Les fichiers `deploy/compose.production.yaml` et `compose.traefik.yaml` sont des
références historiques de déploiement manuel. Pour changer les réseaux, volumes,
ports ou paramètres privilégiés, modifier le template d'infrastructure et le
réappliquer en administrateur.

## 2. Configurer GitHub

Créer deux environnements GitHub nommés exactement **`re7`** et **`prod`**.
Dans chacun :

| Type | Nom | Valeur |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | Clé privée dédiée à cet environnement, sans phrase secrète |
| Secret | `DEPLOY_KNOWN_HOSTS` | Ligne(s) known_hosts de l'hôte, empreintes vérifiées via OVH |
| Variable | `OVH_HOST` | IP ou nom SSH du VPS |
| Variable | `OVH_PORT` | `22` ou laisser vide pour 22 |

Installer les clés publiques correspondantes dans l'inventaire infra avant
le premier workflow. Ne jamais mettre les clés privées dans le dépôt.
Pour des images privées, autoriser le token du VPS à lire les packages GHCR
`vertical-cotiere-web` et `vertical-cotiere-cms`. La CI publie avec `GITHUB_TOKEN`.

Protéger `main` et les tags/releases de production. Restreindre l'environnement
`re7` à la branche `main`, et `prod` aux tags de release appropriés. Une revue
requise sur `prod` rendra le déploiement conditionnel à cette validation ; sans
cette protection, la publication de la release suffit. Les protections disponibles
dépendent du compte et de la visibilité du dépôt.

La branche principale reste **`main`**, déjà utilisée par le dépôt.
Aucun renommage de branche n’est nécessaire.

## 3. Déployer

Après fusion/push sur `main`, suivre les jobs `plan`, `check`, `images`, `deploy`.
Les images publiées sont :

```text
ghcr.io/jjehl/vertical-cotiere-web:SHA_COMPLET
ghcr.io/jjehl/vertical-cotiere-cms:SHA_COMPLET
```

Pour la production, créer le tag `1.0.0` sur le commit choisi de `main`, puis
publier une GitHub Release utilisant ce tag. Les images portent alors `:1.0.0`.
La release reconstruit les images du commit ; ce n'est pas une promotion des
binaires de recette. La commande serveur vérifie les digests et la révision.
La plateforme de build reste `linux/amd64`, comme le parcours existant.

## Fonctionnement Ansible et permissions

`deploy/ansible/deploy.yml` orchestre depuis le runner local : validation des
paramètres, SSH avec vérification d'hôte, puis attente du résultat de la commande
serveur. Il n'envoie pas de modules ni de fichiers au compte restreint, puisque
celui-ci refuse shell libre, SFTP et SCP. Les opérations privilégiées sont
exclusivement réalisées par la procédure root installée par `infra-ovh`.

Le serveur n'accepte que :

```text
deploy VERSION WEB_DIGEST CMS_DIGEST COMMIT
```

La CI ne peut pas fournir de Compose, de chemin de volume, de variable Docker
ni changer d'environnement avec une clé recette. Les jobs sont sérialisés par
environnement et le serveur utilise aussi un verrou. Un échec remonte comme
échec du workflow. Les sorties susceptibles de contenir des secrets sont masquées
par la procédure serveur, pas seulement par la rédaction des logs GitHub.

## Données, première installation et reprise

Les environnements ont des bases et volumes distincts. Le déploiement ne copie
jamais la base recette vers la production et n'importe pas automatiquement les
1,5 Go de galerie. Le premier démarrage a `SEED_CONTENT=false` et `IMPORT_MEDIA=false` :
créer le compte administrateur Strapi sur chaque domaine CMS puis organiser la
restauration/import des contenus et médias. La migration éditoriale initiale doit
être traitée séparément, sans exposer un montage arbitraire au compte CI.

Les migrations internes Strapi peuvent s'exécuter au démarrage. Un dump PostgreSQL
local est réalisé après démarrage/contrôle de PostgreSQL et avant le nouveau CMS. Il ne remplace
pas une sauvegarde externe OVH ni une sauvegarde des uploads. Surveiller le disque.
La recette est publique par défaut avec un en-tête noindex ; ce n'est pas une
protection contre la consultation.

Pas de rollback automatique : une migration de schéma peut rendre l'ancienne
image incompatible. Pour rejouer une livraison, relancer le seul job de déploiement
avec les digests précédemment construits. Une version déjà enregistrée ne peut
pas être réassignée à d'autres images ; publier un nouveau SemVer pour corriger
une release. Le guide infra décrit les manifestes et la procédure administrateur.

## Domaines retenus

| Environnement | Site | CMS |
| --- | --- | --- |
| re7 | `vertical-cotiere.re7.jehl.org` | `vertical-cotiere-admin.re7.jehl.org` |
| prod | `vertical-cotiere.jehl.org` | `vertical-cotiere-admin.jehl.org` |

Les domaines sont renseignés dans l'inventaire local de l'infrastructure.
Les listes de clés de déploiement sont encore vides. Ajouter les clés et les
credentials au Vault avant d'exécuter `applications` ou `site`.
Aucun enregistrement DNS ni service distant n'est modifié par l'édition de ces fichiers.
