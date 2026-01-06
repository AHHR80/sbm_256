# BQ25672 Battery Charger Monitor

ESP32-based web interface for monitoring and configuring the **SBM_256 BOARD** battery charge management IC.

## Features

- 📊 **Real-time Monitoring** - View battery voltage, current, temperature, and charging status via WebSocket
- ⚙️ **Full Register Control** - Configure all BQ25672 registers through an intuitive web interface
- 📱 **Mobile-Friendly UI** - Responsive design works on desktop and mobile devices
- 💾 **Persistent Settings** - Configuration saved to flash and restored on power-up
- 📝 **Event History** - Log and view interrupt events from the charger IC
- 🔔 **Interrupt Handling** - Real-time notifications for charger events and faults

## Hardware Requirements

- ESP32 development board
- BQ25672 battery charger IC
- I2C connection between ESP32 and BQ25672:
  - SDA → GPIO 21 (default)
  - SCL → GPIO 22 (default)
- INT pin → GPIO 4 (for interrupt notifications)

## Software Requirements

- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/) v5.x
- [Arduino-ESP32](https://github.com/espressif/arduino-esp32) component

## Building & Flashing

1. Clone the repository:
   ```bash
   git clone https://github.com/AHHR80/sbm_256.git
   cd sbm_256
   git checkout esp-idf
   ```

2. Set up ESP-IDF environment:
   ```bash
   . $IDF_PATH/export.sh
   ```

3. Build the project:
   ```bash
   idf.py build
   ```

4. Flash to ESP32:
   ```bash
   idf.py -p COM<X> flash monitor
   ```

## Usage

1. Power on the ESP32
2. Connect to WiFi network: **ESP32_BQ25672_Monitor**
   - Password: `password123`
3. Open browser and navigate to: **http://192.168.4.1**

## Project Structure

```
├── main/
│   └── main.cpp          # Main application code
├── data/                  # Web interface files (LittleFS)
├── components/            # ESP-IDF components
├── partitions.csv         # Custom partition table
├── sdkconfig              # ESP-IDF configuration
└── CMakeLists.txt         # Project build configuration
```

## Branches

- `master` - Arduino IDE based code (legacy)
- `esp-idf` - ESP-IDF based code (current development)

## Docs

- [VS Code ESP-IDF Extension - New Project](https://docs.espressif.com/projects/vscode-esp-idf-extension/en/latest/startproject.html#using-esp-idf-new-project)
- [Arduino-ESP32 - Adding Global Library](https://docs.espressif.com/projects/arduino-esp32/en/latest/esp-idf_component.html#adding-global-library)
- [Core Dump](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/core_dump.html)
- [Partition Tables](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/partition-tables.html#flashing-the-partition-table)
- [SPIFFS Storage](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/spiffs.html#notes)

### Upload build timer version of those docs saved in rwsh938.... GDriver

## License

MIT License

## Author

AHHR80
