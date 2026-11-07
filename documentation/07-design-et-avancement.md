# 07 — Design et avancement de la première version

## Direction visuelle

Le site met à égalité trois portes d’entrée : **compétition**, **sorties nature**
et **cours d’escalade**. La page d’accueil ouvre sur une photographie de falaise,
une promesse collective « Plus haut. Ensemble. », puis propose trois univers
photographiques, l’esprit du club, les rendez-vous et les actualités.

Palette : vert forêt `#223b31`, crème `#f7f5ee`, orange roche `#cc4b27`.
Les grands titres combinent une typographie sans empattement et une emphase en
italique à empattement. Les cartes d’activités sont décalées sur ordinateur et
alignées sur téléphone. Les liens et boutons ont des états de focus ; le menu
mobile expose son état et se ferme après navigation. Les animations sont
désactivées selon la préférence de réduction des mouvements.

Les photographies sont téléchargées dans `frontend/public/images/` et ne créent
pas de requêtes vers Unsplash à chaque visite. Elles illustrent l’escalade, sans
prétendre représenter le club, ses murs ou ses adhérents.

| Fichier | Source et crédit |
| --- | --- |
| `hero.jpg` | [Patrick Hendry — falaise](https://unsplash.com/photos/OPXIHBDFYeM) |
| `nature.jpg` | [Photographie de falaise](https://unsplash.com/photos/8O_YsnQv74g) |
| `competition.jpg` | [Nathan Cima — bloc en salle](https://unsplash.com/photos/gH5mpNXWI8o), source initiale conservée en archive |
| `competition-bloc.jpg` | [Nathan Cima — bloc sur volumes](https://unsplash.com/photos/a-man-is-climbing-on-a-climbing-wall-TDhpTIK-neM), couverture actuelle de l’activité Compétition |
| `cours.jpg` | [Tofan Teodor — bloc en salle](https://unsplash.com/photos/MbsD2OiJqVk), conservée pour la présentation du club |
| `cours-femme.jpg` | [Pavel Danilyuk — grimpeuse en salle](https://www.pexels.com/photo/woman-on-a-climbing-wall-with-a-belay-7591367/), couverture de l’activité Cours d’escalade |

Utilisation sous [licence Unsplash](https://unsplash.com/license), consultée le
7 novembre 2026. Les crédits sont aussi accessibles depuis le pied de page.
La photo des cours est sous [licence Pexels](https://www.pexels.com/license/). Le cadrage utilise le point focal de la médiathèque Strapi pour garder la grimpeuse visible sur la carte. Remplacer progressivement ces illustrations par des photos du club validées.

## Réalisé dans le code

La reprise complète des contenus publics est détaillée dans le [bilan de migration](08-reprise-des-contenus.md). Les 38 pages, 31 articles, 30 événements, 141 fichiers disponibles et les horaires 2026–2027 sont maintenant repris localement.

- Interface Nuxt en français, rendue côté serveur, navigation responsive et page d’erreur.
- Accueil, trois fiches d’activités, présentation du club, contact, inscriptions et accès.
- La vie du club : fil unique de publications, recherche, chargement progressif et pages avec texte, photos, pièces jointes et rendez-vous facultatif.
- Agenda : recherche, filtres par activité, navigation mensuelle, vues liste/mois et fiches de détail.
- Fermeture des liens de participation après échéance, fin d’événement ou changement d’état.
- Strapi avec quatre collections éditoriales : publications, activités, pages et documents ; type unique Horaires et UFRAPS. Les anciennes actualités, événements et albums restent en base comme archives masquées.
- Endpoint public de lecture limité aux champs nécessaires et aux contenus publiés.
- Import initial idempotent activé en local ; absence de données fictives de participation ou de résultats sportifs.
- Compose local, Dockerfiles de production, workflow GitHub Actions et Compose OVH avec option Traefik.

Les trois fiches d’activités restent des présentations rédigées pour cette refonte.
Les articles, événements et pages de ressources proviennent désormais de l’import
public, avec leurs contenus complets et leurs dates d’origine. Les anciens articles
de démonstration non modifiés ont été retirés.

## Vérifications de cette itération

- Contrôle TypeScript et huit tests de dates, événements multi-jours, ICS et participation réussis.
- Neuf parcours Playwright : navigation, mobile, 404, horaires/UFRAPS, agenda/ICS et parcours des 38 pages et 116 publications reprises, ainsi que la galerie photo et les documents liés à la page du club.
- Captures de l’accueil sur ordinateur (1440 px) et téléphone (390 px), sans erreur JavaScript ni débordement horizontal observé.
- API locale : trois activités, 116 publications, 30 rendez-vous issus de ces publications et 38 pages ; champs internes exclus de la réponse.
- Administration locale accessible et inscription publique au CMS désactivée.
- Recette des médias et horaires réussie sur bases isolées en développement et en production : téléversement natif, album, légende, brouillon/publication, retrait, remplacement de PDF à adresse stable, contrôles de périodes et masquage des anciens champs JSON.
- Tous les médias intégrés au HTML importé contrôlés ; captures de la page du club sur ordinateur et mobile sans débordement.
- Validation des Compose local et production avec extension Traefik.
- Construction et démarrage des deux images de production sur une base de vérification isolée : 112 pages, API de contenus, réponse 404, bundle d’administration, flux de 30 événements et galerie de 55 albums avec une photo originale accessibles. Les trois services passent leurs contrôles de santé.

Le workflow GitHub est écrit mais n’a pas été exécuté sur GitHub depuis cette
session ; aucun déploiement sur OVH n’a été effectué.

## À poursuivre avant mise en production

- Validation des textes, des informations de saison et de la charte par l’association.
- Récupération des fichiers et pages déjà indisponibles sur la source, si une sauvegarde existe.
- Validation de la transcription des horaires par le club ; le tableau, les plannings locaux et le calendrier UFRAPS sont déjà consultables.
- Recherche globale éventuelle ; les recherches du fil, des ressources, des documents et de l’agenda restent distincts. Les événements à la journée, multi-jours et les exports/abonnements ICS sont réalisés.
- Prévisualisation protégée des brouillons, rôles des bénévoles et accès d’administration HTTPS.
- Mentions légales finales, politique de confidentialité adaptée et sitemap. Les redirections des contenus importés sont réalisées.
- Audit d’accessibilité complet et recette du contenu après import.

Le contrôle `npm audit --omit=dev` réalisé sur les verrous initiaux a signalé
12 alertes faibles/modérées côté frontend et 37 côté CMS, dont 23 de sévérité haute
en comptant les dépendances Strapi affectées en cascade. L’alerte haute à l’origine
de cette chaîne concerne notamment Zod. Ces résultats ne suffisent pas à conclure
à une exploitation dans cette application ; ils doivent être revus et corrigés
avec des versions compatibles avant exposition en production. Aucun downgrade
majeur ni remplacement forcé d’une dépendance interne du CMS n’a été appliqué.

Le site lit systématiquement Strapi. Une panne du CMS produit un message et un
bouton de réessai, sans réafficher silencieusement des données de démonstration.

La galerie publique Piwigo est reprise : 55 albums et 1 105 photos originales,
avec miniatures, visionneuse et téléchargement. Les fichiers sont désormais
administrés dans la médiathèque Strapi et persistés dans son volume `uploads`.
Les sources de reprise restent exclues de Git et des images Docker.

La page `/le-club` place « L’esprit Vertical Côtière » en premier : introduction
avec photo, trois valeurs en colonnes, puis détails de l’association et liens
pratiques. La mise en page est plus compacte et le logo FFME de l’ancien texte
n’est plus répété ; les logos FFME et CCMP restent visibles dans le pied de page.
Les [formulaires et usages des médias](10-administration-medias-et-horaires.md)
sont décrits dans le guide d’administration.

La couverture de compétition présente un grimpeur en mouvement sur des volumes jaunes et bleus, dans l’esprit de l’image initiale, sous licence Unsplash. Le remplacement conserve le média Strapi existant (`/media/1249` dans la base locale) et son point focal est enregistré dans la médiathèque. La reprise se fait une seule fois pour préserver les futures modifications des bénévoles.

Le [guide des publications](11-publications-vie-du-club.md) décrit l’administration quotidienne unifiée. L’accueil se remplit automatiquement et les anciennes adresses sont conservées par redirection.
