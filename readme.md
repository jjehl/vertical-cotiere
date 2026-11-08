# Vertical Cotière

Projet de refonte du site de l’association d’escalade Vertical Côtière.

Nuxt / Vue 3, Strapi et PostgreSQL. Développement et exécution avec Docker Compose.

## Lancer en local

Prérequis : Docker, Docker Compose v2.24.4 ou ultérieur et Node.js pour générer le fichier local de secrets.

Sur une base neuve, restaurer d’abord `frontend/public/gallery/` depuis une sauvegarde
ou lancer `python3 scripts/import-public-gallery.py` tant que la source reste disponible.
La première migration vers la médiathèque nécessite ces fichiers.

```bash
node scripts/init-env.mjs
docker compose up --build -d --wait --wait-timeout 300
```

- Site : <http://localhost:3000>
- Administration : <http://localhost:1337/admin> — créer le premier compte administrateur.
- Le premier démarrage reprend les contenus publics : 38 pages et 116 publications issues des actualités, événements et albums, sans écraser les modifications ultérieures.
- Les sources sont montées pour le rechargement local. Après un changement de dépendances, reconstruire les images.

```bash
docker compose logs -f
docker compose exec web npm run test
docker compose exec web npm run typecheck
docker compose down
```

`down` conserve les volumes. Ne pas ajouter `-v` pour un arrêt ordinaire.

## Assistant de publication (facultatif)

Dans Strapi, **Assistant de publication** prépare une actualité ou un rendez-vous
à partir de texte libre et de photos, avec aperçu avant enregistrement/publication.
Renseigner `MISTRAL_API_KEY` dans le `.env` local puis exécuter
`docker compose up -d --force-recreate cms`. Le modèle par défaut est
`ministral-8b-2512`. Sans clé, les formulaires habituels restent disponibles.

Sur OVH, les secrets sont gérés dans le Vault du dépôt `infra-ovh`, séparément
pour la recette et la production. Les images ne contiennent pas de clé Mistral.

## Livraison

Un push sur **main** lance les tests, publie les images versionnées par le SHA
complet et déploie en **re7** avec Ansible. Publier une release stable **1.0.0**
déploie en **prod**. Les deux environnements ont des comptes SSH restreints et
des données séparées. Les prérequis sont détaillés dans le
[guide de livraison re7/prod](documentation/13-deploiement-re7-prod.md).

La [documentation](documentation/README.md) décrit l’existant, les choix techniques,
le [fonctionnement Docker et CI](documentation/06-docker-et-ci.md) et
[l’avancement de cette première version](documentation/07-design-et-avancement.md).

Les [horaires et l’agenda sont repris localement](documentation/08-reprise-des-contenus.md), avec 141 fichiers disponibles, 39 documents téléchargeables et les exports ICS.

La galerie comprend aussi 55 albums et 1 105 photos publiques. Les fichiers (1,5 Go) sont conservés hors Git dans `frontend/public/gallery/` pour la reprise, puis gérés dans la médiathèque Strapi et son volume `uploads`. Leur copie sur OVH est décrite dans le bilan de reprise.

Sur un nouveau poste, restaurer le dossier photo depuis une sauvegarde ou lancer `python3 scripts/import-public-gallery.py` tant que la galerie source reste disponible. La construction des images Docker ne dépend pas de ces téléchargements.

Les [photos, documents et horaires/UFRAPS s’administrent dans Strapi](documentation/10-administration-medias-et-horaires.md), avec des sélecteurs de médias et des formulaires sans JSON.

## Publier la vie du club

Dans Strapi, utiliser **Publication** : titre, texte et photos/documents facultatifs.
Ajouter le bloc **Rendez-vous dans l’agenda** pour afficher cette même fiche dans
le calendrier. L’accueil se remplit automatiquement. Les anciennes adresses restent
utilisables. Voir le [guide du formulaire unique](documentation/11-publications-vie-du-club.md).
