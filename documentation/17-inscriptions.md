# Inscriptions aux cours et HelloAsso Checkout

La page `/inscriptions` rassemble le calendrier, le choix du tarif, le formulaire et le suivi du paiement. L’ancien texte importé n’est plus affiché sur cette page. Les remboursements, documents, compétition, STAPS, boutique, location et assurance restent consultables dans les modalités repliables.

## Paramétrage du planning

Dans Strapi, **Horaires et UFRAPS**, chaque cours dispose des réglages suivants :

- **Identifiant d’inscription** : permanent et unique dans la saison. Il est initialisé automatiquement pour les cours existants. Le conserver lors d’une republication ou d’un changement d’horaire. Un cours distinct doit avoir son propre identifiant.
- **Nombre de places** : capacité totale ; une capacité absente n’autorise pas de paiement en ligne.
- **Places déjà occupées hors du site** : zéro par défaut, conformément au fonctionnement local demandé. Avant une ouverture réelle, y reporter les inscriptions historiques HelloAsso ; ne pas y compter les nouveaux dossiers du site.
- Quatre montants, **en centimes** : standard, CCMP1OU2, FAM et CCMP3. Les prix sont configurables ; en local ils sont initialisés à 160 € (standard), 150 € (CCMP), 140 € (famille hors CCMP) et 130 € (famille CCMP). Un montant vide rend ce tarif indisponible.
- **Inscription en ligne à ce cours** : activer après vérification des paramètres. Laisser désactivé un groupe compétition en attente de validation des entraîneurs.

Publier les changements puis activer et publier **Ouvrir les inscriptions**, avec la date d’ouverture voulue (28 mai 2026 à 00 h à Paris par défaut). Les nouveaux cours doivent recevoir un identifiant avant d’être ouverts.

La sélection propose standard, résident CCMP, famille hors CCMP et famille CCMP. Le montant est recalculé par le serveur. Les tarifs famille demandent l’identité des deux premiers inscrits ; l’éligibilité est déclarative, à vérifier par le secrétariat, comme pour les codes des anciennes campagnes. Un membre déjà connecté et dont l’adresse e-mail est validée peut s’inscrire lui-même ou inscrire d’autres adhérents, sans limite de cinq dossiers. Le serveur impose ce membre comme payeur et transmet son e-mail à HelloAsso. Chaque adhérent renseigne son propre e-mail (une adresse familiale partagée reste possible). Une inscription et un paiement par personne. Les années de naissance explicites du planning sont contrôlées côté serveur.

## Configuration du paiement

Renseigner uniquement côté CMS les variables de `.env.example` : `HELLOASSO_CLIENT_ID`, `HELLOASSO_CLIENT_SECRET`, `HELLOASSO_ORGANIZATION_SLUG`, `HELLOASSO_SANDBOX`, `HELLOASSO_WEBHOOK_TOKEN` et `PUBLIC_SITE_URL`. Elles sont transmises au CMS par Compose local et production.

La sandbox est activée par défaut. Utiliser les identifiants de l’association de test ; les identifiants de production s’utilisent avec `HELLOASSO_SANDBOX=false`. Le compte doit avoir le droit **Checkout**. Les URL de retour doivent être en HTTPS : le site sur `http://localhost:3000` permet de préparer le parcours, mais un test réel nécessite une adresse HTTPS accessible. Ne pas substituer une adresse publique pointant vers un autre environnement.

Configurer la notification HelloAsso vers :

```text
https://<adresse-publique-du-cms>/api/registrations/helloasso?key=<HELLOASSO_WEBHOOK_TOKEN>
```

Générer un secret aléatoire et protéger les journaux d’accès qui peuvent contenir cette URL. La notification ne suffit jamais à confirmer un paiement : le CMS relit l’intention via l’API authentifiée et vérifie la référence du dossier, l’état autorisé et le montant, hors contribution volontaire HelloAsso. La page de suivi effectue aussi cette vérification. Aucun code `succeeded` du navigateur n’est accepté comme preuve.

Sources de l’intégration : [initialiser un Checkout](https://dev.helloasso.com/reference/post_organizations-organizationslug-checkout-intents), [relire une intention](https://dev.helloasso.com/reference/get_organizations-organizationslug-checkout-intents-checkoutintentid), [fonctionnement technique](https://dev.helloasso.com/docs/int%C3%A9grer-le-paiement-sur-votre-site), [notification Order avec metadata](https://dev.helloasso.com/docs/commandes-cr%C3%A9%C3%A9-sur-un-paiement-checkout-avec-des-%C3%A9ch%C3%A9ances).

## Comptage et exploitation

Les dossiers sont conservés dans **Inscriptions aux cours**, sans routes CRUD publiques. Le suivi est rattaché au membre payeur, authentifié par le cookie HTTP-only de l’espace membre ; il est donc disponible sur tous ses appareils après connexion. Le catalogue ne révèle aucun nom, e-mail ou référence de dossier. Le payeur ne voit que ses propres inscriptions.

La disponibilité est : capacité − places historiques − dossiers `creating`, `pending` ou `confirmed`. La vérification du stock et la création du dossier utilisent une transaction PostgreSQL et un verrou partagé par toutes les instances du CMS, pour éviter de vendre deux fois la dernière place. Une nouvelle requête pour le même adhérent retrouve son dossier actif.

- `creating` : création du paiement en cours ou résultat réseau incertain ; la place reste réservée.
- `pending` : intention HelloAsso créée, paiement à vérifier. Le bouton de reprise disparaît avant l’expiration de l’URL, valide quinze minutes.
- `confirmed` : paiement vérifié, place confirmée.
- `cancelled` : place libérée après refus définitif ou annulation vérifiée par le secrétariat.

**Les abandons ne libèrent pas automatiquement leur place** : l’expiration de l’URL ne prouve pas l’absence d’un paiement déjà engagé. Vérifier le dossier et l’intention dans HelloAsso avant de passer son état à `cancelled` dans Strapi. Ne jamais annuler un paiement encore possible ou incertain. En cas de remboursement ou de contestation après confirmation, le secrétariat décide du maintien de l’adhésion ; aucun webhook de remboursement ne libère automatiquement une place.

Après confirmation du paiement, un nouveau compte membre basique est créé pour chaque nouvel adhérent. Un compte existant correspondant au nom, prénom et e-mail est conservé, sans modifier son mot de passe ou son rôle. La date de naissance départage les nouveaux comptes quand elle est renseignée. En cas d’ambiguïté, le paiement reste confirmé et le secrétariat doit vérifier le rattachement du compte.

Le nouvel adhérent reçoit à son adresse un identifiant et un lien personnel `/activer-mon-compte`. Ce lien valide son e-mail et lui permet de choisir son mot de passe. Il expire après sept jours ; seul son condensat est stocké et une transaction empêche son utilisation simultanée ou répétée. Le payeur ne choisit jamais le mot de passe d’un autre adhérent. Si l’envoi échoue, l’inscription reste confirmée et une nouvelle tentative a lieu à l’actualisation du suivi ou à la réception d’une notification. Les notifications répétées ne créent pas de comptes ou d’e-mails supplémentaires.

La création ordinaire d’un compte requiert également une validation par e-mail. Un changement d’adresse dans le profil demande une nouvelle validation. Les comptes existants déjà marqués confirmés sont conservés. Le formulaire n’émet pas de licence FFME.

Initialisation explicite des tarifs **dans la base locale uniquement** (ne modifie ni les capacités ni les places occupées ni l’ouverture des inscriptions) :

```sh
docker compose exec -T cms node src/scripts/init-local-registration-prices.cjs
```

Les quatre prix sont mis à jour dans les versions brouillon et publiée des cours. Le script refuse un environnement autre que le développement local.

## Vérification

```sh
cd frontend
npm run typecheck
npm test
```

Recette API sur une **base PostgreSQL jetable**, avec tous les appels HelloAsso simulés et sans paiement réel :

```sh
docker compose exec -T -e RUN_REGISTRATION_TESTS=true cms node tests/course-registrations.integration.cjs
```

Recette navigateur sur le site local ; le second parcours simule seulement le catalogue et les appels de paiement dans le navigateur :

```sh
docker compose exec -T web node e2e/registrations.cjs
```

Les quatre montants demandés sont renseignés en local. Les identifiants HelloAsso et le test d’un encaissement réel restent à fournir avant ouverture.
