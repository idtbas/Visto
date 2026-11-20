# 07 – Multiplayer, Rechte, Speichern, Teilen

Die Genre-Referenz ist ein Einzelspieler-Spiel, und „Multiplayer“ ist dort einer der
meistgewünschten Punkte. Roblox liefert Multiplayer gratis mit – das ist unser größter Vorteil.
Es bringt aber zwei Pflichten mit: **Schutz vor Störenfrieden** und **saubere Daten**.

---

## 1. Rechte im Labor

| Rolle | Darf | Vergibt |
|-------|------|---------|
| **Host** | alles im eigenen Labor, Einstellungen, Rollen vergeben, Besucher entfernen | – |
| **Co-Host** | wie Host, außer Rollen vergeben und Labor schließen | Host |
| **Helfer** | spawnen, Werkzeuge, Kontextmenü, **nicht** löschen, was andere gebaut haben | Host/Co-Host |
| **Zuschauer** | ansehen, Scanner benutzen, Replay ansehen | Standard für alle |

- Labor-Status: **Offen** (jeder darf zuschauen) · **Nur Freunde** · **Geschlossen**.
- Avatare ohne Recht können das Labor-Volumen nicht betreten (Kollisionsgruppe `Avatars`
  kollidiert mit der Laborgrenze, solange keine Rolle ≥ Helfer besteht) – sie schauen aus der
  Galerie oder mit der Lab-Kamera von außen zu.
- Jede Aktion trägt den Urheber (`CreatorId`-Attribut) → „Alles von Spieler X löschen“ für den Host.
- Eigene Budgets pro Helfer (max. 40 % des Labor-Budgets), damit niemand das Labor allein füllt.
- Roblox' eigene Melde- und Blockierfunktionen bleiben überall erreichbar.

## 2. Mit Freunden ins Solo-Labor

1. Host öffnet „Solo-Labor“ → Server reserviert (`TeleportService:ReserveServer`) → Zugangs-
   Code wird 2 h in einer **MemoryStore**-HashMap unter der UserId des Hosts abgelegt.
2. Einladen über `SocialService:PromptGameInvite`. Freunde landen in der Halle und bekommen
   den Hinweis „Zum Labor von … beitreten“ (Abfrage der HashMap, nur wenn Host sie als Freund
   führt bzw. eingeladen hat) → Teleport mit dem Zugangs-Code.
3. Verlässt der Host den Server, wird das Labor gespeichert; Gäste werden in die Halle
   zurückteleportiert (Hinweis vorher, 30 s).

---

## 3. Speicherformat für Baupläne und Labore

`SerializationService` gibt es in Live-Servern nicht → eigenes, versioniertes Schema.
**Der Server serialisiert** aus seiner eigenen Sicht des Labors (Positionen kommen über die
Physik-Replikation, Simulationszustände vom Host). Der Client schickt **nie** einen fertigen
Bauplan zum Speichern – so können keine erfundenen Daten in den Speicher gelangen.

### Logisches Schema (Version 1)

```lua
export type Blueprint = {
    v: number,                      -- Schema-Version (Migrationen!)
    meta: {
        name: string,               -- gefiltert, nur für Besitzer sichtbar
        created: number,            -- os.time()
        points: number,             -- Physik-Punkte zum Prüfen beim Laden
        bounds: Vector3,            -- Ausdehnung (Größenprüfung)
    },
    items: { ItemRecord },
    links: { LinkRecord },          -- Seile, Federn, Schweißen, Scharniere …
    wires: { WireRecord },          -- Signal-, Strom-, Flüssigkeitskabel
    states: { StateRecord },        -- Dummy-Vitals/Segmente, Behälter-Inhalte, Temperaturen
}

-- ItemRecord: { defId, pos (relativ zum Bauplan-Ursprung), rot, scale, color, material,
--               flags (eingefroren, Kollision aus, schwerelos, unzerstörbar), props }
-- LinkRecord: { type, itemA, partA, offsetA, itemB|WORLD, partB, offsetB, params, strength }
-- WireRecord: { kind, itemA, portA, itemB, portB }
```

### Kodierung

- Binär mit `buffer`: Position als `i32` in 1/100 Studs, Rotation als Quaternion „smallest
  three“ in 3 × `i16` + 2 Bit, Farben als Paletten-Index (`u8`), `defId` als `u16`-Index in die
  Item-Registry (mit Namens-Tabelle im Kopf, damit Registry-Umbauten nichts zerstören).
- Dann Base64 → String für den DataStore (ob DataStores `buffer` direkt speichern, im Prototyp
  prüfen – dann entfällt Base64).
- **Größe:** ~30 Bytes pro Item, ~60 pro Verbindung → ein großes Solo-Labor mit 500 Items und
  300 Verbindungen ≈ 35 KB. Grenze pro Schlüssel: 4 194 304 Zeichen → riesiger Puffer.
  Trotzdem: Bauplan > 2 MB → auf mehrere Schlüssel verteilen (Sharding-Funktion vorhanden,
  realistisch nie nötig).

### Prüfung beim Laden (Server)

1. Version prüfen → Migrationskette `v1 → v2 → …` anwenden.
2. Jede `defId` muss existieren und für den Spieler freigeschaltet sein (gekaufte Packs).
3. Punkte ≤ Budget des Ziel-Labors, Ausdehnung passt ins Labor.
4. Alle Parameter auf erlaubte Bereiche begrenzen (Motorkräfte, Spannungen, Skalierung).
5. **Glibberfarben** gegen die Farbregel (kein Rot, siehe 01 §3).
6. Fehlerhafte Einträge werden übersprungen, nicht der ganze Bauplan verworfen; der Spieler
   sieht „3 Teile konnten nicht geladen werden“.

---

## 4. DataStore-Aufteilung

| Store | Schlüssel | Inhalt | Wann geschrieben |
|-------|-----------|--------|------------------|
| `Players_v1` (über ProfileStore, Session-Locking) | `UserId` | Einstellungen (Sanft-Modus, Glibberfarbe, Steuerung), Freischaltungen, Aufgaben-Fortschritt, Tutorial-Flags, Bauplan-Index (Slot → Name, Größe, Datum) | Autosave 5 min + beim Verlassen |
| `Blueprints_v1` | `UserId:Slot` | Bauplan-String | Beim Speichern (6 s Abklingzeit) |
| `LabAutosave_v1` | `UserId` | letzter Laborzustand („Weitermachen, wo ich war“) | Beim Verlassen + alle 3 min, nur wenn geändert |
| `Shared_v1` (erst mit Teilen-Freigabe) | `Code` | geteilter Bauplan + Autor + Meldungen | Beim Teilen |

- Bauplan-Slots: **12 kostenlos**, 60 mit „Labor-Plus“.
- Request-Budget (300 + CCU × Faktor pro Minute) wird durch Abklingzeiten und „nur wenn
  geändert“ weit unterschritten.
- **Recht auf Löschung (DSGVO):** Roblox leitet Löschanfragen an Entwickler weiter. Ein
  Open-Cloud-Skript löscht dann alle Schlüssel einer UserId in allen Stores (Schlüssel-Schema
  ist absichtlich `UserId`-präfixiert, damit das trivial ist).

---

## 5. Teilen von Bauplänen (hinter Feature-Flag)

Zum Start **aus** (Begründung in [01 §5](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md#5-teilen-von-bauplänen-text-chat)).
Der Code wird trotzdem vorbereitet, damit die Freigabe nur ein Schalter ist:

- Teilen erzeugt einen 6-stelligen Code (Base32 ohne verwechselbare Zeichen).
- Nur wenn **Sender und Empfänger** `IsContentSharingAllowed = true` haben.
- Name gefiltert mit `GetNonChatStringForBroadcastAsync`, 1 Teilen pro 10 min pro Spieler.
- Melden-Knopf; nach 3 Meldungen verschiedener Spieler automatisch versteckt, Prüfliste für
  uns über ein Open-Cloud-Werkzeug.
- Geteilte Baupläne werden beim Laden genauso streng geprüft wie eigene (§3).

**Bis dahin** übernimmt die **Lab-Bibliothek** (offizielle Baupläne von uns) die Rolle der
Galerie – inklusive „Bauplan der Woche“, der neue Spieler motiviert.

---

## 6. Schutz vor Störungen (Zusammenfassung)

| Gefahr | Schutz |
|--------|--------|
| Fremde zerstören mein Labor | Rollen; Standard = Zuschauer; Labore physikalisch getrennt |
| Jemand füllt den Server mit Physik | Budgets pro Labor und pro Helfer, Server-Physik-Bremse |
| Remote-Spam | Rate-Limits pro Befehlstyp in `Net.luau`, Verwerfen + Protokoll |
| Manipulierter Client fälscht Physik | wirkt nur im eigenen Labor (bewusste Abwägung, 03 §3) |
| Manipulierte Speicherdaten | Server serialisiert selbst, prüft beim Laden alles |
| Anstößige Texte | Textfilter überall, kein freier Text für andere sichtbar zum Start |
| Anstößige Bauwerke | kein öffentliches Teilen zum Start; Host kann Besucher entfernen; Roblox-Melden |
