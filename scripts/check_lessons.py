#!/usr/bin/env python3
"""Vérifie data/lessons.json avant chaque commit.

Usage : python3 scripts/check_lessons.py
Sort avec le code 1 si une erreur bloquante est trouvée.
"""
import json
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ["day", "date", "period", "ago", "when", "title", "place",
            "body", "keep", "fact", "q", "a", "next"]


def main() -> int:
    periods = json.loads((ROOT / "data/periods.json").read_text(encoding="utf-8"))["periods"]
    by_id = {p["id"]: p for p in periods}
    order = {p["id"]: i for i, p in enumerate(periods)}
    lessons = json.loads((ROOT / "data/lessons.json").read_text(encoding="utf-8"))["lessons"]

    errors, warnings = [], []
    prev = None
    for i, l in enumerate(lessons):
        tag = f"leçon #{i + 1}"
        missing = [k for k in REQUIRED if k not in l or l[k] in ("", None, [])]
        if missing:
            errors.append(f"{tag} : champs manquants {missing}")
            continue
        tag = f"J{l['day']}"
        if l["day"] != i + 1:
            errors.append(f"{tag} : le numéro devrait être {i + 1}")
        try:
            d = date.fromisoformat(l["date"])
        except ValueError:
            errors.append(f"{tag} : date invalide {l['date']!r}")
            d = None
        p = by_id.get(l["period"])
        if not p:
            errors.append(f"{tag} : période inconnue {l['period']!r}")
        elif not (p["end"] <= l["ago"] <= p["start"]):
            errors.append(f"{tag} : ago={l['ago']} hors de la période {p['name']} ({p['end']}–{p['start']})")
        if not isinstance(l["body"], list) or not (2 <= len(l["body"]) <= 4):
            errors.append(f"{tag} : body doit être une liste de 2 à 4 paragraphes")
        if prev:
            if d and prev["_d"] and d != prev["_d"] + timedelta(days=1):
                errors.append(f"{tag} : la date devrait être {prev['_d'] + timedelta(days=1)}")
            if p and order[l["period"]] < order.get(prev["period"], 0):
                errors.append(f"{tag} : retour en arrière de période ({prev['period']} → {l['period']})")
            if l["ago"] > prev["ago"]:
                warnings.append(f"{tag} : plus ancien que la leçon précédente (ago {l['ago']} > {prev['ago']})")
        l["_d"] = d
        prev = l

    for w in warnings:
        print("attention :", w)
    for e in errors:
        print("ERREUR :", e)
    if not errors:
        last = lessons[-1]
        print(f"OK : {len(lessons)} leçons, la dernière (J{last['day']}) sera visible le {last['date']}.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
