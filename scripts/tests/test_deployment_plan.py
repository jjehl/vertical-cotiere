import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('deployment_plan', Path(__file__).parents[1]/'deployment-plan.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SHA = 'a'*40


class DeploymentPlanTests(unittest.TestCase):
    def test_main_deploys_full_sha_to_re7(self):
        plan = module.deployment_plan('push', 'refs/heads/main', {}, SHA)
        self.assertEqual(plan['version'], SHA)
        self.assertEqual(plan['environment'], 're7')
        self.assertEqual(plan['publish'], 'true')

    def test_only_stable_published_semver_deploys_prod(self):
        for version in ['0.1.0', '1.0.0', '10.20.30']:
            plan = module.deployment_plan('release', 'refs/tags/'+version,
                                          {'release': {'tag_name': version}}, SHA)
            self.assertEqual(plan['environment'], 'prod')
            self.assertEqual(plan['version'], version)
        for version in ['v1.0.0', '1.0', '01.0.0', '1.0.0-rc.1', '1.0.0+build', '1.0.0;id']:
            with self.assertRaises(ValueError):
                module.deployment_plan('release', '', {'release': {'tag_name': version}}, SHA)
        for flag in ['draft', 'prerelease']:
            with self.assertRaises(ValueError):
                module.deployment_plan('release', '', {'release': {'tag_name': '1.0.0', flag: True}}, SHA)

    def test_pr_and_manual_checks_do_not_publish_or_deploy(self):
        for event in ['pull_request', 'workflow_dispatch']:
            plan = module.deployment_plan(event, '', {}, SHA)
            self.assertEqual(plan['publish'], 'false')
            self.assertEqual(plan['environment'], '')
        for ref in ['refs/heads/master', 'refs/tags/1.0.0', 'refs/heads/feature']:
            with self.assertRaises(ValueError):
                module.deployment_plan('push', ref, {}, SHA)
