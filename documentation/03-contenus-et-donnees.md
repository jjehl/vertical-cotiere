# 03 — Modèle de contenus retenu

Le modèle courant privilégie une saisie unique et quelques formulaires dédiés.
Les paiements et réponses aux sondages restent dans les services externes.

| Type administrable | Usage et champs essentiels |
| --- | --- |
| **Publication** | Titre, texte, photos et documents facultatifs. Adresse, date et aperçu automatiques. |
| **Rendez-vous dans l’agenda** | Bloc facultatif de la publication : début, fin facultative, journée entière, lieu, participation et état. |
| **Page et ressources** | Présentation et pages stables, fichiers joints et documents officiels sélectionnés. |
| **Activité** | Présentation de la compétition, des sorties nature et des cours, avec couverture et pièces jointes. |
| **Document du club** | Titre, rubrique, présentation, fichier remplaçable à adresse stable. |
| **Horaires et UFRAPS** | Type unique : saison, créneaux de cours, dates de saison, fermetures et plannings joints. |

## Une seule publication pour le quotidien

Une publication peut être une annonce, un rendez-vous ou un compte rendu, avec ou
sans photos. La présence de son bloc rendez-vous alimente l’agenda. Le même
contenu alimente le fil et les aperçus de l’accueil. Ajouter des photos après une
sortie ne nécessite pas une fiche album distincte.

Les anciennes collections Actualité, Événement et Album photo sont conservées
uniquement comme archives de reprise, masquées dans l’administration. Les API du
site lisent les publications. Les anciennes adresses et les UID ICS sont repris.
Le [guide des publications](11-publications-vie-du-club.md) décrit le formulaire
et les règles de migration des 116 contenus.

## Règles de gestion

- Le titre est le seul champ éditorial obligatoire ; un rendez-vous exige aussi son début.
- L’adresse est générée à la création et conservée lors des modifications du titre.
- Le résumé est extrait du texte. La couverture utilise la première photo, sauf choix explicite d’une autre couverture.
- Le mode brouillon/publication s’applique aux publications et aux autres fiches éditoriales. Seules les versions publiées sont servies.
- L’état prévu/complet/annulé/reporté du rendez-vous reste distinct du statut de publication.
- Les dates et heures s’affichent dans Europe/Paris. L’export ICS des journées entières utilise une fin exclusive ; le formulaire demande le dernier jour inclus.
- Sans fin précisée, aucun horaire ou durée n’est inventé. Les fins antérieures au début sont refusées.
- Une échéance passée ferme l’appel à participer ; le contenu reste consultable. Un rendez-vous annulé reste dans le flux avec son état.
- Les cours hebdomadaires et les fermetures UFRAPS restent dans leur planning dédié, distinct des rendez-vous ponctuels.
- Les images et documents sont choisis dans la médiathèque. Les légendes et fichiers sont partagés entre leurs utilisations.

## Informations stables et périmètre

Les partenaires, logos, certains textes d’accueil, coordonnées et liens
d’inscription restent dans le code conformément au choix du projet. Les lieux,
saisons et coordonnées ne constituent pas des collections autonomes supplémentaires.
Les formulaires [médias, documents et horaires](10-administration-medias-et-horaires.md)
couvrent les autres mises à jour utiles au club.

Le site stocke les contenus publics et les comptes des bénévoles autorisés.
Il ne stocke ni paiements, ni certificats, ni questionnaires de santé, ni réponses
aux sondages, ni liste des adhérents. Les URL HelloAsso et Framadate sont des
liens éditables, sans intégration API implicite.
