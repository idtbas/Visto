# 05 – Werkzeuge, Steuerung, Benutzeroberfläche

Über die Hälfte der Roblox-Spieler ist am Handy. Ein Sandbox, das nur mit Maus und
Rechtsklick-Menü funktioniert, verliert diese Hälfte. Deshalb wird **jede Funktion für drei
Eingaben gleichzeitig entworfen**: Maus/Tastatur, Touch, Gamepad.

---

## 1. Kamera und Spieler

| Modus | Beschreibung | Standard |
|-------|-------------|----------|
| **Lab-Kamera** | Freie Kamera ohne Avatar: Orbit um einen Fokuspunkt, Pan, Zoom, Fliegen. Der Avatar steht geparkt am Labor-Rand | ✔ Standard (wie die Gott-Perspektive des Genres) |
| **Avatar-Modus** | Mit eigenem Avatar herumlaufen, Items aufheben, Waffen halten (3rd Person, optional 1st Person) | Taste `V` / Button |
| **Folgen** | Kamera folgt einem Objekt (Kontextmenü „Folgen“) | – |
| **Replay-Kamera** | Freie Kamera im Instant-Replay | – |

Der Avatar nimmt **nie Schaden** (siehe 01 §4.6). Er kann aber umgeworfen werden (Avatar Joint
Upgrade macht ihn kurz physikalisch) und steht dann wieder auf.

---

## 2. Werkzeugleiste

Die Werkzeugleiste unten (Hotkeys 1–0, am Handy wischbare Leiste, am Gamepad L1/R1).

| # | Werkzeug | Funktion | Details |
|---|----------|----------|---------|
| 1 | **Greifer** (Standard) | Ziehen, Werfen, Drehen | Greift am Punkt unter dem Cursor (nicht am Mittelpunkt), Federkraft ∝ Masse – schwere Objekte schwingen träge, leichte folgen sofort. Während des Ziehens: Mausrad = Abstand, `Q/E` = drehen, `Shift` = feiner, `Z` = an Ort einfrieren, loslassen mit Schwung = werfen |
| 2 | **Verbinden** | Starr (Schweißen), Gelenk (Scharnier), Kugelgelenk, Schiene (Prismatic) | Erster Klick = Punkt A auf Objekt 1, zweiter Klick = Punkt B auf Objekt 2 (oder auf die **Welt** = am Hintergrund festpinnen) |
| 3 | **Seil & Feder** | Seil, Kette (Seil mit Gliedern-Optik), Feder, Stange | Länge = Abstand beim Setzen; Kontextmenü: Länge, Steifigkeit, Dämpfung, Stärke |
| 4 | **Kabel** | Signalkabel (3 Farben nur zur Ordnung), Stromkabel, Flüssigkeitsschlauch | `Tab` = Schaltplan-Ansicht |
| 5 | **Einfrieren** | Objekt verankern/lösen | Eingefrorene Objekte haben einen blauen Rand |
| 6 | **Klonen** | Auswahl kopieren | Platzierung mit Vorschau-Silhouette, Raster/Winkel-Einrasten mit `Alt` |
| 7 | **Löschen** | Auswahl löschen | Hält man die Taste, wird alles unter dem Pinsel gelöscht. `Strg+Z` macht's rückgängig |
| 8 | **Skalieren** | Größe ändern (0,25× … 4×) | Grundformen frei pro Achse, komplexe Items nur gleichmäßig (`Model:ScaleTo`) |
| 9 | **Scanner** | Diagnose-Ansicht | Röntgenblick, Vitalwerte-Panel, Verbindungs-Belastung, Explosionsradien, Masse und Schwerpunkt |
| 0 | **Kräfte** | Stoßen, Ziehen, Anheben, Blitz, Anzünden, Löschen, Gefrieren | „Telekinese“-Kräfte als Untermenü – schneller Spaß ohne Items |

**Auswahl:** Klick = ein Objekt, `Shift`+Klick = hinzufügen, Ziehen auf leerem Grund =
Auswahlrechteck, `Strg+A` = alles im Labor. Die Auswahl gilt für Klonen, Löschen, Einfrieren,
Speichern als Bauplan, Verschieben.

**Rückgängig/Wiederholen** (`Strg+Z`/`Strg+Y`, am Handy Buttons oben): Befehlsverlauf für
Spawnen, Löschen, Verbinden, Lösen, Eigenschaften, Skalieren – **nicht** für die Physik selbst
(die lässt sich nicht zurückspulen; dafür gibt es das Replay und gespeicherte Szenen).
50 Schritte, pro Labor.

---

## 3. Kontextmenü

PC: Rechtsklick. Touch: lange drücken (0,4 s) → **Radialmenü** mit großen Feldern.
Gamepad: `Y` auf das fokussierte Objekt.

Allgemein (jedes Objekt):
- Benutzen/Aktivieren · Einfrieren · Klonen · Löschen · Folgen · Info
- Kollision aus/an · Schwerelos an/aus · Material (nur Grundformen) · Farbe (Palette) ·
  Temperatur setzen · Unzerstörbar (nur Solo)

Dummy zusätzlich:
- **Pose** (Automatisch/Stehen/Gehen/Sitzen/Ducken/Steif/Schlaff) · Greifen/Loslassen ·
  Heilen (Solo: sofort; geteilt: nur über Seren/Geräte) · Glibberfarbe · Kleidung/Skin ·
  Scannen

Maschinen zusätzlich:
- Einstellungen je nach Typ (Kraft, Geschwindigkeit, Verzögerung, Reichweite, Schwellwert,
  Richtung umkehren), Reparieren, Ports anzeigen

Behälter/Spritzen: Inhalt, Leeren, Aufziehen, Öffnen/Schließen

Waffen: Feuermodus, Munitionstyp, Sicherung, Laservisier an/aus

---

## 4. Spawn-Menü

- Links einklappbar (am Handy als Vollbild-Schublade). Oben **Suche** (Name, Kategorie,
  Schlagwort, auch Deutsch/Englisch gemischt), darunter **Favoriten** und **Zuletzt benutzt**.
- Kategorien mit Icon (Katalog in [06](06_ITEM_KATALOG.md)): Dummies · Nahkampf · Waffen ·
  Sprengstoff · Fahrzeuge · Maschinen · Elektrik & Logik · Chemie · Medizin · Bauteile ·
  Möbel & Deko · Umgebung · **Meine Baupläne** · **Lab-Bibliothek**.
- Kacheln: Vorschaubild (3D-Thumbnail, vorab gerendert), Name, Physik-Punkte.
- **Spawnen:** Kachel antippen → das Item hängt als Vorschau-Silhouette am Cursor/Bildschirmmitte,
  Klick/Tippen platziert. Oder Kachel ins Labor ziehen. Mehrfach-Spawn mit `Shift`.
- Schließen mit `Q` (PC) bzw. Wischen.

---

## 5. Bildschirm-Aufbau

```
┌──────────────────────────────────────────────────────────────────────┐
│ [≡ Menü] [↶][↷]   Labor 3 · 214/300 Punkte ▓▓▓▓▓▓░░   [⏸][⏪ Replay] │  ← Top-Leiste
│┌────────┐                                              ┌───────────┐│
││ Spawn- │                                              │ Inspektor ││  ← rechts, nur bei
││ Menü   │                 3D-Labor                     │ (Auswahl) ││    Auswahl / Scanner
││        │                                              │ Vitalwerte││
││        │                                              │ Optionen  ││
│└────────┘                                              └───────────┘│
│        [1 Greifer][2 Verb.][3 Seil][4 Kabel][5 ❄][6 ⧉][7 🗑]…[9 🔍]  │  ← Werkzeugleiste
└──────────────────────────────────────────────────────────────────────┘
```

**Inspektor** (bei ausgewähltem Dummy): Zustand + LED-Gesicht-Miniatur, Balken für Glibber,
Sauerstoff, Druck, Bewusstsein, Schmerz, Adrenalin, Schock, Temperatur, Puls-Kurve, Liste der
Zustände („Inneres Lecken“, „Luftbalg geplatzt“, „2 Brüche“, „Wunden ×4“, „12 % Ruß“), eine
Körper-Silhouette mit eingefärbten Segmenten. Das ist die „Arzt-Ansicht“, die im Genre so beliebt ist.

UI-Technik: **UI Styling** (StyleSheets, seit Januar 2026 veröffentlicht) für ein
konsistentes Design-System; Komponenten in **React-lua** oder **Fusion** (Entscheidung im
Prototyp; Empfehlung: React-lua wegen Ökosystem und Typen).

---

## 6. Steuerung pro Plattform

| Aktion | Maus/Tastatur | Touch | Gamepad |
|--------|---------------|-------|---------|
| Kamera drehen | Rechte Maustaste halten | Zwei Finger drehen | Rechter Stick |
| Kamera bewegen | `WASD`, `Space`/`Ctrl` hoch/runter | Zwei Finger verschieben | Linker Stick, `LT`/`RT` hoch/runter |
| Zoom | Mausrad | Pinch | Kreuz hoch/runter |
| Objekt greifen | Linke Maustaste halten | Ein Finger auf Objekt halten + ziehen | `A` halten (Fadenkreuz-Mitte) |
| Kontextmenü | Rechtsklick (kurz) | Lange drücken | `Y` |
| Aktivieren | `F` | Doppeltipp | `X` |
| Werkzeug wechseln | `1`–`0` | Leiste antippen | `LB`/`RB` |
| Spawn-Menü | `Q` | Button links | `Menü`-Taste |
| Scanner | `S` (Halten = kurz) | Button | Kreuz links |
| Pause / Replay | `P` / `R` | Buttons oben | `View` / Kreuz rechts |
| Rückgängig | `Strg+Z` | Button | – (im Menü) |

Gamepad und Touch nutzen ein **Fadenkreuz in der Bildschirmmitte** als Zeiger, sobald nicht mit
dem Finger auf ein Objekt gezeigt wird. Ziele sind auf Touch mind. **44 × 44 pt** groß.

---

## 7. Einsteigerfreundlichkeit

Die Genre-Analyse zeigt als größte Kritikpunkte: „schwer zu lernen (Logik/Kabel)“ und „keine
Ziele“. Antworten:

1. **Interaktives Tutorial** (5 Minuten, überspringbar): Spawnen → Ziehen → Verbinden →
   Scanner → ein Serum spritzen → Pause/Replay. Läuft in einem eigenen Mini-Labor.
2. **Kontext-Tipps:** Beim ersten Benutzen eines Werkzeugs erscheint ein kurzer Hinweis mit
   Mini-Animation (einmal pro Konto).
3. **Lab-Bibliothek:** ~40 offizielle, ladbare Szenen und Maschinen („Kettenreaktion“,
   „Crash-Test-Rampe“, „Taktgeber mit Lampe“, „Feuerlösch-Anlage“, „Rettungsstation“) – zum
   Lernen durch Auseinandernehmen.
4. **Schaltplan-Ansicht** mit Signalfluss-Animation (Pulse wandern sichtbar durch Kabel).

---

## 8. Labor-Aufgaben (optionaler Zielmodus)

Ein reines Sandbox verliert Spieler nach der ersten Stunde. Ein **optionaler** Aufgaben-Katalog
gibt Richtung, ohne die Freiheit zu nehmen:

| Typ | Beispiele |
|-----|-----------|
| **Rettung** | „Stabilisiere den Dummy nach dem Crash: Pumpe läuft, Glibber > 50 %, bei Bewusstsein“ – mit Zeitlimit und Ressourcen-Vorgabe |
| **Konstruktion** | „Baue eine Maschine, die einen Dummy sanft 20 Studs weit transportiert“, „Lampe, die alle 2 s blinkt“ |
| **Kettenreaktion** | „Löse mit einem einzigen Knopfdruck 5 verschiedene Ereignisse aus“ |
| **Physik-Rätsel** | „Bring den Ball ins Ziel, nur mit Seilen und Federn“ |
| **Crash-Test** | „Entwirf einen Schutzkäfig, in dem der Dummy einen 40-Studs-Fall übersteht“ |

- Belohnung: **Abzeichen** (Roblox Badges), kosmetische Freischaltungen (LED-Gesichter, Skins,
  Labor-Themen), **niemals** Spielvorteile oder Kauf-Ersatz.
- Die Prüfung („Pumpe läuft“, „Lampe blinkt alle 2 s“) ist dieselbe Logik wie der Dummy-Sensor
  und die Signal-Bauteile → billig zu bauen.
- Rettungs-Aufgaben setzen bewusst das Gegengewicht zum Zerstören (Rahmung, siehe 01 §4).

---

## 9. Barrierefreiheit und Sprache

- Texte in **Deutsch und Englisch** zum Start (Roblox-Lokalisierungstabellen), weitere
  Sprachen über automatische Übersetzung + Korrektur der wichtigsten Strings.
  (Die Genre-Referenz ist nur auf Englisch – das ist ein Kritikpunkt, den wir lösen.)
- Farbenblind-Modus für den Scanner (Muster statt nur Farbe), UI-Skalierung 80–140 %,
  Bildschirm-Wackeln abschaltbar, Blitz-Effekte abschwächbar (Tesla-Spule, Explosionen).
- **Sanft-Modus** (Eltern-/Spielerschalter): kein Glibber, keine Gelenkzerlegung, Explosionen
  als Konfetti-Wolke. Wird pro Konto gespeichert.
