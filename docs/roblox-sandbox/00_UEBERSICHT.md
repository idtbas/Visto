# WOBBLE LAB – Konzept für ein Ragdoll-Physik-Sandbox auf Roblox (9–17 Jahre)

> *Arbeitstitel. Vor Veröffentlichung auf Eindeutigkeit prüfen (Roblox-Suche, Markenregister).*

**Stand:** 20.11.2026 · **Status:** Konzept fertig, bereit für Phase 0 · **Plattform:** Roblox
(PC, Handy, Tablet, Konsole, Browser)

---

## Die Idee in drei Sätzen

Ein Forschungslabor voller freundlicher **Crash-Test-Dummies**, in dem Spieler alles ausprobieren
können: werfen, verbinden, bauen, schießen, sprengen, unter Strom setzen, einfrieren, anzünden –
und danach **diagnostizieren und reparieren**. Jeder Dummy hat ein vollständiges Körpermodell
(Hülle, Polster, Gerüst, Pumpe, Steuerchip, Glibberkreislauf, Bewusstsein, Schmerz, Adrenalin)
und reagiert physikalisch, biologisch und im Verhalten glaubwürdig. Alles ist **multiplayerfähig**,
läuft **auf dem Handy** und ist für **unter 18-Jährige** gebaut – Blut ist farbiger Glibber,
Gewalt bleibt cartoonhaft, der Rahmen ist Wissenschaft statt Grausamkeit.

## Ehrliche Vorbemerkung zum „1:1“

Ich habe die **Tiefe** des Genre-Vorbilds (People Playground) systematisch erfasst und in diesen
Plan übernommen: Schichten-Schadensmodell, Kreislauf und Vitalwerte, stecken bleibende Klingen,
Durchdringungs-Ballistik, Temperatur/Feuer/Kälte, Strom, Aktivierungs-Logik, Flüssigkeiten mit
Mischungen, Spritzen, Medizin-Geräte, Werkzeuge, Pause/Zeitlupe, Baupläne. Mechaniken darf man
übernehmen. **Name, Figuren, Grafik, Sounds und das Aussehen** des Originals dagegen nicht – das
wäre eine Kopie, rechtlich riskant (Abmahnung/Löschung) und würde auf Roblox ohnehin nicht als
„unter 18“ durchgehen. Darum bekommt das Spiel eine **eigene Identität**, die gleichzeitig das
Jugendschutz-Problem löst: Testpuppen mit LED-Gesicht statt Menschen mit Pixel-Gore. Mechanisch
fehlt nichts Wesentliches; in einigen Punkten wird es sogar mehr (Multiplayer, Handy, Zielmodus,
Replay, zwei Sprachen).

---

## Säulen

1. **Lesbare Physik.** Jeder Stoß, Treffer und Sturz fühlt sich richtig an und hat sichtbare
   Folgen. (Active Ragdoll mit echten Muskeln, Aufpralldaten direkt aus der Engine.)
2. **Tiefe Simulation, einfache Bedienung.** Die Systeme sind komplex, die Werkzeuge nicht.
   Drei Eingabearten von Anfang an.
3. **Systeme reagieren miteinander.** Feuer × Treibstoff × Strom × Wasser × Kälte × Körper.
4. **Heilen ist so spannend wie Zerstören.** Scanner, Seren, Defibrillator, Rettungs-Aufgaben.
5. **Gemeinsam basteln.** Labore im geteilten Server, Solo-Labor mit Freunden.
6. **Sicher für Jüngere.** Glibber statt Blut, kein Gore, keine Folter-Motive, keine Lootboxen.
7. **Krass echt – messbar.** Echte Einheiten und Biomechanik, Crash-Test-Kriterien als
   Schadensmodell, 20 Reflexe, durchgehender Körper, echte Ballistik, Klang aus Materialpaaren.
   Wir holen den „Wow“-Effekt aus Physik und Leben statt aus Blut – genau dort, wo die
   Roblox-Klone nichts machen ([11](11_REALISMUS_UND_SPIELGEFUEHL.md)).

## Was übernommen wird – und was sich ändert

| Genre-Merkmal | Bei uns |
|---------------|---------|
| 2D, Seitenansicht | **3D**, freie Lab-Kamera (+ optionaler Avatar-Modus) |
| Menschen mit Haut/Fleisch/Knochen | **Dummies** mit Hülle/Polster/Gerüst – gleiche Mechanik |
| Rotes Blut, Gore | **Farbiger Glibber** (nie Rot), Partikel, verblasst; keine Innereien |
| Abtrennen von Gliedmaßen | **Auskugeln** (baumelt frei) als Standard; sauberer Spielzeug-Zerfall nur nach bestätigter Einstufung; Kopf trennt sich nie |
| Tod | **Deaktivierung** (Bildschirm geht aus) – umkehrbar mit Neustart-Serum |
| Einzelspieler | **Multiplayer**-Labore + Solo-Labor mit Freunden |
| PC | PC, **Handy**, Tablet, Konsole, Browser |
| Keine Ziele | Freies Sandbox **+ optionale Labor-Aufgaben** |
| Zeitlupe | Pause + **Instant-Replay** in Zeitlupe (Roblox hat keine globale Zeitlupe) |
| Workshop + Mods | Baupläne speichern, Lab-Bibliothek; Teilen erst nach Klärung (Roblox-16+-Regel); **kein fremder Code** |
| Nur Englisch | Deutsch + Englisch |

---

## Die wichtigsten Entscheidungen auf einen Blick

| Entscheidung | Gewählt | Kapitel |
|--------------|---------|---------|
| Ziel-Einstufung | Mild, höchstens Moderate → erreichbar ab 9 Jahren (nach Roblox-Prüfphase) | [01](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md) |
| NPC-Rig | Eigener 16-Segment-Rig, kein Humanoid, anatomische Gelenke (Scharniere an Knie/Ellbogen), nicht-kinematische AnimationConstraint als Muskel, sichtbar als ein durchgehendes Skinned Mesh | [02](02_KOERPER_UND_SCHADEN.md), [11](11_REALISMUS_UND_SPIELGEFUEHL.md) |
| Einheiten & Schaden | Intern SI-Einheiten, Erdschwere; Kopf/Brust/Nacken/Bein-Schäden aus echten Crash-Test-Kriterien (HIC, Nij …) | [11 §2–3](11_REALISMUS_UND_SPIELGEFUEHL.md) |
| Aufprall-Erkennung | Collision Summaries (seit 10/2026), Δv-Messung als Rückfall | [02 §5.1](02_KOERPER_UND_SCHADEN.md#51-stumpf-aufprall-quetschen) |
| Netzwerk | **Labor-Host-Simulation**: der Besitzer simuliert sein Labor, Server ist Schiedsrichter/Speicher; Server übernimmt bei schwachen Geräten | [03 §3](03_TECHNIK_PHYSIK_NETZWERK.md#3-netzwerk-und-autorität) |
| Server Authority | **Nicht** verwendet (Fehlvorhersagen bei vielen Ragdolls) | [03 §1](03_TECHNIK_PHYSIK_NETZWERK.md#1-engine-grundeinstellungen) |
| Welt | Geteilter Server mit 8 getrennten Laboren + reservierte Solo-Labore | [03 §2](03_TECHNIK_PHYSIK_NETZWERK.md#2-weltaufbau) |
| Inhalte | Datengetrieben, Komponenten-System | [09](09_CODE_ARCHITEKTUR.md) |
| Speichern | Eigenes binäres, versioniertes Bauplan-Schema; Server serialisiert selbst | [07](07_MULTIPLAYER_SPEICHERN.md) |
| Teilen | Zum Start nur kuratierte Lab-Bibliothek; Spieler-Teilen hinter Flag | [01 §5](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md#5-teilen-von-bauplänen-text-chat) |
| Geld | Kern gratis, Pässe/Kosmetik, keine Lootboxen | [10](10_ROADMAP_QA_MONETARISIERUNG.md#monetarisierung) |

---

## Dokumente

| # | Datei | Inhalt |
|---|-------|--------|
| 01 | [Jugendschutz & Richtlinien](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md) | Roblox-Regeln Stand 11/2026, Einstufung, Glibber-/Gelenk-Regeln, Rahmung, Teilen, Checkliste |
| 02 | [Körper & Schaden](02_KOERPER_UND_SCHADEN.md) | Rig, Muskeln, Gleichgewicht, Schichten, Organe, Vitalwerte + Formeln, Verhalten, alle Schadensarten |
| 03 | [Technik: Physik & Netzwerk](03_TECHNIK_PHYSIK_NETZWERK.md) | Engine-Einstellungen, Weltaufbau, Labor-Host-Modell, Replikation, Budgets, Zeitsteuerung, Darstellung |
| 04 | [Simulationssysteme](04_SYSTEME_UND_SIMULATION.md) | Material, Temperatur/Feuer/Kälte, Strom, Signale/Logik, Flüssigkeiten/Seren/Mischungen, Zerstörung, Verbindungsbruch, Umgebung |
| 05 | [Werkzeuge, UI, Steuerung](05_WERKZEUGE_UI_STEUERUNG.md) | Kamera, Werkzeuge, Kontextmenü, Spawn-Menü, Inspektor, Steuerung je Plattform, Tutorial, Labor-Aufgaben, Barrierefreiheit |
| 06 | [Item-Katalog](06_ITEM_KATALOG.md) | ≈ 150 Items in 12 Kategorien mit Phasen, Waffen-Werte, Karten |
| 07 | [Multiplayer & Speichern](07_MULTIPLAYER_SPEICHERN.md) | Rollen, Freunde-Labore, Bauplan-Schema, DataStores, Teilen, Schutz vor Störungen |
| 08 | [Art & Audio](08_ART_UND_AUDIO.md) | Stil, Modell-Richtlinien, Zustands-Optik, VFX, Sound |
| 09 | [Code-Architektur](09_CODE_ARCHITEKTUR.md) | Rojo-Struktur, Item-Definitionen, Kern-Algorithmen in Luau, Treffer-Ablauf |
| 10 | [Roadmap, QA, Geld, Risiken](10_ROADMAP_QA_MONETARISIERUNG.md) | Phasen mit Abnahmekriterien, Launch inkl. Roblox-Prüfphase, Tests, Kennzahlen, Monetarisierung, Risiken |
| 11 | [**Realismus & Spielgefühl**](11_REALISMUS_UND_SPIELGEFUEHL.md) | Abstand zu den Klonen, echte Biomechanik, Crash-Test-Schadensmodell, Reflexe, Skinned Mesh, Ballistik, Klang, Kamera, Welt mit Gedächtnis, Wettbewerbsanalyse, Messtests |

## Die ersten drei Schritte

1. **Fragebogen-Vorschau** im Creator Hub mit den Zielantworten aus 01 §2 durchspielen. Das ist
   die einzige Frage, die das ganze Konzept noch verschieben kann.
2. Konto vorbereiten (ID, 2FA, Premium/Plus – muss bei Release 2 Monate alt sein).
3. **Technik-Prototyp** (Phase 1): ein Dummy, der steht, kippt, wieder aufsteht und Aufpralle
   über die Collision Summaries spürt – auf PC und Handy.
