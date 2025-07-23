document.addEventListener('DOMContentLoaded', function() {
    // --- Register Configuration Object ---
    // This is the "brain" of the UI. It defines how each writable register behaves.
    const registerConfig = {
        // Page 1
        VSYSMIN_5_0: { type: 'number', range: { min: 2500, max: 16000, step: 250 }, unit: 'mV' },
        CELL_1_0: { type: 'select', options: { '1': '1s', '2': '2s', '3': '3s', '4': '4s' } },
        VOTG_10_0: { type: 'number', range: { min: 2800, max: 22000, step: 10 }, unit: 'mV' },
        IOTG_6_0: { type: 'number', range: { min: 160, max: 3360, step: 40 }, unit: 'mA' },
        EN_CHG: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        // Page 2
        VREG_10_0: { type: 'number', range: { min: 3000, max: 18800, step: 10 }, unit: 'mV' },
        ICHG_8_0: { type: 'number', range: { min: 50, max: 3000, step: 10 }, unit: 'mA' },
        VINDPM_7_0: { type: 'number', range: { min: 3600, max: 22000, step: 100 }, unit: 'mV' },
        IINDPM_8_0: { type: 'number', range: { min: 100, max: 3300, step: 10 }, unit: 'mA' },
        EN_ICO: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        FORCE_ICO: { type: 'command' },
        EN_HIZ: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        SDRV_CTRL_1_0: { type: 'select', options: { '0': 'IDLE', '1': 'Shutdown', '2': 'Ship Mode', '3': 'Reset' } },
        EN_OTG: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_ACDRV2: { type: 'boolean', options: { '0': 'Off', '1': 'On' } },
        EN_ACDRV1: { type: 'boolean', options: { '0': 'Off', '1': 'On' } },
        DIS_ACDRV: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        FORCE_VINDPM_DET: { type: 'command' },
        SFET_PRESENT: { type: 'boolean', options: { '0': 'No', '1': 'Yes' } },
        EN_MPPT: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        ADC_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        // Page 3
        VBAT_LOWV_1_0: { type: 'select', options: { '0': '15% VREG', '1': '62.2% VREG', '2': '66.7% VREG', '3': '71.4% VREG' } },
        IPRECHG_5_0: { type: 'number', range: { min: 40, max: 2000, step: 40 }, unit: 'mA' },
        ITERM_4_0: { type: 'number', range: { min: 40, max: 1000, step: 40 }, unit: 'mA' },
        TRECHG_1_0: { type: 'select', options: { '0': '64ms', '1': '256ms', '2': '1024ms', '3': '2048ms' } },
        VRECHG_3_0: { type: 'number', range: { min: 50, max: 800, step: 50 }, unit: 'mV' },
        VAC_OVP_1_0: { type: 'select', options: { '0': '26V', '1': '18V', '2': '12V', '3': '7V' } },
        EN_IBAT: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        IBAT_REG_1_0: { type: 'select', options: { '0': '3A', '1': '4A', '2': '5A', '3': 'Disabled' } },
        EN_IINDPM: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_EXTILIM: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        ADC_SAMPLE_1_0: { type: 'select', options: { '0': '15-bit', '1': '14-bit', '2': '13-bit', '3': '12-bit' } },
        // Page 4
        STOP_WD_CHG: { type: 'boolean', options: { '0': 'No', '1': 'Yes' } },
        PRECHG_TMR: { type: 'select', options: { '0': '2h', '1': '0.5h' } },
        TOPOFF_TMR_1_0: { type: 'select', options: { '0': 'Disabled', '1': '15min', '2': '30min', '3': '45min' } },
        EN_TRICHG_TMR: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_PRECHG_TMR: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_CHG_TMR: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        CHG_TMR_1_0: { type: 'select', options: { '0': '5h', '1': '8h', '2': '12h', '3': '24h' } },
        TMR2X_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_AUTO_IBATDIS: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        FORCE_IBATDIS: { type: 'command' },
        EN_TERM: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        WATCHDOG_2_0: { type: 'select', options: { '0': 'Disabled', '1': '0.5s', '2': '1s', '3': '2s', '4': '20s', '5': '40s', '6': '80s', '7': '160s' } },
        FORCE_INDET: { type: 'command' },
        AUTO_INDET_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_12V: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_9V: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        HVDCP_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        SDRV_DLY: { type: 'select', options: { '0': '10s Delay', '1': 'No Delay' } },
        PFM_OTG_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        PFM_FWD_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        WKUP_DLY: { type: 'select', options: { '0': '1s', '1': '15ms' } },
        DIS_LDO: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DIS_OTG_OOA: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DIS_FWD_OOA: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        PWM_FREQ: { type: 'select', options: { '0': '1.5MHz', '1': '750kHz' } },
        DIS_STAT: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DIS_VSYS_SHORT: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DIS_VOTG_UVP: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        EN_IBUS_OCP: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        EN_BATOC: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        VOC_PCT_2_0: { type: 'select', options: { '0': '56.25%', '1': '62.5%', '2': '68.75%', '3': '75%', '4': '81.25%', '5': '87.5%', '6': '93.75%', '7': '100%' } },
        VOC_DLY_1_0: { type: 'select', options: { '0': '50ms', '1': '300ms', '2': '2s', '3': '5s' } },
        VOC_RATE_1_0: { type: 'select', options: { '0': '30s', '1': '2min', '2': '10min', '3': '30min' } },
        TREG_1_0: { type: 'select', options: { '0': '60°C', '1': '80°C', '2': '100°C', '3': '120°C' } },
        TSHUT_1_0: { type: 'select', options: { '0': '150°C', '1': '130°C', '2': '120°C', '3': '85°C' } },
        VBUS_PD_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        VAC1_PD_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        VAC2_PD_EN: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        JEITA_VSET_2_0: { type: 'select', options: { '0': 'Suspend', '1': '-800mV', '2': '-600mV', '3': '-400mV', '4': '-300mV', '5': '-200mV', '6': '-100mV', '7': 'Unchanged' } },
        JEITA_ISETH_1_0: { type: 'select', options: { '0': 'Suspend', '1': '20% ICHG', '2': '40% ICHG', '3': 'Unchanged' } },
        JEITA_ISETC_1_0: { type: 'select', options: { '0': 'Suspend', '1': '20% ICHG', '2': '40% ICHG', '3': 'Unchanged' } },
        TS_COOL_1_0: { type: 'select', options: { '0': '5°C', '1': '10°C', '2': '15°C', '3': '20°C' } },
        TS_WARM_1_0: { type: 'select', options: { '0': '40°C', '1': '45°C', '2': '50°C', '3': '55°C' } },
        BHOT_1_0: { type: 'select', options: { '0': '55°C', '1': '60°C', '2': '65°C', '3': 'Disabled' } },
        BCOLD: { type: 'select', options: { '0': '-10°C', '1': '-20°C' } },
        TS_IGNORE: { type: 'boolean', options: { '0': 'No', '1': 'Yes' } },
        ADC_RATE: { type: 'select', options: { '0': 'Continuous', '1': 'One Shot' } },
        ADC_AVG: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
        ADC_AVG_INIT: { type: 'boolean', options: { '0': 'Use Existing', '1': 'Use New' } },
        IBUS_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        IBAT_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        VBUS_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        VBAT_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        VSYS_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        TS_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        TDIE_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DP_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DM_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        VAC2_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        VAC1_ADC_DIS: { type: 'boolean', options: { '0': 'Enabled', '1': 'Disabled' } },
        DPLUS_DAC_2_0: { type: 'select', options: { '0': 'HIZ', '1': '0V', '2': '0.6V', '3': '1.2V', '4': '2.0V', '5': '2.7V', '6': '3.3V', '7': 'D+/D- Short' } },
        DMINUS_DAC_2_0: { type: 'select', options: { '0': 'HIZ', '1': '0V', '2': '0.6V', '3': '1.2V', '4': '2.0V', '5': '2.7V', '6': '3.3V', '7': 'Reserved' } },
    };

    // --- WebSocket Initialization ---
    let gateway = `ws://${window.location.hostname}/ws`;
    let websocket;

    function initWebSocket() {
        console.log('Trying to open a WebSocket connection...');
        websocket = new WebSocket(gateway);
        websocket.onopen = () => console.log('Connection opened');
        websocket.onclose = () => {
            console.log('Connection closed');
            setTimeout(initWebSocket, 2000);
        };
        websocket.onmessage = (event) => {
            console.log('Message from server: ', event.data);
            showToast(event.data);
        };
    }
    initWebSocket();

    // --- Toast Notification Logic ---
    function showToast(message) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.innerHTML = `<strong>وقفه:</strong> ${message}`;
            toast.className = "show";
            setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 5000);
        }
    }

    // --- Data Fetching & Display Logic ---
    if (typeof window.API_ENDPOINT === 'undefined') return;

    const dataContainer = document.getElementById('data-container');
    if (!dataContainer) return;

    // This object holds functions to convert raw status codes to meaningful strings for READ-ONLY values.
    const statusInterpreters = {
        CHG_STAT_2_0: v => ["Not Charging", "Trickle", "Pre-charge", "Fast Charge", "Taper", "Reserved", "Top-off", "Done"][v] || "Unknown",
        VBUS_STAT_3_0: v => ({0:"No Input",1:"SDP",2:"CDP",3:"DCP",4:"HVDCP",5:"Unknown",6:"Non-Standard",7:"OTG",8:"Not Qualified"})[v]||"Reserved",
        ICO_STAT_1_0: v => ["Disabled", "In Progress", "Done", "Reserved"][v] || "Unknown",
    };

    const fetchData = async () => {
        try {
            const response = await fetch(window.API_ENDPOINT);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            for (const key in data) {
                const element = document.getElementById(key);
                if (element) {
                    let rawValue = data[key];
                    if (rawValue === -1 || rawValue === -999.0) {
                        element.textContent = "Error";
                        element.parentElement.dataset.currentValue = "Error";
                        continue;
                    }
                    element.parentElement.dataset.currentValue = rawValue;

                    let displayValue;
                    const config = registerConfig[key];
                    if (config) { // It's a writable register
                        if (config.type === 'select' || config.type === 'boolean') {
                            displayValue = config.options[rawValue] || `Raw: ${rawValue}`;
                        } else if (config.type === 'command') {
                            displayValue = "اجرا"; // Text for the command button
                        } else { // number
                            displayValue = `${rawValue}${config.unit || ''}`;
                        }
                    } else if (statusInterpreters[key]) { // It's a read-only status register
                        displayValue = statusInterpreters[key](rawValue);
                    } else if (typeof rawValue === 'boolean') {
                        displayValue = rawValue ? "Yes" : "No";
                    } else if (typeof rawValue === 'number' && !Number.isInteger(rawValue)) {
                        displayValue = rawValue.toFixed(2);
                    } else { // Default display for other read-only values
                        displayValue = rawValue;
                    }
                    element.textContent = displayValue;
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    fetchData();
    setInterval(fetchData, 5000);

    // --- Modal and Interaction Logic ---
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    const modalCancel = document.getElementById('modal-cancel');

    let currentEditingReg = null;

    dataContainer.addEventListener('click', (event) => {
        const card = event.target.closest('.data-card.writable');
        if (!card) return;

        currentEditingReg = card.dataset.reg;
        const config = registerConfig[currentEditingReg];
        if (!config) return;

        const rawValue = card.dataset.currentValue;
        modalTitle.textContent = `ویرایش ${card.querySelector('.label').textContent}`;
        modalBody.innerHTML = ''; // Clear previous content

        if (config.type === 'boolean') {
            const btnGroup = document.createElement('div');
            btnGroup.className = 'modal-btn-group';
            btnGroup.innerHTML = `
                <button data-value="1" class="${rawValue == 1 ? 'active' : ''}">${config.options['1']}</button>
                <button data-value="0" class="${rawValue == 0 ? 'active' : ''}">${config.options['0']}</button>
            `;
            modalBody.appendChild(btnGroup);
        } else if (config.type === 'select') {
            const select = document.createElement('select');
            for (const val in config.options) {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = config.options[val];
                if (val == rawValue) option.selected = true;
                select.appendChild(option);
            }
            modalBody.appendChild(select);
        } else if (config.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = rawValue;
            if (config.range) {
                input.min = config.range.min;
                input.max = config.range.max;
                input.step = config.range.step;
            }
            modalBody.appendChild(input);
            if (config.unit) {
                const unitSpan = document.createElement('span');
                unitSpan.className = 'modal-unit';
                unitSpan.textContent = config.unit;
                modalBody.appendChild(unitSpan);
            }
        } else if (config.type === 'command') {
            modalBody.innerHTML = `<p>با کلیک روی "ذخیره"، دستور <strong>${currentEditingReg}</strong> اجرا خواهد شد.</p>`;
        }

        modal.style.display = 'flex';
    });

    modalCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    modalSave.addEventListener('click', () => {
        const config = registerConfig[currentEditingReg];
        let newValue;

        if (config.type === 'command') {
            newValue = 1;
        } else if (config.type === 'boolean') {
            const activeButton = modalBody.querySelector('button.active');
            newValue = activeButton ? activeButton.dataset.value : null;
        } else if (config.type === 'select') {
            newValue = modalBody.querySelector('select').value;
        } else if (config.type === 'number') {
            newValue = modalBody.querySelector('input').value;
        }

        if (newValue !== null) {
            sendWriteRequest(currentEditingReg, newValue);
        }
        modal.style.display = 'none';
    });
    
    // Delegate click for boolean buttons inside modal
    modalBody.addEventListener('click', (event) => {
        if(event.target.tagName === 'BUTTON') {
            // Remove active class from sibling
            const parent = event.target.parentElement;
            parent.querySelector('.active')?.classList.remove('active');
            // Add active class to clicked button
            event.target.classList.add('active');
        }
    });


    // --- REG_RST Button Logic ---
    const resetButton = document.getElementById('reset-button');
    const confirmModal = document.getElementById('confirm-modal');
    if(resetButton && confirmModal) {
        const confirmYes = document.getElementById('confirm-yes');
        const confirmNo = document.getElementById('confirm-no');
        
        resetButton.addEventListener('click', () => confirmModal.style.display = 'flex');
        confirmNo.addEventListener('click', () => confirmModal.style.display = 'none');
        confirmYes.addEventListener('click', () => {
            sendWriteRequest('REG_RST', 1);
            confirmModal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target == confirmModal) confirmModal.style.display = 'none';
        });
    }

    async function sendWriteRequest(reg, val) {
        try {
            const response = await fetch('/api/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `reg=${encodeURIComponent(reg)}&val=${encodeURIComponent(val)}`
            });

            if (response.ok) {
                const config = registerConfig[reg];
                let displayVal = val;
                if (config && (config.type === 'select' || config.type === 'boolean')) {
                    displayVal = config.options[val];
                } else if (config && config.type === 'command') {
                    displayVal = 'اجرا شد';
                }
                showToast(`دستور ${reg} با موفقیت ارسال شد.`);
                setTimeout(fetchData, 500);
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
