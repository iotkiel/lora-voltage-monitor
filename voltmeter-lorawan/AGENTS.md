# AGENTS.md – LoRaWAN Batterie-Voltmeter (The Things Network)

## Projektübersicht

- **Ziel:** Batteriespannungsmessung per INA226, Übertragung per
  LoRaWAN/OTAA an The Things Network – modular aufgebaut in
  **Bauarten/Varianten** mit gleichem Messprinzip und Payload-Format.
- **Variante B:** Seeed XIAO nRF52840 + Wio-SX1262
  (Verzeichnis `firmware/xiao-nrf52840-lorawan/`, Arduino/PlatformIO,
  RadioLib ≥7.1).
- **Variante C:** BaseNode328 (Arduino Pro Mini 3,3 V/8 MHz + RFM95W)
  (Verzeichnis `firmware/atmega328-rfm95-lorawan/`, MCCI-LMIC;
  Keys LSB/MSB beachten; INA226 an A4/A5).
  **Hardware-Quelle:** Workshop-Platinen des Nucleon e.V. (Nov. 2018),
  Original-Repo https://gitlab.com/iotssl/nucleon-nodes (GPLv3) –
  verifizierte LMIC-Pinmap `nss=6, rst=5, dio={2,3,4}` aus
  `NucleonBake/Bake_Typ_01.ino`; Aufbau-Bericht:
  hositests.com/2018/11/20/lorawan-basteln-eines-node/. Boards sind
  umgebaut: Regler + Power-LED ausgelötet → Versorgung direkt 2× AA
  (~3 V) an VCC, **nie 5 V auf VCC**.
- **Schwesterprojekt:** ESP32-C3/ESPHome-Variante (WLAN + OLED) liegt
  in einem eigenen Repo.
- **Versionierung:** Jede Variante wird separat versioniert
  (Version-Kommentar im Sketch-Header).

## Modulares Bauarten-Konzept

Gemeinsame Basis aller Varianten:
- INA226-Modul (I2C `0x40`, R100-Shunt) an VBS = Batteriespannung,
  Shunt-Eingänge frei/gebrückt.
- LoRaWAN OTAA (EU868), Uplink auf **FPort 10**: 3 Byte
  (Spannung mV uint16 BE + SoC %). Decoder:
  `ttn_payload_formatter.js` (in Variante B mitgepflegt, für alle
  Varianten identisch).
- SoC-Schätzung aus Ruhespannung mit identischen Kennlinien
  (Blei-Gel/AGM/LiFePO4-4S/Li-Ion-3S) – Kennlinien-Änderungen an
  **allen** Varianten synchron pflegen.
- Versorgung je nach Variante (siehe README); Schutzkette bei
  Batterieversorgung: Sicherung → Schottky → TVS → DC-DC.

**Neue Bauart aufnehmen:**
1. Eigenes Unterverzeichnis `firmware/<name>/` mit eigener
   Versionsnummer.
2. Verdrahtungsskizze + Abschnitt in `README.md` ergänzen.
3. Abschnitt in dieser Datei ergänzen + `CHANGELOG.md`-Eintrag.
4. Pin-Konflikte prüfen (Beispiel: Wio-SX1262 belegt D4/D5 → I2C des
   INA226 musste auf D6/D7 per `Wire.setPins` umgelegt werden).
5. LMIC- vs. RadioLib-Key-Reihenfolge beachten (LMIC: EUIs = LSB!).

## Hardware

### INA226 Strom-/Spannungssensor (Amazon ASIN B0DW2Q8WRH)

- QUARKZMAN INA226 I2C-Breakout, 16-Bit, bidirektional
- Busspannung 0–36 V, Versorgung 2,7–5,5 V
- I2C-Adresse `0x40` (über A0/A1 änderbar), Shunt R100 = 0,1 Ω
- Nur-Spannungsmessung: Batterie(+) → VBS, Batterie(−) → GND,
  IN+/IN− brücken.

### XIAO nRF52840 + Wio-SX1262 (Variante B)

- Wio-SX1262 steckt auf dem XIAO: NSS=D4, DIO1=D1, RST=D2, BUSY=D3,
  RXEN(LNA)=D5, SPI=D8/9/10, TCXO 1,8 V, DIO2-RF-Switch.
- **Pin-Konflikt:** D4/D5 = Standard-I2C → INA226 läuft auf D6/D7
  via `Wire.setPins`. Dafür ist der **Adafruit nRF52 Core** Pflicht
  (Seeed-mbed-Core unterstützt `Wire.setPins` nicht).
- Versorgung: MP1584 → 5 V auf den 5V-Pin/Pad.

### BaseNode328 (Variante C)

- Pro Mini 3,3 V/8 MHz + RFM95W auf PCB; Regler + Power-LED ausgelötet.
- LMIC-Pinmap: `nss=6, rst=5, dio={2,3,4}` (verifiziert aus
  Nucleon-Repo).
- Stiftleiste (Aufdruck): `A3 A2 SDA A0 RXD MISO AIN VCC SCL A1 TXD
  SCLK MOSI GND` – NSS nicht rausgeführt (intern D6); `AIN` = zu
  verifizierender Analogeingang.
- Versorgung: 2× AA (~3 V) direkt an VCC, LiPo oder MP1584 auf 3,3 V.
  **Nie 5 V auf VCC** (kein Regler → RFM95 stirbt).
- FTDI zum Flashen: 3,3-V-Version.
- ATmega328P: 32 KB Flash → `DISABLE_PING`/`DISABLE_BEACONS` gesetzt;
  `LMIC_setClockError(5 %)` wegen 8-MHz-Internoszillator-Toleranz.
- Schlafmodus mit LowPower/adcvcc wie im Original-Stack ist ein
  möglicher Folgeschritt (LMIC-Timing beachten).

## Dateien im Projekt

- `README.md` – zentrale Projektdoku (Skizzen, TTN-Setup, Pinmaps)
- `firmware/xiao-nrf52840-lorawan/` – Variante B:
  `platformio.ini`, `src/main.cpp`, `src/ttn_keys.example.h`,
  `xiao-nrf52840-lorawan.ino` (IDE-Stub), `ttn_payload_formatter.js`.
  Dual-Toolchain: PlatformIO nutzt `src/`, Arduino IDE öffnet die
  `.ino` (kompiliert `src/` mit).
- `firmware/atmega328-rfm95-lorawan/` – Variante C:
  `.ino` (kompletter Sketch), `ttn_keys.example.h`, `platformio.ini`.
- `CHANGELOG.md` – Änderungsverlauf
- `AGENTS.md` – diese Datei

## Workflow-Regeln (verbindlich)

1. **Versionsnummer:** Bei jeder Änderung die Version im Sketch-Header
   der betroffenen Variante erhöhen (Semantic Versioning; MAJOR bei
   Pin-Änderungen/Breaking).
2. **Changelog:** Jede Änderung bekommt einen ausführlichen Eintrag in
   `CHANGELOG.md`: Version/Variante, Datum, was geändert wurde, **warum**,
   betroffene Dateien und ggf. Punkte, die auf dem Gerät verifizierbar sind.
3. **README-Pflicht:** Die `README.md` ist die zentrale Projektdoku
   (alle Verkabelungsskizzen, Pinmaps, TTN-Setup). Sie wird **bei jeder
   Änderung automatisch mitgepflegt**.
4. **Secrets:** Keine TTN-Keys ins Repository – `ttn_keys.h` steht in
   der `.gitignore`; im Repo liegt nur `ttn_keys.example.h`.
   Ordner mit Suffix `no-export!` enthalten echte Keys und werden
   **nicht** versioniert/exportiert.
5. **Verifizierung:** Vor dem Flashen PlatformIO-Build; auf dem Gerät
   Join + ersten Uplink im Serial Monitor (115200) und in TTN Live
   Data prüfen. Antenne vor LoRa-Betrieb anschrauben.
6. **Sprache:** Kommentare und Dokumentation in Deutsch.
7. **AI-Hinweis:** Das Projekt wurde mit **Devin** (AI-Coding-Agent von
   Cognition, Modell SWE-2) erstellt; der Hinweis steht oben in der
   `README.md` und soll dort erhalten bleiben. Hardware-Infos aus
   Fremdquellen (z. B. Nucleon-Repo) werden immer mit Quellenangabe
   dokumentiert.

## Bekannte Stolpersteine

- **Arduino IDE + Pfad mit Leerzeichen/Sonderzeichen** → Build bricht
  ab („g++: No such file or directory" mit Pfad-Fragmenten). Sketch in
  einen Pfad ohne Leerzeichen kopieren (z. B. `Documents\Arduino\`).
- **RadioLib:** In TTN „Resets DevNonces" aktivieren, sonst schlägt
  der Re-Join nach Reset fehl.
- **LMIC-Keys:** DevEUI/JoinEUI = LSB (Bytes umkehren!), AppKey = MSB.
- **XIAO:** Adafruit-Core Pflicht (`Wire.setPins`), Doppel-Reset für
  den XIAO-BOOT-Bootloader.
- **Variante C:** Nie 5 V auf VCC; TTN-Fair-Use (~30 s Airtime/Tag)
  → Produktiv-Intervall ≥10–15 min.
