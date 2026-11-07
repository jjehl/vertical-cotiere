# 02 — Besoins, parcours et périmètre proposé

Tout ce document décrit une **cible proposée**, issue de l’état des lieux.

## Publics et parcours

| Public | Parcours principal | Résultat attendu |
| --- | --- | --- |
| Futur adhérent ou parent | Découvrir le club → trouver une activité selon l’âge et le niveau → consulter horaires et modalités → HelloAsso | Comprendre l’offre avant de payer |
| Adhérent | Accueil → alerte ou actualité → détail et action éventuelle | Trouver rapidement une information de saison |
| Participant à une sortie | Agenda → fiche sortie → conditions, rendez-vous, échéance → sondage ou inscription | Savoir si la sortie est adaptée et comment participer |
| Compétiteur et famille | Compétitions → manche → lieu, dates et modalités | Distinguer calendrier, inscription et résultats |
| Bénévole | Connexion au CMS → rédaction → prévisualisation → publication | Publier sans modifier le code |
| Responsable du club | Mettre à jour saison, contacts, horaires et documents | Maintenir une information cohérente |

## Navigation retenue

Menu principal : **Le club · L’agenda · La vie du club**, avec le bouton
**Rejoindre le club**. Les trois activités sont directement accessibles depuis
l’accueil. Les horaires, documents, contacts et partenaires sont également
accessibles dans le pied de page et dans les pages concernées.

Les activités regroupent cours, baby escalade, stages, sorties et compétitions.
Les anciennes rubriques utiles restent accessibles par ces pages et par des
redirections. L’accueil donne priorité à une courte présentation, une alerte
active, les prochains événements, les dernières actualités et l’inscription.

## Première version

| Fonction | Comportement attendu | Critère de recette |
| --- | --- | --- |
| Pages de présentation | Contenus éditables, activités par public, lieux et contacts | Un bénévole modifie une page et la retrouve en ligne sans intervention sur Git |
| La vie du club | Fil de publications avec ou sans photos, recherche, galerie et rendez-vous facultatif | Une même fiche alimente le fil, l’accueil et, si elle est datée, l’agenda |
| Agenda | Liste adaptée au mobile, vue mensuelle, filtres et fiche événement | Les deux vues affichent les mêmes événements ; un événement annulé reste identifiable |
| Dates et abonnements | Heure de Paris, événements à la journée, export ICS et abonnement | Un événement exporté conserve son horaire et son identifiant après modification |
| Inscriptions | Consignes de saison puis bouton vers la campagne HelloAsso pertinente | Le lien correspond à la saison publiée et son caractère externe est clair |
| Sondages | Bouton vers le sondage associé à la sortie ou à la compétition | L’échéance et le lien sont accessibles depuis la fiche, sans publier les réponses |
| Horaires | Tableau HTML par jour, public, lieu et saison | Lisible sur téléphone et sans dépendre d’une image ; aucune saison ambiguë |
| Ressources | Documents nommés, datés, classés, avec indication de version en vigueur | Le règlement courant se distingue des archives |
| Recherche | Recherche sur pages, actualités et événements publiés | Une requête pertinente trouve un contenu ; aucun brouillon n’est exposé |
| Contact | Adresses fonctionnelles et liens directs | Le bon contact est identifiable selon le besoin |

Les inscriptions, paiements et formulaires de remboursement restent sur leurs
services actuels. Le site présente les explications et les liens ; il ne devient
pas le registre des licences ou des documents de santé.

## Administration

Trois rôles proposés : **rédacteur** pour préparer les contenus, **éditeur** pour
les publier, **administrateur** pour gérer comptes et configuration. Le partage
exact des droits doit être essayé avec les bénévoles. La séparation rédaction /
publication se fait par permissions et procédure simple ; un workflow complexe
d’approbation n’est pas requis au lancement.

La saisie quotidienne se fait dans **Publication** : titre, texte et photos/documents facultatifs, puis un bloc rendez-vous si nécessaire. Voir le [guide du formulaire unique](11-publications-vie-du-club.md).

Prévoir des formulaires éditoriaux courts, des champs obligatoires adaptés au
contenu, une prévisualisation protégée et un guide de passation. Au changement de
saison, dupliquer les informations utiles, actualiser les liens et archiver les
anciennes modalités après validation.

## Qualité attendue

- Contenu principal disponible dans le HTML initial ; titres et descriptions propres à chaque page.
- Navigation au clavier, focus visible, contrastes suffisants, textes alternatifs et formulaires correctement étiquetés ; vérification sur téléphone.
- Images redimensionnées, chargement différé hors écran et calendrier interactif chargé uniquement là où il est utile.
- États explicites : aucun événement, recherche vide, lien d’inscription indisponible, erreur de chargement.
- Accès public limité aux contenus publiés ; accès d’administration protégé et sauvegardes restaurables.
- Préférer les liens vers les services externes ; examiner les traceurs avant d’ajouter des intégrations embarquées. Les textes de confidentialité seront adaptés aux traitements réellement retenus.

## Évolutions hors première version

Notifications, espace adhérent, sondages intégrés, synchronisation HelloAsso et
gestion interne des participants. Aucune de ces fonctions n’est nécessaire pour
remplacer la partie vitrine et les liens de participation actuels.

Les photos font partie des publications dès cette version ; les 55 albums historiques restent consultables dans le fil commun.
