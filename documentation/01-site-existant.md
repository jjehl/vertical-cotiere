# 01 — Description du site existant

## Identité et rôle — observé

Vertical Côtière est un club d’escalade lié au territoire de la Communauté de
Communes de Miribel et du Plateau, affilié à la FFME. Le site présente les cours,
la pratique autonome, la compétition et les activités en extérieur. La présentation
mentionne les cours dès 4 ans et une activité baby escalade pour les 2–4 ans.
Le principal lieu de pratique est le gymnase du collège Louis Armstrong à Beynost ;
un autre mur est proposé à Villeurbanne. Source : [présentation du club](https://www.vertical-cotiere.fr/presentation/).

Le site remplit deux rôles : faire découvrir l’association aux futurs adhérents et
transmettre les informations pratiques aux familles et aux membres.

## Arborescence publique

Le tableau reprend les rubriques et liens du menu HTML de
[l’accueil](https://www.vertical-cotiere.fr/). La présence dans le menu ne garantit
pas que chaque page soit complète ou encore pertinente.

| Ensemble | Pages et ressources repérées |
| --- | --- |
| Informations | [Présentation](https://www.vertical-cotiere.fr/presentation/), [protocole sanitaire](https://www.vertical-cotiere.fr/protocole-sanitaire/), [inscriptions](https://www.vertical-cotiere.fr/inscriptions_25-26/), [horaires](https://www.vertical-cotiere.fr/horaires/), [accès aux murs](https://www.vertical-cotiere.fr/acces/), [contacts](https://www.vertical-cotiere.fr/contacts/), [réseaux sociaux](https://www.vertical-cotiere.fr/reseaux-sociaux/), [location de chaussons](https://www.vertical-cotiere.fr/location-chaussons/) |
| Vie associative | Règlement intérieur et procès-verbal de la dernière AG, proposés en PDF dans le menu |
| Compétitions | [Présentation](https://www.vertical-cotiere.fr/competition/), [équipe départementale](https://www.vertical-cotiere.fr/equipe-departementale/), [articles](https://www.vertical-cotiere.fr/category/competitions/), [Coupe de l’Ain](https://www.vertical-cotiere.fr/coupe-de-lain/), règles du jeu en PDF |
| Stages | [Présentation](https://www.vertical-cotiere.fr/stages/), [baby escalade](https://www.vertical-cotiere.fr/stages/baby-escalade/), [découverte](https://www.vertical-cotiere.fr/stages/decouverte/), [perfectionnement](https://www.vertical-cotiere.fr/stages/perfectionnement/) |
| Sorties | [Présentation](https://www.vertical-cotiere.fr/sorties/), [falaises](https://www.vertical-cotiere.fr/sorties-falaises/), [randonnées](https://www.vertical-cotiere.fr/sorties-randonnees/) |
| Calendrier | [Agenda](https://www.vertical-cotiere.fr/evenements/) ; sous-catégories compétitions, Coupe de l’Ain, coupes régionales, stages baby/découverte/perfectionnement, sorties falaise/mur/ski de randonnée |
| Albums | [Page albums](https://www.vertical-cotiere.fr/albums/) |
| Partenaires | [Partenaires](https://www.vertical-cotiere.fr/partenaires/), [bons plans](https://www.vertical-cotiere.fr/category/bon-plan/), avantages FFME/Vieux Campeur et Bloc Session, [cordonnier](https://www.vertical-cotiere.fr/cordonnier/), [clubs de grimpe](https://www.vertical-cotiere.fr/partenaires/clubs-dans-lain/) |
| Ressources | [Liens](https://www.vertical-cotiere.fr/liens/), [lectures](https://www.vertical-cotiere.fr/lectures/), [projet pédagogique](https://www.vertical-cotiere.fr/projet-pedagogique-du-club-vertical-cotiere/), [fiches sécurité](https://www.vertical-cotiere.fr/fiches-securite/), [prévention FFME](https://www.vertical-cotiere.fr/ffme-lettres-prevention-securite/), [fiches techniques](https://www.vertical-cotiere.fr/fiches-techniques/), documents d’encadrement et règles de sécurité |

## Fonctionnalités et usages — observé

| Fonction | Fonctionnement public et source |
| --- | --- |
| Informations prioritaires | L’[accueil](https://www.vertical-cotiere.fr/) juxtapose annonces de saison, stages, baby escalade, règlement et rappel myFFME ; un bloc de prochain événement est également présent dans son HTML. |
| Fil d’information | Articles datés, auteurs, catégories, étiquettes et archives ; voir les [articles de compétition](https://www.vertical-cotiere.fr/category/competitions/). Il ne s’agit pas d’un fil social dont le temps réel aurait été vérifié. |
| Recherche | Champ de recherche global dans l’en-tête ; recherche par mot-clé dans l’agenda. Présence des contrôles observée, pertinence des résultats non testée. |
| Agenda | Vues mois, liste et jour, navigation par date, fiches d’événements et catégories. Liens d’abonnement Google Agenda, iCalendar, Outlook et exports ICS dans [l’agenda](https://www.vertical-cotiere.fr/evenements/). Les abonnements n’ont pas été testés dans ces applications. |
| Sondages et participation | Des articles renvoient vers `sondage.vertical-cotiere.fr` et nomment Framadate ; exemple : [sortie à Crept](https://www.vertical-cotiere.fr/sortie-crept-20-09-26/). Les règles de vote et l’administration ne sont pas vérifiées. |
| Inscriptions et paiements | La [page inscriptions](https://www.vertical-cotiere.fr/inscriptions_25-26/) renvoie vers HelloAsso ; elle explique aussi les réductions, remboursements, attestations et services annexes. Les stages peuvent également renvoyer vers HelloAsso. |
| Remboursements | Lien vers un formulaire Framaforms depuis les inscriptions, avec justificatifs déposés au gymnase et échéance saisonnière. Aucun formulaire n’a été soumis. |
| Horaires | Planning présenté sous forme d’images et lien PDF pour une répartition de cours ; dates d’ouverture du mur UFRAPS. Source : [horaires](https://www.vertical-cotiere.fr/horaires/). |
| Accès | Deux lieux accompagnés d’adresses, de liens d’itinéraire et de cartes Google intégrées. Source : [accès](https://www.vertical-cotiere.fr/acces/). |
| Contacts | Bureau, conseil d’administration, encadrants et adresses par fonction. Source : [contacts](https://www.vertical-cotiere.fr/contacts/). La page indique une mise à jour au 05/01/2025. |
| Location | Service annuel de chaussons avec réservation HelloAsso et caution. Source : [location de chaussons](https://www.vertical-cotiere.fr/location-chaussons/). |
| Documents | Liens PDF pour règlements, sécurité, vie associative et compétition ; images et logos dans les pages. |
| Cookies | Bandeau avec texte d’acceptation par poursuite de navigation, bouton d’acceptation et lien d’information. Sa présence ne permet pas de déduire les traceurs réellement chargés. |

## Socle technique visible

Le HTML public de l’accueil expose les chemins `wp-content` : **WordPress**, thème
**Catch Box**, extension **The Events Calendar** et extension **EU Cookie Law**.
Ce sont des indices directement observables dans les URL des ressources ; les
paramètres de version des fichiers ne constituent pas un audit des versions
installées. Hébergeur, base de données, sauvegardes et autres extensions restent
inconnus.

## Points de reprise

- L’accueil contient encore des annonces d’octobre 2026 au 7 novembre : prévoir une date d’expiration des annonces.
- L’URL des inscriptions contient `25-26`, mais le titre concerne 2026/2027 : adopter une URL stable et une saison explicite.
- La page horaires associe un titre 2025–2026 et une image nommée `Horaires_26_27` ; la page inscriptions indique que les horaires HelloAsso font référence. Il faut choisir un responsable et une source unique pour chaque saison.
- Les horaires en images doivent être retranscrits en texte structuré, avec validation humaine des créneaux.
- La page baby escalade annonce deux créneaux mais en énumère trois : faire confirmer les heures et capacités avant reprise.
- La page compétition contient un lien interne avec `competitions__trashed` : vérifier sa destination et le remplacer si nécessaire.
- Les documents de plusieurs années coexistent : distinguer les documents en vigueur des archives.

## Méthode, couverture et limites

Lecture des pages publiques avec l’outil web, complétée par téléchargement du HTML
de l’accueil et de treize pages : horaires, accès, contacts, compétition, stages,
baby escalade, sorties, albums, réseaux sociaux, location, partenaires, agenda et
article de la sortie à Crept. Les liens du tableau ci-dessus servent d’inventaire
de départ ; les autres pages du menu n’ont pas toutes été lues en détail.

Les pages inscriptions, présentation, Coupe de l’Ain et archives d’articles ont
également été consultées via l’outil web ou ses résultats indexés ; ces derniers
peuvent refléter un état antérieur. Les téléchargements HTML ont permis de lire
l’agenda alors que certaines URL `/events/` échouaient dans l’outil web.

La tentative de lecture du PDF du règlement actuel a échoué dans l’outil web.
Les pages albums et réseaux sociaux ne fournissaient pas de contenu exploitable
dans l’extraction réalisée : leur fonctionnement reste à vérifier dans un
navigateur. Le sous-domaine de sondage n’a pas pu être inspecté avec l’outil web ;
seuls ses liens depuis le site principal sont attestés.

Aucun accès administrateur, inscription, vote ou paiement n’a été effectué.
L’interface mobile, le rendu visuel, les performances, l’accessibilité et les
comportements JavaScript n’ont pas fait l’objet de tests dans un navigateur.
