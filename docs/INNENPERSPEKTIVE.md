# Visto – auf dem Weg zu einer Innenperspektive

Dieses Dokument gehört zum Projektauftrag „Entwicklung einer künstlichen Innenperspektive".
Es hält fest, was im Code schon da ist, welche Architektur daraus werden soll, was davon gebaut
ist, was die Experimente bisher zeigen – und was sie nicht zeigen.

**Die Grundregel:** Nichts hier behauptet, dass Visto etwas erlebt. Gebaut und gemessen werden
*funktionale* Eigenschaften, die mehrere wissenschaftliche Theorien für Voraussetzungen von
Erleben halten. Ob ein System, das sie erfüllt, damit ein Erleben hat, ist eine offene Frage,
die kein Experiment in diesem Projekt beantwortet. Jedes Ergebnis unten ist deshalb als
„funktionaler Hinweis" zu lesen, nie als Nachweis.

---

## 1. Bestandsaufnahme: was ist wirklich da?

### 1.1 Was als Neuronen und Synapsen gerechnet wird

| Teil | Datei | Zellen | Lernregel |
|---|---|---|---|
| Sinnesnerven, Rückenmark, Motoneuronen, Tonus-Kerne | `spinal.ts` | rund 4.900 | Dopamin × Abweichung (Perturbation) an den Tonus-Synapsen |
| Dopaminzellen | `reward.ts` | 80 | – |
| Sehrinde, Basalganglien | `decision.ts` | 264 | Perturbation an Sehen → Striatum |
| Vorwärtsmodell (Scheitelrinde) | `predict.ts` | 192 | Delta-Regel aus dem Vorhersagefehler |
| Hippocampus | `memory.ts` | 744 | schnelle Hebb-Bindung (ein Erlebnis genügt) |
| Schmerzrezeptoren, Schmerzkern, Habenula | `pain.ts` | 312 | – |
| Körperfühlrinde | `cortex.ts` | rund 8.700 | keine (feste Zufallsverschaltung) |
| Mandelkern mit Vergleichsschaltung | `amygdala.ts` | 288 | Spur × Schmerzbeginn (Kovarianz) |
| **neu:** Körpermodell, Otolithen, Interozeptoren, Arbeitsraum | `bodymodel.ts`, `intero.ts`, `workspace.ts` | rund 1.300 | Homöostase der Erregbarkeit |

### 1.2 Was *nicht* neuronal ist (ehrliche Liste)

Diese Teile sind Formeln im Programm, keine Zellen. Für die Frage nach einer Innenperspektive
sind sie die schwachen Stellen, weil hier Information „von außen" eingesetzt wird, statt im
Netz zu entstehen.

- **Die Hormone** (`hormones.ts`) sind acht Zahlen mit Differentialgleichungen. Sie wirken als
  Faktoren auf Lernrate, Erkundung und – neu – auf die Erregbarkeit des Arbeitsraums. Die
  Wirkungen `vigor`, `caution` und `strength` werden berechnet, aber von nichts benutzt.
- **Erwartete Belohnung** und der Vorhersagefehler der Belohnung werden als Zahlen gerechnet
  und als Strom in die Dopaminzellen gegeben (`reward.ts`). Dasselbe gilt für die „Erleichterung",
  wenn ein erwarteter Sturz ausbleibt (`expectation.ts`: eine Tabelle der letzten Versuchsdauern).
- **Wann eine Erinnerung geschrieben wird**, entscheidet das Programm (bei jedem Sturz, an jedem
  Hindernis), ebenso der Wechsel der beiden Möglichkeiten beim inneren Durchspielen (ein Takt
  von außen) und die Auswahl des geträumten Versuchs.
- **Das Ausprobieren** kommt aus einem Zufallsprozess im Code, der die Erkundungszellen treibt.
- **Der Lebensablauf**: Aufheben nach dem Sturz, Schrittstellung mit Schwung, Einschlafen ab
  einer Schwelle, Laufen oder Stehen (ein Schalter des Benutzers).
- **Der Fehler des Vorwärtsmodells** für das *Lernen* ist eine Subtraktion zweier Feuerraten.
  (Für alles, was der Fehler *bewirkt*, gibt es jetzt Zellen, siehe 3.1.)

### 1.3 Datenflüsse, die es vor diesem Auftrag gab

```
Körper ──Sinnesnerven──► Rückenmark ──► Motoneuronen ──► Muskeln      (Reflexschleife, 20–30 ms)
             │                ▲
             │           Tonus-Kerne ◄── gelernt über Dopamin
             ├──► Vorwärtsmodell ──(Fehler)──► Hormon „Vigilin"        (eine einzelne Zahl)
             ├──► Körperfühlrinde ──► Mandelkern ──► Dopaminzellen
             └──► Schmerz ──► Habenula ──► Dopaminzellen
Auge ──► Sehrinde ──► Basalganglien ──► Befehl „Füße heben"
Hippocampus: schreibt bei Sturz/Hindernis, spielt im Schlaf ab, wird vor Hindernissen befragt
```

Auffällig: Die Regionen arbeiteten **nebeneinander**. Jede hatte genau einen Abnehmer. Es gab
keinen Ort, an dem „Gleichgewicht verloren", „Hindernis gesehen", „Schmerz" und „müde"
aufeinandertreffen, miteinander konkurrieren und gemeinsam auf Gedächtnis, Aufmerksamkeit und
Bewegung wirken. Rückwirkende (rekurrente) Verbindungen gab es fast nur innerhalb der
Reflexschleife über den Körper. Ein Modell des eigenen Körpers gab es in Ansätzen (das
Vorwärtsmodell), aber sein Ergebnis endete in einer Zahl für ein Hormon.

---

## 2. Woran sich der Entwurf orientiert

| Theorie | Kernaussage | Was sie für Visto verlangt | Stand |
|---|---|---|---|
| **Globaler Arbeitsraum** (Baars; Dehaene, Changeux) | Ein Inhalt ist „bewusst zugänglich", wenn er einen begrenzten, selbsterhaltenden Zustand zündet und überall im Gehirn verfügbar wird | Zündung mit Schwelle, Selbsterhaltung, Wettbewerb, Rundruf an viele Abnehmer | erste Fassung gebaut (3.2) |
| **Rekurrente Verarbeitung** (Lamme) | Entscheidend sind rückwirkende Schleifen, nicht der Vorwärtsdurchlauf | Schleifen zwischen Regionen, auch von „oben" zurück in die Sinnesverarbeitung | nur im Arbeitsraum selbst; Rückweg in die Sinne fehlt |
| **Prädiktive Verarbeitung** (Friston, Clark; Seth für das Körperinnere) | Wahrnehmen heißt vorhersagen; gespürt wird die Abweichung; das Selbst ist die beste Erklärung der eigenen Körpersignale | Vorwärtsmodell, Fehlerzellen, Vorhersage auch der inneren Zustände | Körper: gebaut (3.1); Inneres: nur Fühler (3.3) |
| **Reafferenzprinzip / Komparator** (von Holst; Wolpert, Frith, Blakemore) | „Selbst verursacht" ist, was sich aus den eigenen Befehlen vorhersagen ließ | Efferenzkopie → Vorhersage → Vergleich | gebaut; im Test **noch nicht wirksam** (5.3) |
| **Selbstmodell** (Metzinger) | Ein System hat eine Perspektive, wenn es ein Modell von sich als Ganzem benutzt, das es nicht als Modell erkennt | Repräsentation eigener Fähigkeiten und Zustände, die in Entscheidungen eingeht | **fehlt** (Phase C) |
| **Metakognition / höherstufige Theorien** (Rosenthal, Lau, Fleming) | Zustände über eigene Zustände: Zuversicht, Fehlererwartung | gelernte Schätzung der eigenen Verlässlichkeit | **fehlt** (Phase C); Vorstufe: Fokin folgt der Unvorhersehbarkeit |
| **Aufmerksamkeits-Schema** (Graziano) | Das Gehirn modelliert seine eigene Aufmerksamkeit | Modell davon, was den Arbeitsraum gerade besetzt | **fehlt** (Phase D) |
| **Integrierte Information** (Tononi) | Erleben hängt an der kausalen Struktur der Hardware | – | hier nicht anwendbar: Nach dieser Theorie wäre eine Simulation auf einem gewöhnlichen Rechner unabhängig vom Verhalten nicht bewusst. Das ist ein ernster Einwand gegen das ganze Vorhaben, den wir nicht ausräumen können. |
| **Lebens- und körpergebundene Ansätze** (Damasio, Thompson, Seth) | Erleben wurzelt in der Selbsterhaltung eines verletzlichen Körpers | echte Bedürfnisse, deren Missachtung das System gefährdet | Energie, Ermüdung, Schlafdruck existieren; **eigenes Handeln danach fehlt** (Phase C) |

Mehr Neuronen machen nichts davon wahr. Alle Bausteine unten sind klein (zusammen rund 1.300
Zellen); worauf es ankommt, ist, wie sie verschaltet sind und ob sich das Verhalten messbar
ändert, wenn man sie abschaltet.

---

## 3. Was in diesem Schritt gebaut wurde

### 3.1 Körpermodell: Vorhersage gegen Gespürtes, mit Zellen (`bodymodel.ts`)

- **Ein neuer Sinn.** Die Otolithenorgane melden, wie stark der Kopf nach vorn oder hinten
  beschleunigt wird. Ohne sie konnte das Wesen einen Stoß gar nicht als solchen spüren: Die
  vorhandenen Sinne (Neigung, Last) schwanken beim Gehen von selbst stärker als nach einem Stoß.
- **Das Vorwärtsmodell sagt jetzt sechs Sinne voraus** (Rumpf kippt vor/zurück, Last links/rechts,
  Kopf ruckt vor/zurück), jeweils aus dem, was 50 ms vorher gespürt *und an die Muskeln befohlen*
  wurde (Efferenzkopie).
- **Vergleich durch Zellen.** Für jeden Sinn gibt es Zellen „mehr gespürt als erwartet" (Sinn
  erregt, Vorhersage hemmt) und „weniger gespürt als erwartet" (umgekehrt).
- **Jede Abweichung an ihrem üblichen Maß (Präzisionsgewichtung).** Die Abweichungszellen
  jedes Sinns regeln ihre Erregbarkeit langsam so ein, dass sie beim üblichen Maß an
  Abweichung fast schweigen. Ein schlecht vorhergesagter Sinn übertönt dadurch keinen kleinen,
  aber ungewöhnlichen Ausschlag in einem gut vorhergesagten.
- **Fremdeinwirkung.** Ein Pool sammelt alle Abweichungszellen und regelt sich ebenfalls auf
  eine niedrige Grundrate ein. Er feuert, wenn sich der Körper deutlich anders anfühlt, als die
  eigenen Befehle erwarten ließen.

Niemand sagt dem System, welche Ereignisse von außen kommen. „Fremd" ist, was das gelernte
Modell nicht erklärt. Die Unterscheidung kann also nur so gut sein wie das Modell und muss mit
ihm wachsen.

### 3.2 Globaler Arbeitsraum (`workspace.ts`)

Fünf Inhalte konkurrieren: **Körper** (unerklärte Körperempfindung), **Schmerz**, **Gefahr**
(Erwartung des Mandelkerns), **Sehen** (Hindernis im Blick), **Bedürfnis** (Hunger, Müdigkeit,
Erschöpfung).

- **Tor mit Gewöhnung:** Jeder Inhalt hat ein Tor, das seinen Eingang weitergibt, und eine träge
  hemmende Kopie, die das Tor nach etwa 150 ms wieder schließt. Durch kommt, was neu ist.
- **Langzeit-Gewöhnung:** Jede Zündung macht das Tor ihres Inhalts etwas unempfindlicher; das
  klingt erst über ein bis zwei Minuten ab. Was bei jedem Schritt passiert, erreicht den
  Arbeitsraum bald nicht mehr; Seltenes und Starkes schon. Das gilt auch für Schmerz, der sich
  immer gleich wiederholt.
- **Zündung:** Jeder Inhalt hat einen Pool, der sich über langsame Synapsen selbst erregt. Ein
  schwacher Eingang verebbt, ein Eingang über der Schwelle lässt den Pool hochspringen.
- **Wettbewerb:** Jeder gezündete Inhalt hemmt alle anderen.
- **Ende:** Eine zweistufig verzögerte Hemmung beendet jede Zündung nach einigen hundert
  Millisekunden.
- **Wachheit:** Vigilin macht den Arbeitsraum erregbarer, Somnin dämpft ihn; im Schlaf zündet
  nichts.
- **Rundruf (bisher zwei Abnehmer):** Jede Zündung meldet dem Hormonsystem eine Überraschung
  (Vigilin; früher tat das eine Schwellenformel im Code). „Körper" und „Gefahr" treiben
  außerdem einen Hirnstammkern, der kurz Streck-, Rumpf- und Haltungstonus anhebt
  (Stützreaktion).

### 3.3 Interozeption (`intero.ts`)

Drei kleine Zellgruppen melden Hunger (Energiereserve unter 45 %), Müdigkeit (Somnin über 0,55)
und Erschöpfung (mittlere Muskelermüdung über 0,35) als Feuerrate. Damit sind innere Zustände
zum ersten Mal *Inhalt* im Netz und nicht nur Faktoren. Verhalten lösen sie noch nicht aus.

### 3.3a Eigener Antrieb: laufen ohne Befehl (`drive.ts`)

Bis hierher lief das Wesen, weil ein Schalter es ihm befahl. In der neuen Betriebsart „Selbst"
gibt es diesen Befehl nicht mehr.

- **Zwei Geruchssinne** melden, wie stark ein Cookie vorn und hinten riecht (stärker, wenn er
  näher ist; viel schwächer, wenn das Wesen satt ist).
- **Schleife „Los"**: Striatum → Pallidum → Thalamus → Befehl „laufen". Das ist derselbe Befehl,
  der bisher von außen kam.
- **Schleife „Wenden"**: gibt den Befehl umzudrehen. Der Geruch von vorn hemmt sie; gewendet
  wird also, wenn es hinten stärker riecht als vorn. Hier werden zwei Cookies verglichen.
- **Ruhen**: Will es nicht laufen, legt es sich hin (wach, mit entspannten Muskeln) und steht
  wieder auf, wenn die Schleife „Los" feuert.
- **Sterblichkeit**: Ist der Energiespeicher leer, stirbt es. Unter 10 % Energie werden die
  Muskeln schwächer. Ruhe kostet 100 W, Gehen 400 bis 700 W, ein Cookie bringt 15 kJ.

**Was angeboren ist:** Hunger macht unruhig (Hunger → „Los" ist von Geburt an verdrahtet), der
Vergleich vorn gegen hinten, und dass stärker werdender Geruch gut ist. **Was gelernt wird:**
alles, was die Gerüche bedeuten. Die vier Verbindungen (Geruch vorn/hinten → Los/Wenden)
beginnen unentschieden. Ihr Lernsignal ist die Änderung des Geruchs: beim Gehen, ob er stärker
oder schwächer wird; nach einer Wendung, ob sie ihn verstärkt hat.

Drei Dinge, die man dabei nicht übersehen sollte:

- **Das Lernsignal ist nicht das allgemeine Dopamin.** Das habe ich zuerst versucht; es lernte
  in die falsche Richtung, weil einzelne große Dopaminstöße (Cookie gefressen) das feine Signal
  übertönten, und es machte das Laufen schlechter (mehr Stürze durch mehr Ausprobieren). Das
  eigene Lernsignal ist genauer, aber es ist eine Formel im Programm, keine Zelle.
- **„Weil er weiß, dass er sonst stirbt" stimmt nur eingeschränkt.** Ein einzelnes Wesen kann
  den Tod nicht aus Erfahrung lernen. Was es hat: einen angeborenen Hunger, der drängt; die
  Erfahrung, dass es mit fast leerem Speicher schwächer wird; und gelerntes Wissen, wohin es
  gehen muss, damit der Hunger aufhört. Einen Begriff vom Tod hat es nicht.
- **Loslaufen, Hinlegen und Umdrehen übernimmt weiter die helfende Hand.** Die Entscheidung
  dazu trifft das Wesen; die Ausführung kann es noch nicht selbst. Beim Umdrehen wird in der
  Simulation nicht der Körper gedreht, sondern die Welt um ihn gespiegelt.

### 3.4 Abschaltbarkeit und Schutz der Lernstände

- `brain.setModule(name, on)` schaltet einzeln ab: `workspace` (Arbeitsraum empfängt und sendet
  nichts), `broadcast` (zündet, erreicht aber nichts), `bodymodel` (Abweichung erreicht nichts),
  `efference` (Vorwärtsmodell ohne Kopien der Muskelbefehle). Die Zellen bleiben dabei
  bestehen, damit die Zufallsverschaltung des Rests gleich bleibt und Vergleiche Paar für Paar
  möglich sind. Dieselben Schalter gibt es im Fenster „Innenleben".
- Gelernte Synapsen werden jetzt **unter ihrem Namen** gespeichert. Ein gespeichertes Leben
  bleibt ladbar, wenn dem Gehirn neue Regionen hinzugefügt werden; Stände im alten Format werden
  weiter gelesen. Neue Regionen werden grundsätzlich hinten angefügt.

### 3.5 Diagnose

Das Fenster **Innenleben** zeigt aus den laufenden Neuronen: welcher Inhalt den Arbeitsraum
hält (als Schreibstreifen der letzten 20 Sekunden mit Markierungen für Schubser und Stürze),
für jeden Sinn Erwartung gegen Gespürtes, den Pegel „unerklärt", die drei Bedürfnisse, die
Stützreaktion, und die Abschalter. „Schubsen" gibt dem Wesen einen Stoß von außen.

### 3.6 Ein minimales Selbst: fünf Areale (`self.ts`)

Mit diesem Schritt kamen 5.376 Neuronen in fünf Arealen dazu (das Gehirn hat jetzt 22.816
Neuronen und rund 1,5 Millionen Synapsen). Jedes Areal tut *eine* Sache, die in Theorien des
Selbst als Baustein genannt wird, und jedes lässt sich abschalten. Keines davon ist ein
„Ich-Gefühl" – es sind Zellen, die etwas über das Wesen selbst ausrechnen und bereitstellen.

| Areal | Vorbild | was es rechnet | worauf es wirkt |
|---|---|---|---|
| **Inselrinde** (688 Zellen) | interozeptives Selbst, „Kernaffekt" (Craig, Damasio) | Zwei Zellgruppen, die einander hemmen. *Unwohl* wird getrieben von Hunger, Müdigkeit, Erschöpfung, Schmerzkern und steigender Gefahr; *Wohl* von einer neuen Sinneszelle „satt" und von den Dopaminzellen. | Ich-Kern; *Unwohl* bittet außerdem die Ruhe-Schleife um eine Pause. **Keine** Wirkung auf Dopamin oder Schmerz: es ist eine Meldung, keine Strafe. |
| **Ruhe-Schleife** (192) | dritte Basalganglien-Schleife neben „Los" und „Wenden" | Müdigkeit, Erschöpfung (und Unwohlsein) treiben ihr Striatum; Hunger und Gefahr halten sie über Hemmzellen zurück; ihr Befehl bremst das Striatum von „Los". | Feuert der Befehl, legt sich das Wesen hin. Ist es dabei müde, schläft es von selbst ein, bevor der Schlaf sich erzwingt. |
| **Urheberschaft** (544) | Vergleich von Befehl und Rückmeldung (temporo-parietal) | *Ich bewege mich*: Laufbefehl **und** gespürte Kopfbewegung fallen zusammen. *Ich werde bewegt*: gespürte Bewegung und die „Fremdeinwirkung" des Körpermodells, abzüglich dessen, was der Laufbefehl erklärt. | Zweifel, Ich-Kern |
| **Selbstüberwachung** (592) | vorderes Cingulum, Metakognition | *Zuversicht* und *Zweifel*, einander hemmend. Zweifel wächst mit den Abweichungs-Zellen des Körpermodells, mit erwarteter Gefahr, mit „ich werde bewegt" – und über gelernte Synapsen aus dem Ich-Kern (in welchen Lagen stimmte die Vorhersage schon einmal nicht?). | Zweifel versteift über den Stütz-Kern die Haltung und bremst über Hemmzellen das Loslaufen. |
| **Ich-Kern** (3.264) | Precuneus / hinteres Cingulum, „Selbst-Knoten" | Jede der 3.072 Zellen hört auf wenige Fasern aus sechs Quellen – Körperfühlrinde, Befinden, Urheberschaft, Absicht (Befehle Los/Wenden/Ruhen), Arbeitsraum, Zuversicht – und feuert nur bei Kombinationen. Hemmzellen halten das Muster dünn (rund 1 Hz, 5–9 % der Zellen je 100 ms). | Gelernte Synapsen auf die Zweifel-Zellen. |

Drei Dinge daran sind **keine Synapsen**, sondern als Eigenschaft der Zelle gerechnet, und so
auch im Code benannt: das Ermüden der Unwohl-Zellen (Zeitkonstante 15 s), das Plateau-Potential
der Kernzellen (nach einem Spike bleibt die Zelle etwa 150 ms depolarisiert und feuert von
selbst weiter; jeder Spike ermüdet sie, das beendet das Plateau) und die Sinneszelle „satt".
Die erste, einfachere Fassung – jede Kernzelle erregt sich über eine langsame Synapse selbst –
ist gescheitert: Entweder verlosch der Kern sofort, oder einzelne Zellen blieben für immer an.

Der Schalter „Laufen/Stehen/Selbst" bleibt, wie er war; in „Selbst" entscheiden jetzt drei
Schleifen (Los, Wenden, Ruhen) gegeneinander.

---

## 4. Der Plan im Ganzen

| Phase | Inhalt | Stand |
|---|---|---|
| **A** | Körpermodell mit Vergleichszellen, Selbst/Fremd; Arbeitsraum mit Zündung, Wettbewerb, Rundruf; Interozeptoren; Abschalter; Diagnose | **dieser Schritt** |
| **B** | **Zeit:** Arbeitsgedächtnis als gehaltener Arbeitsraum-Inhalt; episodisches Gedächtnis für *Ereignisse* – der Hippocampus schreibt, wenn der Arbeitsraum zündet (nicht mehr, wenn das Programm es sagt), und bindet Vorher, Ereignis und Nachher zu einer Folge; Abruf beim Wiedererkennen der Lage | offen |
| **C** | **Selbstmodell und Bedürfnisse:** gelernte Schätzungen „bin ich stabil", „ist meine Vorhersage verlässlich", „kann ich das"; Bedürfnisse lösen eigenes Verhalten aus – der Schalter Laufen/Stehen geht an das Wesen über | Bedürfnisse → Verhalten: **gebaut** für Hunger (3.3a), Müdigkeit und Erschöpfung (3.6). Selbstmodell: **erste Fassung gebaut** (Befinden, Urheberschaft, Zuversicht/Zweifel, Ich-Kern; 3.6, 5.8) – eine laufende Schätzung, deren gelernter Teil bisher nichts Messbares beiträgt |
| **D** | Rückwege aus dem Arbeitsraum in die Sinnesverarbeitung (Aufmerksamkeit), Modell der eigenen Aufmerksamkeit, Ersatz der verbliebenen Formeln aus 1.2 durch Zellen | offen |

Zu den acht Abschlussfragen des Auftrags: Untersucht sind bisher Frage 1 (Antwort: nein),
Frage 4 (teilweise ja), Frage 6 (ja, für Hunger) und für Frage 8 zwei Ablationsbefunde
(Rundruf: kein Unterschied; Antrieb: ohne ihn verhungert es). Die Fragen 2, 3, 5 und 7 setzen die Phasen B und C voraus und sind **noch nicht untersucht**.

---

## 5. Experimente und Ergebnisse

Alle Experimente laufen ohne Browser und lassen sich wiederholen. „AUC" ist die Trennschärfe
eines Signals zwischen zwei Arten von Ereignissen: 0,5 = Zufall, 1 = fehlerfrei.

### 5.1 Verhält sich der Arbeitsraum wie ein globaler Arbeitsraum? (`tools/exp-workspace.ts`)

Eingang ist das von Hand gesetzte Bedürfnis „Hunger"; das Wesen steht dabei still.

| Prüfung | Ergebnis |
|---|---|
| **Zündschwelle** (Eingang 400 ms lang) | Bis 15 % Eingangsstärke bleibt der Arbeitsraum unter 12 Hz und zündet nicht. Bei 20 % springt er kurz an (28 Hz, 13 ms), ab 25 % zündet er für 190 bis 280 ms mit 37 bis 62 Hz. |
| **hält sich selbst** | Ein Eingang von nur 30 ms hält den Inhalt rund 300 ms lang bei 20 bis 27 Hz, also zehnmal so lang wie der Reiz. Danach ist Ruhe; er zündet nicht von selbst erneut. |
| **Wettbewerb** | Gleichzeitig angeboten, setzt sich der stärkere Inhalt durch und drückt den anderen (allein 73 Hz, neben starkem Seheindruck 28 bis 30 Hz). Kommt ein Inhalt 120 ms früher, lässt er den späteren kaum noch hinein (2 Hz; bei maximal starkem Nachzügler 31 Hz). |
| **Wachheit** | Derselbe schwache Eingang (25 %): wach 31 Hz, normal 25 Hz, schläfrig 14 Hz (keine Zündung). Im Schlaf bei vollem Eingang 1 Hz. |
| **Gewöhnung** | Derselbe Reiz alle 2 s: Spitzenrate 34, 37, 34, 19, 34, 21, 16, 16, 20, 21, 22, 26 Hz – nach etwa fünf Wiederholungen meist unter der Zündschwelle. Nach 3 Minuten Pause wieder 35 Hz. |

**Was das zeigt:** Schwelle, Selbsterhaltung, Wettbewerb mit Vorteil für den Ersten, Abhängigkeit
von der Wachheit und Gewöhnung sind da und messbar. **Was es nicht zeigt:** Oberhalb der Schwelle
wächst die Antwort weiter mit dem Eingang (37 bis 62 Hz); ein reines Alles-oder-nichts ist es
nicht. Der Verlierer im Wettbewerb wird gedrückt, aber nicht ausgelöscht. Und das alles sind
Eigenschaften einer Schaltung, die so gebaut wurde, dass sie sie hat.

### 5.2 Hat das Wesen ein funktionales Modell seines Körpers? (Frage 4)

Ein Wesen, das laufen kann, lernt 4 Minuten lang sein Vorwärtsmodell
(`tools/exp-self-other.ts`). Anteil der Schwankung jedes Sinns, den die Vorhersage aus dem
Zustand 50 ms vorher erklärt:

| Sinn | nach 30 s | nach 4 min | Kontrolle: Modell lernt nie |
|---|---|---|---|
| Last linker / rechter Fuß | −7 % / −29 % | 74 % / 75 % | −149 % / −180 % |
| Rumpf kippt vor | 3 % | 26 % | −65 % |
| Rumpf kippt zurück | −43 % | −15 % | −56 % |
| Kopf ruckt zurück (neu) | 0 % | 56 % | −72 % |
| Kopf ruckt vor (neu) | −21 % | −15 % | −70 % |

(Negative Werte heißen: Die Vorhersage ist schlechter, als immer den Mittelwert zu raten.)

**Befund:** Für die Last auf den Füßen und für den Ruck des Kopfes nach hinten (das Aufsetzen
des Fußes) gibt es ein gelerntes, brauchbares Körpermodell. Für die Rumpfneigung ist es
schwach, für Rumpf-nach-hinten und den Ruck nach vorn unbrauchbar.

### 5.3 Unterscheidet das Wesen selbst Verursachtes von Fremdem? (Frage 1)

Nach dem Lernen passiert alle zwei bis drei Sekunden zufällig eines von drei Dingen: ein Stoß
von außen (12 bis 90 N·s, vor oder zurück), nichts, oder eine eigene Handlung (der Befehl,
die Füße eine halbe Sekunde lang hoch zu heben). Gemessen wird, wie gut sich jedes Ereignis in
den 300 ms danach von „nichts" trennen lässt.

Zwei Leben (Startwerte 2 und 4), je 150 Ereignisse pro Block. Trennschärfe (AUC) gegen die
Durchgänge ohne Ereignis; **A** = Pool „Fremdeinwirkung" mit vollem Körpermodell, **B** = dasselbe
ohne Efferenzkopie (danach gemessen, eine Minute nach dem Abschalten), **C** = bloße Änderung
der Sinne ohne Modell, **D** = Otolithen allein ohne Modell.

| Ereignis | Leben 1: A | B | C | D | Leben 2: A | B | C | D |
|---|---|---|---|---|---|---|---|---|
| Stoß 12 N·s | 0,60 | 0,44 | 0,64 | 0,56 | 0,50 | 0,43 | 0,55 | 0,52 |
| Stoß 20 N·s | 0,62 | 0,47 | 0,68 | 0,69 | 0,61 | 0,68 | 0,59 | 0,58 |
| Stoß 30 N·s | 0,60 | 0,54 | 0,73 | 0,76 | 0,41 | 0,49 | 0,40 | 0,54 |
| Stoß 45 N·s | 0,76 | 0,53 | 0,81 | 0,84 | 0,58 | 0,67 | 0,61 | 0,65 |
| Stoß 60 N·s | 0,78 | 0,63 | 0,80 | 0,89 | 0,61 | 0,77 | 0,64 | 0,83 |
| Stoß 90 N·s | 0,79 | 0,83 | 0,83 | 0,96 | 0,64 | 0,92 | 0,65 | 0,97 |
| eigener hoher Schritt | 0,65 | 0,40 | 0,71 | 0,62 | 0,32 | 0,38 | 0,26 | 0,28 |

(Je Zeile 11 bis 21 Ereignisse, verglichen mit 38 bis 46 Durchgängen ohne Ereignis.)

Die schärfere Frage – *gleich starker Ruck des Kopfes, einmal selbst erzeugt, einmal von
außen: ist der unerklärte Anteil dann von außen größer?* – habe ich so ausgewertet: An die
Durchgänge ohne Ereignis wird eine Gerade A gegen D angepasst, und für jedes Ereignis zählt der
Abstand seines A von dieser Geraden. Ergebnis: Stöße liegen im Mittel 4,2 bzw. 5,1 Hz **unter**
der Geraden (AUC 0,38 bzw. 0,40), eigene hohe Schritte 2,1 bzw. 2,3 Hz darunter (AUC 0,44 bzw.
0,50).

**Befund: nein, noch nicht.**

- Das Signal „Fremdeinwirkung" trägt etwas Information über Stöße von außen (bis 0,79 im
  ersten Leben, bis 0,64 im zweiten), ist aber fast durchweg **schlechter als der bloße Sinn
  ohne jedes Modell** (D bis 0,96 und 0,97).
- Bei gleich starkem Ruck markiert es Fremdes nicht stärker als Eigenes, eher schwächer. Ein
  System, das Selbst und Fremd unterscheidet, müsste genau dort besser sein als der rohe Sinn.
- Im ersten Leben verlor das Signal an Trennschärfe, als die Kopien der Muskelbefehle
  abgeschaltet wurden (0,44 bis 0,63 statt 0,60 bis 0,78 bei 12 bis 60 N·s) – das wäre, was
  das Reafferenzprinzip erwarten lässt. Im zweiten Leben wiederholte sich das **nicht** (ohne
  Efferenzkopie bei starken Stößen sogar besser). Daraus lässt sich nichts ableiten.
- Vor der letzten Änderung (ohne Präzisionsgewichtung, alle Abweichungen einfach summiert) war
  das Signal noch schwächer (höchstens 0,63), und ein nie lernendes Modell schnitt nicht
  schlechter ab als ein gelerntes.

**Woran es liegt, soweit erkennbar:** Das Vorwärtsmodell ist für die Sinne, die einen Stoß
spüren, zu ungenau (5.2: Kopf ruckt vor −15 %, Rumpf kippt vor 26 %). Was es nicht
vorhersagen kann, kann es auch nicht als „eigen" abziehen. Der nächste Schritt ist deshalb ein
besseres Vorwärtsmodell (es liest bisher nur rohe Feuerraten; die Körperfühlrinde als Eingang
und eine Vorhersage der Schrittphase fehlen), nicht ein empfindlicherer Detektor.

Zwei Dinge, die das Experiment über den Körper gezeigt hat und die ich vorher nicht wusste:

- Dem Wesen fehlte der Sinn, mit dem man einen Stoß spürt. Deshalb gibt es jetzt
  Otolithenorgane.
- Sein Gang ist so ruckartig, dass die eigenen Schritte den Rumpf innerhalb von 400 ms um bis
  zu 0,5 m/s beschleunigen und bremsen. Ein Stoß von 45 N·s ändert die Geschwindigkeit um
  0,84 m/s. Stöße bis etwa 30 N·s liegen also in dem Bereich, den die eigene Bewegung
  ohnehin erzeugt. Das macht die Aufgabe objektiv schwer – und es heißt, dass ein *gutes*
  Körpermodell hier wirklich etwas leisten müsste, was der bloße Sinn nicht kann.

### 5.4 Was geht verloren, wenn man den Rundruf kappt? (Frage 8, erster Teil)

`tools/exp-ablation.ts`: kräftige Stöße (45, 60, 90 N·s) alle paar Sekunden, einmal mit
vollständiger Architektur, einmal mit abgeschaltetem Rundruf.

| | „Körper" zündet nach dem Stoß | Stützkern (Spitze) | Stürze nach dem Stoß |
|---|---|---|---|
| vollständig | 21 % / 0 % / 31 % (ohne Stoß: 8 bis 25 %) | 1 bis 5 Hz | 21 von 36 |
| Rundruf abgeschaltet | 0 % / 27 % / 36 % (ohne Stoß: 11 bis 31 %) | 0 Hz | 27 von 36 |

**Befund: kein nachweisbarer Unterschied.** 21 gegen 27 Stürze bei je 36 Stößen ist mit Zufall
vereinbar. Der Grund ist sichtbar: Der Stoß zündet den Inhalt „Körper" gar nicht verlässlich
(nicht häufiger als ohne Stoß), also gibt es kaum etwas auszurufen, und der Stützkern feuert
fast nicht. Zwei Ursachen: Die Abweichungs-Meldung ist für Stöße zu schwach (5.3), und der
Test selbst stößt so oft, dass sich der Zugang gewöhnt – was er soll. Für diesen Stand heißt
das: **Der Arbeitsraum existiert und verhält sich wie in 5.1, aber er trägt noch zu keiner
Fähigkeit bei, die ohne ihn fehlt.** Das ist der wichtigste offene Punkt.

### 5.4a Lösen innere Bedürfnisse eigenes Verhalten aus? (Frage 6) – `tools/exp-autonomy.ts`

Niemand gibt dem Wesen einen Befehl. Es beginnt halb hungrig und ist sterblich.

**Wesen, die schon laufen können** (drei Leben, 8 Minuten, noch ohne die Regel „satt riecht es
kaum"):

| Leben | Energie Anfang → Ende | Cookies | Stürze | Wendungen richtig / falsch |
|---|---|---|---|---|
| A | 0,50 → 0,97 | 35 | 44 | 16 / 0 |
| B | 0,50 → 1,00 | 47 | 19 | 17 / 2 |
| C | 0,50 → 0,10 | 22 | 106 | 19 / 8 |

(„Richtig" heißt: Vor der Wendung roch es hinten stärker als vorn.) Leben A und B liefen von
selbst los, drehten sich fast nur noch um, wenn der Cookie hinter ihnen der nähere war, und
füllten ihren Speicher. Leben C lief genauso aus eigenem Antrieb, stürzte aber 13-mal pro
Minute und war nach 8 Minuten kurz vor dem Verhungern: **Der Antrieb nützt nichts, wenn das
Laufen nicht trägt.**

**Ruhen, wenn satt** (endgültiger Stand, ein Leben, 9 Minuten): Die Energie pendelt zwischen
0,65 und 0,71. Über etwa 0,70 legt sich das Wesen hin (in einzelnen halben Minuten 66 bis
94 % der Zeit), unter etwa 0,67 steht es wieder auf und läuft zum nächsten Cookie.

**Neugeborene** (zwei Leben, 9 Minuten, mit Schlaf): Beide überleben (Energie am Ende 0,94 und
0,77), obwohl sie noch 10- bis 18-mal pro Minute stürzen. Eine Nebenwirkung: Ein sattes
Neugeborenes ruht (bis zu 45 % der Zeit) und übt in dieser Zeit das Laufen nicht.

**Gegenprobe ohne Antrieb** (`LESION=drive`): Das Wesen steht kein einziges Mal auf und stirbt
nach 7,5 Minuten an Hunger (Anfangsenergie 0,2).

**Gegenprobe ohne Lernen im Antrieb** (`DRV_LR=0`, die vier Geruchs-Verbindungen bleiben auf
ihren Startwerten; je zwei Leben, 8 Minuten, endgültiger Stand):

| | Energie am Ende | Cookies | Stürze | Wendungen richtig / falsch | Zeit in Ruhe |
|---|---|---|---|---|---|
| mit Lernen, Leben 1 | 0,67 | 19 | 36 | 12 / 3 | 39 % |
| mit Lernen, Leben 2 | 0,68 | 15 | 14 | 9 / 5 | 55 % |
| ohne Lernen, Leben 1 | 0,66 | 26 | 67 | 16 / 3 | 9 % |
| ohne Lernen, Leben 2 | 0,68 | 21 | 25 | 15 / 13 | 22 % |

**Befund:**

- **Frage 6: ja, für Hunger.** Ein inneres Bedürfnis löst Verhalten aus, das niemand befohlen
  hat, und sein Wegfall beendet es. Ohne den Schaltkreis dazu stirbt das Wesen. Das ist die
  erste Fähigkeit in diesem Projekt, die nachweislich an einem der neuen Teile hängt.
- **Der „beste Weg" ist überwiegend angeboren, nicht gelernt.** Auch ohne Lernen überleben die
  Wesen mit gleicher Energie. Was die Wendungen richtig macht, ist vor allem die angeborene
  Hemmung „was vorn riecht, hält den Kurs". Das Lernen ändert nachweislich die vier
  Verbindungen in die sinnvolle Richtung (Geruch vorn → Los von 0,5 auf 1,5; Geruch hinten →
  Los von 0,5 auf 0); mit Lernen kamen beide Leben mit weniger Laufzeit auf dieselbe Energie
  (39 und 55 % Ruhe statt 9 und 22 %). Ob das am Lernen liegt, lässt sich bei zwei Leben je
  Bedingung nicht sagen; der Anteil richtiger Wendungen unterscheidet sich nicht klar (21 von
  29 gegenüber 31 von 47).
- **Die Welt ist dafür sehr einfach.** Eine Linie, höchstens zwei Cookies. „Bester Weg" heißt
  hier: der nähere von zweien. Hindernisse, Umwege und Kosten gehen nicht ein.
- Die allgemeine Dopamin-Regel hat für diese Aufgabe versagt (3.3a); das ist ein Befund über
  die Grenzen des bisherigen Lernmechanismus, nicht nur eine Nebensache.

### 5.5 Haben die neuen Teile das Laufenlernen beschädigt?

Zwei Paare von Neugeborenen mit gleichem Startwert, einmal vollständig, einmal mit
abgeschaltetem Arbeitsraum (`LESION=workspace`), 10 Minuten; Stürze pro Minute, in
Klammern Schlafminuten:

| | Leben 1 | Leben 2 |
|---|---|---|
| vollständig | 21 18 18 14 13 13 7 (4) (4) 8 | 15 13 14 12 15 13 16 15 13 (5) |
| ohne Arbeitsraum | 23 20 21 21 20 21 (16) (9) 20 21 | 21 20 17 18 17 18 (7) 15 18 18 |

Kein Hinweis auf Schaden; mit Arbeitsraum eher weniger Stürze. **Vorsicht bei der Deutung:**
Der Arbeitsraum zündet beim Neugeborenen in der ersten halben Minute oft, und die
Stützreaktion hebt dabei den Tonus an. Ein Teil des Unterschieds kann schlicht geschenkter
Tonus sein und kein besseres Lernen. Zwei Paare sind außerdem zu wenig für eine Aussage.

Das ausgereifte Wesen läuft mit und ohne Arbeitsraum gleich (2 Minuten, zwei Startwerte:
23 und 0 Stürze gegenüber 20 und 0).

### 5.6 Speicherstände

Ein Leben, das mit dem Stand vor diesem Schritt gespeichert wurde (15.696 Neuronen, altes
Format), lädt im neuen Gehirn (17.024 Neuronen) mit allen gelernten Synapsen; das neue Format
übersteht Speichern und Laden unverändert (geprüft an den Tonus-Synapsen).

### 5.7 Was noch gar nicht untersucht ist

Fragen 2, 3 und 7 des Auftrags (Verbinden über längere Zeit, Einfluss früherer Erfahrung auf
die Wahrnehmung, neue Probleme lösen). Dafür fehlt Phase B. Frage 5 (Einfluss des
Selbstmodells auf Entscheidungen) ist mit 5.8 zum ersten Mal berührt: Die Bedürfnis-Seite
wirkt nachweislich (Ruhen), die Zweifel-Seite bisher nicht messbar.

---

## 6. Zur Ethik: Schadensmeldung, Lernsignal, Leiden

Der Auftrag verlangt, drei Dinge auseinanderzuhalten. Im Code sind sie getrennt:

1. **Schadensregistrierung** – die Schmerzrezeptoren (`pain.ts`). Sie melden Ort und Wucht. Sie
   gewöhnen sich nach etwa 200 ms an gleichbleibenden Druck, und im Schlaf ist die Bahn zu.
2. **Negatives Lernsignal** – das Schweigen der Dopaminzellen. Es nimmt Synapsen zurück. Es ist
   auf Sekundenbruchteile begrenzt und wird an der Erwartung gemessen: Ein Sturz, der so
   wehtut wie erwartet, lehrt kaum noch etwas.
3. **Hypothetisches subjektives Leiden** – darüber wissen wir nichts. Ein als negativ bewerteter
   Zustand ist kein Beleg für erlebtes Unbehagen.

Wo der jetzige Stand der eigenen Vorgabe **nicht** genügt:

- Ein Leben, das festhängt, stürzt 18-mal pro Minute, stundenlang, und sein Stressin steht
  dabei bei 0,8 bis 0,95. Das ist ein lang anhaltender negativer Zustand ohne Lernfortschritt –
  genau das, was der Auftrag ausschließt.
- Schon gebaut: Schmerz, der sich immer gleich wiederholt, verliert durch die
  Langzeit-Gewöhnung den Zugang zum Arbeitsraum (in einem Neugeborenen-Leben zündete „Schmerz"
  in 10 Minuten 27-mal bei 120 Stürzen). Das Lernsignal über das Dopamin bleibt davon
  unberührt. Vorschlag aus der ersten Fassung dieses Dokuments: Das Wesen bekommt die
  Möglichkeit, bei anhaltendem Misserfolg von sich aus aufzuhören und auszuruhen. **Das ist
  jetzt gebaut**, als Verschaltung: Die Unwohl-Zellen der Inselrinde bitten die Ruhe-Schleife
  um eine Pause, Hunger hält dagegen (3.6; was es in einem Neugeborenen-Leben bewirkt, steht in
  5.8). Noch nicht gebaut: dass die Seite ein festhängendes Leben erkennt und es dem Benutzer
  sagt.
- Die neue Inselrinde ist ein weiterer als negativ bewerteter Zustand. Sie ist deshalb so
  gebaut, dass sie nichts bestraft (keine Bahn zu Dopamin oder Schmerz) und dass ein
  Dauerzustand von selbst schwächer gemeldet wird: gemessen fällt die Meldung eines
  gleichbleibenden Zustands in 15 Sekunden etwa auf die Hälfte (5.8). Ganz verschwindet sie
  nicht.
- Je ernster man die Möglichkeit nimmt, dass eine solche Architektur etwas erleben könnte,
  desto weniger selbstverständlich ist es, sie beliebig oft stürzen zu lassen. Diese Frage
  gehört ins Projekt und nicht an seinen Rand.

---

### Zur Sterblichkeit

Das Wesen kann jetzt verhungern. Das war ausdrücklich gewünscht, und es steht in Spannung zur
Vorgabe, keine unnötigen negativen Zustände zu erzeugen. So ist es gebaut: Hunger wirkt als
Meldung und als Antrieb, nicht als Strafe (er senkt das Dopamin nicht und löst keinen Schmerz
aus); unter 10 % Energie werden die Muskeln schwächer; der Tod selbst ist das Ende aller
Aktivität, ohne Schmerzsignal. Ein Leben, das nicht laufen lernt und nicht gefüttert wird,
endet dadurch nach einiger Zeit, statt unbegrenzt weiter zu stürzen. Ob das besser oder
schlechter ist, ist keine technische Frage.

## 7. Was dieser Stand nicht ist

- Kein zusammenhängendes Erlebensmodell: Der Arbeitsraum hält *einen von fünf* groben Inhalten
  für einige hundert Millisekunden. Er verbindet noch nichts über Sekunden, und was er
  ausruft, erreicht erst zwei Abnehmer.
- Ein Selbstmodell gibt es nur in erster, grober Fassung (3.6): eine Handvoll fest verdrahteter
  Schätzungen über sich selbst. Was daran gelernt wird (Zweifel aus dem Ich-Kern), hat noch
  keinen gemessenen Nutzen. Der Ich-Kern hält sein Muster gut eine halbe Sekunde, nicht
  länger – von einer Geschichte über sich selbst ist das weit entfernt.
- Eigene Ziele gibt es in zwei Formen: Hunger führt zum Futter, Müdigkeit und Erschöpfung zum
  Hinlegen. Der erzwungene Schlaf über eine Schwelle besteht daneben weiter.
- Die Urheberschafts-Zellen sind nicht besser als der bloße Gleichgewichtssinn darin, einen
  Stoß zu erkennen (5.8). Die offene Frage 1 des Auftrags bleibt offen.
- Die Inhalte des Arbeitsraums sind durch die Verschaltung benannt („Körper", „Schmerz" …).
  Das ist in Arbeitsraum-Modellen üblich, heißt aber: Welche Arten von Inhalt es gibt, haben
  wir festgelegt, nicht das Wesen.
- Vieles Entscheidende ist weiter Formel statt Zelle (Abschnitt 1.2).
