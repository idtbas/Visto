# Visto – ein simuliertes Gehirn lernt laufen

Visto ist eine Website, auf der ein zweibeiniges Wesen laufen lernt. Es gibt kein fertiges
Bewegungsprogramm und keine Evolution über Generationen: **ein** Wesen mit **einem** Nervensystem
aus spikenden Neuronen lernt während seines Lebens, belohnt durch Cookies.

```
npm install
npm run dev        # dann http://localhost:5173 öffnen
```

`npm run build` erzeugt eine einzige, eigenständige Datei `dist/index.html` (rund 550 kB), die
sich überall hosten oder direkt öffnen lässt.

## Was man sieht

- **Links** die Welt: der Körper mit Knochen, 14 Muskeln und Sehnen. Rot heißt angespannt.
- **Rechts** das Nervensystem: jeder Punkt ist ein Neuron und leuchtet, wenn es feuert
  (blau = hemmend). Mit der Maus über einen Block fahren zeigt Name und Feuerrate.
- **Botenstoffe**: die Pegel der acht Hormone mit ihrem Verlauf der letzten Minute.
- **Lernkurve**: wie weit jeder Laufversuch kam. **Tonus-Kerne**: was das Wesen bisher gelernt hat.
- **Cookie geben** (oder Taste `C`) belohnt von Hand. Ein Klick in die Welt legt einen Cookie
  dorthin. Mit „Auto-Belohnung" belohnt sich Fortschritt von selbst.
- **Hindernisse** legt kleine Stufen in den Weg, hinter jeder wartet ein Cookie. Die gestrichelte
  Linie zeigt, worauf das Auge gerade schaut.
- Zeitraffer bis `max`, „Stehen/Laufen", „Neues Leben" (Gehirn zurücksetzen). Das Gehirn wird
  alle 30 Sekunden im Browser gespeichert und beim nächsten Besuch weiterverwendet.
- **Kleinhirn (experimentell)** baut das Gehirn mit 12.000 zusätzlichen Körnerzellen neu auf.

## Der Körper

Rumpf, Oberschenkel, Unterschenkel und Füße (80 kg, Maße nach Geyer & Herr 2010) in einer
2D-Physik (planck.js) mit 1 ms Zeitschritt. Pro Bein sieben Muskel-Sehnen-Einheiten nach Hill:
Hüftbeuger, Gesäßmuskel, hintere Oberschenkelmuskeln (zweigelenkig), Oberschenkelstrecker,
Wadenmuskel (zweigelenkig), Schollenmuskel und Schienbeinmuskel. Muskeln können nur ziehen,
ihre Kraft hängt von Länge und Geschwindigkeit der Fasern ab, die Sehne ist eine Feder in Serie,
die Aktivierung ist träge, und Muskeln ermüden.

## Das Nervensystem

Alle Neuronen sind Izhikevich-Neuronen mit echten Aktionspotentialen im 1-ms-Takt. Synapsen
haben einzelne Gewichte, Leitungsverzögerungen und wirken über Leitfähigkeiten (erregend,
hemmend, langsam erregend).

| Region | Aufgabe | angeboren / gelernt |
|---|---|---|
| Sinnesnerven | Muskelspindeln (Länge, Dehngeschwindigkeit), Sehnenorgane (Kraft), Druck unter Ferse und Ballen, Gleichgewichtsorgan | angeboren |
| Rückenmark | 26 Reflexbahnen pro Bein über Interneuronen auf die Motoneuronen; Schalter für Stand- und Schwungphase aus der Last auf dem Fuß | angeborene Verschaltung, Stärken langsam lernfähig |
| Motoneuronen | ein Pool pro Muskel; seine Feuerrate ist die Anspannung | – |
| Hirnstamm | Laufkommando, Loslauf-Schaltkreis, fünf **Tonus-Kerne**, die ganze Reflexgruppen verstärken | Tonus wird **gelernt** |
| Erkundungs-Kern | probiert Varianten aus, indem er Tonus und Reflexe zufällig etwas verstellt | – |
| Dopamin-Kern | feuert bei „besser als erwartet", pausiert bei „schlechter als erwartet" | – |
| Sehrinde | vier Neuronengruppen, die auf Hindernisse in 0,3 / 0,6 / 0,9 / 1,3 m Entfernung ansprechen | angeboren |
| Basalganglien | Striatum, Pallidum, Thalamus: entscheiden, ob der Befehl „Füße anheben" gegeben wird | Entscheidung wird **gelernt** |
| Kleinhirn (optional) | Körnerzellen, Purkinje-Zellen, Kletterfasern: lernt Korrekturen vorwegzunehmen | gelernt, noch experimentell |

### Wie es lernt

Die Synapsen, die einen Tonus-Kern antreiben, merken sich, wann der Erkundungs-Kern sie gerade
stärker oder schwächer als üblich hat feuern lassen. Kommt danach Dopamin, wird diese
Abweichung fest eingebaut; fällt das Dopamin ab, wird sie zurückgenommen (Lernen durch
Perturbation nach Fiete & Seung 2006). Das ist eine lokale Regel: jede Synapse kennt nur ihr
eigenes Vorher-Neuron, ihr Nachher-Neuron und den Dopaminpegel.

Belohnung gibt es für Cookies, für aufrechtes Vorwärtskommen und dafür, länger auf den Beinen
zu bleiben als nach bisheriger Erfahrung zu erwarten war. Ein Sturz tut weh.

### Die Hormone

| Stoff | Vorbild | steigt bei | Wirkung |
|---|---|---|---|
| Dopamin | Dopamin | besser als erwartet | schreibt Synapsen fest |
| Vigilin | Noradrenalin | Überraschung, Schmerz | Wachheit; Lernen am besten bei mittlerem Pegel |
| Fokin | Acetylcholin | unvorhersehbaren Ergebnissen | mehr Erkundung, höhere Lernrate |
| Serenin | Serotonin | ruhigen, schmerzfreien Phasen | dämpft Erkundung und Stress |
| Stressin | Cortisol | Stürzen, Misserfolg | bremst das Lernen, wenn dauerhaft hoch |
| Ergin | Hungerhormon | leerer Energiereserve | macht Cookies wertvoller |
| Somnin | Adenosin | langer Wachzeit | Schlafdruck; nach etwa 15 Minuten schläft das Wesen ein |
| Plastin | BDNF | Erfolg | verstärkt das Lernen |

### Schlaf

Ist das Somnin hoch genug, erschlaffen die Muskeln und das Wesen legt sich hin (etwa 45
Sekunden). Im Wachen folgt ein langsamer Mittelwert den gelernten Tonus-Synapsen; im Schlaf
werden die Synapsen zu diesem Mittelwert zurückgezogen. Das glättet das Hin und Her des Tages.
Ein Wiederabspielen von Erlebnissen (Replay) gibt es noch nicht.

### Sehen und Entscheiden

Das Auge meldet die Entfernung zum nächsten Hindernis. Ein Basalganglien-Schaltkreis kann den
Befehl „Füße anheben" auslösen: Feuert das Striatum stark genug, verstummt das Pallidum, der
Thalamus wird frei und treibt den Befehl. Welche Seheindrücke das Striatum antreiben, wird mit
derselben Dopamin-Regel gelernt. Das Wesen wird unentschlossen geboren (halbe Stärke).

## Was angeboren ist und was gelernt wird

Ehrlich aufgeschlüsselt:

- **Angeboren** ist der Schaltplan des Rückenmarks: welche Sinnesnerven auf welche Muskeln
  wirken und in welcher Schrittphase. Die Stärken dieser Bahnen stammen aus einer
  Optimierung vor der Geburt (`tools/`), die hier die Rolle der Evolution spielt.
- **Gelernt** wird im Leben der Tonus: Ein Neugeborenes hat zu schwache absteigende Bahnen,
  seine Beine tragen es nicht. Es muss selbst herausfinden, wie stark welche Reflexgruppe
  sein muss.
- Das Wesen steht nicht selbst auf und läuft nicht aus dem Stand los. Nach einem Sturz hebt
  es eine „helfende Hand" auf und setzt es mit etwas Schwung in Schrittstellung ab, wie beim
  Schreitreflex-Test mit Säuglingen.

## Gemessen

Headless mit `tools/learn-test.ts` (Neugeborenes mit 60 % Tonus, ohne Kleinhirn, damals 5.160
Neuronen und 190.720 Synapsen, vor dem Einbau von Sehrinde und Basalganglien):

| | Stürze je 3 min, im Verlauf von 21 min | Strecke je 3 min |
|---|---|---|
| mit Lernen, Lauf 1 | 60 · 60 · 58 · 49 · 14 · 6 · 4 | 134 m → 209 m |
| mit Lernen, Lauf 2 | 61 · 58 · 53 · 52 · 47 · 16 · 2 | 134 m → 206 m |
| Kontrolle (Dopamin um 17 s verzögert) | 69 · 70 · 70 · 75 · 74 · 72 · 71 | 73 m → 62 m |

Die Kontrolle bekommt dasselbe Dopaminsignal, nur zeitlich verschoben, sodass es nichts mehr
über das eben Getane aussagt. Sie lernt nichts. Wie schnell ein einzelnes Leben lernt, schwankt:
Im Browser war ein Lauf nach etwa 10 Minuten so weit, andere brauchen über 20.

Hindernisse (5–10 cm hohe Stufen, `tools/obstacle-learn.ts`, gereiftes Wesen, je 2 Minuten):

| | geschafft / gestolpert | sonstige Stürze |
|---|---|---|
| Entscheidung eingefroren auf „halb anheben" | 0–3 / 6–10 | 25–31 |
| mit Lernen, nach 10 Minuten | 10–12 / 1–2 | 4–11 |

Gelernt hat es dabei, die Füße **nicht** anzuheben: Der Hochschritt bringt diesen Körper
häufiger aus dem Tritt, als er nützt. In einem zweiten Lauf stieg die Bereitschaft zuerst auf
das Maximum und sank erst danach.

## Was noch nicht geht

- Ein Gedächtnis (Hippocampus), Replay im Schlaf, Arbeitsgedächtnis und inneres Durchspielen
  sind nicht gebaut. „Denken" im Sinne des Plans gibt es damit noch nicht; es gibt eine gelernte
  Entscheidung.
- Das Auge ist ein Entfernungsmesser für das nächste Hindernis, kein Bildsehen.
- Der Befehl „Füße anheben" hilft nicht zuverlässig über Stufen. Mit Hindernissen stürzt das
  Wesen deutlich öfter als ohne.
- Das Kleinhirn ist verdrahtet und seine Synapsen lernen, aber es verbessert das Laufen bisher
  nicht messbar. Deshalb ist es abgeschaltet, solange man es nicht einschaltet.
- Das voreingestellte Gehirn hat rund 5.500 Neuronen und 205.000 Synapsen, mit Kleinhirn rund
  18.000 und 646.000. Das ist weit unter den anfangs angepeilten 100.000 Neuronen.
- Das Stehen ist verkrampft (rund 650 W) und das Loslaufen aus dem Stand gelingt nicht.
- Das Lernen einzelner Reflexbahnen ist zu langsam, um in Minuten sichtbar zu sein.
- Auf einem Kern schafft JavaScript etwa 15–30 ns pro Neuron und Millisekunde. Rund 5.500
  Neuronen liefen auf der Entwicklungsmaschine mit etwa 3,7-facher Echtzeit, 18.000 mit etwa
  0,7-facher. 100.000 Neuronen bräuchten einen schnelleren Rechenkern (WebAssembly mit SIMD
  oder WebGPU), den es noch nicht gibt.

## Werkzeuge für die Entwicklung

| Befehl | Zweck |
|---|---|
| `npx tsx tools/learn-test.ts <min> 0 1` mit `TONE=0.6` | ein Leben ohne Browser, druckt den Fortschritt je Minute (`SHAM=1` für die Kontrolle) |
| `npx tsx tools/spinal-test.ts out/x.json 0 20` | prüft die angeborene Verschaltung |
| `npx tsx tools/obstacle-learn.ts <min> 1` | Hindernisse: lernt es, wann es die Füße hebt? |
| `npx tsx tools/tune-reflex.ts`, `tools/shadow.ts`, `tools/tune-spinal.ts` | die „Evolution": Referenzregler optimieren, Rückenmark dagegen kalibrieren, im geschlossenen Kreis feinabstimmen |
| `node tools/shot.cjs out.png`, `node tools/shot-series.cjs` | Screenshots der laufenden Seite |

## Quellen

- H. Geyer, H. Herr (2010): A muscle-reflex model that encodes principles of legged mechanics
  produces human walking dynamics and muscle activities.
- E. Izhikevich (2003): Simple model of spiking neurons. (2007): Solving the distal reward
  problem through linkage of STDP and dopamine signaling.
- I. Fiete, H. S. Seung (2006): Gradient learning in spiking neural networks by dynamic
  perturbation of conductances.
