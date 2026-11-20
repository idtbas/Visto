# 08 – Art Direction und Audio

## 1. Leitidee: „Sauberes Forschungslabor mit Persönlichkeit“

Das Genre-Vorbild ist 2D-Pixelkunst mit realistischem Gore. Wir gehen bewusst in die
Gegenrichtung – und gewinnen dadurch eine **eigene, wiedererkennbare Identität**:

- **3D, stilisiert, freundlich-technisch.** Weiße und hellgraue Fliesen, Warnstreifen in
  Gelb/Schwarz, orangefarbene Akzente, saubere Formen, weiche Schatten.
- **Die Dummies sind die Stars.** Glatte Vinyl-Crash-Test-Optik mit sichtbaren
  Segment-Fugen, Kalibrier-Markierungen (die typischen Kreis-Symbole an Kopf und Hüfte) –
  und ein **LED-Gesicht**, das Gefühle zeigt. Das macht sie sympathisch, ohne sie zu
  vermenschlichen.
- **Farbe trägt Information:** Glibber in Türkis (frei wählbar, nie Rot), heiß = orange
  Glühen, kalt = blauer Reif, Strom = violette Bögen, Säure = grünes Blubbern, Gefahr = Gelb.

## 2. Modell-Richtlinien

| Bereich | Regel |
|---------|-------|
| Polygon-Budget | Dummy-Segmente zusammen ≤ 4 000 Dreiecke; Items 200–3 000; Fahrzeuge ≤ 8 000 |
| Kollision | Getrennte, vereinfachte Kollision (Hull/Box), nie Präzisions-Kollision für dynamische Teile |
| Texturen | Ein **Atlas** pro Kategorie (1024²), `SurfaceAppearance` mit Color/Normal/Roughness für Hero-Items, sonst Vertex-Farbe + einfache Textur |
| Skala | 1 Stud = 0,28 m, Dummy 6 Studs. Griffe, Sitze, Türen passen zum Dummy |
| Attachments | Feste Namen: `Grip`, `Muzzle`, `Tip`, `EdgeA`/`EdgeB`, `Port_In_1`, `Port_Out_1`, `Spout`, `Seat` – der Code findet Funktionen über Namen |
| Waffen | Stilisiert: klobige Grundformen, Labor-Farben, Warnaufkleber, **keine realen Vorbilder** |
| Thumbnails | Automatisch gerendert in Studio (Plugin-Skript), einheitliche Kamera/Licht |

## 3. Zustands-Optik der Dummies

| Zustand | Darstellung |
|---------|-------------|
| Hülle beschädigt | 4 Textur-Stufen: sauber → Kratzer → Risse → stark gerissen (Risse leuchten in Glibberfarbe) |
| Wunde | Gepoolte Riss-Decals an der Trefferstelle, Leck-Partikel |
| Ruß | Abdunkeln der Segmentfarbe + Rauchpartikel |
| Frost | weißblaue Reif-Textur, Atem-Dampf aus dem „Mund“-Bereich |
| Strom | violettes Flackern, Gerüst blitzt im Röntgen-Look kurz durch (ohne Knochen – Metallrahmen) |
| Ätzen | fleckige, ausgebleichte, milchige Hülle (4 Stufen), Blubbern – Form bleibt immer erhalten |
| Ausgekugelt | Gelenkring blinkt orange |
| Deaktiviert | LED-Bildschirm schwarz, Segment-Fugen-Licht aus |

**LED-Gesicht:** 8 Grundausdrücke (siehe 02 §6) als Sprite-Sheet, Blinzeln, Blickrichtung
(Pupillen-Offset zum nächsten bewegten Objekt), Übergänge 0,1 s. Kosmetik-Sets ändern Stil,
nicht Bedeutung.

## 4. Licht und Umgebung

- `Lighting.Technology = Future` auf fähigen Geräten, automatisch reduziert auf schwächeren.
- Neutrale, helle Grundbeleuchtung (Lesbarkeit!), Akzente durch Lampen-Items und Glühen.
- Labor-Themen als Kosmetik: Standard, Nacht-Labor, Retro-Labor, Weltraum-Station,
  Unterwasser-Labor – nur Optik.

## 5. Effekte (VFX)

Alle Effekte aus einem eigenen Flipbook-Set, gepoolt und mit Qualitäts-Stufen:

| Effekt | Hoch | Niedrig (Handy/Bremse) |
|--------|------|------------------------|
| Explosion | Blitz, Feuerball-Flipbook, Rauch, Funken, Druckwellen-Ring, Kamera-Wackeln (abschaltbar) | Flipbook + Ring |
| Glibber | Tropfen + Leck-Strahl + Pfützen | nur Tropfen |
| Feuer | Flammen + Rauch + Glut + Licht | Flammen |
| Funken/Strom | Funken + Beam-Lichtbogen + Licht | Beam |
| Einschlag | Material-spezifisch: Holzsplitter, Metallfunken, Betonstaub, Glas-Glitzer | Staubwolke |

Blitz-Effekte (Explosion, Tesla) respektieren den Barrierefreiheits-Schalter „Blitze abschwächen“.

## 6. Audio

Neue **Audio-API** (AudioPlayer, AudioEmitter, AudioListener; seit 2024 stabil) mit
**Acoustic Simulation** (Verdeckung, Hall – seit September 2026 veröffentlicht): Explosionen
klingen in der großen Halle anders als im kleinen Labor.

| Gruppe | Inhalt |
|--------|--------|
| **Aufprall** | Materialpaare (Vinyl, Holz, Metall, Glas, Beton, Gummi) × 3 Stärken, zufällige Varianten + Tonhöhen-Streuung; Lautstärke ∝ Impuls (aus den Collision Summaries) |
| **Dummies** | Freundliche Synth-Laute: Piepen (Schreck), Brummen (Anstrengung beim Aufstehen), Zwitschern (benommen), „Bliep“ (Deaktivierung), Hochfahr-Jingle (Neustart). **Keine Schreie, kein Stöhnen, keine Stimmen** |
| **Gerüst** | Klack (Auskugeln), Knirschen (Bruch) – trocken, nicht eklig |
| **Waffen** | Stilisierte, kräftige Sounds, eher „Sci-Fi-Labor“ als realistische Schusswaffe; Nachhall per Akustik-Simulation |
| **Maschinen** | Motoren mit Drehzahl-Tonhöhe, Kolben-Zischen, Tesla-Summen ∝ Spannung, Förderband-Rattern |
| **UI** | Kurze, weiche Klicks; Spawn-„Plopp“; Fehler-„Bonk“ |
| **Musik** | Ruhige, verspielte Elektronik (Lab-Lounge), dynamisch leiser bei viel Action, abschaltbar. Eigene Kompositionen oder Lizenz aus der Roblox-Audio-Bibliothek |

Budget: max. 24 gleichzeitige Aufprall-Sounds pro Client, Priorität nach Lautstärke und Nähe.
