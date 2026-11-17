# Espace membre

Le lien **Espace membre** du site mène à `/compte`. Sans session, il ouvre
`/connexion`. L’inscription libre est disponible dans `/creer-un-compte`.
Les comptes membres utilisent Users & Permissions de Strapi et PostgreSQL ;
ils sont distincts des comptes administrateurs de Strapi.

Les nouveaux comptes doivent valider leur adresse e-mail avant de se connecter. Un changement d’adresse dans le profil demande une nouvelle validation. Les inscriptions aux cours sont réservées aux membres connectés et confirmés : le membre connecté reste le payeur et peut inscrire d’autres adhérents. Les nouveaux comptes des adhérents sont créés après paiement, avec un lien personnel d’activation. Voir [Inscriptions et paiement](17-inscriptions.md).

## Comptes et rôles

Une inscription depuis le site crée un **Utilisateur basique**. Ce rôle permet
de consulter et modifier uniquement son propre profil : prénom, nom, e-mail,
téléphone, adresse, code postal, ville, pays et numéro de licence FFME.
La licence est un texte pour conserver les éventuels zéros initiaux.
Le mot de passe peut aussi être changé depuis le compte.

Un administrateur peut créer un compte dans **Content Manager → Membre** :
renseigner prénom, nom, username (par exemple `prenom.nom`), e-mail, mot de passe
d’au moins 12 caractères, rôle et état Confirmed. Le fournisseur est `local`
par défaut. Le rôle peut ensuite être modifié dans cette même fiche ou directement
dans la colonne **Rôle membre** de la liste : choisir le rôle dans le menu
déroulant l’enregistre immédiatement, sans ouvrir la fiche. Le menu propose les
rôles membres existants, hors rôle Public. Pendant l’enregistrement, le choix est
désactivé ; Strapi affiche une notification et conserve l’ancien rôle en cas
d’échec. Les droits de modification des membres et du champ `role` restent
appliqués. Sans ces droits, le rôle est affiché en lecture seule. Si la colonne
est masquée, l’afficher avec les réglages des colonnes de la liste.
Le réglage **Blocked** bloque également une session déjà ouverte.
Plusieurs membres peuvent partager la même adresse e-mail, notamment un parent
et ses enfants. L’inscription demande un identifiant unique pour chaque membre
(3 à 80 lettres, chiffres, points, tirets ou underscores sur le site).
La connexion par identifiant ouvre directement le compte correspondant.
Avec une adresse e-mail partagée, le formulaire propose les comptes associés
(prénom, nom et identifiant) et demande de choisir avant d’ouvrir une session.
Le mot de passe vérifié est toujours celui du compte choisi ; connaître le mot
de passe du parent ne permet pas d’utiliser celui de l’enfant.
Avec un seul compte associé à l’e-mail, la connexion reste directe.
Le profil affiche l’identifiant, qui reste stable lorsque l’adresse e-mail change,
y compris pour les anciens comptes dont l’identifiant était une adresse e-mail.
Les adresses partagées sont acceptées à l’inscription, dans le profil et dans
Content Manager ; le démarrage règle `unique_email` à `false`.

Le rôle **Contributeur** est attribué uniquement par un administrateur.
Il ajoute l’accès à `/mes-publications` et à l’assistant IA du site.
Il permet de créer, modifier et publier ses propres publications, avec leurs
photos et leur éventuel rendez-vous. « Mes publications » affiche le texte du
brouillon et, pour les publications en ligne, un lien vers la page publique.
Les publications des autres membres et les contenus historiques sans auteur
membre ne peuvent pas être modifiés avec cet assistant.
Le retrait du rôle prend effet dès la prochaine requête, y compris avant
la confirmation d’un aperçu déjà généré.

Le rôle **Administrateur membre** (`member_admin`) est également attribué depuis
la fiche Membre ou la colonne **Rôle membre** dans Strapi. Il conserve tous les
droits du contributeur et ajoute **Liste des membres** dans `/compte`, vers
`/membres`. L’annuaire propose une recherche par nom, prénom, identifiant,
e-mail, téléphone, ville, code postal ou licence ; les mots saisis sont combinés.
Les filtres portent sur le rôle et l’état du compte (actif, à confirmer, bloqué).
Les en-têtes permettent de trier par nom, prénom, e-mail, téléphone, ville,
licence, rôle ou date de création, dans les deux sens. La pagination côté serveur
propose 25, 50 ou 100 membres par page.

Chaque fiche `/membres/:id` présente l’identité et les coordonnées, la date de
naissance lorsqu’elle est enregistrée, la licence, le rôle et l’état du compte,
les dates de création, de modification et d’invitation, les inscriptions aux
cours de toutes les saisons, leurs montants, états et références HelloAsso,
les coordonnées conservées dans les dossiers et les participations aux événements.
Les cours suivis et les dossiers financés pour d’autres adhérents sont présentés
séparément. Seules les relations explicites membre/payeur rattachent un dossier :
une adresse familiale commune ne suffit pas. Les dossiers annulés ne prouvent
pas un remboursement ; les opérations ultérieures sont à vérifier dans HelloAsso.

Cet accès est en consultation. Il n’ouvre pas l’administration Strapi et ne
permet pas de changer le profil ou le rôle d’un autre membre. Les routes dédiées
`/api/member/directory` et `/api/member/directory/:id` vérifient le rôle côté
serveur à chaque requête, y compris après un retrait du rôle ou un blocage.
Les pages et réponses sont privées, sans cache. Les mots de passe, jetons
d’activation/récupération et liens privés de paiement sont exclus des réponses.

## Assistant et photos

Le contributeur décrit sa demande, joint ses photos puis génère un aperçu.
Il confirme explicitement l’enregistrement en brouillon ou la publication.
Pour une modification, une synthèse en lecture seule apparaît dès l’ouverture,
avant de saisir la demande : titre, rubrique, statut, texte complet consultable
dans une zone compacte, détails du rendez-vous et liste dépliable des photos
conservées. Elle présente le brouillon enregistré utilisé par l’assistant.
Après génération, le formulaire affiche aussi le contenu avant modification
et la proposition pour les comparer.
Une modification concurrente bloque la confirmation et demande de recharger.
L’assistant utilise la même configuration Mistral que l’admin ; aucune nouvelle
clé n’est nécessaire. Voir le [guide Mistral](12-assistant-administration.md).

Les nouveaux téléversements acceptent JPEG, PNG, WebP et AVIF, avec 20 Mo par
photo, 25 Mo par import et 40 millions de pixels maximum. Seules les photos
importées par ce membre peuvent être ajoutées à ses nouvelles publications.
Les photos existantes sont conservées lors d’une modification.

Depuis la page publique d’une publication, un contributeur connecté peut cliquer
sur **Ajouter des photos**, à côté de **En images**, même si la publication a été
créée par un autre membre ou dans Strapi. Les photos apparaissent immédiatement
dans la galerie, avec la mention discrète **Ajouté par Prénom Nom**, également
visible dans l’aperçu agrandi. Aucun e-mail ou identifiant de compte n’est public.
La mention est affichée en petits caractères discrets. Le membre qui a ajouté
une photo dispose d’un lien **Supprimer**, dans la galerie et l’aperçu agrandi,
avec confirmation avant suppression du fichier. Cette action est contrôlée
côté serveur et reste disponible pour ses photos s’il redevient utilisateur
basique ; elle ne permet pas de supprimer les photos des autres membres.
Le bouton est disponible même si la galerie est encore vide.
Les limites de format et de taille restent identiques à celles de l’assistant.
Cet ajout est réservé aux publications déjà en ligne et n’altère ni leur texte
ni les changements en brouillon. Les photos communautaires sont conservées à
part des photos éditoriales, dans les téléversements membres ; elles restent
présentes après une nouvelle publication du texte. Leur accès public est retiré
si la publication est dépubliée. Un administrateur peut les supprimer depuis
la médiathèque Strapi.

L’auteur contributeur d’une publication et les administrateurs membres peuvent
cliquer sur **Réorganiser les photos**. Glisser les photos, ou utiliser les boutons
pour les avancer, les reculer ou les placer en premier, puis **Enregistrer l’ordre**.
**Annuler** conserve l’ordre précédent. L’ordre concerne les photos éditoriales
et communautaires et reste conservé après une nouvelle publication du texte.
La première photo sert de couverture si aucune couverture spécifique n’a été
choisie dans Strapi. Réordonner ne publie pas les changements en brouillon.
Si les photos ont changé dans un autre onglet, recharger la publication avant de
réessayer pour éviter d’écraser ces changements.

## Sondages de participation aux événements

Dans l’encart **Le rendez-vous** d’une publication en ligne, un contributeur
peut cliquer sur **Ajouter un sondage**, à droite du titre de l’encart. Il peut
aussi ajouter ce sondage à une publication créée par un autre membre ou dans
Strapi. Un rendez-vous ne possède qu’un seul sondage de participation.

Tout membre connecté, utilisateur basique ou contributeur, peut ensuite cliquer
sur **Je m’inscris**. Une confirmation précède l’inscription :
« En confirmant votre participation, vous vous engagez à être présent à cet
événement, sauf imprévu indépendant de votre volonté. » **Annuler** ne crée
aucune inscription. Les visiteurs sont invités à se connecter, puis reviennent
sur la publication.

Le champ **Inscrire un autre membre** est disponible pour tous les membres
connectés, même sans rôle contributeur ou inscription personnelle. Saisir le nom,
le prénom ou une partie de l’un des deux affiche des suggestions sélectionnables.
La recherche ignore la casse et accepte aussi plusieurs mots dans n’importe quel
ordre. Elle présente au maximum 20 résultats : préciser la saisie si nécessaire.
Les personnes déjà inscrites sont indiquées et ne peuvent pas être sélectionnées.
Après sélection, **Confirmer son inscription** enregistre la participation ;
**Annuler** ne crée aucune inscription. La recherche ne retourne que les noms
et identifiants nécessaires à la sélection, jamais les e-mails ou les profils
complets. Les comptes bloqués ou non confirmés sont exclus.

En base, chaque `event-participation` conserve `member` (le participant),
`registeredByMember` (le membre connecté qui a effectué l’inscription) et
`confirmedAt` (la date de confirmation). Pour une inscription personnelle,
les deux relations désignent la même personne. L’auteur provient toujours de
la session : le client ne peut pas le choisir. Une tentative ultérieure pour
un participant déjà inscrit conserve l’auteur et la date d’origine. Au premier
démarrage de cette version, les anciennes inscriptions personnelles reçoivent
leur participant comme auteur, sans modifier leur date de confirmation.

La liste des participants apparaît dans le même encart, avec leur prénom et
leur nom, uniquement pour les membres connectés. L’API publique indique seulement
si un sondage existe ; elle ne renvoie ni la liste ni les données d’inscription.
Les réponses membres sont privées et sans cache. Le serveur identifie l’auteur
par sa session et exige une confirmation explicite. Une contrainte en base évite
les doublons, y compris lors de requêtes simultanées.

Les inscriptions ferment à l’échéance indiquée, à la fin de l’événement ou si son
statut n’est plus **prévu**. Pour une journée entière, la fin inclut le dernier
jour dans le fuseau Europe/Paris. La liste reste consultable après clôture.
Les sondages et inscriptions sont conservés séparément des versions éditoriales :
ils ne publient aucun brouillon et survivent à une nouvelle publication du texte.
Ils deviennent inaccessibles depuis le site si la publication est dépubliée ou
si son rendez-vous est retiré.

## Sessions et données personnelles

La session dure au maximum huit heures et utilise un cookie HttpOnly,
SameSite=Lax, Secure en production. Le navigateur ne reçoit pas le JWT dans
les réponses JSON. Les actions passent par les routes Nuxt `/api/member/`
avec vérification de l’origine des écritures. Les pages et réponses membres
sont privées et ne sont pas mises en cache.

Strapi vérifie le rôle et l’auteur de chaque publication côté serveur.
Les membres n’ont pas accès aux routes génériques de gestion des utilisateurs.
Le choix du compte à la connexion expose seulement les noms et identifiants
associés à l’adresse saisie, sans ouvrir de session ni fournir de profil.
Les autres informations personnelles ne sont pas exposées par l’API publique du site
et ne sont pas envoyées à Mistral pour rédiger un article.

Le démarrage configure le rôle d’inscription basique et les permissions des
trois rôles. La confirmation d’e-mail conserve le réglage Strapi existant ;
si elle est activée, il faut aussi configurer l’envoi d’e-mails.

## Mot de passe oublié et e-mails OVH

La page de connexion propose **Mot de passe oublié ?**. Le membre indique son
adresse dans `/mot-de-passe-oublie`, reçoit un e-mail en français et choisit
un nouveau mot de passe dans `/reinitialiser-mot-de-passe`.
Si plusieurs comptes partagent l’adresse, chacun reçoit un message indiquant
son identifiant et contenant un lien distinct. Un lien ne modifie que le mot
de passe du compte concerné. Les comptes bloqués et les comptes utilisant un
fournisseur externe sont exclus de cet envoi.
Le lien expire après une heure, ne fonctionne qu’une fois et une nouvelle
demande remplace le précédent. Un compte bloqué ne peut pas l’utiliser.
La réponse ne révèle pas si une adresse possède un compte. Le nouveau mot
de passe doit contenir au moins 12 caractères. La confirmation renvoie vers
la connexion et ne connecte pas automatiquement le membre.

**L’envoi utilise réellement le serveur SMTP OVH, y compris en local.**
Il n’y a pas de boîte de réception de test dans le Compose de développement.
Compléter `vertical-cotiere/.env` avec une boîte e-mail OVH existante :

```dotenv
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=adresse-expeditrice@votre-domaine.fr
SMTP_PASSWORD='mot-de-passe-de-cette-boite'
# Facultatif : l’expéditeur utilise SMTP_USER si ce champ est vide.
EMAIL_FROM=
```

Il s’agit du mot de passe de la boîte mail, pas de celui du compte client OVH.
Ce sont les [paramètres OVH MX Plan](https://docs.ovhcloud.com/fr/guides/web-cloud/email-and-collaborative-solutions/mx-plan/email-creation).
Pour une offre Email Pro ou Exchange, reprendre le serveur indiqué dans
l’espace OVH pour cette boîte. La configuration SMTP reste adaptable.
Les mots de passe et identifiants SMTP ne sont jamais exposés au navigateur.
Entourer le mot de passe de quotes simples dans le `.env` pour conserver ses
éventuels caractères spéciaux comme `$` et `#`.

Après modification, recréer uniquement le CMS depuis `vertical-cotiere` :

```sh
docker compose up -d --no-deps cms
```

Le Compose fournit `PUBLIC_SITE_URL=http://localhost:3000` en local (ou le
`WEB_PORT` choisi). Le lien reçu par e-mail ramène donc sur le site local.
En production, définir `PUBLIC_SITE_URL` avec l’URL HTTPS du site ; le template
infra le déduit automatiquement de `deployment.site_domain`.
Ajouter `SMTP_USER` et `SMTP_PASSWORD` aux credentials Vault de chaque
environnement. `EMAIL_FROM` est facultatif et doit être une adresse autorisée
par la boîte SMTP. Le raccourci `ansible/inventory/vault-key.sh re7 SMTP_PASSWORD`
permet de saisir le secret sans l’afficher. Les autres paramètres SMTP peuvent
être ajustés avec `deployment.smtp_host`, `smtp_port` et `smtp_secure`.

L’expéditeur du modèle de récupération est mis à jour au démarrage à partir
de `EMAIL_FROM` ou `SMTP_USER`. Le texte peut ensuite être personnalisé dans
**Strapi → Settings → Users & Permissions → Email templates**.
Sans identifiants SMTP, le formulaire signale que l’envoi est indisponible ;
un administrateur peut toujours réinitialiser le mot de passe dans la fiche Membre.

### Tester le SMTP directement avec Python

Le script utilise uniquement la bibliothèque standard de Python, sans Strapi,
Docker ni installation pip. Depuis `vertical-cotiere` :

```sh
# Vérifier TLS et l’authentification, sans envoyer de message.
python3 scripts/test-smtp.py

# Envoyer un vrai e-mail pour vérifier sa réception.
python3 scripts/test-smtp.py --to votre-adresse@domaine.fr

# Utiliser un autre fichier de configuration.
python3 scripts/test-smtp.py --env-file /chemin/vers/.env --to votre-adresse@domaine.fr
```

Le fichier `.env` du projet est choisi automatiquement, même si la commande est
lancée depuis un autre répertoire. Les variables SMTP déjà exportées dans le
terminal sont prioritaires. Les valeurs du fichier sont lues sans exécuter de
code ni développer les références `$VARIABLE` ; garder le mot de passe entre
quotes simples comme dans l’exemple ci-dessus.
Le script n’affiche pas les identifiants ni le mot de passe. Il exige TLS, avec
SSL direct pour `SMTP_SECURE=true` ou STARTTLS pour `false`.
Un envoi accepté par le serveur ne garantit pas la livraison : vérifier aussi
les indésirables de la boîte destinataire.

## Connexion Google

Configurer dans Google Cloud un client OAuth de type **Application Web** avec
les portées `openid email profile`. Ajouter comme URI de redirection autorisée
`http://localhost:3000/api/member/google/callback` en local et
`https://<domaine-du-site>/api/member/google/callback` pour chaque environnement.
L’URI doit correspondre exactement à `PUBLIC_SITE_URL` (domaine du site Nuxt).
Configurer l’écran de consentement et les utilisateurs de test si l’application
Google est encore en mode test.

Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans le `.env`, puis
recréer le CMS (`docker compose up -d --no-deps cms`). En RE7/production, ajouter
ces deux valeurs aux credentials Vault de l’environnement : le template
`infra-ovh/ansible/templates/vertical-cms.env.j2` les transmet au CMS.
Le bouton **Continuer avec Google** apparaît sur connexion et création de compte
uniquement lorsque ces valeurs et `PUBLIC_SITE_URL` sont configurés.
Ne pas activer le fournisseur Google natif dans Strapi : le site utilise son
propre parcours pour gérer les adresses partagées.

- Nouvelle adresse : création d’un **Utilisateur basique**, sans mot de passe,
  avec prénom/nom fournis par Google et adresse vérifiée. Le membre peut compléter
  son profil et définir un mot de passe avec le lien de récupération.
- Adresse déjà utilisée : aucune fusion automatique, même pour un seul compte.
  Le membre choisit un compte confirmé et saisit **son mot de passe** pour
  l’associer à Google. Le rôle, les informations et les publications sont conservés.
  Un compte non confirmé doit d’abord valider son adresse ; un compte d’inscription
  doit d’abord être activé. Le lien « Mot de passe oublié ? » reste disponible.
- Adresse familiale : un compte Google est associé à **un seul membre**. Les
  autres comptes restent accessibles par identifiant et mot de passe, ou via
  leur propre compte Google. Un compte déjà associé ne peut pas être remplacé
  par ce parcours ; contacter le club si une correction est nécessaire.
- Connexions suivantes : recherche par identifiant Google stable (`sub`), y
  compris si l’adresse Google change. L’adresse et les autres informations du
  profil local ne sont pas écrasées. Les comptes bloqués restent refusés.

Le serveur vérifie la signature du jeton avec les clés publiques Google, son
émetteur, son audience, son expiration et le nonce. Le parcours utilise `state`,
PKCE S256 et des cookies HttpOnly SameSite=Lax ; les jetons de session et de
liaison ne passent jamais dans les URL ni dans le JavaScript du navigateur.
Une demande de liaison expire après dix minutes. Les routes d’authentification
sont limitées en fréquence. La documentation de référence est celle de
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

La recette membre utilise une paire de clés et des réponses Google simulées :
aucun compte ni identifiant Google réel n’est nécessaire pour les tests.

## Vérifications

La recette `cms/tests/member-directory.integration.cjs`, appelée par la recette
membre, couvre l’annuaire administrateur (accès refusés, tri, recherche, filtres,
pagination, cours et payeurs, adresse partagée, absence de secrets et révocation
immédiate). `frontend/e2e/member-directory.cjs` reçoit la même fixture temporaire
que `member-area.cjs` et couvre le parcours admin, les fiches et le mobile.

La CI exécute `cms/tests/members.integration.js` avec Mistral simulé et une
base PostgreSQL temporaire, supprimée à la fin. Elle couvre les profils,
les refus de changement de rôle, les photos, la propriété des publications,
la publication, les sondages et inscriptions (permissions, confirmation,
confidentialité, concurrence, clôture), le blocage, le changement de mot de passe et les liens de
récupération (expiration, usage unique, compte inconnu et compte bloqué).
Elle couvre aussi les emails partagés à la création depuis le site et
l’administration, les modifications d’adresse, la stabilité des identifiants,
le choix obligatoire du compte, les mots de passe différents, les sélections
invalides et la récupération séparée de chaque compte.
La recette `cms/tests/member-roles.integration.cjs`, appelée par ce même test,
vérifie les changements de rôle par l’API d’administration, leur effet immédiat,
la conservation du profil et les droits par champ. La recette navigateur
`frontend/e2e/member-roles.cjs` vérifie le menu dans la liste, la persistance après
rechargement, les erreurs et la lecture seule. Elle utilise l’administration
compilée et la fixture temporaire `MEMBER_ROLE_UI_FIXTURE` de la recette membre.
La recette remplace explicitement les identifiants SMTP par des valeurs
factices et intercepte le fournisseur d’e-mail : aucun mail réel n’est envoyé
par les tests, même si un `.env` SMTP est configuré.
`frontend/e2e/member-area.cjs` complète cette recette dans un navigateur,
avec une instance de test isolée sur les ports internes 1347 et 3107.
