/*
 * Batterie-Voltmeter - Variante C: LoRaWAN (The Things Network)
 * Hardware: BaseNode328 (Arduino Pro Mini 3.3V/8MHz + RFM95W) + INA226 (0x40)
 * Version: 0.2.0
 *
 * Pinmap und Hardware-Infos stammen aus dem Original-Repo der
 * Nucleon-Nodes (Workshop Nucleon e.V., Nov. 2018, GPLv3):
 * https://gitlab.com/iotssl/nucleon-nodes -> NucleonBake/Bake_Typ_01
 *
 * Stack: MCCI LMIC (OTAA). Achtung: LMIC will devEUI/joinEUI in LSB-,
 * appKey in MSB-Reihenfolge -> siehe ttn_keys.h!
 */
#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>
#include <Wire.h>
#include <INA226.h>
#include "ttn_keys.h"

// ============================================================
// >>>>> HIER: Sendeintervall in Sekunden (aktuell DEBUG = 300) <<<<<
// ============================================================
#define UPLINK_INTERVAL_SEC 300   // DEBUG 5 min; produktiv >= 600

// ---------- RFM95-Pinmap (LMIC) ----------
// Verifiziert aus dem Original-Sketch NucleonBake/Bake_Typ_01.ino
// (gitlab.com/iotssl/nucleon-nodes, Nucleon e.V., GPLv3):
const lmic_pinmap lmic_pins = {
  .nss  = 6,                  // RFM95 NSS  -> D6
  .rxtx = LMIC_UNUSED_PIN,
  .rst  = 5,                  // RFM95 RST  -> D5
  .dio  = {2, 3, 4},          // DIO0 -> D2, DIO1 -> D3, DIO2 -> D4
};

// INA226 an Hardware-I2C A4 (SDA) / A5 (SCL) - kein Remap noetig.
// Auf dem PCB sind sie als "SDA"/"SCL" an der Stiftleiste rausgefuehrt.
INA226 ina(0x40);

static osjob_t sendjob;

// Ladezustand aus Ruhespannung (gleiche Kennlinien wie Variante A/B)
// Akkutyp: 0 = Blei-Gel, 1 = AGM, 2 = LiFePO4(4S), 3 = Li-Ion(3S)
#define BATTERY_TYPE 0
float socFromVoltage(float v) {
  static const float SOC[7]  = {0, 20, 40, 60, 80, 90, 100};
  static const float T[4][7] = {
    {10.5, 11.7, 12.0, 12.2, 12.5, 12.7, 12.85},  // 0 Blei-Gel
    {10.8, 11.85, 12.15, 12.3, 12.6, 12.8, 13.0}, // 1 AGM
    {10.0, 12.0, 12.8, 13.0, 13.2, 13.4, 13.6},   // 2 LiFePO4 4S
    {9.0, 10.2, 10.8, 11.4, 12.0, 12.4, 12.6},    // 3 Li-Ion 3S
  };
  const float *vv = T[BATTERY_TYPE];
  if (v <= vv[0]) return 0;
  if (v >= vv[6]) return 100;
  for (int i = 0; i < 6; i++)
    if (v < vv[i+1])
      return SOC[i] + (v - vv[i]) * (SOC[i+1] - SOC[i]) / (vv[i+1] - vv[i]);
  return 0;
}

void do_send(osjob_t* j) {
  if (LMIC.opmode & OP_TXRXPEND) {
    os_setTimedCallback(&sendjob, os_getTime() + sec2osticks(10), do_send);
    return;
  }
  float v = ina.getBusVoltage();
  uint16_t mv = (uint16_t)(v * 1000.0f);
  uint8_t soc = (uint8_t)socFromVoltage(v);
  uint8_t payload[3] = { (uint8_t)(mv >> 8), (uint8_t)(mv & 0xFF), soc };
  LMIC_setTxData2(10, payload, sizeof(payload), 0);   // FPort 10, unconfirmed
  Serial.print(F("TX ")); Serial.print(v, 3);
  Serial.print(F(" V, ")); Serial.print(soc); Serial.println(F(" %"));
}

void onEvent(ev_t ev) {
  switch (ev) {
    case EV_JOINED:
      Serial.println(F("Join ok"));
      LMIC_setLinkCheckMode(0);
      os_setTimedCallback(&sendjob, os_getTime() + sec2osticks(5), do_send);
      break;
    case EV_TXCOMPLETE:
      Serial.println(F("TX done"));
      os_setTimedCallback(&sendjob,
          os_getTime() + sec2osticks(UPLINK_INTERVAL_SEC), do_send);
      break;
    case EV_JOIN_FAILED:
      Serial.println(F("Join fehlgeschlagen"));
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println(F("== BaseNode328 RFM95 LoRaWAN Voltmeter =="));

  Wire.begin();                       // A4/A5
  if (!ina.begin()) {
    Serial.println(F("INA226 nicht gefunden - A4/A5 pruefen"));
  } else {
    ina.setMaxCurrentShunt(3.2, 0.1); // R100-Shunt
    Serial.println(F("INA226 ok"));
  }

  os_init();
  LMIC_reset();
  LMIC_setClockError(MAX_CLOCK_ERROR * 5 / 100);  // 8MHz AVR: Clock-Toleranz
  LMIC_startJoining();                            // OTAA
}

void loop() {
  os_runloop_once();
}
