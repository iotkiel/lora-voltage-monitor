# AGENTS.md – ESP32-C3 Voltmeter mit OLED (ESPHome / Home Assistant)

## Projektübersicht

- **Ziel:** Batteriespannungsmessung per INA226 am ESP32-C3 mit
  0,42"-OLED, ESPHome → Home Assistant.
- **Plattform:** ESPHome, verwaltet über den **ESPHome Builder**
  (Add-on) in Home Assistant. Quelle der Wahrheit:
  `esphome/esp-c3-voltmeter.yaml` in diesem Repo.
- **Schwesterprojekt:** LoRaWAN-Varianten desselben Messprinzips liegen
  in einem eigenen Repo (XIAO nRF52840 + BaseNode328).

## Hardware

### ESP32-C3 Board mit OLED (Amazon ASIN B0FFGTX1FN)

- AITRIP ESP32-C3 Entwicklungsboard (2er-Pack) mit 0,42"-OLED-Modul
- RISC-V 32-Bit Single-Core, 160 MHz, 4 MB Flash
- WiFi 802.11 b/g/n (2,4 GHz), Bluetooth 5.0 LE, USB-C (nativer USB-Seriell/JTAG)
- 15 GPIOs
- **OLED:** 0,42", SSD1306-kompatibel, I2C-Adresse `0x3C`, sichtbarer Bereich
  **72x40 Pixel**, der versetzt im 128x64-Framebuffer liegt.
  - Herstellerhinweis: Startpunkt des Bildschirms im 128x64-Buffer ist **(13, 14)**.
  - Je nach Clone werden auch Offsets um (28–30, 12–24) berichtet →
    bei Bedarf über die Substitutions `oled_offset_x` / `oled_offset_y` kalibrieren.
  - ESPHome hat kein natives 72x40-Modell → `model: SSD1306_128X64` verwenden
    und Inhalte um den Offset verschoben zeichnen.
- **Typische OLED-Pins bei diesem Board:** SDA = `GPIO5`, SCL = `GPIO6`
  (verifizieren – der `i2c: scan: true` im Log zeigt, ob das Display antwortet).
- **Flashen:** ESP32-C3 mit nativem USB → `logger: hardware_uart: USB_SERIAL_JTAG`
  verwenden. Board: `esp32-c3-devkitm-1`, Framework `esp-idf`.

### INA226 Strom-/Spannungssensor (Amazon ASIN B0DW2Q8WRH)

- QUARKZMAN INA226 I2C-Breakout (6er-Pack)
- 16-Bit, bidirektional: misst Busspannung (0–36 V), Shunt-Spannung, Strom, Leistung
- Versorgung 2,7–5,5 V (am ESP32-C3: **3V3**)
- I2C-Adresse standardmäßig `0x40` (über A0/A1-Pins änderbar)
- Alarm-Pin vorhanden (optional nutzbar)
- Shunt-Widerstand auf dem Breakout üblicherweise `R100` = **0,1 Ω**
  → in ESPHome `shunt_resistance` / `max_current` entsprechend einstellen und
  die Bestückung am konkreten Modul verifizieren.

## Verkabelung

Der INA226 hängt am selben I2C-Bus wie das interne OLED-Display
(GPIO5/SDA, GPIO6/SCL). Vollständige Skizzen (I2C-Bus, Strommessung,
DC-DC-Versorgung mit Schutzbeschaltung) stehen in der `README.md`.

Kernpunkte:
- Batterie (+) → `VBS`, Batterie (−) → `GND` (gemeinsames GND mit ESP32).
- `IN+`/`IN−` unbeschaltet, empfohlen: miteinander brücken, damit die
  Shunt-Eingänge nicht floaten (Strom/Leistung zeigen dann sauber 0).
- VBS verträgt bis 36 V, obwohl das Modul mit 3V3 läuft.
- VBS zapft **vor** der Schottky-Verpolschutzdiode ab.

## Stromversorgung des ESP32 aus der Batterie (DC-DC)

Sicherung (~1 A) → Schottky 1N5822 (Verpolschutz) → TVS 1.5KE16A →
MP1584 → 5 V auf den 5V-Pin. Skizze und Details in der `README.md`.

- Wandler muss den Batteriebereich am Eingang vertragen (MP1584 bis 28 V).
- Mind. ~0,5 A Ausgangsstrom (WiFi-Spitzen des ESP32 ~350 mA).
- Beim USB-Flash Batterie-/Wandlerversorgung abklemmen.
- Ausgang unter Last auf 5,0–5,2 V einstellen.
- Eigenverbrauch beachten: ESP32 mit WiFi ~30–80 mA → kleine Batterien
  leeren sich in Tagen → Deep Sleep.

## Deep Sleep (ab v0.4.0, Laufzeit-Steuerung ab v0.5.0)

Ablauf pro Zyklus:
1. Boot → `deep_sleep.prevent` + Intervall aus Global anwenden;
   Fallback-Timer (60 s) nur wenn `sleep_enabled`
2. WiFi + API verbinden (`on_client_connected`)
3. 5 s warten (Sensor publiziert 1×/s → Werte sicher in HA angekommen)
4. `deep_sleep.enter` → `sleep_interval_min` Minuten schlafen

**Steuerung auf drei Ebenen:**
- **Flash-Zeit (Substitutionen):** `deep_sleep_enabled` (`"true"`/`"false"`)
  und `sleep_minutes` oben in der YAML – Default beim Booten.
- **Laufzeit aus HA:** Switch `switch.esp_c3_voltmeter_deep_sleep`
  (an/aus) und Number `number.esp_c3_voltmeter_schlafintervall`
  (1–720 min). Beide steuern Globals mit `restore_value` → liegen im
  RTC-RAM und **überleben Deep-Sleep-Zyklen**; erst bei Stromtrennung
  fällt auf den Flash-Default zurück.
- **Safety:** `deep_sleep.prevent` läuft immer zuerst beim Boot –
  geschlafen wird nur über explizite `enter`-Aufrufe.

## Ladezustands-Schätzung (ab v0.3.0, Akkutyp-Wahl ab v0.6.0)

Die %-Anzeige wird aus der Ruhespannung über typabhängige Kennlinien
interpoliert. Akkutyp wählbar über:
- HA-Select `select.esp_c3_voltmeter_akkutyp` (Blei-Gel / AGM /
  LiFePO4 4S / Li-Ion 3S) – überlebt Sleep-Zyklen (`restore_value`)
- Flash-Default: Substitution `battery_type_default` (0–3)

Kennlinien (Spannung bei 0/20/40/60/80/90/100 %):
- Blei-Gel: 10,5 / 11,7 / 12,0 / 12,2 / 12,5 / 12,7 / 12,85 V
- AGM: 10,8 / 11,85 / 12,15 / 12,3 / 12,6 / 12,8 / 13,0 V
- LiFePO4 (4S): 10,0 / 12,0 / 12,8 / 13,0 / 13,2 / 13,4 / 13,6 V
- Li-Ion (3S): 9,0 / 10,2 / 10,8 / 11,4 / 12,0 / 12,4 / 12,6 V

Nur bei Ruhespannung aussagekräftig; LiFePO4-Kurve sehr flach → grobe
Näherung. Für echte SoC-Messung müsste der Shunt beschaltet und
Coulomb-Counting implementiert werden.

## Dateien im Projekt

- `README.md` – zentrale Projektdoku mit allen Verkabelungsskizzen,
  Entitäten und Einstellungen
- `esphome/esp-c3-voltmeter.yaml` – ESPHome-Konfiguration
- `CHANGELOG.md` – ausführlicher Änderungsverlauf pro Version
- `secrets.example.yaml` – Vorlage für benötigte Secrets (WiFi, API, OTA)
- `AGENTS.md` – diese Datei

## Workflow-Regeln (verbindlich)

1. **Versionsnummer:** Bei jeder Änderung die Version in
   `esphome.project.version` der YAML erhöhen (Semantic Versioning):
   - `PATCH` – Bugfixes, kleine Anpassungen, Kalibrierung
   - `MINOR` – neue Funktionen, Sensoren, Anzeigeseiten
   - `MAJOR` – Breaking Changes (Pin-Änderungen, Entity-Umbenennungen,
     geänderte Messbereiche)
2. **Changelog:** Jede Änderung bekommt einen ausführlichen Eintrag in
   `CHANGELOG.md`: Version, Datum, was geändert wurde, **warum**, betroffene
   Dateien und ggf. Punkte, die auf dem Gerät verifizierbar sind.
3. **README-Pflicht:** Die `README.md` ist die zentrale Projektdoku
   (inkl. aller Verkabelungsskizzen, Entitätenliste und Substitutions-
   Tabelle). Sie wird **bei jeder Änderung automatisch mitgepflegt** –
   neue Skizzen, geänderte Pins/Entitäten/Defaults müssen dort sofort
   eingearbeitet werden.
4. **Secrets:** Keine Zugangsdaten ins Repository – immer `!secret`
   verwenden. Benötigte Secrets sind in `secrets.example.yaml`
   dokumentiert. `secrets.yaml` steht in der `.gitignore`.
5. **Verifizierung:** Vor dem Flashen `esphome config` / die
   Validate-Funktion des ESPHome Builders nutzen. Nach OTA-Updates
   kurz Log und Display prüfen.
6. **Sprache:** Kommentare und Dokumentation in Deutsch.
7. **AI-Hinweis:** Das Projekt wurde mit **Devin** (AI-Coding-Agent von
   Cognition, Modell SWE-2) erstellt; der Hinweis steht oben in der
   `README.md` und soll dort erhalten bleiben. Hardware-Infos aus
   Fremdquellen werden immer mit Quellenangabe dokumentiert.

## Bekannte Stolpersteine

- 0,42"-OLED: falscher Offset → Anzeige unsichtbar/verschoben. Erst mit
  Testtext/Kalibrierrahmen (`oled_frame`) kalibrieren.
- ESP32-C3: Ohne `USB_SERIAL_JTAG` keine Log-Ausgabe über USB.
- INA226: `max_current` und `shunt_resistance` müssen zur Bestückung des
  Moduls und zum erwarteten Messbereich passen, sonst stimmen
  Strom-/Leistungswerte nicht.
- Deep Sleep: OTA nur im Wachfenster → vorher Deep-Sleep-Switch aus.
