document.addEventListener('DOMContentLoaded', function() {
    // --- Element Cache ---
    const UIElements = {
        pathVbusToChip: document.getElementById('path-vbus-to-chip'),
        pathChipToSys: document.getElementById('path-chip-to-sys'),
        pathChipToBat: document.getElementById('path-chip-to-bat'),
        pathBatToChip: document.getElementById('path-bat-to-chip'),
        vbusComponentRect: document.getElementById('vbus-component').querySelector('rect'),
        batteryComponent: document.getElementById('battery-component'),
        batteryRect: document.getElementById('battery-rect'),
        batteryCap: document.getElementById('battery-cap'),
        chipRect: document.getElementById('chip-rect'),
        faultIndicator: document.getElementById('fault-indicator'),
        tempIndicator: document.getElementById('temp-indicator'),
        tempIndicatorCircle: document.getElementById('temp-indicator-circle'),
        vbusVoltageText: document.getElementById('vbus-voltage-text'),
        sysVoltageText: document.getElementById('sys-voltage-text'),
        batteryVoltageText: document.getElementById('battery-voltage-text'),
        batteryCurrentText: document.getElementById('battery-current-text'),
        chipTempText: document.getElementById('chip-temp-text'),
        chargeStatusText: document.getElementById('charge-status-text'),
        overallStatusContainer: document.getElementById('overall-status-container'),
        overallStatusText: document.getElementById('overall-status-text'),
        overallStatusIndicator: document.getElementById('overall-status-indicator'),
        statusCharge: document.getElementById('status-charge'),
        statusAdapter: document.getElementById('status-adapter'),
        statusIbus: document.getElementById('status-ibus'),
        statusSys: document.getElementById('status-sys'),
    };

    // --- Main UI Update Function ---
    function updateUI(data) {
        updateTextInfo(data);
        updatePowerFlow(data);
    }

    function updateTextInfo(data) {
        UIElements.vbusVoltageText.textContent = `${(data.VBUS_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.sysVoltageText.textContent = `${(data.VSYS_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.batteryVoltageText.textContent = `${(data.VBAT_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.batteryCurrentText.textContent = `${(data.IBAT_ADC_15_0 / 1000).toFixed(2) || '--'} A`;
        UIElements.chipTempText.textContent = `${data.TDIE_ADC_15_0 || '--'} °C`;
        
        const statusInterpreters = {
            CHG_STAT_2_0: v => ["شارژ نمی‌شود", "قطره‌ای", "پیش‌شارژ", "شارژ سریع", "جریان پایانی", "رزرو شده", "تکمیلی", "کامل شد"][v] || "نامشخص",
            VBUS_STAT_3_0: v => ({0:"بدون ورودی",1:"SDP",2:"CDP",3:"DCP",4:"HVDCP",5:"ناشناخته",6:"غیراستاندارد",7:"OTG",8:"نامعتبر"})[v]||"رزرو شده",
        };

        const chargeStatus = statusInterpreters.CHG_STAT_2_0(data.CHG_STAT_2_0);
        UIElements.chargeStatusText.textContent = chargeStatus;
        UIElements.statusCharge.textContent = chargeStatus;
        UIElements.statusAdapter.textContent = statusInterpreters.VBUS_STAT_3_0(data.VBUS_STAT_3_0);
        UIElements.statusIbus.textContent = `${data.IBUS_ADC_15_0 || '--'} mA`;
        UIElements.statusSys.textContent = data.VSYS_STAT == 1 ? 'تنظیم ولتاژ' : 'عادی';
        
        const overallStatus = getOverallStatus(data);
        UIElements.overallStatusText.textContent = overallStatus.text;
        UIElements.overallStatusContainer.className = `mb-4 p-3 rounded-lg flex items-center justify-center space-x-3 space-x-reverse text-lg md:text-xl font-bold transition-all duration-300 ${overallStatus.colorClass}`;
    }

    function getOverallStatus(data) {
        const isCharging = data.CHG_STAT_2_0 >= 1 && data.CHG_STAT_2_0 <= 6;
        const isChargeDone = data.CHG_STAT_2_0 === 7;
        const isFault = data.TSHUT_STAT == 1 || data.VBUS_OVP_STAT == 1 || data.VSYS_OVP_STAT == 1 || data.VBAT_OVP_STAT == 1 || data.IBUS_OCP_STAT == 1;

        if (isFault) return { text: 'خطای سیستمی', colorClass: 'status-bg-error' };
        if (data.EN_OTG == 1) return { text: 'پاوربانک (OTG) فعال', colorClass: 'status-bg-info' };
        if (isCharging) return { text: 'در حال شارژ', colorClass: 'status-bg-success' };
        if (isChargeDone) return { text: 'شارژ کامل', colorClass: 'status-bg-info' };
        if (data.EN_HIZ == 1) return { text: 'ورودی غیرفعال (HIZ)', colorClass: 'status-bg-idle' };
        if (data.VBUS_PRESENT_STAT == 1) return { text: 'متصل به آداپتور', colorClass: 'status-bg-idle' };
        if (data.VBAT_PRESENT_STAT == 1) return { text: 'تغذیه از باتری', colorClass: 'status-bg-info' };
        return { text: 'خاموش / بدون تغذیه', colorClass: 'status-bg-idle' };
    }

    // --- Power Flow Logic ---

    function updatePowerFlow(data) {
        resetVisuals();
        updateVbusPath(data);
        updateVbatPath(data);
        updateSysPath(data); // تابع جدید برای مسیر SYS
        updateVbusIcon(data);
        updateVbatIcon(data);
        
        UIElements.faultIndicator.style.visibility = (data.VBUS_OVP_STAT || data.VSYS_OVP_STAT || data.VBAT_OVP_STAT || data.TSHUT_STAT) ? 'visible' : 'hidden';
        if (data.TS_COOL_STAT == 1 || data.TS_COLD_STAT == 1) {
            UIElements.tempIndicator.style.visibility = 'visible';
            UIElements.tempIndicatorCircle.style.fill = 'var(--info-color)';
        } else if (data.TS_HOT_STAT == 1 || data.TS_COLD_STAT == 1) {
            UIElements.tempIndicator.style.visibility = 'visible';
            UIElements.tempIndicatorCircle.style.fill = 'var(--warning-color)';
        }
    }
    
    function setPathStyle(path, { color, isAnimated, isReversed = false, isStatic = false }) {
        path.style.stroke = color;
        path.style.opacity = '1';
        // Reset classes
        path.classList.remove('flow-active', 'flow-otg', 'hiz-mode');
        
        if (isAnimated) {
            path.classList.add('flow-active');
            if (isReversed) path.classList.add('flow-otg');
        }
        if (isStatic) {
            path.classList.add('hiz-mode');
        }
    }

    function resetVisuals() {
        // اضافه کردن pathChipToSys به لیست ریست
        const paths = [UIElements.pathVbusToChip, UIElements.pathChipToSys, UIElements.pathChipToBat, UIElements.pathBatToChip];
        paths.forEach(p => {
            p.className.baseVal = 'power-path';
            p.style.stroke = 'transparent';
            p.style.opacity = '0';
        });
        
        UIElements.vbusComponentRect.style.stroke = '';
        UIElements.batteryRect.style.stroke = '';
        UIElements.batteryCap.style.stroke = '';
        UIElements.chipRect.style.stroke = '';
        
        UIElements.faultIndicator.style.visibility = 'hidden';
        UIElements.tempIndicator.style.visibility = 'hidden';
        UIElements.batteryComponent.style.opacity = '1';
    }

    // --- تابع جدید برای مسیر SYS ---
    function updateSysPath(data) {
        const path = UIElements.pathChipToSys;
        
        // اطمینان از وجود مقادیر برای جلوگیری از خطا
        const vbat = data.VBAT_ADC_15_0 || 0;
        const vsys = data.VSYS_ADC_15_0 || 0;

        // اگر سیستم کاملاً خاموش است (هر دو ولتاژ صفر یا بسیار کم)، چیزی رسم نکن
        if (vbat < 100 && vsys < 100) return;

        if (vbat > vsys) {
            // حالت 1: ولتاژ باتری بیشتر است -> مصرف از باتری
            // رنگ: نارنجی، جهت: به سمت SYS (پیش‌فرض)
            console.log("SYS Path: تغذیه از باتری (نارنجی)");
            setPathStyle(path, { color: 'orange', isAnimated: true, isReversed: false });
        } else {
            // حالت 2: ولتاژ باتری کمتر است (آداپتور وصل است) -> مصرف از آداپتور
            // رنگ: سبز، جهت: به سمت SYS (پیش‌فرض)
            console.log("SYS Path: تغذیه از آداپتور (سبز)");
            setPathStyle(path, { color: 'var(--success-color)', isAnimated: true, isReversed: false });
        }
    }

    function updateVbusPath(data) {
        const path = UIElements.pathVbusToChip;
        const d = data; // shorthand
        
        // Priority List: قطع, قرمز(رفت), قرمز(برگشت), خاکستری, صورتی, زرد(رفت), زرد(برگشت), بنفش, سبز, آبی
        
        // 1. قطع
        if ((d.VBUS_PRESENT_STAT == 0 && d.AC1_PRESENT_STAT == 0 && d.AC2_PRESENT_STAT == 0) && d.EN_OTG == 0) {
            console.log("VBUS Path: قطع");
        }
        // 2. قرمز (رفت)
        else if ((d.VBUS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.VAC_OVP_STAT == 1) && (d.VBUS_PRESENT_STAT == 1 || d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1) && d.EN_OTG == 0) {
            console.log("VBUS Path: قرمز (رفت)");
            setPathStyle(path, { color: 'var(--error-color)', isAnimated: true });
        }
        // 3. قرمز (برگشت)
        else if ((d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.VBATOTG_LOW_STAT == 1 || d.VBUS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.VAC_OVP_STAT == 1) && d.EN_OTG == 1 && d.CHG_STAT_2_0 == 0) {
            console.log("VBUS Path: قرمز (برگشت)");
            setPathStyle(path, { color: 'var(--error-color)', isAnimated: true, isReversed: true });
        }
        // 4. خاکستری (رفت و برگشت)
        else if (((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.SDRV_CTRL == 0 && (d.VBUS_PRESENT_STAT == 1 || d.EN_OTG == 1) && (d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.EN_HIZ == 1 || d.VSYS_SHORT_STAT == 1)) {
            console.log("VBUS Path: خاکستری (رفت و برگشت)");
            setPathStyle(path, { color: 'var(--idle-color)', isAnimated: false, isStatic: true });
        }
        // 5. صورتی (رفت و برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && ((d.ACRB1_STAT == 1 || d.ACRB2_STAT == 1) && (d.EN_ACDRV1 == 0 && d.EN_ACDRV2 == 0)) && d.CHG_STAT_2_0 == 0) {
            console.log("VBUS Path: صورتی (برگشت)");
            setPathStyle(path, { color: 'var(--secondary-color)', isAnimated: true, isReversed: true });
        }
        // 6. زرد (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1)) {
            console.log("VBUS Path: زرد (رفت)");
            setPathStyle(path, { color: 'var(--warning-color)', isAnimated: true });
        }
        // 7. زرد (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.EN_OTG == 1 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && (d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && d.VBUS_STAT_3_0 == 7) {
            console.log("VBUS Path: زرد (برگشت)");
            setPathStyle(path, { color: 'var(--warning-color)', isAnimated: true, isReversed: true });
        }
        // 8. بنفش (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && ((d.CHG_STAT_2_0 == 0 || d.CHG_STAT_2_0 == 7) || (d.CHG_TMR_STAT == 1 || d.TRICHG_TMR_STAT == 1 || d.PRECHG_TMR_STAT == 1 || d.TS_HOT_STAT == 1 || d.TS_COLD_STAT == 1 || (d.STOP_WD_CHG == 1 && d.WD_STAT == 1))) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0) {
            console.log("VBUS Path: بنفش (رفت)");
            setPathStyle(path, { color: '#a855f7', isAnimated: true });
        }
        // 9. سبز (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBUS Path: سبز (رفت)");
            setPathStyle(path, { color: 'var(--success-color)', isAnimated: true });
        }
        // 10. آبی (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.EN_OTG == 1 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.VBUS_STAT_3_0 == 7) {
            console.log("VBUS Path: آبی (برگشت)");
            setPathStyle(path, { color: 'var(--info-color)', isAnimated: true, isReversed: true });
        }
    }

    function updateVbatPath(data) {
        const pathToBat = UIElements.pathChipToBat;
        const pathFromBat = UIElements.pathBatToChip;
        const d = data; // shorthand

        // Priority List: قطع, خاکستری, قرمز, مشکی, صورتی, زرد(رفت), زرد(برگشت), آبی, بنفش, سبز
        
        // 1. قطع
        if (d.VBAT_PRESENT_STAT == 0 || d.SDRV_CTRL != 0 || (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && (d.VBUS_PRESENT_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && d.CHG_STAT_2_0 == 7 && d.EN_OTG == 0 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0)))) {
            console.log("VBAT Path: قطع");
        }
        // 2. خاکستری
        else if (d.IBAT_OCP_STAT == 1 && d.SFET_PRESENT == 1 && d.EN_BATOCP == 1) {
            console.log("VBAT Path: خاکستری");
            setPathStyle(pathFromBat, { color: 'var(--idle-color)', isAnimated: false, isStatic: true });
        }
        // 3. قرمز
        else if (((d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBAT_OCP_STAT == 1)) && d.VBAT_PRESENT_STAT == 1 && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: قرمز");
            setPathStyle(pathFromBat, { color: 'var(--error-color)', isAnimated: true, isStatic: false });
        }
        // 4. بنفش (برگشت)
        else if ((d.VBUS_PRESENT_STAT == 0 || (d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.EN_HIZ == 1 || d.VBATOTG_LOW_STAT == 1 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1)) && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && (d.EN_OTG == 0 || ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1))) && d.VBAT_PRESENT_STAT == 1) {
            console.log("VBAT Path: بنفش");
            setPathStyle(pathFromBat, { color: '#a855f7', isAnimated: true });
        }
        // 5. صورتی
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.EN_OTG == 1 && d.VBAT_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && ((d.ACRB1_STAT == 1 || d.ACRB2_STAT == 1) && (d.EN_ACDRV1 == 0 && d.EN_ACDRV2 == 0)) && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: صورتی");
            setPathStyle(pathFromBat, { color: 'var(--secondary-color)', isAnimated: true });
        }
        // 6. زرد (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && ((d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && (d.VSYS_ADC_15_0 > d.VBAT_ADC_15_0)) && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBAT Path: زرد (رفت)");
            setPathStyle(pathToBat, { color: 'var(--warning-color)', isAnimated: true });
        }
        // 7. زرد (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && ((d.EN_OTG == 1 && d.TS_COLD_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && (d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && d.CHG_STAT_2_0 == 0) || (d.VBUS_PRESENT_STAT == 1 && d.EN_OTG == 0 && d.TS_COLD_STAT == 0 && ((d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && (d.VSYS_ADC_15_0 <= d.VBAT_ADC_15_0)))) && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.SDRV_CTRL == 0) {
            if (d.EN_OTG == 1){
                console.log("VBAT Path: زرد (برگشت) حالت OTG");
            } else {
                console.log("VBAT Path: زرد (برگشت) حالت supplement.");
            };
            setPathStyle(pathFromBat, { color: 'var(--warning-color)', isAnimated: true });
        }
        // 8. آبی (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.EN_OTG == 1 && d.VBAT_PRESENT_STAT == 1 && d.VBUS_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBUS_STAT_3_0 == 7 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: آبی در vbat");
            setPathStyle(pathFromBat, { color: 'var(--info-color)', isAnimated: true });
        }
        // 9. مشکی
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.EN_OTG == 0 && d.VBAT_PRESENT_STAT == 1 && d.VBUS_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBUS_STAT_3_0 != 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && d.EN_CHG == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: مشکی");
            setPathStyle(pathFromBat, { color: '#333', isAnimated: false, isStatic: true });
        }
        // 10. سبز (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBAT Path: سبز");
            setPathStyle(pathToBat, { color: 'var(--success-color)', isAnimated: true });
        }
        else {
            console.log("bad working now.")
        }
    }

    function updateVbusIcon(data) {
        const d = data;
        if (d.VBUS_PRESENT_STAT == 0 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 0 && d.EN_ACDRV2 == 0))) {
            console.log("VBUS Icon: خاکستری");
            UIElements.vbusComponentRect.style.stroke = 'var(--idle-color)';
        } else if (((d.VBUS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.VAC_OVP_STAT == 1) && (d.VBUS_PRESENT_STAT == 1 || d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1)) || (d.EN_OTG == 1 && (d.VBAT_OVP_STAT == 1 || d.IBAT_OCP_STAT == 1 || d.TS_HOT_STAT == 1 || d.TS_COLD_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.TSHUT_STAT == 1 || d.VBATOTG_LOW_STAT == 1)) && d.SDRV_CTRL == 0) {
            console.log("VBUS Icon: قرمز");
            UIElements.vbusComponentRect.style.stroke = 'var(--error-color)';
        } else {
            // No log for default state
            UIElements.vbusComponentRect.style.stroke = 'var(--info-color)';
        }
    }

    function updateVbatIcon(data) {
        const d = data;
        const setBatteryStroke = (color) => {
            UIElements.batteryRect.style.stroke = color;
            UIElements.batteryCap.style.stroke = color;
        };

        if (d.VBAT_PRESENT_STAT == 0 || d.SDRV_CTRL != 0) {
            console.log("VBAT Icon: خاکستری");
            setBatteryStroke('var(--idle-color)');
            UIElements.batteryComponent.style.opacity = '0.3';
        } else if (((d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBAT_OCP_STAT == 1 || d.TSHUT_STAT == 1) || (d.EN_OTG == 1 && (d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.VBATOTG_LOW_STAT == 1)) || d.CHG_TMR_STAT == 1 || d.PRECHG_TMR_STAT == 1 || d.TRICHG_TMR_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && d.SDRV_CTRL == 0) {
            console.log("VBAT Icon: قرمز");
            setBatteryStroke('var(--error-color)');
        } else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && (d.VBUS_PRESENT_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && d.CHG_STAT_2_0 == 7 && d.EN_OTG == 0 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.SDRV_CTRL == 0 && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBAT Icon: سبز (شارژ کامل)");
            setBatteryStroke('var(--success-color)');
        } else {
            // No log for default state
            setBatteryStroke('var(--success-color)');
        }
    }

    // const loadingOverlay = document.getElementById('loading-overlay');
    // let isFirstLoad = true;

    async function fetchPageData() {
        if (typeof window.API_ENDPOINT === 'undefined') return;
        try {
            const [pageResponse, globalStatusResponse] = await Promise.all([
                fetch(window.API_ENDPOINT),
                fetch('/api/global_status')
            ]);

            if (!pageResponse.ok) throw new Error(`Page data HTTP error! status: ${pageResponse.status}`);
            if (!globalStatusResponse.ok) throw new Error(`Global status HTTP error! status: ${globalStatusResponse.status}`);

            const pageData = await pageResponse.json();
            globalRegisterState = await globalStatusResponse.json();
            
            currentPageData = { ...pageData, ...globalRegisterState };

            // if (isFirstLoad && loadingOverlay) {
            //     loadingOverlay.style.opacity = '0';
            //     setTimeout(() => loadingOverlay.style.display = 'none', 500);
            //     isFirstLoad = false;
            // }
            
            updateUI(currentPageData);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (isFirstLoad && loadingOverlay) loadingOverlay.textContent = 'خطا در اتصال';
        }
    }

    fetchPageData();
    setInterval(fetchPageData, 5000);
});
