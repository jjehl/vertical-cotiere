# 05 — Migration et étapes de réalisation proposées

## 1. Valider les contenus et le fonctionnement

Faire relire l’inventaire par le bureau. Identifier qui rédige, qui publie et qui
assure la maintenance. Confirmer les horaires, les campagnes de saison, les
documents en vigueur et les conditions de participation aux activités.

Essayer le CMS avec un scénario concret : créer une publication, lui ajouter un rendez-vous, modifier son
horaire, joindre des photos et remplacer un document. Ce test doit précéder
la migration des contenus vers Strapi. Le maintien de WordPress est exclu.

## 2. Préparer la reprise

Obtenir un export WordPress et les médias auprès de l’administrateur, puis une
sauvegarde complète restaurable. Recenser articles, pages, événements,
catégories, documents et liens de participation. L’exploration publique seule ne
permet pas de récupérer les brouillons, réglages et archives privées.

Construire une table de migration avec : ancienne URL, type, titre, saison,
décision (reprendre, actualiser, archiver), nouvelle URL et responsable de validation.
Conserver les dates originales des actualités et l’association des médias.

Pour chaque lien HelloAsso, Framaforms et Framadate, vérifier avec le club qu’il
est encore pertinent. Ne pas importer les réponses aux sondages par défaut.
Conserver le sous-domaine `sondage.vertical-cotiere.fr` et son service lors de la
bascule, sauf décision explicite de migration.

## 3. Construire la première version

Configurer les contenus et permissions, puis réaliser l’accueil, les pages du
club, les activités, horaires, accès, actualités, agenda et documents. Intégrer
les liens de participation. Reprendre les images avec leurs autorisations et
transcrire les plannings en données validées.

Préparer une recherche simple adaptée au volume réellement repris. Ajouter une
vue mensuelle interactive après fonctionnement de la liste d’événements.

## 4. Préserver les URL et le référencement

Exemples de correspondances **proposées**, à compléter par l’inventaire réel :

| Ancienne URL | Destination proposée |
| --- | --- |
| `/inscriptions_25-26/` | `/inscriptions/` |
| `/presentation/` | `/le-club/` |
| `/acces/` | `/horaires-et-acces/` |
| `/horaires/` | `/horaires-et-acces/` |
| `/contacts/` | `/contact/` |
| `/evenements/`, `/events/`, `/index.php/events/` | `/agenda/` |
| `/event/<slug>/` | Fiche équivalente `/agenda/<slug>/` |
| `/category/competitions/` | Archive équivalente des actualités de compétition |

Utiliser des redirections permanentes vers les contenus équivalents et préserver
les filtres utiles lorsque possible. Ne pas rediriger tous les anciens articles
vers l’accueil. Conserver les URL des PDF publics ou prévoir leurs redirections.

Inventorier aussi les URL d’abonnement ICS et maintenir leur compatibilité ou
préparer une transition explicite : les abonnements existants ne se mettent pas
nécessairement à jour comme une page web. Publier un sitemap et vérifier les liens
internes après import.

## 5. Recette et bascule

- Faire valider les contenus repris et les liens de saison par leurs responsables.
- Exécuter les parcours et critères de [recette fonctionnelle](02-besoins-et-parcours.md).
- Vérifier qu’un visiteur ne peut ni lire les brouillons ni écrire via l’API.
- Vérifier les événements à la journée, les exports et les changements d’heure.
- Contrôler les redirections, erreurs 404, images et téléchargements.
- Tester la restauration de la base et des médias en préproduction.
- Préparer un gel éditorial court ou un dernier import différentiel avant bascule.
- Conserver le domaine, ses emails et les sous-domaines utiles ; ne pas remplacer aveuglément tous les enregistrements DNS.
- Prévoir le retour à l’ancien site, sans l’exposer en doublon indexable pendant la transition.

Après bascule, contrôler les erreurs, les liens d’inscription et la fraîcheur de
l’agenda. Former les bénévoles et remettre les accès ainsi qu’un guide de
publication, de sauvegarde et de renouvellement de saison.

## Décisions restant à prendre

| Sujet | Hypothèse de départ | Effet sur le projet |
| --- | --- | --- |
| Budget et maintenance | Nuxt et Strapi sont exécutés avec Compose sur OVH | Prévoir un référent pour les mises à jour et sauvegardes |
| Administration | Les bénévoles passent sur Strapi | Former à la nouvelle interface ; aucun maintien de WordPress |
| Historique | Préserver les articles et documents utiles | Le volume d’archives conditionne l’effort d’import |
| Sondages | Garder le service actuel et ses liens | Un vote intégré nécessiterait un cadrage supplémentaire |
| Espace adhérent | Pas nécessaire au lancement | S’il devient prioritaire, revoir accès et données |
| Photos et réseaux sociaux | Albums repris dans les publications ; liens sociaux à valider | Les photos se gèrent désormais dans le formulaire unique |
| Source des horaires | Validation par un responsable de saison | Évite la divergence entre le site et HelloAsso |
