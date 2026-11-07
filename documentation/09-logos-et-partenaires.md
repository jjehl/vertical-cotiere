# 09 — Logos et partenaires

Les images fournies dans `documentation/` sont conservées comme sources. Les
versions utilisées par le site sont copiées dans `frontend/public/images/partenaires/`,
avec des noms lisibles, pour être servies localement et embarquées dans les images Docker.

## Présence sur le site

- Le pied de page commun affiche les logos **FFME** et **CCMP**, accompagnés de leur rôle et d’un lien vers leur site.
- La page `/partenaires`, accessible depuis le pied de page, présente ces deux organismes ainsi que la ligue FFME Auvergne-Rhône-Alpes, le comité territorial FFME de l’Ain et les communes de Beynost, Saint-Maurice-de-Beynost et Miribel.
- L’ancienne page `/ressources/partenaires` redirige vers cette rubrique.
- L’en-tête utilise la signature avec la montagne et le nom « Vertical Côtière », plus lisible à cette taille. Le logo officiel du club (grimpeur Vertical Côtière) est conservé dans le pied de page, les pages d’erreur et la page du club, sans déformation ni recadrage.

La version horizontale `ffme-png-900.png` est utilisée pour la FFME. La variante
verticale `FFME_LOGO_2017.jpg` reste disponible dans la documentation mais n’est
pas répétée dans l’interface. Les logos gardent leurs couleurs et leurs proportions,
sans recadrage, avec un texte alternatif et un fond assurant leur lisibilité.

Les noms, liens et fichiers sont centralisés dans
[`frontend/app/data/partners.ts`](../frontend/app/data/partners.ts).

| Source fournie | Fichier servi |
| --- | --- |
| `ffme-png-900.png` | `/images/partenaires/ffme.png` |
| `ccmp.png` | `/images/partenaires/ccmp.png` |
| `logo_FFME_Rhone-Alpes.png` | `/images/partenaires/ffme-aura.png` |
| `logo_CT01.jpg` | `/images/partenaires/ffme-ain.jpg` |
| `Logo_commune_Beynost-768x344.png` | `/images/partenaires/beynost.png` |
| `Logo-Saint-Maurice-deBeynost.jpg` | `/images/partenaires/saint-maurice-de-beynost.jpg` |
| `logomiribel15.png` | `/images/partenaires/miribel.png` |
| `302482966_405720211686038_1591220801403520695_n.jpg` | `/images/vertical-cotiere.jpg` |
