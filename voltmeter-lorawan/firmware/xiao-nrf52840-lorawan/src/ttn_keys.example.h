#pragma once
// TTN OTAA Keys - aus der TTN Console:
// Applications -> End device -> "Provisioning information"
// NICHT ins Git committen! (entspricht secrets.yaml bei ESPHome)
//
// joinEUI (AppEUI): bei TTN oft 0x0000000000000000 oder Wert aus der Console
// devEUI:           16-stellig hex, MSB-Reihenfolge
// appKey:           32-stellig hex, MSB-Reihenfolge

uint64_t joinEUI = 0x0000000000000000;
uint64_t devEUI  = 0x0000000000000000;
uint8_t  appKey[16] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
