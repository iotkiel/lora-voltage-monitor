/*
 * Batterie-Voltmeter - Variante B: LoRaWAN (The Things Network)
 * Hardware: Seeed XIAO nRF52840 + Wio-SX1262 + INA226 (0x40)
 *
 * Diese Datei ist der Arduino-IDE-Einstieg (Sketch-Stub).
 * Der eigentliche Code liegt in src/main.cpp, die TTN-Keys in
 * src/ttn_keys.h (beide Dateien werden von der IDE automatisch
 * als Tabs angezeigt und mitkompiliert).
 *
 * Fuer PlatformIO: sources liegen in src/ (platformio.ini, src_dir
 * Standard) - diese .ino wird von PIO ignoriert.
 *
 * Board-Core: Adafruit nRF52 (nicht Seeed mbed!) - wegen Wire.setPins()
 * fuer das I2C-Remap des INA226 auf D6/D7.
 */
