# Assistant de publication dans Strapi

## Utilisation

Le menu **Assistant de publication** permet de créer une publication à partir
d’une demande en français : actualité, compte rendu avec photos, ou rendez-vous
qui apparaîtra aussi dans l’agenda.

1. Décrire le contenu, les dates et le lieu si nécessaire.
2. Joindre éventuellement des photos (30 maximum, 20 Mo par photo dans l’interface).
3. Cliquer sur **Préparer la proposition**. Une demande ambiguë peut entraîner une
   question : compléter le texte et relancer.
4. Vérifier le texte, les dates françaises et les photos. Choisir **Enregistrer le
   brouillon** ou **Confirmer et publier** si votre rôle permet la publication.

La rubrique proposée (cours, compétition, sortie, stage ou vie du club) est aussi
visible dans l’aperçu et sert aux filtres de l’agenda. Pour la corriger, préciser
la catégorie souhaitée dans la demande puis préparer une nouvelle proposition.

La préparation n’écrit aucune publication. Les photos sont importées dans la
médiathèque dès leur sélection ; elles y restent si la proposition est abandonnée.
Les photos ne sont pas envoyées au modèle, seul le texte de la demande et leur
nombre le sont. Les fichiers suivent ensuite les mêmes règles de publication
que les autres médias du site. Retirer une photo de la sélection ne supprime pas
le fichier de la médiathèque.

Cette première version crée de nouvelles publications. Les corrections, documents,
horaires, fermetures et suppressions restent dans les formulaires habituels Strapi.
L’assistant ne consulte pas les publications existantes et ne vérifie pas les faits.
Il faut relire la proposition. Une structure JSON correcte ne garantit pas que
les dates et les informations correspondent à l’intention de l’auteur.

## Modèle et coût

Choix initial : **Ministral 3 8B**, identifiant fixé `ministral-8b-2512`, appelé
via l’API Mistral depuis Strapi. Pas de modèle à installer sur le serveur OVH et
pas de service Docker supplémentaire. Le choix vise un coût faible et une tâche
limitée d’extraction/rédaction. Sa qualité et sa latence réelles restent à évaluer
avec les demandes du club et une clé valide.

Au 7 novembre 2026, Mistral affiche **0,15 USD par million de jetons en entrée et
0,15 USD par million en sortie** pour ce modèle. Exemple purement indicatif :
1 500 jetons en entrée et 500 en sortie coûtent environ **0,0003 USD par demande**,
soit **0,30 USD pour 1 000 demandes**, hors taxes et évolution des tarifs.
La taille réelle inclut les instructions système et le schéma.
Sources : [fiche officielle du modèle](https://docs.mistral.ai/models/ministral-3-8b-25-12),
[tarifs Mistral](https://docs.mistral.ai/inference/pricing),
[sorties structurées](https://docs.mistral.ai/inference/conversations/structured-output/custom).

`MISTRAL_MODEL` permet de changer le modèle sans reconstruire les images ; utiliser
un modèle compatible avec les sorties JSON Schema. Aucun basculement automatique
vers un modèle plus cher. L’API est limitée à 1 800 jetons en sortie, 20 secondes
de délai réseau et 30 préparations par heure par administrateur, deux au maximum
simultanément pour cette instance CMS. Les demandes ne sont pas relancées
automatiquement. Le formulaire classique reste utilisable sans clé ou sans Mistral.

## Local : fichier `.env` privé

```bash
node scripts/init-env.mjs
```

Le script conserve les secrets existants et ajoute les paramètres IA manquants.
Dans le `.env` à la racine, renseigner avec votre éditeur :

```dotenv
MISTRAL_API_KEY=remplacer_par_votre_cle
MISTRAL_MODEL=ministral-8b-2512
```

Puis appliquer la configuration :

```bash
docker compose up -d --force-recreate cms
```

Un simple `restart` ne recharge pas les variables d’environnement. Ne pas mettre
la clé dans le code, les paramètres publics Nuxt ou une variable `STRAPI_ADMIN_*`.
Seul le conteneur `cms` reçoit cette clé.

## OVH : clé déployée depuis les Secrets GitHub

La clé de production se renseigne **dans GitHub**, puis le workflow
[Déployer la clé Mistral sur OVH](../.github/workflows/deploy-mistral-secret.yaml)
la transmet au serveur par SSH. Il n’est plus nécessaire de saisir la clé Mistral
à la main dans un fichier sur OVH.

### Configuration initiale

Dans le dépôt GitHub : **Settings → Environments → New environment**, créer
l’environnement **production**. Y ajouter les secrets suivants :

| Secret | Valeur |
| --- | --- |
| `MISTRAL_API_KEY` | Clé API Mistral de production |
| `OVH_SSH_PRIVATE_KEY` | Clé privée SSH dédiée à l’accès de la CI au serveur, sans passphrase pour l’automatisation |
| `OVH_SSH_KNOWN_HOSTS` | Entrée `known_hosts` du serveur OVH, vérifiée par son empreinte |

Ajouter également ces **variables** dans le même environnement :

| Variable | Valeur |
| --- | --- |
| `OVH_HOST` | Nom DNS ou IPv4 du serveur, sans `https://` |
| `OVH_USER` | Compte SSH de déploiement, par exemple `deploy` |
| `OVH_PORT` | Port SSH, facultatif : `22` par défaut |
| `OVH_DEPLOY_PATH` | Dossier de production, facultatif : `/srv/vertical-cotiere` par défaut |

L’accès SSH se prépare une fois : installer la clé publique correspondante dans
`authorized_keys` du compte de déploiement, si cet accès CI n’existe pas encore.
Ce compte doit pouvoir utiliser Docker sans invite `sudo`, écrire dans le dossier
de production et disposer de Python 3. Le serveur doit déjà contenir
`compose.production.yaml`, un `.env.production` avec les autres paramètres et les
images de production installées. Laisser `MISTRAL_API_KEY` vide lors de cette
installation initiale : la CI la renseignera.

Pour obtenir l’entrée publique du serveur, utiliser par exemple
`ssh-keyscan -p 22 serveur-ovh`, puis **vérifier son empreinte par un accès de
confiance**, comme la console OVH, avant d’enregistrer `OVH_SSH_KNOWN_HOSTS`.
Pour un port différent de 22, l’entrée doit correspondre à `[hôte]:port`.
Le workflow exige cette entrée et n’accepte pas automatiquement une nouvelle
clé d’hôte. Aucun secret ne doit être fourni dans une issue ou un message.

Le workflow utilise l’environnement `production` et s’exécute uniquement depuis
`main`. On peut aussi limiter les branches autorisées dans les réglages de cet
environnement. Les secrets peuvent être saisis avec l’interface GitHub ou avec
`gh secret set MISTRAL_API_KEY --env production` (saisie interactive).
Source : [Secrets GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

### Envoyer ou changer la clé

Dans **Actions → Déployer la clé Mistral sur OVH → Run workflow**, choisir `main`
et lancer le workflow. Pour une rotation, remplacer le secret `MISTRAL_API_KEY`
dans l’environnement GitHub, puis relancer le même workflow. Modifier un secret
dans GitHub ne déclenche pas à lui seul une exécution.

Le workflow :

1. Transmet la clé par l’entrée standard d’une connexion SSH vérifiée, sans la
   placer dans les arguments de commande ni dans les logs.
2. Remplace uniquement `MISTRAL_API_KEY` dans le `.env.production` existant, par
   écriture atomique avec des droits `600`. Les autres paramètres sont conservés.
3. Vérifie que le Compose transmet la valeur attendue au CMS, puis recrée **cms**
   et attend son état sain, sans reconstruire ni télécharger d’image.
4. Si l’application échoue, restaure le fichier précédent et tente de remettre
   le CMS dans son ancienne configuration. Un échec du rétablissement est signalé.

Le fichier privé reste sur OVH pour les démarrages et déploiements suivants :
les commandes `docker compose --env-file .env.production …` restent identiques.
Les fichiers `.env` / `.env.production` sont exclus de Git et du contexte Docker.
La clé n’entre dans aucune image ou artefact. Le workflow de **construction**
continue de fonctionner sans clé Mistral ; seul ce workflow de **déploiement de
clé** reçoit les secrets de production. La livraison des nouvelles images reste
indépendante et manuelle dans cette version.

L’accès à Docker ou au compte de déploiement permet de lire les variables du CMS.
Le succès du workflow confirme que le CMS a redémarré avec sa configuration ; il
ne vérifie pas la validité de la clé auprès de Mistral et ne consomme aucun jeton.
Les tests locaux vérifient le transfert simulé, la préservation des autres
paramètres, les permissions, les caractères spéciaux et le rétablissement après
échec. Un premier lancement réel nécessite de configurer l’environnement GitHub
et l’accès OVH.

## Permissions et validation

Le plugin expose uniquement des routes d’administration authentifiées, protégées
par le droit **Utiliser l’assistant de publication**. Pour les rôles autres que
Super Admin, attribuer aussi les droits nécessaires sur **Publication** : création
et champs concernés, publication pour rendre le bouton correspondant disponible,
ainsi que le téléversement dans la médiathèque pour ajouter des photos.

Les contrôles serveur Strapi filtrent les champs et revérifient les droits à la
confirmation. Les photos jointes doivent avoir été importées par l’administrateur
connecté. Le LLM ne choisit aucun identifiant de média et ne dispose d’aucun outil
pour écrire en base ou lire les secrets.

Les aperçus sont conservés en mémoire côté serveur, liés au compte et expirent
après 15 minutes ou au redémarrage du CMS. La confirmation ignore tout contenu
éditorial supplémentaire envoyé par le navigateur et crée le contenu dans une
transaction ; une répétition de la même confirmation ne recrée pas de publication
tant que l’aperçu est conservé. Cette première version vise une seule instance CMS.

Les dates locales sont converties en Europe/Paris par le serveur. Les dates
impossibles, heures ambiguës de changement d’heure, liens dangereux, réponses
incomplètes et chronologies incohérentes sont refusés avant écriture.

Les tests utilisent une réponse Mistral simulée dans un projet Compose isolé,
sans vraie clé ni facturation. Ils vérifient le circuit technique ; ils ne
constituent pas une évaluation du modèle réel.

Vérifications réalisées : quatre tests de validation/dates, recette HTTP des
permissions et publications avec téléversement natif des photos, parcours réel
de l’assistant dans Chromium, neuf parcours du site, construction de l’image CMS
de production et démarrage sans clé. Les scénarios d’authentification, de
publication et de photos ont également été vérifiés dans l’image de production.
Les tests IA sont intégrés à GitHub Actions et nettoient les publications qu’ils
créent avant les tests du site.
