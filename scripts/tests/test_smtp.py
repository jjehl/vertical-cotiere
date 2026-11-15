import contextlib
import importlib.util
import io
from pathlib import Path
import smtplib
import sys
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location('smtp_check', Path(__file__).resolve().parents[1] / 'test-smtp.py')
smtp = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = smtp
SPEC.loader.exec_module(smtp)


class SmtpTests(unittest.TestCase):
    def test_dotenv_preserves_password_characters_and_shell_override(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text("UNRELATED_SECRET='not-a-value-to-parse\nSMTP_USER=sender@example.org # comment\nSMTP_PASSWORD='a$# b\\c'\nSMTP_SECURE=true\n", encoding='utf8')
            values = smtp.load_settings(path, {'SMTP_USER': 'override@example.org'})
        self.assertEqual(values['SMTP_PASSWORD'], 'a$# b\\c')
        self.assertEqual(values['SMTP_USER'], 'override@example.org')
        self.assertNotIn('UNRELATED_SECRET', values)
        self.assertEqual(smtp.dotenv_value('"a\\\\b\\\"c$#" # comment'), 'a\\b"c$#')

    def settings(self, secure=True):
        return smtp.Settings('smtp.example.org', 465 if secure else 587, secure, 'sender@example.org', 'do-not-display-password', 'sender@example.org')

    def test_default_mode_authenticates_without_sending(self):
        with patch.object(smtp.smtplib, 'SMTP_SSL') as connect, contextlib.redirect_stdout(io.StringIO()) as output:
            smtp.check_smtp(self.settings())
            connection = connect.return_value.__enter__.return_value
            connection.login.assert_called_once_with('sender@example.org', 'do-not-display-password')
            connection.send_message.assert_not_called()
        self.assertNotIn('do-not-display-password', output.getvalue())

    def test_starttls_precedes_login_and_explicit_recipient_sends(self):
        with patch.object(smtp.smtplib, 'SMTP') as connect, contextlib.redirect_stdout(io.StringIO()):
            connection = connect.return_value.__enter__.return_value
            connection.send_message.return_value = {}
            smtp.check_smtp(self.settings(False), 'recipient@example.org')
        methods = [call[0] for call in connection.method_calls]
        self.assertEqual(methods[:4], ['ehlo', 'starttls', 'ehlo', 'login'])
        message = connection.send_message.call_args.args[0]
        self.assertEqual(str(message['To']), 'recipient@example.org')
        self.assertEqual(connection.send_message.call_args.kwargs['to_addrs'], ['recipient@example.org'])

    def test_tls_failure_never_sends_credentials(self):
        with patch.object(smtp.smtplib, 'SMTP') as connect, contextlib.redirect_stdout(io.StringIO()):
            connection = connect.return_value.__enter__.return_value
            connection.starttls.side_effect = smtplib.SMTPNotSupportedError('no TLS')
            with self.assertRaises(smtplib.SMTPNotSupportedError):
                smtp.check_smtp(self.settings(False))
            connection.login.assert_not_called()

    def test_auth_failure_does_not_expose_server_response_or_password(self):
        with patch.object(smtp, 'load_settings', return_value={}), patch.object(smtp.Settings, 'from_values', return_value=self.settings()), patch.object(smtp, 'check_smtp', side_effect=smtplib.SMTPAuthenticationError(535, b'do-not-display-password')), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(smtp.main([]), 1)
        self.assertIn('535', output.getvalue())
        self.assertNotIn('do-not-display-password', output.getvalue())


if __name__ == '__main__':
    unittest.main()
