# Visto – ein simuliertes Gehirn lernt laufen

Visto ist eine Website, auf der ein zweibeiniges Wesen laufen lernt. Es gibt kein fertiges
Bewegungsprogramm und keine Evolution über Generationen: **ein** Wesen mit **einem** Nervensystem
aus spikenden Neuronen lernt während seines Lebens, belohnt durch Cookies und gewarnt durch
Schmerz.

```
npm install
npm run dev        # dann http://localhost:5173 öffnen
```

`npm run build` erzeugt eine einzige, eigenständige Datei `dist/index.html` (rund 630 kB), die
sich überall hosten oder direkt öffnen lässt.

Seit dem letzten Schritt gibt es ein zweites, längerfristiges Ziel: eine Architektur, bei der
die Frage nach einer eigenen Innenperspektive wissenschaftlich untersuchbar wird. Stand,
Entwurf, Experimente und Grenzen stehen in [docs/INNENPERSPEKTIVE.md](docs/INNENPERSPEKTIVE.md).
Nichts davon behauptet, dass Visto etwas erlebt.

## Was man sieht

- **Links** die Welt: der Körper mit Knochen, 14 Muskeln und Sehnen. Rot heißt angespannt.
  Wo es wehtut, leuchtet die Körperstelle rot auf.
- **Rechts** das Nervensystem als leuchtendes Gehirn in 3D: Jedes Neuron ist ein Lichtpunkt an
  der Stelle seines biologischen Vorbilds und blitzt bei jedem seiner Spikes auf – die
  Körperfühlrinde hinter der Zentralfurche (das linke Bein in der rechten Hirnhälfte), die
  Sehrinde am Hinterkopf, Hippocampus und Mandelkern tief im Schläfenlappen, die Dopaminzellen
  im Mittelhirn, das Rückenmark in der Wirbelsäule, daneben die Nerven der Beine. Die Farben
  fassen Regionen zu zehn Gruppen zusammen (Schlüssel unten links, mit einem Balken für die
  aktuelle Feuerrate). Im Bild selbst steht kein Text. Ziehen dreht, Mausrad oder zwei Finger
  zoomen, „Gesamt / Gehirn / Mark" fährt die Kamera.
  Echte Aktivität sind: das Aufblitzen der Neuronen, die Helligkeit der feinen Sterne um jede
  Zellgruppe (ihre Feuerrate), die Helligkeit der Fasern zwischen den Regionen (Feuerrate der
  Quellzellen) und die Lichtpunkte, die darauf wandern (eine Stichprobe der Spikes, höchstens
  etwa jeder 250.; ihr Tempo ist frei gewählt). Der feine Staub, der dem Gehirn die Form
  gibt, trägt keine eigenen Daten; jeder Teil glimmt mit der Feuerrate der Zellen seiner
  Farbgruppe. Reine Gestaltung sind die Form selbst (aus Formeln, kein vermessenes Gehirn),
  Wirbel und Rippen, das Netz feiner Linien im Staub und die Tiefenunschärfe. Das Rückenmark
  ist dicker gezeichnet, als es wäre.
- **Karte** schaltet auf die flache, beschriftete Ansicht um: oben das Gehirn von der Seite,
  darunter Hirnstamm und Rückenmark mit linker und rechter Hälfte, außen die Sinnes- und
  Bewegungsnerven der Beine. Mit der Maus über eine Zellgruppe fahren zeigt Name und
  Feuerrate.
- **Botenstoffe**: die Pegel der acht Hormone mit ihrem Verlauf der letzten Minute.
- **Lernkurve**: wie weit jeder Laufversuch kam. **Tonus-Kerne**: was das Wesen bisher gelernt
  hat. Darunter unter anderem **Gefahr**: wie sicher der Mandelkern gerade Schmerz erwartet.
- **Cookie geben** (oder Taste `C`) belohnt von Hand. Ein Klick in die Welt legt einen Cookie
  dorthin.
- Die Schalter **Cookies** und **Schmerz** legen fest, woraus das Wesen lernt. „Cookies"
  belohnt Fortschritt und legt Cookies auf den Weg; „Schmerz" schaltet die Schmerzrezeptoren
  ein. Beide an ist die Voreinstellung; nur „Schmerz" lässt es allein aus Schmerz lernen.
- **Hindernisse** legt kleine Stufen in den Weg, hinter jeder wartet ein Cookie. Die gestrichelte
  Linie zeigt, worauf das Auge gerade schaut.
- **Innenleben** öffnet ein Diagnosefenster: welcher Inhalt gerade den globalen Arbeitsraum
  hält (Schreibstreifen der letzten 20 Sekunden), was das Körpermodell für jeden Sinn erwartet
  hat und was gespürt wird, wie viel davon unerklärt ist, welche Bedürfnisse gemeldet werden.
  „Schubsen" gibt dem Wesen einen Stoß von außen; vier Schalter trennen einzelne Teile der
  Architektur ab. Alle Werte stammen aus den laufenden Neuronen.
- **Selbst / Laufen / Stehen**: In der Voreinstellung „Selbst" bekommt das Wesen keinen Befehl.
  Es läuft los, wenn es Hunger hat, riecht die Cookies vor und hinter sich, dreht sich zum
  näheren um, legt sich satt zur Ruhe – und **stirbt, wenn seine Energie aufgebraucht ist**.
  Dann hilft nur „Neues Leben". Mit „Cookie geben" kann man es füttern. „Laufen" und „Stehen"
  sind die alten Befehle von außen.
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
hemmend, langsam erregend). Die innere Schleife, die alle Neuronen um eine Millisekunde
weiterrechnet, läuft als WebAssembly mit SIMD (vier Neuronen auf einmal, Quelltext in
`asm/kernel.ts`); wo das nicht verfügbar ist, übernimmt dieselbe Schleife in JavaScript. Welche
gerade läuft, zeigt der Hinweis, wenn man mit der Maus über die Neuronenzahl fährt.

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
| Hippocampus | zwei Speicher für einzelne Erlebnisse, Ausgangs- und Optionszellen, Abwägung | Inhalte werden **gelernt** (ein Erlebnis genügt) |
| Scheitelrinde | Vorwärtsmodell: sagt vier Sinnessignale 50 ms voraus | gelernt |
| Schmerzrezeptoren | 14 Stellen: Haut von Kopf, Rumpf, Oberschenkeln und Knien, Bänder von Hüft-, Knie- und Sprunggelenken | angeboren |
| Schmerzkern, Habenula | leiten Schmerz weiter und bringen die Dopaminzellen zum Schweigen | angeboren |
| Körperfühlrinde | rund 8.700 Zellen, die alles Gespürte neu kombinieren: jede feuert nur, wenn mehrere ihrer Eingänge zusammen aktiv sind | angeboren (feste Zufallsverschaltung) |
| Mandelkern | lernt, welche Körperlagen dem Schmerz vorausgehen, und meldet steigende oder sinkende Gefahr an die Dopaminzellen | **gelernt** |
| Otolithen | spüren, wie stark der Kopf nach vorn oder hinten beschleunigt wird | angeboren |
| Körpermodell | vergleicht für sechs Sinne Vorhersage und Gespürtes mit eigenen Zellen; was unerklärt bleibt, gilt als Fremdeinwirkung | Vorhersage **gelernt**, Vergleich angeboren |
| Körperinneres | Zellen, die Hunger, Müdigkeit und Erschöpfung als Feuerrate melden | angeboren |
| Riechen | zwei Zellgruppen: wie stark riecht ein Cookie vorn, wie stark hinten (satt riecht es kaum) | angeboren |
| Antrieb (Basalganglien) | zwei Schleifen geben die Befehle „Los" und „Wenden"; Hunger macht unruhig, der Geruch von vorn bremst das Wenden | Hunger → Los und der Vergleich angeboren; was die Gerüche bedeuten, wird **gelernt** |
| Globaler Arbeitsraum | fünf Inhalte (Körper, Schmerz, Gefahr, Sehen, Bedürfnis) konkurrieren um einen selbsterhaltenden, zeitlich begrenzten Zustand, der an Wachheit und Haltung ausgerufen wird | angeboren; der Zugang gewöhnt sich |
| Kleinhirn (optional) | Körnerzellen, Purkinje-Zellen, Kletterfasern: lernt Korrekturen vorwegzunehmen | gelernt, noch experimentell |

### Wie es lernt

Die Synapsen, die einen Tonus-Kern antreiben, merken sich, wann der Erkundungs-Kern sie gerade
stärker oder schwächer als üblich hat feuern lassen. Kommt danach Dopamin, wird diese
Abweichung fest eingebaut; fällt das Dopamin ab, wird sie zurückgenommen (Lernen durch
Perturbation nach Fiete & Seung 2006). Das ist eine lokale Regel: jede Synapse kennt nur ihr
eigenes Vorher-Neuron, ihr Nachher-Neuron und den Dopaminpegel.

Belohnung gibt es für Cookies, für aufrechtes Vorwärtskommen und dafür, länger auf den Beinen
zu bleiben als nach bisheriger Erfahrung zu erwarten war (der erwartete Schmerz ist
ausgeblieben).

### Schmerz

Schmerzrezeptoren sitzen in der Haut der Körperteile, die nicht zum Tragen gemacht sind, und in
den Bändern der Gelenke. Die Hautrezeptoren feuern, wenn ein Körperteil mit mehr als dem
Doppelten des Körpergewichts aufschlägt (bei einem Sturz sind es das 10- bis 20-Fache), die
Gelenkrezeptoren, wenn ein Gelenk mit Kraft gegen seinen Anschlag gedrückt wird. Ruhiges
Liegen und normales Gehen tun nicht weh: Ein ausgereiftes Wesen spürt beim Gehen praktisch
nichts, ein Neugeborenes hat schon beim Gehen leichte Schmerzen in Knie- und Sprunggelenken.
Wie stark und wie lange es wehtut, hängt von der Wucht ab. Ein Sturz kostet dadurch nicht
mehr pauschal 1,5 Belohnungseinheiten, sondern je nach Aufprall zwischen etwa 0,6 und 4,8
(im Mittel 1,5 bis 2,2). Rezeptoren, auf die es dauerhaft drückt, verstummen nach etwa 200 ms, und im
Schlaf ist die Schmerzbahn zu.

Der Weg im Gehirn: Schmerzrezeptoren → Schmerzkern → Habenula → hemmende Zellen → Dopaminzellen.
Schmerz bringt die Dopaminzellen also über echte hemmende Synapsen zum Schweigen, und die
Synapsen, die gerade aktiv waren, werden zurückgenommen. Derselbe Schmerz hebt Stressin und
Vigilin.

Der Schmerz sagt, **wo** das Wesen aufgeschlagen ist, aber nicht, welcher Muskel eine Sekunde
vorher den Fehler gemacht hat. Diese Lücke soll der **Mandelkern** schließen. Er liest die
Körperfühlrinde über lernfähige Synapsen. Setzt Schmerz unerwartet ein, werden die Synapsen
der Rindenzellen verstärkt, die in der halben Sekunde davor ungewöhnlich aktiv waren; feuert
der Mandelkern und es folgt kein Schmerz, werden sie wieder schwächer. Ein kleiner Schaltkreis
vergleicht seine Erwartung mit einer trägen Kopie von ihr: Steigt die Gefahr, schweigen die
Dopaminzellen schon in diesem Moment; geht sie vorbei, ohne dass es wehtut, feuern sie
stärker (Erleichterung). Eine gleichbleibende Erwartung hebt sich auf.

### Die Hormone

| Stoff | Vorbild | steigt bei | Wirkung |
|---|---|---|---|
| Dopamin | Dopamin | besser als erwartet | schreibt Synapsen fest |
| Vigilin | Noradrenalin | Überraschung, Schmerz | Wachheit; Lernen am besten bei mittlerem Pegel |
| Fokin | Acetylcholin | unvorhersehbaren Ergebnissen | mehr Erkundung, höhere Lernrate |
| Serenin | Serotonin | ruhigen, schmerzfreien Phasen | dämpft Erkundung und Stress |
| Stressin | Cortisol | Stürzen, Misserfolg | bremst das Lernen, wenn dauerhaft hoch |
| Ergin | Hungerhormon | leerer Energiereserve | macht Cookies wertvoller |
| Somnin | Adenosin | Wachzeit, schneller bei viel Lernen | Schlafdruck; je nach Lernstand schläft das Wesen etwa alle 5 bis 12 Minuten |
| Plastin | BDNF | Erfolg | verstärkt das Lernen |

### Gedächtnis, Schlaf und Träume

Der Hippocampus hat zwei Speicher aus „Index-Zellen", die über schnelle Hebb-Synapsen an das
gebunden werden, was beim Einspeichern gerade aktiv ist (ein Erlebnis genügt):

- **Laufversuche.** Bei jedem Sturz wird gespeichert, was der Erkundungs-Kern in diesem Versuch
  ausprobiert hat und ob der Versuch besser oder schlechter lief als erwartet.
- **Hindernisse.** Bei jeder Stufe wird gespeichert, ob die Füße gehoben wurden und ob es gut
  ging.

Ist das Somnin hoch genug, erschlaffen die Muskeln und das Wesen legt sich hin (etwa 45
Sekunden). Wer viel Neues lernt, wird schneller müde: ein Neugeborenes schläft etwa alle 5
Minuten, ein geübter Läufer etwa alle 12. Im Schlaf werden die Laufversuche seit dem letzten
Schlaf einzeln wieder abgespielt (Replay): Die Index-Zellen treiben den Erkundungs-Kern in das
damalige Muster und die Dopamin-Neuronen in den damaligen Ausgang, und die Tonus-Synapsen
lernen daran noch einmal. Über dem schlafenden Wesen zeigt eine Gedankenblase, welcher Versuch
gerade geträumt wird. Nach dem Aufwachen ist dieser Speicher wieder frei.

### Vorhersage

Vier Zellgruppen in der Scheitelrinde versuchen, genauso zu feuern wie vier Sinnessignale
(Rumpf kippt nach vorn, nach hinten, Last auf dem linken, auf dem rechten Fuß), sehen aber
nur, was 50 ms vorher gespürt und getan wurde. Ihre Synapsen lernen mit einer Delta-Regel aus
dem Vorhersagefehler. Ein Fehler weit über dem üblichen Wert meldet dem Hormonsystem eine
Überraschung (Vigilin).

### Sehen und Entscheiden

Das Auge meldet die Entfernung zum nächsten Hindernis. Ein Basalganglien-Schaltkreis kann den
Befehl „Füße anheben" auslösen: Feuert das Striatum stark genug, verstummt das Pallidum, der
Thalamus wird frei und treibt den Befehl. Welche Seheindrücke das Striatum antreiben, wird mit
derselben Dopamin-Regel gelernt. Das Wesen wird unentschlossen geboren (halbe Stärke).

**Inneres Durchspielen.** Solange ein Hindernis in Sicht ist, stellt sich das Gehirn die beiden
Möglichkeiten abwechselnd vor, je eine Achtelsekunde lang (der Takt dafür ist von außen
vorgegeben). Jede Vorstellung ruft die Begegnungen wach, bei denen so gehandelt wurde, und
deren Ausgang. „Heben ging schief" und „Nicht heben ging gut" sammeln sich als Stimme dagegen,
die umgekehrten Fälle als Stimme dafür, und beide wirken auf das Striatum. Die Gedankenblase
über dem Kopf zeigt, was gerade erwogen wird.

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
über das eben Getane aussagt. Sie lernt nichts.

Wie schnell ein einzelnes Leben lernt, schwankt stark. Mit dem aktuellen Stand (mit Sehrinde
und Basalganglien, 5.520 Neuronen) habe ich vier Leben je 24–30 Minuten laufen lassen: Zwei
lernten laufen (nach etwa 17 und 23 Minuten, danach 0–5 Stürze pro Minute und über 100 m am
Stück), zwei stürzten nach 24 bzw. 30 Minuten immer noch 15–18-mal pro Minute. Ein früherer
Lauf im Browser war schon nach etwa 10 Minuten so weit.

Mit dem Stand vor dem Schmerz (Gedächtnis, Schlaf mit Replay, Vorhersage; 6.392 Neuronen) noch einmal
vier Leben, Stürze pro Minute:

| Leben | Minute 1–22 |
|---|---|
| 1 | 21 19 20 19 10 13 17 18 17 13 10 17 17 16 17 4 18 18 17 18 12 |
| 2 | 23 22 19 19 6 13 7 5 1 0 0 0 0 0 0 0 2 0 0 2 1 0 |
| 3 | 19 20 20 17 16 5 16 15 14 17 6 14 12 13 16 16 3 0 17 15 15 18 |
| 4 | 25 24 22 21 10 17 20 19 19 5 18 18 18 17 4 18 17 18 16 6 16 14 |

Eines von vier hat es in dieser Zeit gelernt (ab Minute 9 fast sturzfrei). Vorsicht beim
Lesen: Die einzelnen niedrigen Zahlen der anderen (10, 6, 4 …) sind fast alle Minuten, in
denen das Wesen 30 bis 45 Sekunden geschlafen hat und deshalb gar nicht fallen konnte. Das
gilt genauso für die Replay-Tabelle weiter unten. Eine echte Ausnahme gab es: Leben 3 lief in
Minute 18, direkt nach dem Aufwachen, eine volle Minute ohne Sturz und fiel danach wieder
15-mal pro Minute. Nach dem Schlaf ist die Erkundung niedrig; das deutet darauf hin, dass
starkes Ausprobieren selbst Stürze verursacht, die wiederum die Unsicherheit und damit das
Ausprobieren hochhalten.

Die Erkundung pauschal zu dämpfen (`EXPLORE_SPAN=0.8` statt 1,5; vier Leben, 26 Minuten) hat
das aber nicht gelöst. In wachen Minuten gingen zwei Leben langsam von 20–25 auf 8–14 Stürze
zurück, eines von 25 auf 16–18, und eines stürzte durchgehend 18-mal pro Minute auf dieselbe
Weise, ohne dass sich seine Grundspannung bewegte. Keines wurde sturzfrei, auch nicht das
Leben, das mit 1,5 schon nach 9 Minuten lief. Mit 0,5 (zwei Leben) war es nicht besser. Die
Einstellung steht deshalb wieder auf 1,5. Bei vier Leben je Einstellung ist das alles nur ein
Hinweis, kein Beweis.

**Schmerz, Mandelkern und Cookies im Vergleich** (aktueller Stand, 15.696 Neuronen; je vier
Leben, 15 Minuten, mit Schlaf; `tools/learn-test.ts`, ausgewertet mit
`tools/summarize-lives.cjs`). Stürze pro Minute; in Klammern stehen Minuten, in denen das Wesen
mehr als 10 Sekunden geschlafen hat. „Läuft" heißt: drei wache Minuten hintereinander mit
höchstens 3 Stürzen und auch am Ende noch so.

| Bedingung | Leben | Stürze pro Minute | Ergebnis |
|---|---|---|---|
| feste Sturzstrafe wie früher, mit Cookies | 1 | 15 14 15 13 14 12 12 (4) 12 11 12 10 9 12 (4) | läuft nicht |
| | 2 | 20 15 10 14 5 11 0 (0) (4) 17 15 10 15 16 7 | lief in Minute 7, nach dem Schlaf wieder verlernt |
| | 3 | 21 19 19 17 17 (13) (10) 18 17 18 17 13 (4) 14 11 | läuft nicht |
| | 4 | 21 21 20 14 13 5 (5) 2 0 0 11 4 4 8 1 | lief ab Minute 8, danach unsicher |
| Schmerz (ohne Wirkung des Mandelkerns), mit Cookies | 1 | 16 17 18 18 17 18 17 17 (13) (8) 18 18 17 17 17 | läuft nicht |
| | 2 | 20 20 16 10 0 0 0 0 (0) (0) 0 0 0 1 0 | **läuft ab Minute 5** |
| | 3 | 21 18 19 19 18 18 18 (7) (15) 16 17 15 16 15 15 | läuft nicht |
| | 4 | 20 19 17 18 16 16 17 (6) 16 17 17 17 11 7 6 | läuft nicht (wird besser) |
| Schmerz + Mandelkern, mit Cookies (Voreinstellung) | 1 | 19 5 0 0 0 0 0 0 0 0 0 (0) 0 0 0 | **läuft ab Minute 3** |
| | 2 | 20 19 20 19 17 18 15 (7) 18 18 18 17 18 17 (5) | läuft nicht |
| | 3 | 21 16 12 9 10 9 4 (0) 2 2 3 4 1 1 1 | **läuft ab Minute 9** |
| | 4 | 21 19 20 19 19 18 18 (5) 18 18 18 18 18 18 (5) | läuft nicht |
| Schmerz + Mandelkern, **ohne** Cookies | 1 | 21 22 24 20 13 (4) 10 3 0 0 0 0 1 0 0 | **läuft ab Minute 8** |
| | 2 | 21 21 21 21 21 21 20 (6) 21 21 20 21 21 18 (7) | läuft nicht |
| | 3 | 19 15 14 13 11 12 11 11 (2) 9 7 8 9 3 3 | läuft noch nicht (wird besser) |
| | 4 | 19 17 17 16 16 12 12 12 (3) 11 13 13 12 14 11 | läuft nicht |

Am Ende liefen also 0 von 4 (feste Strafe), 1 von 4 (Schmerz), 2 von 4 (Schmerz + Mandelkern)
und 1 von 4 (nur Schmerz, ohne Cookies). Ein fünftes Leben je Bedingung (nach 13 bis 14
Minuten abgebrochen) lief in keiner der vier Bedingungen: 10 bis 18 Stürze pro Minute am Ende.
Zusammen also 0, 1, 2 und 1 von 5. Was sich daraus ehrlich sagen lässt:

- **Aus Schmerz allein kann das Wesen laufen lernen.** Ein Leben ohne jede Belohnung lief ab
  Minute 8 sturzfrei, ein zweites war auf dem Weg dorthin. Die Cookies sind dafür nicht nötig.
- **Dass Schmerz das Lernen verlässlicher macht, ist damit nicht gezeigt.** Die Unterschiede
  zwischen den Bedingungen (0, 1, 2, 1 von 4) liegen im Bereich dessen, was bei vier Leben der
  Zufall hergibt: Dieselbe feste Strafe hatte in einer früheren Reihe 2 von 4 Leben laufen
  lassen. Mit Schmerz + Mandelkern gab es das bisher schnellste Leben (sturzfrei nach zwei
  Minuten), aber auch zwei, die gar nicht vorankamen.
- **Es bleibt dabei: ungefähr jedes zweite Leben hängt fest.** Auch mit Schmerz.
- Zwei Leben mit fester Strafe konnten schon laufen und verloren es wieder, eines direkt nach
  dem Schlafen mit 38 Träumen. Das passt zu dem Befund, dass Replay eher schadet als nützt.

Gleiche Startwerte sind zwischen den Bedingungen nicht vergleichbar, weil jede Änderung am
Gehirn die Zufallsfolge verschiebt.

**Schmerz selbst** (`tools/pain-test.ts`): Ein ausgereiftes Wesen hat beim Gehen Schmerzkosten
von 0,002 pro Sekunde, ein Neugeborenes 0,16 pro Sekunde, fast nur aus Knie- und
Sprunggelenken. Ein Sturz kostet im Mittel 1,5 bis 2,2 (kleinster gemessener 0,6, größter 4,8)
und lässt die Dopaminzellen 280 bis 650 ms schweigen (mit der festen Strafe: 340 bis 530 ms).

**Mandelkern**: Ob sich ein Sturz ankündigt, habe ich getrennt geprüft. Ein gewöhnlicher
linearer Klassifikator, der nichts mit dem Gehirn zu tun hat, trennt „300 ms vor einem Sturz"
von „mindestens 1 s davor" aus den Feuerraten der Sinnesnerven wie aus der Körperfühlrinde
fast perfekt (AUC 1,00 auf zurückgehaltenen Daten, 104–124 Stürze). Die Information ist also
da. Der Mandelkern selbst nutzt sie bisher nur zum Teil: Nach 5 Minuten lag seine Erwartung
in der halben Sekunde vor einem Sturz bei 0,24 bis 0,28, sonst beim Gehen bei 0,15
(`tools/cortex-test.ts`, ein einziges Leben, ohne Wirkung auf das Dopamin und mit der halben
heutigen Lernrate gemessen). Er unterscheidet
also, aber schwach. Der Schaltkreis dahinter tut, was er soll (`tools/amygdala-test.ts`):
Springt die Erwartung an, fällt die Rate der Dopaminzellen von 14 auf 0 bis 2 Hz und erholt
sich in 300 ms; fällt sie weg, steigt sie kurz auf 20 bis 24 Hz.

**Gedächtnis und Replay** (`tools/memory-test.ts`): Was im Schlaf abgespielt wird, stimmt mit
dem überein, was im Versuch ausprobiert wurde (Korrelation 0,89 bis 0,95 über 85–100 Werte),
und das Dopamin im Traum hat in 12 von 12 bzw. 16 von 17 Fällen das Vorzeichen des damaligen
Ausgangs.

Lernen mit und ohne Replay (je zwei Leben, gleiche Startbedingungen, Stürze pro Minute):

| | Minute 6–10 | Minute 11–15 | Minute 16–18 |
|---|---|---|---|
| Replay stark, Leben 1 | 6 14 14 17 14 | 15 4 9 8 4 | 4 1 0 |
| ohne Replay, Leben 1 | 6 15 10 14 16 | 13 5 10 11 9 | 15 3 2 |
| Replay stark, Leben 2 | 1 12 15 14 16 | 16 7 11 5 12 | 13 12 6 |
| ohne Replay, Leben 2 | 1 6 12 3 1 | 4 3 1 1 7 | 0 6 1 |

(In Minute 6 schlafen alle zum ersten Mal, bis dahin sind die Paare identisch.)

Eine zweite Reihe mit halber Stärke und nur den Erlebnissen seit dem letzten Schlaf ergab
dasselbe Bild: Leben 1 gleichauf (beide nach 17 Minuten noch nicht so weit), Leben 2 ohne
Replay ab Minute 9 fast sturzfrei, mit Replay erst ab etwa Minute 14. Replay verdoppelt hier im Grunde nur Lernschritte, die im Wachen schon
gemacht wurden.

**Vorhersage** (`tools/predict-test.ts`): Der mittlere Vorhersagefehler fällt in 6 Minuten von
0,28 auf 0,13. In der halben Sekunde vor einem Sturz liegt seine Spitze bei 0,22 ± 0,04 (5
Stürze), sonst bei 0,20 ± 0,02 (430 Messungen); nach einem sanften Stoß bei 0,20 gegenüber
0,20 ohne. Das reicht nicht für einen brauchbaren Alarm.

**Inneres Durchspielen** (`tools/obstacle-learn.ts` mit `PRE=14`, je zwei eingelaufene Wesen,
8 Minuten mit Stufen): Mit Erinnerungsabruf sinkt das Anheben der Füße vor Stufen in 2 bis 4
Minuten von halber Stärke auf null; ohne Abruf liegt es nach 8 Minuten noch bei 0,8. Geschafft
wurden mit Abruf 75–79 % der Stufen (ohne: 62–67 %) in einem Paar und 42–64 % (ohne: 55–67 %)
im anderen. Die Entscheidung fällt also schnell, der Nutzen ist nicht gesichert.

Die folgenden älteren Zahlen stammen aus der Zeit vor dem Gedächtnis:

Hindernisse (5–10 cm hohe Stufen, `tools/obstacle-learn.ts`, gereiftes Wesen, je 2 Minuten):

| | geschafft / gestolpert | sonstige Stürze |
|---|---|---|
| Entscheidung eingefroren auf „halb anheben" | 0–3 / 6–10 | 25–31 |
| mit Lernen, nach 10 Minuten | 10–12 / 1–2 | 4–11 |

Gelernt hat es dabei, die Füße **nicht** anzuheben: Der Hochschritt bringt diesen Körper
häufiger aus dem Tritt, als er nützt. In einem zweiten Lauf stieg die Bereitschaft zuerst auf
das Maximum und sank erst danach.

## Was noch nicht geht

- **Der eigene Antrieb ist echt, aber schmal.** Das Wesen entscheidet selbst, ob es läuft,
  ruht oder umdreht, und es überlebt dadurch. Aber: Loslaufen, Hinlegen und Umdrehen führt
  weiter die helfende Hand aus; „der beste Weg" heißt in dieser Welt nur „zum näheren Cookie,
  vorn oder hinten"; Hindernisse gehen in die Wahl nicht ein; und das Lernsignal dafür ist
  eine Formel (die Änderung des Geruchs), nicht das Dopamin der Zellen. Vom Tod hat es keinen
  Begriff – es hat Hunger. Ein schlechter Läufer kann trotz richtigem Antrieb verhungern.
- **Die Innenperspektive ist ein Anfang, kein Ergebnis.** Es gibt jetzt ein Körpermodell mit
  Vergleichszellen und einen globalen Arbeitsraum, der sich in Tests wie einer verhält. Aber
  das Körpermodell unterscheidet Stöße von außen bisher schlechter von eigener Bewegung als
  der rohe Sinn, und der Arbeitsraum trägt noch zu keiner messbaren Fähigkeit bei. Gedächtnis
  für Ereignisfolgen, Selbstmodell und eigenes Handeln aus Bedürfnissen fehlen ganz. Alles
  dazu in [docs/INNENPERSPEKTIVE.md](docs/INNENPERSPEKTIVE.md).
- **Laufen lernt nicht jedes Leben.** In den Messungen schafften es je nach Reihe null bis zwei
  von vier Leben innerhalb von 15 bis 30 Minuten; die anderen bleiben in einer Schleife aus
  Stürzen und Ausprobieren hängen (Zahlen unter „Gemessen"). Schmerz und Mandelkern haben das
  nicht nachweisbar geändert. Wenn ein Leben nach 15 Minuten noch ständig fällt, hilft derzeit
  nur „Neues Leben". Was fehlt, ist eine Erkundung, die sich danach richtet, ob Ausprobieren
  gerade etwas bringt.
- **Gelerntes kann wieder verloren gehen.** Zwei von sechzehn Leben liefen schon und fielen
  danach wieder häufig, eines direkt nach dem Schlaf.
- **Der Mandelkern sieht Stürze erst schwach kommen** (0,24–0,28 gegenüber 0,15), obwohl sie
  sich aus denselben Daten fast perfekt vorhersagen ließen. Vorsichtiger macht er das Wesen
  auch nicht: Seine Erwartung wirkt nur auf das Dopamin, nicht auf die Muskeln.
- **Der Schmerz ist grob.** 14 Stellen, keine Schutzreflexe (das Wesen zieht nichts weg und
  fängt sich nicht ab), und die Richtung des Sturzes wird nicht eigens ausgewertet.
- **Replay bringt bisher keinen Lernvorteil.** Es funktioniert wie beschrieben, aber in zwei
  Messreihen lernten die Leben mit Replay nicht schneller laufen als ohne, bei stärkerer
  Einstellung eher langsamer (Zahlen unter „Gemessen"). Es ist deshalb schwach eingestellt.
- **Der Vorhersagefehler taugt noch nicht als Alarm.** Das Vorwärtsmodell lernt den Gang, aber
  vor einem Sturz steigt sein Fehler nur wenig und einen sanften Stoß erkennt er nicht.
  Entsprechend selten meldet es eine Überraschung. „Vorsichtiger werden" ist nicht eingebaut.
- **Abwägen heißt hier: zwei Möglichkeiten, eine Art von Erinnerung.** Ein Arbeitsgedächtnis,
  Planen über mehrere Schritte oder ein Kortex, der Zusammenhänge lernt, fehlen. Das Wesen
  bleibt auch nicht stehen, um nachzudenken; es wägt im Gehen ab.
- Das Auge ist ein Entfernungsmesser für das nächste Hindernis, kein Bildsehen.
- Der Befehl „Füße anheben" hilft nicht zuverlässig über Stufen. Mit Hindernissen stürzt das
  Wesen deutlich öfter als ohne.
- Das Kleinhirn ist verdrahtet und seine Synapsen lernen, aber es verbessert das Laufen bisher
  nicht messbar. Deshalb ist es abgeschaltet, solange man es nicht einschaltet.
- Das voreingestellte Gehirn hat jetzt 17.440 Neuronen und rund 977.000 Synapsen (zu Beginn
  6.392 und 330.080), mit Kleinhirn rund 30.000 Neuronen. Das ist weiter deutlich unter den anfangs
  angepeilten 100.000 Neuronen. Gut die Hälfte der neuen Zellen ist die Körperfühlrinde,
  deren Verschaltung fest ist; sie lernt selbst nichts.
- Das Stehen ist verkrampft (rund 650 W) und das Loslaufen aus dem Stand gelingt nicht.
- Das Lernen einzelner Reflexbahnen ist zu langsam, um in Minuten sichtbar zu sein.
- Geschwindigkeit auf der Entwicklungsmaschine (ein Kern, `tools/bench-sim.ts`): Das Gehirn
  mit 15.696 Neuronen lief mit dem WebAssembly-Kern in 3,1-facher Echtzeit, mit der
  JavaScript-Schleife in 1,8-facher; mit Kleinhirn (28.248 Neuronen) in 1,9-facher. Mit den
  Teilen für die Innenperspektive (17.024 Neuronen) sind es 2,6-fache Echtzeit. Das alte
  Gehirn mit 6.392 Neuronen kam mit JavaScript auf 3,5-fache, mit WebAssembly auf 5,2-fache
  Echtzeit. Nur die Neuronenschleife ist in WebAssembly; das Verteilen der Spikes auf die
  Synapsen läuft weiter in JavaScript und ist jetzt der größte Posten. 100.000 Neuronen in
  Echtzeit sind damit noch nicht drin.
- Ob WebAssembly in der veröffentlichten Seite überall zugelassen ist, habe ich nicht prüfen
  können. Wenn nicht, läuft automatisch die langsamere JavaScript-Schleife; der Hinweis über
  der Neuronenzahl zeigt, welche es ist.

## Werkzeuge für die Entwicklung

| Befehl | Zweck |
|---|---|
| `npx tsx tools/learn-test.ts <min> 0 1` mit `TONE=0.6` | ein Leben ohne Browser, druckt den Fortschritt je Minute (`SHAM=1` für die Kontrolle) |
| `npx tsx tools/spinal-test.ts out/x.json 0 20` | prüft die angeborene Verschaltung |
| `npx tsx tools/obstacle-learn.ts <min> 1` | Hindernisse: lernt es, wann es die Füße hebt? (`NORECALL=1` ohne Erinnerungsabruf) |
| `npx tsx tools/memory-test.ts`, `tools/predict-test.ts` | Gedächtnis und Replay, Vorwärtsmodell |
| `npx tsx tools/pain-test.ts`, `tools/cortex-test.ts`, `tools/amygdala-test.ts` | Schmerz je Sturz, Körperfühlrinde und was der Mandelkern lernt, Schaltkreis hinter dem Mandelkern |
| `node tools/summarize-lives.cjs out/*.log` | wertet Protokolle von `learn-test` aus (`PAIN=fixed|graded|off`, `AMY_DA=0`, `NOREWARD=1` wählen die Bedingung) |
| `npx tsx tools/exp-autonomy.ts` | eigener Antrieb: läuft es von selbst, findet es die Cookies, überlebt es (`LESION=drive`, `DRV_LR=0`, `TONE=0.6` für Gegenproben und Neugeborene) |
| `npx tsx tools/exp-workspace.ts`, `tools/exp-self-other.ts`, `tools/exp-ablation.ts` | Experimente zur Innenperspektive: Zündung des Arbeitsraums, Selbst gegen Fremd, Abschalten einzelner Teile (`LESION=…`) |
| `npm run build:kernel` | übersetzt `asm/kernel.ts` nach WebAssembly und bettet es ein |
| `npx tsx tools/bench-sim.ts`, `tools/mature-test.ts` | Rechenzeit (`VISTO_JS=1` erzwingt JavaScript), Gang des ausgereiften Wesens |
| `npx tsx tools/tune-reflex.ts`, `tools/shadow.ts`, `tools/tune-spinal.ts` | die „Evolution": Referenzregler optimieren, Rückenmark dagegen kalibrieren, im geschlossenen Kreis feinabstimmen |
| `node tools/shot.cjs out.png`, `node tools/shot-series.cjs` | Screenshots der laufenden Seite |

## Quellen

- H. Geyer, H. Herr (2010): A muscle-reflex model that encodes principles of legged mechanics
  produces human walking dynamics and muscle activities.
- E. Izhikevich (2003): Simple model of spiking neurons. (2007): Solving the distal reward
  problem through linkage of STDP and dopamine signaling.
- I. Fiete, H. S. Seung (2006): Gradient learning in spiking neural networks by dynamic
  perturbation of conductances.
