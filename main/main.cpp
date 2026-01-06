#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <Wire.h>

// I2C Address for BQ25672
#define BQ25672_I2C_ADDR 0x6B

// WiFi Access Point credentials
const char *ssid = "ESP32_BQ25672_Monitor";
const char *password = "password123";

// --- Interrupt & WebSocket Setup ---
const int interruptPin = 4; // Connect INT pin to this GPIO
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");             // WebSocket endpoint
volatile bool interruptFired = false; // Flag for interrupt detection

// --- Watchdog Timer ---
unsigned long lastWatchdogReset = 0;
const long watchdogInterval =
    30000; // 30 seconds (less than the default 40s timeout)

// --- WebSocket Cleanup Timer ---
unsigned long lastWsCleanup = 0;
const long wsCleanupInterval =
    1000; // Clean up disconnected clients every 1 second

// --- Configuration Files ---
#define HISTORY_FILE "/history.log"
#define MAX_HISTORY_ENTRIES 50         // Keep the last 50 events
#define SETTINGS_FILE "/settings.json" // File for persistent settings

// --- Battery Removal Detection Globals ---
#define INT_BUFFER_SIZE 10
unsigned long interruptTimestamps[INT_BUFFER_SIZE];
uint8_t interruptHead = 0;
bool bufferFilled = false;

// ===================================================================================
// بخش اعتبارسنجی ورودی در سمت سرور
// ===================================================================================
struct ValidationRule {
  const char *regName;
  long min;
  long max;
};

// This map ensures that only valid values are written to the registers.
const ValidationRule validationMap[] = {
    {"VSYSMIN_5_0", 2500, 16000},
    {"CELL_1_0", 1, 4},
    {"VOTG_10_0", 2800, 22000},
    {"IOTG_6_0", 160, 3360},
    {"EN_CHG", 0, 1},
    {"VREG_10_0", 3000, 18800},
    {"ICHG_8_0", 50, 3000},
    {"VINDPM_7_0", 3600, 22000},
    {"IINDPM_8_0", 100, 3300},
    {"EN_ICO", 0, 1},
    {"EN_HIZ", 0, 1},
    {"SDRV_CTRL_1_0", 0, 3},
    {"EN_OTG", 0, 1},
    {"EN_ACDRV2", 0, 1},
    {"EN_ACDRV1", 0, 1},
    {"DIS_ACDRV", 0, 1},
    {"SFET_PRESENT", 0, 1},
    {"EN_MPPT", 0, 1},
    {"ADC_EN", 0, 1},
    {"VBAT_LOWV_1_0", 0, 3},
    {"IPRECHG_5_0", 40, 2000},
    {"ITERM_4_0", 40, 1000},
    {"TRECHG_1_0", 0, 3},
    {"VRECHG_3_0", 50, 800},
    {"VAC_OVP_1_0", 0, 3},
    {"EN_IBAT", 0, 1},
    {"IBAT_REG_1_0", 0, 3},
    {"EN_IINDPM", 0, 1},
    {"EN_EXTILIM", 0, 1},
    {"ADC_SAMPLE_1_0", 0, 3},
    {"STOP_WD_CHG", 0, 1},
    {"PRECHG_TMR", 0, 1},
    {"TOPOFF_TMR_1_0", 0, 3},
    {"EN_TRICHG_TMR", 0, 1},
    {"EN_PRECHG_TMR", 0, 1},
    {"EN_CHG_TMR", 0, 1},
    {"CHG_TMR_1_0", 0, 3},
    {"TMR2X_EN", 0, 1},
    {"EN_AUTO_IBATDIS", 0, 1},
    {"EN_TERM", 0, 1},
    {"WATCHDOG_2_0", 0, 7},
    {"AUTO_INDET_EN", 0, 1},
    {"EN_12V", 0, 1},
    {"EN_9V", 0, 1},
    {"HVDCP_EN", 0, 1},
    {"SDRV_DLY", 0, 1},
    {"PFM_OTG_DIS", 0, 1},
    {"PFM_FWD_DIS", 0, 1},
    {"WKUP_DLY", 0, 1},
    {"DIS_LDO", 0, 1},
    {"DIS_OTG_OOA", 0, 1},
    {"DIS_FWD_OOA", 0, 1},
    {"PWM_FREQ", 0, 1},
    {"DIS_STAT", 0, 1},
    {"DIS_VSYS_SHORT", 0, 1},
    {"DIS_VOTG_UVP", 0, 1},
    {"EN_IBUS_OCP", 0, 1},
    {"EN_BATOC", 0, 1},
    {"VOC_PCT_2_0", 0, 7},
    {"VOC_DLY_1_0", 0, 3},
    {"VOC_RATE_1_0", 0, 3},
    {"TREG_1_0", 0, 3},
    {"TSHUT_1_0", 0, 3},
    {"VBUS_PD_EN", 0, 1},
    {"VAC1_PD_EN", 0, 1},
    {"VAC2_PD_EN", 0, 1},
    {"JEITA_VSET_2_0", 0, 7},
    {"JEITA_ISETH_1_0", 0, 3},
    {"JEITA_ISETC_1_0", 0, 3},
    {"TS_COOL_1_0", 0, 3},
    {"TS_WARM_1_0", 0, 3},
    {"BHOT_1_0", 0, 3},
    {"BCOLD", 0, 1},
    {"TS_IGNORE", 0, 1},
    {"ADC_RATE", 0, 1},
    {"ADC_AVG", 0, 1},
    {"ADC_AVG_INIT", 0, 1},
    {"IBUS_ADC_DIS", 0, 1},
    {"IBAT_ADC_DIS", 0, 1},
    {"VBUS_ADC_DIS", 0, 1},
    {"VBAT_ADC_DIS", 0, 1},
    {"VSYS_ADC_DIS", 0, 1},
    {"TS_ADC_DIS", 0, 1},
    {"TDIE_ADC_DIS", 0, 1},
    {"DP_ADC_DIS", 0, 1},
    {"DM_ADC_DIS", 0, 1},
    {"VAC2_ADC_DIS", 0, 1},
    {"VAC1_ADC_DIS", 0, 1},
    {"DPLUS_DAC_2_0", 0, 7},
    {"DMINUS_DAC_2_0", 0, 7},

    // --- ADDED: Action/Reset Bits (Single Bit R/W) ---
    {"REG_RST", 0, 1},          // [cite: 100]
    {"FORCE_IBATDIS", 0, 1},    // [cite: 239]
    {"FORCE_ICO", 0, 1},        // [cite: 239]
    {"WD_RST", 0, 1},           // [cite: 261]
    {"FORCE_INDET", 0, 1},      // [cite: 278]
    {"FORCE_VINDPM_DET", 0, 1}, // [cite: 316]

    // --- ADDED: Interrupt Mask Registers (All are R/W, 0=INT, 1=No INT) ---
    // REG28_Charger_Mask_0 [cite: 695]
    {"IINDPM_MASK", 0, 1},
    {"VINDPM_MASK", 0, 1},
    {"WD_MASK", 0, 1},
    {"POORSRC_MASK", 0, 1},
    {"PG_MASK", 0, 1},
    {"AC2_PRESENT_MASK", 0, 1},
    {"AC1_PRESENT_MASK", 0, 1},
    {"VBUS_PRESENT_MASK", 0, 1},

    // REG29_Charger_Mask_1 [cite: 718]
    {"CHG_MASK", 0, 1},
    {"ICO_MASK", 0, 1},
    {"VBUS_MASK", 0, 1},
    {"TREG_MASK", 0, 1},
    {"VBAT_PRESENT_MASK", 0, 1},
    {"BC1_2_DONE_MASK", 0, 1},

    // REG2A_Charger_Mask_2 [cite: 733]
    {"DPDM_DONE_MASK", 0, 1},
    {"ADC_DONE_MASK", 0, 1},
    {"VSYS_MASK", 0, 1},
    {"CHG_TMR_MASK", 0, 1},
    {"TRICHG_TMR_MASK", 0, 1},
    {"PRECHG_TMR_MASK", 0, 1},
    {"TOPOFF_TMR_MASK", 0, 1},

    // REG2B_Charger_Mask_3 [cite: 745]
    {"VBATOTG_LOW_MASK", 0, 1},
    {"TS_COLD_MASK", 0, 1},
    {"TS_COOL_MASK", 0, 1},
    {"TS_WARM_MASK", 0, 1},
    {"TS_HOT_MASK", 0, 1},

    // REG2C_FAULT_Mask_0 [cite: 762]
    {"IBAT_REG_MASK", 0, 1},
    {"VBUS_OVP_MASK", 0, 1},
    {"VBAT_OVP_MASK", 0, 1},
    {"IBUS_OCP_MASK", 0, 1},
    {"IBAT_OCP_MASK", 0, 1},
    {"CONV_OCP_MASK", 0, 1},
    {"VAC2_OVP_MASK", 0, 1},
    {"VAC1_OVP_MASK", 0, 1},

    // REG2D_FAULT_Mask_1 [cite: 774]
    {"VSYS_SHORT_MASK", 0, 1},
    {"VSYS_OVP_MASK", 0, 1},
    {"OTG_OVP_MASK", 0, 1},
    {"OTG_UVP_MASK", 0, 1},
    {"TSHUT_MASK", 0, 1}};

bool isValueValid(const String &regName, long value) {
  for (const auto &rule : validationMap) {
    if (regName.equals(rule.regName)) {
      if (value >= rule.min && value <= rule.max) {
        return true;
      } else {
        Serial.printf(
            "Validation FAILED for %s: Value %ld is out of range [%ld, %ld]\n",
            regName.c_str(), value, rule.min, rule.max);
        return false;
      }
    }
  }
  return true;
}

// --- I2C Communication Functions ---
bool readWord(uint8_t reg, uint16_t &value) {
  Wire.beginTransmission(BQ25672_I2C_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((uint8_t)BQ25672_I2C_ADDR, (uint8_t)2) != 2) {
    return false;
  }
  // دیتاشیت نشان می‌دهد رجیستر اول (مثلاً 0x35)
  // = MSB، رجیستر بعدی = LSB.
  uint8_t msb = Wire.read();
  uint8_t lsb = Wire.read();
  value = ((uint16_t)msb << 8) | (uint16_t)lsb;
  // حذف Serial.println(value) — اختیاری: در صورت نیاز لاگ جداگانه بزن
  return true;
}

bool readByte(uint8_t reg, uint8_t &value) {
  Wire.beginTransmission(BQ25672_I2C_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    Serial.printf("I2C readByte error (address phase) for reg 0x%02X\n", reg);
    return false;
  }
  if (Wire.requestFrom((uint8_t)BQ25672_I2C_ADDR, (uint8_t)1) != 1) {
    Serial.printf("I2C readByte error (data phase) for reg 0x%02X\n", reg);
    return false;
  }
  value = Wire.read();
  return true;
}

bool writeWord(uint8_t reg, uint16_t value) {
  Wire.beginTransmission(BQ25672_I2C_ADDR);
  Wire.write(reg);
  // بنابر mapping رجیستر: آدرس اول -> MSB، پس MSB را اول بنویس
  Wire.write((uint8_t)((value >> 8) & 0xFF)); // MSB
  Wire.write((uint8_t)(value & 0xFF));        // LSB
  if (Wire.endTransmission() != 0) {
    Serial.printf("I2C writeWord error for reg 0x%02X\n", reg);
    return false;
  }
  return true;
}

bool writeByte(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(BQ25672_I2C_ADDR);
  Wire.write(reg);
  Wire.write(value);
  if (Wire.endTransmission() != 0) {
    Serial.printf("I2C writeByte error for reg 0x%02X\n", reg);
    return false;
  }
  return true;
}

bool modifyByte(uint8_t reg, uint8_t value, uint8_t mask) {
  uint8_t currentValue;
  if (!readByte(reg, currentValue)) {
    Serial.printf("Failed to read reg 0x%02X for modification\n", reg);
    return false;
  }
  uint8_t newValue = (currentValue & ~mask) | (value & mask);
  return writeByte(reg, newValue);
}

bool readBytes(uint8_t startReg, uint8_t *buffer, uint8_t count) {
  Wire.beginTransmission(BQ25672_I2C_ADDR);
  Wire.write(startReg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((uint8_t)BQ25672_I2C_ADDR, count) != count) {
    return false;
  }
  for (int i = 0; i < count; i++) {
    buffer[i] = Wire.read();
  }
  return true;
}

// --- History Logging Functions ---
void logInterrupt(const String &reason) {
  File historyFile = LittleFS.open(HISTORY_FILE, "r");
  JsonDocument doc;
  JsonArray history;
  if (historyFile && historyFile.size() > 0) {
    DeserializationError error = deserializeJson(doc, historyFile);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.c_str());
      history = doc.to<JsonArray>();
    } else {
      history = doc.as<JsonArray>();
    }
  } else {
    history = doc.to<JsonArray>();
  }
  historyFile.close();
  JsonObject newEntry = history.add<JsonObject>();
  newEntry["timestamp"] = millis();
  newEntry["message"] = reason; // The message is now a JSON string
  newEntry["seen"] = false;
  while (history.size() > MAX_HISTORY_ENTRIES) {
    history.remove(0);
  }
  historyFile = LittleFS.open(HISTORY_FILE, "w");
  if (!historyFile) {
    Serial.println("Failed to open history file for writing");
    return;
  }
  if (serializeJson(doc, historyFile) == 0) {
    Serial.println(F("Failed to write to history file"));
  }
  historyFile.close();
}

// --- REFACTORED: Central function to write to a BQ25672 register by name ---
bool writeBqRegister(const String &regName, long val) {
  bool success = false;
  if (regName == "REG_RST") {
    success = modifyByte(0x09, 0b01000000, 0b01000000);
    if (success) {
      Serial.println("Performing factory reset: Deleting settings file.");
      if (LittleFS.exists(SETTINGS_FILE)) {
        if (!LittleFS.remove(SETTINGS_FILE)) {
          Serial.println("Error deleting settings.json.");
        }
      }
    }
  } else if (regName == "VSYSMIN_5_0") {
    uint8_t regVal = (val - 2500) / 250;
    success = modifyByte(0x00, regVal, 0x3F);
  } else if (regName == "CELL_1_0") {
    if (val >= 1 && val <= 4) {
      uint8_t regVal = (val - 1);
      success = modifyByte(0x0A, regVal << 6, 0b11000000);
    }
  } else if (regName == "VOTG_10_0") {
    uint16_t regVal = (val - 2800) / 10;
    success = writeWord(0x0B, regVal);
  } else if (regName == "IOTG_6_0") {
    uint8_t regVal = val / 40;
    success = modifyByte(0x0D, regVal, 0x7F);
  } else if (regName == "EN_CHG") {
    success = modifyByte(0x0F, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "VREG_10_0") {
    uint16_t regVal = val / 10;
    success = writeWord(0x01, regVal);
  } else if (regName == "ICHG_8_0") {
    uint16_t regVal = val / 10;
    success = writeWord(0x03, regVal);
  } else if (regName == "VINDPM_7_0") {
    uint8_t regVal = (val) / 100;
    success = writeByte(0x05, regVal);
  } else if (regName == "IINDPM_8_0") {
    uint16_t regVal = val / 10;
    success = writeWord(0x06, regVal);
  } else if (regName == "EN_ICO") {
    success = modifyByte(0x0F, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "FORCE_ICO") {
    success = modifyByte(0x0F, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "EN_HIZ") {
    success = modifyByte(0x0F, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "SDRV_CTRL_1_0") {
    success = modifyByte(0x11, (uint8_t)val << 1, 0b00000110);
  } else if (regName == "EN_OTG") {
    success = modifyByte(0x12, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "DIS_ACDRV") {
    success = modifyByte(0x12, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "EN_ACDRV2") {
    success = modifyByte(0x13, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "EN_ACDRV1") {
    success = modifyByte(0x13, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "FORCE_VINDPM_DET") {
    success = modifyByte(0x13, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "SFET_PRESENT") {
    success = modifyByte(0x14, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "EN_MPPT") {
    success = modifyByte(0x15, (uint8_t)val, 0b00000001);
  } else if (regName == "ADC_EN") {
    success = modifyByte(0x2E, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "VBAT_LOWV_1_0") {
    success = modifyByte(0x08, (uint8_t)val << 6, 0b11000000);
  } else if (regName == "IPRECHG_5_0") {
    uint8_t regVal = val / 40;
    success = modifyByte(0x08, regVal, 0x3F);
  } else if (regName == "ITERM_4_0") {
    uint8_t regVal = val / 40;
    success = modifyByte(0x09, regVal, 0x1F);
  } else if (regName == "TRECHG_1_0") {
    success = modifyByte(0x0A, (uint8_t)val << 4, 0b00110000);
  } else if (regName == "VRECHG_3_0") {
    uint8_t regVal = (val - 50) / 50;
    success = modifyByte(0x0A, regVal, 0x0F);
  } else if (regName == "VAC_OVP_1_0") {
    success = modifyByte(0x10, (uint8_t)val << 4, 0b00110000);
  } else if (regName == "EN_IBAT") {
    success = modifyByte(0x14, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "IBAT_REG_1_0") {
    success = modifyByte(0x14, (uint8_t)val << 3, 0b00011000);
  } else if (regName == "EN_IINDPM") {
    success = modifyByte(0x14, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "EN_EXTILIM") {
    success = modifyByte(0x14, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "ADC_SAMPLE_1_0") {
    success = modifyByte(0x2E, (uint8_t)val << 4, 0b00110000);
  } else if (regName == "STOP_WD_CHG") {
    success = modifyByte(0x09, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "PRECHG_TMR") {
    success = modifyByte(0x0D, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "TOPOFF_TMR_1_0") {
    success = modifyByte(0x0E, (uint8_t)val << 6, 0b11000000);
  } else if (regName == "EN_TRICHG_TMR") {
    success = modifyByte(0x0E, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "EN_PRECHG_TMR") {
    success = modifyByte(0x0E, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "EN_CHG_TMR") {
    success = modifyByte(0x0E, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "CHG_TMR_1_0") {
    success = modifyByte(0x0E, (uint8_t)val << 1, 0b00000110);
  } else if (regName == "TMR2X_EN") {
    success = modifyByte(0x0E, (uint8_t)val, 0b00000001);
  } else if (regName == "EN_AUTO_IBATDIS") {
    success = modifyByte(0x0F, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "FORCE_IBATDIS") {
    success = modifyByte(0x0F, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "EN_TERM") {
    success = modifyByte(0x0F, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "WATCHDOG_2_0") {
    success = modifyByte(0x10, (uint8_t)val, 0x07);
  } else if (regName == "FORCE_INDET") {
    success = modifyByte(0x11, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "AUTO_INDET_EN") {
    success = modifyByte(0x11, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "EN_12V") {
    success = modifyByte(0x11, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "EN_9V") {
    success = modifyByte(0x11, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "HVDCP_EN") {
    success = modifyByte(0x11, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "SDRV_DLY") {
    success = modifyByte(0x11, (uint8_t)val, 0b00000001);
  } else if (regName == "PFM_OTG_DIS") {
    success = modifyByte(0x12, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "PFM_FWD_DIS") {
    success = modifyByte(0x12, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "WKUP_DLY") {
    success = modifyByte(0x12, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "DIS_LDO") {
    success = modifyByte(0x12, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "DIS_OTG_OOA") {
    success = modifyByte(0x12, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "DIS_FWD_OOA") {
    success = modifyByte(0x12, (uint8_t)val, 0b00000001);
  } else if (regName == "PWM_FREQ") {
    success = modifyByte(0x13, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "DIS_STAT") {
    success = modifyByte(0x13, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "DIS_VSYS_SHORT") {
    success = modifyByte(0x13, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "DIS_VOTG_UVP") {
    success = modifyByte(0x13, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "EN_IBUS_OCP") {
    success = modifyByte(0x13, (uint8_t)val, 0b00000001);
  } else if (regName == "EN_BATOC") {
    success = modifyByte(0x14, (uint8_t)val, 0b00000001);
  } else if (regName == "VOC_PCT_2_0") {
    success = modifyByte(0x15, (uint8_t)val << 5, 0b11100000);
  } else if (regName == "VOC_DLY_1_0") {
    success = modifyByte(0x15, (uint8_t)val << 3, 0b00011000);
  } else if (regName == "VOC_RATE_1_0") {
    success = modifyByte(0x15, (uint8_t)val << 1, 0b00000110);
  } else if (regName == "TREG_1_0") {
    success = modifyByte(0x16, (uint8_t)val << 6, 0b11000000);
  } else if (regName == "TSHUT_1_0") {
    success = modifyByte(0x16, (uint8_t)val << 4, 0b00110000);
  } else if (regName == "VBUS_PD_EN") {
    success = modifyByte(0x16, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "VAC1_PD_EN") {
    success = modifyByte(0x16, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "VAC2_PD_EN") {
    success = modifyByte(0x16, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "JEITA_VSET_2_0") {
    success = modifyByte(0x17, (uint8_t)val << 5, 0b11100000);
  } else if (regName == "JEITA_ISETH_1_0") {
    success = modifyByte(0x17, (uint8_t)val << 3, 0b00011000);
  } else if (regName == "JEITA_ISETC_1_0") {
    success = modifyByte(0x17, (uint8_t)val << 1, 0b00000110);
  } else if (regName == "TS_COOL_1_0") {
    success = modifyByte(0x18, (uint8_t)val << 6, 0b11000000);
  } else if (regName == "TS_WARM_1_0") {
    success = modifyByte(0x18, (uint8_t)val << 4, 0b00110000);
  } else if (regName == "BHOT_1_0") {
    success = modifyByte(0x18, (uint8_t)val << 2, 0b00001100);
  } else if (regName == "BCOLD") {
    success = modifyByte(0x18, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "TS_IGNORE") {
    success = modifyByte(0x18, (uint8_t)val, 0b00000001);
  } else if (regName == "ADC_RATE") {
    success = modifyByte(0x2E, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "ADC_AVG") {
    success = modifyByte(0x2E, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "ADC_AVG_INIT") {
    success = modifyByte(0x2E, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "IBUS_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "IBAT_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "VBUS_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "VBAT_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "VSYS_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "TS_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "TDIE_ADC_DIS") {
    success = modifyByte(0x2F, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "DP_ADC_DIS") {
    success = modifyByte(0x30, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "DM_ADC_DIS") {
    success = modifyByte(0x30, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "VAC2_ADC_DIS") {
    success = modifyByte(0x30, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "VAC1_ADC_DIS") {
    success = modifyByte(0x30, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "DPLUS_DAC_2_0") {
    success = modifyByte(0x47, (uint8_t)val << 5, 0b11100000);
  } else if (regName == "DMINUS_DAC_2_0") {
    success = modifyByte(0x47, (uint8_t)val << 2, 0b00011100);
  }
  // ---------------------------------------------------------
  // REG28_Charger_Mask_0 (Address: 0x28)
  // ---------------------------------------------------------
  else if (regName == "IINDPM_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "VINDPM_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "WD_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "POORSRC_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "PG_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "AC2_PRESENT_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "AC1_PRESENT_MASK") {
    success = modifyByte(0x28, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "VBUS_PRESENT_MASK") {
    success = modifyByte(0x28, (uint8_t)val, 0b00000001);
  }
  // ---------------------------------------------------------
  // REG29_Charger_Mask_1 (Address: 0x29)
  // ---------------------------------------------------------
  else if (regName == "CHG_MASK") {
    success = modifyByte(0x29, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "ICO_MASK") {
    success = modifyByte(0x29, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "VBUS_MASK") {
    success = modifyByte(0x29, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "TREG_MASK") {
    success = modifyByte(0x29, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "VBAT_PRESENT_MASK") {
    success = modifyByte(0x29, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "BC1_2_DONE_MASK") {
    success = modifyByte(0x29, (uint8_t)val, 0b00000001);
  }
  // ---------------------------------------------------------
  // REG2A_Charger_Mask_2 (Address: 0x2A)
  // ---------------------------------------------------------
  else if (regName == "DPDM_DONE_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "ADC_DONE_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "VSYS_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "CHG_TMR_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "TRICHG_TMR_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "PRECHG_TMR_MASK") {
    success = modifyByte(0x2A, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "TOPOFF_TMR_MASK") {
    success = modifyByte(0x2A, (uint8_t)val, 0b00000001);
  }
  // ---------------------------------------------------------
  // REG2B_Charger_Mask_3 (Address: 0x2B)
  // ---------------------------------------------------------
  else if (regName == "VBATOTG_LOW_MASK") {
    success = modifyByte(0x2B, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "TS_COLD_MASK") {
    success = modifyByte(0x2B, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "TS_COOL_MASK") {
    success = modifyByte(0x2B, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "TS_WARM_MASK") {
    success = modifyByte(0x2B, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "TS_HOT_MASK") {
    success = modifyByte(0x2B, (uint8_t)val, 0b00000001);
  }
  // ---------------------------------------------------------
  // REG2C_FAULT_Mask_0 (Address: 0x2C)
  // ---------------------------------------------------------
  else if (regName == "IBAT_REG_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "VBUS_OVP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "VBAT_OVP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "IBUS_OCP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "IBAT_OCP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 3, 0b00001000);
  } else if (regName == "CONV_OCP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 2, 0b00000100);
  } else if (regName == "VAC2_OVP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val << 1, 0b00000010);
  } else if (regName == "VAC1_OVP_MASK") {
    success = modifyByte(0x2C, (uint8_t)val, 0b00000001);
  }
  // ---------------------------------------------------------
  // REG2D_FAULT_Mask_1 (Address: 0x2D)
  // ---------------------------------------------------------
  else if (regName == "VSYS_SHORT_MASK") {
    success = modifyByte(0x2D, (uint8_t)val << 7, 0b10000000);
  } else if (regName == "VSYS_OVP_MASK") {
    success = modifyByte(0x2D, (uint8_t)val << 6, 0b01000000);
  } else if (regName == "OTG_OVP_MASK") {
    success = modifyByte(0x2D, (uint8_t)val << 5, 0b00100000);
  } else if (regName == "OTG_UVP_MASK") {
    success = modifyByte(0x2D, (uint8_t)val << 4, 0b00010000);
  } else if (regName == "TSHUT_MASK") {
    success = modifyByte(0x2D, (uint8_t)val << 2, 0b00000100);
  }

  return success;
}

// --- Persistent Settings Functions ---
void saveSetting(const String &regName, long value) {
  File settingsFile = LittleFS.open(SETTINGS_FILE, "r");
  JsonDocument doc;

  if (settingsFile && settingsFile.size() > 0) {
    DeserializationError error = deserializeJson(doc, settingsFile);
    if (error) {
      Serial.println("Failed to parse settings.json, creating new one.");
    }
  }
  settingsFile.close();

  doc[regName] = value;

  settingsFile = LittleFS.open(SETTINGS_FILE, "w");
  if (!settingsFile) {
    Serial.println("Failed to open settings file for writing");
    return;
  }
  if (serializeJson(doc, settingsFile) == 0) {
    Serial.println("Failed to write to settings file");
  }
  settingsFile.close();
  Serial.printf("Saved setting: %s = %ld\n", regName.c_str(), value);
}

void applySavedSettings() {
  File settingsFile = LittleFS.open(SETTINGS_FILE, "r");
  if (!settingsFile || settingsFile.size() == 0) {
    Serial.println("No saved settings file found.");
    settingsFile.close();
    return;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, settingsFile);
  settingsFile.close();

  if (error) {
    Serial.println("Failed to parse settings.json.");
    return;
  }

  Serial.println("Applying saved settings...");
  JsonObject settings = doc.as<JsonObject>();
  for (JsonPair kv : settings) {
    String regName = kv.key().c_str();
    long val = kv.value().as<long>();

    Serial.printf("  - Applying %s = %ld\n", regName.c_str(), val);
    if (!writeBqRegister(regName, val)) {
      Serial.printf("  -> FAILED to apply setting for %s\n", regName.c_str());
    }
  }
  Serial.println("Finished applying settings.");
}

// --- MODIFIED: Interrupt Logic ---
/**
 * @brief Reads the flag registers and constructs a JSON object with event
 * codes.
 * @return A String containing the JSON object, e.g.,
 * {"events":["VBUS_OVP_FAULT"]}.
 */
String getInterruptReason() {
  JsonDocument doc;
  JsonArray events = doc["events"].to<JsonArray>();

  uint8_t flag_buffer[6];
  if (readBytes(0x22, flag_buffer, 6)) {
    if (flag_buffer[0] & 0b10000000)
      events.add("IINDPM_EVENT");
    if (flag_buffer[0] & 0b01000000)
      events.add("VINDPM_EVENT");
    if (flag_buffer[0] & 0b00100000)
      events.add("WD_EXPIRED");
    if (flag_buffer[0] & 0b00010000)
      events.add("POOR_SOURCE");
    if (flag_buffer[0] & 0b00001000)
      events.add("PG_STATUS_CHANGE");
    if (flag_buffer[0] & 0b00000100)
      events.add("AC2_PRESENCE_CHANGE");
    if (flag_buffer[0] & 0b00000010)
      events.add("AC1_PRESENCE_CHANGE");
    if (flag_buffer[0] & 0b00000001)
      events.add("VBUS_PRESENCE_CHANGE");
    if (flag_buffer[1] & 0b10000000)
      events.add("CHARGE_STATUS_CHANGE");
    if (flag_buffer[1] & 0b01000000)
      events.add("ICO_STATUS_CHANGE");
    if (flag_buffer[1] & 0b00010000)
      events.add("VBUS_TYPE_CHANGE");
    if (flag_buffer[1] & 0b00000100)
      events.add("TREG_EVENT");
    if (flag_buffer[1] & 0b00000010)
      events.add("VBAT_PRESENCE_CHANGE");
    if (flag_buffer[1] & 0b00000001)
      events.add("BC12_DONE");
    if (flag_buffer[2] & 0b01000000)
      events.add("DPDM_DONE");
    if (flag_buffer[2] & 0b00100000)
      events.add("ADC_DONE");
    if (flag_buffer[2] & 0b00010000)
      events.add("VSYS_REG_CHANGE");
    if (flag_buffer[2] & 0b00001000)
      events.add("FAST_CHARGE_TIMEOUT");
    if (flag_buffer[2] & 0b00000100)
      events.add("TRICKLE_CHARGE_TIMEOUT");
    if (flag_buffer[2] & 0b00000010)
      events.add("PRECHARGE_TIMEOUT");
    if (flag_buffer[2] & 0b00000001)
      events.add("TOPOFF_TIMEOUT");
    if (flag_buffer[3] & 0b00010000)
      events.add("VBAT_LOW_FOR_OTG");
    if (flag_buffer[3] & 0b00001000)
      events.add("TS_COLD_EVENT");
    if (flag_buffer[3] & 0b00000100)
      events.add("TS_COOL_EVENT");
    if (flag_buffer[3] & 0b00000010)
      events.add("TS_WARM_EVENT");
    if (flag_buffer[3] & 0b00000001)
      events.add("TS_HOT_EVENT");
    if (flag_buffer[4] & 0b10000000)
      events.add("IBAT_REG_EVENT");
    if (flag_buffer[4] & 0b01000000)
      events.add("VBUS_OVP_FAULT");
    if (flag_buffer[4] & 0b00100000)
      events.add("VBAT_OVP_FAULT");
    if (flag_buffer[4] & 0b00010000)
      events.add("IBUS_OCP_FAULT");
    if (flag_buffer[4] & 0b00001000)
      events.add("IBAT_OCP_FAULT");
    if (flag_buffer[4] & 0b00000100)
      events.add("CONV_OCP_FAULT");
    if (flag_buffer[4] & 0b00000010)
      events.add("VAC2_OVP_FAULT");
    if (flag_buffer[4] & 0b00000001)
      events.add("VAC1_OVP_FAULT");
    if (flag_buffer[5] & 0b10000000)
      events.add("VSYS_SHORT_FAULT");
    if (flag_buffer[5] & 0b01000000)
      events.add("VSYS_OVP_FAULT");
    if (flag_buffer[5] & 0b00100000)
      events.add("OTG_OVP_FAULT");
    if (flag_buffer[5] & 0b00010000)
      events.add("OTG_UVP_FAULT");
    if (flag_buffer[5] & 0b00000100)
      events.add("THERMAL_SHUTDOWN");
  } else {
    events.add("FLAG_READ_ERROR");
  }

  if (events.size() == 0) {
    events.add("UNKNOWN_INTERRUPT");
  }

  String output;
  serializeJson(doc, output);
  return output;
}

void IRAM_ATTR handleInterrupt() { interruptFired = true; }

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
             AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("WebSocket client #%lu connected from %s\n", client->id(),
                  client->remoteIP().toString().c_str());
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("WebSocket client #%lu disconnected\n", client->id());
  }
}

// --- API Handlers ---
void handleApiData1(AsyncWebServerRequest *request) {
  JsonDocument doc;
  uint16_t val16;
  uint8_t val8;

  // --- Original Page 1 Data ---
  if (readByte(0x00, val8)) {
    doc["VSYSMIN_5_0"] = 2500 + ((val8 & 0x3F) * 250);
  } else {
    doc["VSYSMIN_5_0"] = -1;
  }
  if (readByte(0x0A, val8)) {
    doc["CELL_1_0"] = ((val8 >> 6) & 0x03) + 1;
  } else {
    doc["CELL_1_0"] = -1;
  }
  if (readWord(0x0B, val16)) {
    doc["VOTG_10_0"] = 2800 + ((val16 & 0x7FF) * 10);
  } else {
    doc["VOTG_10_0"] = -1;
  }
  if (readByte(0x0D, val8)) {
    doc["IOTG_6_0"] = (val8 & 0x7F) * 40;
  } else {
    doc["IOTG_6_0"] = -1;
  }
  if (readByte(0x0F, val8)) {
    doc["EN_CHG"] = (val8 >> 5) & 0x01;
  } else {
    doc["EN_CHG"] = -1;
  }
  if (readByte(0x1C, val8)) {
    doc["CHG_STAT_2_0"] = (val8 >> 5) & 0x07;
    doc["VBUS_STAT_3_0"] = (val8 >> 1) & 0x0F;
  } else {
    doc["CHG_STAT_2_0"] = -1;
    doc["VBUS_STAT_3_0"] = -1;
  }
  if (readByte(0x1D, val8)) {
    doc["VBAT_PRESENT_STAT"] = val8 & 0x01;
  } else {
    doc["VBAT_PRESENT_STAT"] = -1;
  }
  if (readByte(0x1E, val8)) {
    doc["VSYS_STAT"] = (val8 >> 4) & 0x01;
  } else {
    doc["VSYS_STAT"] = -1;
  }
  if (readWord(0x31, val16)) {
    doc["IBUS_ADC_15_0"] = (int16_t)val16;
  } else {
    doc["IBUS_ADC_15_0"] = -1;
  }
  if (readWord(0x33, val16)) {
    doc["IBAT_ADC_15_0"] = (int16_t)val16;
  } else {
    doc["IBAT_ADC_15_0"] = -1;
  }
  if (readWord(0x35, val16)) {
    doc["VBUS_ADC_15_0"] = val16;
  } else {
    doc["VBUS_ADC_15_0"] = -1;
  }
  if (readWord(0x37, val16)) {
    doc["VAC1_ADC_15_0"] = val16;
  } else {
    doc["VAC1_ADC_15_0"] = -1;
  }
  if (readWord(0x39, val16)) {
    doc["VAC2_ADC_15_0"] = val16;
  } else {
    doc["VAC2_ADC_15_0"] = -1;
  }
  if (readWord(0x3B, val16)) {
    doc["VBAT_ADC_15_0"] = val16;
  } else {
    doc["VBAT_ADC_15_0"] = -1;
  }
  if (readWord(0x3D, val16)) {
    doc["VSYS_ADC_15_0"] = val16;
  } else {
    doc["VSYS_ADC_15_0"] = -1;
  }
  if (readWord(0x3F, val16)) {
    doc["TS_ADC_15_0"] = (float)val16 * 0.0976563;
  } else {
    doc["TS_ADC_15_0"] = -1.0;
  }
  if (readWord(0x41, val16)) {
    doc["TDIE_ADC_15_0"] = (float)((int16_t)val16) * 0.5;
  } else {
    doc["TDIE_ADC_15_0"] = -999.0;
  }

  // --- OPTIMIZED: Cause registers for Page 1 coloring (single reads) ---
  if (readByte(0x1B, val8)) {
    doc["VBUS_PRESENT_STAT"] = val8 & 0x01;
    doc["IINDPM_STAT"] = (val8 >> 7) & 0x01;
    doc["VINDPM_STAT"] = (val8 >> 6) & 0x01;
  } else {
    doc["VBUS_PRESENT_STAT"] = -1;
    doc["IINDPM_STAT"] = -1;
    doc["VINDPM_STAT"] = -1;
  }

  if (readByte(0x12, val8)) {
    doc["EN_OTG"] = (val8 >> 6) & 0x01;
  } else {
    doc["EN_OTG"] = -1;
  }
  if (readByte(0x1D, val8)) {
    doc["TREG_STAT"] = (val8 >> 2) & 0x01;
  } else {
    doc["TREG_STAT"] = -1;
  }

  if (readByte(0x1F, val8)) {
    doc["TS_COLD_STAT"] = (val8 >> 3) & 0x01;
    doc["TS_COOL_STAT"] = (val8 >> 2) & 0x01;
    doc["TS_WARM_STAT"] = (val8 >> 1) & 0x01;
    doc["TS_HOT_STAT"] = val8 & 0x01;
  } else {
    doc["TS_COLD_STAT"] = -1;
    doc["TS_COOL_STAT"] = -1;
    doc["TS_WARM_STAT"] = -1;
    doc["TS_HOT_STAT"] = -1;
  }

  if (readByte(0x20, val8)) {
    doc["IBAT_REG_STAT"] = (val8 >> 7) & 0x01;
    doc["VBUS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["VBAT_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["IBUS_OCP_STAT"] = (val8 >> 4) & 0x01;
    doc["IBAT_OCP_STAT"] = (val8 >> 3) & 0x01;
  } else {
    doc["IBAT_REG_STAT"] = -1;
    doc["VBUS_OVP_STAT"] = -1;
    doc["VBAT_OVP_STAT"] = -1;
    doc["IBUS_OCP_STAT"] = -1;
    doc["IBAT_OCP_STAT"] = -1;
  }

  if (readByte(0x21, val8)) {
    doc["VSYS_SHORT_STAT"] = (val8 >> 7) & 0x01;
    doc["VSYS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["OTG_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["OTG_UVP_STAT"] = (val8 >> 4) & 0x01;
    doc["TSHUT_STAT"] = (val8 >> 2) & 0x01;
  } else {
    doc["VSYS_SHORT_STAT"] = -1;
    doc["VSYS_OVP_STAT"] = -1;
    doc["OTG_OVP_STAT"] = -1;
    doc["OTG_UVP_STAT"] = -1;
    doc["TSHUT_STAT"] = -1;
  }

  if (readByte(0x20, val8)) {
    doc["VAC2_OVP_STAT"] = (val8 >> 1) & 0x01;
    doc["VAC1_OVP_STAT"] = val8 & 0x01;
  } else {
    doc["VAC2_OVP_STAT"] = -1;
    doc["VAC1_OVP_STAT"] = -1;
  }
  if (readByte(0x1F, val8)) {
    doc["VBATOTG_LOW_STAT"] = (val8 >> 4) & 0x01;
  } else {
    doc["VBATOTG_LOW_STAT"] = -1;
  }
  if (readByte(0x1B, val8)) {
    doc["PG_STAT"] = (val8 >> 3) & 0x01;
  } else {
    doc["PG_STAT"] = -1;
  }
  if (readByte(0x1E, val8)) {
    doc["CHG_TMR_STAT"] = (val8 >> 3) & 0x01;
    doc["TRICHG_TMR_STAT"] = (val8 >> 2) & 0x01;
    doc["PRECHG_TMR_STAT"] = (val8 >> 1) & 0x01;
  } else {
    doc["CHG_TMR_STAT"] = -1;
    doc["TRICHG_TMR_STAT"] = -1;
    doc["PRECHG_TMR_STAT"] = -1;
  }

  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiData2(AsyncWebServerRequest *request) {
  // This function remains unchanged as per the plan
  JsonDocument doc;
  uint16_t val16;
  uint8_t val8;
  if (readWord(0x01, val16)) {
    doc["VREG_10_0"] = (val16 & 0x7FF) * 10;
  } else {
    doc["VREG_10_0"] = -1;
  }
  if (readWord(0x03, val16)) {
    doc["ICHG_8_0"] = (val16 & 0x1FF) * 10;
  } else {
    doc["ICHG_8_0"] = -1;
  }
  if (readByte(0x05, val8)) {
    doc["VINDPM_7_0"] = val8 * 100;
  } else {
    doc["VINDPM_7_0"] = -1;
  }
  if (readWord(0x06, val16)) {
    doc["IINDPM_8_0"] = (val16 & 0x1FF) * 10;
  } else {
    doc["IINDPM_8_0"] = -1;
  }
  if (readByte(0x0F, val8)) {
    doc["EN_ICO"] = (val8 >> 4) & 0x01;
    doc["FORCE_ICO"] = (val8 >> 3) & 0x01;
    doc["EN_HIZ"] = (val8 >> 2) & 0x01;
  } else {
    doc["EN_ICO"] = -1;
    doc["FORCE_ICO"] = -1;
    doc["EN_HIZ"] = -1;
  }
  if (readByte(0x11, val8)) {
    doc["SDRV_CTRL_1_0"] = (val8 >> 1) & 0x03;
  } else {
    doc["SDRV_CTRL_1_0"] = -1;
  }
  if (readByte(0x12, val8)) {
    doc["DIS_ACDRV"] = (val8 >> 7) & 0x01;
    doc["EN_OTG"] = (val8 >> 6) & 0x01;
  } else {
    doc["DIS_ACDRV"] = -1;
    doc["EN_OTG"] = -1;
  }
  if (readByte(0x13, val8)) {
    doc["EN_ACDRV2"] = (val8 >> 7) & 0x01;
    doc["EN_ACDRV1"] = (val8 >> 6) & 0x01;
    doc["FORCE_VINDPM_DET"] = (val8 >> 1) & 0x01;
  } else {
    doc["EN_ACDRV2"] = -1;
    doc["EN_ACDRV1"] = -1;
    doc["FORCE_VINDPM_DET"] = -1;
  }
  if (readByte(0x14, val8)) {
    doc["SFET_PRESENT"] = (val8 >> 7) & 0x01;
  } else {
    doc["SFET_PRESENT"] = -1;
  }
  if (readByte(0x15, val8)) {
    doc["EN_MPPT"] = val8 & 0x01;
  } else {
    doc["EN_MPPT"] = -1;
  }
  if (readWord(0x19, val16)) {
    doc["ICO_ILIM_8_0"] = (val16 & 0x1FF) * 10;
  } else {
    doc["ICO_ILIM_8_0"] = -1;
  }
  if (readByte(0x1B, val8)) {
    doc["AC2_PRESENT_STAT"] = (val8 >> 2) & 0x01;
    doc["AC1_PRESENT_STAT"] = (val8 >> 1) & 0x01;
  } else {
    doc["AC2_PRESENT_STAT"] = -1;
    doc["AC1_PRESENT_STAT"] = -1;
  }
  if (readByte(0x1E, val8)) {
    doc["ACRB2_STAT"] = (val8 >> 7) & 0x01;
    doc["ACRB1_STAT"] = (val8 >> 6) & 0x01;
  } else {
    doc["ACRB2_STAT"] = -1;
    doc["ACRB1_STAT"] = -1;
  }
  if (readByte(0x1F, val8)) {
    doc["VBATOTG_LOW_STAT"] = (val8 >> 4) & 0x01;
  } else {
    doc["VBATOTG_LOW_STAT"] = -1;
  }
  if (readByte(0x2E, val8)) {
    doc["ADC_EN"] = (val8 >> 7) & 0x01;
  } else {
    doc["ADC_EN"] = -1;
  }
  if (readByte(0x20, val8)) {
    doc["VBUS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["VBAT_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["IBUS_OCP_STAT"] = (val8 >> 4) & 0x01;
    doc["IBAT_OCP_STAT"] = (val8 >> 3) & 0x01;
    doc["CONV_OCP_STAT"] = (val8 >> 2) & 0x01;
  } else {
    doc["VBUS_OVP_STAT"] = -1;
    doc["VBAT_OVP_STAT"] = -1;
    doc["IBUS_OCP_STAT"] = -1;
    doc["IBAT_OCP_STAT"] = -1;
    doc["CONV_OCP_STAT"] = -1;
  }
  if (readByte(0x21, val8)) {
    doc["VSYS_SHORT_STAT"] = (val8 >> 7) & 0x01;
    doc["VSYS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["OTG_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["OTG_UVP_STAT"] = (val8 >> 4) & 0x01;
    doc["TSHUT_STAT"] = (val8 >> 2) & 0x01;
  } else {
    doc["VSYS_SHORT_STAT"] = -1;
    doc["VSYS_OVP_STAT"] = -1;
    doc["OTG_OVP_STAT"] = -1;
    doc["OTG_UVP_STAT"] = -1;
    doc["TSHUT_STAT"] = -1;
  }
  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiData3(AsyncWebServerRequest *request) {
  JsonDocument doc;
  uint8_t val8;

  // --- Original Page 3 Data ---
  if (readByte(0x08, val8)) {
    doc["VBAT_LOWV_1_0"] = (val8 >> 6) & 0x03;
    doc["IPRECHG_5_0"] = (val8 & 0x3F) * 40;
  } else {
    doc["VBAT_LOWV_1_0"] = -1;
    doc["IPRECHG_5_0"] = -1;
  }
  if (readByte(0x09, val8)) {
    doc["ITERM_4_0"] = (val8 & 0x1F) * 40;
  } else {
    doc["ITERM_4_0"] = -1;
  }
  if (readByte(0x0A, val8)) {
    doc["TRECHG_1_0"] = (val8 >> 4) & 0x03;
    doc["VRECHG_3_0"] = 50 + ((val8 & 0x0F) * 50);
  } else {
    doc["TRECHG_1_0"] = -1;
    doc["VRECHG_3_0"] = -1;
  }
  if (readByte(0x10, val8)) {
    doc["VAC_OVP_1_0"] = (val8 >> 4) & 0x03;
  } else {
    doc["VAC_OVP_1_0"] = -1;
  }
  if (readByte(0x14, val8)) {
    doc["EN_IBAT"] = (val8 >> 5) & 0x01;
    doc["IBAT_REG_1_0"] = (val8 >> 3) & 0x03;
    doc["EN_IINDPM"] = (val8 >> 2) & 0x01;
    doc["EN_EXTILIM"] = (val8 >> 1) & 0x01;
  } else {
    doc["EN_IBAT"] = -1;
    doc["IBAT_REG_1_0"] = -1;
    doc["EN_IINDPM"] = -1;
    doc["EN_EXTILIM"] = -1;
  }
  if (readByte(0x1D, val8)) {
    doc["ICO_STAT_1_0"] = (val8 >> 6) & 0x03;
  } else {
    doc["ICO_STAT_1_0"] = -1;
  }
  // if (readByte(0x2E, val8)) { doc["ADC_SAMPLE_1_0"] = (val8 >> 4) & 0x03; }
  // else { doc["ADC_SAMPLE_1_0"] = -1; }

  // --- OPTIMIZED: Cause registers for Page 3 coloring (single read) ---
  if (readByte(0x20, val8)) {
    // doc["IBAT_REG_STAT"] = (val8 >> 7) & 0x01;
    doc["VAC2_OVP_STAT"] = (val8 >> 1) & 0x01;
    doc["VAC1_OVP_STAT"] = val8 & 0x01;
  } else {
    // doc["IBAT_REG_STAT"] = -1;
    doc["VAC2_OVP_STAT"] = -1;
    doc["VAC1_OVP_STAT"] = -1;
  }

  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiData4(AsyncWebServerRequest *request) {
  JsonDocument doc;
  uint8_t val8;

  // --- Original Page 4 Data ---
  if (readByte(0x09, val8)) {
    doc["STOP_WD_CHG"] = (val8 >> 5) & 0x01;
  } else {
    doc["STOP_WD_CHG"] = -1;
  }
  if (readByte(0x0D, val8)) {
    doc["PRECHG_TMR"] = (val8 >> 7) & 0x01;
  } else {
    doc["PRECHG_TMR"] = -1;
  }
  if (readByte(0x0E, val8)) {
    doc["TOPOFF_TMR_1_0"] = (val8 >> 6) & 0x03;
    doc["EN_TRICHG_TMR"] = (val8 >> 5) & 0x01;
    doc["EN_PRECHG_TMR"] = (val8 >> 4) & 0x01;
    doc["EN_CHG_TMR"] = (val8 >> 3) & 0x01;
    doc["CHG_TMR_1_0"] = (val8 >> 1) & 0x03;
    doc["TMR2X_EN"] = val8 & 0x01;
  } else {
    doc["TOPOFF_TMR_1_0"] = -1;
    doc["EN_TRICHG_TMR"] = -1;
    doc["EN_PRECHG_TMR"] = -1;
    doc["EN_CHG_TMR"] = -1;
    doc["CHG_TMR_1_0"] = -1;
    doc["TMR2X_EN"] = -1;
  }
  if (readByte(0x0F, val8)) {
    doc["EN_AUTO_IBATDIS"] = (val8 >> 7) & 0x01;
    doc["FORCE_IBATDIS"] = (val8 >> 6) & 0x01;
    doc["EN_TERM"] = (val8 >> 1) & 0x01;
  } else {
    doc["EN_AUTO_IBATDIS"] = -1;
    doc["FORCE_IBATDIS"] = -1;
    doc["EN_TERM"] = -1;
  }
  if (readByte(0x10, val8)) {
    doc["WATCHDOG_2_0"] = val8 & 0x07;
  } else {
    doc["WATCHDOG_2_0"] = -1;
  }
  if (readByte(0x11, val8)) {
    doc["FORCE_INDET"] = (val8 >> 7) & 0x01;
    doc["AUTO_INDET_EN"] = (val8 >> 6) & 0x01;
    doc["EN_12V"] = (val8 >> 5) & 0x01;
    doc["EN_9V"] = (val8 >> 4) & 0x01;
    doc["HVDCP_EN"] = (val8 >> 3) & 0x01;
    doc["SDRV_DLY"] = val8 & 0x01;
  } else {
    doc["FORCE_INDET"] = -1;
    doc["AUTO_INDET_EN"] = -1;
    doc["EN_12V"] = -1;
    doc["EN_9V"] = -1;
    doc["HVDCP_EN"] = -1;
    doc["SDRV_DLY"] = -1;
  }
  if (readByte(0x12, val8)) {
    doc["PFM_OTG_DIS"] = (val8 >> 5) & 0x01;
    doc["PFM_FWD_DIS"] = (val8 >> 4) & 0x01;
    doc["WKUP_DLY"] = (val8 >> 3) & 0x01;
    doc["DIS_LDO"] = (val8 >> 2) & 0x01;
    doc["DIS_OTG_OOA"] = (val8 >> 1) & 0x01;
    doc["DIS_FWD_OOA"] = val8 & 0x01;
  } else {
    doc["PFM_OTG_DIS"] = -1;
    doc["PFM_FWD_DIS"] = -1;
    doc["WKUP_DLY"] = -1;
    doc["DIS_LDO"] = -1;
    doc["DIS_OTG_OOA"] = -1;
    doc["DIS_FWD_OOA"] = -1;
  }
  if (readByte(0x13, val8)) {
    doc["PWM_FREQ"] = (val8 >> 5) & 0x01;
    doc["DIS_STAT"] = (val8 >> 4) & 0x01;
    doc["DIS_VSYS_SHORT"] = (val8 >> 3) & 0x01;
    doc["DIS_VOTG_UVP"] = (val8 >> 2) & 0x01;
    doc["EN_IBUS_OCP"] = val8 & 0x01;
  } else {
    doc["PWM_FREQ"] = -1;
    doc["DIS_STAT"] = -1;
    doc["DIS_VSYS_SHORT"] = -1;
    doc["DIS_VOTG_UVP"] = -1;
    doc["EN_IBUS_OCP"] = -1;
  }
  if (readByte(0x14, val8)) {
    doc["EN_BATOC"] = val8 & 0x01;
  } else {
    doc["EN_BATOC"] = -1;
  }
  if (readByte(0x15, val8)) {
    doc["VOC_PCT_2_0"] = (val8 >> 5) & 0x07;
    doc["VOC_DLY_1_0"] = (val8 >> 3) & 0x03;
    doc["VOC_RATE_1_0"] = (val8 >> 1) & 0x03;
  } else {
    doc["VOC_PCT_2_0"] = -1;
    doc["VOC_DLY_1_0"] = -1;
    doc["VOC_RATE_1_0"] = -1;
  }
  if (readByte(0x16, val8)) {
    doc["TREG_1_0"] = (val8 >> 6) & 0x03;
    doc["TSHUT_1_0"] = (val8 >> 4) & 0x03;
    doc["VBUS_PD_EN"] = (val8 >> 3) & 0x01;
    doc["VAC1_PD_EN"] = (val8 >> 2) & 0x01;
    doc["VAC2_PD_EN"] = (val8 >> 1) & 0x01;
  } else {
    doc["TREG_1_0"] = -1;
    doc["TSHUT_1_0"] = -1;
    doc["VBUS_PD_EN"] = -1;
    doc["VAC1_PD_EN"] = -1;
    doc["VAC2_PD_EN"] = -1;
  }
  if (readByte(0x17, val8)) {
    doc["JEITA_VSET_2_0"] = (val8 >> 5) & 0x07;
    doc["JEITA_ISETH_1_0"] = (val8 >> 3) & 0x03;
    doc["JEITA_ISETC_1_0"] = (val8 >> 1) & 0x03;
  } else {
    doc["JEITA_VSET_2_0"] = -1;
    doc["JEITA_ISETH_1_0"] = -1;
    doc["JEITA_ISETC_1_0"] = -1;
  }
  if (readByte(0x18, val8)) {
    doc["TS_COOL_1_0"] = (val8 >> 6) & 0x03;
    doc["TS_WARM_1_0"] = (val8 >> 4) & 0x03;
    doc["BHOT_1_0"] = (val8 >> 2) & 0x03;
    doc["BCOLD"] = (val8 >> 1) & 0x01;
    doc["TS_IGNORE"] = val8 & 0x01;
  } else {
    doc["TS_COOL_1_0"] = -1;
    doc["TS_WARM_1_0"] = -1;
    doc["BHOT_1_0"] = -1;
    doc["BCOLD"] = -1;
    doc["TS_IGNORE"] = -1;
  }
  if (readByte(0x2E, val8)) {
    doc["ADC_RATE"] = (val8 >> 6) & 0x01;
    doc["ADC_SAMPLE_1_0"] = (val8 >> 4) & 0x03;
    doc["ADC_AVG"] = (val8 >> 3) & 0x01;
    doc["ADC_AVG_INIT"] = (val8 >> 2) & 0x01;
  } else {
    doc["ADC_RATE"] = -1;
    doc["ADC_SAMPLE_1_0"] = -1;
    doc["ADC_AVG"] = -1;
    doc["ADC_AVG_INIT"] = -1;
  }
  if (readByte(0x2F, val8)) {
    doc["IBUS_ADC_DIS"] = (val8 >> 7) & 0x01;
    doc["IBAT_ADC_DIS"] = (val8 >> 6) & 0x01;
    doc["VBUS_ADC_DIS"] = (val8 >> 5) & 0x01;
    doc["VBAT_ADC_DIS"] = (val8 >> 4) & 0x01;
    doc["VSYS_ADC_DIS"] = (val8 >> 3) & 0x01;
    doc["TS_ADC_DIS"] = (val8 >> 2) & 0x01;
    doc["TDIE_ADC_DIS"] = (val8 >> 1) & 0x01;
  } else {
    doc["IBUS_ADC_DIS"] = -1;
    doc["IBAT_ADC_DIS"] = -1;
    doc["VBUS_ADC_DIS"] = -1;
    doc["VBAT_ADC_DIS"] = -1;
    doc["VSYS_ADC_DIS"] = -1;
    doc["TS_ADC_DIS"] = -1;
    doc["TDIE_ADC_DIS"] = -1;
  }
  if (readByte(0x30, val8)) {
    doc["DP_ADC_DIS"] = (val8 >> 7) & 0x01;
    doc["DM_ADC_DIS"] = (val8 >> 6) & 0x01;
    doc["VAC2_ADC_DIS"] = (val8 >> 5) & 0x01;
    doc["VAC1_ADC_DIS"] = (val8 >> 4) & 0x01;
  } else {
    doc["DP_ADC_DIS"] = -1;
    doc["DM_ADC_DIS"] = -1;
    doc["VAC2_ADC_DIS"] = -1;
    doc["VAC1_ADC_DIS"] = -1;
  }
  if (readByte(0x47, val8)) {
    doc["DPLUS_DAC_2_0"] = (val8 >> 5) & 0x07;
    doc["DMINUS_DAC_2_0"] = (val8 >> 2) & 0x07;
  } else {
    doc["DPLUS_DAC_2_0"] = -1;
    doc["DMINUS_DAC_2_0"] = -1;
  }
  if (readByte(0x48, val8)) {
    doc["PN_2_0"] = (val8 >> 3) & 0x07;
    doc["DEV_REV_2_0"] = val8 & 0x07;
  } else {
    doc["PN_2_0"] = -1;
    doc["DEV_REV_2_0"] = -1;
  }

  // // --- ADDED: Cause registers for Page 4 coloring ---
  // if (readByte(0x1B, val8)) {
  //     doc["PG_STAT"] = (val8 >> 3) & 0x01;
  // } else { doc["PG_STAT"] = -1; }

  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiData5(AsyncWebServerRequest *request) {
  // This function remains unchanged as per the plan
  JsonDocument doc;
  uint8_t val8;
  uint16_t val16;
  if (readByte(0x1B, val8)) {
    doc["IINDPM_STAT"] = (val8 >> 7) & 0x01;
    doc["VINDPM_STAT"] = (val8 >> 6) & 0x01;
    doc["WD_STAT"] = (val8 >> 5) & 0x01;
    doc["PG_STAT"] = (val8 >> 3) & 0x01;
  } else {
    doc["IINDPM_STAT"] = -1;
    doc["VINDPM_STAT"] = -1;
    doc["WD_STAT"] = -1;
    doc["PG_STAT"] = -1;
  }
  if (readByte(0x1C, val8)) {
    doc["BC1_2_DONE_STAT"] = val8 & 0x01;
  } else {
    doc["BC1_2_DONE_STAT"] = -1;
  }
  if (readByte(0x1D, val8)) {
    doc["TREG_STAT"] = (val8 >> 2) & 0x01;
    doc["DPDM_STAT"] = (val8 >> 1) & 0x01;
  } else {
    doc["TREG_STAT"] = -1;
    doc["DPDM_STAT"] = -1;
  }
  if (readByte(0x1E, val8)) {
    doc["ADC_DONE_STAT"] = (val8 >> 5) & 0x01;
    doc["CHG_TMR_STAT"] = (val8 >> 3) & 0x01;
    doc["TRICHG_TMR_STAT"] = (val8 >> 2) & 0x01;
    doc["PRECHG_TMR_STAT"] = (val8 >> 1) & 0x01;
  } else {
    doc["ADC_DONE_STAT"] = -1;
    doc["CHG_TMR_STAT"] = -1;
    doc["TRICHG_TMR_STAT"] = -1;
    doc["PRECHG_TMR_STAT"] = -1;
  }
  if (readByte(0x1F, val8)) {
    doc["TS_COLD_STAT"] = (val8 >> 3) & 0x01;
    doc["TS_COOL_STAT"] = (val8 >> 2) & 0x01;
    doc["TS_WARM_STAT"] = (val8 >> 1) & 0x01;
    doc["TS_HOT_STAT"] = val8 & 0x01;
  } else {
    doc["TS_COLD_STAT"] = -1;
    doc["TS_COOL_STAT"] = -1;
    doc["TS_WARM_STAT"] = -1;
    doc["TS_HOT_STAT"] = -1;
  }
  if (readByte(0x20, val8)) {
    doc["IBAT_REG_STAT"] = (val8 >> 7) & 0x01;
  } else {
    doc["IBAT_REG_STAT"] = -1;
  }
  if (readWord(0x43, val16)) {
    doc["D_PLUS_ADC_15_0"] = val16;
  } else {
    doc["D_PLUS_ADC_15_0"] = -1;
  }
  if (readWord(0x45, val16)) {
    doc["D_MINUS_ADC_15_0"] = val16;
  } else {
    doc["D_MINUS_ADC_15_0"] = -1;
  }
  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiData6(AsyncWebServerRequest *request) {
  JsonDocument doc;
  uint8_t val8;

  // --- REG28_Charger_Mask_0 (0x28) [cite: 1121] ---
  if (readByte(0x28, val8)) {
    doc["IINDPM_MASK"] = (val8 >> 7) & 0x01;
    doc["VINDPM_MASK"] = (val8 >> 6) & 0x01;
    doc["WD_MASK"] = (val8 >> 5) & 0x01;
    doc["POORSRC_MASK"] = (val8 >> 4) & 0x01;
    doc["PG_MASK"] = (val8 >> 3) & 0x01;
    doc["AC2_PRESENT_MASK"] = (val8 >> 2) & 0x01;
    doc["AC1_PRESENT_MASK"] = (val8 >> 1) & 0x01;
    doc["VBUS_PRESENT_MASK"] = val8 & 0x01;
  } else {
    doc["IINDPM_MASK"] = -1;
    doc["VINDPM_MASK"] = -1;
    doc["WD_MASK"] = -1;
    doc["POORSRC_MASK"] = -1;
    doc["PG_MASK"] = -1;
    doc["AC2_PRESENT_MASK"] = -1;
    doc["AC1_PRESENT_MASK"] = -1;
    doc["VBUS_PRESENT_MASK"] = -1;
  }

  // --- REG29_Charger_Mask_1 (0x29) [cite: 1144] ---
  if (readByte(0x29, val8)) {
    doc["CHG_MASK"] = (val8 >> 7) & 0x01;
    doc["ICO_MASK"] = (val8 >> 6) & 0x01;
    doc["VBUS_MASK"] = (val8 >> 4) & 0x01; // Bit 5 is Reserved
    doc["TREG_MASK"] = (val8 >> 2) & 0x01;
    doc["VBAT_PRESENT_MASK"] = (val8 >> 1) & 0x01;
    doc["BC1_2_DONE_MASK"] = val8 & 0x01;
  } else {
    doc["CHG_MASK"] = -1;
    doc["ICO_MASK"] = -1;
    doc["VBUS_MASK"] = -1;
    doc["TREG_MASK"] = -1;
    doc["VBAT_PRESENT_MASK"] = -1;
    doc["BC1_2_DONE_MASK"] = -1;
  }

  // --- REG2A_Charger_Mask_2 (0x2A) [cite: 1159] ---
  if (readByte(0x2A, val8)) {
    doc["DPDM_DONE_MASK"] = (val8 >> 6) & 0x01;
    doc["ADC_DONE_MASK"] = (val8 >> 5) & 0x01;
    doc["VSYS_MASK"] = (val8 >> 4) & 0x01;
    doc["CHG_TMR_MASK"] = (val8 >> 3) & 0x01;
    doc["TRICHG_TMR_MASK"] = (val8 >> 2) & 0x01;
    doc["PRECHG_TMR_MASK"] = (val8 >> 1) & 0x01;
    doc["TOPOFF_TMR_MASK"] = val8 & 0x01;
  } else {
    doc["DPDM_DONE_MASK"] = -1;
    doc["ADC_DONE_MASK"] = -1;
    doc["VSYS_MASK"] = -1;
    doc["CHG_TMR_MASK"] = -1;
    doc["TRICHG_TMR_MASK"] = -1;
    doc["PRECHG_TMR_MASK"] = -1;
    doc["TOPOFF_TMR_MASK"] = -1;
  }

  // --- REG2B_Charger_Mask_3 (0x2B) [cite: 1171] ---
  if (readByte(0x2B, val8)) {
    doc["VBATOTG_LOW_MASK"] = (val8 >> 4) & 0x01;
    doc["TS_COLD_MASK"] = (val8 >> 3) & 0x01;
    doc["TS_COOL_MASK"] = (val8 >> 2) & 0x01;
    doc["TS_WARM_MASK"] = (val8 >> 1) & 0x01;
    doc["TS_HOT_MASK"] = val8 & 0x01;
  } else {
    doc["VBATOTG_LOW_MASK"] = -1;
    doc["TS_COLD_MASK"] = -1;
    doc["TS_COOL_MASK"] = -1;
    doc["TS_WARM_MASK"] = -1;
    doc["TS_HOT_MASK"] = -1;
  }

  // --- REG2C_FAULT_Mask_0 (0x2C) [cite: 1187] ---
  if (readByte(0x2C, val8)) {
    doc["IBAT_REG_MASK"] = (val8 >> 7) & 0x01;
    doc["VBUS_OVP_MASK"] = (val8 >> 6) & 0x01;
    doc["VBAT_OVP_MASK"] = (val8 >> 5) & 0x01;
    doc["IBUS_OCP_MASK"] = (val8 >> 4) & 0x01;
    doc["IBAT_OCP_MASK"] = (val8 >> 3) & 0x01;
    doc["CONV_OCP_MASK"] = (val8 >> 2) & 0x01;
    doc["VAC2_OVP_MASK"] = (val8 >> 1) & 0x01;
    doc["VAC1_OVP_MASK"] = val8 & 0x01;
  } else {
    doc["IBAT_REG_MASK"] = -1;
    doc["VBUS_OVP_MASK"] = -1;
    doc["VBAT_OVP_MASK"] = -1;
    doc["IBUS_OCP_MASK"] = -1;
    doc["IBAT_OCP_MASK"] = -1;
    doc["CONV_OCP_MASK"] = -1;
    doc["VAC2_OVP_MASK"] = -1;
    doc["VAC1_OVP_MASK"] = -1;
  }

  // --- REG2D_FAULT_Mask_1 (0x2D) [cite: 1200] ---
  if (readByte(0x2D, val8)) {
    doc["VSYS_SHORT_MASK"] = (val8 >> 7) & 0x01;
    doc["VSYS_OVP_MASK"] = (val8 >> 6) & 0x01;
    doc["OTG_OVP_MASK"] = (val8 >> 5) & 0x01;
    doc["OTG_UVP_MASK"] = (val8 >> 4) & 0x01;
    doc["TSHUT_MASK"] = (val8 >> 2) & 0x01;
  } else {
    doc["VSYS_SHORT_MASK"] = -1;
    doc["VSYS_OVP_MASK"] = -1;
    doc["OTG_OVP_MASK"] = -1;
    doc["OTG_UVP_MASK"] = -1;
    doc["TSHUT_MASK"] = -1;
  }

  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiIndex(AsyncWebServerRequest *request) {
  // افزایش سایز بافر برای اطمینان (حدود 55 کلید)
  JsonDocument doc;
  uint8_t val8;
  uint16_t val16;

  // --- REG09: Termination Control [cite: 100] ---
  if (readByte(0x09, val8)) {
    doc["STOP_WD_CHG"] = (val8 >> 5) & 0x01;
  } else {
    doc["STOP_WD_CHG"] = -1;
  }

  // --- REG0F: Charger Control 0 [cite: 239] ---
  if (readByte(0x0F, val8)) {
    doc["EN_CHG"] = (val8 >> 5) & 0x01;
    doc["EN_HIZ"] = (val8 >> 2) & 0x01;
  } else {
    doc["EN_CHG"] = -1;
    doc["EN_HIZ"] = -1;
  }

  // --- REG11: Charger Control 2 ---
  if (readByte(0x11, val8)) {
    doc["SDRV_CTRL"] = (val8 >> 1) & 0x03;
  } else {
    doc["SDRV_CTRL"] = -1;
  }

  // --- REG12: Charger Control 3 ---
  if (readByte(0x12, val8)) {
    doc["EN_OTG"] = (val8 >> 6) & 0x01;
  } else {
    doc["EN_OTG"] = -1;
  }

  // --- REG13: Charger Control 4 ---
  if (readByte(0x13, val8)) {
    doc["EN_ACDRV2"] = (val8 >> 7) & 0x01;
    doc["EN_ACDRV1"] = (val8 >> 6) & 0x01;
  } else {
    doc["EN_ACDRV2"] = -1;
    doc["EN_ACDRV1"] = -1;
  }

  // --- REG14: Charger Control 5 ---
  if (readByte(0x14, val8)) {
    doc["SFET_PRESENT"] = (val8 >> 7) & 0x01;
    doc["EN_BATOCP"] = val8 & 0x01;
  } else {
    doc["SFET_PRESENT"] = -1;
    doc["EN_BATOCP"] = -1;
  }

  // --- REG17: NTC Control 0 ---
  if (readByte(0x17, val8)) {
    doc["JEITA_VSET_2"] = (val8 >> 5) & 0x07;
    doc["JEITA_ISETH_1"] = (val8 >> 3) & 0x03;
    doc["JEITA_ISETC_1"] = (val8 >> 1) & 0x03;
  } else {
    doc["JEITA_VSET_2"] = -1;
    doc["JEITA_ISETH_1"] = -1;
    doc["JEITA_ISETC_1"] = -1;
  }

  // --- REG1B: Charger Status 0 ---
  if (readByte(0x1B, val8)) {
    doc["IINDPM_STAT"] = (val8 >> 7) & 0x01;
    doc["VINDPM_STAT"] = (val8 >> 6) & 0x01;
    doc["WD_STAT"] = (val8 >> 5) & 0x01;
    doc["PG_STAT"] = (val8 >> 3) & 0x01;
    doc["AC2_PRESENT_STAT"] = (val8 >> 2) & 0x01;
    doc["AC1_PRESENT_STAT"] = (val8 >> 1) & 0x01;
    doc["VBUS_PRESENT_STAT"] = val8 & 0x01;
  } else {
    doc["IINDPM_STAT"] = -1;
    doc["VINDPM_STAT"] = -1;
    doc["WD_STAT"] = -1;
    doc["PG_STAT"] = -1;
    doc["AC2_PRESENT_STAT"] = -1;
    doc["AC1_PRESENT_STAT"] = -1;
    doc["VBUS_PRESENT_STAT"] = -1;
  }

  // --- REG1C: Charger Status 1 ---
  if (readByte(0x1C, val8)) {
    doc["CHG_STAT_2_0"] = (val8 >> 5) & 0x07;
    doc["VBUS_STAT_3_0"] = (val8 >> 1) & 0x0F;
  } else {
    doc["CHG_STAT_2_0"] = -1;
    doc["VBUS_STAT_3_0"] = -1;
  }

  // --- REG1D: Charger Status 2 ---
  if (readByte(0x1D, val8)) {
    doc["TREG_STAT"] = (val8 >> 2) & 0x01;
    doc["VBAT_PRESENT_STAT"] = val8 & 0x01;
  } else {
    doc["TREG_STAT"] = -1;
    doc["VBAT_PRESENT_STAT"] = -1;
  }

  // --- REG1E: Charger Status 3 ---
  if (readByte(0x1E, val8)) {
    doc["ACRB2_STAT"] = (val8 >> 7) & 0x01;
    doc["ACRB1_STAT"] = (val8 >> 6) & 0x01;
    doc["VSYS_STAT"] = (val8 >> 4) & 0x01; // ADDED: Required for status-sys
    doc["CHG_TMR_STAT"] = (val8 >> 3) & 0x01;
    doc["TRICHG_TMR_STAT"] = (val8 >> 2) & 0x01;
    doc["PRECHG_TMR_STAT"] = (val8 >> 1) & 0x01;
  } else {
    doc["ACRB2_STAT"] = -1;
    doc["ACRB1_STAT"] = -1;
    doc["VSYS_STAT"] = -1;
    doc["CHG_TMR_STAT"] = -1;
    doc["TRICHG_TMR_STAT"] = -1;
    doc["PRECHG_TMR_STAT"] = -1;
  }

  // --- REG1F: Charger Status 4 ---
  if (readByte(0x1F, val8)) {
    doc["VBATOTG_LOW_STAT"] = (val8 >> 4) & 0x01;
    doc["TS_COLD_STAT"] = (val8 >> 3) & 0x01;
    doc["TS_COOL_STAT"] = (val8 >> 2) & 0x01;
    doc["TS_WARM_STAT"] = (val8 >> 1) & 0x01;
    doc["TS_HOT_STAT"] = val8 & 0x01;
  } else {
    doc["VBATOTG_LOW_STAT"] = -1;
    doc["TS_COLD_STAT"] = -1;
    doc["TS_COOL_STAT"] = -1;
    doc["TS_WARM_STAT"] = -1;
    doc["TS_HOT_STAT"] = -1;
  }

  // --- REG20: FAULT Status 0 ---
  if (readByte(0x20, val8)) {
    doc["IBAT_REG_STAT"] = (val8 >> 7) & 0x01;
    doc["VBUS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["VBAT_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["IBUS_OCP_STAT"] = (val8 >> 4) & 0x01;
    doc["IBAT_OCP_STAT"] = (val8 >> 3) & 0x01;

    // ADDED: Composite VAC_OVP_STAT for JS logic
    uint8_t vac2 = (val8 >> 1) & 0x01;
    uint8_t vac1 = val8 & 0x01;
    doc["VAC2_OVP_STAT"] = vac2;
    doc["VAC1_OVP_STAT"] = vac1;
    doc["VAC_OVP_STAT"] = (vac1 | vac2);
  } else {
    doc["IBAT_REG_STAT"] = -1;
    doc["VBUS_OVP_STAT"] = -1;
    doc["VBAT_OVP_STAT"] = -1;
    doc["IBUS_OCP_STAT"] = -1;
    doc["IBAT_OCP_STAT"] = -1;
    doc["VAC2_OVP_STAT"] = -1;
    doc["VAC1_OVP_STAT"] = -1;
    doc["VAC_OVP_STAT"] = -1;
  }

  // --- REG21: FAULT Status 1 ---
  if (readByte(0x21, val8)) {
    doc["VSYS_SHORT_STAT"] = (val8 >> 7) & 0x01;
    doc["VSYS_OVP_STAT"] = (val8 >> 6) & 0x01;
    doc["OTG_OVP_STAT"] = (val8 >> 5) & 0x01;
    doc["OTG_UVP_STAT"] = (val8 >> 4) & 0x01;
    doc["TSHUT_STAT"] = (val8 >> 2) & 0x01;
  } else {
    doc["VSYS_SHORT_STAT"] = -1;
    doc["VSYS_OVP_STAT"] = -1;
    doc["OTG_OVP_STAT"] = -1;
    doc["OTG_UVP_STAT"] = -1;
    doc["TSHUT_STAT"] = -1;
  }

  // --- ADC Readings (ADDED & Existing) ---

  // REG31: IBUS ADC (ADDED)
  if (readWord(0x31, val16)) {
    doc["IBUS_ADC_15_0"] = (int16_t)val16;
  } else {
    doc["IBUS_ADC_15_0"] = -1;
  }

  // REG33: IBAT ADC (ADDED)
  if (readWord(0x33, val16)) {
    doc["IBAT_ADC_15_0"] = (int16_t)val16;
  } else {
    doc["IBAT_ADC_15_0"] = -1;
  }

  // REG35: VBUS ADC (ADDED)
  if (readWord(0x35, val16)) {
    doc["VBUS_ADC_15_0"] = val16;
  } else {
    doc["VBUS_ADC_15_0"] = -1;
  }

  // REG3B: VBAT ADC (Existing)
  if (readWord(0x3B, val16)) {
    doc["VBAT_ADC_15_0"] = val16;
  } else {
    doc["VBAT_ADC_15_0"] = -1;
  }

  // REG3D: VSYS ADC (Existing)
  if (readWord(0x3D, val16)) {
    doc["VSYS_ADC_15_0"] = val16;
  } else {
    doc["VSYS_ADC_15_0"] = -1;
  }

  // REG41: TDIE ADC (ADDED) - Requires 0.5 scaling
  if (readWord(0x41, val16)) {
    doc["TDIE_ADC_15_0"] = (float)((int16_t)val16) * 0.5;
  } else {
    doc["TDIE_ADC_15_0"] = -999;
  }

  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

void handleApiGlobalStatus(AsyncWebServerRequest *request) {
  JsonDocument doc;
  uint8_t val8;
  if (readByte(0x14, val8)) {
    doc["SFET_PRESENT"] = (val8 >> 7) & 0x01;
  } else {
    doc["SFET_PRESENT"] = -1;
  }
  if (readByte(0x2E, val8)) {
    doc["ADC_EN"] = (val8 >> 7) & 0x01;
  } else {
    doc["ADC_EN"] = -1;
  }
  if (readByte(0x1E, val8)) {
    doc["VSYS_STAT"] = (val8 >> 4) & 0x01;
  } else {
    doc["VSYS_STAT"] = -1;
  }
  if (readByte(0x0F, val8)) {
    doc["EN_ICO"] = (val8 >> 4) & 0x01;
  } else {
    doc["EN_ICO"] = -1;
  }
  if (readByte(0x11, val8)) {
    doc["HVDCP_EN"] = (val8 >> 3) & 0x01;
  } else {
    doc["HVDCP_EN"] = -1;
  }
  if (readByte(0x18, val8)) {
    doc["TS_IGNORE"] = val8 & 0x01;
  } else {
    doc["TS_IGNORE"] = -1;
  }
  String output;
  serializeJson(doc, output);
  request->send(200, "application/json", output);
}

// --- History API Handlers ---
void handleGetHistory(AsyncWebServerRequest *request) {
  File file = LittleFS.open(HISTORY_FILE, "r");
  if (!file) {
    request->send(200, "application/json", "[]");
    return;
  }
  String content = file.readString();
  file.close();
  request->send(200, "application/json", content);
}

void handleGetUnseenCount(AsyncWebServerRequest *request) {
  File file = LittleFS.open(HISTORY_FILE, "r");
  int unseenCount = 0;
  if (file && file.size() > 0) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    if (!error) {
      JsonArray history = doc.as<JsonArray>();
      for (JsonObject entry : history) {
        if (entry["seen"] == false) {
          unseenCount++;
        }
      }
    }
  }
  file.close();

  JsonDocument responseDoc;
  responseDoc["unseen_count"] = unseenCount;
  String output;
  serializeJson(responseDoc, output);
  request->send(200, "application/json", output);
}

void handleMarkHistorySeen(AsyncWebServerRequest *request) {
  File file = LittleFS.open(HISTORY_FILE, "r");
  if (!file || file.size() == 0) {
    file.close();
    request->send(200, "text/plain", "No history to mark.");
    return;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    request->send(500, "text/plain", "Failed to parse history file.");
    return;
  }

  JsonArray history = doc.as<JsonArray>();
  bool changed = false;
  for (JsonObject entry : history) {
    if (entry["seen"] == false) {
      entry["seen"] = true;
      changed = true;
    }
  }

  if (changed) {
    file = LittleFS.open(HISTORY_FILE, "w");
    if (serializeJson(doc, file) == 0) {
      request->send(500, "text/plain", "Failed to write updated history.");
    } else {
      request->send(200, "text/plain", "OK");
    }
    file.close();
  } else {
    request->send(200, "text/plain", "No unseen items to mark.");
  }
}

// --- REFACTORED: API Write Handler ---
void handleApiWrite(AsyncWebServerRequest *request) {
  if (request->hasParam("reg", true) && request->hasParam("val", true)) {
    String regName = request->getParam("reg", true)->value();
    String valStr = request->getParam("val", true)->value();
    long val = valStr.toInt();

    if (val == 0 && valStr != "0") {
      request->send(400, "text/plain",
                    "مقدار ورودی باید یک عدد صحیح معتبر باشد.");
      return;
    }

    if (!isValueValid(regName, val)) {
      request->send(400, "text/plain",
                    "مقدار ارسال شده خارج از محدوده مجاز برای این رجیستر است.");
      return;
    }

    Serial.printf("Write request for %s with value %ld (Validated)\n",
                  regName.c_str(), val);

    bool success = writeBqRegister(regName, val);

    if (success) {
      if (regName != "REG_RST" && regName != "FORCE_ICO" &&
          regName != "FORCE_VINDPM_DET" && regName != "FORCE_IBATDIS") {
        saveSetting(regName, val);
      }
      request->send(200, "text/plain", "OK");
    } else {
      request->send(500, "text/plain",
                    "Failed to write to register or unknown register name.");
    }
  } else {
    request->send(400, "text/plain", "Missing parameters.");
  }
}

void checkBatteryRemovalCondition(const String &reasonJson) {
  // Only track if charge status is changing (toggling between Charging, Taper,
  // Termination, etc.)
  if (reasonJson.indexOf("CHARGE_STATUS_CHANGE") == -1) {
    return;
  }

  interruptTimestamps[interruptHead] = millis();
  interruptHead = (interruptHead + 1) % INT_BUFFER_SIZE;
  if (interruptHead == 0)
    bufferFilled = true;

  if (bufferFilled) {
    unsigned long newest =
        interruptTimestamps[(interruptHead + INT_BUFFER_SIZE - 1) %
                            INT_BUFFER_SIZE];
    unsigned long oldest = interruptTimestamps[interruptHead];

    // If 10 events happened in less than 1 second (Rapid Toggling)
    if (newest - oldest < 4000) {
      Serial.println("!!! BATTERY REMOVAL / MISSING DETECTED !!!");
      Serial.printf("Events frequency: %d events in %lu ms\n", INT_BUFFER_SIZE,
                    newest - oldest);

      // Disable Charging
      if (writeBqRegister("EN_CHG", 0)) {
        Serial.println("-> PROTECTION ACTIVATED: Charging Disabled (EN_CHG=0)");

        // Alert WebSocket Clients
        String alertJson =
            "{\"alert\": \"BATTERY_REMOVED_PROTECTION\", \"message\": \"Rapid "
            "charge status toggling detected! Charging disabled.\"}";
        ws.textAll(alertJson);

        // Log to history
        logInterrupt(
            "AUTO_PROTECTION: Charging Disabled due to rapid toggling");
      } else {
        Serial.println("-> PROTECTION FAILED: Could not write to register!");
      }

      // Reset buffer to prevent spamming
      bufferFilled = false;
      for (int i = 0; i < INT_BUFFER_SIZE; i++)
        interruptTimestamps[i] = 0; // Clear buffer
    }
  }
}

// ===================================================================================
// Core Dump Test Functions - Trigger crashes for testing
// ===================================================================================
void triggerNullPointerCrash() {
  Serial.println("Triggering NULL pointer crash in 2 seconds...");
  delay(2000);
  int *ptr = nullptr;
  *ptr = 42; // This will crash!
}

void triggerDivideByZero() {
  Serial.println("Triggering divide by zero in 2 seconds...");
  delay(2000);
  volatile int x = 0;
  volatile int y = 10 / x; // This will crash!
  (void)y;
}

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Winfinite-recursion"
void triggerStackOverflow() {
  Serial.println("Triggering stack overflow...");
  volatile char buffer[1024];
  buffer[0] = 'A';
  triggerStackOverflow(); // Recursive call until stack overflow
}
#pragma GCC diagnostic pop

void triggerAssertFailure() {
  Serial.println("Triggering assert failure in 2 seconds...");
  delay(2000);
  assert(0 && "Intentional assert failure for coredump test");
}

// API handler to trigger crash - call with
// /api/crash?type=null|divzero|stack|assert
void handleApiCrash(AsyncWebServerRequest *request) {
  String type = "null";
  if (request->hasParam("type")) {
    type = request->getParam("type")->value();
  }

  request->send(200, "text/plain", "Crash will be triggered: " + type);
  delay(100); // Allow response to be sent

  if (type == "divzero") {
    triggerDivideByZero();
  } else if (type == "stack") {
    triggerStackOverflow();
  } else if (type == "assert") {
    triggerAssertFailure();
  } else {
    triggerNullPointerCrash();
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();

  delay(50);

  if (!LittleFS.begin(true)) {
    Serial.println("An Error has occurred while mounting LittleFS");
    return;
  }

  applySavedSettings();

  Serial.println("Setting initial ADC state to: Enabled, One-Shot mode.");
  if (writeByte(0x2E, 0xC0)) {
    Serial.println("Initial ADC configuration successful.");
  } else {
    Serial.println("FAILED to set initial ADC configuration.");
  }

  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);

  pinMode(interruptPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(interruptPin), handleInterrupt,
                  FALLING);

  ws.onEvent(onEvent);
  server.addHandler(&ws);

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/index.html", "text/html");
  });
  server.on("/page1", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page1.html", "text/html");
  });
  server.on("/page2", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page2.html", "text/html");
  });
  server.on("/page3", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page3.html", "text/html");
  });
  server.on("/page4", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page4.html", "text/html");
  });
  server.on("/page5", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page5.html", "text/html");
  });
  server.on("/page6", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/page6.html", "text/html");
  });
  server.on("/history", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/history.html", "text/html");
  });
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/style.css", "text/css");
  });
  server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/script.js", "text/javascript");
  });
  server.on("/style_path.css", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/style_path.css", "text/css");
  });
  server.on("/script_path.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/script_path.js", "text/javascript");
  });
  server.on("/tailwind.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(LittleFS, "/tailwind.js", "text/javascript");
  });

  server.on("/api/data1", HTTP_GET, handleApiData1);
  server.on("/api/data2", HTTP_GET, handleApiData2);
  server.on("/api/data3", HTTP_GET, handleApiData3);
  server.on("/api/data4", HTTP_GET, handleApiData4);
  server.on("/api/data5", HTTP_GET, handleApiData5);
  server.on("/api/data6", HTTP_GET, handleApiData6);
  server.on("/api/index", HTTP_GET, handleApiIndex);
  server.on("/api/global_status", HTTP_GET, handleApiGlobalStatus);
  server.on("/api/history", HTTP_GET, handleGetHistory);
  server.on("/api/unseen_count", HTTP_GET, handleGetUnseenCount);
  server.on("/api/mark_history_seen", HTTP_POST, handleMarkHistorySeen);

  server.on("/api/crash", HTTP_GET, handleApiCrash); // Core dump test endpoint

  server.on("/api/write", HTTP_POST, handleApiWrite);

  server.onNotFound([](AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
  });

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  if (interruptFired) {
    interruptFired = false;
    String reasonJson = getInterruptReason();
    if (reasonJson.length() > 0) {
      Serial.print("Interrupt JSON: ");
      Serial.println(reasonJson);
      ws.textAll(reasonJson);
      logInterrupt(reasonJson);
      checkBatteryRemovalCondition(reasonJson);
    }
  }

  if (millis() - lastWatchdogReset > watchdogInterval) {
    lastWatchdogReset = millis();
    Serial.println("Resetting BQ25672 watchdog timer...");
    if (modifyByte(0x10, 0b00001000, 0b00001000)) {
      Serial.println("Watchdog reset successful.");
    } else {
      Serial.println("Failed to reset watchdog.");
    }
  }

  // Timer-based cleanup to avoid race condition crashes
  if (millis() - lastWsCleanup > wsCleanupInterval) {
    lastWsCleanup = millis();
    ws.cleanupClients();
  }

  // Allow the RTOS scheduler to run the IDLE task and reset the watchdog
  delay(1);
}
