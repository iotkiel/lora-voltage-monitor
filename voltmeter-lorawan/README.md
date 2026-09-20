# Batterie-Voltmeter – LoRaWAN / The Things Network

Batteriespannungsmessung mit INA226, Übertragung per LoRaWAN an
The Things Network – modular in zwei Bauarten:

- **Variante B:** Seeed XIAO nRF52840 + Wio-SX1262 (RadioLib)
- **Variante C:** BaseNode328 – Arduino Pro Mini 3,3 V + RFM95W (LMIC)

Gemeinsam: INA226-Messprinzip (nur VBS, Shunt frei), identische
SoC-Kennlinien, gleiches Uplink-Format (FPort 10: mV + %).

> **Hinweis:** Dieses Projekt (Firmware und Dokumentation) wurde
> vollständig mit **Devin** erstellt – dem AI-Coding-Agenten von
> Cognition (Modell SWE-2), interaktiv über die Devin-CLI im Editor.
> Bitte beim Übernehmen von Code die üblichen Vorsichtsmaßnahmen
> beachten (Hardware-Verkabelung vor dem Anschließen verifizieren).

## Datei-Layout

```
firmware/
├── xiao-nrf52840-lorawan/        Variante B
│   ├── xiao-nrf52840-lorawan.ino IDE-Einstieg (Stub, Code in src/)
│   ├── platformio.ini            Board xiaoble, RadioLib + INA226
│   ├── src/main.cpp              eigentlicher Code
│   ├── src/ttn_keys.example.h    → nach ttn_keys.h kopieren, Keys eintragen
│   └── ttn_payload_formatter.js  TTN-Uplink-Decoder
└── atmega328-rfm95-lorawan/      Variante C
    ├── atmega328-rfm95-lorawan.ino  kompletter Sketch
    ├── platformio.ini               Board pro8MHzatmega328, MCCI-LMIC
    └── ttn_keys.example.h           → nach ttn_keys.h kopieren (LSB/MSB!)
```

`ttn_keys.h` steht in der `.gitignore` → echte Keys landen nie im Repo.

---

# Variante B – XIAO nRF52840 + Wio-SX1262

Übertragung über LoRaWAN ins The Things Network. Firmware =
Arduino/PlatformIO (`firmware/xiao-nrf52840-lorawan/`), RadioLib (OTAA)
+ Rob Tillaart INA226.

**Wichtig:** Das Wio-SX1262-Modul steckt direkt auf dem XIAO und belegt
**D4/D5** (Standard-I2C!) sowie D1/D2/D3. Der INA226 wird daher per
`Wire.setPins` auf **D6/D7** betrieben. LoRa-Pins intern: NSS=D4,
DIO1=D1, RST=D2, BUSY=D3, RXEN(LNA)=D5, SPI=D8/D9/D10.

### Pin-Layout (Draufsicht, USB-C oben = Orientierung)

```
   ┌──────────────────────── USB-C ───────────────────────┐
   │              XIAO nRF52840                           │
   │              (Wio-SX1262 auf der Unterseite)         │
   │                                                      │
   D0   (frei)              ●─┐                     ┌─●   5V  ◄── von MP1584 (DC-DC 5V)
   D1   (DIO1, LoRa)        ●─┤                     ├─●   GND ◄── Batterie(−) + INA226 GND
   D2   (RST,  LoRa)        ●─┤                     ├─●   3V3 ──→ INA226 VCC
   D3   (BUSY, LoRa)        ●─┤                     ├─●   D10 (MOSI, LoRa intern)
   D4   (NSS,  LoRa)        ●─┤                     ├─●   D9  (MISO, LoRa intern)
   D5   (RXEN, LoRa)        ●─┤                     ├─●   D8  (SCK,  LoRa intern)
   D6   (SDA→INA226)        ●─┤                     ├─●   D7  (SCL→INA226)
   │                        └─────────────────────────┘   │
   └──────────────────────────────────────────────────────┘

   ┌──────────────── INA226-Modul (0x40) ────────────────┐
   │   IN+      IN−      VBS                             │  ← Schraubklemme/Lötseite
   │    │        │        └──→ Batterie (+)              │     (geht zur Batterie)
   │    └────────┴── Brücke (Shunt ungenutzt)            │
   │                                                   │
   │   VCC      GND      SCL      SDA      ALERT         │  ← Stiftleiste
   │    │        │        │        │       (frei)        │     (geht zum XIAO)
   │    │        │        │        └──→ XIAO D6          │
   │    │        │        └───────────→ XIAO D7          │
   │    │        └────────────────────→ XIAO GND          │
   │    └─────────────────────────────→ XIAO 3V3          │
   └───────────────────────────────────────────────────┘
```

**Verdrahtung kompakt:**

| XIAO nRF52840 | INA226 | Sonstiges |
|---|---|---|
| 3V3 | VCC | |
| GND | GND | + Batterie(−) |
| D6 | SDA | I2C umgemappt (D4/D5 = LoRa) |
| D7 | SCL | I2C umgemappt |
| 5V | — | ← MP1584 Ausgang (5,0–5,2 V) |
| — | VBS | ← Batterie(+) |
| — | IN+/IN− | miteinander brücken |
| — | ALERT | frei |

- **Versorgung:** Sicherung (~1 A) → Schottky 1N5822 (Kathode Richtung
  Wandler) → TVS 1.5KE16A → MP1584 → 5 V auf den 5V-Pin/Pad des XIAO.
  Batterie+ an VBS, Batterie− an GND. VBS zapft **vor** der Schottky ab.
  Wandler unter Last auf 5,0–5,2 V einstellen (Testlast: USB-LED oder
  10 Ω/5 W = 0,5 A).
- **Antenne nicht vergessen** (868 MHz, EU868) – ohne Antenne kein Join!
- **Voraussetzung:** Ein TTN-Gateway in Reichweite (eigenes oder
  Community-Gateway; Abdeckung unter https://www.thethingsnetwork.org/map
  prüfen).

### Flashen

**PlatformIO (empfohlen):**
1. VS Code + PlatformIO-Erweiterung, Ordner `firmware/xiao-nrf52840-lorawan/` öffnen
2. `src/ttn_keys.example.h` → `src/ttn_keys.h` kopieren, TTN-Keys eintragen
3. XIAO in Bootloader: Reset-Taster **2× schnell** drücken → USB-Laufwerk `XIAO-BOOT` erscheint
4. `pio run -t upload`

**Arduino IDE:**
1. Board-URL `https://adafruit.github.io/arduino-board-index/package_adafruit_index.json`
   hinzufügen → „Adafruit nRF52" installieren → Board **„Seeed XIAO
   nRF52840"** wählen. **Wichtig:** der Adafruit-Core ist Pflicht, weil
   `Wire.setPins()` (I2C-Remap des INA226 auf D6/D7) vom Seeed-mbed-Core
   nicht unterstützt wird.
2. Bibliotheken über den Library Manager: **RadioLib** (≥7.1) +
   **INA226** (Rob Tillaart)
3. `xiao-nrf52840-lorawan.ino` öffnen → `src/main.cpp` und
   `src/ttn_keys.h` erscheinen als Tabs (Keys dort eintragen)
4. Bootloader per Doppel-Reset → Upload; Serial Monitor 115200 Baud

> Datei-Layout: `.ino` im Ordner-Root = IDE-Einstieg (Stub), echter Code
> in `src/`. PlatformIO nutzt `src/` direkt und ignoriert die `.ino`.

> **Stolperstein:** Die Arduino IDE bricht den Build ab, wenn der Sketch-
> Pfad Leerzeichen oder Sonderzeichen enthält (Fehler: „g++: No such file
> or directory" mit Pfad-Fragmenten). Sketch ggf. vor dem Kompilieren in
> einen Pfad ohne Leerzeichen kopieren, z. B. `Documents\Arduino\...`
> (dann taucht er im Menü *Sketchbook* auf). PlatformIO ist davon nicht
> betroffen.

**Beim Flashen beachten:** Batterie-/Wandlerversorgung am 5V-Pin abklemmen;
Antenne anschrauben bevor LoRa getestet wird; Serial Monitor 115200 Baud
zeigt `Join ok, DevAddr: …`.

---

# Variante C – BaseNode328 (Pro Mini + RFM95)

Gleiches Messprinzip auf der **BaseNode328** (Arduino Pro Mini
3,3 V/8 MHz + RFM95W auf eigener PCB, Quelle: Workshop Nucleon e.V.).
Firmware = Arduino/MCCI-LMIC (`firmware/atmega328-rfm95-lorawan/`).

**Unterschiede zu Variante B:** RFM95 = SX1276 → MCCI-LMIC statt
RadioLib; **Keys in LMIC-Reihenfolge** (DevEUI/JoinEUI = **LSB**,
AppKey = **MSB**); INA226 an Hardware-I2C **A4/A5**, kein Remap.

```
   BaseNode328 (Draufsicht)                         INA226 (0x40)
   Pro Mini + RFM95 fest auf PCB
   ┌──────────────────────────┐         ┌────────────────────┐
   │ VCC (3V3) ●──────────────┼─────────┼─● VCC              │
   │ GND       ●──────────┐   │         │ ● GND ●─────────┐  │
   │ SDA (A4)  ●──────────┼───┼─────────┼─● SDA           │  │
   │ SCL (A5)  ●──────────┼───┼─────────┼─● SCL           │  │
   │                      │   │         │                 │  │
   │ RFM95 intern:        │   │         │ IN+ ●──┐        │  │
   │  NSS=D6   RST=D5     │   │         │        ├──Brücke│  │
   │  DIO0=D2  DIO1=D3    │   │         │ IN− ●──┘        │  │
   │  DIO2=D4  MOSI=D11   │   │         │ VBS ●── Batt(+) │  │
   │  MISO=D12 SCK=D13    │   │         │ GND ●── Batt(−)─┘  │
   └──────────────────────┘   │         └────────────────────┘
   2x AA (~3 V) / LiPo ───────┘
```

**Pinmap (verifiziert aus Originalquelle):** `nss=6, rst=5,
dio={2,3,4}` — übernommen aus dem Original-Workshop-Sketch
`NucleonBake/Bake_Typ_01.ino` (siehe Quellen unten). Trotzdem am
eigenen Board gegenprüfen, falls andere PCB-Revision.

**Herausgeführte Stiftleiste (Aufdruck am PCB):**

```
 A3 · A2 · SDA · A0 · RXD · MISO · AIN · VCC · SCL · A1 · TXD · SCLK · MOSI · GND
```

- **SDA/SCL** = I2C (intern A4/A5) → INA226 direkt hier anschließen
- **MOSI/MISO/SCLK** = SPI; NSS fehlt bewusst (intern auf D6 → RFM95)
- **RXD/TXD** = Seriell → FTDI-Adapter (3,3 V!) zum Flashen/Debug
- **A0–A3** frei, **AIN** = vermutlich dedizierter Analogeingang
  (an der Platine verifizieren, ggf. für Spannungsteiler nutzbar)
- **VCC/GND** = Versorgung (2× AA ~3 V bzw. 3,3 V)

### Quelle: Nucleon-Nodes (Originalprojekt)

Die BaseNode328-Platinen stammen aus den **Workshops des Nucleon e.V.**
(November 2018). Alle Hardware-Infos zu Variante C (Pinmap, Pro Mini
3,3 V + RFM95W, Regler-/LED-Ausbau für ~0,008 mA Sleep-Strom) sind aus
dem Original-Repo dokumentiert:

- **Repo:** https://gitlab.com/iotssl/nucleon-nodes (GPLv3)
- **Pinmap:** `NucleonBake/Bake_Typ_01/Bake_Typ_01.ino`
  (`LMIC_NSS=6, LMIC_RST=5, LMIC_DIO0/1/2=2/3/4`)
- **NucleonBake:** Node, der stündlich Batteriestatus sendet und dabei
  alle SF-Einstellungen durchläuft → Funkabdeckungs-Test am Standort
- **Original-Stack:** arduino-lmic (Kooijman), LowPower
  (rocketscream), adcvcc-Lib (VCC-Messung ohne externe Teile)
- **Weather-Nodes:** BME280/680, DHT, DS18B20 etc. pro Port-Konzept
- Aufbau-Bericht (Pro Mini + RFM95W auf PCB, LiPo, LED entfernt):
  https://hositests.com/2018/11/20/lorawan-basteln-eines-node/

**Versorgung:** Auf den verbauten Boards wurden Spannungsregler und
Power-LED ausgelötet (Strom sparen) → Versorgung direkt mit **2× AA
(~3,0 V) an VCC**. Alternativen:
- 3,7-V-LiPo oder 3,3 V extern auf VCC
- **MP1584 auf 3,3 V eingestellt → VCC** (Versorgung aus der zu
  messenden Batterie; Schutzkette identisch zu Variante B). Elko
  ~220–470 µF am 3V3-Eingang wegen RFM95-TX-Bursts (~120 mA).

**Niemals 5 V auf VCC** (Regler fehlt → würde RFM95 beschädigen); 5 V
geht nur über den RAW-Pin, falls ein Regler noch bestückt ist.
INA226 läuft an 3 V (min. 2,7 V; BOD des Pro Mini greift ohnehin
bei ~2,7 V). FTDI zum Flashen: 3,3-V-Version verwenden.

**Flash-Größe:** ATmega328P hat nur 32 KB Flash → in `platformio.ini`
sind `DISABLE_PING`/`DISABLE_BEACONS` gesetzt; in der Arduino IDE ggf.
in `lmic_project_config.h` der MCCI-LMIC-Lib setzen.

**Dateien:** `atmega328-rfm95-lorawan.ino` (kompletter Sketch),
`ttn_keys.example.h` → `ttn_keys.h` (LSB/MSB beachten!),
`platformio.ini` (`board = pro8MHzatmega328` – bei 5V/16MHz-Board
anpassen). TTN-Setup & Payload-Formatter identisch zu Variante B.

---

# TTN-Einrichtung (Schritt für Schritt, beide Varianten)

**1. Account & Cluster**
- Auf https://www.thethingsnetwork.org registrieren → Console öffnen
- Cluster wählen: Europa = `eu1` (`eu1.cloud.thethings.network`)

**2. Application anlegen**
- Console → **Applications → + Create application**
- Application ID z. B. `batterie-voltmeter`, Name frei wählbar

**3. End Device registrieren (OTAA)**
- In der Application → **+ Register end device**
- Input method: **„Enter end device specifics manually"**
- Frequenzplan: `Europe 863-870 MHz (SF9 for RX2 – recommended)`
- LoRaWAN-Version: `MAC V1.0.4`
- **JoinEUI:** bei TTN-Geräten meist `0000000000000000` (Nullen ok)
- **DevEUI:** Button „Generate" oder eigene ID (16-stellig hex)
- **AppKey:** Button „Generate" (32-stellig hex)
- DevAddr wird von TTN nach dem Join vergeben – nichts eintragen
- **Wichtig bei RadioLib (Variante B):** In den Device-Einstellungen
  unter *Activation/Join Settings* den Haken **„Resets DevNonces"**
  setzen, sonst schlägt der Re-Join nach Reset fehl (RadioLib speichert
  keine DevNonces persistent).

**4. Keys in die Firmware**
- `ttn_keys.example.h` → `ttn_keys.h` kopieren, Keys eintragen
- **Variante B:** MSB-Reihenfolge wie in der Console
- **Variante C (LMIC!):** DevEUI/JoinEUI in **LSB** (Bytes umkehren),
  AppKey in **MSB**
- `ttn_keys.h` ist in `.gitignore` → Keys bleiben lokal

**5. Payload-Formatter**
- Application → **Payload formatters → Uplink**
- Formatter type: **Custom Javascript formatter**
- Inhalt von `ttn_payload_formatter.js` reinkopieren → speichern
- Ergebnis pro Uplink: `{ busspannung_v: 12.69, batterieladung_pct: 90 }`

**6. Live-Daten prüfen**
- Application → **Live data**: JoinAccept + Uplinks (FPort 10) müssen
  nach Power-on auftauchen. Im Serial Monitor (115200): `Join ok`
  (Variante B: `Join ok, DevAddr: …` + `sendReceive -> 0`).

**7. Optional: Daten nach Home Assistant (MQTT)**
- TTN → Application → **Integrations → MQTT**: MQTT-Server
  `eu1.cloud.thethings.network:1883`, User = Application-ID,
  Password = API-Key (unten „Generate new API key")
- In HA: eigener Mosquitto-Bridge-Block in `configuration.yaml`
  (`connection ttn`, `topic v3/+/devices/+/up in`) oder MQTT-Sensor
  direkt auf den TTN-Broker via `mqtt:`-Integration:
  ```yaml
  mqtt:
    sensor:
      - name: "Batterie Voltmeter Spannung"
        state_topic: "v3/batterie-voltmeter@ttn/devices/esp-c3-lora/up"
        value_template: "{{ value_json.uplink_message.decoded_payload.busspannung_v }}"
        unit_of_measurement: "V"
      - name: "Batterie Voltmeter Ladung"
        state_topic: "v3/batterie-voltmeter@ttn/devices/esp-c3-lora/up"
        value_template: "{{ value_json.uplink_message.decoded_payload.batterieladung_pct }}"
        unit_of_measurement: "%"
  ```
  (Topic enthält die Device-ID aus TTN; dafür braucht HA MQTT-Zugang
  zum TTN-Broker → API-Key als Passwort.)

**Fair-Use beachten:** TTN Community erlaubt ~30 s Airtime/Tag →
`UPLINK_INTERVAL_MIN`/`UPLINK_INTERVAL_SEC` produktiv auf ≥10–15 min
stellen (aktuell 5 min = Debug!).

## Versionierung

Jede Variante wird separat versioniert (Version-Kommentar im Sketch);
jede Änderung bekommt einen Eintrag in `CHANGELOG.md`. Details in
`AGENTS.md`.
