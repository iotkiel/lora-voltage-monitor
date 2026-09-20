# Batterie-Voltmeter – ESP32-C3 (ESPHome / Home Assistant)

ESP32-C3-Board mit 0,42"-OLED, das die Spannung einer Batterie über einen
INA226-Sensor misst und in Home Assistant einbindet. Das Display zeigt
Spannung + geschätzten Ladezustand, per Deep Sleep stromsparend.

> **Hinweis:** Dieses Projekt (Konfiguration und Dokumentation) wurde
> vollständig mit **Devin** erstellt – dem AI-Coding-Agenten von
> Cognition (Modell SWE-2), interaktiv über die Devin-CLI im Editor.
> Bitte beim Übernehmen von Code die üblichen Vorsichtsmaßnahmen
> beachten (Hardware-Verkabelung vor dem Anschließen verifizieren).

## Hardware

- **ESP32-C3 Dev-Board** (AITRIP, Amazon ASIN B0FFGTX1FN) mit integriertem
  0,42"-OLED (SSD1306, I2C `0x3C`, sichtbarer Bereich 72x40 px,
  kalibrierter Offset **28/24**)
- **INA226 I2C-Breakout** (QUARKZMAN, Amazon ASIN B0DW2Q8WRH),
  Adresse `0x40`, Shunt R100 = 0,1 Ω
- **DC-DC-Wandler** (z. B. MP1584) zur Versorgung aus der Batterie
- Schutzbeschaltung: Sicherung ~1 A, TVS-Diode 1.5KE16A,
  Schottky 1N5822 (Verpolschutz)

## Verkabelung

### 1. I2C-Bus (INA226 ↔ ESP32-C3, Bus shared mit internem OLED)

```
        ESP32-C3 (OLED intern an GPIO5/6, 0x3C)          INA226-Modul (0x40)
   ┌──────────────────────────────┐               ┌─────────────────────────┐
   │  3V3 ●───────────────────────┼───────────────┼──● VCC                  │
   │  GND ●───────────────────────┼───────────────┼──● GND                  │
   │ GPIO5 (SDA) ●────────────────┼───────────────┼──● SDA                  │
   │ GPIO6 (SCL) ●────────────────┼───────────────┼──● SCL                  │
   │  USB-C ●──→ PC/5V            │               │  ALERT → frei (optional)│
   └──────────────────────────────┘               │  IN+ ●──┐               │
                                                  │         ├── Brücke      │
                                                  │  IN− ●──┘ (Shunt frei)  │
                                                  │  VBS ●──← Batterie (+)  │
                                                  └─────────────────────────┘
```

| INA226 | Anschluss |
|--------|-----------|
| VCC    | ESP32-C3 `3V3` |
| GND    | ESP32-C3 `GND` |
| SDA    | `GPIO5` (teilt Bus mit OLED) |
| SCL    | `GPIO6` (teilt Bus mit OLED) |
| ALERT  | frei (optional, ungenutzt) |
| VBS    | Batterie (+) — Spannungsmessung |
| IN+/IN−| unbeschaltet, miteinander brücken (floaten sonst) |
| GND    | Batterie (−) — gemeinsames GND mit ESP32 |

### 2. Variante Strommessung (optional, falls Shunt genutzt wird)

```
   Messkreis (High-Side):
   Netzteil(+) → IN+ ──[Shunt R100]── IN− → Last(+) → Last(−) → Netzteil(−)
   VBS an IN− klemmen. Max. 36 V Busspannung.
   IN+/IN− nie mit GND verwechseln.
```

### 3. Versorgung des ESP32 aus der Batterie

```
   Batterie (+) ──┬───────────────────────────● VBS (INA226, echte Batteriespannung)
                  │
                  └──● [Sicherung] ──● [▶| Schottky] ──┬───● VIN+ ┌─────────┐
                        ~1 A         1N5822, Kat.→Wandler│         │ MP1584  │──● 5V → ESP32 5V-Pin
                                                       ┌─┴─┐       │         │
                                                       │TVS│ ──────● VIN−    │
                                                       │16A│       └─────────┘
                                                       └─┬─┘  Kat.→VIN+, An.→GND
   Batterie (−) ──┴─────────────────────────────────────┴─────● GND (ESP32 + INA226)
```

- **Reihenfolge:** Batterie+ → Sicherung (~1 A) → Schottky (Kathode Richtung
  Wandler) → Knoten mit TVS (Kathode an VIN+, Anode an GND) → Wandler VIN+.
- **VBS vor der Schottky** abzweigen → Messung ohne ~0,3-V-Flussabfall.
- Wandler auf **5,0–5,2 V** einstellen (unter Last prüfen!), Ausgang auf den
  **5V-Pin** des Boards (onboard-LDO macht 3,3 V).
- Testlast zum Einstellen: USB-LED-Lampe/-Ventilator oder
  Leistungswiderstand 10 Ω/5 W (= 0,5 A bei 5 V, wird warm).
- Alle Massen verbinden. Wandler muss den Batteriebereich am Eingang
  vertragen (MP1584: bis 28 V → ok für 12-V-Blei bis ~14,8 V Ladeschluss).
- Beim USB-Flash Batterie-/Wandlerversorgung abklemmen.
- Im Fahrzeug (Lichtmaschine): TVS wegen Load-Dump-Spitzen Pflicht.

## Firmware

- Datei: `esphome/esp-c3-voltmeter.yaml` (Quelle der Wahrheit im Repo,
  Deployment über ESPHome Builder in Home Assistant)
- Board `esp32-c3-devkitm-1`, Framework `esp-idf`, USB-Logging via
  `USB_SERIAL_JTAG`
- API verschlüsselt (`!secret esp_c3_voltmeter__encryption_key`),
  OTA mit Passwort (`!secret esp_c3_voltmeter__ota_password`)

### Einstellbare Substitutionen (vor dem Flashen)

| Substitution | Default | Bedeutung |
|---|---|---|
| `deep_sleep_enabled` | `"true"` | Deep Sleep an/aus (Debug: `"false"`) |
| `sleep_minutes` | `"10"` | Schlafintervall in Minuten |
| `battery_type_default` | `"0"` | Akkutyp: 0=Blei-Gel, 1=AGM, 2=LiFePO4 4S, 3=Li-Ion 3S |
| `oled_offset_x` / `_y` | `"28"` / `"24"` | OLED-Fenster-Offset (kalibriert) |
| `oled_frame` | `"false"` | `"true"` = Kalibrierrahmen anzeigen |

### Entitäten in Home Assistant

- `sensor.esp_c3_voltmeter_busspannung` – Batteriespannung (V)
- `sensor.esp_c3_voltmeter_batterieladung` – geschätzter Ladezustand (%)
- `sensor.esp_c3_voltmeter_shunt_spannung` / `_strom` / `_leistung` – ~0
  solange der Shunt nicht beschaltet ist
- `select.esp_c3_voltmeter_akkutyp` – Akkutyp zur Laufzeit wählbar
- `switch.esp_c3_voltmeter_deep_sleep` – Deep Sleep an/aus
- `number.esp_c3_voltmeter_schlafintervall` – Intervall 1–720 min

Laufzeit-Einstellungen liegen im RTC-RAM und überleben Sleep-Zyklen.

### Deep Sleep

Boot → prevent → WiFi/API → 5 s warten (Daten sicher in HA) → schlafen.
Fallback: ohne HA-Verbindung spätestens nach 60 s. OLED zeigt im Sleep
den letzten Messwert weiter (~10–15 mA). Für OTA vorher den
Deep-Sleep-Switch auf „aus" stellen oder per USB flashen.

## Dateien

- `esphome/esp-c3-voltmeter.yaml` – ESPHome-Konfiguration
- `CHANGELOG.md` – Änderungsverlauf pro Version
- `secrets.example.yaml` – Vorlage für Secrets (WiFi, API-Key, OTA-Pw)
- `AGENTS.md` – Workflow-Regeln und Hintergrunddetails

## Versionierung

Jede Änderung = Versionsbump in `esphome.project.version` (SemVer) +
ausführlicher Eintrag in `CHANGELOG.md`. Details in `AGENTS.md`.
