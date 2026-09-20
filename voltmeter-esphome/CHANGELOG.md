# Changelog – ESP-C3 Voltmeter (ESPHome)

Alle Änderungen an diesem Projekt werden hier ausführlich dokumentiert.
Versionierung nach Semantic Versioning, die Version steht in
`esphome.project.version` der Datei `esphome/esp-c3-voltmeter.yaml`.

> Dieses Repo wurde aus dem gemeinsamen Entwicklungsprojekt
> abgespalten; die LoRaWAN-Varianten (XIAO nRF52840, BaseNode328)
> liegen in einem separaten Repo. Einträge bis v0.7.1 stammen aus der
> gemeinsamen Historie.

## [0.7.1] – 2026-09-19

### Hinzugefügt
- **OTA-Passwort:** `ota.platform: esphome` bekommt `password:` via
  `!secret esp_c3_voltmeter__ota_password` – schuetzt vor unbefugten
  OTA-Uploads aus demselben Netz. Pro Geraet eigenes, zufaelliges
  Passwort in der `secrets.yaml` generieren und hinterlegen;
  `secrets.example.yaml` dokumentiert den Secret-Namen.

## [0.7.0] – 2026-09-19

### Hinzugefügt
- **API-Verschlüsselung:** `api.encryption.key` via
  `!secret esp_c3_voltmeter__encryption_key` – die native
  HA-API-Verbindung ist ab jetzt verschluesselt (Noise).
  Key wurde vom Nutzer in ESPHome Builder generiert und in der
  `secrets.yaml` hinterlegt; `secrets.example.yaml` dokumentiert
  den Secret-Namen.

### Hinweis
- Home Assistant nutzt den Key automatisch, wenn das Gerät über den
  ESPHome Builder verwaltet wird. Falls das Gerät schon unverschlüsselt
  eingebunden war, in HA einmal neu verbinden/aktualisieren lassen.

## [0.6.1] – 2026-09-19

### Behoben
- ESPHome-Validierungsfehler: `optimistic` ist bei Template-Select nicht
  zusammen mit `lambda` erlaubt → `optimistic: true` entfernt. Der
  Ist-Zustand kommt ohnehin aus dem Lambda (Global `battery_type_idx`),
  optimistic war redundant.

## [0.6.0] – 2026-09-19

### Hinzugefügt
- **HA-Select „Akkutyp"** (`select.esp_c3_voltmeter_akkutyp`) mit vier
  Modi: Blei-Gel, AGM, LiFePO4 (4S), Li-Ion (3S). Umschaltbar zur
  Laufzeit; Auswahl liegt im Global `battery_type_idx` mit
  `restore_value` → überlebt Deep-Sleep-Zyklen.
- Substitution `battery_type_default` (0–3) als Flash-Default.
- Kennlinien je Akkutyp (Spannung→%, stückweise linear interpoliert)
  direkt im `on_value`-Lambda der Busspannung; der Template-Sensor
  „Batterieladung" wird per `sensor.template.publish` gefüllt.

### Geändert
- **Breaking:** `copy`-Sensor mit festem `calibrate_linear` (reine
  Blei-Kennlinie) durch Template-Sensor + typabhängige Interpolation
  ersetzt. Entity-ID bleibt `sensor.esp_c3_voltmeter_batterieladung`.

### Kennlinien (Ruhespannung, 0/20/40/60/80/90/100 %)
- Blei-Gel: 10,5 / 11,7 / 12,0 / 12,2 / 12,5 / 12,7 / 12,85 V
- AGM: 10,8 / 11,85 / 12,15 / 12,3 / 12,6 / 12,8 / 13,0 V
- LiFePO4 (4S): 10,0 / 12,0 / 12,8 / 13,0 / 13,2 / 13,4 / 13,6 V
- Li-Ion (3S): 9,0 / 10,2 / 10,8 / 11,4 / 12,0 / 12,4 / 12,6 V

### Einschränkung
- LiFePO4 hat eine sehr flache Entladekurve (~13,2→12,8 V über fast den
  ganzen Bereich) → die %-Anzeige ist dort nur eine grobe Näherung;
  echte SoC-Bestimmung bräuchte Coulomb-Counting über den Shunt.

## [0.5.2] – 2026-09-19

### Geändert
- **Offset kalibriert:** `oled_offset_x`/`y` auf die am Gerät verifizierten
  Werte (28, 24) gesetzt – Herstellerangabe (13, 14) war falsch und hat
  die linke Zeichenkante abgeschnitten.
- Display-Layout: Spannung von y+6 auf y+2 verschoben (höher),
  Ladeprozent von Schriftgröße 12 auf neue `font_mid` (Roboto 16)
  vergrößert und auf y+23 gesetzt.

### Hinweis
- Der Kalibrierrahmen (`oled_frame`) bleibt verfügbar, Default
  `"false"`.

## [0.5.1] – 2026-09-19

### Behoben
- Display: Bei „12,xx V"-Anzeige war die führende „1" links abgeschnitten
  → der tatsächliche Start des sichtbaren Fensters liegt vermutlich
  ein paar Pixel rechts von der Herstellerangabe (13, 14).

### Hinzugefügt
- Substitution `oled_frame` (`"true"`/`"false"`): zeichnet einen Rahmen
  exakt um den angenommenen 72×40-Bereich. Damit kann der Offset kalibriert
  werden: `oled_frame: "true"` flashen, `oled_offset_x`/`y` justieren bis
  der Rahmen auf allen vier Seiten sichtbar ist, dann wieder `"false"`.

### Anleitung zur Kalibrierung
1. `oled_frame: "true"` + `deep_sleep_enabled: "false"` flashen
2. Wenn die linke Rahmenlinie fehlt: `oled_offset_x` erhöhen
   (bei „1" abgeschnitten z. B. auf 16–18 testen)
3. `oled_offset_y` anpassen, bis Rahmen oben/unten passt
4. `oled_frame` wieder `"false"`, `deep_sleep_enabled` zurück auf `"true"`

## [0.5.0] – 2026-09-19

### Hinzugefügt
- **Flash-Flag für Deep Sleep:** Substitution `deep_sleep_enabled`
  (`"true"`/`"false"`) – vor dem Flashen entscheiden, ob Deep Sleep
  überhaupt aktiv ist (praktisch für Updates und Debugging).
- **HA-Switch „Deep Sleep"** (`switch.esp_c3_voltmeter_deep_sleep`):
  Deep Sleep zur Laufzeit ein-/ausschalten. Aus = dauerhaft wach;
  An = Rückkehr in den Schlafzyklus über den Fallback-Timer.
- **HA-Number „Schlafintervall"** (`number.esp_c3_voltmeter_schlafintervall`):
  Schlafdauer zur Laufzeit ändern (1–720 min), ruft
  `set_sleep_duration` auf dem Deep-Sleep-Component auf.
- Neue Globals `sleep_enabled` + `sleep_interval_min` mit
  `restore_value: yes` → liegen im RTC-RAM des ESP32 und überleben
  Deep-Sleep-Zyklen; erst bei Stromtrennung gilt wieder der
  Flash-Default (`deep_sleep_enabled`/`sleep_minutes`).

### Geändert
- Substitution `sleep_time` durch `sleep_minutes` ersetzt;
  `deep_sleep.sleep_duration` wird daraus als `${sleep_minutes}min`
  gebildet und beim Boot zusätzlich aus dem Global angewendet.
- **Entfernt (Breaking):** API-Services `prevent_deep_sleep` /
  `allow_deep_sleep` und Global `maintenance_mode` wurden durch den
  HA-Switch ersetzt – bequemer, persistenter und als Entität sichtbar.

### Dokumentation
- `AGENTS.md`: Deep-Sleep-Abschnitt auf die drei Steuerebenen
  (Flash-Default, HA-Switch/Number, Safety-Prevent) aktualisiert.

## [0.4.0] – 2026-09-19

### Hinzugefügt
- **Deep Sleep:** Gerät schläft zwischen den Messungen
  (`sleep_duration: 10min`, über Substitution `sleep_time` einstellbar).
  Ablauf: Boot → Deep Sleep vorerst verhindert → sobald der
  HA-API-Client verbunden ist (`on_client_connected`), 5 s warten
  (Sensor publiziert 1×/s → Werte sicher übertragen) → schlafen.
- Fallback-Timer: Ohne HA-Verbindung spätestens nach 60 s einschlafen
  (Script `sleep_fallback`), damit die Batterie nicht durch
  Dauer-Wachsein leergezogen wird.
- Maintenance-Modus: HA-Services `prevent_deep_sleep` / `allow_deep_sleep`
  (via `globals: maintenance_mode` abgesichert, damit ein Reconnect nicht
  ungewollt den Sleep auslöst). Für OTA vorher `prevent_deep_sleep`
  aufrufen.
- `wifi: fast_connect: true` – verkürzt die Wachphase bis zur
  API-Verbindung.

### Dokumentation
- `AGENTS.md`: Versorgungsskizze um Schottky-Verpolschutz (1N5822, Kathode
  Richtung Wandler) erweitert; VBS zapft vor der Diode ab, damit die
  Messung nicht um den Flussabfall verfälscht wird.
- `AGENTS.md`: Neuer Abschnitt „Deep Sleep" mit Ablauf, `sleep_time`-
  Substitution, Maintenance-Services und Hinweis, dass das OLED im Sleep
  den letzten Messwert weiter anzeigt (~10–15 mA; Blanken wäre sparsamer).

### Hinweis
- OTA-Updates sind nur im ~10–15-s-Wachfenster möglich → vor dem Flashen
  `prevent_deep_sleep` aus HA aufrufen oder per USB flashen.

## [0.3.0] – 2026-09-19

### Hinzugefügt
- Neuer Sensor „Batterieladung" (`sensor.esp_c3_voltmeter_batterieladung`,
  `device_class: battery`): geschätzter Ladezustand in %, abgeleitet aus
  der Busspannung über die Ruhespannungs-Kennlinie eines 12-V-Bleiakkus
  (`copy`-Sensor + `calibrate_linear`, 10,5 V = 0 % bis 12,7 V = 100 %,
  auf 0–100 % begrenzt).
- OLED-Zeile 2 zeigt jetzt den Ladezustand in % statt dem festen Text
  „Batterie".

### Bekannte Einschränkung
- Die %-Anzeige ist nur bei Ruhespannung aussagekräftig: beim Laden
  zeigt sie 100 % (Spannung > 12,7 V), unter Last entsprechend zu wenig.

### Kontext
- Batterietyp bestätigt: 12-V-Blei/Blei-Gel (9–140 Ah).
- MP1584-Modul als DC-DC-Wandler für geeignet befunden (Eingang bis
  28 V ≫ 14,8 V Ladeschluss); Hinweis: bei Betrieb im laufenden
  Fahrzeug TVS-Diode wegen Load-Dump-Spitzen empfohlen.

## [0.2.0] – 2026-09-19

### Geändert
- OLED-Anzeige verschlankt: statt drei Zeilen (Spannung/Strom/Leistung) jetzt
  nur noch die Batteriespannung groß und zentriert (`%.2f V`) plus
  Zeilenbeschriftung „Batterie". Grund: Es wird nur Spannung gemessen,
  Strom/Leistung wären dauerhaft ~0.
- `update_interval` des INA226 von 2 s auf 1 s reduziert, damit die
  Anzeige auf dem Display quasi live aktualisiert.
- Sensoren Strom/Leistung/Shunt-Spannung bleiben in der YAML aktiv und
  stehen weiterhin als Entitäten in Home Assistant zur Verfügung, werden
  aber nicht mehr auf dem Display dargestellt.

### Dokumentation
- `AGENTS.md`: Neuer Abschnitt „Stromversorgung des ESP32 aus der Batterie"
  mit Skizze und Wandler-Empfehlungen nach Eingangsspannung
  (Mini360/MP1584, Traco TSR 1-2450, Pololu D36V28F5).
- `AGENTS.md`: Hinweise zur Ausgangsstabilität bei schwankender
  Eingangsspannung ergänzt (Line Regulation, Dropout-Grenze, Buck-Boost-
  Alternative, TVS-Diode, Verifikationsvorgehen).
- `AGENTS.md`: Versorgungsskizze um Schutzbeschaltung erweitert
  (Sicherung ~1 A, TVS 1.5KE16A mit Einbauhinweis, optionaler
  Verpolschutz per Schottky). Abschnitt Unterspannung ergänzt:
  Elektronik ungefährdet (nur Brownout-Reset), kritisch ist die
  Bleibatterie (Tiefentladung/Sulfatation); Eigenverbrauch des
  Monitors (~30–80 mA) und Deep-Sleep-Option dokumentiert.
- `AGENTS.md`: Verkabelungsplan um ASCII-Skizze und Anschlusstabelle
  (inkl. ALERT- und VBS-Hinweis) erweitert.
- `AGENTS.md`: Eigene Skizze für die Variante „nur Batteriespannung messen"
  ergänzt (Batterie+ an VBS, Batterie− an GND, IN+/IN− brücken).
- Shunt-Bestückung R100 (0,1 Ω) auf dem INA226-Modul vom Nutzer bestätigt;
  `shunt_resistance: 0.1 ohm` und `max_current: 3.2A` in der YAML damit korrekt.
- Anwendungsfall präzisiert: Es soll nur die Spannung einer Batterie
  gemessen werden (keine Strom-/Leistungsmessung nötig).

## [0.1.0] – 2026-09-19

### Hinzugefügt
- Erste ESPHome-Basis-Konfiguration für das AITRIP ESP32-C3-Board mit 0,42"-OLED.
- I2C-Bus auf GPIO5 (SDA) / GPIO6 (SCL), gemeinsam für OLED und INA226.
- INA226-Sensor (`0x40`) mit Busspannung, Shunt-Spannung, Strom und Leistung;
  `shunt_resistance: 0.1 ohm`, `max_current: 3.2A` als Ausgangswerte.
- OLED-Ausgabe (SSD1306_128X64, `0x3C`): Spannung groß, Strom in mA und
  Leistung in W darunter. Zeichen-Offset (13, 14) laut Herstellerangabe,
  über `oled_offset_x`/`oled_offset_y` kalibrierbar.
- WiFi mit Fallback-AP + Captive Portal, OTA-Updates, Home-Assistant-API,
  Logging über `USB_SERIAL_JTAG`.
- `secrets.example.yaml` als Vorlage für benötigte Secrets.
- `AGENTS.md` mit Hardware-Doku, Verkabelung und Workflow-Regeln.

### Zu verifizieren
- OLED-Offset: falls Anzeige leer/verschoben → Werte um (28, 24) testen.
- Tatsächliche Shunt-Bestückung des INA226-Moduls (R100?).
- I2C-Scan im Log: OLED (`0x3C`) und INA226 (`0x40`) müssen gefunden werden.
