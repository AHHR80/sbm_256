#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <Wire.h>
#include "ArduinoJson.h"

// I2C Address for BQ25672
#define BQ25672_I2C_ADDR 0x6B

// WiFi Access Point credentials
const char* ssid = "ESP32_BQ25672_Monitor";
const char* password = "password123";

// --- Interrupt & WebSocket Setup ---
const int interruptPin = 4; // Connect INT pin to this GPIO
AsyncWebServer server(80);
AsyncWebSocket ws("/ws"); // WebSocket endpoint
volatile bool interruptFired = false; // Flag for interrupt detection

// --- Watchdog Timer ---
unsigned long lastWatchdogReset = 0;
const long watchdogInterval = 30000; // 30 seconds (less than the default 40s timeout)

// --- I2C Communication Functions ---
// Reads a 16-bit word (two bytes) from a register
bool readWord(uint8_t reg, uint16_t& value) {
    Wire.beginTransmission(BQ25672_I2C_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) { return false; }
    if (Wire.requestFrom((uint8_t)BQ25672_I2C_ADDR, (uint8_t)2) != 2) { return false; }
    uint8_t lsb = Wire.read();
    uint8_t msb = Wire.read();
    value = (msb << 8) | lsb;
    return true;
}

// Reads an 8-bit byte from a register (BQ25672 registers are 16-bit, so we read a word and take the LSB)
bool readByte(uint8_t reg, uint8_t& value) {
    uint16_t wordValue;
    if (!readWord(reg, wordValue)) { return false; }
    value = (uint8_t)wordValue; // The actual data is in the LSB
    return true;
}

// Writes a 16-bit word to a register
bool writeWord(uint8_t reg, uint16_t value) {
    Wire.beginTransmission(BQ25672_I2C_ADDR);
    Wire.write(reg);
    Wire.write(value & 0xFF); // LSB
    Wire.write(value >> 8);   // MSB
    if (Wire.endTransmission() != 0) {
        Serial.printf("I2C writeWord error for reg 0x%02X\n", reg);
        return false;
    }
    return true;
}

// Writes an 8-bit byte to a register
bool writeByte(uint8_t reg, uint8_t value) {
    // For BQ25672, writing a byte means writing a 16-bit word with MSB=0
    return writeWord(reg, (uint16_t)value);
}

// Helper function to read, modify, and then write back a byte register
bool modifyByte(uint8_t reg, uint8_t value, uint8_t mask) {
    uint8_t currentValue;
    if (!readByte(reg, currentValue)) {
        Serial.printf("Failed to read reg 0x%02X for modification\n", reg);
        return false;
    }
    uint8_t newValue = (currentValue & ~mask) | (value & mask);
    return writeByte(reg, newValue);
}

// Reads a block of consecutive 8-bit registers
bool readBytes(uint8_t startReg, uint8_t* buffer, uint8_t count) {
    Wire.beginTransmission(BQ25672_I2C_ADDR);
    Wire.write(startReg);
    if (Wire.endTransmission(false) != 0) { return false; }
    // BQ25672 increments address pointer, so we can read multiple bytes
    if (Wire.requestFrom((uint8_t)BQ25672_I2C_ADDR, count) != count) { return false; }
    for (int i = 0; i < count; i++) { buffer[i] = Wire.read(); }
    return true;
}


// --- Interrupt Logic ---
// Decodes the reason for an interrupt by reading the flag registers
String getInterruptReason() {
    String reason = "";
    uint8_t flag_buffer[6]; // Buffer for registers 0x22 to 0x27

    if (readBytes(0x22, flag_buffer, 6)) {
        // Charger Flag 0 (0x22)
        if (flag_buffer[0] & 0b10000000) reason += "IINDPM event. ";
        if (flag_buffer[0] & 0b01000000) reason += "VINDPM event. ";
        if (flag_buffer[0] & 0b00100000) reason += "Watchdog expired. ";
        if (flag_buffer[0] & 0b00010000) reason += "Poor source detected. ";
        if (flag_buffer[0] & 0b00001000) reason += "Power Good status changed. ";
        if (flag_buffer[0] & 0b00000100) reason += "AC2 present status changed. ";
        if (flag_buffer[0] & 0b00000010) reason += "AC1 present status changed. ";
        if (flag_buffer[0] & 0b00000001) reason += "VBUS present status changed. ";
        
        // Charger Flag 1 (0x23)
        if (flag_buffer[1] & 0b10000000) reason += "Charge status changed. ";
        if (flag_buffer[1] & 0b01000000) reason += "ICO status changed. ";
        if (flag_buffer[1] & 0b00010000) reason += "VBUS status changed. ";
        if (flag_buffer[1] & 0b00000100) reason += "Thermal regulation. ";
        if (flag_buffer[1] & 0b00000010) reason += "VBAT present status changed. ";
        if (flag_buffer[1] & 0b00000001) reason += "BC1.2 detection done. ";

        // Charger Flag 2 (0x24)
        if (flag_buffer[2] & 0b01000000) reason += "DPDM detection done. ";
        if (flag_buffer[2] & 0b00100000) reason += "ADC conversion done. ";
        if (flag_buffer[2] & 0b00010000) reason += "VSYS regulation status changed. ";
        if (flag_buffer[2] & 0b00001000) reason += "Fast charge timer expired. ";
        if (flag_buffer[2] & 0b00000100) reason += "Trickle charge timer expired. ";
        if (flag_buffer[2] & 0b00000010) reason += "Pre-charge timer expired. ";
        if (flag_buffer[2] & 0b00000001) reason += "Top-off timer expired. ";

        // Charger Flag 3 (0x25)
        if (flag_buffer[3] & 0b00010000) reason += "VBAT too low for OTG. ";
        if (flag_buffer[3] & 0b00001000) reason += "TS Cold event. ";
        if (flag_buffer[3] & 0b00000100) reason += "TS Cool event. ";
        if (flag_buffer[3] & 0b00000010) reason += "TS Warm event. ";
        if (flag_buffer[3] & 0b00000001) reason += "TS Hot event. ";

        // FAULT Flag 0 (0x26)
        if (flag_buffer[4] & 0b10000000) reason += "IBAT regulation. ";
        if (flag_buffer[4] & 0b01000000) reason += "VBUS OVP Fault. ";
        if (flag_buffer[4] & 0b00100000) reason += "VBAT OVP Fault. ";
        if (flag_buffer[4] & 0b00010000) reason += "IBUS OCP Fault. ";
        if (flag_buffer[4] & 0b00001000) reason += "IBAT OCP Fault. ";
        if (flag_buffer[4] & 0b00000100) reason += "Converter OCP Fault. ";
        if (flag_buffer[4] & 0b00000010) reason += "VAC2 OVP Fault. ";
        if (flag_buffer[4] & 0b00000001) reason += "VAC1 OVP Fault. ";
        
        // FAULT Flag 1 (0x27)
        if (flag_buffer[5] & 0b10000000) reason += "VSYS Short Fault. ";
        if (flag_buffer[5] & 0b01000000) reason += "VSYS OVP Fault. ";
        if (flag_buffer[5] & 0b00100000) reason += "OTG OVP Fault. ";
        if (flag_buffer[5] & 0b00010000) reason += "OTG UVP Fault. ";
        if (flag_buffer[5] & 0b00000100) reason += "Thermal Shutdown. ";
    } else {
        return "Failed to read flag registers.";
    }

    if (reason.length() == 0) {
        return "Unknown interrupt reason.";
    }

    return reason;
}


// Interrupt Service Routine
void IRAM_ATTR handleInterrupt() {
    interruptFired = true;
}

// WebSocket event handler
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.printf("WebSocket client #%u disconnected\n", client->id());
    }
}


// --- API Handlers ---
void handleApiData1(AsyncWebServerRequest *request) {
    StaticJsonDocument<1024> doc;
    uint16_t val16;
    uint8_t val8;
    if (readByte(0x00, val8)) { doc["VSYSMIN_5_0"] = 2500 + ((val8 & 0x3F) * 250); } else { doc["VSYSMIN_5_0"] = -1; }
    if (readByte(0x0A, val8)) { doc["CELL_1_0"] = ((val8 >> 6) & 0x03) + 1; } else { doc["CELL_1_0"] = -1; }
    if (readWord(0x0B, val16)) { doc["VOTG_10_0"] = 2800 + ((val16 & 0x7FF) * 10); } else { doc["VOTG_10_0"] = -1; }
    if (readByte(0x0D, val8)) { doc["IOTG_6_0"] = (val8 & 0x7F) * 40; } else { doc["IOTG_6_0"] = -1; }
    if (readByte(0x0F, val8)) { doc["EN_CHG"] = (val8 >> 5) & 0x01; } else { doc["EN_CHG"] = -1; }
    if (readByte(0x1B, val8)) { doc["VBUS_PRESENT_STAT"] = val8 & 0x01; } else { doc["VBUS_PRESENT_STAT"] = -1; }
    if (readByte(0x1C, val8)) {
        doc["CHG_STAT_2_0"] = (val8 >> 5) & 0x07;
        doc["VBUS_STAT_3_0"] = (val8 >> 1) & 0x0F;
    } else { doc["CHG_STAT_2_0"] = -1; doc["VBUS_STAT_3_0"] = -1; }
    if (readByte(0x1D, val8)) { doc["VBAT_PRESENT_STAT"] = val8 & 0x01; } else { doc["VBAT_PRESENT_STAT"] = -1; }
    if (readByte(0x1E, val8)) { doc["VSYS_STAT"] = (val8 >> 4) & 0x01; } else { doc["VSYS_STAT"] = -1; }
    if(readWord(0x31, val16)) { doc["IBUS_ADC_15_0"] = (int16_t)val16; } else { doc["IBUS_ADC_15_0"] = -1; }
    if(readWord(0x33, val16)) { doc["IBAT_ADC_15_0"] = (int16_t)val16; } else { doc["IBAT_ADC_15_0"] = -1; }
    if(readWord(0x35, val16)) { doc["VBUS_ADC_15_0"] = val16; } else { doc["VBUS_ADC_15_0"] = -1; }
    if(readWord(0x37, val16)) { doc["VAC1_ADC_15_0"] = val16; } else { doc["VAC1_ADC_15_0"] = -1; }
    if(readWord(0x39, val16)) { doc["VAC2_ADC_15_0"] = val16; } else { doc["VAC2_ADC_15_0"] = -1; }
    if(readWord(0x3B, val16)) { doc["VBAT_ADC_15_0"] = val16; } else { doc["VBAT_ADC_15_0"] = -1; }
    if(readWord(0x3D, val16)) { doc["VSYS_ADC_15_0"] = val16; } else { doc["VSYS_ADC_15_0"] = -1; }
    if(readWord(0x3F, val16)) { doc["TS_ADC_15_0"] = (float)val16 * 0.0976563; } else { doc["TS_ADC_15_0"] = -1.0; }
    if(readWord(0x41, val16)) { doc["TDIE_ADC_15_0"] = (float)((int16_t)val16) * 0.5; } else { doc["TDIE_ADC_15_0"] = -999.0; }
    String output; serializeJson(doc, output); request->send(200, "application/json", output);
}

void handleApiData2(AsyncWebServerRequest *request) {
    StaticJsonDocument<1536> doc;
    uint16_t val16;
    uint8_t val8;
    if(readWord(0x01, val16)) { doc["VREG_10_0"] = (val16 & 0x7FF) * 10; } else { doc["VREG_10_0"] = -1; }
    if(readWord(0x03, val16)) { doc["ICHG_8_0"] = (val16 & 0x1FF) * 10; } else { doc["ICHG_8_0"] = -1; }
    if(readByte(0x05, val8)) { doc["VINDPM_7_0"] = val8 * 100 + 3600; } else { doc["VINDPM_7_0"] = -1; }
    if(readWord(0x06, val16)) { doc["IINDPM_8_0"] = (val16 & 0x1FF) * 10; } else { doc["IINDPM_8_0"] = -1; }
    if(readByte(0x0F, val8)) {
        doc["EN_ICO"] = (val8 >> 4) & 0x01;
        doc["FORCE_ICO"] = (val8 >> 3) & 0x01;
        doc["EN_HIZ"] = (val8 >> 2) & 0x01;
    } else { doc["EN_ICO"] = -1; doc["FORCE_ICO"] = -1; doc["EN_HIZ"] = -1; }
    if(readByte(0x11, val8)) { doc["SDRV_CTRL_1_0"] = (val8 >> 1) & 0x03; } else { doc["SDRV_CTRL_1_0"] = -1; }
    if(readByte(0x12, val8)) { 
        doc["DIS_ACDRV"] = (val8 >> 7) & 0x01;
        doc["EN_OTG"] = (val8 >> 6) & 0x01; 
    } else { doc["DIS_ACDRV"] = -1; doc["EN_OTG"] = -1; }
    if(readByte(0x13, val8)) {
        doc["EN_ACDRV2"] = (val8 >> 7) & 0x01;
        doc["EN_ACDRV1"] = (val8 >> 6) & 0x01;
        doc["FORCE_VINDPM_DET"] = (val8 >> 1) & 0x01;
    } else { doc["EN_ACDRV2"] = -1; doc["EN_ACDRV1"] = -1; doc["FORCE_VINDPM_DET"] = -1; }
    if(readByte(0x14, val8)) { doc["SFET_PRESENT"] = (val8 >> 7) & 0x01; } else { doc["SFET_PRESENT"] = -1; }
    if(readByte(0x15, val8)) { doc["EN_MPPT"] = val8 & 0x01; } else { doc["EN_MPPT"] = -1; }
    if(readWord(0x19, val16)) { doc["ICO_ILIM_8_0"] = (val16 & 0x1FF) * 10; } else { doc["ICO_ILIM_8_0"] = -1; }
    if(readByte(0x1B, val8)) {
        doc["AC2_PRESENT_STAT"] = (val8 >> 2) & 0x01;
        doc["AC1_PRESENT_STAT"] = (val8 >> 1) & 0x01;
    } else { doc["AC2_PRESENT_STAT"] = -1; doc["AC1_PRESENT_STAT"] = -1; }
    if(readByte(0x1F, val8)) { doc["VBATOTG_LOW_STAT"] = (val8 >> 4) & 0x01; } else { doc["VBATOTG_LOW_STAT"] = -1; }
    if(readByte(0x2E, val8)) { doc["ADC_EN"] = (val8 >> 7) & 0x01; } else { doc["ADC_EN"] = -1; }
    if(readByte(0x20, val8)) {
        doc["VBUS_OVP_STAT"] = (val8 >> 6) & 0x01;
        doc["VBAT_OVP_STAT"] = (val8 >> 5) & 0x01;
        doc["IBUS_OCP_STAT"] = (val8 >> 4) & 0x01;
        doc["IBAT_OCP_STAT"] = (val8 >> 3) & 0x01;
        doc["CONV_OCP_STAT"] = (val8 >> 2) & 0x01;
    } else { doc["VBUS_OVP_STAT"] = -1; doc["VBAT_OVP_STAT"] = -1; doc["IBUS_OCP_STAT"] = -1; doc["IBAT_OCP_STAT"] = -1; doc["CONV_OCP_STAT"] = -1; }
    if(readByte(0x21, val8)) {
        doc["VSYS_SHORT_STAT"] = (val8 >> 7) & 0x01;
        doc["VSYS_OVP_STAT"] = (val8 >> 6) & 0x01;
        doc["OTG_OVP_STAT"] = (val8 >> 5) & 0x01;
        doc["OTG_UVP_STAT"] = (val8 >> 4) & 0x01;
        doc["TSHUT_STAT"] = (val8 >> 2) & 0x01;
    } else { doc["VSYS_SHORT_STAT"] = -1; doc["VSYS_OVP_STAT"] = -1; doc["OTG_OVP_STAT"] = -1; doc["OTG_UVP_STAT"] = -1; doc["TSHUT_STAT"] = -1; }
    String output; serializeJson(doc, output); request->send(200, "application/json", output);
}

void handleApiData3(AsyncWebServerRequest *request) {
    StaticJsonDocument<1024> doc;
    uint8_t val8;
    if (readByte(0x08, val8)) {
        doc["VBAT_LOWV_1_0"] = (val8 >> 6) & 0x03;
        doc["IPRECHG_5_0"] = (val8 & 0x3F) * 40;
    } else { doc["VBAT_LOWV_1_0"] = -1; doc["IPRECHG_5_0"] = -1; }
    if (readByte(0x09, val8)) { doc["ITERM_4_0"] = (val8 & 0x1F) * 40; } else { doc["ITERM_4_0"] = -1; }
    if (readByte(0x0A, val8)) {
        doc["TRECHG_1_0"] = (val8 >> 4) & 0x03;
        doc["VRECHG_3_0"] = 50 + ((val8 & 0x0F) * 50);
    } else { doc["TRECHG_1_0"] = -1; doc["VRECHG_3_0"] = -1; }
    if (readByte(0x10, val8)) { doc["VAC_OVP_1_0"] = (val8 >> 4) & 0x03; } else { doc["VAC_OVP_1_0"] = -1; }
    if (readByte(0x14, val8)) {
        doc["EN_IBAT"] = (val8 >> 5) & 0x01;
        doc["IBAT_REG_1_0"] = (val8 >> 3) & 0x03;
        doc["EN_IINDPM"] = (val8 >> 2) & 0x01;
        doc["EN_EXTILIM"] = (val8 >> 1) & 0x01;
    } else { doc["EN_IBAT"] = -1; doc["IBAT_REG_1_0"] = -1; doc["EN_IINDPM"] = -1; doc["EN_EXTILIM"] = -1; }
    if (readByte(0x1D, val8)) { doc["ICO_STAT_1_0"] = (val8 >> 6) & 0x03; } else { doc["ICO_STAT_1_0"] = -1; }
    if (readByte(0x20, val8)) {
        doc["VAC2_OVP_STAT"] = (val8 >> 1) & 0x01;
        doc["VAC1_OVP_STAT"] = val8 & 0x01;
    } else { doc["VAC2_OVP_STAT"] = -1; doc["VAC1_OVP_STAT"] = -1; }
    if (readByte(0x2E, val8)) { doc["ADC_SAMPLE_1_0"] = (val8 >> 4) & 0x03; } else { doc["ADC_SAMPLE_1_0"] = -1; }
    String output; serializeJson(doc, output); request->send(200, "application/json", output);
}

void handleApiData4(AsyncWebServerRequest *request) {
    StaticJsonDocument<2048> doc;
    uint8_t val8;
    if(readByte(0x09, val8)) { doc["STOP_WD_CHG"] = (val8 >> 5) & 0x01; } else { doc["STOP_WD_CHG"] = -1; }
    if(readByte(0x0D, val8)) { doc["PRECHG_TMR"] = (val8 >> 7) & 0x01; } else { doc["PRECHG_TMR"] = -1; }
    if(readByte(0x0E, val8)) {
        doc["TOPOFF_TMR_1_0"] = (val8 >> 6) & 0x03;
        doc["EN_TRICHG_TMR"] = (val8 >> 5) & 0x01;
        doc["EN_PRECHG_TMR"] = (val8 >> 4) & 0x01;
        doc["EN_CHG_TMR"] = (val8 >> 3) & 0x01;
        doc["CHG_TMR_1_0"] = (val8 >> 1) & 0x03;
        doc["TMR2X_EN"] = val8 & 0x01;
    } else { doc["TOPOFF_TMR_1_0"] = -1; doc["EN_TRICHG_TMR"] = -1; doc["EN_PRECHG_TMR"] = -1; doc["EN_CHG_TMR"] = -1; doc["CHG_TMR_1_0"] = -1; doc["TMR2X_EN"] = -1; }
    if(readByte(0x0F, val8)) {
        doc["EN_AUTO_IBATDIS"] = (val8 >> 7) & 0x01;
        doc["FORCE_IBATDIS"] = (val8 >> 6) & 0x01;
        doc["EN_TERM"] = (val8 >> 1) & 0x01;
    } else { doc["EN_AUTO_IBATDIS"] = -1; doc["FORCE_IBATDIS"] = -1; doc["EN_TERM"] = -1; }
    if(readByte(0x10, val8)) { doc["WATCHDOG_2_0"] = val8 & 0x07; } else { doc["WATCHDOG_2_0"] = -1; }
    if(readByte(0x11, val8)) {
        doc["FORCE_INDET"] = (val8 >> 7) & 0x01;
        doc["AUTO_INDET_EN"] = (val8 >> 6) & 0x01;
        doc["EN_12V"] = (val8 >> 5) & 0x01;
        doc["EN_9V"] = (val8 >> 4) & 0x01;
        doc["HVDCP_EN"] = (val8 >> 3) & 0x01;
        doc["SDRV_DLY"] = val8 & 0x01;
    } else { doc["FORCE_INDET"] = -1; doc["AUTO_INDET_EN"] = -1; doc["EN_12V"] = -1; doc["EN_9V"] = -1; doc["HVDCP_EN"] = -1; doc["SDRV_DLY"] = -1; }
    if(readByte(0x12, val8)) {
        doc["PFM_OTG_DIS"] = (val8 >> 5) & 0x01;
        doc["PFM_FWD_DIS"] = (val8 >> 4) & 0x01;
        doc["WKUP_DLY"] = (val8 >> 3) & 0x01;
        doc["DIS_LDO"] = (val8 >> 2) & 0x01;
        doc["DIS_OTG_OOA"] = (val8 >> 1) & 0x01;
        doc["DIS_FWD_OOA"] = val8 & 0x01;
    } else { doc["PFM_OTG_DIS"] = -1; doc["PFM_FWD_DIS"] = -1; doc["WKUP_DLY"] = -1; doc["DIS_LDO"] = -1; doc["DIS_OTG_OOA"] = -1; doc["DIS_FWD_OOA"] = -1; }
    if(readByte(0x13, val8)) {
        doc["PWM_FREQ"] = (val8 >> 5) & 0x01;
        doc["DIS_STAT"] = (val8 >> 4) & 0x01;
        doc["DIS_VSYS_SHORT"] = (val8 >> 3) & 0x01;
        doc["DIS_VOTG_UVP"] = (val8 >> 2) & 0x01;
        doc["EN_IBUS_OCP"] = val8 & 0x01;
    } else { doc["PWM_FREQ"] = -1; doc["DIS_STAT"] = -1; doc["DIS_VSYS_SHORT"] = -1; doc["DIS_VOTG_UVP"] = -1; doc["EN_IBUS_OCP"] = -1; }
    if(readByte(0x14, val8)) { doc["EN_BATOC"] = val8 & 0x01; } else { doc["EN_BATOC"] = -1; }
    if(readByte(0x15, val8)) {
        doc["VOC_PCT_2_0"] = (val8 >> 5) & 0x07;
        doc["VOC_DLY_1_0"] = (val8 >> 3) & 0x03;
        doc["VOC_RATE_1_0"] = (val8 >> 1) & 0x03;
    } else { doc["VOC_PCT_2_0"] = -1; doc["VOC_DLY_1_0"] = -1; doc["VOC_RATE_1_0"] = -1; }
    if(readByte(0x16, val8)) {
        doc["TREG_1_0"] = (val8 >> 6) & 0x03;
        doc["TSHUT_1_0"] = (val8 >> 4) & 0x03;
        doc["VBUS_PD_EN"] = (val8 >> 3) & 0x01;
        doc["VAC1_PD_EN"] = (val8 >> 2) & 0x01;
        doc["VAC2_PD_EN"] = (val8 >> 1) & 0x01;
    } else { doc["TREG_1_0"] = -1; doc["TSHUT_1_0"] = -1; doc["VBUS_PD_EN"] = -1; doc["VAC1_PD_EN"] = -1; doc["VAC2_PD_EN"] = -1; }
    if(readByte(0x17, val8)) {
        doc["JEITA_VSET_2_0"] = (val8 >> 5) & 0x07;
        doc["JEITA_ISETH_1_0"] = (val8 >> 3) & 0x03;
        doc["JEITA_ISETC_1_0"] = (val8 >> 1) & 0x03;
    } else { doc["JEITA_VSET_2_0"] = -1; doc["JEITA_ISETH_1_0"] = -1; doc["JEITA_ISETC_1_0"] = -1; }
    if(readByte(0x18, val8)) {
        doc["TS_COOL_1_0"] = (val8 >> 6) & 0x03;
        doc["TS_WARM_1_0"] = (val8 >> 4) & 0x03;
        doc["BHOT_1_0"] = (val8 >> 2) & 0x03;
        doc["BCOLD"] = (val8 >> 1) & 0x01;
        doc["TS_IGNORE"] = val8 & 0x01;
    } else { doc["TS_COOL_1_0"] = -1; doc["TS_WARM_1_0"] = -1; doc["BHOT_1_0"] = -1; doc["BCOLD"] = -1; doc["TS_IGNORE"] = -1; }
    if(readByte(0x2E, val8)) {
        doc["ADC_RATE"] = (val8 >> 6) & 0x01;
        doc["ADC_AVG"] = (val8 >> 3) & 0x01;
        doc["ADC_AVG_INIT"] = (val8 >> 2) & 0x01;
    } else { doc["ADC_RATE"] = -1; doc["ADC_AVG"] = -1; doc["ADC_AVG_INIT"] = -1; }
    if(readByte(0x2F, val8)) {
        doc["IBUS_ADC_DIS"] = (val8 >> 7) & 0x01;
        doc["IBAT_ADC_DIS"] = (val8 >> 6) & 0x01;
        doc["VBUS_ADC_DIS"] = (val8 >> 5) & 0x01;
        doc["VBAT_ADC_DIS"] = (val8 >> 4) & 0x01;
        doc["VSYS_ADC_DIS"] = (val8 >> 3) & 0x01;
        doc["TS_ADC_DIS"] = (val8 >> 2) & 0x01;
        doc["TDIE_ADC_DIS"] = (val8 >> 1) & 0x01;
    } else { doc["IBUS_ADC_DIS"] = -1; doc["IBAT_ADC_DIS"] = -1; doc["VBUS_ADC_DIS"] = -1; doc["VBAT_ADC_DIS"] = -1; doc["VSYS_ADC_DIS"] = -1; doc["TS_ADC_DIS"] = -1; doc["TDIE_ADC_DIS"] = -1; }
    if(readByte(0x30, val8)) {
        doc["DP_ADC_DIS"] = (val8 >> 7) & 0x01;
        doc["DM_ADC_DIS"] = (val8 >> 6) & 0x01;
        doc["VAC2_ADC_DIS"] = (val8 >> 5) & 0x01;
        doc["VAC1_ADC_DIS"] = (val8 >> 4) & 0x01;
    } else { doc["DP_ADC_DIS"] = -1; doc["DM_ADC_DIS"] = -1; doc["VAC2_ADC_DIS"] = -1; doc["VAC1_ADC_DIS"] = -1; }
    if(readByte(0x47, val8)) {
        doc["DPLUS_DAC_2_0"] = (val8 >> 5) & 0x07;
        doc["DMINUS_DAC_2_0"] = (val8 >> 2) & 0x07;
    } else { doc["DPLUS_DAC_2_0"] = -1; doc["DMINUS_DAC_2_0"] = -1; }
    if(readByte(0x48, val8)) {
        doc["PN_2_0"] = (val8 >> 3) & 0x07;
        doc["DEV_REV_2_0"] = val8 & 0x07;
    } else { doc["PN_2_0"] = -1; doc["DEV_REV_2_0"] = -1; }
    String output; serializeJson(doc, output); request->send(200, "application/json", output);
}

void handleApiData5(AsyncWebServerRequest *request) {
    StaticJsonDocument<1024> doc;
    uint8_t val8;
    uint16_t val16;
    if(readByte(0x1B, val8)) {
        doc["IINDPM_STAT"] = (val8 >> 7) & 0x01;
        doc["VINDPM_STAT"] = (val8 >> 6) & 0x01;
        doc["WD_STAT"] = (val8 >> 5) & 0x01;
        doc["PG_STAT"] = (val8 >> 3) & 0x01;
    } else { doc["IINDPM_STAT"] = -1; doc["VINDPM_STAT"] = -1; doc["WD_STAT"] = -1; doc["PG_STAT"] = -1; }
    if(readByte(0x1C, val8)) { doc["BC1_2_DONE_STAT"] = val8 & 0x01; } else { doc["BC1_2_DONE_STAT"] = -1; }
    if(readByte(0x1D, val8)) {
        doc["TREG_STAT"] = (val8 >> 2) & 0x01;
        doc["DPDM_STAT"] = (val8 >> 1) & 0x01;
    } else { doc["TREG_STAT"] = -1; doc["DPDM_STAT"] = -1; }
    if(readByte(0x1E, val8)) {
        doc["ACRB2_STAT"] = (val8 >> 7) & 0x01;
        doc["ACRB1_STAT"] = (val8 >> 6) & 0x01;
        doc["ADC_DONE_STAT"] = (val8 >> 5) & 0x01;
        doc["CHG_TMR_STAT"] = (val8 >> 3) & 0x01;
        doc["TRICHG_TMR_STAT"] = (val8 >> 2) & 0x01;
        doc["PRECHG_TMR_STAT"] = (val8 >> 1) & 0x01;
    } else { doc["ACRB2_STAT"] = -1; doc["ACRB1_STAT"] = -1; doc["ADC_DONE_STAT"] = -1; doc["CHG_TMR_STAT"] = -1; doc["TRICHG_TMR_STAT"] = -1; doc["PRECHG_TMR_STAT"] = -1; }
    if(readByte(0x1F, val8)) {
        doc["TS_COLD_STAT"] = (val8 >> 3) & 0x01;
        doc["TS_COOL_STAT"] = (val8 >> 2) & 0x01;
        doc["TS_WARM_STAT"] = (val8 >> 1) & 0x01;
        doc["TS_HOT_STAT"] = val8 & 0x01;
    } else { doc["TS_COLD_STAT"] = -1; doc["TS_COOL_STAT"] = -1; doc["TS_WARM_STAT"] = -1; doc["TS_HOT_STAT"] = -1; }
    if(readByte(0x20, val8)) { doc["IBAT_REG_STAT"] = (val8 >> 7) & 0x01; } else { doc["IBAT_REG_STAT"] = -1; }
    if(readWord(0x43, val16)) { doc["D_PLUS_ADC_15_0"] = val16; } else { doc["D_PLUS_ADC_15_0"] = -1; }
    if(readWord(0x45, val16)) { doc["D_MINUS_ADC_15_0"] = val16; } else { doc["D_MINUS_ADC_15_0"] = -1; }
    String output; serializeJson(doc, output); request->send(200, "application/json", output);
}

// --- UPDATED API WRITE HANDLER ---
void handleApiWrite(AsyncWebServerRequest *request) {
    if (request->hasParam("reg", true) && request->hasParam("val", true)) {
        String regName = request->getParam("reg", true)->value();
        long val = request->getParam("val", true)->value().toInt();
        bool success = false;

        Serial.printf("Write request for %s with value %ld\n", regName.c_str(), val);
        
        // Handle REG_RST command
        if (regName == "REG_RST") {
            success = modifyByte(0x09, 0b01000000, 0b01000000);
        }
        // Page 1
        else if (regName == "VSYSMIN_5_0") { uint8_t regVal = (val - 2500) / 250; success = modifyByte(0x00, regVal, 0x3F); }
        else if (regName == "CELL_1_0") { if (val >= 1 && val <= 4) { uint8_t regVal = (val - 1); success = modifyByte(0x0A, regVal << 6, 0b11000000); } }
        else if (regName == "VOTG_10_0") { uint16_t regVal = (val - 2800) / 10; success = writeWord(0x0B, regVal); }
        else if (regName == "IOTG_6_0") { uint8_t regVal = val / 40; success = modifyByte(0x0D, regVal, 0x7F); }
        else if (regName == "EN_CHG") { success = modifyByte(0x0F, (uint8_t)val << 5, 0b00100000); }
        
        // Page 2
        else if (regName == "VREG_10_0") { uint16_t regVal = val / 10; success = writeWord(0x01, regVal); }
        else if (regName == "ICHG_8_0") { uint16_t regVal = val / 10; success = writeWord(0x03, regVal); }
        else if (regName == "VINDPM_7_0") { uint8_t regVal = (val - 3600) / 100; success = writeByte(0x05, regVal); }
        else if (regName == "IINDPM_8_0") { uint16_t regVal = val / 10; success = writeWord(0x06, regVal); }
        else if (regName == "EN_ICO") { success = modifyByte(0x0F, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "FORCE_ICO") { success = modifyByte(0x0F, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "EN_HIZ") { success = modifyByte(0x0F, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "SDRV_CTRL_1_0") { success = modifyByte(0x11, (uint8_t)val << 1, 0b00000110); }
        else if (regName == "EN_OTG") { success = modifyByte(0x12, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "DIS_ACDRV") { success = modifyByte(0x12, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "EN_ACDRV2") { success = modifyByte(0x13, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "EN_ACDRV1") { success = modifyByte(0x13, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "FORCE_VINDPM_DET") { success = modifyByte(0x13, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "SFET_PRESENT") { success = modifyByte(0x14, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "EN_MPPT") { success = modifyByte(0x15, (uint8_t)val, 0b00000001); }
        else if (regName == "ADC_EN") { success = modifyByte(0x2E, (uint8_t)val << 7, 0b10000000); }

        // Page 3
        else if (regName == "VBAT_LOWV_1_0") { success = modifyByte(0x08, (uint8_t)val << 6, 0b11000000); }
        else if (regName == "IPRECHG_5_0") { uint8_t regVal = val / 40; success = modifyByte(0x08, regVal, 0x3F); }
        else if (regName == "ITERM_4_0") { uint8_t regVal = val / 40; success = modifyByte(0x09, regVal, 0x1F); }
        else if (regName == "TRECHG_1_0") { success = modifyByte(0x0A, (uint8_t)val << 4, 0b00110000); }
        else if (regName == "VRECHG_3_0") { uint8_t regVal = (val - 50) / 50; success = modifyByte(0x0A, regVal, 0x0F); }
        else if (regName == "VAC_OVP_1_0") { success = modifyByte(0x10, (uint8_t)val << 4, 0b00110000); }
        else if (regName == "EN_IBAT") { success = modifyByte(0x14, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "IBAT_REG_1_0") { success = modifyByte(0x14, (uint8_t)val << 3, 0b00011000); }
        else if (regName == "EN_IINDPM") { success = modifyByte(0x14, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "EN_EXTILIM") { success = modifyByte(0x14, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "ADC_SAMPLE_1_0") { success = modifyByte(0x2E, (uint8_t)val << 4, 0b00110000); }

        // Page 4
        else if (regName == "STOP_WD_CHG") { success = modifyByte(0x09, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "PRECHG_TMR") { success = modifyByte(0x0D, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "TOPOFF_TMR_1_0") { success = modifyByte(0x0E, (uint8_t)val << 6, 0b11000000); }
        else if (regName == "EN_TRICHG_TMR") { success = modifyByte(0x0E, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "EN_PRECHG_TMR") { success = modifyByte(0x0E, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "EN_CHG_TMR") { success = modifyByte(0x0E, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "CHG_TMR_1_0") { success = modifyByte(0x0E, (uint8_t)val << 1, 0b00000110); }
        else if (regName == "TMR2X_EN") { success = modifyByte(0x0E, (uint8_t)val, 0b00000001); }
        else if (regName == "EN_AUTO_IBATDIS") { success = modifyByte(0x0F, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "FORCE_IBATDIS") { success = modifyByte(0x0F, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "EN_TERM") { success = modifyByte(0x0F, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "WATCHDOG_2_0") { success = modifyByte(0x10, (uint8_t)val, 0x07); }
        else if (regName == "FORCE_INDET") { success = modifyByte(0x11, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "AUTO_INDET_EN") { success = modifyByte(0x11, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "EN_12V") { success = modifyByte(0x11, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "EN_9V") { success = modifyByte(0x11, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "HVDCP_EN") { success = modifyByte(0x11, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "SDRV_DLY") { success = modifyByte(0x11, (uint8_t)val, 0b00000001); }
        else if (regName == "PFM_OTG_DIS") { success = modifyByte(0x12, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "PFM_FWD_DIS") { success = modifyByte(0x12, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "WKUP_DLY") { success = modifyByte(0x12, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "DIS_LDO") { success = modifyByte(0x12, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "DIS_OTG_OOA") { success = modifyByte(0x12, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "DIS_FWD_OOA") { success = modifyByte(0x12, (uint8_t)val, 0b00000001); }
        else if (regName == "PWM_FREQ") { success = modifyByte(0x13, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "DIS_STAT") { success = modifyByte(0x13, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "DIS_VSYS_SHORT") { success = modifyByte(0x13, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "DIS_VOTG_UVP") { success = modifyByte(0x13, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "EN_IBUS_OCP") { success = modifyByte(0x13, (uint8_t)val, 0b00000001); }
        else if (regName == "EN_BATOC") { success = modifyByte(0x14, (uint8_t)val, 0b00000001); }
        else if (regName == "VOC_PCT_2_0") { success = modifyByte(0x15, (uint8_t)val << 5, 0b11100000); }
        else if (regName == "VOC_DLY_1_0") { success = modifyByte(0x15, (uint8_t)val << 3, 0b00011000); }
        else if (regName == "VOC_RATE_1_0") { success = modifyByte(0x15, (uint8_t)val << 1, 0b00000110); }
        else if (regName == "TREG_1_0") { success = modifyByte(0x16, (uint8_t)val << 6, 0b11000000); }
        else if (regName == "TSHUT_1_0") { success = modifyByte(0x16, (uint8_t)val << 4, 0b00110000); }
        else if (regName == "VBUS_PD_EN") { success = modifyByte(0x16, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "VAC1_PD_EN") { success = modifyByte(0x16, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "VAC2_PD_EN") { success = modifyByte(0x16, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "JEITA_VSET_2_0") { success = modifyByte(0x17, (uint8_t)val << 5, 0b11100000); }
        else if (regName == "JEITA_ISETH_1_0") { success = modifyByte(0x17, (uint8_t)val << 3, 0b00011000); }
        else if (regName == "JEITA_ISETC_1_0") { success = modifyByte(0x17, (uint8_t)val << 1, 0b00000110); }
        else if (regName == "TS_COOL_1_0") { success = modifyByte(0x18, (uint8_t)val << 6, 0b11000000); }
        else if (regName == "TS_WARM_1_0") { success = modifyByte(0x18, (uint8_t)val << 4, 0b00110000); }
        else if (regName == "BHOT_1_0") { success = modifyByte(0x18, (uint8_t)val << 2, 0b00001100); }
        else if (regName == "BCOLD") { success = modifyByte(0x18, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "TS_IGNORE") { success = modifyByte(0x18, (uint8_t)val, 0b00000001); }
        else if (regName == "ADC_RATE") { success = modifyByte(0x2E, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "ADC_AVG") { success = modifyByte(0x2E, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "ADC_AVG_INIT") { success = modifyByte(0x2E, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "IBUS_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "IBAT_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "VBUS_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "VBAT_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "VSYS_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 3, 0b00001000); }
        else if (regName == "TS_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 2, 0b00000100); }
        else if (regName == "TDIE_ADC_DIS") { success = modifyByte(0x2F, (uint8_t)val << 1, 0b00000010); }
        else if (regName == "DP_ADC_DIS") { success = modifyByte(0x30, (uint8_t)val << 7, 0b10000000); }
        else if (regName == "DM_ADC_DIS") { success = modifyByte(0x30, (uint8_t)val << 6, 0b01000000); }
        else if (regName == "VAC2_ADC_DIS") { success = modifyByte(0x30, (uint8_t)val << 5, 0b00100000); }
        else if (regName == "VAC1_ADC_DIS") { success = modifyByte(0x30, (uint8_t)val << 4, 0b00010000); }
        else if (regName == "DPLUS_DAC_2_0") { success = modifyByte(0x47, (uint8_t)val << 5, 0b11100000); }
        else if (regName == "DMINUS_DAC_2_0") { success = modifyByte(0x47, (uint8_t)val << 2, 0b00011100); }
        
        if (success) { request->send(200, "text/plain", "OK"); } 
        else { request->send(500, "text/plain", "Failed to write to register or unknown register name."); }
    } else {
        request->send(400, "text/plain", "Missing parameters.");
    }
}


void setup() {
    Serial.begin(115200);
    Wire.begin();

    // --- NEW: Configure ADC on startup ---
    // REG0x2E: ADC_EN=1, ADC_RATE=1 (One-shot), keep other defaults (ADC_SAMPLE=11b)
    // This corresponds to the value 0b11110000 = 0xF0
    Serial.println("Setting initial ADC state to: Enabled, One-Shot mode.");
    if (writeByte(0x2E, 0xF0)) {
        Serial.println("Initial ADC configuration successful.");
    } else {
        Serial.println("FAILED to set initial ADC configuration.");
    }
    // --- END NEW ---

    if (!LittleFS.begin(true)) {
        Serial.println("An Error has occurred while mounting LittleFS");
        return;
    }

    WiFi.softAP(ssid, password);
    IPAddress IP = WiFi.softAPIP();
    Serial.print("AP IP address: ");
    Serial.println(IP);

    pinMode(interruptPin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(interruptPin), handleInterrupt, FALLING);

    ws.onEvent(onEvent);
    server.addHandler(&ws);

    // --- Setup Web Server Routes ---
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) { request->send(LittleFS, "/index.html", "text/html"); });
    server.on("/page1.html", HTTP_GET, [](AsyncWebServerRequest *request){ request->send(LittleFS, "/page1.html", "text/html"); });
    server.on("/page2.html", HTTP_GET, [](AsyncWebServerRequest *request){ request->send(LittleFS, "/page2.html", "text/html"); });
    server.on("/page3.html", HTTP_GET, [](AsyncWebServerRequest *request){ request->send(LittleFS, "/page3.html", "text/html"); });
    server.on("/page4.html", HTTP_GET, [](AsyncWebServerRequest *request){ request->send(LittleFS, "/page4.html", "text/html"); });
    server.on("/page5.html", HTTP_GET, [](AsyncWebServerRequest *request){ request->send(LittleFS, "/page5.html", "text/html"); });
    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) { request->send(LittleFS, "/style.css", "text/css"); });
    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) { request->send(LittleFS, "/script.js", "text/javascript"); });
    
    // API routes
    server.on("/api/data1", HTTP_GET, handleApiData1);
    server.on("/api/data2", HTTP_GET, handleApiData2);
    server.on("/api/data3", HTTP_GET, handleApiData3);
    server.on("/api/data4", HTTP_GET, handleApiData4);
    server.on("/api/data5", HTTP_GET, handleApiData5);

    server.on("/api/write", HTTP_POST, handleApiWrite);

    server.onNotFound([](AsyncWebServerRequest *request) { request->send(404, "text/plain", "Not found"); });

    server.begin();
    Serial.println("HTTP server started");
}

void loop() {
    if (interruptFired) {
        interruptFired = false;
        String reason = getInterruptReason();
        if (reason.length() > 0) {
            Serial.print("Interrupt Reason: ");
            Serial.println(reason);
            // Send interrupt reason to all connected WebSocket clients
            ws.textAll(reason);
        }
    }

    // Automatic Watchdog Reset
    if (millis() - lastWatchdogReset > watchdogInterval) {
        lastWatchdogReset = millis();
        // Reset the watchdog timer by writing 1 to WD_RST bit (REG0x10[3])
        Serial.println("Resetting BQ25672 watchdog timer...");
        if (modifyByte(0x10, 0b00001000, 0b00001000)) {
            Serial.println("Watchdog reset successful.");
        } else {
            Serial.println("Failed to reset watchdog.");
        }
    }
    
    ws.cleanupClients();
}
