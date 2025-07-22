document.addEventListener('DOMContentLoaded', function() {
    // Check if the API endpoint is defined for the page
    if (typeof window.API_ENDPOINT === 'undefined') {
        console.error("API_ENDPOINT is not defined for this page.");
        return;
    }

    const dataContainer = document.getElementById('data-container');
    if (!dataContainer) return;

    // --- Data Interpretation Logic ---
    // This object holds functions to convert raw status codes to meaningful strings.
    const interpreters = {
        CHG_STAT_2_0: val => {
            const statuses = ["Not Charging", "Trickle Charge", "Pre-charge", "Fast Charge (CC)", "Taper Charge (CV)", "Reserved", "Top-off Active", "Charge Done"];
            return statuses[val] || "Unknown";
        },
        VBUS_STAT_3_0: val => {
            const statuses = {0: "No Input", 1: "USB SDP", 2: "USB CDP", 3: "USB DCP", 4: "HVDCP", 5: "Unknown", 6: "Non-Standard", 7: "OTG Mode", 8: "Not Qualified"};
            return statuses[val] || "Reserved";
        },
        ICO_STAT_1_0: val => {
            const statuses = ["Disabled", "In Progress", "Max Power Detected", "Reserved"];
            return statuses[val] || "Unknown";
        },
        SDRV_CTRL_1_0: val => {
            const statuses = ["IDLE", "Shutdown", "Ship Mode", "System Reset"];
            return statuses[val] || "Unknown";
        },
        WATCHDOG_2_0: val => {
            const statuses = ["Disabled", "0.5s", "1s", "2s", "20s", "40s", "80s", "160s"];
            return statuses[val] || "Unknown";
        },
        TREG_1_0: val => {
            const statuses = ["60C", "80C", "100C", "120C"];
            return statuses[val] || "Unknown";
        },
        CHG_TMR_1_0: val => {
            const statuses = ["5h", "8h", "12h", "24h"];
            return statuses[val] || "Unknown";
        },
        // Simple boolean (0/1) interpreters
        EN_CHG: val => val ? "Enabled" : "Disabled",
        VBUS_PRESENT_STAT: val => val ? "Present" : "Not Present",
        VBAT_PRESENT_STAT: val => val ? "Present" : "Not Present",
        VSYS_STAT: val => val ? "VSYSMIN Reg" : "Normal",
        EN_ICO: val => val ? "Enabled" : "Disabled",
        FORCE_ICO: val => val ? "Active" : "Inactive",
        EN_HIZ: val => val ? "Enabled" : "Disabled",
        EN_OTG: val => val ? "Enabled" : "Disabled",
        EN_ACDRV2: val => val ? "Enabled" : "Disabled",
        EN_ACDRV1: val => val ? "Enabled" : "Disabled",
        DIS_ACDRV: val => val ? "Disabled" : "Enabled",
        SFET_PRESENT: val => val ? "Yes" : "No",
        EN_MPPT: val => val ? "Enabled" : "Disabled",
        VBATOTG_LOW_STAT: val => val ? "Low" : "OK",
        ADC_EN: val => val ? "Enabled" : "Disabled",
        VBUS_OVP_STAT: val => val ? "Fault" : "OK",
        VBAT_OVP_STAT: val => val ? "Fault" : "OK",
        IBUS_OCP_STAT: val => val ? "Fault" : "OK",
        IBAT_OCP_STAT: val => val ? "Fault" : "OK",
        CONV_OCP_STAT: val => val ? "Fault" : "OK",
        VSYS_SHORT_STAT: val => val ? "Fault" : "OK",
        VSYS_OVP_STAT: val => val ? "Fault" : "OK",
        OTG_OVP_STAT: val => val ? "Fault" : "OK",
        OTG_UVP_STAT: val => val ? "Fault" : "OK",
        TSHUT_STAT: val => val ? "Fault" : "OK",
        IINDPM_STAT: val => val ? "Active" : "Inactive",
        VINDPM_STAT: val => val ? "Active" : "Inactive",
        WD_STAT: val => val ? "Expired" : "OK",
        PG_STAT: val => val ? "Power Good" : "Not Good",
        BC1_2_DONE_STAT: val => val ? "Done" : "In Progress",
        TREG_STAT: val => val ? "Active" : "Inactive",
        DPDM_STAT: val => val ? "In Progress" : "Done",
        ACRB2_STAT: val => val ? "Present" : "Not Present",
        ACRB1_STAT: val => val ? "Present" : "Not Present",
        ADC_DONE_STAT: val => val ? "Done" : "In Progress",
        CHG_TMR_STAT: val => val ? "Expired" : "OK",
        TRICHG_TMR_STAT: val => val ? "Expired" : "OK",
        PRECHG_TMR_STAT: val => val ? "Expired" : "OK",
        TS_COLD_STAT: val => val ? "Fault" : "OK",
        TS_COOL_STAT: val => val ? "Active" : "Inactive",
        TS_WARM_STAT: val => val ? "Active" : "Inactive",
        TS_HOT_STAT: val => val ? "Fault" : "OK",
        IBAT_REG_STAT: val => val ? "Active" : "Inactive",
    };

    // Function to fetch and update data
    const fetchData = async () => {
        try {
            const response = await fetch(window.API_ENDPOINT);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.msg) {
                dataContainer.innerHTML = `<p style="text-align: center; grid-column: 1 / -1;">${data.msg}</p>`;
                return;
            }

            // Iterate over the received data and update the DOM
            for (const key in data) {
                const element = document.getElementById(key);
                if (element) {
                    let value = data[key];
                    // If the value is -1, it's an error from the ESP32
                    if (value === -1 || value === -999.0) {
                        element.textContent = "Error";
                        continue;
                    }
                    
                    // Check if an interpreter function exists for this key
                    if (interpreters[key]) {
                        element.textContent = interpreters[key](value);
                    } else if (typeof value === 'number' && !Number.isInteger(value)) {
                        // For floating point numbers, fix to 2 decimal places
                        element.textContent = value.toFixed(2);
                    } else {
                        element.textContent = value;
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    // Fetch data immediately on page load
    fetchData();

    // Set an interval to fetch data every 10 seconds
    setInterval(fetchData, 10000);
});
