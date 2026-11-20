# 09 – Code-Architektur

Drei Prinzipien:

1. **Datengetrieben.** Ein neues Item, eine neue Flüssigkeit, eine neue Reaktion = ein
   Tabelleneintrag + ein Modell. Kein neuer Code für Inhalte. (Die Genre-Referenz musste 2026
   ihr C#-Modding wegen Schadsoftware abschalten – bei uns gibt es gar keinen fremden Code, nur Daten.)
2. **Komponenten statt Vererbung.** Ein Item *hat* `Gun`, `Container`, `Flammable`,
   `Conductor`, `SignalPorts` … Systeme arbeiten auf allen Items mit der jeweiligen Komponente.
3. **Reine Logik getrennt von Roblox.** Formeln, Serialisierer, Graph-Algorithmen sind
   Roblox-frei und mit Jest-Lua testbar. Roblox-Code ist eine dünne Schicht darum.

---

## 1. Projektstruktur (Rojo)

```
lab-sandbox/
├─ default.project.json
├─ wally.toml                     -- ProfileStore, React-lua, Jest-Lua, t (Typprüfung)
├─ selene.toml · stylua.toml
├─ src/
│  ├─ shared/                      → ReplicatedStorage/Shared
│  │  ├─ Config/
│  │  │  ├─ BodyConfig.luau        -- Segmente, Gelenke, Schwellen (02)
│  │  │  ├─ Materials.luau         -- Materialtabelle (04 §1)
│  │  │  ├─ Liquids.luau           -- Flüssigkeiten + Wirkungen (04 §4)
│  │  │  ├─ Reactions.luau         -- Mischungen
│  │  │  ├─ Budgets.luau           -- Physik-Punkte, Obergrenzen
│  │  │  └─ Flags.luau             -- JointFailureMode, ContraptionSharing, …
│  │  ├─ Items/                    -- eine Datei pro Kategorie, Item-Definitionen
│  │  ├─ BodyTypes/                -- Standard, Schwer, Leicht, Robo
│  │  ├─ Sim/                      -- läuft auf Host (Client ODER Server)
│  │  │  ├─ LabSim.luau            -- startet/stoppt alle Systeme für ein Labor
│  │  │  ├─ Body/  (Rig, Muscles, Balance, Behaviour, Vitals, Damage, JointFailure)
│  │  │  ├─ Impact/ (CollisionSummarySource, DeltaVSource, ImpactRouter)
│  │  │  ├─ Ballistics.luau
│  │  │  ├─ Explosions.luau
│  │  │  ├─ Thermal.luau · Fire.luau
│  │  │  ├─ Power.luau (Union-Find) · Signals.luau
│  │  │  ├─ Fluids.luau · Puddles.luau
│  │  │  ├─ BreakMonitor.luau
│  │  │  └─ Components/ (Gun, Blade, Container, Syringe, Motor, Piston, Sensor, …)
│  │  ├─ Pure/                     -- Roblox-frei, getestet
│  │  │  ├─ DamageMath.luau · VitalsMath.luau · Penetration.luau
│  │  │  ├─ UnionFind.luau · SignalGraph.luau
│  │  │  ├─ BlueprintCodec.luau · Quantize.luau
│  │  │  └─ GooColor.luau
│  │  ├─ Net/ (Net.luau, Schema.luau, RateLimit.luau)
│  │  └─ Util/ (Pool, Signal, Janitor/Trove)
│  ├─ server/                      → ServerScriptService
│  │  ├─ Services/
│  │  │  ├─ LabService.luau        -- Labor-Zuteilung, Rollen, Grenzen, Kollisionsgruppen
│  │  │  ├─ OwnershipService.luau  -- Host-Ownership, „Wer zieht, besitzt“, Fallback
│  │  │  ├─ SpawnService.luau      -- Validierung, Budgets, Undo-Verlauf
│  │  │  ├─ RelayService.luau      -- Zustand/Ereignisse an Labor-Mitglieder
│  │  │  ├─ PersistenceService.luau -- ProfileStore, Baupläne, Autosave, Migration
│  │  │  ├─ PolicyService.luau     -- PolicyService-Abfrage, Feature-Gates
│  │  │  ├─ TextService.luau       -- Filtern + Rate-Limit
│  │  │  ├─ ShopService.luau       -- Pässe, Produkte, Freischaltungen
│  │  │  ├─ TaskService.luau       -- Labor-Aufgaben, Badges
│  │  │  └─ PerfGuard.luau         -- Physik-Bremse
│  │  └─ init.server.luau
│  └─ client/                      → StarterPlayerScripts
│     ├─ Controllers/ (Camera, Input (IAS), Grabber, Tools, Selection, Undo, Replay, VFX, Audio)
│     ├─ UI/ (React-lua: SpawnMenu, Toolbar, ContextMenu, Inspector, Scanner, Settings, Tutorial)
│     └─ init.client.luau
├─ assets/                         -- Modelle (.rbxm), über Rojo eingebunden
└─ tests/                          -- Jest-Lua für src/shared/Pure
```

---

## 2. Item-Definition (Beispiel)

```lua
-- src/shared/Items/Firearms.luau
return {
    {
        id = "impulse_rifle",
        name = "ITEM_IMPULSE_RIFLE",          -- Lokalisierungs-Schlüssel
        category = "Firearms",
        model = "Items/Firearms/ImpulseRifle",
        points = 3,
        material = "Aluminium",
        phase = "1.0",
        components = {
            Grip = { attachment = "Grip" },
            Gun = {
                muzzle = "Muzzle",
                energy = 1800,               -- J
                rpm = 600,
                magazine = 30,
                spreadDeg = 1.2,
                recoilImpulse = 35,
                modes = { "Auto", "Semi" },
                ammo = { "Standard", "AP", "Rubber", "Incendiary", "Frost" },
            },
            SignalPorts = { inputs = { "Trigger" }, outputs = { "Fired", "Empty" } },
            Breakable = { durability = 900 },
        },
    },
}
```

Beim Spawn liest die `ItemRegistry` die Definition, klont das Modell, setzt Materialwerte,
Attribute und Tags (`CollectionService`) und meldet die Komponenten bei den Systemen an.

---

## 3. Kern-Algorithmen (Skizzen)

> Die Skizzen zeigen Struktur und Rechenweg. Exakte API-Signaturen (vor allem der neuen
> Collision Summaries) werden im Prototyp gegen die aktuelle Doku geprüft.

### 3.1 Aufprall-Quelle (Collision Summaries)

```lua
--!strict
--!native
local ImpactRouter = require(script.Parent.ImpactRouter)
local Materials = require(Shared.Config.Materials)

local MIN_NORMAL_SPEED = 18 -- Studs/s, wird nach Schwerkraft-Festlegung kalibriert

local CollisionSummarySource = {}

function CollisionSummarySource.watch(part: BasePart, owner: any)
    -- Roblox ruft den Callback einmal pro Frame mit den Kontakten dieses Teils auf
    -- (nur beim Network-Owner!)
    return part:BindToCollisionSummaries(function(summaries)
        for _, s in summaries do
            local vn = math.abs(s.RelativeVelocity:Dot(s.Normal))
            if vn < MIN_NORMAL_SPEED then continue end
            local other = if s.Part0 == part then s.Part1 else s.Part0
            local mA = part.AssemblyMass
            local mB = if other.Anchored then math.huge else other.AssemblyMass
            local mu = if mB == math.huge then mA else (mA * mB) / (mA + mB)
            ImpactRouter.push({
                part = part,
                other = other,
                point = s.Point,
                normal = s.Normal,
                impulse = mu * vn,
                energy = 0.5 * mu * vn * vn,
                hardness = Materials.hardnessOf(other),
            })
        end
    end)
end

return CollisionSummarySource
```

`ImpactRouter` reicht Ereignisse an den Schadensrechner weiter – lokal, wenn dieser Client der
Labor-Host ist, sonst gebündelt über `Net` an den Server → Host.

### 3.2 Projektil mit Durchdringung

```lua
--!strict
--!native
local Penetration = {}

export type Hit = { part: BasePart, pos: Vector3, normal: Vector3, energyIn: number }

function Penetration.trace(origin: Vector3, dir: Vector3, energy: number,
                           params: RaycastParams, resistanceOf: (BasePart) -> number,
                           isHard: (BasePart) -> boolean, maxHits: number?): { Hit }
    local hits: { Hit } = {}
    local pos, d = origin, dir.Unit
    for _ = 1, maxHits or 16 do
        local r = workspace:Raycast(pos, d * 1000, params)
        if not r then break end
        local part = r.Instance :: BasePart
        local cosA = math.abs(d:Dot(r.Normal))
        if isHard(part) and cosA < 0.26 then                -- > ~75° zur Normale: Abpraller
            d = d - 2 * d:Dot(r.Normal) * r.Normal
            energy *= 0.5
            pos = r.Position + d * 0.02
            continue
        end
        table.insert(hits, { part = part, pos = r.Position, normal = r.Normal, energyIn = energy })
        -- Dicke: von weit hinten zurück auf dasselbe Teil casten
        local farStart = r.Position + d * (part.Size.Magnitude + 0.1)
        local back = workspace:Raycast(farStart, -d * (part.Size.Magnitude + 0.2),
                                        Penetration.onlyParams(part))
        local thickness = if back then (back.Position - r.Position).Magnitude else 0.2
        energy -= resistanceOf(part) * thickness
        if energy <= 0 then break end
        pos = (if back then back.Position else r.Position) + d * 0.02
    end
    return hits
end

return Penetration
```

### 3.3 Stromnetz (Union-Find)

```lua
--!strict
local UnionFind = {}
UnionFind.__index = UnionFind

function UnionFind.new(n: number)
    local parent, rank = table.create(n, 0), table.create(n, 0)
    for i = 1, n do parent[i] = i end
    return setmetatable({ parent = parent, rank = rank }, UnionFind)
end

function UnionFind:find(i: number): number
    local p = self.parent
    while p[i] ~= i do
        p[i] = p[p[i]]       -- Pfadhalbierung
        i = p[i]
    end
    return i
end

function UnionFind:union(a: number, b: number)
    local ra, rb = self:find(a), self:find(b)
    if ra == rb then return end
    if self.rank[ra] < self.rank[rb] then ra, rb = rb, ra end
    self.parent[rb] = ra
    if self.rank[ra] == self.rank[rb] then self.rank[ra] += 1 end
end

return UnionFind
-- Power.luau: Knoten = leitfähige Objekte, union() für jeden Kontakt/jedes Stromkabel,
-- Komponente.spannung = max(Quellen); nur neu rechnen, wenn dirty.
```

### 3.4 Signalnetz (20 Hz, 1 Takt Verzögerung)

```lua
-- Jedes Bauteil liest die Eingänge aus dem VORHERIGEN Takt → Schleifen sind stabil.
function SignalGraph.step(nodes, wires, prev: { [number]: boolean }): { [number]: boolean }
    local inputs = {}
    for _, w in wires do                         -- ODER-Verknüpfung mehrerer Kabel
        if prev[w.fromPort] then inputs[w.toPort] = true end
    end
    local out = {}
    for _, n in nodes do
        n.kind.evaluate(n, inputs, out)          -- schreibt in out[n.outPorts[i]]
    end
    return out
end
```

### 3.5 Glibberfarbe prüfen (Server, Pflicht)

```lua
--!strict
local GooColor = {}

-- true, wenn die Farbe als Glibber erlaubt ist (kein Rot, keine blutähnlichen Töne)
function GooColor.isAllowed(c: Color3): boolean
    local h, s, v = c:ToHSV()          -- h, s, v in 0..1
    local deg = h * 360
    if s < 0.25 then return true end   -- Grau/Weiß/Schwarz-artig: ok
    if deg >= 340 or deg <= 25 then return false end              -- Rotbereich
    if deg <= 40 and s > 0.4 and v < 0.55 then return false end   -- Braun-/Weinrot
    return true
end

function GooColor.sanitize(c: Color3): Color3
    return if GooColor.isAllowed(c) then c else Color3.fromRGB(46, 196, 214) -- Lab-Türkis
end

return GooColor
```

### 3.6 Netzwerk-Schicht

```lua
-- Net.luau (Auszug): jede Nachricht hat ein Schema, ein Rate-Limit und einen Handler.
Net.define("Spawn", {
    direction = "ClientToServer",
    schema = t.strictInterface({ defId = t.string, cf = t.CFrame, scale = t.numberConstrained(0.25, 4) }),
    rate = { perSecond = 8, burst = 15 },
    handler = SpawnService.onSpawnRequest,
})

Net.define("BodyState", {
    direction = "ServerToClient",
    unreliable = true,            -- ≤ 900 Bytes pro Paket!
    encoding = "buffer",
})
```

---

## 4. Ablauf eines Treffers (Ende-zu-Ende)

```
Host-Client                                     Server                   Zuschauer
───────────                                     ──────                   ─────────
Collision Summary am Kopf-Segment
 → ImpactRouter → Damage.apply()
 → Hülle −0,12, Kopftrauma, Schmerz
 → Wunde "Crack" angelegt
 → Ereignis WoundCreated ─────────────────────► Relay ──────────────────► VFX: Riss-Decal,
                                                                          Glibber-Tropfen
 → Vitals-Takt (10 Hz): Bewusstsein ↓
 → Behaviour: Stehen → Fallen (Muskeln aus)
 → BodyState (4 Hz, buffer) ──────────────────► Relay ──────────────────► Inspektor-Balken,
                                                                          LED-Gesicht @ @
```

---

## 5. Qualitätsregeln für den Code

- `--!strict` überall, `--!native` für heiße Module.
- Keine `while true do wait()`-Schleifen: alles über `BindToSimulation`, `Heartbeat` oder
  zentrale Takte (`Scheduler.every(0.1, fn)`), damit Systeme zentral pausierbar sind (Pause-Modus).
- Jede Instanz, die ein System erzeugt, gehört einem **Janitor/Trove** des Labors →
  Labor löschen räumt garantiert alles weg (kein Speicherleck bei 2-Stunden-Sitzungen).
- Feature-Flags nur über `Config/Flags.luau` (später per DataStore/Open Cloud live schaltbar).
- Jede `Pure/`-Datei hat Tests; CI (GitHub Actions) führt Lint, Format-Check und Tests aus.
