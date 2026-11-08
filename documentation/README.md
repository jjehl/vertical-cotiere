# Documentation de la refonte — Vertical Côtière

État des lieux réalisé le **7 novembre 2026**, à partir du site public
[vertical-cotiere.fr](https://www.vertical-cotiere.fr/).

Ce dossier sert de base au cahier des charges et à la réalisation. Il ne constitue
pas une sauvegarde du site ni un export exhaustif de ses archives.

## Guide de lecture

| Document | Utilité |
| --- | --- |
| [01 — Site existant](01-site-existant.md) | Identité, arborescence, fonctions observées, sources et limites de l’exploration |
| [02 — Besoins et parcours](02-besoins-et-parcours.md) | Périmètre proposé, parcours, administration et critères de recette |
| [03 — Contenus et données](03-contenus-et-donnees.md) | Structure des contenus à gérer et règles de publication |
| [04 — Choix techniques](04-choix-techniques.md) | Stack recommandée, alternatives, architecture et exploitation |
| [05 — Migration et réalisation](05-migration-et-realisation.md) | Reprise de l’existant, étapes de réalisation et décisions restant à prendre |
| [06 — Docker et CI](06-docker-et-ci.md) | Développement local, images GitHub Actions et installation OVH |
| [07 — Design et avancement](07-design-et-avancement.md) | Direction visuelle, fonctions livrées et limites de cette première version |
| [08 — Reprise des contenus et agenda](08-reprise-des-contenus.md) | Import public, horaires, calendrier, documents locaux et limites de la source |
| [09 — Logos et partenaires](09-logos-et-partenaires.md) | Logos FFME et CCMP dans le pied de page, rubrique Partenaires et sources des images |
| [10 — Administration des médias et horaires](10-administration-medias-et-horaires.md) | Médiathèque, documents, formulaires horaires/UFRAPS et reprise Docker |
| [11 — Publications et vie du club](11-publications-vie-du-club.md) | Formulaire unique, photos, agenda automatique, navigation et reprise des archives |
| [12 — Assistant d’administration](12-assistant-administration.md) | Création en langage naturel, Mistral, coût et clés API locales/OVH |
| [13 — Livraison re7 et prod](13-deploiement-re7-prod.md) | CI main/release, comptes restreints, Ansible et configuration OVH |
| [14 — Stockage S3](14-stockage-s3.md) | SeaweedFS local, S3 OVH, configuration et migration des médias |

## Convention

- **Observé** : visible dans une page publique ou son HTML au moment de l’exploration.
- **Proposé** : recommandation pour la refonte, à distinguer du fonctionnement actuel.
- **À confirmer** : information inaccessible, ambiguë ou nécessitant une validation du club.

Les dates, montants et modalités présents sur le site actuel sont des contenus
éditoriaux à faire valider avant leur republication. Les propositions n’impliquent
aucun changement sur le site en production.

## Orientation recommandée

**Nuxt avec Vue 3 et TypeScript, Strapi pour l’administration, PostgreSQL pour les
contenus**, avec conservation des liens HelloAsso et Framadate dans une première
version. **WordPress est exclu de la nouvelle stack**, conformément au choix du
projet. Le développement tourne avec Docker Compose ; GitHub Actions construit
les images qui seront exécutées avec Compose sur un serveur OVH.
