# La Grande Frise — consignes pour Claude

Appli web (PWA statique, sans build) publiée sur GitHub Pages depuis la branche `main`, à la racine.
Une leçon d'histoire par jour, des premiers dinosaures jusqu'à aujourd'hui, en environ 3 ans.

## Fichiers
- `data/periods.json` : les 11 périodes (id, bornes `start`/`end` en années avant aujourd'hui, couleur). Ne pas modifier les id.
- `data/lessons.json` : toutes les leçons, dans l'ordre. L'appli n'affiche une leçon qu'à partir de sa `date` (heure locale).
- `app.js`, `styles.css`, `index.html`, `sw.js` : l'appli. Après une modification de ces fichiers, incrémenter `VERSION` dans `sw.js`.
- `scripts/check_lessons.py` : à lancer avant chaque commit de leçons.

## Ajouter des leçons
1. Lire la dernière leçon de `data/lessons.json` : son champ `next` annonce le sujet de la leçon suivante.
2. Écrire les leçons à la suite : `day` = précédent + 1, `date` = précédente + 1 jour.
3. Lancer `python3 scripts/check_lessons.py` et corriger jusqu'à « OK ».
4. Commit sur `main` (message : `Leçons J8–J14`, par exemple) puis push.

Garder environ 7 jours d'avance : si la dernière `date` est à moins de 7 jours d'aujourd'hui, écrire la semaine suivante.

### Format d'une leçon
```json
{
  "day": 8,
  "date": "2026-10-13",
  "period": "jurassique",
  "ago": 200000000,
  "when": "Il y a environ 200 millions d'années",
  "title": "Titre court",
  "place": "Où ça se passe (avec le nom actuel du lieu)",
  "body": ["Paragraphe 1", "Paragraphe 2", "Paragraphe 3"],
  "keep": "À retenir : une ou deux phrases.",
  "fact": "Le savais-tu ? Une anecdote vraie et surprenante.",
  "q": "Une question de révision précise",
  "a": "Sa réponse, en une ou deux phrases.",
  "next": "Annonce du sujet de la leçon suivante."
}
```
- `ago` : années avant aujourd'hui, comprises dans les bornes de la période (sert à placer la leçon sur la frise).
- Pour les périodes historiques, `when` donne la date usuelle (« En 52 av. J.-C. », « Au XIIe siècle »).

### Style
- Français, tutoiement, ton clair et vivant, pour un adulte curieux qui n'est pas historien.
- 3 paragraphes de 70 à 110 mots. Pas de Markdown, pas d'emoji.
- Un seul sujet par leçon, raconté comme une histoire, avec des chiffres et des lieux concrets.
- Exactitude d'abord : chiffres et dates vérifiés ; quand les spécialistes hésitent, écrire « environ » ou le dire.
- La question doit pouvoir être répondue avec la leçon seule.
- Avancer dans l'ordre chronologique ; on peut revenir brièvement en arrière dans la même période si le récit l'exige.

### Rythme prévu (≈ 1 090 leçons)
| Période | Leçons |
|---|---|
| Trias | ~10 |
| Jurassique | ~20 |
| Crétacé | ~25 |
| Paléogène | ~15 |
| Néogène | ~15 |
| Paléolithique | ~60 |
| Néolithique | ~40 |
| Antiquité | ~250 |
| Moyen Âge | ~220 |
| Temps modernes | ~180 |
| Époque contemporaine | ~250 |

Ce rythme est indicatif : l'utilisateur peut demander d'aller plus vite ou de s'attarder sur un sujet.
