#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_dir"

if [[ $# -gt 0 ]]; then
  if [[ $# -eq 1 && ( "$1" == '--help' || "$1" == '-h' ) ]]; then
    echo 'Usage : ./start-project.sh'
    echo 'Prépare le .env et démarre PostgreSQL, SeaweedFS, Strapi et Nuxt en local.'
    exit 0
  fi
  echo 'Usage : ./start-project.sh' >&2
  exit 2
fi

for executable in node docker; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "Commande requise introuvable : $executable" >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo 'Docker Compose v2 est requis.' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo 'Docker est inaccessible : démarre Docker et vérifie les droits de ton utilisateur.' >&2
  exit 1
fi

compose=(docker compose --project-directory "$project_dir" -f "$project_dir/compose.yaml")
node scripts/init-env.mjs
"${compose[@]}" config --quiet

echo 'Construction et démarrage des services locaux…'
if ! "${compose[@]}" up --build -d --wait --wait-timeout 600; then
  echo 'Démarrage incomplet. Consulte les logs depuis le dossier du projet :' >&2
  echo '  docker compose logs --tail 100 -f' >&2
  exit 1
fi

"${compose[@]}" config --format json | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const { services } = JSON.parse(input);
    console.log("Site : http://localhost:" + services.web.ports[0].published);
    console.log("Administration : http://localhost:" + services.cms.ports[0].published + "/admin");
  });
'
echo 'Logs : docker compose logs --tail 100 -f cms web'
echo 'Arrêt en conservant les données : docker compose down'
