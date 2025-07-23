document.addEventListener('DOMContentLoaded', function() {
    // --- WebSocket Initialization ---
    let gateway = `ws://${window.location.hostname}/ws`;
    let websocket;

    function initWebSocket() {
        console.log('Trying to open a WebSocket connection...');
        websocket = new WebSocket(gateway);
        websocket.onopen = onOpen;
        websocket.onclose = onClose;
        websocket.onmessage = onMessage;
    }

    function onOpen(event) {
        console.log('Connection opened');
    }

    function onClose(event) {
        console.log('Connection closed');
        setTimeout(initWebSocket, 2000); // Try to reconnect every 2 seconds
    }

    function onMessage(event) {
        console.log('Message from server: ', event.data);
        showToast(event.data);
    }
    
    // --- Toast Notification Logic ---
    function showToast(message) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.innerHTML = "<strong>وقفه:</strong> " + message;
            toast.className = "show";
            setTimeout(function() {
                toast.className = toast.className.replace("show", "");
            }, 5000); // Popup disappears after 5 seconds
        }
    }

    // Initialize WebSocket on page load
    initWebSocket();

    // --- Data Fetching & Interpretation Logic ---
    if (typeof window.API_ENDPOINT === 'undefined') {
        return; // Don't run fetching logic on index.html
    }
    const dataContainer = document.getElementById('data-container');
    if (!dataContainer) return;

    // This object holds functions to convert raw status codes to meaningful strings.
    const interpreters = {
        CHG_STAT_2_0: v => ["Not Charging", "Trickle", "Pre-charge", "Fast Charge", "Taper", "Reserved", "Top-off", "Done"][v] || "Unknown",
        VBUS_STAT_3_0: v => ({0:"No Input",1:"SDP",2:"CDP",3:"DCP",4:"HVDCP",5:"Unknown",6:"Non-Standard",7:"OTG",8:"Not Qualified"})[v]||"Reserved",
        ICO_STAT_1_0: v => ["Disabled", "In Progress", "Done", "Reserved"][v] || "Unknown",
        SDRV_CTRL_1_0: v => ["IDLE", "Shutdown", "Ship Mode", "Reset"][v] || "Unknown",
        WATCHDOG_2_0: v => ["Disabled", "0.5s", "1s", "2s", "20s", "40s", "80s", "160s"][v] || "Unknown",
        TREG_1_0: v => ["60C", "80C", "100C", "120C"][v] || "Unknown",
        CHG_TMR_1_0: v => ["5h", "8h", "12h", "24h"][v] || "Unknown",
        VBAT_LOWV_1_0: v => ["15%", "62.2%", "66.7%", "71.4%"][v] + " VREG" || "Unknown",
        TRECHG_1_0: v => ["64ms", "256ms", "1024ms", "2048ms"][v] || "Unknown",
        VAC_OVP_1_0: v => ["26V", "22V", "12V", "7V"][v] || "Unknown",
        IBAT_REG_1_0: v => ["3A", "4A", "5A", "Disabled"][v] || "Unknown",
        ADC_SAMPLE_1_0: v => ["15-bit", "14-bit", "13-bit", "12-bit"][v] || "Unknown",
        PRECHG_TMR: v => v ? "0.5h" : "2h",
        PWM_FREQ: v => v ? "750kHz" : "1.5MHz",
        WKUP_DLY: v => v ? "15ms" : "1s",
        SDRV_DLY: v => v ? "No Delay" : "10s Delay",
        ADC_RATE: v => v ? "One Shot" : "Continuous",
        ADC_AVG_INIT: v => v ? "New ADC" : "Existing",
    };
    
    // Map for simple boolean-like registers to avoid repetition
    const keyMap = {
        EN_CHG: v => v ? "Enabled" : "Disabled", VBUS_PRESENT_STAT: v => v ? "Present" : "Not Present", VBAT_PRESENT_STAT: v => v ? "Present" : "Not Present",
        VSYS_STAT: v => v ? "VSYSMIN Reg" : "Normal", EN_ICO: v => v ? "Enabled" : "Disabled", FORCE_ICO: v => v ? "Active" : "Inactive",
        EN_HIZ: v => v ? "Enabled" : "Disabled", EN_OTG: v => v ? "Enabled" : "Disabled", EN_ACDRV2: v => v ? "Enabled" : "Disabled",
        EN_ACDRV1: v => v ? "Enabled" : "Disabled", DIS_ACDRV: v => v ? "Disabled" : "Enabled", SFET_PRESENT: v => v ? "Yes" : "No",
        EN_MPPT: v => v ? "Enabled" : "Disabled", VBATOTG_LOW_STAT: v => v ? "Low" : "OK", ADC_EN: v => v ? "Enabled" : "Disabled",
        VBUS_OVP_STAT: v => v ? "Fault" : "OK", VBAT_OVP_STAT: v => v ? "Fault" : "OK", IBUS_OCP_STAT: v => v ? "Fault" : "OK",
        IBAT_OCP_STAT: v => v ? "Fault" : "OK", CONV_OCP_STAT: v => v ? "Fault" : "OK", VSYS_SHORT_STAT: v => v ? "Fault" : "OK",
        VSYS_OVP_STAT: v => v ? "Fault" : "OK", OTG_OVP_STAT: v => v ? "Fault" : "OK", OTG_UVP_STAT: v => v ? "Fault" : "OK",
        TSHUT_STAT: v => v ? "Fault" : "OK", EN_IBAT: v => v ? "Enabled" : "Disabled", EN_IINDPM: v => v ? "Enabled" : "Disabled",
        EN_EXTILIM: v => v ? "Enabled" : "Disabled", VAC2_OVP_STAT: v => v ? "Fault" : "OK", VAC1_OVP_STAT: v => v ? "Fault" : "OK",
        STOP_WD_CHG: v => v ? "Yes" : "No", EN_TRICHG_TMR: v => v ? "Enabled" : "Disabled", EN_PRECHG_TMR: v => v ? "Enabled" : "Disabled",
        EN_CHG_TMR: v => v ? "Enabled" : "Disabled", TMR2X_EN: v => v ? "Enabled" : "Disabled", EN_AUTO_IBATDIS: v => v ? "Enabled" : "Disabled",
        FORCE_IBATDIS: v => v ? "Active" : "Inactive", EN_TERM: v => v ? "Enabled" : "Disabled", FORCE_INDET: v => v ? "Active" : "Inactive",
        AUTO_INDET_EN: v => v ? "Enabled" : "Disabled", EN_12V: v => v ? "Enabled" : "Disabled", EN_9V: v => v ? "Enabled" : "Disabled",
        HVDCP_EN: v => v ? "Enabled" : "Disabled", PFM_OTG_DIS: v => v ? "Disabled" : "Enabled", PFM_FWD_DIS: v => v ? "Disabled" : "Enabled",
        DIS_LDO: v => v ? "Disabled" : "Enabled", DIS_OTG_OOA: v => v ? "Disabled" : "Enabled", DIS_FWD_OOA: v => v ? "Disabled" : "Enabled",
        DIS_STAT: v => v ? "Disabled" : "Enabled", DIS_VSYS_SHORT: v => v ? "Disabled" : "Enabled", DIS_VOTG_UVP: v => v ? "Disabled" : "Enabled",
        EN_IBUS_OCP: v => v ? "Enabled" : "Disabled", EN_BATOC: v => v ? "Enabled" : "Disabled", VBUS_PD_EN: v => v ? "Enabled" : "Disabled",
        VAC1_PD_EN: v => v ? "Enabled" : "Disabled", VAC2_PD_EN: v => v ? "Enabled" : "Disabled", TS_IGNORE: v => v ? "Yes" : "No",
        ADC_AVG: v => v ? "Enabled" : "Disabled", IBUS_ADC_DIS: v => v ? "Disabled" : "Enabled", IBAT_ADC_DIS: v => v ? "Disabled" : "Enabled",
        VBUS_ADC_DIS: v => v ? "Disabled" : "Enabled", VBAT_ADC_DIS: v => v ? "Disabled" : "Enabled", VSYS_ADC_DIS: v => v ? "Disabled" : "Enabled",
        TS_ADC_DIS: v => v ? "Disabled" : "Enabled", TDIE_ADC_DIS: v => v ? "Disabled" : "Enabled", DP_ADC_DIS: v => v ? "Disabled" : "Enabled",
        DM_ADC_DIS: v => v ? "Disabled" : "Enabled", VAC2_ADC_DIS: v => v ? "Disabled" : "Enabled", VAC1_ADC_DIS: v => v ? "Disabled" : "Enabled",
        IINDPM_STAT: v => v ? "Active" : "Inactive", VINDPM_STAT: v => v ? "Active" : "Inactive", WD_STAT: v => v ? "Expired" : "OK",
        PG_STAT: v => v ? "Power Good" : "Not Good", BC1_2_DONE_STAT: v => v ? "Done" : "In Progress", TREG_STAT: v => v ? "Active" : "Inactive",
        DPDM_STAT: v => v ? "In Progress" : "Done", ACRB2_STAT: v => v ? "Present" : "Not Present", ACRB1_STAT: v => v ? "Present" : "Not Present",
        ADC_DONE_STAT: v => v ? "Done" : "In Progress", CHG_TMR_STAT: v => v ? "Expired" : "OK", TRICHG_TMR_STAT: v => v ? "Expired" : "OK",
        PRECHG_TMR_STAT: v => v ? "Expired" : "OK", TS_COLD_STAT: v => v ? "Fault" : "OK", TS_COOL_STAT: v => v ? "Active" : "Inactive",
        TS_WARM_STAT: v => v ? "Active" : "Inactive", TS_HOT_STAT: v => v ? "Fault" : "OK", IBAT_REG_STAT: v => v ? "Active" : "Inactive",
        FORCE_VINDPM_DET: v => v ? "Active" : "Inactive",
    };

    const fetchData = async () => {
        try {
            const response = await fetch(window.API_ENDPOINT);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const data = await response.json();
            
            for (const key in data) {
                const element = document.getElementById(key);
                if (element) {
                    let value = data[key];
                    if (value === -1 || value === -999.0) {
                        element.textContent = "Error";
                        continue;
                    }
                    
                    let interpretedValue;
                    if (interpreters[key]) {
                        interpretedValue = interpreters[key](value);
                    } else if (keyMap[key]) {
                        interpretedValue = keyMap[key](value);
                    } else if (typeof value === 'number' && !Number.isInteger(value)) {
                        interpretedValue = value.toFixed(2);
                    } else {
                        interpretedValue = value;
                    }
                    element.textContent = interpretedValue;
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    fetchData();
    setInterval(fetchData, 10000);

    // --- Click Event Handler for Writable Registers ---
    document.getElementById('data-container').addEventListener('click', function(event) {
        const card = event.target.closest('.data-card.writable');
        if (!card) return;

        const regName = card.dataset.reg;
        const currentValueSpan = card.querySelector('.value');
        const currentValue = currentValueSpan.textContent;

        let newValue;
        // For boolean-like registers or command registers, just toggle/set the value to 1
        if (card.classList.contains('command') || currentValue === "Enabled" || currentValue === "Disabled" || currentValue === "Yes" || currentValue === "No" || currentValue === "Active" || currentValue === "Inactive") {
            // For commands, we always send '1' to activate them. For toggles, we determine the new value.
            if (card.classList.contains('command')) {
                 newValue = 1;
                 alert(`دستور ${regName} اجرا می‌شود.`);
            } else {
                 newValue = (currentValue === "Enabled" || currentValue === "Yes") ? 0 : 1;
            }
        } else {
            // For numeric values, show a prompt
            let promptValue = currentValue.replace(/[^\d.-]/g, ''); // Remove units like 'mV', 'mA' for prompt
            newValue = prompt(`مقدار جدید را برای ${regName} وارد کنید:\n(مقدار فعلی: ${currentValue})`, promptValue);
        }
        
        if (newValue === null || (typeof newValue === 'string' && newValue.trim() === "")) {
            console.log('Write operation cancelled.');
            return; // User cancelled or entered empty value
        }

        // Send the new value to the server
        sendWriteRequest(regName, newValue);
    });
    
    // --- Modal and Reset Button Logic ---
    const resetButton = document.getElementById('reset-button');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');

    if (resetButton && confirmModal && confirmYes && confirmNo) {
        resetButton.addEventListener('click', () => {
            confirmModal.style.display = 'flex';
        });

        confirmNo.addEventListener('click', () => {
            confirmModal.style.display = 'none';
        });

        confirmYes.addEventListener('click', () => {
            console.log('Sending REG_RST command...');
            sendWriteRequest('REG_RST', 1);
            confirmModal.style.display = 'none';
        });

        // Also close modal if clicking outside of it
        window.addEventListener('click', (event) => {
            if (event.target == confirmModal) {
                confirmModal.style.display = 'none';
            }
        });
    }

    async function sendWriteRequest(reg, val) {
        try {
            const response = await fetch('/api/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `reg=${encodeURIComponent(reg)}&val=${encodeURIComponent(val)}`
            });

            if (response.ok) {
                console.log(`Successfully wrote ${val} to ${reg}`);
                showToast(`مقدار ${reg} با موفقیت به ${val} تغییر یافت.`);
                // Refresh data immediately to show the change
                setTimeout(fetchData, 500); // Wait a bit for the device to process the reset
            } else {
                const errorText = await response.text();
                showToast(`خطا در نوشتن: ${errorText}`);
            }
        } catch (error) {
            console.error('Failed to send write request:', error);
            showToast('خطا در ارسال درخواست. اتصال را بررسی کنید.');
        }
    }
});
