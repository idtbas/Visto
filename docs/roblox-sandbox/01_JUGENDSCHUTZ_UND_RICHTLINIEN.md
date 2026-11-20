# 01 – Jugendschutz, Roblox-Richtlinien und Einstufung

**Ziel:** Das Spiel soll für **9- bis 17-Jährige** erreichbar sein (Roblox Select + Standard)
und dabei die volle Genre-Tiefe behalten. Blut wird zu **farbigem Glibber**, Gewalt bleibt
klar **unrealistisch** und **cartoonhaft**, das Spiel ist ein **Testlabor**, kein Folterkeller.

Recherchestand: **20.11.2026**. Roblox hat 2026 sein Altersmodell umgebaut. Alle Aussagen mit
Quelle stehen am Ende. Wo Roblox selbst unklar ist, steht das dabei.

---

## 1. Was sich 2026 bei Roblox geändert hat (und was das für uns heißt)

| Thema | Stand Nov. 2026 | Folge für uns |
|-------|-----------------|---------------|
| Konten | **Roblox Kids** (5–8), **Roblox Select** (9–15), **Standard** (16+), alters-geprüft | Zielgruppe „unter 18“ = Select + jugendliche Standard-Konten |
| Einstufungen | Minimal / Mild → Kids + Select; **Moderate → Select + 16+**; „Content May Vary“ → 16+; Restricted → 18+ (ID) | Ziel: **höchstens Moderate**, lieber Mild |
| Zugang für unter 16 | Nur nach **Veröffentlichungs-Prüfung**: Besitzer ID-verifiziert + 2FA, Premium/Plus ≥ 2 Monate **oder** 1 000 Robux Gebühr (erstattbar), vollständiger Fragebogen, **Testphase nur für 16+**, Sicherheitsprüfung, **100 verschiedene „stark engagierte“ alters-geprüfte Spieler in 60 Tagen** | Die ersten Wochen nach Release spielen **nur 16+-Spieler**. Das muss im Launch-Plan stehen (siehe [10](10_ROADMAP_QA_MONETARISIERUNG.md)) |
| IARC | Altersfreigaben (USK, PEGI, ESRB …) kommen aus dem Fragebogen; Kids/Select-Spiele ohne IARC-Rating ab **26.01.2027** in Australien ggf. entfernt | Fragebogen vollständig ausfüllen, IARC-Rating vor Launch |
| Unbewertete Spiele | Für alle unspielbar | Fragebogen ist Pflicht-Schritt in Woche 1 |
| Chat | Alterscheck (Gesicht/ID) für jeden Chat; Kids ohne Chat; Select gestaffelt | Unser Spiel muss **ohne Chat** voll funktionieren |
| Teilen von Medien | In-Game-Werkzeuge zum Teilen von Bildern, Videos, Text, Audio **oder 3D-Modellen** machen ein Spiel **16+**; Bauen mit 3D-Teilen ist dagegen **keine** freie Kreation | **Öffentliche Bauplan-Galerie ist zum Start tabu** (siehe §5) |
| Freies Zeichnen | Freihand-Malen/Schreiben/Graffiti, das andere sehen → 16+ | Kein Pinsel-/Spray-Werkzeug. Einfärben ganzer Teile per Farbauswahl ist ok |

**Fazit:** Wir bauen ein Spiel, das in der Fragebogen-Vorschau als **Mild**, notfalls
**Moderate** herauskommt. Roblox veröffentlicht keine Tabelle mehr, welche Antworten zu welcher
Stufe führen – die Stufe wird berechnet. Darum ist **Schritt 1 des gesamten Projekts**: den
Fragebogen in der Creator-Hub-Vorschau mit unseren geplanten Antworten durchspielen und das
Ergebnis festhalten, **bevor** Gore-nahe Features gebaut werden.

---

## 2. Unsere Fragebogen-Zielantworten

Roblox beschreibt Gewalt entlang mehrerer Achsen. Unsere Designentscheidungen zielen jeweils auf
die mildere Antwort:

| Achse | Unsere Antwort | Wie wir sie einhalten |
|-------|----------------|-----------------------|
| Ziel der Gewalt | Menschenähnlich (Dummies sehen menschenähnlich aus – ehrlich angeben) | – |
| Welt | **Fantastisch** | Testlabor mit Fantasie-Technik (Seren, Tesla-Spulen, Schwebe-Felder), **keine realen Orte, keine echten Waffenmodelle** |
| Stil | **Animiert** (stilisiert) | Glatte, bunte Vinyl-Optik, LED-Gesicht, keine fotorealistischen Texturen |
| Reaktion der Figuren | **Unrealistisch** | Keine Schmerzensschreie, kein Wimmern; Piep-Laute, Emoji-Augen, „Bliep“ beim Deaktivieren. Wunden sind Risse in Vinyl |
| Blut | **Unrealistisch**: unnatürliche Farbe, Partikel, verblasst | Glibber in Blau/Grün/Lila/Gelb …, nie rot (siehe §3) |
| Blutmenge | so wenig wie spielerisch nötig | Partikel + kleine Pfützen, die nach 90 s verblassen |
| Gore | **Keine** | Keine Innereien, keine Knochen, keine Abtrennung in Stufe A (siehe 02 §5.8) |
| Angst | höchstens „gruselig“, nie „verstörend“ | Keine offenen Wunden, keine „fehlende Haut“-Optik, keine Horror-Karten |
| Häufigkeit/Kamera | „Oft und weit weg“ + „selten und nah“ (Standard-Kamera) | Keine Ego-Perspektive als Standard; die Avatar-Ego-Ansicht ist optional |
| Derber Humor | keiner | Keine Ausscheidungen o. Ä. |

---

## 3. Die Glibber- und Gelenk-Regeln

### Glibber (statt Blut)

- **Farbe:** frei wählbar aus einer Palette, Standard **„Lab-Türkis“ `#2EC4D6`**. Die Palette
  **schließt den Rotbereich hart aus**: Farbton 340°–25° (HSV) ist gesperrt, ebenso dunkle
  Braun-/Weinrot-Töne (Farbton 0–40° bei Sättigung > 40 % und Helligkeit < 55 %). Die Prüfung
  läuft **serverseitig** – auch Farbstoff-Flüssigkeiten und gespeicherte Baupläne können keine
  roten Glibberwerte einschleusen.
- **Form:** leuchtende, leicht gelartige Partikel, kleine runde Tropfen, glatte Pfützen.
  Keine Spritzmuster an Wänden, keine Flecken auf der Kamera.
- **Lebensdauer:** Pfützen verblassen nach 90 s, Tropfen nach 10 s, Leck-Partikel enden, wenn
  die Wunde versiegelt ist.
- **Menge:** harte Obergrenzen (Partikel/Pfützen pro Labor), damit nie ein „Blutbad“-Bild
  entsteht.
- **Sanft-Modus:** gar kein Glibber, stattdessen kurze Funken/Sternchen.

### Gelenke und Körper

- **Stufe A „Auskugeln“** ist der Start-Standard (Gelenke bleiben verbunden, baumeln frei).
- **Stufe B „Bausatz-Zerfall“** (sauberer Zerfall in Spielzeugteile) nur, wenn die
  Fragebogen-Vorschau die Zielstufe hält. Roblox nennt „Charaktere, die vor dem Respawn
  auseinanderfallen“ als **unrealistische Reaktion**.
- **Stufe C „Einzelnes Lösen“** nur nach ausdrücklicher Bestätigung; sonst nie.
- **Kopf trennt sich nie.** Kein „Enthaupten“ in keiner Stufe.
- **Zerdrücken** = Cartoon-Stauchung (flachgedrückt wie Knete), keine geplatzten Körper.
- **Ätzen** macht die Hülle fleckig und milchig, das Segment behält immer seine Form – nichts liegt frei.
- **Verkohlen** = Ruß auf Vinyl.
- **Erfrieren/Zerspringen** = nur der Eispanzer zerspringt in Kristallsplitter, das Segment bleibt dran.

---

## 4. Rahmung: Labor, nicht Folter (wichtigster Punkt!)

Roblox' Community Standards verbieten ausdrücklich, „**Misshandlung und Folter** von Menschen,
Tieren oder Fantasiewesen darzustellen oder zu verherrlichen“. Ein Ragdoll-Sandbox ist dem
Thema von Natur aus nah – deshalb ist die Rahmung keine Kosmetik, sondern **Pflicht**.

**Verbindliche Regeln für Design, Texte, Thumbnails, Icons und Item-Namen:**

1. **Testpuppen, keine Opfer.** Dummies sind Crash-Test-Puppen in einem Forschungslabor. Sie
   haben keine Namen, keine Familien, keine Biografie, keine Angst-Animationen vor dem Spieler.
2. **Keine Folter- oder Hinrichtungsgeräte.** Kein elektrischer Stuhl, keine Guillotine, kein
   Galgen, keine Streckbank, keine Fesseln + Schadensgerät als Kombi-Item, keine „Folterkammer“-
   Karte. Industrie- und Laborgeräte (Presse, Tesla-Spule, Förderband) sind ok, weil sie
   **Maschinen** sind, keine Strafinstrumente.
3. **Fesseln/Fixieren** nur als neutrales Physik-Werkzeug (Seil, Schweißen, Pinnen) – nie als
   „Gefangenen“-Inszenierung in offiziellen Inhalten.
4. **Heilen ist gleichwertig zum Zerstören.** Diagnose-Scanner, Seren, Defibrillator,
   Reparatur – und die **Rettungs-Aufgaben** (siehe [05](05_WERKZEUGE_UI_STEUERUNG.md#8-labor-aufgaben-optionaler-zielmodus)):
   „Stabilisiere den Dummy nach dem Crash“. Das ist im Genre übrigens eine der Lieblingsspielweisen.
5. **Keine realen Bezüge.** Keine echten Waffenmodelle/Marken, keine nachgestellten
   Amokläufe, Terroranschläge, Kriegsverbrechen oder reale Katastrophen (Community Standards
   verbieten das ausdrücklich). Offizielle Szenen bleiben Crashtests, Physik-Experimente,
   Kettenreaktionen.
6. **Keine Selbstverletzung.** Der eigene Avatar des Spielers wird nie zum Opfer der
   Schadens-Simulation (er kann umgeworfen werden, nimmt aber keinen Schaden, blutet nicht,
   hat keine Vitalwerte). Keine „Challenges“, die zum Nachmachen im echten Leben einladen.
7. **Store-Seite:** Titel, Beschreibung, Icon und Thumbnails zeigen Experimente,
   Maschinen, Kettenreaktionen und das LED-Gesicht – **nie** Glibber-Pfützen oder
   leidende Dummies in Nahaufnahme. Roblox stuft nicht passende Metadaten herunter.

---

## 5. Teilen von Bauplänen, Text, Chat

| Funktion | Entscheidung zum Start | Begründung |
|----------|------------------------|------------|
| Eigene Baupläne speichern/laden | ✔ | Keine Weitergabe an andere |
| Gemeinsam bauen im selben Server | ✔ | Normales Multiplayer-Bauen mit 3D-Teilen ist keine „freie Kreation“ |
| Freunde ins Solo-Labor einladen | ✔ | Normales Teleport-/Einladungssystem |
| **Bauplan-Codes / öffentliche Galerie** | ✘ zum Start, hinter Flag `ContraptionSharing` | Roblox wertet In-Game-Werkzeuge zum Teilen von 3D-Modellen als **16+**. Unklar, ob Gating per `IsContentSharingAllowed` reicht. Erst nach schriftlicher Klärung mit Roblox bzw. Vorschau-Ergebnis aktivieren – dann **nur** für Spieler mit `IsContentSharingAllowed = true` |
| **Kuratierte Baupläne** („Lab-Bibliothek“) | ✔ | Wir als Entwickler veröffentlichen Szenen/Maschinen; das ist offizieller Inhalt |
| Text auf Items (Schilder, Bildschirme, Bauplan-Namen) | Bauplan-Namen nur für einen selbst sichtbar (trotzdem gefiltert); öffentlicher Text erst mit Galerie | Pflicht: `TextService:FilterStringAsync` + `GetNonChatStringForBroadcastAsync`; sichtbarer Text braucht **1 Minute Rate-Limit pro Spieler** |
| Freies Malen/Sprühen | ✘ dauerhaft | macht das Spiel 16+ |
| Chat | Roblox-Standard über `TextChatService`, keine eigene Chat-Lösung | Pflicht; ab Mai 2027 plattform-integrierter Chat |
| KI-Chat mit Dummies | ✘ | „Erweiterte“ KI-Interaktion → 18+ |
| Soziale Treffpunkte / private Räume | ✘ | Hangouts → 16+/18+ |

---

## 6. Monetarisierung für Minderjährige

| Regel | Umsetzung |
|-------|-----------|
| **Keine Lootboxen**, keine Zufalls-Kaufitems, keine Glücks-Booster | Alles wird direkt gekauft, Inhalt vorher sichtbar. Dadurch entfällt die Pflicht-Behandlung über `ArePaidRandomItemsRestricted` – wir prüfen das Flag trotzdem defensiv im Shop-Code |
| Kein Pay-to-Win (ist ohnehin ein Sandbox) | Der **gesamte Simulationskern ist kostenlos**. Bezahlt wird für Komfort, Kosmetik, Extra-Items, die nichts „besser“ machen |
| Rewarded Video Ads | **Nicht** zum Start. Wenn überhaupt: nur `AreAdsAllowed` + 13+, nie mit Zufallsbelohnung, Schaden pausieren |
| Abos | Optional später; `IsEligibleToPurchaseSubscription` prüfen; keine Bronze/Silber/Gold-Stufen derselben Vorteile |
| Handel | Kein Item-Handel zwischen Spielern |
| Preise | Fair, keine künstliche Verknappung, keine „nur heute“-Druckmechanik |

Details und Produktliste in [10](10_ROADMAP_QA_MONETARISIERUNG.md#monetarisierung).

---

## 7. Pflichten-Checkliste (vor jedem Release)

- [ ] Fragebogen vollständig, Vorschau-Ergebnis dokumentiert (Ziel Mild/Moderate)
- [ ] IARC-Ratings vorhanden
- [ ] Besitzerkonto: ID-verifiziert, 2FA, Premium/Plus ≥ 2 Monate **oder** Gebühr hinterlegt
- [ ] Alle Spielertexte gefiltert, Rate-Limit aktiv
- [ ] `PolicyService:GetPolicyInfoForPlayerAsync` wird beim Beitritt gelesen und respektiert
      (`ArePaidRandomItemsRestricted`, `IsContentSharingAllowed`, `AreAdsAllowed`,
      `IsEligibleToPurchaseSubscription`, `IsPaidItemTradingAllowed`)
- [ ] Glibber-Farbprüfung serverseitig aktiv, Rotbereich gesperrt
- [ ] `JointFailureMode` passend zur bestätigten Stufe
- [ ] Keine Folter-/Hinrichtungs-Items, keine realen Waffenmodelle (Asset-Review-Liste)
- [ ] Hochgeladene Texturen/Decals ohne realistische Gewalt/Blut (werden sonst unabhängig von
      der Einstufung moderiert)
- [ ] Store-Seite: Icon/Thumbnails/Beschreibung nach §4.7
- [ ] Teilen-Funktionen nur hinter `ContraptionSharing` + `IsContentSharingAllowed`

---

## 8. Offene Punkte (ehrlich)

1. **Welche Stufe genau** farbiger Glibber + menschenähnliche Dummies + Waffen ergeben,
   veröffentlicht Roblox nicht mehr. → Fragebogen-Vorschau in Woche 1.
2. Ob **Stufe B** (Bausatz-Zerfall) unter „Gore“ fällt, ist nicht bestätigt. → Vorschau bzw.
   Anfrage beim Roblox-Support.
3. Ob Bauplan-Teilen mit `IsContentSharingAllowed`-Gating unter 16+ bleibt, ist offen.
4. Waffen: Roblox hat keine eigene Waffenkategorie mehr; „realistische Waffen“ erhöhen aber die
   Einstufung. → Wir gestalten Waffen bewusst **stilisiert** (klobig, farbig, Labor-Look, Fantasie-
   Namen), ohne die Mechanik (Kaliber, Durchdringung, Rückstoß) zu verlieren.

## Quellen

- Einstufungen, Definitionen: https://create.roblox.com/docs/production/promotion/content-ratings
- Kids & Select, Veröffentlichungs-Prüfung: https://create.roblox.com/docs/production/publishing/kids-and-select
- Neue Anforderungen (Mai 2026): https://devforum.roblox.com/t/new-publishing-requirements-evaluation-process-for-games/4573166
- Kids- und Select-Konten: https://about.roblox.com/newsroom/2026/04/introducing-roblox-kids-and-select-accounts
- Community Standards: https://about.roblox.com/community-standards
- Paid Random Items: https://create.roblox.com/docs/production/monetization/paid-random-items
- PolicyService: https://create.roblox.com/docs/reference/engine/classes/PolicyService
- Textfilter: https://create.roblox.com/docs/ui/text-filtering
- Chat-Richtlinien: https://create.roblox.com/docs/chat/guidelines
- Rewarded Video Ads: https://create.roblox.com/docs/production/promotion/rewarded-video-ads
- Abos: https://create.roblox.com/docs/production/monetization/subscriptions
- Chat-Altersprüfung: https://about.roblox.com/newsroom/2026/01/roblox-age-checks-required-to-chat
