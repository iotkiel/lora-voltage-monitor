/*
 * Batterie-Voltmeter - Variante B: LoRaWAN (The Things Network)
 * Hardware: Seeed XIAO nRF52840 + Wio-SX1262 (aufgesteckt) + INA226 (0x40)
 * Version: 0.1.1
 *
 * Pin-Mapping Wio-SX1262 (standalone, XIAO nRF52840 Kit):
 *   NSS=D4, DIO1=D1, RST=D2, BUSY=D3, RXEN(LNA)=D5, SPI SCK/MISO/MOSI=D8/D9/D10
 *   -> D4/D5 (Standard-I2C) belegt! INA226 daher per Wire.setPins auf D6/D7.
 */
#include <Arduino.h>
#include <RadioLib.h>
#include <Wire.h>
#include <INA226.h>
#include "ttn_keys.h"   // joinEUI, devEUI, appKey

// ---------- Einstellungen ----------
// ============================================================
// >>>>> HIER: Sendeintervall in Minuten (aktuell DEBUG = 5) <<<<<
// ============================================================
#define UPLINK_INTERVAL_MIN 5   // DEBUG: 5 min; Produktiv eher 10-15 min
// Akkutyp-Kennlinie: 0 = Blei-Gel, 1 = AGM, 2 = LiFePO4(4S), 3 = Li-Ion(3S)
#define BATTERY_TYPE 0

SX1262 radio = new Module(D4, D1, D2, D3);
LoRaWANNode node(&radio, &EU868);          // Region EU868, anpassen falls noetig

#define PIN_INA_SDA D6
#define PIN_INA_SCL D7
INA226 ina(0x40);

// Ladezustand aus Ruhespannung, stueckweise linear (gleiche Kennlinien
// wie die ESPHome-Variante)
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

void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println(F("== XIAO nRF52840 LoRaWAN Voltmeter =="));

  // INA226 auf umgemapptem I2C
  Wire.setPins(PIN_INA_SDA, PIN_INA_SCL);
  Wire.begin();
  if (!ina.begin()) {
    Serial.println(F("INA226 nicht gefunden - I2C-Verdrahtung pruefen"));
  } else {
    ina.setMaxCurrentShunt(3.2, 0.1);   // R100-Shunt auf dem Breakout
    Serial.println(F("INA226 ok"));
  }

  // LoRa: Wio-SX1262 hat TCXO -> Spannung vor begin() setzen
  radio.tcxoVoltage = 1.8;
  int16_t state = radio.begin();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print(F("radio.begin() fehlgeschlagen: "));
    Serial.println(state);
    while (true) delay(1000);
  }
  radio.setDio2AsRfSwitch(true);          // TX-Pfad intern ueber DIO2
  radio.setRfSwitchPins(D5, RADIOLIB_NC); // externe LNA-Freigabe auf D5

  // OTAA (TTN = LoRaWAN 1.0.x -> nwkKey = nullptr)
  node.beginOTAA(joinEUI, devEUI, nullptr, appKey);
  state = node.activateOTAA();
  if (state != RADIOLIB_LORAWAN_NEW_SESSION) {
    Serial.print(F("OTAA Join fehlgeschlagen: "));
    Serial.println(state);
    while (true) delay(1000);
  }
  Serial.print(F("Join ok, DevAddr: "));
  Serial.println((unsigned long)node.getDevAddr(), HEX);
}

void loop() {
  float v = ina.getBusVoltage();
  uint16_t mv = (uint16_t)(v * 1000.0f);
  uint8_t soc = (uint8_t)socFromVoltage(v);

  // Payload: [mV_hi, mV_lo, soc_%] -> 3 Byte auf FPort 10
  uint8_t payload[3] = { (uint8_t)(mv >> 8), (uint8_t)(mv & 0xFF), soc };
  Serial.print(F("Uplink: ")); Serial.print(v, 3);
  Serial.print(F(" V, ")); Serial.print(soc); Serial.println(F(" %"));

  int16_t state = node.sendReceive(payload, sizeof(payload), 10);
  Serial.print(F("sendReceive -> ")); Serial.println(state);

  radio.sleep();
  // TODO: echtes nRF52-systemOff mit RTC-Wakeup fuer <1 mA Standby.
  // delay() nutzt Tickless-Idle -> bereits deutlich sparsamer als aktives Warten.
  delay(UPLINK_INTERVAL_MIN * 60UL * 1000UL);
}
