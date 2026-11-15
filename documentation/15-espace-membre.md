# Espace membre

Le lien **Espace membre** du site mène à `/compte`. Sans session, il ouvre
`/connexion`. L’inscription libre est disponible dans `/creer-un-compte`.
Les comptes membres utilisent Users & Permissions de Strapi et PostgreSQL ;
ils sont distincts des comptes administrateurs de Strapi.

## Comptes et rôles

Une inscription depuis le site crée un **Utilisateur basique**. Ce rôle permet
de consulter et modifier uniquement son propre profil : prénom, nom, e-mail,
téléphone, adresse, code postal, ville, pays et numéro de licence FFME.
La licence est un texte pour conserver les éventuels zéros initiaux.
Le mot de passe peut aussi être changé depuis le compte.

Un administrateur peut créer un compte dans **Content Manager → Membre** :
renseigner prénom, nom, username (utiliser l’e-mail), e-mail, mot de passe
d’au moins 12 caractères, rôle et état Confirmed. Le fournisseur est `local`
par défaut. Le rôle peut ensuite être modifié dans cette même fiche.
Le réglage **Blocked** bloque également une session déjà ouverte.

Le rôle **Contributeur** est attribué uniquement par un administrateur.
Il ajoute l’accès à `/mes-publications` et à l’assistant IA du site.
Il permet de créer, modifier et publier ses propres publications, avec leurs
photos et leur éventuel rendez-vous. Les publications des autres membres et
les contenus historiques sans auteur membre restent hors de cet espace.
Le retrait du rôle prend effet dès la prochaine requête, y compris avant
la confirmation d’un aperçu déjà généré.

## Assistant et photos

Le contributeur décrit sa demande, joint ses photos puis génère un aperçu.
Il confirme explicitement l’enregistrement en brouillon ou la publication.
Pour une modification, le formulaire affiche le contenu actuel et la proposition.
Une modification concurrente bloque la confirmation et demande de recharger.
L’assistant utilise la même configuration Mistral que l’admin ; aucune nouvelle
clé n’est nécessaire. Voir le [guide Mistral](12-assistant-administration.md).

Les nouveaux téléversements acceptent JPEG, PNG, WebP et AVIF, avec 20 Mo par
photo, 25 Mo par import et 40 millions de pixels maximum. Seules les photos
importées par ce membre peuvent être ajoutées à ses nouvelles publications.
Les photos existantes sont conservées lors d’une modification.

## Sessions et données personnelles

La session dure au maximum huit heures et utilise un cookie HttpOnly,
SameSite=Lax, Secure en production. Le navigateur ne reçoit pas le JWT dans
les réponses JSON. Les actions passent par les routes Nuxt `/api/member/`
avec vérification de l’origine des écritures. Les pages et réponses membres
sont privées et ne sont pas mises en cache.

Strapi vérifie le rôle et l’auteur de chaque publication côté serveur.
Les membres n’ont pas accès aux routes génériques de gestion des utilisateurs.
Les informations personnelles ne sont pas exposées par l’API publique du site
et ne sont pas envoyées à Mistral pour rédiger un article.

Le démarrage configure le rôle d’inscription basique et les permissions des
deux rôles. La confirmation d’e-mail conserve le réglage Strapi existant ;
si elle est activée, il faut aussi configurer l’envoi d’e-mails.

## Mot de passe oublié et e-mails OVH

La page de connexion propose **Mot de passe oublié ?**. Le membre indique son
adresse dans `/mot-de-passe-oublie`, reçoit un e-mail en français et choisit
un nouveau mot de passe dans `/reinitialiser-mot-de-passe`.
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

## Vérifications

La CI exécute `cms/tests/members.integration.js` avec Mistral simulé et une
base PostgreSQL temporaire, supprimée à la fin. Elle couvre les profils,
les refus de changement de rôle, les photos, la propriété des publications,
la publication, le blocage, le changement de mot de passe et les liens de
récupération (expiration, usage unique, compte inconnu et compte bloqué).
La recette remplace explicitement les identifiants SMTP par des valeurs
factices et intercepte le fournisseur d’e-mail : aucun mail réel n’est envoyé
par les tests, même si un `.env` SMTP est configuré.
`frontend/e2e/member-area.cjs` complète cette recette dans un navigateur,
avec une instance de test isolée sur les ports internes 1347 et 3107.
