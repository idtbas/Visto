# 04 – Simulationssysteme: Material, Temperatur, Strom, Signale, Flüssigkeiten, Zerstörung

Das Genre lebt davon, dass Systeme **miteinander** reagieren: Treibstoff läuft aus, ein Funke
entzündet ihn, die Hitze springt auf eine Holzkiste über, der Dummy darin flieht, stolpert gegen
einen Stromzaun, die Pumpe stoppt, jemand holt den Defibrillator. Jedes System hier ist deshalb
**datengetrieben** (Tabellen in `Shared/Config/`) und spricht über wenige, klare Schnittstellen
mit den anderen.

Grundregel für Performance: **Kein System läuft pro Frame über alle Objekte.** Jedes System hat
einen eigenen Takt und arbeitet nur auf „aktiven“ Objekten (warm, brennend, unter Strom, nass …).

| System | Takt | Arbeitsmenge |
|--------|------|--------------|
| Aufprall/Schaden | jeder Physikschritt | nur Dummy-Segmente + zerbrechliche Items, die sich bewegen |
| Vitalwerte | 10 Hz | alle Dummies im Labor |
| Temperatur | 5 Hz | nur Objekte mit \|T − T_umgebung\| > 2 °C oder Wärmequelle |
| Feuer | 5 Hz | brennende Objekte |
| Stromnetz (Topologie) | 5 Hz | leitfähige Objekte, nur bei Änderung neu berechnet |
| Signalnetz | 20 Hz | Logik-Bauteile |
| Flüssigkeiten | 10 Hz | offene/ausgießende Behälter, Pfützen in Kontakt |

---

## 1. Materialsystem

Jedes Item hat **ein Hauptmaterial** (Mehrmaterial-Items geben pro Teil ein Material an).
Die Physik-Werte werden auf `CustomPhysicalProperties` gemappt, der Rest liegt in unserer Tabelle.

| Material | Dichte | Reibung | Elastizität | Härte H | Ballist. R | Wärmekap. c | Wärmeleit. k | Strom | Zündung | Bruch |
|----------|------:|-------:|-----------:|------:|------:|------:|------:|:---:|------:|-------|
| Vinyl (Dummy-Hülle) | 0,95 | 0,6 | 0,15 | 0,5 | 120 | 1,7 | 0,2 | – | 250 °C | – |
| Holz | 0,6 | 0,5 | 0,2 | 0,8 | 250 | 1,7 | 0,15 | – | 300 °C | splittert |
| Stahl | 7,8 | 0,4 | 0,15 | 1,5 | 6 000 | 0,5 | 50 | ✔ | – | – |
| Aluminium | 2,7 | 0,4 | 0,2 | 1,1 | 2 500 | 0,9 | 200 | ✔ | – | – |
| Kupfer | 8,9 | 0,4 | 0,2 | 1,1 | 3 000 | 0,4 | 380 | ✔ (bester Leiter) | – | – |
| Glas | 2,5 | 0,3 | 0,1 | 1,2 | 60 | 0,8 | 1 | – | – | zerspringt |
| Beton | 2,4 | 0,7 | 0,1 | 1,4 | 2 000 | 0,9 | 1,5 | – | – | bröckelt |
| Gummi | 1,1 | 1,0 | 0,7 | 0,3 | 150 | 2,0 | 0,15 | – (Isolator) | 350 °C | – |
| Kunststoff | 1,0 | 0,4 | 0,3 | 0,6 | 180 | 1,5 | 0,2 | – | 350 °C | – |
| Stoff/Kissen | 0,3 | 0,8 | 0,05 | 0,2 | 40 | 1,3 | 0,05 | – | 200 °C | – |
| Eis | 0,9 | 0,05 | 0,1 | 1,0 | 300 | 2,1 | 2 | – | schmilzt > 0 °C | zerspringt |
| Keramik | 2,3 | 0,5 | 0,1 | 1,3 | 900 | 0,8 | 1,5 | – | – | zerspringt |

- Dichte in Roblox-Einheiten (Wasser ≈ 1). Härte H fließt in den stumpfen Schaden ein,
  R in die Durchdringung (siehe [02](02_KOERPER_UND_SCHADEN.md#53-ballistisch-projektile)).
- **Kontext-Menü → „Material“** erlaubt bei Grundformen (Kiste, Platte, Stange, Kugel)
  das Material zu wechseln. Bei komplexen Items ist das Material fest.

---

## 2. Temperatur, Feuer, Kälte

### Modell

Jedes **thermische Objekt** (Item-Baugruppe oder Dummy-Segment) hat eine Temperatur `T` und
eine Wärmekapazität `C = Masse × c`.

```
Kontakt-Austausch (Paar a,b berührt sich):
    Q = k_paar × (T_a − T_b) × dt          k_paar = 2·k_a·k_b / (k_a + k_b)  (harmonisches Mittel)
    T_a −= Q / C_a ;  T_b += Q / C_b
Strahlung von Wärmequellen (Feuer, Heizstrahler) im Radius r_q:
    T += P_q × (1 − d/r_q) / C × dt
Umgebung (Newton):
    T += (T_umgebung − T) × (1 − e^(−dt/τ))      τ = 30 s × C / Oberfläche (grob, pro Item vorberechnet)
```

- **Kontakte** kommen aus `workspace:GetPartsInPart` (bzw. `GetTouchingParts` mit
  temporär aktivem `CanTouch`) – nur für Objekte in der „aktiven“ Liste.
- Ein Objekt verlässt die aktive Liste, sobald `|T − T_umgebung| < 2 °C` und keine Quelle in
  der Nähe ist. In einem ruhigen Labor ist die Liste leer – das System kostet dann nichts.
- Temperaturwerte sind serverseitig in einer Tabelle, Clients bekommen sie nur für
  sichtbare Effekte (Glühen, Rauch, Frost) als gerundete Stufen (`TempBand` 0–7) über ein
  Attribut.

### Feuer

```
Zündet, wenn  T ≥ Zündtemperatur(Material)  und  Brennstoff > 0
Brennt:       T += 40 °C/s (bis 600 °C), Brennstoff −= Brennrate × dt
              Wärmequelle mit P = 3 000, r = 4 Studs → steckt Nachbarn an
Erlischt,     wenn Brennstoff = 0 (→ „verkohlt“: Farbe dunkel, Material bleibt), Wasser,
              Löschschaum, Kühlflüssigkeit, oder T < Zündtemperatur − 80 °C
```

- **Treibstoff** (Flüssigkeit) hat Zündtemperatur 220 °C und brennt schnell und heiß.
  Treibstoff-Pfützen breiten Feuer flächig aus.
- **Effekte:** Flammen als `ParticleEmitter` mit Flipbook-Textur (eigene Grafik), Rauch,
  Glut-Glühen über `PointLight`. **Harte Obergrenze:** max. 48 gleichzeitige Flammen-Emitter pro
  Labor; weitere brennende Objekte bekommen nur Glühen + Rauch (Spielmechanik läuft trotzdem).

### Kälte

- Quellen: Kühlflüssigkeit, Eis-Serum, Kryo-Granate, Gefrierbox, Eisblöcke.
- Wasser-Pfützen unter 0 °C werden zu Eisflächen (Reibung 0,05 → Rutschpartie).
- Dummies frieren ein (siehe [02 §5.6](02_KOERPER_UND_SCHADEN.md#56-kälte)); Items aus Glas/Keramik
  werden bei schnellem Temperatursprung > 150 °C spröde (Bruchschwelle halbiert).

---

## 3. Strom und Signale

Wir trennen bewusst **zwei Netze**, weil das für Spieler leichter verständlich und für die
Engine viel billiger ist als eine echte Schaltkreissimulation:

### 3.1 Stromnetz (Energie, Stromschläge)

- **Quellen:** Batterie (12 V), Autobatterie (24 V), Generator (230 V), Starkstrom-Generator
  (10 kV), Tesla-Spule (50 kV, Lichtbögen im Radius 6), Blitzableiter-Wetter (Event).
- **Leiter:** alle Teile mit leitfähigem Material (Stahl, Alu, Kupfer, Wasser-Pfützen) und
  das Werkzeug **Stromkabel**.
- **Isolatoren:** alles andere. Gummihandschuhe/-stiefel (Kleidungs-Items) machen
  Dummy-Segmente isoliert.

**Algorithmus (5 Hz, nur bei Änderungen):**

1. Leitfähige Objekte bilden Knoten. Kanten = physischer Kontakt (Spatial Query) oder Stromkabel.
2. **Union-Find** bildet Komponenten. Komponente erhält `Spannung = max(Quellen darin)`.
3. Ein „Dirty“-Flag wird gesetzt, wenn sich ein leitfähiges Objekt > 0,2 Studs bewegt oder
   ein Kabel entsteht/verschwindet; sonst wird nicht neu gerechnet.
4. **Verbraucher** (Lampe, Motor, Elektromagnet, Heizstrahler, Ventilator, Bildschirm …) in
   einer Komponente mit `Spannung ≥ Bedarf` sind **versorgt**.
5. **Dummy-Segmente**, die einen spannungsführenden Leiter berühren, erhalten einen
   Stromschlag (Wirkung siehe [02 §5.7](02_KOERPER_UND_SCHADEN.md#57-strom)). Der Dummy selbst
   wird zum Leiter (Glibber leitet!) – so springt der Strom über eine Kette von Dummies weiter,
   gedämpft um 30 % pro Körper.

Effekte: Funken-Partikel an Kontaktstellen, Lichtbogen als `Beam` mit animierter Textur
zwischen Tesla-Spule und Ziel, Summen (Audio-Emitter mit Lautstärke ∝ Spannung).

### 3.2 Signalnetz (Aktivierung, Logik)

Das ist das **Bastelsystem** – die eigentliche Langzeitmotivation für Tüftler.

- Jedes aktivierbare Item hat **Ports**: `In` (Aktivieren), `Out` (meldet Ereignis/Zustand).
- Das Werkzeug **Signalkabel** verbindet einen `Out` mit einem oder mehreren `In`.
- Signale sind **boolesch** und werden mit **20 Hz** ausgewertet. Jedes Logik-Bauteil hat
  1 Takt Verzögerung → Rückkopplungen (Taktgeber, Flip-Flops) funktionieren stabil und
  deterministisch.
- Alternativ: **„Benutzen“** (Taste F / Tippen-Halten → Kontextmenü) aktiviert ein Item direkt.

| Kategorie | Bauteile |
|-----------|----------|
| Eingänge | Knopf (Puls), Schalter (an/aus), Druckplatte, Annäherungssensor, Kontaktsensor, Lichtschranke, Temperatursensor, Geschwindigkeitssensor, Stromsensor, Dummy-Sensor (meldet Bewusstsein/Deaktivierung), Fernbedienung (Spieler-Taste) |
| Logik | UND, ODER, NICHT, XOR, Verzögerung (einstellbar), Taktgeber, Zähler, Speicher (Flip-Flop), Zufall |
| Ausgänge | Motor, Kolben, Schubdüse, Lampe/Signallicht, Lautsprecher (Klangauswahl), Tür, Förderband, Magnet, Waffen-Abzug (Auto-Feuer), Zünder (Sprengstoff), Ventil (Flüssigkeit), Relais (schaltet Strom), Spawner (nur im Solo-Labor) |

Kabel werden als dünne `Beam`s zwischen Attachments dargestellt und sind **physikalisch
wirkungslos** (keine Masse, keine Kollision). Im „Schaltplan-Modus“ (Taste Tab im
Signal-Werkzeug) werden alle Kabel und aktiven Signale hervorgehoben, der Rest abgedunkelt.

---

## 4. Flüssigkeiten und Seren

### 4.1 Grundmodell

Wir simulieren **keine** Fluiddynamik. Flüssigkeit existiert an genau drei Orten:

1. **In Behältern** (`Container`-Komponente): `contents = { [liquidId] = Menge }`,
   `capacity`, optional eine **Öffnung** (Attachment + Richtung).
2. **Im Flug** (Ausgießen): Partikel + ein paar unsichtbare „Tropfen-Raycasts“ (4 pro Sekunde
   pro Ausguss), die bestimmen, wo die Flüssigkeit landet.
3. **Als Pfütze**: flache, halbtransparente Scheiben auf einem 2-Stud-Raster. Pfützen gleicher
   Sorte in benachbarten Zellen verschmelzen optisch; max. 160 Pfützen-Zellen pro Labor, älteste
   verdunsten zuerst.

Behälter gießen aus, wenn sie **offen** sind und die Öffnung unter die Füllhöhe kippt
(Skalarprodukt Öffnungsrichtung · Schwerkraft). Landet ein Tropfen-Raycast in einer anderen
Behälteröffnung → Umfüllen. So funktionieren Trichter, Eimer-Ketten und Mischstationen.

### 4.2 Spritzen

- Spritze (Item) mit 1 Einheit Inhalt. Trifft die Spitze mit > 6 Studs/s ein Dummy-Segment
  **oder** steckt sie (Stich-Mechanik aus 02) und wird **benutzt**, injiziert sie über 1 s.
- Kontextmenü „Inhalt“ zeigt Füllung, „Leeren“, „Aufziehen“ (aus einem Behälter in Reichweite).

### 4.3 Flüssigkeiten-Katalog

| Flüssigkeit | Farbe | Wirkung (injiziert) | Wirkung (Pfütze/Kontakt) |
|-------------|-------|---------------------|--------------------------|
| **Neustart-Serum** | leuchtend grün | Belebt: Chip mind. 0,3, Pumpe an, goo ≥ 60 %, alle Wunden 50 % versiegelt, Zustand → Bewusstlos → Aktiv | – |
| **Reparatur-Gel** | rosa-weiß | Über 5 s: alle Schichten +0,5, Brüche heilen, Wunden schließen, gelöste Gliedmaßen in < 1 Stud Abstand **docken wieder an** | heilt langsam, wer darin liegt |
| **Glibber-Nachfüller** | Glibberfarbe | goo +40 % | – |
| **Adrenalin-Shot** | gelb | Adrenalin 100, Bewusstsein +50 | – |
| **Schlaf-Serum** | dunkelblau | 30 s bewusstlos | – |
| **Schwebe-Serum** | hellviolett | 20 s Antigravitation (sanftes Aufsteigen) | Objekte schweben leicht |
| **Feder-Serum** | orange | 30 s Elastizität 0,95 (Flummi-Dummy) | federnder Boden |
| **Riesen-Tonikum** | tiefgrün | Skalierung ×1,5 (max ×3) | – |
| **Schrumpf-Tonikum** | türkis | Skalierung ×0,67 (min ×0,33) | – |
| **Turbo-Serum** | weiß-blau | 30 s Muskeln ×2,5, danach Erschöpfung | – |
| **Unzerstörbar-Serum** | gold | 30 s kein Schaden, goldener Glanz | – |
| **Wild-Serum** | magenta | Verhalten „Wild“ (60 s) | – |
| **Eis-Serum** | eisblau | Körpertemperatur → −40 °C | friert Oberfläche |
| **Wasser** | blau, klar | – | löscht Feuer, kühlt, leitet Strom |
| **Öl** | bernstein | – | Reibung 0,05, brennbar (Zündung 300 °C) |
| **Treibstoff** | gelbgrün | – | sehr brennbar (220 °C), explodiert in Behältern bei Feuer |
| **Ätzschleim** | giftgrün, blubbernd | Ätzen von innen (siehe 02 §5.9) | ätzt Hüllen, Holz, Kunststoff |
| **Kühlflüssigkeit** | weiß dampfend | – | −150 °C, verdampft schnell |
| **Leim** | milchig | – | verklebt berührende Objekte (WeldConstraint, Bruchstärke „schwach“) |
| **Farbstoff** (8 Farben) | jeweilige Farbe | färbt die Hülle | färbt Objekte |
| **Glibber** | Glibberfarbe | – | rein optisch, verblasst nach 90 s |

### 4.4 Mischungen (Reaktionstabelle)

Reaktionen laufen **in Behältern** (10 Hz) – einfache Regel `A + B → Produkt (+ Effekt)`:

| A | B | Ergebnis |
|---|---|----------|
| Wasser | Ätzschleim | verdünnter Ätzschleim (Wirkung × 0,3) |
| Kühlflüssigkeit | Wasser | Eis (Behälter friert, Inhalt fest) |
| Treibstoff | Hitze > 220 °C | Explosion (Stärke ∝ Menge) |
| Riesen-Tonikum | Schrumpf-Tonikum | Wasser |
| Neustart-Serum | Ätzschleim | neutralisiert beide |
| Reparatur-Gel | Leim | **Super-Reparatur** (repariert auch Items) |
| Turbo-Serum | Adrenalin-Shot | **Überladung**: 10 s Turbo ×4, danach bewusstlos |
| beliebig | Farbstoff | färbt die Mischung, Wirkung bleibt |

Eine kleine Reaktionstabelle reicht, um Entdecker-Spaß zu erzeugen. Weitere Rezepte kommen per
Update – jede neue Reaktion ist **ein Tabelleneintrag**.

---

## 5. Zerstörung von Objekten

| Verhalten | Materialien | Umsetzung |
|-----------|-------------|-----------|
| **Zerspringen** | Glas, Keramik, Eis, Eispanzer gefrorener Dummys | Vorgefertigte Bruchstück-Modelle (3–6 Teile), beim Bruch durch Splitter ersetzt, erben Geschwindigkeit. Splitter verschwinden nach 20 s (oder bleiben im Solo-Labor). |
| **Splittern** | Holz | Planken/Kisten haben 2–3 vordefinierte Bruchkanten. Bruch → Teile mit eigener Physik. |
| **Bröckeln** | Beton, Ziegel | Brocken lösen sich bei Explosion/Projektil (max. 8 pro Ereignis). |
| **Verbiegen** | Stahl, Alu | Kein echtes Verbiegen. Optik über Dellen-Decals; Rohre/Stangen haben eine „geknickt“-Variante. |

Jedes zerstörbare Item hat `structure` (0 … 1); Schaden kommt aus demselben Aufprall-/Projektil-/
Explosionssystem wie bei Dummies (vereinfachte Formel: `structure −= E_eff / Haltbarkeit`).

---

## 6. Verbindungen (von Spielern gebaut)

Roblox-Constraints haben **keine eingebaute Bruchkraft**. Wir messen deshalb die Belastung
selbst (jeder Physikschritt, nur für Verbindungen mit endlicher Stärke):

| Verbindung | Belastungsmaß |
|------------|---------------|
| Schweißen/Kleben (`WeldConstraint`) | Relative Geschwindigkeit der beiden Baugruppen kann es nicht geben – daher Belastung aus den **Δv-Spitzen** der verbundenen Baugruppe (Aufprall) |
| Seil (`RopeConstraint`) | `CurrentDistance − Length` (Überdehnung) |
| Feder (`SpringConstraint`) | `CurrentLength` außerhalb `[MinLength, MaxLength]` |
| Stange (`RodConstraint`) | Abweichung der aktuellen von der Soll-Länge |
| Scharnier/Gelenk | Abstand der Attachments im Weltraum |

Stärkestufen im Kontextmenü: **Schwach / Normal / Stark / Unzerstörbar**. Bricht eine
Verbindung → Constraint weg, kurzer „Schnapp“-Sound, bei Seilen schnalzen die Enden
(Partikel-Linie).

---

## 7. Umgebung

| Einstellung | Shared Server | Solo-Labor |
|-------------|:-------------:|:----------:|
| Schwerkraft (global: 0 / Mond / Lab-Standard / Erde / Jupiter) | – (nur Schwerkraft-Feld-Item) | ✔ |
| Umgebungstemperatur (−30 … +50 °C) | pro Labor-Zone (logisch) | ✔ |
| Wind (`workspace.GlobalWind` + Kraft auf leichte Objekte) | – | ✔ |
| Tageszeit / Licht-Preset | lokal pro Spieler (rein optisch) | ✔ |
| Karte | festes Labor | Auswahl aus 6 Karten |
| Pause / Einzelschritt | – | ✔ |
| Instant-Replay (Zeitlupe) | ✔ (rein lokal) | ✔ |

**Warum Schwerkraft nur im Solo-Labor global:** `workspace.Gravity` gilt für den ganzen
Server. In geteilten Servern bekommt jedes Labor stattdessen das Item **Schwerkraft-Feld**
(Zone mit `VectorForce` auf alle Baugruppen darin).

**Schwerkraft-Standard: Erde, 35,04 Studs/s²** (= 9,81 m/s² bei 0,28 m/Stud). Roblox'
Voreinstellung (196,2) ist ≈ 5,6-mal zu stark und lässt Ragdolls puppenhaft wirken. Weil alle
Schadensformeln intern in SI-Einheiten rechnen (siehe
[11 §2](11_REALISMUS_UND_SPIELGEFUEHL.md#2-säule-1--echte-einheiten-echte-biomechanik)), gelten
die Grenzwerte bei jeder Schwerkraft-Einstellung physikalisch korrekt weiter.
