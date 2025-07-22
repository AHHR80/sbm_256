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
            }, 5000); // پاپ آپ بعد از ۵ ثانیه محو می شود
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
        
        // Simple boolean (0/1) interpreters
        _default_bool: v => v ? "Enabled" : "Disabled",
        _default_bool_rev: v => v ? "Disabled" : "Enabled",
        _default_stat: v => v ? "Active" : "Inactive",
        _default_fault: v => v ? "Fault" : "OK",
        _default_present: v => v ? "Present" : "Not Present",
        _default_done: v => v ? "Done" : "In Progress",
    };
    
    const keyMap = {
        EN_CHG: interpreters._default_bool, VBUS_PRESENT_STAT: interpreters._default_present, VBAT_PRESENT_STAT: interpreters._default_present,
        VSYS_STAT: v => v ? "VSYSMIN Reg" : "Normal", EN_ICO: interpreters._default_bool, FORCE_ICO: interpreters._default_stat,
        EN_HIZ: interpreters._default_bool, EN_OTG: interpreters._default_bool, EN_ACDRV2: interpreters._default_bool,
        EN_ACDRV1: interpreters._default_bool, DIS_ACDRV: interpreters._default_bool_rev, SFET_PRESENT: v => v ? "Yes" : "No",
        EN_MPPT: interpreters._default_bool, VBATOTG_LOW_STAT: v => v ? "Low" : "OK", ADC_EN: interpreters._default_bool,
        VBUS_OVP_STAT: interpreters._default_fault, VBAT_OVP_STAT: interpreters._default_fault, IBUS_OCP_STAT: interpreters._default_fault,
        IBAT_OCP_STAT: interpreters._default_fault, CONV_OCP_STAT: interpreters._default_fault, VSYS_SHORT_STAT: interpreters._default_fault,
        VSYS_OVP_STAT: interpreters._default_fault, OTG_OVP_STAT: interpreters._default_fault, OTG_UVP_STAT: interpreters._default_fault,
        TSHUT_STAT: interpreters._default_fault, EN_IBAT: interpreters._default_bool, EN_IINDPM: interpreters._default_bool,
        EN_EXTILIM: interpreters._default_bool, VAC2_OVP_STAT: interpreters._default_fault, VAC1_OVP_STAT: interpreters._default_fault,
        STOP_WD_CHG: v => v ? "Yes" : "No", EN_TRICHG_TMR: interpreters._default_bool, EN_PRECHG_TMR: interpreters._default_bool,
        EN_CHG_TMR: interpreters._default_bool, TMR2X_EN: interpreters._default_bool, EN_AUTO_IBATDIS: interpreters._default_bool,
        FORCE_IBATDIS: interpreters._default_stat, EN_TERM: interpreters._default_bool, FORCE_INDET: interpreters._default_stat,
        AUTO_INDET_EN: interpreters._default_bool, EN_12V: interpreters._default_bool, EN_9V: interpreters._default_bool,
        HVDCP_EN: interpreters._default_bool, PFM_OTG_DIS: interpreters._default_bool_rev, PFM_FWD_DIS: interpreters._default_bool_rev,
        DIS_LDO: interpreters._default_bool_rev, DIS_OTG_OOA: interpreters._default_bool_rev, DIS_FWD_OOA: interpreters._default_bool_rev,
        DIS_STAT: interpreters._default_bool_rev, DIS_VSYS_SHORT: interpreters._default_bool_rev, DIS_VOTG_UVP: interpreters._default_bool_rev,
        EN_IBUS_OCP: interpreters._default_bool, EN_BATOC: interpreters._default_bool, VBUS_PD_EN: interpreters._default_bool,
        VAC1_PD_EN: interpreters._default_bool, VAC2_PD_EN: interpreters._default_bool, TS_IGNORE: v => v ? "Yes" : "No",
        ADC_AVG: interpreters._default_bool, IBUS_ADC_DIS: interpreters._default_bool_rev, IBAT_ADC_DIS: interpreters._default_bool_rev,
        VBUS_ADC_DIS: interpreters._default_bool_rev, VBAT_ADC_DIS: interpreters._default_bool_rev, VSYS_ADC_DIS: interpreters._default_bool_rev,
        TS_ADC_DIS: interpreters._default_bool_rev, TDIE_ADC_DIS: interpreters._default_bool_rev, DP_ADC_DIS: interpreters._default_bool_rev,
        DM_ADC_DIS: interpreters._default_bool_rev, VAC2_ADC_DIS: interpreters._default_bool_rev, VAC1_ADC_DIS: interpreters._default_bool_rev,
        IINDPM_STAT: interpreters._default_stat, VINDPM_STAT: interpreters._default_stat, WD_STAT: v => v ? "Expired" : "OK",
        PG_STAT: v => v ? "Power Good" : "Not Good", BC1_2_DONE_STAT: interpreters._default_done, TREG_STAT: interpreters._default_stat,
        DPDM_STAT: interpreters._default_done, ACRB2_STAT: interpreters._default_present, ACRB1_STAT: interpreters._default_present,
        ADC_DONE_STAT: interpreters._default_done, CHG_TMR_STAT: v => v ? "Expired" : "OK", TRICHG_TMR_STAT: v => v ? "Expired" : "OK",
        PRECHG_TMR_STAT: v => v ? "Expired" : "OK", TS_COLD_STAT: interpreters._default_fault, TS_COOL_STAT: interpreters._default_stat,
        TS_WARM_STAT: interpreters._default_stat, TS_HOT_STAT: interpreters._default_fault, IBAT_REG_STAT: interpreters._default_stat,
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
});
