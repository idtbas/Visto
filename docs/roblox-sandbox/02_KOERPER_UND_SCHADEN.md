# 02 – Körper, Vitalwerte, Verhalten und Schaden

Das ist das Herz des Spiels. Ein Ragdoll-Sandbox lebt davon, dass jeder Treffer **lesbar** und
**konsequent** ist: Der Körper reagiert physikalisch, die Vitalwerte reagieren biologisch, das
Verhalten reagiert glaubwürdig. Wir behalten die volle Simulationstiefe des Genres, verpacken sie
aber als **Testpuppe** („Dummy“) mit Hülle, Polster und Gerüst statt Haut, Fleisch und Knochen.
Dadurch bleibt alles nachvollziehbar, ohne realistisch-blutig zu werden (siehe
[01_JUGENDSCHUTZ](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md)).

Alle Zahlen sind **Startwerte für das Tuning**, keine Naturkonstanten. Sie liegen im Code in
`Shared/Config/BodyConfig.luau` und werden im Prototyp mit dem Debug-Overlay eingestellt.

---

## 1. Der Dummy-Rig (16 Segmente, 15 Gelenke)

Wir benutzen **keinen Humanoid** für NPC-Dummies. Ein Humanoid kämpft gegen die Physik (er will
stehen, er setzt Zustände, er kostet CPU). Stattdessen: eigener Rig aus `MeshPart`s, verbunden mit
`BallSocketConstraint`s, gesteuert von unserem eigenen „Muskel“-Controller.

| # | Segment (intern) | Anzeige | Massenanteil | Enthält „Organ“ |
|---|------------------|---------|-------------:|-----------------|
| 1 | `Head` | Kopf | 8 % | **Steuerchip** (≈ Gehirn) |
| 2 | `Chest` | Brust | 17 % | **Pumpe** (≈ Herz), **Luftbalg** (≈ Lunge) |
| 3 | `Belly` | Bauch | 12 % | **Glibber-Tank** (≈ Leber/Bauchorgane) |
| 4 | `Pelvis` | Becken | 12 % | – |
| 5/6 | `UpperArm_L/R` | Oberarm | je 3 % | – |
| 7/8 | `LowerArm_L/R` | Unterarm | je 2 % | – |
| 9/10 | `Hand_L/R` | Hand | je 0,8 % | – (Greifpunkt) |
| 11/12 | `UpperLeg_L/R` | Oberschenkel | je 10 % | – |
| 13/14 | `LowerLeg_L/R` | Unterschenkel | je 4,5 % | – |
| 15/16 | `Foot_L/R` | Fuß | je 1,5 % | – (Bodenkontakt) |

Drei Rumpfsegmente (Brust/Bauch/Becken) statt zwei wie bei R15: Das gibt die typische weiche
Wirbelsäulenkrümmung, die Ragdolls im Genre so lebendig wirken lässt.

**Größe:** 6 Studs Gesamthöhe (≈ 1,70 m bei 0,28 m/Stud). **Masse:** über
`CustomPhysicalProperties` mit Dichte so gewählt, dass der Dummy ≈ 70 „kg-Äquivalent“ wiegt und
mit Kisten, Fässern und Autos glaubwürdig interagiert (Dichte-Tabelle in
[04_SYSTEME](04_SYSTEME_UND_SIMULATION.md#1-materialsystem)).

### Gelenke

| Gelenk | Verbindet | Typ | Grenzen (Startwerte) |
|--------|-----------|-----|----------------------|
| Nacken | Head–Chest | BallSocket | UpperAngle 40°, Twist ±50° |
| Oberer Rücken | Chest–Belly | BallSocket | UpperAngle 20°, Twist ±20° |
| Unterer Rücken | Belly–Pelvis | BallSocket | UpperAngle 25°, Twist ±25° |
| Schulter L/R | Chest–UpperArm | BallSocket | UpperAngle 100°, Twist ±70° |
| Ellbogen L/R | UpperArm–LowerArm | BallSocket (scharnierartig) | UpperAngle 75°, Twist ±10°, asymmetrisch über Attachment-Ausrichtung |
| Handgelenk L/R | LowerArm–Hand | BallSocket | UpperAngle 50°, Twist ±30° |
| Hüfte L/R | Pelvis–UpperLeg | BallSocket | UpperAngle 85°, Twist ±35° |
| Knie L/R | UpperLeg–LowerLeg | BallSocket (scharnierartig) | UpperAngle 70°, Twist ±5° |
| Knöchel L/R | LowerLeg–Foot | BallSocket | UpperAngle 35°, Twist ±15° |

- `LimitsEnabled = true`, `TwistLimitsEnabled = true`, leichte `Restitution = 0` – sonst
  „klappern“ Gelenke.
- Knie und Ellbogen werden über die **Ausrichtung der Attachments** so gelegt, dass der
  Kegel nur nach einer Seite aufgeht (Trick: Kegelmitte um halben Beugewinkel vorgedreht).
- Nachbarsegmente bekommen `NoCollisionConstraint`s (Schulter–Brust, Hüfte–Becken usw.), damit
  sie nicht ineinander zittern. Nicht-Nachbarn (Hand–Kopf) **kollidieren**, damit sich der Körper
  nicht selbst durchdringt.
- Kollisionsform: Segmente sind einfache, konvexe Meshes mit `CollisionFidelity = Hull`
  (Hände/Füße `Box`), `RenderFidelity = Automatic`.

### Muskeln: Active Ragdoll

Jedes Gelenk hat zusätzlich einen **Muskel**: eine **`AnimationConstraint` mit
`IsKinematic = false`** (seit 2026 allgemein verfügbar, auch ohne Avatar Joint Upgrade). Sie
zieht das Gelenk mit begrenzter Kraft zu ihrer `Transform`-Zielrotation – genau das, was ein
Active Ragdoll braucht, ohne eigene AlignOrientation-Bastelei. Die Zielrotation kommt aus der
aktuellen **Pose** (wir setzen `Transform` im Simulationsschritt, wie von Roblox empfohlen), das
`MaxTorque` aus der **Muskelkraft**. Die `BallSocketConstraint` daneben liefert die harten
Gelenkgrenzen.

> Wichtig: Das Avatar Joint Upgrade baut solche Gelenke nur für **Spieler-Avatare**
> automatisch. Unsere NPC-Dummies baut ein eigener `RigBuilder` aus Attachments (Vorlage:
> die Luau-Portierung von `BuildRigFromAttachments` in der Humanoid-Doku).

```
Muskelmoment(Gelenk) = BasisMoment(Gelenk)
                     × Bewusstsein-Faktor        (0 … 1)
                     × Segment-Faktor            (Polster-Integrität, Bruch → 0,1)
                     × Adrenalin-Bonus           (1 … 1,5)
                     × Erschöpfung               (1 … 0,4)
                     × Temperatur-Faktor         (kalt → träge, gefroren → starr)
```

- Bewusstlos → Muskelmoment ≈ 0 → echter Ragdoll.
- Gefroren → Muskeln aus, stattdessen **Gelenke versteifen** (BallSocket-Grenzen auf 2–5°,
  bzw. temporär `WeldConstraint`) → der Dummy fällt „am Stück“ um.
- Der Muskel-Controller steckt hinter einem Interface `IMuscleDriver`. Implementierung 1:
  `AnimationConstraintDriver` (Standard). Implementierung 2: `AlignOrientationDriver`
  (Rückfallebene, falls die AnimationConstraint im Prototyp Probleme macht – z. B. das bekannte
  Ruckeln bei gemischt kinematisch/physikalischen Gelenken). Umschalten ohne Rest-Änderung.

### Gleichgewicht

Kein Humanoid heißt: Stehen ist unsere Aufgabe. Das Verfahren ist bewusst einfach und billig:

1. **Aufrichte-Moment:** Eine `AlignOrientation` am Becken hält die Hochachse senkrecht.
   Stärke = Muskelkraft × Bein-Faktor (beide Beine intakt = 1, ein Bein gebrochen = 0,3).
2. **Stützkraft:** Ein Raycast von jedem Fuß nach unten. Wenn mindestens ein Fuß Boden hat,
   hält eine `AlignPosition` (nur Y-Achse, `MaxForce` begrenzt) das Becken auf Standhöhe.
3. **Stolper-Logik:** Wandert der Schwerpunkt (massengewichteter Mittelpunkt aller Segmente)
   horizontal mehr als 0,8 Studs aus der Fußbasis, wird ein **Ausfallschritt** gesetzt: der
   näheste Fuß bekommt kurz ein Positionsziel in Fallrichtung. Klappt das 2× nicht → Sturz.
4. **Sturz:** Aufrichte- und Stützkraft werden über 0,15 s auf 0 geblendet. Der Dummy fällt
   physikalisch. Nach `Aufstehen-Verzögerung` (2–4 s, abhängig von Schmerz) versucht er
   aufzustehen (siehe Verhalten).

Die Grenzwerte (Stützkraft maximal ≈ 1,6× Körpergewicht) sorgen dafür, dass Dummies von einem
Stoß, einem Treffer oder einer Explosion **natürlich** umgeworfen werden statt wie
festgeklebt stehen zu bleiben. Genau diese Balance zwischen „steht“ und „kippt“ ist das Gefühl
des Genres.

---

## 2. Schichtenmodell pro Segment

Jedes Segment hat drei Schichten mit eigener Integrität (0 … 1):

| Schicht | Entspricht | Wirkung, wenn beschädigt |
|---------|------------|--------------------------|
| **Hülle** | Haut | Risse → Glibber tritt aus; Optik: Kratzer, Risse, Ruß, Frost |
| **Polster** | Fleisch/Muskel | Muskelkraft des Segments sinkt; stärkeres Auslaufen |
| **Gerüst** | Knochen | Bei Bruch: Segment hängt schlaff, Gelenk wird „weich“; Belastung schmerzt |

Zusätzliche Zustände pro Segment:

```lua
export type SegmentState = {
    shell: number,          -- 0..1 Hülle
    padding: number,        -- 0..1 Polster
    frame: number,          -- 0..1 Gerüst (Integrität, nicht nur Bruch)
    fractured: boolean,     -- Gerüst gebrochen
    temperature: number,    -- °C
    charred: number,        -- 0..1 Ruß/Verkohlung (rein optisch + Hüllenschaden)
    frozen: boolean,
    acid: number,           -- 0..1 laufende Ätz-Belastung
    electrified: number,    -- Restzeit in s
    wounds: { Wound },      -- max. 6 aktive Wunden pro Segment (älteste verschmelzen)
    attached: boolean,      -- noch mit dem Körper verbunden
}

export type Wound = {
    kind: "Crack" | "Cut" | "Puncture" | "Burn",
    localPos: Vector3,      -- Position im Segment-Raum (für Decal/Partikel)
    normal: Vector3,
    severity: number,       -- 0..1
    leakRate: number,       -- Glibber-Einheiten pro Sekunde
    sealed: number,         -- 0..1 Selbstabdichtung (≈ Gerinnung)
}
```

### Organe als Trefferzonen

Organe sind **Kugeln im Segment-Raum** (Position + Radius). Ein Treffer prüft per
Strahl-Kugel-Schnitt bzw. Abstand zur Trefferposition, ob ein Organ getroffen wurde.

| Organ | Segment | Wirkung bei Schaden |
|-------|---------|---------------------|
| Steuerchip | Kopf | Integrität 0 → endgültig deaktiviert (nur „Neustart“ + Reparatur helfen). Schwere Treffer → sofort bewusstlos |
| Pumpe | Brust | Hört auf zu pumpen → kein Glibberkreislauf → Sauerstoff im Chip sinkt |
| Luftbalg | Brust | Sauerstoffaufnahme sinkt proportional |
| Glibber-Tank | Bauch | Starkes inneres Auslaufen (unsichtbar, nur über Vitalwerte) |

---

## 3. Globale Vitalwerte (Körper)

| Wert | Bereich | Normal | Bedeutung |
|------|---------|--------|-----------|
| `goo` | 0 … 100 % | 100 | Glibbermenge (≈ Blutvolumen) |
| `oxygen` | 0 … 100 | 100 | Sauerstoff im Steuerchip |
| `pump` | an/aus + Rate | an, 70 | Pumpe (≈ Herzschlag) |
| `consciousness` | 0 … 100 | 100 | Bewusstsein |
| `pain` | 0 … 100 | 0 | Schmerz (klingt ab) |
| `adrenaline` | 0 … 100 | 0 | Schmerzdämpfung, Kraftbonus, steigt bei Gefahr |
| `shock` | 0 … 100 | 0 | Kreislaufschock bei großem Glibberverlust |
| `chip` | 0 … 1 | 1 | Integrität des Steuerchips |
| `exhaustion` | 0 … 1 | 0 | Erschöpfung durch Zappeln/Aufstehen |
| `alive` | Zustand | `Active` | `Active` / `Unconscious` / `Deactivated` / `Broken` |

Ergänzende Zustände (aus der Genre-Analyse – genau diese Details machen die Diagnose-Tiefe aus):

| Zustand | Auslöser | Wirkung | Heilung |
|---------|----------|---------|---------|
| `pressure` (Kreislaufdruck, 0–100 %) | sinkt schnell bei Pumpe aus, langsam bei Glibberverlust | < 25 % über 20 s → Deaktivierung | Pumpe an, Glibber nachfüllen, **Kreislauf-Maschine** hält 60 % |
| **Inneres Lecken** | Stich/Schuss in Rumpf, schwerer stumpfer Treffer am Bauch | goo sinkt unsichtbar, Segment-Muskeln schwächer, gelegentliches Zucken | Dichtmittel (Flüssigkeit), Reparatur-Gel |
| **Luftbalg geplatzt** | Stich/Schuss in Brust mit Organtreffer | Sauerstoffaufnahme → 0 | Reparatur-Gel, Atem-Serum (überbrückt) |
| **Untergetaucht** | Kopf unter Wasser-Pfütze/Becken (Raycast Kopf in Wasserzone) | Sauerstoffaufnahme → 0 | auftauchen, Atem-Serum |
| **G-Kraft** | Beschleunigung des Kopfes > 25 g über 0,5 s (Schleuder, Rakete) | Bewusstsein sinkt; > 60 g Schaden | abklingen |
| **Taubheit** | Schmerzstiller-Serum | Schmerz wird ignoriert, keine Krümm-Reaktion | klingt ab |
| **Krampf** | Chip-Schaden > 40 % | 3–6 s steife Gelenke + Zucken, Pumpe kann stoppen | Reparatur-Gel, Neustart |
| **Wirbel gebrochen** | Bruch des Bauch- oder Brust-Gerüsts | Dummy kann nicht mehr stehen, nur kriechen | Reparatur |

### Takt

Die Vitalwerte laufen mit **10 Hz** in einem Parallel-Luau-Actor pro Labor (siehe
[03_TECHNIK](03_TECHNIK_PHYSIK_NETZWERK.md)). Schadensereignisse werden sofort verarbeitet, ihre
Folgen (Schmerz, Bewusstsein) beim nächsten 10-Hz-Takt verrechnet.

### Formeln (Startwerte)

```
Auslaufen pro s      = Σ wound.leakRate × (1 − wound.sealed) × PumpFaktor
                       PumpFaktor = 1,0 (Pumpe an) | 0,15 (Pumpe aus)
Selbstabdichtung     : wound.sealed += dt / (20 s + 60 s × severity)   (große Risse dichten kaum)
goo                 -= Auslaufen × dt × 100 / GooKapazität (5 Einheiten)

Sauerstoffzufuhr     = Luftbalg-Integrität × (Pumpe an ? 1 : 0) × (goo > 30 % ? 1 : goo/30 %)
oxygen              += (Sauerstoffzufuhr × 8 − 3) × dt     (fällt ohne Zufuhr mit 3/s)
chip                -= (oxygen == 0 ? 0,02 : 0) × dt      (≈ 50 s ohne Sauerstoff bis 0)

pain                 = Σ Schadensimpulse (sofort) ; danach  pain *= 0,92^dt
pain_eff             = pain × (1 − adrenaline/150)
adrenaline          += Gefahr-Ereignis (Treffer, Explosion in 15 Studs, Sturz) ; klingt mit 4 %/s ab

consciousness Ziel   = 100
                       − max(0, pain_eff − 60) × 1,5
                       − (goo < 70 ? (70 − goo) × 2 : 0)
                       − (oxygen < 40 ? (40 − oxygen) × 2,5 : 0)
                       − Kopftrauma (decay 10 s)
                       − Schlaf-Serum
consciousness        nähert sich dem Ziel mit 25/s nach unten, 8/s nach oben

shock               += goo < 60 ? (60 − goo) × 0,1 × dt : −2 × dt
Pumpe stoppt, wenn   : shock ≥ 100  ODER Pumpe-Organ-Integrität < 0,15
                       ODER Stromschlag-Rhythmusstörung (siehe 04_SYSTEME)
```

### Zustände

| Zustand | Bedingung | Optik (LED-Gesicht) |
|---------|-----------|---------------------|
| `Active` | Bewusstsein > 30 | Augen offen, Ausdruck je nach Schmerz |
| `Unconscious` | Bewusstsein ≤ 30 | Spiral-/Sternchen-Augen, Muskeln aus |
| `Deactivated` | Pumpe 60 s aus **oder** goo < 15 % **oder** chip < 0,25 | Bildschirm wird schwarz, ein letzter „Bliep“ |
| `Broken` | chip = 0 | Bildschirm zeigt Störbild, dann aus. Nur Neustart-Serum + Reparatur |

Bewusst **„Deaktiviert“ statt „tot“**: Das Wort, die Optik (Bildschirm geht aus) und der Sound
(Synth-„Bliep“) halten es kindgerecht, ohne die mechanische Konsequenz zu verwässern. Das
Neustart-Serum (≈ Life-Serum des Genres) kann alles umkehren – das ist auch spielerisch wichtig,
weil es „Experimente reparieren“ erlaubt.

---

## 4. Verhalten (KI-Zustandsmaschine)

Dummies haben keine Ziele wie NPCs in Actionspielen. Ihr Verhalten soll **auf ihren Körper
reagieren** – genau das macht die Figuren im Genre so glaubwürdig.

```
            ┌───────────┐  Stoß/Schwerpunkt raus  ┌───────────┐  2 Fehlschritte
            │  Stehen   │ ──────────────────────► │ Stolpern  │ ───────────────┐
            └───────────┘ ◄────────────────────── └───────────┘                ▼
                 ▲   gefangen                                            ┌───────────┐
   Aufstehen ok  │                                                       │  Fallen   │
            ┌───────────┐  Beine ok, bewusst, Schmerz < 70               └─────┬─────┘
            │ Aufstehen │ ◄───────────────────── ┌───────────┐ ◄─────────────┘ Boden
            └───────────┘                        │  Liegen   │
                                                 └───────────┘
                         Schmerz > 70 ─► Krümmen     Beine gebrochen ─► Kriechen
                         Strom ─► Zucken             gefroren ─► Erstarrt
                         Bewusstsein ≤ 30 ─► Bewusstlos   Deaktiviert ─► Schlaff
```

| Zustand | Was die Muskeln tun |
|---------|---------------------|
| **Stehen** | Idle-Pose mit leichtem Schwanken (Perlin-Rauschen auf Becken/Arme). Kopf dreht sich zu nahen, schnell bewegten Objekten. |
| **Stolpern** | Ausfallschritte, Arme rudern (Pose „Balance“). |
| **Fallen** | Arme nach vorn/unten („Abfangen“), Kinn zur Brust. Reflex: Hände vor das Gesicht, wenn ein Raycast ein schnelles Objekt (> 40 Studs/s) auf Kollisionskurs findet. |
| **Liegen** | Leichtes Zappeln, versucht nach Verzögerung aufzustehen. |
| **Aufstehen** | Pose-Sequenz (Bauch- oder Rückenlage erkannt über Brust-Normale): Arme stützen → Knie anziehen → hochdrücken. Kann scheitern (zu schwach) → zurück zu Liegen, `exhaustion` steigt. |
| **Krümmen** | Schützende Haltung um verletzte Segmente, Hände zum Segment mit der schlimmsten Wunde. Kindgerecht: kein Schreien, sondern hektische „Piep“-Laute und `>_<`-Augen. |
| **Kriechen** | Bei gebrochenen Beinen: Arme ziehen den Körper (wechselnde Hand-Positionsziele). |
| **Zucken** | Bei Strom: zufällige Gelenkziele mit 12–15 Hz, Amplitude ∝ Spannung. |
| **Erstarrt** | Gefroren: Gelenke steif, keine Muskeln. |
| **Bewusstlos / Schlaff** | Muskeln aus. Reiner Ragdoll. |
| **Wild** (nur Wild-Serum) | Läuft (Puppen-Gang, s. u.) zum nächsten Dummy und schlägt mit den Armen. Sanfter Ersatz für die „Zombie“-Mechanik des Genres. |

### Posen per Kontextmenü und Greifen

- Kontextmenü → **Pose**: *Automatisch* (Zustandsmaschine oben), *Stehen*, *Gehen*, *Sitzen*,
  *Ducken/Schützen*, *Steif* (alle Muskeln halten die aktuelle Haltung, wie eine Schaufensterpuppe),
  *Schlaff*. Im Pause-Modus lassen sich Dummies so frei posieren – wichtig für Szenen und Fotos.
- **Greifen:** Hände haben einen Greifpunkt. Kontextmenü „Greifen“ bzw. Aktivieren (F) lässt
  einen bewussten Dummy das nächste Item im Radius 1 Stud packen (`WeldConstraint` Hand ↔ Griff-
  Attachment des Items). Hände ohne Muskelkraft (bewusstlos, Arm ausgekugelt) lassen los.
  Damit halten Dummies Waffen, Schilde, Werkzeuge – und schießen per Signal (Abzug-Port).

### Robo-Dummy (zweiter Körpertyp, ab v1.1)

Die Genre-Analyse zeigt: ein zweiter Körpertyp mit **umgekehrten Schwächen** verdoppelt die
Experimente. Der **Robo-Dummy** benutzt denselben Rig, aber: Öl statt Glibber, immun gegen
Stiche (Metallhülle), empfindlich gegen Wasser, Strom, EMP und Kälte, wird mit dem
**Schraubenschlüssel** repariert statt mit Seren. Alles ist reine Konfiguration
(`BodyTypes/Robo.luau`) auf denselben Systemen.

### Gehen (ab Version 1.1)

Für v1.0 reicht Stehen/Stolpern/Aufstehen/Kriechen. Ab v1.1 kommt ein **prozeduraler
Puppen-Gang**: Das Becken bekommt ein langsames horizontales Positionsziel, die Füße abwechselnd
Schrittziele (Bogen über 0,35 s), die Muskeln folgen einer Gang-Pose. Das wirkt absichtlich etwas
hölzern – passend zur Testpuppe und viel stabiler als ein „echter“ physikalischer Gang.
Gehen wird für Wild-Serum, „Folgen“ (Kontextmenü) und „Weglaufen vor Feuer“ genutzt.

---

## 5. Schadensarten im Detail

### 5.1 Stumpf (Aufprall, Quetschen)

**Primärquelle: Collision Summaries** (`BasePart:BindToCollisionSummaries`, seit Oktober 2026).
Die Engine liefert pro Frame und Kontakt `Point`, `Normal`, `RelativeVelocity` (vor der
Auflösung durch den Solver gemessen), `Area` und beide Teile. Daraus:

```
v_n    = | RelativeVelocity · Normal |              (Aufprallgeschwindigkeit senkrecht)
μ      = m_a·m_b / (m_a + m_b)                      (reduzierte Masse; m_b = ∞ bei verankert)
J      = μ × v_n                                    (Impuls)
E      = ½ × μ × v_n²                               (Energie)
```

Trefferpunkt, Normale und Gegenstück (für Härte/Material) gibt es gratis dazu. Zwei
Einschränkungen, die die Architektur prägen (siehe [03](03_TECHNIK_PHYSIK_NETZWERK.md#3-netzwerk-und-autorität)):
Summaries entstehen **nur beim Netzwerk-Owner** und werden nicht repliziert, und sie kosten pro
abonniertem Teil – wir abonnieren nur Dummy-Segmente und zerbrechliche Items.

**Rückfallebene: Δv-Messung** (falls Summaries im Live-Spiel fehlen oder zu teuer sind):

```
Δv     = | v_jetzt − v_vorher − g·dt |               (Schwerkraft herausrechnen)
J      = m_segment × Δv ;  E = ½ × m_segment × Δv²
```

Gegenstück und Trefferpunkt dann per `GetPartsInPart`/Shapecast entlang der vorherigen
Geschwindigkeit. Beide Verfahren liefern dasselbe `ImpactEvent` an den Schadensrechner.

- Unter `v_min` (Start: 18 Studs/s) passiert nichts – normales Abrollen, Gehen, Ziehen.
- Verteilung auf Schichten (Härte des Gegenstücks `H` aus der Materialtabelle, 0,3 Gummi …
  1,5 Stahl):

```
E_eff          = E × H × Segment-Empfindlichkeit (Kopf 1,4, Hände/Füße 0,7, sonst 1,0)
Hülle         -= E_eff × 0,0009
Polster       -= max(0, E_eff − 300) × 0,0006
Gerüst bricht, wenn  J > Bruchschwelle(Segment) × (0,5 + 0,5 × frame)
Kopf:     Kopftrauma += E_eff × 0,05 ;  J > 900 → sofort bewusstlos ; Chip −(J − 1400)×0,0004
Schmerz  += E_eff × 0,02
Wunde Typ "Crack", wenn Hülle in einem Ereignis um > 0,15 fällt (leakRate 0,01 … 0,05)
```

| Segment | Bruchschwelle J (Startwert) |
|---------|------------------:|
| Kopf | 1100 |
| Brust/Bauch/Becken | 1600 |
| Oberarm / Unterarm / Hand | 650 / 550 / 400 |
| Oberschenkel / Unterschenkel / Fuß | 1200 / 900 / 500 |

**Quetschen:** Wenn ein Segment über ≥ 0,3 s zwischen zwei Objekten eingeklemmt ist
(Kontakt auf gegenüberliegenden Seiten, gemessen über `GetPartsInPart` + Normalenvergleich) und
eines davon schwer ist oder sich bewegt (Presse, Hydraulik), läuft kontinuierlicher Polster- und
Gerüstschaden. Optik: das Segment wird über `Size`-Skalierung sichtbar **flachgedrückt**
(Cartoon-Stauchung, max. 50 %) – kindgerecht und sehr lesbar.

### 5.2 Scharf (Stechen, Schneiden)

Klingen (Messer, Schwert, Speer, Säge, Glasscherbe) haben im Item-Datenmodell eine
**Schneide** (Linie aus zwei Attachments) und eine **Spitze** (Attachment + Richtung).

**Stechen:** Kontakt der Spitze mit einem weichen Material (Hülle/Polster) und
`v_rel · Klingenrichtung > v_stich` (Start: 22 Studs/s):

1. `NoCollisionConstraint` zwischen Klinge und Segment.
2. `PrismaticConstraint` entlang der Klingenachse, mit Reibung (Motor mit kleinem Moment
   als „Haftung“) und Grenzen bis zur Klingenlänge → die Klinge **steckt fest**, kann aber
   herausgezogen oder tiefer gedrückt werden.
3. Eindringtiefe pro Frame → Polster-Schaden, Organ-Check entlang der Klingenachse.
4. Wunde Typ „Puncture“, `leakRate` 0,04; beim Herausziehen verdoppelt (Glibber-Spritzer).

**Schneiden:** Schneide gleitet mit `v_tangential > v_schnitt` (Start: 15 Studs/s) über ein
Segment → Wunde Typ „Cut“ entlang der Gleitlinie, Hülle −0,2, `leakRate` 0,03. Sehr hohe
Energie an einem Gelenk (Schwert, Kreissäge) → Gelenk-Überlastung (siehe 5.8).

### 5.3 Ballistisch (Projektile)

Kugeln sind **Hitscan mit Durchdringung** (Raycast-Kette), keine physikalischen Teile:

```
E = Mündungsenergie (Waffe/Kaliber)
Schleife:
    Treffer = Raycast(Start, Richtung × Reichweite, Filter)
    falls kein Treffer: Ende (Leuchtspur bis Reichweite)
    Material-Widerstand R (J pro Stud) aus Tabelle, Dicke d per Rück-Raycast von hinten
    Einfallswinkel α zur Normale:
        harte Fläche und α > 75°  → Abpraller (Richtung reflektieren, E × 0,5), weiter
    Wirkung:  ApplyImpulseAtPosition(Richtung × E × k_impuls, Trefferpunkt)
              falls Dummy: Schichten von außen nach innen mit Rest-E belasten,
                           Organ-Kugeln entlang des Strahls prüfen,
                           Wunde "Puncture" Eintritt (+ Austritt, falls durch)
    E -= R × d
    falls E ≤ 0: stecken geblieben, Ende
    Start = Austrittspunkt + Richtung × 0,01
```

| Material | R (J pro Stud) |
|----------|-----:|
| Hülle + Polster (Dummy) | 120 |
| Gerüst (Dummy) | 400 |
| Holz | 250 |
| Glas | 60 (zerbricht) |
| Beton / Ziegel | 2 000 |
| Stahl | 6 000 |

Startwerte Mündungsenergie: Pistole 450, Revolver 800, SMG 400, Gewehr 1 800, Schrotflinte
8 × 250 (Streuung), Scharfschützengewehr 4 500, Panzerbrechend 9 000. Das ergibt die gewohnte
Genre-Logik: Pistole bleibt im zweiten Dummy stecken, das Scharfschützengewehr geht durch drei.

### 5.4 Explosion

Kein Roblox-`Explosion`-Objekt (es zerstört Gelenke unkontrolliert). Stattdessen eigenes System:

1. `GetPartBoundsInRadius(Zentrum, Radius)` → Kandidaten.
2. Pro **Baugruppe** (Assembly) ein Sichtlinien-Raycast zur Mitte → Deckung reduziert Wirkung
   auf 20 %.
3. Impuls `= Stärke × Masse-Faktor / (1 + (r/r0)²)` radial, mit leichtem Aufwärtsanteil (Optik!).
4. Schaden als stumpfer Schaden (`E_eff` aus Impuls), plus Hitze-Puls (`+ΔT`) für brennbare
   Objekte, plus **Splitter**: N Raycasts (Granate 24) in Zufallsrichtungen als Mini-Projektile
   (E = 80).
5. Gelenke von Dummies innerhalb `r < 0,35 × Radius` erhalten Gelenk-Überlastung.

### 5.5 Hitze und Feuer

Siehe Temperatursystem in [04_SYSTEME](04_SYSTEME_UND_SIMULATION.md#2-temperatur-feuer-kälte).
Wirkung auf Dummies pro Segment:

| Temperatur | Wirkung |
|-----------|---------|
| > 50 °C | Schmerz steigt, Adrenalin steigt, Dummy versucht wegzukommen |
| > 70 °C | Hülle −0,03/s, `charred` steigt (Ruß-Optik) |
| > 120 °C | Hülle −0,08/s, Polster −0,03/s, Wunde „Burn“ (leckt nicht, schmerzt) |
| > 250 °C | Hülle kann sich entzünden (Dummy brennt), Gerüst unbeeinflusst |

„Verkohlt“ ist bei uns **Ruß** auf einer Vinylhülle (dunkelgrau, rauchende Partikel), nicht
verbrannte Haut.

### 5.6 Kälte

| Temperatur | Wirkung |
|-----------|---------|
| < 10 °C | Muskeln 80 %, Bibbern (kleine Zitter-Ziele) |
| < −10 °C | Muskeln 40 %, Frost-Optik (Reif-Textur) |
| < −25 °C | **Gefroren**: Muskeln aus, Gelenke steif, Glibber läuft nicht aus. Bei großem Impuls (J > 900) **zerspringt der Eispanzer** um das Segment in Kristallsplitter: das Segment taut schlagartig auf, Polster −0,4, Gerüst kann brechen, Gelenk kugelt aus. Das Segment selbst bleibt dran (in Stufe B kann ein gefrorener Dummy als Ganzes in Bausatz-Teile zerfallen) |

### 5.7 Strom

Siehe Stromnetz in [04_SYSTEME](04_SYSTEME_UND_SIMULATION.md#3-strom-und-signale).
Wirkung: Zucken, Schmerz, Hülle −(Spannung × 0,0001)/s an Kontaktstellen (Brandflecken),
Pumpen-Rhythmusstörung mit Wahrscheinlichkeit `p = Spannung/5000` pro Sekunde, **aber**
ein kurzer Stoß (< 0,3 s, ≥ 800 V) auf die Brust bei gestoppter Pumpe startet sie mit 60 %
neu (Defibrillator-Logik).

### 5.8 Gelenk-Überlastung und Lösen von Gliedmaßen

Jedes Gelenk hat eine `jointIntegrity` (0 … 1). Sie sinkt durch:

- **Dehnung:** Abstand der beiden Attachments im Weltraum > 0,35 Studs (Solver kann die
  Bedingung nicht halten → riesige Zugkraft) → −Δ pro Frame.
- **Energie am Gelenk:** Stumpfe/scharfe/explosive Ereignisse, deren Trefferpunkt < 0,5 Studs
  vom Gelenk entfernt liegt.
- **Gefroren + Impuls:** Eispanzer zerspringt, Gelenk nimmt großen Schaden (siehe Kälte).
- **Ätzen** des Gerüsts an der Gelenkstelle.

Was bei `jointIntegrity = 0` passiert, hängt von der **Einstufung** ab (siehe
[01 §3](01_JUGENDSCHUTZ_UND_RICHTLINIEN.md#3-die-glibber--und-gelenk-regeln)). Roblox' aktuelle
Definition zählt **Abtrennung von Gliedmaßen ausdrücklich zu „Gore“** – damit wäre das Spiel
sehr wahrscheinlich nicht mehr für unter 16-Jährige erreichbar. Darum gibt es drei Stufen,
gesteuert über das Feature-Flag `JointFailureMode`:

| Stufe | Name | Was passiert | Wann |
|-------|------|--------------|------|
| **A** (Standard zum Start) | **Auskugeln** | Das Gelenk bleibt verbunden, aber seine Winkelgrenzen fallen weg (`LimitsEnabled = false`) und der Muskel ist tot. Die Gliedmaße baumelt frei um 360°, die Kugelpfanne „klackt“. Optik: Gelenkring blinkt orange, Funken. Das ist übrigens genau das, was im Genre ein gebrochener Knochen macht – mechanisch voll wertig. | Live-Spiel ab Tag 1 |
| **B** | **Bausatz-Zerfall** | Nur bei Deaktivierung durch sehr großen Schaden (Explosion, Presse): der **ganze** Dummy zerfällt sauber in seine 16 Kunststoffteile wie ein Spielzeug-Bausatz – keine Wunden, kein Glibber an den Gelenkstellen, glatte graue Kugelpfannen. Nach 8 s „ploppen“ die Teile weg (oder sammeln sich per Kontextmenü „Zusammensetzen“ wieder). Roblox nennt „Charaktere, die vor dem Respawn auseinanderfallen“ ausdrücklich als Beispiel für **unrealistische** Reaktion. | Nur, wenn die Fragebogen-Vorschau die Zielstufe bestätigt |
| **C** | **Einzelnes Lösen** | Einzelne Gliedmaßen lösen sich als saubere Spielzeugteile (Kugelpfanne, kurzer Funke, **kein** Glibber-Spritzer). | Nur, falls die Fragebogen-Vorschau das ohne höhere Stufe erlaubt – sonst nie |

Fest für alle Stufen:

- Keine Innereien, kein Gewebe, keine Knochen sichtbar – Gelenkstellen sind graue Kugelpfannen.
- **Der Kopf trennt sich nie** vom Körper, auch nicht in Stufe B/C (Kopf und Brust bleiben im
  Zerfall verbunden).
- Im **Sanft-Modus** gibt es nur Stufe A.
- Der Wechsel zwischen den Stufen ist reine Konfiguration (Server-Flag), keine Code-Änderung.

### 5.9 Ätzschleim (Säure)

Kontakt mit Ätzschleim (Flüssigkeit oder Pfütze) → `acid` steigt. Pro Sekunde:
Hülle −0,1 × acid, danach Polster, danach Gerüst. Optik: Blubber-Partikel, Hülle wird
fleckig, ausgebleicht und leicht milchig-durchscheinend (4 Stufen). **Das Segment behält immer
seine Form** – nichts wird „weggefressen“, nichts Inneres liegt frei. Roblox stuft „fehlendes
Fleisch“ und offene Wunden als *verstörend* ein; genau diese Bilder vermeiden wir. Mechanisch ist
nichts verloren: Die Schichtwerte sinken voll, ein zerätztes Gerüst bricht, ein zerätztes Gelenk
kugelt aus.

### 5.10 Schrumpfen/Wachsen, Schweben, Federn (Serum-Effekte)

Werden über das Flüssigkeitssystem ausgelöst, Details in
[04_SYSTEME](04_SYSTEME_UND_SIMULATION.md#4-flüssigkeiten-und-seren). Technisch über
`Model:ScaleTo()` (Größe), `VectorForce` gegen die Schwerkraft (Schweben) und
`CustomPhysicalProperties.Elasticity` (Federn).

---

## 6. Sichtbares Feedback (weil weniger Gore → mehr Lesbarkeit)

Weil wir auf realistische Darstellung verzichten, muss jede Information anders sichtbar werden.
Das ist kein Kompromiss, sondern eine Stärke:

1. **LED-Gesicht** (SurfaceGui auf dem Kopf, 8 Ausdrücke): neutral `• •`, erschrocken `O O`,
   Schmerz `> <`, benommen `@ @`, schläfrig `- -`, bewusstlos `✱ ✱`, wild `▼ ▼`, aus (schwarz).
   Augen blinzeln, folgen nahen Objekten.
2. **Hüllen-Zustand** als Textur-Varianten: sauber → Kratzer → Risse → stark gerissen (4 Stufen,
   je Segment über `TextureID`-Austausch bzw. Overlay-Decal).
3. **Glibber-Leck-Partikel** an den Wundpositionen (Rate ∝ leakRate) + Tropfen, die als
   Pfützen-Decals landen.
4. **Diagnose-Ansicht** (Werkzeug „Scanner“): halbtransparenter Röntgenblick mit farbigen
   Segmenten (grün → gelb → rot → schwarz), gebrochene Gerüste blinken, Organe als Icons,
   daneben ein Panel mit allen Vitalwerten als Balken und einem EKG-artigen Pumpen-Puls.
   Genau diese Diagnose-Tiefe ist das, was Genre-Fans lieben – wir machen sie zur Hauptattraktion.
5. **Sounds:** Dummies sprechen nicht und schreien nicht. Sie haben kurze, freundliche
   Synth-Laute (Piepen, Brummen, „Bliep“ beim Deaktivieren), dazu materialabhängige
   Aufprallgeräusche (Vinyl-„Plonk“, Gerüst-„Klonk“, Riss-„Knirsch“).
