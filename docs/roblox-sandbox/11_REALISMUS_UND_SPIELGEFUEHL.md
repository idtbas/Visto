# 11 – Realismus und Spielgefühl: Warum es sich krass echt anfühlt

> **Leitsatz:** *Echt* heißt nicht *blutig*. Echt heißt: richtige Masse, richtige Reflexe,
> richtige Geräusche, richtige Konsequenzen – und alles **messbar**.

Unser Verzicht auf Gore ist kein Nachteil, sondern ein Zwang zur Qualität: Die Klone holen ihren
„Wow“-Effekt aus Blutspritzern. Wir müssen ihn aus der **Physik, dem Verhalten und den Sinnen**
holen – genau da, wo sie nichts machen. Dieses Kapitel ist der wichtigste Unterschied zu allem,
was es auf Roblox schon gibt.

---

## 1. Die Klon-Grundlinie und unser Abstand

*(Ausführliche Wettbewerbsanalyse mit Zahlen in §12; hier die Kurzfassung des typischen Klons)*

| Typischer Roblox-Klon | Wir |
|-----------------------|-----|
| R6/R15-Klötzchen mit Lücken an den Gelenken | **Ein durchgehender, verformbarer Körper** (Skinned Mesh, von der Physik gesteuert) |
| Motor6D → BallSocket: schlaffer „Nudel“-Ragdoll ohne Muskeln | **Active Ragdoll** mit Muskeltonus, Gleichgewicht und 16 Reflexen |
| Symmetrische Kegel-Gelenke (Knie biegt in alle Richtungen) | **Anatomische Gelenke**: Knie und Ellbogen als echte Scharniere mit medizinischen Bewegungsumfängen |
| Fantasie-Schwerkraft, beliebige Massen | **Echte Einheiten**: 1 Stud = 0,28 m, Erdschwere, Massen- und Trägheitsverteilung aus der Biomechanik |
| HP-Balken | **Crash-Test-Wissenschaft**: Kopfverletzungs-Kriterium (HIC), Brust-Eindrückung, Nacken-Kriterium, Oberschenkel-Kraft – echte Grenzwerte |
| Hitscan ohne Flugzeit | **Echte Ballistik**: Mündungsgeschwindigkeit, Flugzeit, Fall, Luftwiderstand, Impulserhaltung beim Rückstoß |
| Ein Aufprall-Sound für alles | **Klang aus Materialpaaren**, Größe, Impuls, Gleiten, Rollen, Schallgeschwindigkeit |
| Server-Physik mit Ruckeln | **Labor-Host-Simulation** (03) – Ziehen ohne Verzögerung |
| Statische Blut-Decals | **Fließende Flüssigkeiten**, pulsierendes Lecken im Herzrhythmus |

---

## 2. Säule 1 – Echte Einheiten, echte Biomechanik

### 2.1 Intern rechnen wir in SI-Einheiten

Alle Schadens-, Temperatur- und Ballistik-Formeln arbeiten intern in **Metern, Kilogramm,
Sekunden, Newton, Joule**. Umrechnung an genau einer Stelle (`Units.luau`):

```
1 Stud        = 0,28 m
v [m/s]       = v [Studs/s] × 0,28
g (Erde)      = 9,81 m/s²  →  35,04 Studs/s²
Masse         : Roblox-Masse wird pro Körpertyp so skaliert, dass der Dummy 75 kg „wiegt“
```

Das klingt unscheinbar, ist aber der Schlüssel: **Alle Grenzwerte können wir direkt aus der
Unfallforschung übernehmen**, statt sie zu erraten.

### 2.2 Schwerkraft: echt

Ein 1,75 m großer Dummy (6,25 Studs) fällt bei 35 Studs/s² aus eigener Höhe in derselben Zeit
wie ein Mensch in echt (≈ 0,6 s). Das Roblox-Standard-Gefühl (196,2 Studs/s²) ist ≈ 5,6-mal zu
stark – deshalb wirken Ragdolls in Klonen „schwer und schnappig“ wie Puppen. **Unsere Standard-
Schwerkraft ist 35,04 Studs/s² („Erde“).** Der Test aus Phase 1 (03/04) prüft nur noch, ob die
Kamera (Brennweite, Abstand) den Maßstab glaubwürdig vermittelt – nicht mehr, ob wir
„schummeln“ müssen. Der eigene Avatar bekommt dafür angepasste Sprungkraft, damit er sich nicht
mondartig anfühlt.

### 2.3 Massen- und Trägheitsverteilung

Masse, Schwerpunkt und **Trägheitsmoment** jedes Segments entsprechen anthropometrischen Tabellen
(Werte in §2.6). Warum das so wichtig ist: Ein Ragdoll, dessen Unterschenkel zu leicht sind,
„flattert“; einer mit zu schwerem Kopf kippt unnatürlich. Echte Verteilung erzeugt **echte
Pendelbewegungen** beim Fallen und Taumeln – das Auge erkennt das sofort, ohne es benennen zu
können.

Umsetzung: Roblox berechnet das Trägheitsmoment aus der Kollisionsgeometrie. Wir formen die
(unsichtbaren) Physik-Proxys so (Kapsel-artige Hulls mit richtigem Querschnitt) und setzen die
Dichte pro Segment so, dass **Masse und Trägheitsradius** zu den Tabellen passen. Ein
Studio-Plugin prüft das automatisch (Soll/Ist-Tabelle).

### 2.4 Anatomische Gelenke

| Gelenk | Constraint | Warum |
|--------|-----------|-------|
| Knie, Ellbogen | **`HingeConstraint`** mit `LowerAngle`/`UpperAngle` (z. B. Knie 0° … 140° Beugung) + kleine BallSocket-Toleranz für Verdrehung | Ein Kegel lässt das Knie nach vorn knicken – das ist das sichtbarste „Fake“-Merkmal billiger Ragdolls |
| Hüfte, Schulter | `BallSocketConstraint` mit **schräg gestelltem Kegel** (Kegelachse in die Mitte des echten Bewegungsbereichs gedreht) + Twist-Grenzen | Bildet asymmetrische Bewegungsumfänge nach (Hüfte beugt weit nach vorn, kaum nach hinten) |
| Wirbelsäule (2 Gelenke), Nacken | BallSocket, kleine Kegel, eigene Twist-Grenzen | Natürliche Krümmung, kein „Gummihals“ |
| Hand-, Fußgelenk | BallSocket mit schrägem Kegel | – |

**Passive Gelenkreibung** (`MaxFrictionTorque`) dämpft das typische Nachschwingen. Sie sinkt mit
Bewusstsein und steigt bei Kälte.

### 2.5 Muskeltonus – der Unterschied zwischen „bewusstlos“ und „Puppe“

Echte bewusstlose Körper sind **nicht** völlig schlaff: Restspannung lässt sie in typische
Haltungen sacken (Knie leicht gebeugt, Arme angewinkelt). Darum:

| Zustand | Muskelmoment (Anteil vom Maximum) | Zielpose |
|---------|------------------:|----------|
| Wach, aktiv | 100 % | Verhaltensschicht |
| Benommen | 40–70 % | Verhaltensschicht, verlangsamt |
| Bewusstlos | **6–10 %** | „Entspannte Pose“ (leicht gebeugt) |
| Deaktiviert | 6 % → 0 % über 8 s | entspannt → keine |

Das ist ein kleiner Zahlenwert mit riesiger Wirkung: Ein Dummy, der bewusstlos zusammensackt,
sieht **schwer und echt** aus; ein Klon-Ragdoll fällt wie ein Wäschesack.

### 2.6 Referenzwerte

*(Wird mit den geprüften Daten aus der Biomechanik-Recherche gefüllt – siehe unten §13.)*

---

## 3. Säule 2 – Crash-Test-Wissenschaft als Schadensmodell

Unsere Figuren **sind** Crash-Test-Dummies. Echte Dummies messen Verletzungsrisiken mit
standardisierten Kriterien. Wir übernehmen genau diese Kriterien – das ist thematisch perfekt,
wissenschaftlich echt und für Jugendliche sogar lehrreich.

### 3.1 Die Messgrößen

| Kriterium | Was es misst | Woher bei uns |
|-----------|-------------|---------------|
| **HIC** (Head Injury Criterion) | Kopfbeschleunigung über die Zeit | Beschleunigungsverlauf des Kopf-Segments |
| **Brust-Eindrückung** + **3-ms-Brustbeschleunigung** | Belastung des Brustkorbs | Aufprall-Impuls auf Brust, Kontaktfläche |
| **Nij** (Nacken) | Zug/Druck + Biegemoment im Nacken | Relativbewegung Kopf ↔ Brust, Kraft im Nackengelenk |
| **Oberschenkel-Axialkraft** | Längskraft im Femur (typisch beim Knieanprall) | Impulse entlang der Segmentachse |
| **Tibia-Index** | Unterschenkel-Belastung | wie oben, Unterschenkel |
| **G-Kraft** | anhaltende Beschleunigung (Schleudern, Raketen) | Kopf-Beschleunigung, gemittelt |

### 3.2 Die Beschleunigungskurve rekonstruieren

Die Physik läuft mit 60–240 Hz; ein echter Kopfaufprall dauert nur wenige Millisekunden. Wir
rekonstruieren deshalb den **Stoßverlauf** aus dem Aufprall-Ereignis (Collision Summary):

```
Δv           = Aufprallgeschwindigkeit senkrecht (aus RelativeVelocity · Normal)  [m/s]
τ            = Kontaktdauer. Die Nachgiebigkeiten beider Partner addieren sich wie
               Federn in Reihe, deshalb dominiert immer der WEICHERE Partner:
               τ ≈ τ_Dummy-Segment + τ_Gegenstück
               (Startwerte τ_Gegenstück: Beton/Stahl 1 ms, Holz 3 ms, Gummi 12 ms,
                Schaumstoff 35 ms, Kissen 45 ms, Airbag 60 ms; τ_Kopf-Hülle 3 ms,
                Helm-Polster +8 ms)                                          [s]
Puls         = Halbsinus mit Spitze  a_max = (π/2) × Δv / τ
HIC          = numerisch über den rekonstruierten Puls (Fenster ≤ 15 ms)
```

**Das ist der Kern des „echt“-Gefühls im Schadensmodell:** Polsterung verlängert τ, senkt die
Spitzenbeschleunigung und damit den HIC **dramatisch** – genau wie in echt. Derselbe Sturz auf
Beton knockt aus, auf einer Gummimatte nicht, mit Helm vielleicht nur benommen. Spieler können
**Schutz konstruieren** (Käfig, Airbag, Knautschzone, Polster) und es funktioniert, weil es auf
echter Physik basiert. Kein Klon kann das.

### 3.3 Von Messwerten zu Folgen

Die Messwerte ersetzen die geschätzten Schwellen aus 02 §5.1 als **primäre** Quelle für Kopf-,
Brust-, Nacken- und Beinschäden (die übrigen Schichtwerte laufen weiter wie in 02). Die
Verletzungsschwere folgt einer **Risikokurve** (Wahrscheinlichkeit statt harter Schwelle) – das
macht Ergebnisse glaubwürdig variabel, ohne zufällig zu wirken:

| Stufe (angelehnt an die AIS-Skala) | Dummy-Sprache im Scanner | Folge |
|-----------------------------------|--------------------------|-------|
| 0 | „Keine Schäden“ | – |
| 1 – leicht | „Kratzer / Prellung“ | Schmerz |
| 2 – mittel | „Riss / Gerüst angeknackst“ | Muskelkraft ↓, Lecken |
| 3 – schwer | „Gerüst gebrochen / Chip-Erschütterung“ | Bewusstlos möglich, Bruch |
| 4 – sehr schwer | „Chip beschädigt / Pumpe gestört“ | Bewusstlos, Organ-Schaden |
| 5 – kritisch | „Systemausfall droht“ | Pumpe stoppt, Deaktivierung in Minuten |
| 6 – maximal | „Systemausfall“ | Deaktivierung |

Konkrete Grenzwerte und Kurven: §13 (geprüfte Quellen).

### 3.4 Telemetrie – die „Wow“-Anzeige

Ein neues Item: der **Telemetrie-Rechner** (oder Scanner-Reiter „Telemetrie“). Nach jedem
heftigen Ereignis zeigt er wie in einem echten Crash-Labor:

- Kurve der Kopfbeschleunigung in g über die Zeit, HIC-Wert farbig gegen Grenzwert.
- Brust-Eindrückung in mm, Nacken-Nij, Oberschenkel-Kraft in kN links/rechts.
- Ampel-Bewertung pro Körperregion (wie die Sterne-Bewertungen von Crash-Tests).
- „Vergleichen“: zwei Versuche nebeneinander („mit Airbag / ohne Airbag“).

Das passt perfekt zu den **Crash-Test-Aufgaben** (05 §8): „Erreiche HIC < 700 bei 50 km/h.“

---

## 4. Säule 3 – Der Körper lebt: die Verhaltensschicht

Das ist, was Spiele wie GTA IV und Red Dead Redemption mit der Euphoria-Technik so berühmt
gemacht hat: Figuren, die **auf ihren Körper und ihre Umgebung reagieren**, statt nur zu fallen.
Bei Roblox-Klonen gibt es das praktisch nicht.

### 4.1 Architektur

```
                 Zustandsmaschine (02 §4)   → Grundpose (Stehen, Liegen, Kriechen …)
                           +
                 Reflex-Schicht (16 Reflexe) → Überlagerungen mit Priorität und Gewicht pro Gelenk
                           +
                 IK-Ziele (Hände, Füße, Kopf) → analytische 2-Gelenk-IK → Gelenkwinkel
                           ↓
                 Mischer (pro Gelenk gewichtete Summe, weich überblendet 80–200 ms)
                           ↓
                 Muskeln (AnimationConstraint.Transform + MaxTorque aus Muskelkraft)
                           ↓
                 PHYSIK entscheidet, was wirklich passiert
```

Der entscheidende Punkt: **Reflexe sind Absichten, keine Animationen.** Die Physik hat immer das
letzte Wort. Ein Dummy *will* sich abstützen – ob es klappt, hängt von Kraft, Winkel und Boden
ab. Darum sieht jeder Sturz anders aus.

### 4.2 Die 16 Reflexe

| # | Reflex | Auslöser | Was passiert |
|---|--------|----------|-------------|
| 1 | **Abstützen** | Fallen, Boden in < 0,5 s auf Flugbahn (Raycast entlang Geschwindigkeit) | Hände per IK zum **vorhergesagten** Aufprallpunkt, Ellbogen leicht gebeugt |
| 2 | **Schützen** | Schnelles Objekt auf Kollisionskurs | Unterarme vor Kopf, Kopf weg, Augen zu (LED `> <`) – 150 ms vorher |
| 3 | **Taumeln** | Schwerpunkt verlässt Standfläche | Ausfallschritte in Fallrichtung, Arme rudern; Schrittlänge ∝ Impuls |
| 4 | **Einknicken** | großer vertikaler Stoß, Beinverletzung | Knie geben nach, Dummy sackt kontrolliert |
| 5 | **Hand auf Wunde** | frische Wunde mit hohem Schmerz | eine Hand per IK auf die Wundstelle (bzw. nächste erreichbare Stelle), drückt |
| 6 | **Festhalten** | Fallen + Kante/Seil/Stange in Reichweite | Hand greift (Schweißen „schwach“ – reißt bei Last), Dummy hängt, strampelt, zieht sich evtl. hoch |
| 7 | **Abrollen** | Sturz mit hoher Horizontal-Geschwindigkeit | Kinn zur Brust, Arme an den Körper, Rolle über die Schulter |
| 8 | **Zusammenkrümmen** | starker Schmerz, liegend | Embryohaltung um die verletzte Region |
| 9 | **Winden** | Schmerz liegend, mittel | langsames Rollen, Beine anziehen/strecken |
| 10 | **Hinken** | Bein verletzt, beim Stehen/Gehen | Gewicht aufs gesunde Bein, verkürzter Schritt |
| 11 | **Hinterherschauen** | bewegtes Objekt, Spieler-Cursor in der Nähe | Kopf und Augen folgen (Nacken-Muskel + LED-Pupillen) |
| 12 | **Zusammenzucken** | lauter Knall, Treffer in der Nähe (Schallereignis) | 200 ms Ganzkörper-Zucken, Schultern hoch |
| 13 | **Flucht-Impuls** | Feuer/Hitze > 50 °C in der Nähe, Explosion | Wegdrehen, Schritt(e) weg (ab Gehen-Feature) |
| 14 | **Atmen** | immer, wenn aktiv | Brust hebt sich, Rate aus Sauerstoff/Adrenalin (12–40/min), nach Anstrengung Keuchen |
| 15 | **Gewichtsverlagerung** | Stehen im Ruhezustand | alle 3–8 s Gewicht wechseln, kleine Kopfbewegungen |
| 16 | **Nach Partner schauen / helfen** (1.2) | anderer Dummy fällt in der Nähe | erschrocken hinschauen; mit „Helfer“-Pose: zum Verletzten gehen, ihn zur Medizin-Station ziehen |

Reflex 16 ist bewusst **liebenswert**: Dummies kümmern sich umeinander. Das ist original, passt
zur Rahmung (01 §4) und erzeugt rührende, teilbare Momente.

### 4.3 Antizipation

Echte Menschen reagieren **vor** dem Aufprall. Darum sagt der Host für jeden aktiven Dummy alle
50 ms per Raycast/Shapecast die nächste Kollision voraus (eigene Flugbahn und schnelle Objekte
in 15 Studs). Reflexe 1, 2, 7 starten mit Vorlauf. Gerade das – das Zusammenkneifen der Augen
eine Zehntelsekunde vor dem Einschlag – lässt Figuren lebendig wirken.

---

## 5. Säule 4 – Ein durchgehender Körper

### 5.1 Skinned Mesh über Physik-Proxys

```
Physik (Host + repliziert):   16 unsichtbare Proxy-Teile (Kapsel-Hulls) + Gelenke + Muskeln
Darstellung (jeder Client):   1 sichtbares MeshPart mit Knochen (Skinned Mesh, ~4 000 Dreiecke)
Pro Frame (Client, parallel): Bone.CFrame ← Proxy.CFrame (relativ), interpoliert
```

- Keine Lücken an Schultern, Hüften, Knien; Haut/Hülle **verformt sich weich** an den Gelenken.
- Optik und Physik sind entkoppelt → wir können Optik verfeinern, ohne die Simulation zu ändern.
- LOD: ab 80 Studs Abstand wird auf die Proxys mit einfacher Textur umgeschaltet; ab 200 Studs
  aktualisieren sich die Knochen nur noch mit 15 Hz.

### 5.2 Sekundärbewegung („Jiggle“)

Zusätzliche, rein optische Knochen in Bauch, Brust-Polster, Wangen der Hülle, Kabeln/Gurten der
Kleidung: kleine gedämpfte Federn in Luau, angetrieben von der Beschleunigung des Segments. Ein
Aufprall **läuft als Welle durch den Körper**. Kostet fast nichts (Client, parallel, nur nahe
Dummies) und ist eines der stärksten „krass“-Signale überhaupt.

### 5.3 Brüche, die man sieht (Flag `FractureBend`)

Lange Segmente (Ober-/Unterarm, Ober-/Unterschenkel) bestehen intern aus **zwei Proxy-Hälften**,
verschweißt. Bei Gerüstbruch wird die Schweißung durch ein steifes Kugelgelenk ersetzt: das
Segment **knickt in der Mitte**. Optik: Riss-Ring in der Hülle, keine Knochen. Kostet +8 Proxys
pro Dummy, deshalb nur auf mittlerer/hoher Qualität und hinter einem Flag (Jugendschutz-Prüfung
mit der Fragebogen-Vorschau, siehe 01).

---

## 6. Säule 5 – Trefferwirkung, die man spürt

### 6.1 Echte Ballistik statt Hitscan

Projektile werden als **schrittweise Raycasts** simuliert (pro Physikschritt ein Segment der
Flugbahn): echte Mündungsgeschwindigkeit, Schwerkraft, Luftwiderstand. Im kleinen Labor merkt man
das kaum (Flugzeit < 0,1 s), aber:

- in der großen Halle sieht man **Geschossfall und Flugzeit**,
- im **Zeitlupen-Replay sieht man die Kugel fliegen** – mit Leuchtspur und Druckwelle,
- Durchdringung/Abpraller aus 02 §5.3 bleiben gleich, nur auf der echten Bahn.

### 6.2 Impulserhaltung

Der Impuls, den eine Kugel überträgt, ist **genau** `m_Kugel × Δv_Kugel` (verlorene Geschwindigkeit
beim Durchdringen). Derselbe Impuls wirkt rückwärts als **Rückstoß** auf die Waffe – hält ein
Dummy sie, reißt es ihm den Arm hoch; liegt sie lose auf dem Tisch, springt sie. Keine
Fake-„Knockback“-Werte, die Klone so cartoonig machen (Pistolentreffer schleudern dort Menschen
durch den Raum – bei uns, wie in echt, nicht).

### 6.3 Kleine Details, die Realismus verkaufen

- **Patronenhülsen** fliegen aus (gepoolte Mini-Teile, klirren materialabhängig, verschwinden nach 30 s).
- **Mündungsblitz** als echte Lichtquelle für 2 Frames, Rauchwölkchen.
- **Einschuss-Wirkung** am Material: Holzsplitter fliegen *in Schussrichtung* raus, Metall funkt,
  Glas bekommt ein **radiales Bruchmuster um den Einschlagpunkt** (6 vorgefertigte Muster,
  gedreht/skaliert zum Treffer), Beton staubt.
- **Druckwelle mit Laufzeit:** Explosionen wirken nicht sofort überall, sondern breiten sich mit
  ~340 m/s aus (Ring-Ausbreitung pro Frame). Nahe Objekte fliegen zuerst, entfernte später –
  im Replay wunderschön sichtbar.
- **Pulsierendes Lecken:** Glibber tritt **im Rhythmus der Pumpe** aus (Partikel-Rate moduliert
  mit der Pulsfrequenz). Stoppt die Pumpe, hört das Pulsieren auf. Kein Gore – aber jeder spürt
  sofort: *dieser Körper lebt*.

---

## 7. Säule 6 – Klang

| Technik | Wirkung |
|---------|---------|
| **Materialpaar-Matrix** (Vinyl, Holz, Metall, Glas, Beton, Gummi, Stoff, Eis) × 3 Stärken × 4 Varianten | Jeder Aufprall klingt nach dem, was zusammenstößt |
| **Größe → Tonhöhe** (kleine Teile höher, große tiefer, aus Masse) | Ein Fass klingt anders als eine Dose aus demselben Material |
| **Impuls → Lautstärke und Schicht** (leicht: nur „tock“, stark: + Bass-Schicht + Nachklingen) | Heftige Stöße fühlen sich heftig an |
| **Gleit- und Roll-Schleifen** aus der Tangentialgeschwindigkeit der Kontakte | Kratzen, Schleifen, Rollen – Dinge klingen, *während* sie sich bewegen |
| **Körperfall-Schichtung**: Hülle („plonk“) + Polster (dumpfer Thump) + Kleidung (Rascheln) | Ein fallender Dummy klingt nach Gewicht |
| **Schallgeschwindigkeit**: große Explosionen in der großen Halle kommen hörbar verzögert an | subtil, aber unglaublich „echt“ |
| **Acoustic Simulation** (Verdeckung, Hall) | Labor klingt nach Raum, Halle nach Halle |
| **Herzschlag** im Scanner/Telemetrie, Atemgeräusch nach Anstrengung (synthetisch, freundlich) | Leben hörbar machen ohne Schreie |
| **Haptik** (`HapticService`): Gamepad/Handy vibrieren bei nahen Aufprallen und Explosionen | man *fühlt* Treffer |

---

## 8. Säule 7 – Sehen

- **PBR überall** (`SurfaceAppearance`): Metall glänzt, Gummi ist matt, Vinyl leicht speckig.
- **Glühfarben nach Temperatur** (Schwarzkörper-Farben: dunkelrot → orange → gelb → weiß,
  Werte in §13) für heißes Metall – physikalisch korrekt statt „irgendwie orange“.
- **Nässe**: nasse Oberflächen werden dunkler und glänzender, rutschiger.
- **Licht von Ereignissen**: Mündungsfeuer, Funken, Explosionen, Feuer werfen echtes, flackerndes
  Licht und Schatten.
- **Kamera**: Wackeln **aus der Physik** – Amplitude aus Druckwellen-Stärke am Kamera-Ort,
  Ankunft verzögert mit der Druckwelle, Frequenz nach Explosionsgröße. Abschaltbar.
- **Hochgeschwindigkeits-Kamera** (neues Item): auf ein Stativ stellen, auf eine Szene richten.
  Ihr Replay hat **Bildzähler, Zeitstempel in ms, Messraster und die gelb-schwarzen
  Crash-Test-Markierungen** – exakt der Look echter Crash-Test-Aufnahmen. Mehrere Kameras =
  Schnitt zwischen Perspektiven.
- **Auto-Highlight**: Der Host erkennt spektakuläre Momente (Energie-Spitze, Mehrfach-Treffer,
  Explosion mit vielen Objekten) und bietet unten rechts „▶ Zeitlupe ansehen“ an – ein Tipp, und
  die letzten 5 s laufen aus der besten Kamera-Perspektive mit 0,25×.

---

## 9. Säule 8 – Eine Welt mit Gedächtnis

- **Fließende Flüssigkeiten**: Das Pfützen-Raster aus 04 §4 wird zum **Höhenfeld-Fluss**: jede
  Zelle kennt Bodenhöhe und Füllstand; Flüssigkeit läuft bergab, sammelt sich in Mulden, fließt
  über Kanten (zellulärer Automat, 10 Hz, parallel). Treibstoff-Spuren brennen **entlang** der
  Spur ab. Wasser verteilt sich, statt als Kreis-Decal zu liegen.
- **Rauch steigt und staut sich** unter der Decke (Partikel mit Auftrieb + Decken-Kollisionsebene).
- **Spuren bleiben**: Schleifspuren auf dem Boden, Ruß an Wänden nach Explosionen, Dellen-Decals in
  Metall, Risse im Beton nach schweren Aufprallen (gepoolt, mit Obergrenze, verblassen im geteilten
  Server nach 5 min, bleiben im Solo-Labor bis „Aufräumen“).
- **Schaden bleibt**: Nichts heilt von selbst außer Wunden-Versiegelung. Wer einen Dummy
  „verbraucht“ hat, muss ihn reparieren oder ersetzen – Konsequenz macht Handlungen bedeutsam.

---

## 10. Realismus-Budget (Qualitätsstufen)

| Merkmal | Hoch (PC) | Mittel | Niedrig (Handy/Bremse) |
|---------|:--------:|:------:|:---------------------:|
| Skinned Mesh | ✔ alle | ✔ nahe 8 | Proxys mit Textur |
| Jiggle-Knochen | ✔ nahe 6 | ✔ nahe 2 | – |
| Reflexe | alle 16 | alle 16 | 1–5, 14 |
| Antizipation | 20 Hz | 10 Hz | 5 Hz |
| FractureBend | ✔ | ✔ | – |
| Hülsen, Einschuss-Details | ✔ | reduziert | – |
| Höhenfeld-Fluss | ✔ | ✔ (gröberes Raster) | statische Pfützen |
| Schall-Laufzeit, Gleit-Schleifen | ✔ | ✔ | Gleit-Schleifen aus |

Wichtig: **Simulation (Schaden, Vitalwerte, Physik) ist auf allen Stufen gleich.** Nur die
Darstellung skaliert. Ein Handy-Spieler und ein PC-Spieler im selben Labor erleben dasselbe Ergebnis.

---

## 11. Die ersten 60 Sekunden

Neue Spieler müssen **sofort** spüren, dass das hier anders ist. Das Tutorial (05 §7) beginnt
deshalb nicht mit Menüs, sondern mit einem inszenierten Moment:

1. **0–10 s:** Ein Dummy steht im Labor, atmet, schaut den Spieler an, verlagert das Gewicht.
2. **10–25 s:** „Gib ihm einen Schubs.“ – Er taumelt, rudert, fängt sich mit zwei Schritten.
3. **25–40 s:** „Noch mal, fester.“ – Er fällt, stützt sich ab, rollt, steht stöhnend-piepend auf.
4. **40–55 s:** Ein Crash-Test-Schlitten rauscht gegen die Wand, Hochgeschwindigkeits-Replay
   startet automatisch, Telemetrie-Kurve blendet ein: „HIC 1 240 – mit Airbag versuchen?“
5. **55–60 s:** Spawn-Menü öffnet sich. Ab hier gehört das Labor dem Spieler.

---

## 12. Wettbewerbsanalyse (Stand 20.11.2026)

Zahlen direkt aus den öffentlichen Roblox-APIs (CCU = gleichzeitige Spieler, Momentaufnahme);
Spitzenwerte von Drittanbieter-Trackern sind Näherungen. Gespielt wurde keines der Spiele –
Aussagen zur Qualität stützen sich auf Beschreibungen, Bewertungen und DevForum-Berichte.

### 12.1 Lage: Ein Boom, der gerade passiert

Fast alle Top-Titel sind zwischen **Ende September und Anfang November 2026** entstanden.
Vermutlicher Auslöser: Roblox' neue physikalische Gelenke (Avatar Joint Upgrade, Januar 2026;
stabile AnimationConstraint, Juni 2026).

| Spiel | CCU | Server | Einstufung | Profil |
|-------|----:|:------:|-----------|--------|
| Hyper Realistic Ragdoll | 90 500 (Spitze ~200 000) | **1** | Moderate | Trefferzonen-Reaktionen (hinken, kriechen), Röntgen, „Medic spielen“, Events (Tornado, Meteor), sprechende Dummies, 17 Pässe |
| Bloody Ragdoll Physics | 23 700 | **1** | Mild | 23 Waffen, 14 Spritzen, Zerlegung, Zeitlupe + Zurückspulen; Blut „reduziert, um den Richtlinien zu entsprechen“ |
| Fling Things and People | 19 400 | 25 | Mild | Seit 2021, 3,75 **Mrd.** Besuche – Beweis für die Lust auf *gemeinsame* Physik |
| Ragdoll Research | 12 300 | 1 | Moderate | Dummies kämpfen gegeneinander, Mutations-Spritzen, 24 Pässe |
| Ragdoll Playground (2D) | 10 600 | 6 | Moderate | Sand/Wasser/Feuer/Lava-Simulation, **94 % Likes – bester Wert** |
| BoneBox Engine | 6 700 | 16 | Mild | 100+ Spielzeuge, Schweißen/Seile, 29 Pässe |
| Dummy Lab | 6 100 | 6 | Mild | Crash-Test-Thema (Kanone, Raketenschlitten, Fallturm) – **aber keine Messwerte**, nur Röntgen |
| Realistic Ragdoll Engine | 5 400 (Spitze 41 000) | 1 | – | Knochen/Organe, Defibrillator; **CCU −48 % in einer Woche, Ø-Sitzung 10,6 min** |
| Blood Lab | 3 500 | 1 | – | fließendes Voxel-Blut, Behandlungs-Werkzeuge, „smarte“ Ragdolls |
| Ragdoll Physics 2 | 1 900 (Spitze 13 000) | 21 | Moderate | „Wunden aus echter Ballistik“, 140 Waffen – aber **47 Pässe, nur 70 % Likes** |
| Direkte Melon/People-Playground-Klone | 0–670 | – | – | tot oder schwach; einer musste sein Gore entfernen, die 18+-Abspaltung hat ~1 % der Besuche |

### 12.2 Die Klon-Grundlinie

- R15-Dummies, **Solo-Server** (fast alle Top-10 haben Servergröße 1 – sie umgehen so das
  Netzwerk-Problem).
- Hauptverb: greifen und schleudern. Trefferzonen-Reaktionen, Röntgen, „Organe und Knochen“
  sind Standard-Werbung geworden.
- Medizin = meist **ein** Heilen-Knopf oder Wiederbeleben.
- Immer dieselbe Waffenliste und dieselben Events (Tornado, Meteor, Zombies, T-Rex).
- Kein echtes Bauen über Schweißen/Seile hinaus.
- Geschäftsmodell: Everything-Paket 499–999, VIP, **bezahlter Sandbox-/Admin-Modus**,
  „Unlimited Events“, Einzelwaffen-Pässe, Grind-Freischaltungen.

### 12.3 Ihre Schwächen (belegt)

| Schwäche | Beleg | Unsere Antwort |
|----------|-------|----------------|
| **Spieler gehen schnell** | CCU −48 %/Woche, 10,6 min Sitzung; ein Entwickler aus dem Trend berichtet 40 % Absprung in 60 s und 2–3 min Spielzeit | Langzeit-Tiefe: Bauen, Logik, Telemetrie, Aufgaben (05 §8); die „ersten 60 Sekunden“ (§11) |
| **Frühe Bezahlschranken** | „Warum verlangst du nach 30 Sekunden Geld für eine Grundfunktion?“ (DevForum); 47 Pässe ↔ 70 % Likes | Kompletter Kern gratis, keine Sandbox-/Zeitsteuerungs-Pässe (10) |
| **Handy-Steuerung ungelöst** | „Ziehen ist am Handy schwer, weil es mit der Bewegung kollidiert“ | Lab-Kamera ohne Avatar als Standard, eigener Greifer, Radialmenü (05) |
| **Kein Multiplayer** (weil Ragdoll-Netzwerk schwer ist) | DevForum voller Berichte über Ruckeln, nachhängende Gliedmaßen, Ownership-Flackern, zufälliges Wegschleudern | Labor-Host-Simulation mit getrennten Laboren (03 §3) – **unser größter technischer Graben** |
| **Gore stößt an die Moderation** | Blut reduziert, Gore entfernt, 18+-Ableger floppt | Wir holen den Effekt aus Physik und Verhalten (dieses Kapitel) |
| **Alle klingen gleich** | identische Schlagworte („every hit is real“), Unterschied nur Waffenzahl | Belegbarer Realismus: Messwerte, Telemetrie, Blindtest (§14) |
| **Medizin flach** | niemand zeigt sichtbare Vitalwerte | Inspektor mit allen Vitalwerten, Telemetrie, Rettungs-Aufgaben |

### 12.4 Lücken, die niemand füllt – und die wir besetzen

1. **Flüssiger Multiplayer** in geteilten Laboren.
2. **Echtes Bauen mit Logik** (Kabel, Sensoren, Kolben, Motoren) + Baupläne.
3. **Crash-Test-Telemetrie** mit Zahlen (g-Kräfte, HIC, Vergleich von Versuchen) – das
   Crash-Test-Thema existiert (Dummy Lab), die Wissenschaft dahinter nicht.
4. **Sichtbare Physiologie** als Spielmechanik (Glibbermenge, Schock, Bewusstsein, Triage).
5. **Active Ragdoll als Kern** (Abstützen, Schützen, Festhalten, Gleichgewicht).
6. **Flüssigkeiten und Materialien** in 3D (der 2D-Titel mit Sand/Wasser hat die besten Likes).
7. **Handy-zuerst-Steuerung.**
8. **Faire Monetarisierung.**
9. **Materialbewusster Klang.**

### 12.5 Was wir zusätzlich übernehmen sollten (Grundlinie, die Spieler erwarten)

- **Labor-Ereignisse** (gratis, nie hinter Bezahlschranke): Sturm-Ventilator, Meteoritenschauer
  aus der Decke (Fantasie-Labor-Anlage), Schwerkraft-Ausfall, Stromausfall, Überflutung.
  Im geteilten Server pro Labor, im Solo-Labor frei auslösbar.
- **Einfache Befehle an Dummies** aus einer festen Liste (Folgen, Stehenbleiben, Hinsetzen,
  Hände hoch, Laufen zu …) – **kein** KI-Chat (wäre 18+, siehe 01 §5).
- **Zurückspulen** im Solo-Labor: aus dem Replay-Puffer einen Zeitpunkt wählen und den Zustand
  dort wiederherstellen (Positionen + Geschwindigkeiten + Vitalwerte-Schnappschüsse alle 0,5 s).

### 12.6 Was das für die Strategie heißt

- **Zeitfenster:** Der Boom ist jetzt. Unser Vorteil ist Qualität und Bindung, nicht Tempo –
  aber wir sollten nicht erst in 12 Monaten erscheinen. Siehe neue Option
  „Früher Start“ in [10](10_ROADMAP_QA_MONETARISIERUNG.md#option-früher-start-empfohlen).
- **Positionierung:** Nicht „noch ein realistischer Ragdoll“, sondern
  *„Das Labor, in dem du Crash-Tests baust, misst und gemeinsam tüftelst“*. Der Titel braucht
  keine Emojis und kein „[UPD]“ – ein klares Versprechen hebt sich in dieser Liste ab.
- **Einstufung:** Ein Konkurrent mit (stilisierter) Zerlegung ist als *Mild* gelistet. Das ist ein
  Hinweis, aber kein Beweis – Einstufungen beruhen auf Selbstauskunft. Unsere Fragebogen-Vorschau
  (01) bleibt maßgeblich.

---

## 13. Geprüfte Referenzwerte

*(Wird mit den geprüften biomechanischen Daten und Crash-Test-Grenzwerten gefüllt.)*

---

## 14. Realismus messbar machen

| Test | Methode | Ziel |
|------|---------|------|
| **Fallzeit** | Dummy aus 1 m, 2 m, 5 m fallen lassen, Zeit messen | ±5 % zur Physik (0,45 s / 0,64 s / 1,01 s) |
| **Pendel** | frei hängender Arm/Bein, Schwingdauer messen | ±10 % zu Werten aus den Trägheitsradien |
| **Crash-Referenz** | Schlitten mit 50 km/h gegen starre Wand, Kopf-Verlauf vs. veröffentlichte Hybrid-III-Kurven | Form und Größenordnung stimmen |
| **Polster-Test** | gleicher Sturz auf Beton/Gummi/Schaum | HIC sinkt deutlich und in sinnvoller Reihenfolge |
| **Blindtest** | 20 Spieler sehen je 10 s Clips (wir vs. 3 Konkurrenten, ohne Logo) | ≥ 75 % wählen unseren als „am echtesten“ |
| **Wackel-Test** | 30 Dummies liegen 60 s still | kein Zittern, alle schlafen ein (Physik-Sleep) |
