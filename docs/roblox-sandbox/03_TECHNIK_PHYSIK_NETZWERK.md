# 03 – Technik: Physik, Netzwerk, Performance

Recherchestand der Engine-APIs: **20.11.2026** (Quellen am Ende). Wo eine API neu oder unsicher
ist, gibt es eine Rückfallebene – kein Kernsystem hängt an einem einzelnen Beta-Feature.

---

## 1. Engine-Grundeinstellungen

| Einstellung | Wert | Warum |
|-------------|------|-------|
| `Workspace.AuthorityMode` | **Automatic** (nicht `Server`) | Server Authority sagt pro Baugruppe vorher. Dutzende umkämpfte Ragdolls + Spieler-Maschinen würden ständig falsch vorhergesagt und zurückgesetzt. Für ein Sandbox ohne Wettbewerb ist das der falsche Tausch |
| `PhysicsSteppingMethod` | Adaptive (Standard) | Inseln mit 240/120/60 Hz, bis 2,5× schneller |
| `RunService:BindToSimulation` | ✔ für alle festen Physik-Takte (Bruch-Checks, Muskeln, Balance) | Fester Takt, unabhängig von der Framerate |
| `SignalBehavior` | Deferred | Vorhersehbare Event-Reihenfolge |
| `StreamingEnabled` | ✔, Labor-Root `ModelStreamingMode = PersistentPerPlayer` für den Besitzer | Der Labor-Host muss sein Labor immer vollständig haben (sonst kann er es nicht simulieren); fremde Labore werden gestreamt |
| `ImprovedPhysicsReplication` | Standard (an) | Updates überleben Paketverlust |
| `AvatarJointUpgrade` | Default (an) | Spieler-Avatare bekommen physikalische Gelenke – wir nutzen das für das „Umfallen“ des eigenen Avatars |
| Kollisionsgruppen | `Lab1…Lab8`, `Avatars`, `Debris`, `Ghost` | Labore kollidieren **nie** miteinander; Avatare kollidieren nur im eigenen/erlaubten Labor |

---

## 2. Weltaufbau

### Geteilter Server (bis 8 Spieler)

- **Zentrale Halle** (Spawn, Shop, Lab-Bibliothek, Tutorial-Terminal) + **8 Labore** im Ring,
  je **160 × 160 Studs** Grundfläche, 60 Studs hoch, 400 Studs Abstand.
- Jeder Spieler bekommt beim Beitritt ein freies Labor und wird dessen **Labor-Host**.
- Unsichtbare, harte Grenzen (Wände mit `CanCollide` für die eigene Kollisionsgruppe) –
  nichts verlässt ein Labor. Was trotzdem rausfliegt (Bug, extremer Impuls), wird außerhalb
  des Volumens sofort zurückgesetzt bzw. gelöscht.
- **Besuchen:** Jeder darf zuschauen. **Mitbauen** nur mit Erlaubnis des Hosts
  (Rollen: *Zuschauer*, *Helfer* – darf spawnen/werkzeugen, *Co-Host* – darf auch löschen und
  Einstellungen ändern).

### Solo-Labor (reservierter Server)

- Über `TeleportService:ReserveServer` – ein ganzer Server für einen Spieler + eingeladene Freunde.
- Globale Einstellungen erlaubt (Schwerkraft, Pause, Karte, Wetter), höheres Physik-Budget,
  6 Karten zur Auswahl.
- Das ist der Modus für ernsthafte Tüftler und große Maschinen.

---

## 3. Netzwerk und Autorität

### Das Kernproblem

1. Ragdoll-Physik muss **flüssig** reagieren, wenn der Spieler zieht – das geht nur, wenn sein
   Client die Physik besitzt (Network Ownership).
2. Die **Collision Summaries** (Aufpralldaten) entstehen **nur beim Network-Owner** und werden
   nicht repliziert.
3. Bei Roblox ist der Owner sowieso schon meist der Client in der Nähe (automatische Ownership).

### Die Lösung: „Labor-Host-Simulation“

> **Der Besitzer eines Labors simuliert sein Labor.** Der Server ist Schiedsrichter, Speicher
> und Verteiler – aber nicht der Simulator.

```
               ┌────────────────────────── Server ──────────────────────────┐
               │  Rechte & Budgets · Spawn-Validierung · Speichern/Laden     │
               │  Zustands-Verteiler (nur an Spieler im selben Labor)        │
               │  Notfall-Simulator (Fallback, s. u.)                         │
               └───────▲───────────────────────────▲───────────────┬────────┘
     Befehle (spawn,   │ Zustand 4 Hz, Ereignisse  │ Impact-Events │ Zustand/Ereignisse
     verbinden, …)     │                            │ (fremde Owner)│
               ┌───────┴──────────┐        ┌───────┴──────┐  ┌─────▼────────┐
               │   Labor-Host     │        │ Helfer, der  │  │  Zuschauer   │
               │  (Client)        │        │ gerade zieht │  │  (Client)    │
               │ Physik-Owner     │        │ (temporärer  │  │  nur Optik   │
               │ Schaden, Vitals, │        │  Owner eines │  └──────────────┘
               │ Muskeln, Temp.,  │        │  Objekts)    │
               │ Strom, Signale,  │        └──────────────┘
               │ Flüssigkeiten    │
               └──────────────────┘
```

**Regeln:**

1. **Ownership:** Jede Baugruppe im Labor gehört dem Host
   (`SetNetworkOwner(host)` beim Spawn und bei jeder Baugruppen-Änderung durch neue/entfernte
   Verbindungen; ein Registry-Dienst prüft mit 2 Hz die „dirty“ Baugruppen nach).
2. **„Wer zieht, besitzt“:** Zieht ein Helfer ein Objekt, bekommt er dafür temporär die
   Ownership. Sein Client erkennt Aufpralle dieser Baugruppe und schickt sie als kompakte
   `ImpactEvent`s an den Server → Host. Loslassen → Ownership zurück an den Host.
3. **Dieselben Module, zwei mögliche Hosts:** Alle Simulationsmodule liegen in
   `ReplicatedStorage/Shared/Sim` und laufen **identisch** auf Client oder Server. Wer gerade
   Host ist, ruft `LabSim.start(lab)` auf.
4. **Notfall-Simulator:** Der Host meldet alle 2 s seine Physik-Framerate. Liegt sie 6 s unter
   40 FPS, übernimmt der **Server** die Ownership der schwersten Baugruppen (`SetNetworkOwner(nil)`)
   und startet dort `LabSim` für sie. Hysterese: zurück erst nach 30 s stabil > 55 FPS. So
   bleibt ein schwaches Handy spielbar.
5. **Sicherheit:** Ein manipulierter Host kann **nur sein eigenes Labor** verfälschen – ohne
   Wettbewerb, Wirtschaft oder Einfluss auf andere Labore. Alles, was andere betrifft
   (Spawnen, Budgets, Speichern, Rechte, Käufe, Textfilter), entscheidet der Server. Das ist die
   bewusste, ehrliche Abwägung: maximale Flüssigkeit gegen eine Manipulationsmöglichkeit, die
   niemandem schadet.

### Replikation

| Daten | Weg | Takt / Größe |
|-------|-----|--------------|
| Positionen, Rotationen, Geschwindigkeiten | Roblox-Physikreplikation (automatisch) | – |
| Vitalwerte + Segmentzustände pro Dummy | Host → Server → Spieler im Labor, `UnreliableRemoteEvent`, `buffer` | 4 Hz, ~70 Bytes pro Dummy (Werte als `u8` quantisiert); mehrere Dummies pro Paket, **≤ 900 Bytes** (harte Grenze für Unreliable) |
| Diskrete Ereignisse (Wunde entsteht, Gelenk kugelt aus, Zustand wechselt, Explosion, Zündung) | `RemoteEvent` (zuverlässig), gebündelt pro Frame | nach Bedarf |
| Befehle (Spawn, Werkzeug, Kontextmenü) | Client → Server, validiert → Host | Rate-Limit pro Befehlstyp |
| Persistente Item-Eigenschaften (Farbe, Material, Stärke, Inhalt) | **Attribute** am Item (vom Server gesetzt) | max. 64 replizierte Attribute pro Instanz beachten |

Alle Remotes laufen über **eine** Netzwerk-Schicht (`Net.luau`) mit Typ-Schema, Validierung,
Rate-Limits und Bündelung. Roblox begrenzt auf ca. 500 Requests/s pro Client und Remote-Typ –
wir bleiben durch Bündelung bei < 60/s.

### Schüsse

- **Host schießt:** Host rechnet die Raycast-Kette lokal und wendet Impulse direkt an (er besitzt die Physik).
- **Helfer schießt:** Sein Client zeigt Mündungsfeuer/Leuchtspur sofort und schickt
  `(Waffe, Ursprung, Richtung, Zufalls-Seed, Zeit)` an den Server → Server prüft (Waffe im Labor?
  Rechte? Feuerrate ≤ Waffe? Ursprung ≤ 3 Studs von der Waffe?) → Host rechnet die Kette mit
  demselben Seed nach und wendet sie an.
- **Waffen am Signal** (Auto-Feuer): rechnet der Host.

---

## 4. Ragdoll-Technik

- **Eigener `RigBuilder`** baut Dummies aus einem Mesh-Kit: 16 `MeshPart`s, Attachments mit
  festen Namen (`Neck_Rig`, `Shoulder_L_Rig` …), pro Gelenk `BallSocketConstraint` +
  `AnimationConstraint` (`IsKinematic = false`) + `NoCollisionConstraint`s für Nachbarn.
- **Muskeln:** `AnimationConstraint.Transform` wird im Simulationsschritt aus der Pose gesetzt,
  `MaxTorque` aus der Muskelkraft (Formel in 02). Bewusstlos/deaktiviert → `Enabled = false`
  → reiner Ragdoll **und** der Dummy kann einschlafen (Physik-Sleep spart viel).
- **Gleichgewicht:** `AlignOrientation` (Becken senkrecht) + `AlignPosition` (nur Y, Standhöhe),
  Stärke gekoppelt an Muskelkraft (siehe 02 §1).
- **Gelenkgrenzen** brauchen Tuning gegen Zittern: `Restitution = 0`, moderate
  `MaxFrictionTorque` an Knie/Ellbogen.
- **Zerlegungs-Stufen** (A/B/C, siehe 01/02) sind reine Konfiguration im `JointFailure`-Modul.

---

## 5. Aufprall und Bruch

- **Collision Summaries** (`BindToCollisionSummaries`) auf Dummy-Segmenten und zerbrechlichen
  Items, beim jeweiligen Owner. Rückfallebene Δv-Messung (02 §5.1). **Prototyp-Aufgabe Nr. 1:**
  prüfen, ob Summaries im veröffentlichten Spiel aktiv sind (Doku ja, Roadmap sagte „Anfang
  2027“).
- **Verbindungsbruch:** Constraints haben keine eingebaute Bruchkraft (die Debug-Kraftabfrage
  ist veraltet). Eigener `BreakMonitor` im festen Simulationstakt misst Dehnung/Winkelfehler/
  Aufprall-Impulse (Tabelle in 04 §6).

---

## 6. Performance-Budget

### Kosten-Punkte

Jedes Item hat Kosten in **Physik-Punkten**, geprüft beim Spawn (Server):

| Objekt | Punkte |
|--------|------:|
| Dummy | 25 |
| Fahrzeug | 20 |
| Maschine mit Motor/Kolben | 6 |
| Waffe | 3 |
| Einfaches Teil (Kiste, Platte, Stange) | 1 |
| Verbindung (Seil, Feder, Schweißen …) | 0,5 |
| Splitter/Trümmer | 0 (eigene Obergrenze 120, verschwinden nach 20 s) |

| Modus | Budget | grob |
|-------|-------:|------|
| Geteilter Server, pro Labor | 300 | ~ 8 Dummies + 100 Teile |
| Solo-Labor | 1 200 | ~ 30 Dummies + 400 Teile |

Die Zahlen sind **Startwerte**. Roblox nennt keine offiziellen Maximalzahlen für Baugruppen –
wir messen im Prototyp mit dem MicroProfiler (`physicsStepped`, `worldStep`) auf drei
Referenzgeräten und setzen die Budgets danach fest.

### Zielwerte

| Gerät | Ziel |
|-------|------|
| Mittelklasse-PC | 60 FPS bei vollem Solo-Budget |
| Handy mit 3 GB RAM | 30 FPS bei vollem Labor-Budget (geteilter Server) |
| Server | Heartbeat ≥ 45 Hz bei 8 vollen Laboren (die meiste Physik läuft auf den Hosts) |
| Browser (Play on the Web, kommt Ende 2026) | wie Handy |

### Automatische Physik-Bremse

Wenn die Ziele reißen, greift in dieser Reihenfolge:
1. Kosmetik runter (Partikel, Pfützen, Schatten der Splitter).
2. Ruhende, weit entfernte Trümmer verankern (`Anchored`) und ausblenden.
3. Neue Spawns sperren + Hinweis „Labor ist voll – Physik-Budget erreicht“.
4. Notfall-Simulator (Ownership-Wechsel, §3).

### Weitere Regeln

- `CollisionFidelity` Hull/Box, `CanTouch = false` und `CanQuery = false` überall, wo nicht
  nötig, rein dekorative Teile `CanCollide = false`.
- **Parallel Luau:** pro Labor ein `Actor` für Vitalwerte, Temperatur, Strom-Topologie,
  Flüssigkeiten (rechnen im parallelen Teil, Schreiben der Instanz-Eigenschaften im seriellen
  Teil). `require` nur beim Laden (im Parallelteil verboten).
- `--!native` für heiße Module (Raycast-Kette, Temperatur, Union-Find, Serialisierer).
- **Pools** für Partikel-Emitter, Splitter, Pfützen, Wunden-Decals, Leuchtspuren.
- Gleiche Meshes werden von Roblox instanziert gezeichnet → ein Mesh-Kit für alle Dummies.
- Shapecasts (seit Oktober 2026 bis 4× schneller) für Explosions-Sichtlinien und Nahkampf.

---

## 7. Zeitsteuerung

| Funktion | Umsetzung |
|----------|-----------|
| **Pause** (Solo-Labor) | Alle Baugruppen verankern, Geschwindigkeiten (`AssemblyLinearVelocity`/`AngularVelocity`) merken; Fortsetzen stellt sie wieder her. Im Pause-Modus kann man posieren, verbinden, bauen |
| **Einzelschritt** | Fortsetzen für 1/20 s, dann wieder Pause |
| **Zeitlupe** | Roblox bietet (nach unserer Recherche) **keine globale Physik-Zeitlupe**. Lösung: **Instant-Replay** – jeder Client puffert 10 s Positionen aller sichtbaren Lab-Teile mit 30 Hz (Ringpuffer) und spielt sie auf Knopfdruck mit 0,25×–1× ab, über lokale, verankerte Kopien und `BulkMoveTo` mit Interpolation, freie Kamera dazu. Im geteilten Server läuft die echte Simulation weiter; im Solo-Labor wird sie währenddessen pausiert |

Das Instant-Replay ist bewusst ein **Feature**, kein Notbehelf: Zeitlupen-Clips sind das, was
Spieler teilen wollen (Aufnahme über die Roblox-eigene Aufnahmefunktion).

---

## 8. Darstellungs-Technik

| Effekt | v1.0 | später |
|--------|------|--------|
| Wunden/Risse | Gepoolte flache MeshParts (Riss-Textur in Glibberfarbe), am Segment verschweißt, max. 6 pro Segment | `EditableImage` pro Dummy zum „Einmalen“ von Rissen, danach mit `CreateDataModelContentAsync` zu statischem Content backen (spart Budget). Achtung: Freischaltung der Mesh/Image-APIs verlangt laut Doku einen alters- und ID-verifizierten Besitzer |
| Dellen | Textur-Stufen | `EditableMesh` (max. 60 000 Vertices) + Backen |
| Hüllen-Verschleiß | 4 Textur-Stufen je Segment | Roblox „Material Layering“ (Roadmap Mitte 2027) |
| Glibber/Feuer/Funken | `ParticleEmitter` mit eigenen Flipbooks | – |
| Lichtbögen, Kabel | `Beam` | – |
| Glühen heißer Teile | `Color`-Verlauf + `PointLight` + emissive Maske | – |

---

## 9. Daten

- `SerializationService` ist in Live-Servern **nicht** verfügbar → **eigenes Bauplan-Schema**
  (siehe [07](07_MULTIPLAYER_SPEICHERN.md)).
- DataStore: max. **4 194 304 Zeichen pro Schlüssel**, Request-Budget 300 + CCU × Faktor pro
  Minute (vereinheitlicht mit Open Cloud). Session-Locking über **ProfileStore** (Community-
  Bibliothek) für Spielerdaten.
- MemoryStore (später Galerie/Ranglisten): Werte bis 32 KB, Sortierte Maps.
- MessagingService: 1 KB pro Nachricht (für Einladungen/Server-übergreifende Hinweise).

---

## 10. Eingabe

- **Input Action System** (seit Juni 2026 veröffentlicht) für alle Bindungen, plattformübergreifend;
  Belegung im **Input Action Manager** gepflegt; Tastenhinweise über `InputActionLabel`, sobald
  aus der Beta.
- **Eigenes Ziehen statt DragDetector:** Bekannter Fehler – während eines DragDetector-Zugs
  empfängt das IAS keine Eingaben. Wir brauchen aber Tasten **während** des Ziehens (drehen,
  einfrieren, Abstand). Darum: eigener „Greifer“ (siehe 05 §2) mit `AlignPosition` +
  `AlignOrientation` am gegriffenen Punkt, Kraft abhängig von der Masse.

---

## 11. Entwicklungs-Werkzeuge

- **Rojo** (Dateisystem ↔ Studio), **Wally** (Pakete), Git.
- Luau **strict** mit dem neuen Typ-Solver, **selene** (Lint), **StyLua** (Format).
- **Jest-Lua** für Unit-Tests der reinen Logik (Schadensformeln, Serialisierer, Union-Find,
  Signal-Auswertung, Farbprüfung) – diese Module sind bewusst Roblox-frei geschrieben.
- Studio hat einen eingebauten **MCP-Server** – KI-Assistenz (auch ich) kann damit direkt in
  Studio mitarbeiten.

## Quellen

- Avatar Joint Upgrade / AnimationConstraint: https://devforum.roblox.com/t/avatar-joint-upgrade-for-physically-simulated-character-movement-is-now-live/4298561, https://create.roblox.com/docs/reference/engine/classes/AnimationConstraint
- Collision Summaries: https://devforum.roblox.com/t/collision-summaries-api-detailed-collision-data-from-the-engine/4918568
- Constraint (keine Bruchkraft): https://create.roblox.com/docs/reference/engine/classes/Constraint
- Server Authority: https://create.roblox.com/docs/projects/server-authority
- BindToSimulation: https://devforum.roblox.com/t/full-release-bindtosimulation-rolling-out-usefixedsimulation/4605516
- Network Ownership: https://create.roblox.com/docs/physics/network-ownership
- Remotes / Unreliable 900 Bytes: https://create.roblox.com/docs/reference/engine/classes/UnreliableRemoteEvent
- Adaptive Timestepping: https://create.roblox.com/docs/physics/adaptive-timestepping
- Performance: https://create.roblox.com/docs/performance-optimization/improve
- Parallel Luau: https://create.roblox.com/docs/scripting/multithreading
- EditableMesh/Image, Backen: https://create.roblox.com/docs/reference/engine/classes/EditableMesh, https://devforum.roblox.com/t/full-release-introducing-createdatamodelcontent-convert-editable-mesh-and-image-data-into-static-content/4541898
- IAS / DragDetector-Fehler: https://create.roblox.com/docs/input/input-action-system, https://devforum.roblox.com/t/the-new-input-action-input-context-input-keybind-system-does-not-detect-any-input-while-dragging-a-part-using-the-drag-detector/4650173
- DataStore-Grenzen: https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits
- SerializationService: https://create.roblox.com/docs/reference/engine/classes/SerializationService
