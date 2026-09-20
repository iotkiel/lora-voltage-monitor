# Changelog – LoRaWAN Batterie-Voltmeter (TTN)

Alle Änderungen an diesem Projekt werden hier ausführlich dokumentiert.
Jede Variante hat eine eigene Versionsnummer im Sketch-Header.

> Dieses Repo wurde aus dem gemeinsamen Entwicklungsprojekt
> abgespalten; die ESP32-C3/ESPHome-Variante (WLAN + OLED) liegt in
> einem separaten Repo.

## [Unreleased]

### Repo-Split
- Projekt in zwei GitHub-Repos aufgeteilt: ESPHome/WLAN-Variante und
  LoRaWAN-Varianten. `ttn_keys.h` → `ttn_keys.example.h` umbenannt und
  per `.gitignore` ausgeschlossen (Schutz vor Key-Leaks).

### Variante C – Firmware 0.2.0
- **Pinmap korrigiert** nach Originalquelle: `nss=6, rst=5,
  dio={2,3,4}` (statt angenommener 10/9/2/3), übernommen aus
  `NucleonBake/Bake_Typ_01.ino` im Repo
  https://gitlab.com/iotssl/nucleon-nodes (Nucleon e.V., GPLv3).
  DIO2=D4 jetzt verbunden.
- Quellenangabe im Sketch-Header ergänzt.
- README: herausgeführte PCB-Stiftleiste dokumentiert (Aufdruck:
  A3 A2 SDA A0 RXD MISO AIN VCC SCL A1 TXD SCLK MOSI GND) – bestätigt
  Pinmap (NSS nicht rausgeführt = intern D6); INA226 steckt an den
  beschrifteten SDA/SCL-Pins; `AIN` als zu verifizierender Analogeingang
  markiert. Skizze auf SDA/SCL-Beschriftung angepasst.

### Hinzugefügt – neue Variante C (LoRaWAN, BaseNode328)
- `firmware/atmega328-rfm95-lorawan/` – Firmware für Arduino Pro Mini
  3,3 V/8 MHz + RFM95W (BaseNode328, SX1276): MCCI-LMIC OTAA,
  INA226 an Hardware-I2C A4/A5, gleiches 3-Byte-Payload-Format
  (mV + SoC %) und gleiche SoC-Kennlinien wie Variante B.
- `ttn_keys.h` mit LMIC-Reihenfolge (DevEUI/JoinEUI = LSB!,
  AppKey = MSB) – abweichend von Variante B.
- `platformio.ini` für `pro8MHzatmega328` mit `DISABLE_PING`/
  `DISABLE_BEACONS` (32-KB-Flash!).

### Dokumentation – Quellen & AI-Hinweis
- `README.md`: Abschnitt „Quelle: Nucleon-Nodes" neu – Repo-Infos
  (Workshop Nucleon e.V., Nov. 2018, GPLv3), verifizierte Pinmap,
  NucleonBake-Funktion (SF-Sweep-Funkbake, stündlicher Uplink),
  Original-Stack (arduino-lmic/LowPower/adcvcc) und Aufbau-Bericht
  dokumentiert.
- `README.md`: KI-Hinweis im Kopf – Projekt wurde vollständig mit
  **Devin** (AI-Coding-Agent von Cognition, Modell SWE-2) erstellt.
- `AGENTS.md`: Variante-C-Block um Hardware-Quelle (Nucleon-Repo,
  Regler-/LED-Ausbau, 2×AA an VCC) erweitert; Regel
  „AI-Hinweis/Quellenangaben" ergänzt.
- README: Versorgung Variante C korrigiert – auf den Boards sind
  Regler+Power-LED ausgelötet → direkte Versorgung mit 2× AA (~3 V)
  an VCC; Warnung „keine 5 V auf VCC", INA226-Mindestspannung 2,7 V
  und BOD-Hinweis dokumentiert.
- README: MP1584 auf 3,3 V → VCC als Versorgungsoption ergänzt
  (Elko 220–470 µF wegen RFM95-TX-Bursts, Poti fixieren).

### Variante B – Struktur-Anpassung (Arduino-IDE-tauglich)
- `xiao-nrf52840-lorawan.ino` als Sketch-Stub im Ordner-Root ergänzt
  (Arduino IDE kann den Sketch jetzt direkt öffnen und kompiliert
  `src/main.cpp` mit; PlatformIO ignoriert die `.ino`).
- `ttn_keys.h` von `include/` nach `src/` verschoben → Quote-Include
  funktioniert in beiden Toolchains, Datei erscheint als IDE-Tab.
- README: Board-Core korrigiert – **Adafruit nRF52** statt Seeed-mbed
  (`Wire.setPins` wird vom mbed-Core nicht unterstützt, ohne Remap
  würde der INA226 nicht erreichbar).

### Variante B – Firmware 0.1.1
- `UPLINK_INTERVAL_MIN` von 10 auf **5 min** geändert (Debugging-Phase)
  und als markierter Define-Block oben in `main.cpp` hervorgehoben.

### Hinzugefügt – neue Variante B (LoRaWAN)
- `firmware/xiao-nrf52840-lorawan/` – Arduino/PlatformIO-Firmware für
  Seeed XIAO nRF52840 + Wio-SX1262 + INA226, Uplink zu The Things
  Network per OTAA (EU868, LoRaWAN 1.0.x, RadioLib ≥7.1).
- Payload: 3 Byte auf FPort 10 (Spannung mV uint16 BE + SoC %),
  `ttn_payload_formatter.js` als TTN-Decoder.
- SoC-Kennlinien identisch zur ESPHome-Variante (`BATTERY_TYPE` 0–3,
  Default Blei-Gel); `UPLINK_INTERVAL_MIN` Default 10 min.
- Wichtig: Wio-SX1262 belegt D4/D5 (Standard-I2C) → INA226 per
  `Wire.setPins` auf D6/D7. LoRa-Pins: NSS=D4, DIO1=D1, RST=D2,
  BUSY=D3, RXEN(LNA)=D5, SPI=D8/9/10, TCXO 1,8 V.
- `src/ttn_keys.h` als Platzhalter für DevEUI/JoinEUI/AppKey
  (nicht committen → jetzt `ttn_keys.example.h` + `.gitignore`).

### Dokumentation
- `README.md`: Projekt auf zwei Bauarten umstrukturiert; Variante B mit
  Verdrahtungsskizze, TTN-Setup und Firmware-Übersicht.
- `AGENTS.md`: neues „Modulares Bauarten-Konzept" mit gemeinsamer Basis
  (INA226/VBS, Payload-Format, Kennlinien) und Anleitung, wie weitere
  Bauarten aufgenommen werden.
- `README.md`: Hinweis auf einfache Testlasten zum Einstellen des
  DC-DC-Wandlers (USB-LED/Ventilator, 10-Ω/5-W-Widerstand = 0,5 A).
- `README.md`: Abschnitt „Flashen" für Variante B ergänzt (PlatformIO-
  Upload via XIAO-BOOT-Laufwerk bzw. Arduino-IDE-Pfad mit
  Adafruit-Board-URL).
- Arduino-IDE-Build-Fehler durch Leerzeichen/Sonderzeichen im Projektpfad
  → Sketch-Kopie nach `Documents\Arduino\` legen; README-Hinweis ergänzt.
- `AGENTS.md`: Regel Secrets erweitert – `no-export!`-Ordner enthalten
  echte Secrets und werden nicht versioniert/exportiert.
- `README.md`: Ausführliche TTN-Einrichtungsanleitung (Cluster, Application,
  End-Device-Registrierung mit „Resets DevNonces"-Hinweis für RadioLib,
  Key-Eintragung, Payload-Formatter, Live-Data-Check, optionaler
  MQTT→Home-Assistant-Pfad, Fair-Use-Hinweis).
- `README.md`: Variante-B-Skizze zu vollständigem Pin-Layout erweitert –
  alle Pins des XIAO nRF52840 (Draufsicht, USB-C oben als Orientierung)
  mit Funktion (LoRa intern / I2C-Remap / Versorgung) plus INA226-
  Pinleiste und Verdrahtungstabelle.
