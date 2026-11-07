import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy_secret', Path(__file__).parents[1]/'deploy-mistral-secret.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class SecretDeploymentTests(unittest.TestCase):
    def test_preserve_other_secrets_and_remove_duplicate_key(self):
        old = '# Private file\nDATABASE_PASSWORD=keep-me\nMISTRAL_API_KEY=old\nAPP_KEYS=a,b\nexport MISTRAL_API_KEY=duplicate\n'
        new = deploy.replace_key(old, 'fixture-$VALUE-#-end')
        self.assertEqual(new, '# Private file\nDATABASE_PASSWORD=keep-me\nMISTRAL_API_KEY="fixture-$$VALUE-#-end"\nAPP_KEYS=a,b\n')
        self.assertEqual(deploy.replace_key(new, 'fixture-$VALUE-#-end'), new)
        self.assertEqual(deploy.replace_key('JWT_SECRET=keep', 'new'), 'JWT_SECRET=keep\nMISTRAL_API_KEY="new"\n')

    def test_invalid_keys_and_old_multiline_key_are_refused(self):
        for key in ['', '\n', ' key', 'key ', 'a\nb', 'a\rb', 'a\0b']:
            with self.subTest(key=repr(key)), self.assertRaises(deploy.DeploymentError):
                deploy.validate_key(key)
        with self.assertRaises(deploy.DeploymentError):
            deploy.replace_key("MISTRAL_API_KEY='first\nsecond'\nJWT_SECRET=keep\n", 'new')

    def server_directory(self, directory):
        directory = Path(directory)
        (directory/'compose.production.yaml').write_text('services: {}\n')
        (directory/'.env.production').write_text('JWT_SECRET=keep\nMISTRAL_API_KEY=old\n')
        return directory

    def test_atomic_write_and_only_cms_recreated_without_build_or_pull(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = self.server_directory(tmp)
            calls = []

            def compose(path, arguments):
                calls.append(arguments)
                if arguments == ['config', '--format', 'json']:
                    return json.dumps({'services': {'cms': {'environment': {'MISTRAL_API_KEY': 'new'}}}})
                return ''

            deploy.update_server(directory, 'new', compose)
            self.assertEqual((directory/'.env.production').read_text(), 'JWT_SECRET=keep\nMISTRAL_API_KEY="new"\n')
            self.assertEqual(stat.S_IMODE((directory/'.env.production').stat().st_mode), 0o600)
            self.assertEqual(calls[-1][-1], 'cms')
            for option in ['--no-deps', '--no-build', '--force-recreate', '--wait']:
                self.assertIn(option, calls[-1])
            self.assertEqual(calls[-1][calls[-1].index('--pull')+1], 'never')
            self.assertFalse(list(directory.glob('.env.production.*')))

    def test_bad_compose_restores_old_env_without_recreating_cms(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = self.server_directory(tmp)
            before = (directory/'.env.production').read_text()
            calls = []

            def compose(path, arguments):
                calls.append(arguments)
                return '{}' if '--format' in arguments else ''

            with self.assertRaises(deploy.DeploymentError):
                deploy.update_server(directory, 'new', compose)
            self.assertEqual((directory/'.env.production').read_text(), before)
            self.assertFalse(any(arguments[0] == 'up' for arguments in calls))

    def test_start_failure_restores_old_file_and_restarts_previous_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = self.server_directory(tmp)
            before = (directory/'.env.production').read_text()
            starts = []

            def compose(path, arguments):
                if '--format' in arguments:
                    return json.dumps({'services': {'cms': {'environment': {'MISTRAL_API_KEY': 'new'}}}})
                if arguments[0] == 'up':
                    starts.append((directory/'.env.production').read_text())
                    if len(starts) == 1:
                        raise deploy.DeploymentError('Restart failed')
                return ''

            with self.assertRaises(deploy.DeploymentError):
                deploy.update_server(directory, 'new', compose)
            self.assertEqual(len(starts), 2)
            self.assertEqual(starts[1], before)
            self.assertEqual((directory/'.env.production').read_text(), before)

    def test_ssh_uses_stdin_and_pinned_host_key_and_removes_local_files(self):
        key = 'fixture-api-key-$FOO-#-private'
        env = {'MISTRAL_API_KEY':key,'OVH_HOST':'ovh.example.org','OVH_USER':'deploy',
               'OVH_SSH_PRIVATE_KEY':'TEST KEY','OVH_SSH_KNOWN_HOSTS':'TEST HOST KEY',
               'OVH_DEPLOY_PATH':"/srv/club with spaces; $(echo harmless)"}
        private_paths = []

        def ssh(arguments, **kwargs):
            self.assertEqual(kwargs['input'], key)
            self.assertNotIn(key, ' '.join(arguments))
            self.assertNotIn('MISTRAL_API_KEY', kwargs['env'])
            self.assertNotIn('OVH_SSH_PRIVATE_KEY', kwargs['env'])
            self.assertIn('StrictHostKeyChecking=yes', arguments)
            private = Path(arguments[arguments.index('-i')+1])
            self.assertEqual(stat.S_IMODE(private.stat().st_mode), 0o600)
            private_paths.append(private)
            return subprocess.CompletedProcess(arguments, 0, '', '')

        with patch.dict(os.environ, env, clear=True), patch.object(deploy.subprocess, 'run', ssh), patch('builtins.print'):
            deploy.deploy_from_ci()
        self.assertTrue(private_paths)
        self.assertFalse(private_paths[0].exists())

    def test_dotenv_round_trip_with_real_docker_compose(self):
        # No Docker daemon or server contact: Compose only parses fixture files.
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory/'compose.yaml').write_text('services:\n  cms:\n    image: fixture:no-pull\n    environment:\n      MISTRAL_API_KEY: ${MISTRAL_API_KEY}\n')
            env = os.environ.copy()
            env.pop('MISTRAL_API_KEY', None)
            for key in ['fixture-normal', 'fixture-$VALUE-#-end', "fixture-quote'and\\slash", 'fixture-last\\', 'fixture-"double"', 'fixture-$${VALUE}']:
                (directory/'.env.production').write_text(deploy.replace_key('JWT_SECRET=keep\n', key))
                self.assertEqual(deploy.replace_key((directory/'.env.production').read_text(), key), (directory/'.env.production').read_text())
                result = subprocess.run(['docker','compose','--env-file','.env.production','-f','compose.yaml','config','--format','json'], cwd=directory, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                configured = json.loads(result.stdout)['services']['cms']['environment']['MISTRAL_API_KEY']
                self.assertIn(configured, [key, key.replace('$', '$$')])

    def test_ssh_failure_never_echoes_untrusted_output(self):
        key = 'fixture-private-key-never-print'
        env = {'MISTRAL_API_KEY':key,'OVH_HOST':'ovh.example.org','OVH_USER':'deploy',
               'OVH_SSH_PRIVATE_KEY':'TEST KEY','OVH_SSH_KNOWN_HOSTS':'TEST HOST KEY'}
        result = subprocess.CompletedProcess([], 1, 'DEPLOY_ERROR: '+key, key)
        with patch.dict(os.environ, env, clear=True), patch.object(deploy.subprocess, 'run', return_value=result):
            with self.assertRaises(deploy.DeploymentError) as error:
                deploy.deploy_from_ci()
        self.assertNotIn(key, str(error.exception))

    def test_ssh_host_option_injection_is_refused_before_connection(self):
        env = {'MISTRAL_API_KEY':'fixture-key','OVH_HOST':'-oProxyCommand=anything','OVH_USER':'deploy',
               'OVH_SSH_PRIVATE_KEY':'TEST KEY','OVH_SSH_KNOWN_HOSTS':'TEST HOST KEY'}
        with patch.dict(os.environ, env, clear=True), patch.object(deploy.subprocess, 'run') as ssh:
            with self.assertRaises(deploy.DeploymentError):
                deploy.deploy_from_ci()
            ssh.assert_not_called()


if __name__ == '__main__':
    unittest.main()
