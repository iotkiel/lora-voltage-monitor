
#include <MKRWAN.h>
int rxPin = 6;
int txPin = 7;

LoRaModem modem;

#include "arduino_secrets.h"
// Please enter your sensitive data in the Secret tab or arduino_secrets.h
String appEui = SECRET_APP_EUI;
String appKey = SECRET_APP_KEY;

int analogInput = 0;
//int analogInput = 3; Original
float vout = 0.0;
float vin = 0.0;
//float R1 = 99100.0; // resistance of R1 (100K) -see text!
//float R2 = 9000.0; // resistance of R2 (10K) - see text!
float R1 = 99100.0; // resistance of R1 (100K) -see text!
float R2 = 9000.0; // resistance of R2 (10K) - see text!
int myvalue = 0;
int msg; //was string


float mapfloat(float x, float in_min, float in_max, float out_min, float out_max)
{
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}



void setup(){
   pinMode(analogInput, INPUT);

  // put your setup code here, to run once:
  Serial.begin(9600); 
  //while (!Serial); //comment in for debug
  if (!modem.begin(EU868)) {
    Serial.println("Failed to start module");
    while (1) {}
  };
  Serial.print("Your module version is: ");
  Serial.println(modem.version());
  Serial.print("Your device EUI is: ");
  Serial.println(modem.deviceEUI());

  int connected = modem.joinOTAA(appEui, appKey);
  if (!connected) {
    Serial.println("Something went wrong; are you indoor? Move near a window and retry");
    while (1) {}
  }

  // Set poll interval to 60 secs.
  modem.minPollInterval(60);


}
void loop()
{
   // read the myvalue at analog input
   myvalue = analogRead(analogInput);
//   vout = (myvalue * 5.0) / 1024.0; // see text
//   vin = vout / (R2/(R1+R2)); 
//   vin = mapfloat(myvalue, 153, 581, 5, 20);
//   vin = mapfloat(myvalue, 131, 500, 5, 20);
//   vin = mapfloat(myvalue, 173, 667, 5, 20);
//   vin = mapfloat(myvalue, 173, 568, 6, 20); Original
   vin = mapfloat(myvalue, 50, 720, 6, 20); // perfekte 5V



   if (vin<0.09) 
    {
      vin=0.0;//statement to quash undesired reading !
    }
   Serial.print("myvalue is: ");
   Serial.print(myvalue);
   //Serial.print(mapfloat);
   Serial.print("Voltage is: ");
   Serial.print(vin);
   Serial.println("V");
   //Serial.println(myvalue); //debug
   //msg = String(vin);
   msg = vin * 100;
   int err;
   modem.beginPacket();
   modem.print(myvalue);
   modem.print(msg);
   err = modem.endPacket(true);
   if (err > 0) 
    {
        Serial.println("Message sent correctly!");
    } else 
    {
        Serial.println("Error sending message :(");
    }
    //delay(3000); //for debug
    delay(900000); //ca 0,25h Pause
}
