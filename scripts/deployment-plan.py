"""Resolve a deployment from a GitHub event, independently of mutable branch names."""
import json
import os
import re
import subprocess
from pathlib import Path

SEMVER = r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'


def deployment_plan(event_name, ref, event, revision):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Expected a full Git commit SHA')
    if event_name == 'push' and ref == 'refs/heads/main':
        return {'environment': 're7', 'version': revision, 'revision': revision, 'publish': 'true'}
    if event_name == 'release':
        release = event['release']
        tag = release['tag_name']
        if release.get('prerelease') or release.get('draft') or not re.fullmatch(SEMVER, tag):
            raise ValueError('Production requires a published stable release named X.Y.Z (without v)')
        return {'environment': 'prod', 'version': tag, 'revision': revision, 'publish': 'true'}
    if event_name in ('pull_request', 'workflow_dispatch'):
        return {'environment': '', 'version': revision, 'revision': revision, 'publish': 'false'}
    raise ValueError('Unsupported deployment event')


def main():
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD^{commit}'], text=True).strip()
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    plan = deployment_plan(os.environ['GITHUB_EVENT_NAME'], os.environ['GITHUB_REF'], event, revision)
    if plan['environment'] == 'prod':
        subprocess.run(['git', 'fetch', '--no-tags', 'origin', 'main'], check=True)
        subprocess.run(['git', 'merge-base', '--is-ancestor', revision, 'FETCH_HEAD'], check=True)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for name, value in plan.items():
            output.write(f'{name}={value}\n')


if __name__ == '__main__':
    main()
