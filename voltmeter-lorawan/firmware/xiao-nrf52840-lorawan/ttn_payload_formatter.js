// TTN Payload Formatter (Uplink) - in der TTN Console eintragen:
// Application -> Payload formatters -> Uplink -> "Custom Javascript formatter"
// Payload: 3 Byte -> [Spannung mV (uint16 BE), Ladezustand %]
function decodeUplink(input) {
  var mv = (input.bytes[0] << 8) | input.bytes[1];
  return {
    data: {
      busspannung_v: mv / 1000,
      batterieladung_pct: input.bytes[2]
    },
    warnings: [],
    errors: []
  };
}
