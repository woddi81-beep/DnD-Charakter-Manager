# ⚔️ D&D 5e Charakter Manager

Eine Web-App zur einfachen Erstellung von D&D 5e Charakteren.

## Features

- **Schritt-für-Schritt Assistent** - Volk, Klasse, Hintergrund, Attribute, Fertigkeiten
- **Point-Buy System** - Flexible Attributverteilung
- **PDF Export** - Detaillierter Charakterbogen zum Download
- **Charakterverwaltung** - Speichern, Laden, Klonen, Löschen
- **Mehrspieler-Support** - Nach Spielern filtern
- **ChatGPT-Integration** - Charakter direkt von OpenAI analysieren lassen
- **Responsive Design** - Funktioniert auf Desktop und Mobile
- **Mehrsprachig** - Komplett auf Deutsch

## Technologie

- Vanilla JavaScript (kein Framework)
- jsPDF für PDF-Generierung
- Node.js Server (optional, kann auch statisch gehostet werden)

## Nutzung

### Option 1: Direkt öffnen
Einfach `DnD_Charakter_Manager.html` im Browser öffnen.

### Option 2: Mit Server
```bash
OPENAI_API_KEY=dein_api_key node char_server.js
```
Dann öffnen: http://localhost:8080/DnD_Charakter_Manager.html

Optional:

- `OPENAI_MODEL=gpt-4.1` überschreibt das Standardmodell
- Ohne `OPENAI_API_KEY` funktioniert die ChatGPT-Analyse nicht

## Klassen

- ⚔️ Barbar
- 🎵 Barde
- 🌿 Druide
- 🛡️ Krieger
- 👊 Mönch
- ✝️ Paladin
- 🗡️ Schurke
- ⛪ Kleriker
- 🔮 Zauberer
- 🌙 Hexmeister
- 🏹 Waldläufer

## License

MIT
