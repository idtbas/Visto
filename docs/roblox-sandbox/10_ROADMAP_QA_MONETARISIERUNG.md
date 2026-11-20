# 10 – Roadmap, Qualitätssicherung, Monetarisierung, Risiken

Zeitangaben für **eine erfahrene Person in Teilzeit (~20 h/Woche)** und in Klammern für ein
**kleines Team** (2 Programmierer, 1 3D-Artist, 1 Sound/UI teilweise). Jede Phase endet mit
prüfbaren **Abnahmekriterien** – keine Phase beginnt, bevor die vorige abgenommen ist.

---

## Phase 0 – Klärung & Setup (1 Woche)

| Aufgabe | Abnahme |
|---------|---------|
| Roblox-Konto vorbereiten: ID-Verifizierung, 2FA, Premium/Plus (muss bei Release ≥ 2 Monate alt sein!) **oder** 1 000 Robux Gebühr einplanen | erledigt |
| **Fragebogen-Vorschau** mit den Zielantworten aus 01 §2 durchspielen; Ergebnis als Screenshot ins Repo | Stufe Mild oder Moderate bestätigt |
| Anfrage an Roblox-Support: Bausatz-Zerfall (Stufe B) und Bauplan-Teilen mit `IsContentSharingAllowed` | Anfrage gestellt (Antwort nicht blockierend) |
| Repo, Rojo, Wally, Lint, Format, Jest-Lua, CI | `rojo serve` läuft, CI grün |
| Arbeitstitel, Logo-Skizze, Moodboard | Moodboard fertig |

## Phase 1 – Technik-Prototyp „Kann das fliegen?“ (4 Wochen · Team: 2)

Ziel: die riskantesten Annahmen **früh** beweisen oder verwerfen.

| Risiko-Test | Abnahme |
|-------------|---------|
| Dummy-Rig mit BallSocket + AnimationConstraint (nicht kinematisch) | steht, kippt bei Stoß natürlich, steht wieder auf; kein Zittern |
| **Collision Summaries im veröffentlichten Spiel** | liefern Daten im Live-Server (sonst: Δv-Rückfall aktiv) |
| Labor-Host-Ownership + Ziehen mit eigenem Greifer | flüssig bei 150 ms Ping für den Host; Zuschauer sehen ruckelfrei |
| Notfall-Simulator (Ownership-Wechsel zum Server) | Wechsel ohne sichtbare Sprünge |
| Performance-Messung | 30 Dummies + 300 Teile auf Referenz-PC ≥ 60 FPS; 8 Dummies + 100 Teile auf 3-GB-Handy ≥ 30 FPS – **danach Budgets festlegen** |
| Schwerkraft-Test (196,2 / 100 / 50) mit 5 Testspielern | „Lab-Standard“ festgelegt |

## Phase 2 – Vertikaler Schnitt (6 Wochen · Team: 4)

Ein kleines, aber **komplett poliertes** Stück Spiel:

- Körpermodell komplett (02) mit Stumpf-, Scharf-, Ballistik-, Explosionsschaden, Vitalwerten,
  Zuständen, Verhalten (ohne Gehen).
- 25 Items quer durch alle Kategorien, Glibber-Optik, LED-Gesicht, Scanner + Inspektor.
- Werkzeuge 1–9, Kontextmenü (PC + Touch), Spawn-Menü, Rückgängig.
- Speichern/Laden eines Bauplans.

**Abnahme:** 10 externe Testspieler (Ziel-Alter, mit Einverständnis der Eltern) spielen 20 min
ohne Hilfe; ≥ 7 sagen „würde wieder spielen“; keine Absturz-/Leck-Fehler in 2-h-Sitzung.

## Phase 3 – Alpha: Systeme komplett (8 Wochen · Team: 5)

- Temperatur, Feuer, Kälte, Strom, Signale, Flüssigkeiten, Mischungen, Zerstörung, Verbindungs-
  bruch (04).
- Multiplayer-Labore mit Rollen, Solo-Labor, Einladungen (07).
- Instant-Replay, Pause, Einzelschritt.
- ~100 Items.

**Abnahme:** Alle Systeme interagieren (Test-Szene „Kettenreaktion“ läuft deterministisch genug,
dass sie 9 von 10 Mal gleich endet); Server-Heartbeat ≥ 45 bei 8 vollen Laboren.

## Phase 4 – Beta: Inhalte & Politur (6 Wochen · Team: 4)

- ~150 Items, 4 Karten, 20 Flüssigkeiten, Lab-Bibliothek (40 Baupläne), Tutorial, 30
  Labor-Aufgaben, Badges, Shop, Lokalisierung DE/EN, Barrierefreiheit, Sanft-Modus.
- Store-Seite (Icon, Thumbnails, Trailer) nach den Rahmungsregeln (01 §4.7).
- Geschlossene Beta (Freunde/Discord, 50–100 Spieler).

**Abnahme:** Checkliste 01 §7 vollständig grün; keine bekannten Absturzfehler; D1-Rückkehr der
Beta-Spieler ≥ 25 %.

## Phase 5 – Launch (2 Wochen + Prüfphase)

1. Veröffentlichen mit vollständigem Fragebogen + IARC.
2. **Prüfphase:** Zuerst nur für **alters-geprüfte 16+**; Ziel: **100 verschiedene „stark
   engagierte“ Spieler in 60 Tagen** → dafür vorab eine Community aufbauen (Devlog, Discord,
   Roblox-Gruppe, kleine Werbekampagne über Roblox-Ads an 16+). Optional beschleunigte Prüfung
   (50 000 Robux, erstattbar).
3. Nach bestandener Prüfung erreichbar für Select (9–15) – **dann** ist der eigentliche Launch
   für die Zielgruppe. Zweite Werbewelle.

## Phase 6 – Live-Betrieb

| Update | Inhalt |
|--------|--------|
| 1.1 (+6 Wochen) | Robo-Dummy, Gehen, Aufsätze, Laser & Spiegel, neue Karten, 30 neue Items |
| 1.2 (+12 Wochen) | Glibber-Blob, Zahnräder, Bagger/Kran, Vulkan-Labor, EditableImage-Wunden |
| Laufend | Monatliche „Labor-Events“ (z. B. Crash-Test-Woche mit eigener Aufgabe), Bauplan der Woche, Teilen-Funktion sobald geklärt |

**Gesamt bis Launch:** Die Phasen summieren sich auf ≈ 27 Wochen – das gilt für das **kleine
Team** (plus Prüfphase ≈ 7–8 Monate). Ehrlich für **eine Person in Teilzeit: 12–15 Monate**.
Für Solo empfehle ich einen **Solo-Kern** zum Launch: alle Dummies außer Robo, Nahkampf,
die 8 Waffen der ersten Zeilen, Granate/Dynamit/Fass/Konfetti-Bombe, Gokart + Crash-Test-
Schlitten, die Maschinen bis „Hydraulikpresse“, komplette Logik, 10 Flüssigkeiten,
Defibrillator + Puls-Monitor, alle Bauteile, 2 Karten (≈ 80 Items). Der Rest kommt als Updates –
das hält das Spiel außerdem lange frisch.

---

## Qualitätssicherung

### Automatisch
- Jest-Lua für alle `Pure/`-Module (Formeln, Codec-Rundreise, Migrationen, Farbprüfung,
  Union-Find, Signal-Graph, Reaktionstabelle).
- **Bauplan-Rundreise-Test:** jede Szene der Lab-Bibliothek speichern → laden → vergleichen.
- **Fuzzing** der Netzwerk-Schicht: zufällige/kaputte Nachrichten dürfen den Server nie stören.

### Test-Szenen (in Studio, per Skript startbar)
| Szene | Prüft |
|-------|-------|
| „100-Dummy-Stapel“ | Physik-Budget, Sleep, Bremse |
| „Kettenreaktion“ | Systeminteraktion, Determinismus |
| „Schießstand“ | Durchdringung, Abpraller, Wunden |
| „Stromwald“ | Union-Find-Performance, Lichtbögen |
| „Flut“ | Pfützen-Obergrenzen, Flüssigkeits-Kosten |
| „Marathon“ | 2-h-Sitzung, Speicherlecks (Instanzzahl & Speicher konstant?) |

### Geräte-Matrix
Mittelklasse-PC, Low-End-Laptop, iPhone (2 Generationen alt), Android mit 3 GB RAM, Tablet,
Xbox, Browser (Play on the Web).

### Kennzahlen (AnalyticsService, eigene Ereignisse)
Tutorial-Abschluss, erste 5 Minuten (Funnel), D1/D7/D30-Rückkehr, Sitzungslänge, meist-
gespawnte Items, Werkzeug-Nutzung, Abbruchpunkte, FPS-Verteilung pro Gerät, Bremse-Auslösungen.
Ziele (Richtwerte für Sandboxes): D1 ≥ 25 %, D7 ≥ 8 %, Ø-Sitzung ≥ 20 min.

---

## Monetarisierung

Grundsatz: **Der komplette Simulationskern ist kostenlos.** Wer nichts zahlt, kann alles
Wesentliche erleben. Bezahlt wird für Komfort, Ausdruck und Extra-Spielzeug – nie für Vorteile
gegenüber anderen (es gibt kein „gegen andere“).

| Produkt | Typ | Inhalt | Preis (Robux, Startwert) |
|---------|-----|--------|------:|
| **Labor-Plus** | Game Pass | 60 statt 12 Bauplan-Slots, +25 % Solo-Budget, 3 exklusive Labor-Themen, goldener Name-Rahmen | 399 |
| **Solo-Labor+** | Game Pass | eigene Server-Einstellungen bleiben gespeichert, 2 Zusatzkarten | 249 |
| Item-Packs (z. B. „Sci-Fi-Waffen“, „Schwere Maschinen“) | Game Pass | 10–15 Items, die **Spaß** erweitern, aber nichts Kern-Notwendiges | 149–299 |
| Kosmetik-Sets (Dummy-Skins, LED-Gesichter, Glibberfarben-Paletten) | Developer Product / Pass | rein optisch | 49–199 |
| Private Server | Roblox-Funktion | dauerhaftes eigenes Labor für Freunde | 100/Monat |
| Premium Payouts | Roblox-Funktion | Einnahmen nach Spielzeit von Premium-Spielern – passt perfekt zu langen Sandbox-Sitzungen | – |

**Ausdrücklich nicht:** Lootboxen/Zufallskäufe, Energie-/Wartesysteme, Werbung mit Belohnung für
unter 13, künstliche Verknappung, „nur heute“-Druck, Handel.

---

## Risiken

| Risiko | Wahrsch. | Wirkung | Gegenmaßnahme |
|--------|:-------:|:------:|---------------|
| Fragebogen ergibt höhere Stufe als erwartet | mittel | hoch | Phase 0 zuerst; alle kritischen Features hinter Flags (Glibber-Menge, Gelenkstufen, Waffen-Stil) |
| Roblox wertet Spiel als „Folter/Misshandlung“ | niedrig–mittel | sehr hoch | Rahmungsregeln 01 §4 streng, Rettungs-Aufgaben, keine Folter-Items, saubere Store-Seite |
| Prüfphase (100 engagierte 16+-Spieler) dauert zu lange | mittel | mittel | Community-Aufbau vor Launch, gezielte Ads an 16+, beschleunigte Prüfung |
| Collision Summaries fehlen live / zu teuer | mittel | mittel | Δv-Rückfall ist mitentwickelt |
| AnimationConstraint-Muskeln instabil | niedrig–mittel | mittel | `AlignOrientationDriver` als Rückfall |
| Handy-Performance zu schwach | mittel | hoch | Budgets nach Messung, Qualitätsstufen, Notfall-Simulator |
| Engine-Änderungen (z. B. AJU Phase 3 Ende 2026) brechen Ragdolls | mittel | mittel | Eigener RigBuilder für NPCs (nicht von AJU betroffen), Avatar-Code getrennt, Regressions-Szenen |
| Rechtliches: zu große Nähe zur Genre-Referenz | niedrig | hoch | Eigener Name, eigene Optik, eigene Item-Namen, keine Erwähnung der Referenz in Titel/Beschreibung/Werbung |
| Umfang zu groß für Solo | hoch | hoch | 1.0-Kern verkleinern, Rest als Updates |
