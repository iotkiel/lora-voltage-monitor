#pragma once
// TTN OTAA Keys - WICHTIG: LMIC-Reihenfolge!
//   APPEUI/JoinEUI: LSB (Bytes umgekehrt zur Console-Anzeige)
//   DEVEUI:         LSB (Bytes umgekehrt zur Console-Anzeige)
//   APPKEY:         MSB (wie in der Console angezeigt)
// NICHT ins Git committen!

static const u1_t PROGMEM APPEUI[8] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00   // JoinEUI, LSB!
};
static const u1_t PROGMEM DEVEUI[8] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00   // DevEUI, LSB!
};
static const u1_t PROGMEM APPKEY[16] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00   // AppKey, MSB!
};

void os_getArtEui (u1_t* buf) { memcpy_P(buf, APPEUI, 8); }
void os_getDevEui (u1_t* buf) { memcpy_P(buf, DEVEUI, 8); }
void os_getDevKey (u1_t* buf) { memcpy_P(buf, APPKEY, 16); }
