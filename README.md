# Visto – ein simuliertes Gehirn lernt laufen

Visto ist eine Website, auf der ein zweibeiniges Wesen laufen lernt. Es gibt kein fertiges
Bewegungsprogramm und keine Evolution über Generationen: **ein** Wesen mit **einem** Nervensystem
aus spikenden Neuronen lernt während seines Lebens, belohnt durch Cookies.

```
npm install
npm run dev        # dann http://localhost:5173 öffnen
```

`npm run build` erzeugt eine statische Seite in `dist/`.

## Was man sieht

- **Links** die Welt: der Körper mit Knochen, 14 Muskeln und Sehnen. Rot heißt angespannt.
- **Rechts** das Nervensystem: jeder Punkt ist ein Neuron und leuchtet, wenn es feuert
  (blau = hemmend). Mit der Maus über einen Block fahren zeigt Name und Feuerrate.
- **Botenstoffe**: die Pegel der acht Hormone mit ihrem Verlauf der letzten Minute.
- **Lernkurve**: wie weit jeder Laufversuch kam. **Tonus-Kerne**: was das Wesen bisher gelernt hat.
- **Cookie geben** (oder Taste `C`) belohnt von Hand. Ein Klick in die Welt legt einen Cookie
  dorthin. Mit „Auto-Belohnung" belohnt sich Fortschritt von selbst.
- Zeitraffer bis `max`, „Stehen/Laufen", „Neues Leben" (Gehirn zurücksetzen). Das Gehirn wird
  alle 30 Sekunden im Browser gespeichert und beim nächsten Besuch weiterverwendet.

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
| Somnin | Adenosin | langer Wachzeit | Schlafdruck (Schlaf ist noch nicht eingebaut) |
| Plastin | BDNF | Erfolg | verstärkt das Lernen |

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

Headless mit `tools/learn-test.ts` (Neugeborenes mit 60 % Tonus, ohne Kleinhirn, 5.160 Neuronen,
190.720 Synapsen):

| | Stürze je 3 min, im Verlauf von 21 min | Strecke je 3 min |
|---|---|---|
| mit Lernen, Lauf 1 | 60 · 60 · 58 · 49 · 14 · 6 · 4 | 134 m → 209 m |
| mit Lernen, Lauf 2 | 61 · 58 · 53 · 52 · 47 · 16 · 2 | 134 m → 206 m |
| Kontrolle (Dopamin um 17 s verzögert) | 69 · 70 · 70 · 75 · 74 · 72 · 71 | 73 m → 62 m |

Die Kontrolle bekommt dasselbe Dopaminsignal, nur zeitlich verschoben, sodass es nichts mehr
über das eben Getane aussagt. Sie lernt nichts.

## Was noch nicht geht

- Augen, Hindernisse, Entscheidungen, Gedächtnis und Schlaf sind geplant, aber noch nicht gebaut.
- Das Stehen ist verkrampft (rund 650 W) und das Loslaufen aus dem Stand gelingt nicht.
- Das Lernen einzelner Reflexbahnen ist zu langsam, um in Minuten sichtbar zu sein.
- Auf einem Kern schafft JavaScript etwa 15–30 ns pro Neuron und Millisekunde. Rund 5.000
  Neuronen laufen damit mehrfach schneller als Echtzeit, 100.000 nicht.

## Werkzeuge für die Entwicklung

| Befehl | Zweck |
|---|---|
| `npx tsx tools/learn-test.ts <min> 0 1` mit `TONE=0.6` | ein Leben ohne Browser, druckt den Fortschritt je Minute (`SHAM=1` für die Kontrolle) |
| `npx tsx tools/spinal-test.ts out/x.json 0 20` | prüft die angeborene Verschaltung |
| `npx tsx tools/tune-reflex.ts`, `tools/shadow.ts`, `tools/tune-spinal.ts` | die „Evolution": Referenzregler optimieren, Rückenmark dagegen kalibrieren, im geschlossenen Kreis feinabstimmen |
| `node tools/shot.cjs out.png`, `node tools/shot-series.cjs` | Screenshots der laufenden Seite |

## Quellen

- H. Geyer, H. Herr (2010): A muscle-reflex model that encodes principles of legged mechanics
  produces human walking dynamics and muscle activities.
- E. Izhikevich (2003): Simple model of spiking neurons. (2007): Solving the distal reward
  problem through linkage of STDP and dopamine signaling.
- I. Fiete, H. S. Seung (2006): Gradient learning in spiking neural networks by dynamic
  perturbation of conductances.
