#!/usr/bin/env python3
"""Test SMTP directly with Python's standard library; never print credentials."""
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid, parseaddr
import os
from pathlib import Path
import re
import smtplib
import socket
import ssl
import sys


KEYS = {'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'}
DEFAULT_ENV = Path(__file__).resolve().parents[1] / '.env'


def dotenv_value(raw):
    """Read single-line dotenv values without evaluating shell code or variables."""
    raw = raw.strip()
    if not raw.startswith(('"', "'")):
        return re.split(r'\s+#', raw, maxsplit=1)[0].rstrip()
    quote = raw[0]
    result = []
    index = 1
    escapes = {'n': '\n', 'r': '\r', 't': '\t', '\\': '\\', '"': '"'}
    while index < len(raw):
        char = raw[index]
        if char == quote:
            rest = raw[index + 1:].strip()
            if rest and not rest.startswith('#'):
                raise ValueError('Valeur SMTP mal délimitée dans le .env.')
            return ''.join(result)
        if char == '\\' and index + 1 < len(raw):
            following = raw[index + 1]
            if quote == "'" and following == "'":
                result.append("'")
                index += 2
                continue
            if quote == '"' and following in escapes:
                result.append(escapes[following])
                index += 2
                continue
        result.append(char)
        index += 1
    raise ValueError('Une valeur SMTP entre guillemets est incomplète dans le .env.')


def load_settings(path, environ=None):
    environment = os.environ if environ is None else environ
    values = {}
    try:
        lines = Path(path).read_text(encoding='utf-8-sig').splitlines()
    except (OSError, UnicodeError):
        raise ValueError('Fichier .env illisible. Utiliser --env-file pour préciser son emplacement.') from None
    for line in lines:
        match = re.match(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$', line)
        if match and match[1] in KEYS:
            values[match[1]] = dotenv_value(match[2])
    # As with Compose, explicit shell variables override values in the file.
    return {**values, **{key: environment[key] for key in KEYS if key in environment}}


def mailbox(value):
    if any(char in value for char in '\r\n\x00'):
        raise ValueError('Adresse e-mail invalide.')
    address = parseaddr(value)[1]
    if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', address):
        raise ValueError('Adresse e-mail invalide.')
    return address


@dataclass(frozen=True, repr=False)
class Settings:
    host: str
    port: int
    secure: bool
    user: str
    password: str
    sender: str

    @classmethod
    def from_values(cls, values):
        secure = values.get('SMTP_SECURE', 'true').lower()
        if secure not in ('true', 'false', '1', '0'):
            raise ValueError('SMTP_SECURE doit être true ou false.')
        host = values.get('SMTP_HOST') or 'ssl0.ovh.net'
        if not re.fullmatch(r'[a-zA-Z0-9.-]{1,253}', host):
            raise ValueError('SMTP_HOST doit contenir un nom de serveur, sans https://.')
        try:
            port = int(values.get('SMTP_PORT') or '465')
        except ValueError:
            raise ValueError('SMTP_PORT doit être un numéro de port.') from None
        if not 1 <= port <= 65535:
            raise ValueError('SMTP_PORT doit être compris entre 1 et 65535.')
        user, password = values.get('SMTP_USER', ''), values.get('SMTP_PASSWORD', '')
        if not user or not password:
            raise ValueError('Renseigner SMTP_USER et SMTP_PASSWORD dans le .env.')
        if any(char in user + password for char in '\r\n\x00'):
            raise ValueError('Les identifiants SMTP doivent tenir sur une seule ligne.')
        sender = values.get('EMAIL_FROM') or user
        mailbox(sender)
        return cls(host, port, secure in ('true', '1'), user, password, sender)


def check_smtp(settings, recipient=None):
    destination = mailbox(recipient) if recipient else None
    context = ssl.create_default_context()
    print('Connexion SMTP et vérification TLS…', flush=True)
    if settings.secure:
        connection = smtplib.SMTP_SSL(settings.host, settings.port, timeout=15, context=context)
    else:
        connection = smtplib.SMTP(settings.host, settings.port, timeout=15)
    with connection as smtp:
        smtp.ehlo()
        if not settings.secure:
            # Never send credentials over an unencrypted connection.
            smtp.starttls(context=context)
            smtp.ehlo()
        print('TLS établi. Authentification…', flush=True)
        smtp.login(settings.user, settings.password)
        print('OK : connexion sécurisée et authentification SMTP réussies.', flush=True)
        if not destination:
            print('Aucun e-mail envoyé. Ajouter --to votre-adresse@domaine.fr pour tester la réception.')
            return
        message = EmailMessage()
        message['From'] = settings.sender
        message['To'] = recipient
        message['Subject'] = 'Test SMTP — Vertical Côtière'
        message['Date'] = format_datetime(datetime.now(timezone.utc))
        message['Message-ID'] = make_msgid()
        message.set_content('Bonjour,\n\nCet e-mail a été envoyé directement par le script Python de test SMTP de Vertical Côtière.\n\nLa connexion et l’authentification ont réussi. Sa réception confirme le parcours complet.\n')
        refused = smtp.send_message(message, from_addr=mailbox(settings.sender), to_addrs=[destination])
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
        print('OK : e-mail accepté par le serveur SMTP. Vérifier la boîte de réception et les indésirables.')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Tester le SMTP hors Strapi et Docker, sans dépendance Python supplémentaire.')
    parser.add_argument('--env-file', type=Path, default=DEFAULT_ENV, help='Fichier de configuration (par défaut : vertical-cotiere/.env).')
    parser.add_argument('--to', metavar='ADRESSE', help='Envoyer un véritable e-mail à cette adresse. Sans cette option, tester seulement la connexion et l’authentification.')
    args = parser.parse_args(argv)
    try:
        settings = Settings.from_values(load_settings(args.env_file))
        check_smtp(settings, args.to)
    except ValueError as error:
        print(f'Configuration : {error}', file=sys.stderr)
        return 2
    except smtplib.SMTPAuthenticationError as error:
        print(f'Authentification refusée (code {error.smtp_code}). Vérifier l’adresse complète et le mot de passe de la boîte OVH.', file=sys.stderr)
    except ssl.SSLCertVerificationError:
        print('Le certificat TLS du serveur n’a pas pu être validé. Vérifier SMTP_HOST et les certificats système.', file=sys.stderr)
    except (TimeoutError, socket.timeout):
        print('Délai de connexion dépassé. Vérifier SMTP_HOST, SMTP_PORT et les restrictions réseau.', file=sys.stderr)
    except socket.gaierror:
        print('Serveur SMTP introuvable. Vérifier SMTP_HOST et la résolution DNS.', file=sys.stderr)
    except smtplib.SMTPNotSupportedError:
        print('Le serveur ne prend pas en charge TLS ou l’authentification attendue. Vérifier le serveur et le port.', file=sys.stderr)
    except smtplib.SMTPRecipientsRefused:
        print('Le serveur a refusé le destinataire. Vérifier l’adresse indiquée avec --to.', file=sys.stderr)
    except smtplib.SMTPSenderRefused:
        print('Le serveur a refusé l’expéditeur. Utiliser une adresse autorisée dans EMAIL_FROM.', file=sys.stderr)
    except smtplib.SMTPResponseException as error:
        print(f'Le serveur SMTP a refusé l’opération (code {error.smtp_code}).', file=sys.stderr)
    except (smtplib.SMTPException, OSError, UnicodeError):
        # Server responses and exception details can contain credentials. Never
        # enable SMTP debug output or print a traceback with live configuration.
        print('Connexion ou envoi SMTP interrompu. Vérifier la configuration et l’accès réseau au serveur.', file=sys.stderr)
    except KeyboardInterrupt:
        print('Test interrompu.', file=sys.stderr)
    else:
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
