"""Transfer a GitHub secret over SSH stdin; never put it in commands or logs."""
import base64
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile


class DeploymentError(Exception):
    pass


def validate_key(value):
    if not value or value != value.strip() or len(value) > 2048 or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise DeploymentError("MISTRAL_API_KEY doit contenir une clé non vide sur une seule ligne, sans espaces aux extrémités.")
    return value


def replace_key(content, key):
    # Quote for Compose dotenv, including literal dollars and trailing backslashes.
    encoded = validate_key(key).replace('\\', '\\\\').replace('"', '\\"').replace('$', '$$')
    literal = 'MISTRAL_API_KEY="' + encoded + '"\n'
    lines = content.splitlines(keepends=True)
    result = []
    inserted = False
    for line in lines:
        match = re.match(r"^[ \t]*(?:export[ \t]+)?MISTRAL_API_KEY[ \t]*[=:][ \t]*(.*)", line)
        if match:
            # Refuse a pre-existing multiline key rather than damage the env file.
            value = match.group(1).rstrip('\r\n')
            if value.startswith(("'", '"')):
                quote = value[0]
                closed, escaped = False, False
                for char in value[1:]:
                    if char == quote and not escaped:
                        closed = True
                        break
                    escaped = not escaped if char == '\\' else False
                if not closed:
                    raise DeploymentError("L’ancienne MISTRAL_API_KEY est sur plusieurs lignes ; fichier conservé.")
            if not inserted:
                result.append(literal)
                inserted = True
        else:
            result.append(line)
    if not inserted:
        if result and not result[-1].endswith('\n'):
            result.append('\n')
        result.append(literal)
    return ''.join(result)


def atomic_write(path, content):
    fd, name = tempfile.mkstemp(prefix='.env.production.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def compose(directory, arguments):
    env = os.environ.copy()
    env.pop('MISTRAL_API_KEY', None)  # The file must be the source of truth.
    try:
        result = subprocess.run(
            ['docker', 'compose', '--env-file', '.env.production', '-f', 'compose.production.yaml', *arguments],
            cwd=directory, env=env, capture_output=True, text=True, timeout=240,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise DeploymentError("Docker Compose indisponible ou délai dépassé.") from None
    # Compose may include resolved credentials in errors. Do not forward its output.
    if result.returncode:
        raise DeploymentError("Docker Compose a refusé l’opération ; vérifier le Compose et l’état du CMS sur le serveur.")
    return result.stdout


def update_server(directory, key, run_compose=compose):
    directory = Path(directory)
    path = directory / '.env.production'
    if not directory.is_absolute() or not directory.is_dir() or path.is_symlink() or not path.is_file() or not (directory/'compose.production.yaml').is_file():
        raise DeploymentError("Le dossier OVH doit déjà contenir compose.production.yaml et un .env.production régulier.")
    validate_key(key)
    up = ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', '--wait', '--wait-timeout', '180', 'cms']
    # Shared lock for concurrent secret rotations, including manual invocations.
    lock_fd = os.open(directory/'.deploy-mistral.lock', os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeploymentError("Un déploiement de clé est déjà en cours.") from None
        old = path.read_text(encoding='utf-8')
        new = replace_key(old, key)
        # Refuse to install a secret into a server with invalid/stale Compose.
        run_compose(directory, ['config', '--quiet'])
        atomic_write(path, new)
        started = False
        try:
            try:
                config = json.loads(run_compose(directory, ['config', '--format', 'json']))
                configured = config['services']['cms']['environment']['MISTRAL_API_KEY']
            except (ValueError, KeyError, TypeError):
                raise DeploymentError("Le Compose OVH ne transmet pas MISTRAL_API_KEY au CMS.") from None
            # `compose config` escapes dollars for reusable Compose output.
            if configured not in (key, key.replace('$', '$$')):
                raise DeploymentError("La clé est modifiée par la configuration Compose ; déploiement refusé.")
            started = True
            run_compose(directory, up)
        except Exception:
            atomic_write(path, old)
            if started:
                try:
                    run_compose(directory, up)
                except DeploymentError:
                    raise DeploymentError("Ancien fichier restauré, mais le CMS n’a pas redémarré correctement ; vérifier le serveur.") from None
            raise


def deploy_from_ci():
    key = validate_key(os.environ.get('MISTRAL_API_KEY', ''))
    required = ['OVH_HOST', 'OVH_USER', 'OVH_SSH_PRIVATE_KEY', 'OVH_SSH_KNOWN_HOSTS']
    for name in required:
        if not os.environ.get(name, '').strip():
            raise DeploymentError('Configurer '+name+' dans l’environnement GitHub production.')
    host, user = os.environ['OVH_HOST'], os.environ['OVH_USER']
    port = os.environ.get('OVH_PORT') or '22'
    directory = os.environ.get('OVH_DEPLOY_PATH') or '/srv/vertical-cotiere'
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.:-]*', host) or not re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_-]*', user):
        raise DeploymentError('OVH_HOST ou OVH_USER invalide.')
    if not port.isdigit() or not 1 <= int(port) <= 65535 or not directory.startswith('/') or '\n' in directory or '\r' in directory or '\0' in directory:
        raise DeploymentError('OVH_PORT ou OVH_DEPLOY_PATH invalide.')
    source = base64.b64encode(Path(__file__).read_bytes()).decode('ascii')
    # This command contains code and a path only. The API key travels on stdin.
    remote_code = 'import base64;exec(compile(base64.b64decode('+repr(source)+'),"deploy-mistral-secret.py","exec"))'
    command = shlex.join(['python3', '-c', remote_code, '--remote', directory])
    with tempfile.TemporaryDirectory(prefix='vertical-ssh-') as tmp:
        private = Path(tmp)/'identity'
        known_hosts = Path(tmp)/'known_hosts'
        for file, value in [(private, os.environ['OVH_SSH_PRIVATE_KEY']), (known_hosts, os.environ['OVH_SSH_KNOWN_HOSTS'])]:
            file.write_text(value.rstrip('\n')+'\n', encoding='utf-8')
            file.chmod(0o600)
        env = os.environ.copy()
        for name in ['MISTRAL_API_KEY', 'OVH_SSH_PRIVATE_KEY', 'OVH_SSH_KNOWN_HOSTS']:
            env.pop(name, None)
        try:
            result = subprocess.run([
                'ssh', '-F', '/dev/null', '-i', str(private), '-p', port, '-l', user,
                '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
                '-o', 'UserKnownHostsFile='+str(known_hosts), '-o', 'ConnectTimeout=15',
                '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '--', host, command,
            ], input=key, text=True, capture_output=True, timeout=600, env=env)
        except (OSError, subprocess.TimeoutExpired):
            raise DeploymentError('Connexion SSH indisponible ou délai dépassé ; vérifier OVH et les paramètres GitHub.') from None
        if result.returncode:
            # Remote errors are our own fixed messages. Never echo arbitrary SSH output.
            safe_errors = [line for line in result.stdout.splitlines() if line.startswith('DEPLOY_ERROR: ')]
            if safe_errors and safe_errors[-1] in SAFE_REMOTE_ERRORS:
                raise DeploymentError(safe_errors[-1].removeprefix('DEPLOY_ERROR: '))
            raise DeploymentError('Échec du déploiement OVH : vérifier l’accès SSH, Python 3, les fichiers de production et le CMS.')
    print('Clé Mistral transmise par SSH ; fichier privé mis à jour et CMS recréé avec succès.')


# Do not relay arbitrary remotely supplied text (it could include a credential).
SAFE_REMOTE_ERRORS = {
    'DEPLOY_ERROR: Docker Compose a refusé l’opération ; vérifier le Compose et l’état du CMS sur le serveur.',
    'DEPLOY_ERROR: Le Compose OVH ne transmet pas MISTRAL_API_KEY au CMS.',
    'DEPLOY_ERROR: La clé est modifiée par la configuration Compose ; déploiement refusé.',
    'DEPLOY_ERROR: Ancien fichier restauré, mais le CMS n’a pas redémarré correctement ; vérifier le serveur.',
    'DEPLOY_ERROR: Le dossier OVH doit déjà contenir compose.production.yaml et un .env.production régulier.',
}


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--remote':
            update_server(sys.argv[2], sys.stdin.read(2049))
        elif len(sys.argv) == 1:
            deploy_from_ci()
        else:
            raise DeploymentError('Invocation invalide.')
    except DeploymentError as error:
        print('DEPLOY_ERROR: '+str(error))
        sys.exit(1)
    except Exception:
        print('DEPLOY_ERROR: Opération interrompue ; vérifier les droits et la configuration du serveur.')
        sys.exit(1)
