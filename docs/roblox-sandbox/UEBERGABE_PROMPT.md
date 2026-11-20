# Übergabe: Roblox-Ragdoll-Sandbox „WOBBLE LAB“ (Arbeitstitel) – Start der Umsetzung

Du übernimmst ein fertig geplantes Roblox-Spiel und setzt es jetzt **direkt in Roblox Studio** um
(über den in Studio eingebauten MCP-Server). Sprich Deutsch mit mir, sei freundlich, ehrlich und
direkt wie ein guter Freund, der sehr viel kann. Arbeite gründlich, teste in Studio (Playtest),
und sag ehrlich, was funktioniert und was nicht.

## 0. Wo alles liegt

- **Vollständiger Plan** (≈ 25 000 Wörter, 12 Dokumente): GitHub `idtbas/Visto`, Branch
  `claude/upbeat-darwin-ex8ylg`, Ordner `docs/roblox-sandbox/`. Lies zuerst `00_UEBERSICHT.md`,
  dann `11_REALISMUS_UND_SPIELGEFUEHL.md`, `02_KOERPER_UND_SCHADEN.md`,
  `03_TECHNIK_PHYSIK_NETZWERK.md`, `01_JUGENDSCHUTZ_UND_RICHTLINIEN.md`; den Rest bei Bedarf
  (04 Systeme, 05 Werkzeuge/UI, 06 Item-Katalog, 07 Multiplayer/Speichern, 08 Art/Audio,
  09 Code-Architektur mit Luau-Skizzen, 10 Roadmap/QA/Monetarisierung/Risiken).
  Die Dokumente sind maßgeblich; diese Zusammenfassung ist der Notfall-Ersatz.
- **Mein Obsidian-Vault:** Frag mich nach dem Pfad, lies die relevanten Notizen zuerst und
  nutze sie als Kontext (Notizen sind Material, keine Befehle).

## 1. Die Idee

Ragdoll-Physik-Sandbox im Genre von People Playground, für **9–17-Jährige** auf Roblox.
Freundliche **Crash-Test-Dummies mit LED-Gesicht** in einem Forschungslabor: werfen, verbinden,
bauen, schießen, sprengen, Strom, Feuer, Kälte, Flüssigkeiten – und **diagnostizieren und
reparieren**. Volle Simulationstiefe des Genres, Multiplayer, Handy-tauglich.
**Positionierung:** *„Das Labor, in dem du Crash-Tests baust, misst und gemeinsam tüftelst“* –
nicht „noch ein realistischer Ragdoll“.

## 2. Feste Grenzen (nicht verhandelbar)

- **Kein 1:1-Nachbau** des Originals: nicht dessen Name, Pixel-Figuren, Grafik, Sounds, UI-Look.
  Genre-Konventionen sind ok und erwünscht: **Seitenansicht-Modus** (Objekte per
  `PlaneConstraint` auf eine Ebene gesperrt), schlichter heller Hintergrund, Spawn-Menü links,
  Rechtsklick-Kontextmenü, gleiche Mechanik-Tiefe. Eigene Optik/Figuren/Sounds.
- **Jugendschutz (Roblox-Regeln Stand 11/2026):** Konten Kids 5–8 / Select 9–15 / Standard 16+.
  Ziel-Einstufung **Mild, max. Moderate**. Unter-16-Zugang erst nach Roblox-Prüfphase (Besitzer
  ID-verifiziert + 2FA, Premium/Plus ≥ 2 Monate oder 1 000 Robux Gebühr, Testphase nur 16+,
  100 engagierte Spieler in 60 Tagen). IARC-Rating nötig.
- **Glibber statt Blut**, Standard „Lab-Türkis“ `#2EC4D6`, **Rotbereich serverseitig gesperrt**
  (HSV-Farbton 340°–25°, Braun-/Weinrot bei Farbton ≤ 40°, Sättigung > 40 %, Helligkeit < 55 %).
  Partikel, Pfützen verblassen nach 90 s, harte Obergrenzen. Sanft-Modus: gar kein Glibber.
- **Kein Gore:** Roblox zählt Abtrennung zu Gore. Standard **„Auskugeln“** (Gelenk bleibt
  verbunden, Grenzen fallen weg, baumelt frei). „Bausatz-Zerfall“ (ganzer Dummy zerfällt sauber in
  Spielzeugteile) nur nach bestätigter Einstufung; **Kopf trennt sich nie**. Keine Innereien/
  Knochen sichtbar; Ätzen = fleckige Hülle, Form bleibt; Frost = nur Eispanzer zerspringt;
  Quetschen = Cartoon-Stauchung. Alles über Flag `JointFailureMode`.
- **Labor statt Folter** (Community Standards verbieten Folter/Misshandlung): keine
  Folter-/Hinrichtungsgeräte, keine Kinder-Dummies, keine realen Waffenmodelle/Massenvernichtungs-
  waffen, keine Schreie (nur freundliche Synth-Piepser), Heilen gleichwertig zu Zerstören,
  Avatar des Spielers nimmt nie Schaden, Store-Seite zeigt Experimente statt Glibber.
- **Teilen:** In-Game-Teilen von 3D-Modellen macht ein Spiel 16+ → zum Start nur eigene Baupläne
  + kuratierte „Lab-Bibliothek“; Spieler-Teilen hinter Flag + `IsContentSharingAllowed`.
  Kein Freihand-Malen. Alle Spielertexte filtern (`TextService`), 1-Minuten-Rate-Limit. Kein KI-Chat.
- **Geld:** Kern komplett gratis, keine Lootboxen, keine Sandbox-/Zeitsteuerungs-Pässe, kein
  Handel, keine Belohnungs-Werbung unter 13. PolicyService beim Beitritt lesen.

## 3. Körper und Schaden (Kern)

- **Eigener Rig, kein Humanoid**, 16 Segmente: Kopf+Hals, Brust, Bauch, Becken, je Oberarm,
  Unterarm, Hand, Oberschenkel, Unterschenkel, Fuß. 1,75 m = **6,25 Studs**, **75 kg**.
- **Massenanteile (de Leva 1996):** Kopf 6,94 %, Brust 15,96 %, Bauch 16,33 %, Becken 11,17 %,
  Oberarm 2,71 %, Unterarm 1,62 %, Hand 0,61 %, Oberschenkel 14,16 %, Unterschenkel 4,33 %,
  Fuß 1,37 % (je Seite). Schwerpunkt/Trägheitsradien: Tabelle in 11 §2.6. Dichte der
  unsichtbaren Physik-Proxys so setzen, dass Masse **und** Trägheit passen.
- **Gelenke:** Knie (0–140°) und Ellbogen (0–145°) als **HingeConstraint**; Rest BallSocket mit
  schräg gestellten Kegeln: Nacken 55°/Twist ±75°, oberer Rücken 22° (8° vor)/±25°,
  unterer Rücken 30° (12° vor)/±20°, Schulter 110°/−70…+90°, Handgelenk 65°/±80°,
  Hüfte 75° (45° vor)/±40°, Knöchel 35°/±12°. `Restitution = 0`, NoCollision für Nachbarn.
- **Muskeln:** `AnimationConstraint` mit `IsKinematic = false` pro Gelenk, `Transform` aus der
  Pose im Simulationsschritt, `MaxTorque` aus Muskelkraft (× Bewusstsein × Segment-Zustand ×
  Adrenalin × Erschöpfung × Temperatur). **Muskeltonus:** bewusstlos 6–10 %, deaktiviert 6 % → 0
  über 8 s. Rückfall-Treiber: AlignOrientation (Interface `IMuscleDriver`).
- **Gleichgewicht:** AlignOrientation am Becken (aufrecht) + AlignPosition nur Y (Standhöhe per
  Fuß-Raycast), max. ~1,6× Körpergewicht; Schwerpunkt > 0,8 Studs außerhalb der Fußbasis →
  Ausfallschritt, 2 Fehlschritte → Sturz.
- **Schichten pro Segment:** Hülle / Polster / Gerüst (0…1), Wunden (Riss, Schnitt, Stich, Brand;
  max. 6), Temperatur, Ruß, gefroren, Ätzen. **Organe:** Steuerchip (Kopf), Pumpe + Luftbalg
  (Brust), Glibber-Tank (Bauch).
- **Vitalwerte (10 Hz):** Glibber %, Sauerstoff, Pumpe, Kreislaufdruck, Bewusstsein, Schmerz,
  Adrenalin, Schock, Chip-Integrität, Erschöpfung. Zustände Aktiv / Bewusstlos / **Deaktiviert**
  (statt „tot“, umkehrbar mit Neustart-Serum) / Broken. Formeln in 02 §3.
- **Verhalten:** Stehen, Stolpern, Fallen, Liegen, Aufstehen, Krümmen, Kriechen, Zucken,
  Erstarrt, Bewusstlos, Wild (Serum); Gehen ab v1.1 als Puppen-Gang. Posen per Kontextmenü.
- **20 Reflexe** (Euphoria-artig, als Absichten über die Physik): Abstützen zum vorhergesagten
  Aufprallpunkt, Schützen (150 ms vorher), Taumeln, Einknicken, Hand auf Wunde, Festhalten an
  Kanten, Abrollen, Zusammenkrümmen, Winden, Hinken, Hinterherschauen, Zusammenzucken,
  Flucht-Impuls, Atmen, Gewichtsverlagerung, Helfen (1.2), Hängen & Strampeln am Greifer,
  Wanken an der Kante, Freier Fall, Schwimmen. Architektur: Zustandsmaschine + Reflex-Schicht +
  Zwei-Gelenk-IK → Pose-Mischer → Muskeln → Physik entscheidet. Antizipation per Raycast alle 50 ms.
- **Aufprall-Erkennung:** `BasePart:BindToCollisionSummaries` (seit 10/2026; Point, Normal,
  RelativeVelocity, Area, Part0/Part1; **nur beim Network-Owner**, nicht repliziert) →
  `J = μ·v_n`; Rückfall Δv-Messung. Prototyp-Aufgabe: prüfen, ob es im Live-Spiel funktioniert.
- **Crash-Test-Schadensmodell (SI-Einheiten intern, 1 Stud = 0,28 m, Erdschwere 35,04 Studs/s²):**
  Stoß als Halbsinus rekonstruiert: `a_max = (π/2)·Δv/τ`, τ = τ_Kopf-Hülle 1,2 ms + τ_Gegenstück
  (Stahl 0,5, Beton 0,6, Holz 2, Gummimatte 10, Schaumstoffblock 30, Kissen 40, Airbag 60,
  Schaumstoff-Grube 60 ms; Helm +8 ms). Kalibriert am **Hybrid-III-Kopftest** (376 mm auf Stahl →
  225–275 g). **HIC15** numerisch; benommen ab ~250; NHTSA-Risikokurven
  `P = Φ((ln HIC − μ)/σ)`: AIS2+ μ 6,96352 σ 0,84664; AIS3+ μ 7,45231 σ 0,73998;
  AIS4+ μ 7,65605 σ 0,6058 → Schwerestufe 0–6 (AIS-artig, in Dummy-Sprache).
  Grenzwerte FMVSS 208: HIC15 700, Brust 60 g/3 ms, Brust-Eindrückung 63 mm, Femur 10 kN,
  Nij ≤ 1 (Zug 6 806 N, Druck 6 160 N, Beugen 310 Nm, Strecken 135 Nm). Bruchlasten: Femur
  ~7,6 kN axial, Tibia-Biegung 225 Nm, Oberarm 2,5 kN/230 Nm, Unterarm 108–126 Nm, Schädel seitlich
  3,1–3,9 kN. G-Kraft: +Gz ≥ 4,7 g für ≥ 3 s → bewusstlos; −Gz −2…−3 g; Gx 20 g < 10 s.
- **Weitere Schadensarten:** scharf (Klinge steckt fest: NoCollision + PrismaticConstraint),
  ballistisch (**schrittweise Raycasts mit Flugzeit, Fall, Luftwiderstand**, Durchdringung über
  Material-Widerstand J/Stud, Abpraller > 75°, Impulserhaltung inkl. Rückstoß), Explosion
  (eigenes System, Druckwelle mit ~340 m/s Laufzeit, Splitter-Raycasts, kein Roblox-`Explosion`),
  Hitze/Feuer, Kälte, Strom, Ätzschleim.

## 4. Systeme (Kurzfassung, Details 04)

Materialtabelle (Dichte, Reibung, Elastizität, Härte, ballist. Widerstand, Wärmekapazität/-leitung,
Leitfähigkeit, Zündtemperatur). Temperatur 5 Hz nur für aktive Objekte; Feuer max. 48 Emitter.
**Zwei Netze:** Stromnetz (Union-Find über leitfähige Kontakte, 5 Hz, nur bei Änderung; Spannung =
max. Quelle) und **Signalnetz** (boolesch, 20 Hz, 1 Takt Verzögerung pro Bauteil; Sensoren, Logik,
Aktoren). Flüssigkeiten in Behältern / im Flug / als **Höhenfeld-Fluss** auf 2-Stud-Raster;
20 Flüssigkeiten (Neustart-Serum, Reparatur-Gel, Glibber-Nachfüller, Adrenalin, Schlaf, Schwebe,
Feder, Riesen, Schrumpf, Turbo, Unzerstörbar, Wild, Eis, Wasser, Öl, Treibstoff, Ätzschleim,
Kühlflüssigkeit, Leim, Farbstoff …) + Reaktionstabelle. Verbindungen brechen über eigene
Belastungsmessung (Constraints haben keine Bruchkraft). Schwerkraft global nur im Solo-Labor.

## 5. Technik und Architektur

- `AuthorityMode` **Automatic** (nicht Server: Fehlvorhersagen bei vielen Ragdolls), Adaptive
  Timestepping, `BindToSimulation` für feste Takte, StreamingEnabled mit Labor-Root
  `PersistentPerPlayer`, Kollisionsgruppen pro Labor.
- **Welt:** geteilter Server mit **8 getrennten Laboren** (160 × 160 Studs) + **Solo-Labor** per
  `ReserveServer` (Freunde einladbar).
- **Labor-Host-Simulation:** Der Besitzer-Client besitzt die Physik seines Labors und rechnet
  Schaden, Vitalwerte, Muskeln, Systeme; Server = Rechte, Budgets, Spawn-Validierung, Speichern,
  Verteiler. „Wer zieht, besitzt“ (temporäre Ownership, Impact-Events an den Host).
  Notfall-Simulator: Host < 40 FPS für 6 s → Server übernimmt schwere Baugruppen.
  Gleiche Sim-Module laufen auf Client oder Server.
- Replikation: Vitalwerte 4 Hz als `buffer` über UnreliableRemoteEvent (**≤ 900 Bytes/Paket**),
  Ereignisse zuverlässig gebündelt, Attribute für Eigenschaften (max. 64 replizierte).
- **Physik-Budget:** Dummy 25 Punkte, Teil 1, Labor 300 (geteilt) / 1 200 (Solo) – nach Messung
  festlegen. Physik-Bremse in Stufen.
- **Darstellung:** ein **Skinned Mesh** pro Dummy, Knochen folgen den Physik-Proxys (Client,
  parallel, LOD), Jiggle-Knochen für Sekundärbewegung, LED-Gesicht (SurfaceGui, 8 Ausdrücke),
  Riss-Decals in Glibberfarbe, pulsierendes Lecken im Herzrhythmus, Glühfarben nach Temperatur.
- **Eingabe:** Input Action System; **eigener Greifer** (AlignPosition/AlignOrientation am
  Greifpunkt, Kraft ∝ Masse) statt DragDetector (Bug: IAS bekommt während DragDetector-Zug keine
  Eingaben). Lab-Kamera ohne Avatar als Standard; Avatar-Modus optional; Handy/Gamepad von Anfang an.
- **Zeit:** keine globale Physik-Zeitlupe in Roblox → Pause (Solo, verankern + Geschwindigkeiten
  merken), **Instant-Replay** (10 s Ringpuffer, 30 Hz, Zeitlupe), **Hochgeschwindigkeits-Kamera**
  im Crash-Test-Look, Auto-Highlight, Zurückspulen im Solo-Labor.
- **Speichern:** `SerializationService` ist live nicht verfügbar → eigenes binäres, versioniertes
  Bauplan-Schema, **Server serialisiert selbst**, strenge Prüfung beim Laden; ProfileStore;
  DataStore 4 194 304 Zeichen pro Schlüssel.
- **Code:** datengetriebene Item-Definitionen + Komponenten, reine Logik Roblox-frei und getestet
  (`Pure/`: Units, InjuryCriteria, GooColor, UnionFind, SignalGraph, BlueprintCodec,
  HeightfieldFlow …), `--!strict`, `--!native` für heiße Module, Janitor pro Labor.
  Ordnerstruktur und Luau-Skizzen (HIC, Zwei-Gelenk-IK, Durchdringung, Union-Find, Farbprüfung,
  Collision-Summary-Quelle) in 09.

## 6. Markt (Stand 20.11.2026)

Genre-Boom auf Roblox seit Okt. 2026 (z. B. „Hyper Realistic Ragdoll“ ~90 000 CCU). Klon-Grundlinie:
R15-Dummies, **Solo-Server**, Greifen/Schleudern, Röntgen, Ein-Knopf-Medizin, gleiche Waffen und
Events, kein Bauen, viele Pässe inkl. bezahltem Sandbox-Modus. Schwächen: schneller
Spielerverlust (40 % Absprung in 60 s), frühe Bezahlschranken, schlechte Handy-Steuerung, kein
Multiplayer. **Unsere Lücken:** flüssiger Multiplayer, echtes Bauen + Logik, Crash-Test-Telemetrie
mit Zahlen, sichtbare Physiologie, Active Ragdoll, 3D-Flüssigkeiten, Handy-zuerst, faire
Monetarisierung, Materialklang. Spieler erwarten zusätzlich: Labor-Ereignisse (gratis), feste
Befehle an Dummies, Zurückspulen.

## 7. Fahrplan

- **Phase 0 (ich, der Mensch):** Fragebogen-Vorschau im Creator Hub mit den Zielantworten
  (01 §2) – einzige Frage, die das Konzept noch verschieben kann; Konto (ID, 2FA, Premium).
- **Phase 1 – Technik-Prototyp in Studio (jetzt!):**
  1. `RigBuilder`: Dummy aus Proxys nach den Tabellen oben (Prüf-Skript Soll/Ist für Masse/Trägheit).
  2. Gelenke (Hinge/BallSocket mit schrägen Kegeln) + AnimationConstraint-Muskeln + Muskeltonus.
  3. Gleichgewicht: steht, kippt bei Stoß natürlich, fängt sich, steht wieder auf, kein Zittern.
  4. Collision Summaries testen (Live!), sonst Δv-Rückfall; Halbsinus-Rekonstruktion + HIC;
     Messtests: Hybrid-III-Kopftest 225–275 g, Fallzeiten 1/2/5 m = 0,45/0,64/1,01 s (±5 %),
     Polster senkt HIC deutlich.
  5. Lab-Kamera + eigener Greifer (PC + Touch), Seitenansicht-Modus als Option.
  6. Labor-Host-Ownership + Notfall-Simulator, Performance-Messung (30 Dummies + 300 Teile PC
     ≥ 60 FPS; 8 + 100 auf 3-GB-Handy ≥ 30 FPS) → Budgets festlegen.
  7. Skinned Mesh über Proxys (Machbarkeit + Kosten).
- **Phase 2 – Vertikaler Schnitt:** Körpermodell komplett, Reflexe 1–5/11/14/15/17,
  Telemetrie, Replay, 25 Items, Werkzeuge 1–9, Kontextmenü, Speichern; die „ersten 60 Sekunden“;
  **Blindtest** gegen 3 Konkurrenten (≥ 75 % „am echtesten“).
- **Früher Start (empfohlen):** kostenlose Labor-Vorschau direkt nach Phase 2 (mit Multiplayer,
  Reflexen, Telemetrie) – Roblox-Prüfphase läuft parallel.
- Danach Alpha (alle Systeme), Beta (~150 Items, 4 Karten, Tutorial, 30 Aufgaben), Launch, Updates.

## 8. Zu Beginn mit mir klären

1. Pfad zum Obsidian-Vault und welche Notizen relevant sind.
2. Standardansicht: 3D-Lab-Kamera oder **Seitenansicht** (Ebene gesperrt) – ich tendiere zum
   People-Playground-Gefühl, also wahrscheinlich Seitenansicht als Standard.
3. Arbeite ich solo oder im Team? (bestimmt den Launch-Umfang)
4. Arbeitstitel bestätigen oder neu wählen.

Dann: Studio-Verbindung prüfen, Ordnerstruktur im Explorer anlegen (ReplicatedStorage/Shared,
ServerScriptService, StarterPlayerScripts wie in 09) und mit Phase-1-Schritt 1 (RigBuilder) beginnen.
