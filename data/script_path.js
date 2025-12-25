document.addEventListener('DOMContentLoaded', function () {

    let globalRegisterState = {};
    let currentPageData = {}; // برای نگهداری آخرین داده‌های صفحه فعلی
    let vbusPathOverallStatus = { text: "", colorClass: "" };
    let vbatPathOverallStatus = { text: "", colorClass: "" };

    const interruptExplanations = {
        "IINDPM_EVENT": { title: "محدودیت جریان ورودی (IINDPM_STAT)", description: "جریان کشیده شده از ورودی به حد تنظیم شده (IINDPM) رسیده است. جریان شارژ برای محافظت از آداپتور کاهش یافته است." },
        "VINDPM_EVENT": { title: "محدودیت ولتاژ ورودی (VINDPM_STAT)", description: "ولتاژ ورودی به دلیل بار زیاد به حد تنظیم شده (VINDPM) افت کرده است. جریان شارژ برای تثبیت ولتاژ کاهش یافته است." },
        "WD_EXPIRED": { title: "تایمر Watchdog منقضی شد (WD_STAT)", description: "ارتباط با میکروکنترلر قطع شده و تنظیمات به حالت پیش‌فرض بازگشتند." },
        "POOR_SOURCE": { title: "منبع تغذیه ضعیف (POORSRC_FLAG)", description: "آداپتور متصل شده توانایی تامین جریان کافی را ندارد و غیرفعال شده است." },
        "PG_STATUS_CHANGE": { title: "تغییر وضعیت Power Good (PG_STAT)", description: "وضعیت پایداری منبع تغذیه ورودی تغییر کرده است (ممکن است متصل یا قطع شده باشد)." },
        "AC2_PRESENCE_CHANGE": { title: "تغییر وضعیت ورودی ۲ (AC2_PRESENT_STAT)", description: "یک آداپتور به ورودی شماره ۲ متصل یا از آن جدا شده است." },
        "AC1_PRESENCE_CHANGE": { title: "تغییر وضعیت ورودی ۱ (AC1_PRESENT_STAT)", description: "یک آداپتور به ورودی شماره ۱ متصل یا از آن جدا شده است." },
        "VBUS_PRESENCE_CHANGE": { title: "تغییر وضعیت VBUS (VBUS_PRESENT_STAT)", description: "ولتاژ روی خط اصلی VBUS برقرار یا قطع شده است." },
        "CHARGE_STATUS_CHANGE": { title: "تغییر وضعیت شارژ (CHG_STAT)", description: "مرحله فرآیند شارژ تغییر کرده است (مثلاً از شارژ سریع به خاتمه شارژ)." },
        "ICO_STATUS_CHANGE": { title: "تغییر وضعیت بهینه‌ساز جریان (ICO_STAT)", description: "الگوریتم بهینه‌ساز جریان ورودی (ICO) وضعیت خود را تغییر داده است (شروع، پایان)." },
        "VBUS_TYPE_CHANGE": { title: "تغییر نوع آداپتور (VBUS_STAT)", description: "نوع آداپتور متصل به ورودی تغییر کرده است (مثلاً از SDP به DCP)." },
        "TREG_EVENT": { title: "محدودیت حرارتی (TREG_STAT)", description: "دمای داخلی چیپ بالا رفته و جریان شارژ برای محافظت کاهش یافته است." },
        "VBAT_PRESENCE_CHANGE": { title: "تغییر وضعیت باتری (VBAT_PRESENT_STAT)", description: "باتری به دستگاه متصل یا از آن جدا شده است." },
        "BC12_DONE": { title: "پایان تشخیص BC1.2 (BC1.2_DONE_STAT)", description: "فرآیند شناسایی نوع استاندارد آداپتور (BC1.2) به پایان رسیده است." },
        "DPDM_DONE": { title: "پایان تشخیص D+/D- (DPDM_STAT)", description: "فرآیند کلی تشخیص نوع آداپتور از طریق پین‌های D+/D- به پایان رسیده است." },
        "ADC_DONE": { title: "پایان تبدیل ADC (ADC_DONE_STAT)", description: "یک تبدیل آنالوگ به دیجیتال در حالت تک-نمونه‌ای (One-shot) به پایان رسیده است." },
        "VSYS_REG_CHANGE": { title: "تغییر وضعیت رگولاسیون سیستم (VSYS_STAT)", description: "سیستم وارد حالت رگولاسیون حداقل ولتاژ (VSYSMIN) شده یا از آن خارج شده است." },
        "FAST_CHARGE_TIMEOUT": { title: "خطای تایمر شارژ سریع (CHG_TMR_STAT)", description: "مدت زمان مجاز برای مرحله شارژ سریع به پایان رسیده و شارژ متوقف شده است." },
        "TRICKLE_CHARGE_TIMEOUT": { title: "خطای تایمر شارژ قطره‌ای (TRICHG_TMR_STAT)", description: "مدت زمان مجاز برای مرحله شارژ قطره‌ای (برای باتری‌های بسیار خالی) به پایان رسیده است." },
        "PRECHARGE_TIMEOUT": { title: "خطای تایمر پیش‌شارژ (PRECHG_TMR_STAT)", description: "مدت زمان مجاز برای مرحله پیش‌شارژ به پایان رسیده و شارژ متوقف شده است." },
        "TOPOFF_TIMEOUT": { title: "پایان تایمر شارژ تکمیلی (TOPOFF_TMR_FLAG)", description: "مدت زمان شارژ تکمیلی (Top-off) پس از اتمام شارژ اصلی، به پایان رسیده است." },
        "VBAT_LOW_FOR_OTG": { title: "ولتاژ باتری برای پاوربانک کم است (VBATOTG_LOW_STAT)", description: "ولتاژ باتری برای فعال کردن حالت پاوربانک (OTG) کافی نیست." },
        "TS_COLD_EVENT": { title: "دمای باتری: سرد (TS_COLD_STAT)", description: "دمای باتری وارد محدوده سرد شده و شارژ طبق پروفایل JEITA متوقف یا محدود شده است." },
        "TS_COOL_EVENT": { title: "دمای باتری: خنک (TS_COOL_STAT)", description: "دمای باتری وارد محدوده خنک شده و جریان شارژ طبق پروفایل JEITA کاهش یافته است." },
        "TS_WARM_EVENT": { title: "دمای باتری: گرم (TS_WARM_STAT)", description: "دمای باتری وارد محدوده گرم شده و ولتاژ شارژ طبق پروفایل JEITA کاهش یافته است." },
        "TS_HOT_EVENT": { title: "دمای باتری: داغ (TS_HOT_STAT)", description: "دمای باتری وارد محدوده داغ شده و شارژ برای ایمنی متوقف شده است." },
        "IBAT_REG_EVENT": { title: "محدودیت جریان دشارژ (IBAT_REG_STAT)", description: "جریان دشارژ باتری در حالت پاوربانک (OTG) به حد مجاز رسیده و محدود شده یا از آن خارج شده است." },
        "VBUS_OVP_FAULT": { title: "خطای ولتاژ بالای ورودی (VBUS_OVP_STAT)", description: "ولتاژ آداپتور از حد مجاز فراتر رفته است. شارژ برای محافظت متوقف شد." },
        "VBAT_OVP_FAULT": { title: "خطای ولتاژ بالای باتری (VBAT_OVP_STAT)", description: "ولتاژ باتری از حد مجاز تنظیم شده فراتر رفته است. شارژ برای محافظت متوقف شد." },
        "IBUS_OCP_FAULT": { title: "خطای جریان بالای ورودی (IBUS_OCP_STAT)", description: "جریان کشیده شده از آداپتور از حد بحرانی فراتر رفته است. مبدل برای محافظت غیرفعال شد." },
        "IBAT_OCP_FAULT": { title: "خطای جریان بالای باتری (IBAT_OCP_STAT)", description: "جریان کشیده شده از باتری (در حالت دشارژ) از حد بحرانی فراتر رفته است." },
        "CONV_OCP_FAULT": { title: "خطای جریان بالای مبدل (CONV_OCP_STAT)", description: "جریان داخلی مبدل DC-DC از حد مجاز فراتر رفته است." },
        "VAC2_OVP_FAULT": { title: "خطای ولتاژ بالای ورودی ۲ (VAC2_OVP_STAT)", description: "ولتاژ روی ورودی شماره ۲ از حد مجاز فراتر رفته است." },
        "VAC1_OVP_FAULT": { title: "خطای ولتاژ بالای ورودی ۱ (VAC1_OVP_STAT)", description: "ولتاژ روی ورودی شماره ۱ از حد مجاز فراتر رفته است." },
        "VSYS_SHORT_FAULT": { title: "خطای اتصال کوتاه سیستم (VSYS_SHORT_STAT)", description: "اتصال کوتاه در خروجی سیستم (SYS) تشخیص داده شده و جریان محدود شده است." },
        "VSYS_OVP_FAULT": { title: "خطای ولتاژ بالای سیستم (VSYS_OVP_STAT)", description: "ولتاژ خروجی سیستم (SYS) از حد مجاز فراتر رفته است. مبدل برای محافظت متوقف شد." },
        "OTG_OVP_FAULT": { title: "خطای ولتاژ بالای خروجی OTG (OTG_OVP_STAT)", description: "ولتاژ خروجی در حالت پاوربانک (OTG) از حد مجاز فراتر رفته است." },
        "OTG_UVP_FAULT": { title: "خطای ولتاژ پایین خروجی OTG (OTG_UVP_STAT)", description: "ولتاژ خروجی در حالت پاوربانک (OTG) دچار افت شدید شده است." },
        "THERMAL_SHUTDOWN": { title: "خاموشی حرارتی (TSHUT_STAT)", description: "دمای چیپ به حد بحرانی رسیده و دستگاه برای جلوگیری از آسیب، به طور کامل خاموش شده است." },
        "FLAG_READ_ERROR": { title: "خطا در خواندن وقفه", description: "ارتباط با چیپ برای خواندن دلیل وقفه ناموفق بود." },
        "UNKNOWN_INTERRUPT": { title: "وقفه ناشناخته", description: "یک وقفه رخ داده است اما دلیل آن توسط نرم‌افزار قابل شناسایی نیست." }
    };

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
        updatePowerFlow(data);
        updateTextInfo(data);
    }

    function updateTextInfo(data) {
        UIElements.vbusVoltageText.textContent = `${(data.VBUS_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.sysVoltageText.textContent = `${(data.VSYS_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.batteryVoltageText.textContent = `${(data.VBAT_ADC_15_0 / 1000).toFixed(2) || '--'} V`;
        UIElements.batteryCurrentText.textContent = `${(data.IBAT_ADC_15_0 / 1000).toFixed(2) || '--'} A`;
        UIElements.chipTempText.textContent = `${data.TDIE_ADC_15_0 || '--'} °C`;

        const statusInterpreters = {
            CHG_STAT_2_0: v => ["شارژ نمی‌شود", "قطره‌ای", "پیش‌شارژ", "شارژ سریع", "جریان پایانی", "رزرو شده", "تکمیلی", "کامل شد"][v] || "نامشخص",
            VBUS_STAT_3_0: v => ({ 0: "بدون ورودی", 1: "SDP", 2: "CDP", 3: "DCP", 4: "HVDCP", 5: "ناشناخته", 6: "غیراستاندارد", 7: "OTG", 8: "نامعتبر" })[v] || "رزرو شده",
        };

        const chargeStatus = statusInterpreters.CHG_STAT_2_0(data.CHG_STAT_2_0);
        UIElements.chargeStatusText.textContent = chargeStatus;
        UIElements.statusCharge.textContent = chargeStatus;
        UIElements.statusAdapter.textContent = statusInterpreters.VBUS_STAT_3_0(data.VBUS_STAT_3_0);
        UIElements.statusIbus.textContent = `${data.IBUS_ADC_15_0 || '--'} mA`;
        UIElements.statusSys.textContent = data.VSYS_STAT == 1 ? 'تنظیم ولتاژ' : 'عادی';

        const overallStatus = getOverallStatus();
        UIElements.overallStatusText.textContent = overallStatus.text;
        UIElements.overallStatusContainer.className = `mb-4 p-3 rounded-lg flex items-center justify-center space-x-3 space-x-reverse text-lg md:text-xl font-bold transition-all duration-300 ${overallStatus.colorClass}`;
    }

    function getOverallStatus() {
        // Color priority order: error > warning > success > info > idle
        const colorPriority = {
            'status-bg-error': 6,
            'status-bg-danger': 5,
            'status-bg-idle': 4,
            'status-bg-warning': 3,
            'status-bg-info': 2,
            'status-bg-success': 1,
        };

        // Combine text messages from both paths
        const messages = [];
        if (vbusPathOverallStatus.text) {
            messages.push(vbusPathOverallStatus.text);
        }
        if (vbatPathOverallStatus.text) {
            messages.push(vbatPathOverallStatus.text);
        }

        const combinedText = messages.join(' | ');

        // Choose colorClass based on importance (highest priority wins)
        const vbusPriority = colorPriority[vbusPathOverallStatus.colorClass] || 0;
        const vbatPriority = colorPriority[vbatPathOverallStatus.colorClass] || 0;

        let selectedColorClass;
        if (vbusPriority >= vbatPriority) {
            selectedColorClass = vbusPathOverallStatus.colorClass || 'status-bg-idle';
        } else {
            selectedColorClass = vbatPathOverallStatus.colorClass || 'status-bg-idle';
        }

        // Fallback for empty status
        if (!combinedText) {
            return { text: 'خاموش / بدون تغذیه', colorClass: 'status-bg-idle' };
        }

        return { text: combinedText, colorClass: selectedColorClass };
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
            vbusPathOverallStatus = { text: "آداپتور حضور ندارد.", colorClass: "status-bg-idle" };
        }
        // 2. قرمز (رفت)
        else if ((d.VBUS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.VAC_OVP_STAT == 1 || (((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.PG_STAT == 0)) && (d.VBUS_PRESENT_STAT == 1 || d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1) && d.EN_OTG == 0) {
            console.log("VBUS Path: قرمز (رفت)");
            vbusPathOverallStatus = { text: "آداپتور حضور دارد اما خطایی مربوط به آن رخ داده", colorClass: "status-bg-error" };
            if (d.VBUS_OVP_STAT) {
                vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت خطای اضافه ولتاژ ورودی از آن استفاده نمیشود.", colorClass: "status-bg-error" };
            }
            else if (d.IBUS_OCP_STAT) {
                vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت جریان کشی بیش از حد از ورودی از آن استفاده نمیشود.", colorClass: "status-bg-error" };
            }
            else if (d.VAC_OVP_STAT) {
                vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت ولتاژ بیش از حد در جفت ماسفت ها از آن استفاده نمیشود.", colorClass: "status-bg-error" };
            }
            else if (d.PG_STAT) {
                vbusPathOverallStatus = { text: "آداپتور حضور دارد اما ضعیف است.", colorClass: "status-bg-error" };
            }

            setPathStyle(path, { color: 'var(--error-color)', isAnimated: true });
        }
        // 3. قرمز (برگشت)
        else if ((d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.VBATOTG_LOW_STAT == 1 || d.VBUS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.VAC_OVP_STAT == 1) && d.EN_OTG == 1) {
            console.log("VBUS Path: قرمز (برگشت)");
            vbusPathOverallStatus = { text: "در حالت OTG اما خطاهای مربوط به OTG", colorClass: "status-bg-error" };
            if (d.TS_COLD_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت دمای سرد باطری موقتا خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.TS_HOT_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت دمای زیاد باطری موقتا خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.OTG_OVP_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت خطای اضافه ولتاژ خروجی خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.OTG_UVP_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت افت جدید ولتاژ خروجی خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.VBATOTG_LOW_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت کاهش شدید ولتاژ باطری خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.VBUS_OVP_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت اضافه خطای اضافه ولتاژ خروجی خاموش شده.", colorClass: "status-bg-error" };
            }
            else if (d.IBUS_OCP_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی در حالت جریان بیش از حد ورودی.", colorClass: "status-bg-error" };
            }
            else if (d.VAC_OVP_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت خطای اضافه ولتاژ جفت ماسفت ها خاموش شده.", colorClass: "status-bg-error" };
            }
            setPathStyle(path, { color: 'var(--error-color)', isAnimated: true, isReversed: true });
        }
        // 4. خاکستری (رفت و برگشت)
        else if (((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.SDRV_CTRL == 0 && (d.VBUS_PRESENT_STAT == 1 || (d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1) || d.EN_OTG == 1) && (d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.TSHUT_STAT == 1 || d.EN_HIZ == 1 || d.VSYS_SHORT_STAT == 1)) {
            console.log("VBUS Path: خاکستری (رفت و برگشت)");
            vbusPathOverallStatus = { text: "آداپتور حضور دارد یا در حالت OTG اما مبدل بدلیل خطاهایی که متناسب به vbus یا otg نیست خاموش میشود", colorClass: "status-bg-error" };
            if (d.EN_OTG == 1) {
                if (d.VSYS_OVP_STAT == 1) {
                    vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت اضافه ولتاژ SYS خاموش شده.", colorClass: "status-bg-error" };
                }
                else if (d.VBAT_OVP_STAT == 1) {
                    vbusPathOverallStatus = { text: "درحالت OTG اما خروجی به علت اضافه ولتاژ باطری خاموش شده.", colorClass: "status-bg-error" };
                }
                else if (d.TSHUT_STAT == 1) {
                    vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت گرمای زیاد IC خاموش شده.", colorClass: "status-bg-error" };
                }
                else if (d.EN_HIZ == 1) {
                    vbusPathOverallStatus = { text: "درحالت OTG اما خروجی به علت EN_HIZ خاموش شده.", colorClass: "status-bg-error" };
                }
                else if (d.VSYS_SHORT_STAT == 1) {
                    vbusPathOverallStatus = { text: "در حالت OTG اما خروجی به علت خطای اتصال کوتاه SYS خاموش شده.", colorClass: "status-bg-error" };
                }
            }
            else if (d.VBUS_PRESENT_STAT == 1 || (d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1)) {
                if (d.VSYS_OVP_STAT == 1) {
                    vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت خطای اضافه ولتاژ SYS از آن استفاده نمیشود.", colorClass: "status-bg-error" };
                }
                else if (d.VBAT_OVP_STAT == 1) {
                    vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت خطای اضافه ولتاژِ باطری از آن استفاده نمیشود.", colorClass: "status-bg-error" };
                }
                else if (d.TSHUT_STAT == 1) {
                    vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت گرمای زیاد IC از آن استفاده نمیشود.", colorClass: "status-bg-error" };
                }
                else if (d.EN_HIZ == 1) {
                    vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت EN_HIZ از آن استفاده نمیشود.", colorClass: "status-bg-error" };
                }
                else if (d.VSYS_SHORT_STAT == 1) {
                    vbusPathOverallStatus = { text: "آداپتور حضور دارد اما به علت خطای اتصال کوتاه SYS از آن استفاده نمیشود.", colorClass: "status-bg-error" };
                }
            }
            setPathStyle(path, { color: 'var(--idle-color)', isAnimated: false, isStatic: true });
        }
        // 5. صورتی (رفت و برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && ((d.ACRB1_STAT == 1 || d.ACRB2_STAT == 1) && (d.EN_ACDRV1 == 0 && d.EN_ACDRV2 == 0)) && d.CHG_STAT_2_0 == 0) {
            console.log("VBUS Path: صورتی (رفت و برگشت)");
            vbusPathOverallStatus = { text: "در حالت OTG یا غیر OTG اما بسته بودن جفت ماسفت ها", colorClass: "status-bg-idle" };
            if (d.EN_OTG == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما بسته بودن جفت ماسفت خروجی", colorClass: "status-bg-idle" };
                setPathStyle(path, { color: 'var(--secondary-color)', isAnimated: true, isReversed: true });
            }
            else if (d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1) {
                vbusPathOverallStatus = { text: "آداپتور حضور دارد اما جفت ماسفت ها بسته اند", colorClass: "status-bg-idle" };
                setPathStyle(path, { color: 'var(--secondary-color)', isAnimated: true, isReversed: false });
            }
        }
        // 6. زرد (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1)) {
            console.log("VBUS Path: زرد (رفت)");
            vbusPathOverallStatus = { text: "در حال تغذیه SYS و BAT اما در محدودیت منابع ورودی", colorClass: "status-bg-warning" };
            setPathStyle(path, { color: 'var(--warning-color)', isAnimated: true });
            if (d.VINDPM_STAT == 1) {
                vbusPathOverallStatus = { text: "استفاده از آداپتور اما در حال تنظیم ولتاژ ورودی.", colorClass: "status-bg-warning" };
            }
            else if (d.IINDPM_STAT == 1) {
                vbusPathOverallStatus = { text: "استفاده از آداپتور اما درحال تنظیم جریان ورودی", colorClass: "status-bg-warning" };
            }
            else if (d.TREG_STAT == 1) {
                vbusPathOverallStatus = { text: "استفاده از آداپتور اما درحال کاهش جریان شارژ برای خنک کرد IC", colorClass: "status-bg-warning" };
            }
        }
        // 7. زرد (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.EN_OTG == 1 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && (d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && d.VBUS_STAT_3_0 == 7) {
            console.log("VBUS Path: زرد (برگشت)");
            vbusPathOverallStatus = { text: "در حالت OTG اما در محدودیت جریان", colorClass: "status-bg-warning" };
            if (d.IINDPM_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما در حال تنظیم نگهداشتن جریان خروجی", colorClass: "status-bg-warning" };
            }
            else if (d.IBAT_REG_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما در حال تنظیم نگهداشتن جریان کششی از باطری", colorClass: "status-bg-warning" };
            }
            else if (d.TREG_STAT == 1) {
                vbusPathOverallStatus = { text: "در حالت OTG اما در حال رگوله کردن جریان برای خنک کردن IC", colorClass: "status-bg-warning" };
            }
            setPathStyle(path, { color: 'var(--warning-color)', isAnimated: true, isReversed: true });
        }
        // 8. بنفش (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && ((d.CHG_STAT_2_0 == 0 || d.CHG_STAT_2_0 == 7) || (d.CHG_TMR_STAT == 1 || d.TRICHG_TMR_STAT == 1 || d.PRECHG_TMR_STAT == 1 || d.TS_HOT_STAT == 1 || d.TS_COLD_STAT == 1 || (d.STOP_WD_CHG == 1 && d.WD_STAT == 1))) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0) {
            console.log("VBUS Path: بنفش (رفت)");
            vbusPathOverallStatus = { text: "استفاده VBUS فقط برای SYS", colorClass: "status-bg-warning" };
            if (d.STOP_WD_CHG == 1 && d.WD_STAT == 1) {
                vbusPathOverallStatus = { text: "باطری به دلیل عدم ریست WD_STAT شارژ نمیشود.", colorClass: "status-bg-warning" };
            }
            else if (d.CHG_TMR_STAT == 1) {
                vbusPathOverallStatus = { text: "به علت طولانی شدن مرحله fast-charge باطری شارژ نمیشود.", colorClass: "status-bg-warning" };
            }
            else if (d.TRICHG_TMR_STAT == 1) {
                vbusPathOverallStatus = { text: "به علت طولانی شدن مرحله tricle باطری شارژ نمیشود.", colorClass: "status-bg-warning" };
            }
            else if (d.PRECHG_TMR_STAT == 1) {
                vbusPathOverallStatus = { text: "به علت طولانی شدن مرحله پیش-شارژ باطری شارژ نمیشود.", colorClass: "status-bg-warning" };
            }
            setPathStyle(path, { color: '#a855f7', isAnimated: true });
        }
        // 9. سبز (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBUS Path: سبز (رفت)");
            vbusPathOverallStatus = { text: "درحال تغذیه SYS و شارژ باطری.", colorClass: "status-bg-success" };
            setPathStyle(path, { color: 'var(--success-color)', isAnimated: true });
        }
        // 10. آبی (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.EN_OTG == 1 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.VBUS_STAT_3_0 == 7) {
            console.log("VBUS Path: آبی (برگشت)");
            vbusPathOverallStatus = { text: "در حالت OTG", colorClass: "status-bg-info" };
            setPathStyle(path, { color: 'var(--info-color)', isAnimated: true, isReversed: true });
        }
        else {
            console.log("bad working now.");
            vbusPathOverallStatus = { text: "bad working now.", colorClass: "status-bg-danger" };
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
            vbatPathOverallStatus = { text: "قطع", colorClass: "status-bg-error" };
            if (d.VBAT_PRESENT_STAT == 0) {
                vbatPathOverallStatus = { text: "باطری حضور ندارد.", colorClass: "status-bg-idle" };
            }
            else if (d.SDRV_CTRL != 0) {
                vbatPathOverallStatus = { text: "از باطری علت خاموش بودن SDRV_CTRL استفاده نمیشود.", colorClass: "status-bg-idle" };
            }
            else {
                vbatPathOverallStatus = { text: "باطری پر است و شارژ نمیشود.", colorClass: "status-bg-info" };
            }
        }
        // 2. خاکستری
        else if (d.IBAT_OCP_STAT == 1 && d.SFET_PRESENT == 1 && d.EN_BATOCP == 1) {
            console.log("VBAT Path: خاکستری");
            vbatPathOverallStatus = { text: "به علت خطای جریان زیاد کششی از باطری، باطری غیرفعال شده.", colorClass: "status-bg-error" };
            setPathStyle(pathFromBat, { color: 'var(--idle-color)', isAnimated: false, isStatic: true });
        }
        // 3. قرمز
        else if ((d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBAT_OCP_STAT == 1 || d.CHG_TMR_STAT == 1 || d.TRICHG_TMR_STAT == 1 || d.PRECHG_TMR_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: قرمز");
            vbatPathOverallStatus = { text: "باطری وجود دارد و خطاهای مربوط به باطری رخ داده", colorClass: "status-bg-error" };
            if (d.TS_COLD_STAT == 1) {
                vbatPathOverallStatus = { text: "دمای باطری خیلی پایین است.", colorClass: "status-bg-error" };
            }
            else if (d.TS_HOT_STAT == 1) {
                vbatPathOverallStatus = { text: "دمای باطری خیلی بالا است.", colorClass: "status-bg-error" };
            }
            else if (d.VBAT_OVP_STAT == 1) {
                vbatPathOverallStatus = { text: "ولتاژ باطری بیش از حد است.", colorClass: "status-bg-error" };
            }
            else if (d.IBAT_OCP_STAT == 1) {
                vbatPathOverallStatus = { text: "جریان کششی از باطری بیش از حد است.", colorClass: "status-bg-error" };
            }
            else if (d.CHG_TMR_STAT == 1) {
                vbatPathOverallStatus = { text: "مرحله شارژ سریع بیش از حد طول کشیده.", colorClass: "status-bg-error" };
            }
            else if (d.TRICHG_TMR_STAT == 1) {
                vbatPathOverallStatus = { text: "مرحله شارژ قطره ایی بیش از حد طول کشیده.", colorClass: "status-bg-error" };
            }
            else if (d.PRECHG_TMR_STAT == 1) {
                vbatPathOverallStatus = { text: "مرحله پیش-شارژ بیش از حد طول کشیده.", colorClass: "status-bg-error" };
            }

            setPathStyle(pathFromBat, { color: 'var(--error-color)', isAnimated: true, isStatic: false });
        }
        // 4. بنفش (برگشت)
        else if ((d.VBUS_PRESENT_STAT == 0 || (d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || (d.EN_OTG == 0 && (((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.PG_STAT == 0)) || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || d.EN_HIZ == 1 || d.VBATOTG_LOW_STAT == 1 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1)) && d.SDRV_CTRL == 0 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.EN_OTG == 0 || ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1))) && d.VBAT_PRESENT_STAT == 1) {
            console.log("VBAT Path: بنفش");
            vbatPathOverallStatus = { text: "حالت فقط باطری، خطاهای مربوط به باطری رخ نداده اما باطری در حال تغذیه SYS است", colorClass: "status-bg-error" };
            if (d.VBUS_PRESENT_STAT == 0) {
                vbatPathOverallStatus = { text: "باطری به علت نبود ولتاژ ورودی در حال تغذیه SYS است.", colorClass: "status-bg-idle" };
            }
            else if (d.VBUS_OVP_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت خطای اضافه ولتاژ ورودی در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.VSYS_OVP_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت خطای اضافه ولتاژ SYS در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.IBUS_OCP_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت جریان کشی زیاد از VBUS در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if ((d.EN_OTG == 0 && (((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.PG_STAT == 0))) {
                vbatPathOverallStatus = { text: "باطری به دلیل آداپتور ضعیف در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.TSHUT_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به دلیل گرمای بحرانی IC در حالت تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.OTG_OVP_STAT == 1) {
                vbatPathOverallStatus = { text: "در حالت OTG اما خطای اضافه ولتاژ خروجی", colorClass: "status-bg-error" };
            }
            else if (d.OTG_UVP_STAT == 1) {
                vbatPathOverallStatus = { text: "در حالت OTG اما افت شدید ولتاژ خروجی", colorClass: "status-bg-error" };
            }
            else if (d.EN_HIZ == 1) {
                vbatPathOverallStatus = { text: "باطری به علت EN_HIZ در حال تغذیه SYS.", colorClass: "status-bg-error" };
            }
            else if (d.VAC_OVP_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت خطای اضافه ولتاژ در جفت ماسفت ها در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.VSYS_SHORT_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت خطای اتصال کوتاه SYS در حال تغذیه SYS است.", colorClass: "status-bg-error" };
            }
            else if (d.VBATOTG_LOW_STAT == 1) {
                vbatPathOverallStatus = { text: "در حالت OTG اما به علت خطای عدم ولتاژ کافی خروجی خاموش شده.", colorClass: "status-bg-error" };
            }
            setPathStyle(pathFromBat, { color: '#a855f7', isAnimated: true });
        }
        // 5. صورتی
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && ((d.ACRB1_STAT == 1 || d.ACRB2_STAT == 1) && (d.EN_ACDRV1 == 0 && d.EN_ACDRV2 == 0)) && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: صورتی");
            vbatPathOverallStatus = { text: "بسته بودن جفت ماسفت ها", colorClass: "status-bg-idle" };
            if (d.EN_OTG == 1) {
                vbatPathOverallStatus = { text: "در حالت OTG اما بسته بودن جفت ماسفت ها.", colorClass: "status-bg-idle" };
            }
            else if (d.AC1_PRESENT_STAT == 1 || d.AC2_PRESENT_STAT == 1) {
                vbatPathOverallStatus = { text: "باطری به علت بسته بودن جفت ماسفت ها در حال تغذیه SYS است.", colorClass: "status-bg-idle" };
            }

            setPathStyle(pathFromBat, { color: 'var(--secondary-color)', isAnimated: true });
        }
        // 6. زرد (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && ((d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && (d.VSYS_ADC_15_0 > d.VBAT_ADC_15_0)) && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBAT Path: زرد (رفت)");
            vbatPathOverallStatus = { text: "آداپتور وجود دارد اما در حالت محدودیت منابع ورودی", colorClass: "status-bg-warning" };
            if (d.VINDPM_STAT == 1) {
                vbatPathOverallStatus = { text: "در حال شارژ باطری اما جریان شارژ باطری به دلیل تنظیم ولتاژ ورودی کاهش پیدا میکند.", colorClass: "status-bg-warning" };
            }
            else if (d.IINDPM_STAT == 1) {
                vbatPathOverallStatus = { text: "در حال شارژ باطری اما جریان باطری دلیل تنظیم جریان کشی از ورودی  کاهش پیدا میکند.", colorClass: "status-bg-warning" };
            }
            else if (d.TREG_STAT == 1) {
                vbatPathOverallStatus = { text: "در حال شارژ باطری اما جریان شارژ باطری به دلیل تنظیم دمای IC کاهش پیدا میکند.", colorClass: "status-bg-warning" };
            }

            setPathStyle(pathToBat, { color: 'var(--warning-color)', isAnimated: true });
        }
        // 7. زرد (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBAT_PRESENT_STAT == 1 && ((d.EN_OTG == 1 && d.TS_COLD_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && (d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && d.CHG_STAT_2_0 == 0) || (d.VBUS_PRESENT_STAT == 1 && d.PG_STAT == 1 && d.EN_OTG == 0 && d.TS_COLD_STAT == 0 && ((d.VINDPM_STAT == 1 || d.IINDPM_STAT == 1 || d.IBAT_REG_STAT == 1 || d.TREG_STAT == 1) && ((d.IBAT_ADC_15_0 <= 0) || (d.VSYS_ADC_15_0 <= d.VBAT_ADC_15_0))))) && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.SDRV_CTRL == 0) {
            if (d.EN_OTG == 1) {
                console.log("VBAT Path: زرد (برگشت) حالت OTG");
                vbatPathOverallStatus = { text: "در حالت OTG و رسیدن به حد مجاز استفاده از باطری یا در حالت آداپتور و رسیدن به حد مجاز استفاده از آداپتور", colorClass: "status-bg-warning" };
                if (d.IBAT_REG_STAT == 1) {
                    vbatPathOverallStatus = { text: "در حالت OTG اما درحال تنظیم جریان کششی از باطری.", colorClass: "status-bg-warning" };
                }
                else if (d.IINDPM_STAT == 1) {
                    vbatPathOverallStatus = { text: "در حالت OTG اما در حال تنظیم جریان خروجی:", colorClass: "status-bg-warning" };
                }
                else if (d.TREG_STAT == 1) {
                    vbatPathOverallStatus = { text: "در حالت OTG اما درحال تنظیم جریان خروجی به دلیل دمای بیش از حد IC.", colorClass: "status-bg-warning" };
                }
            } else {
                console.log("VBAT Path: زرد (برگشت) حالت supplement.");
                vbatPathOverallStatus = { text: "زرد (برگشت) حالت supplement", colorClass: "status-bg-warning" };
                if (d.VINDPM_STAT == 1) {
                    vbatPathOverallStatus = { text: "به علت افت ولتاژ منبع ورودی دستگاه وارد حالت کمکی از باطری شده.", colorClass: "status-bg-warning" };
                }
                else if (d.IINDPM_STAT == 1) {
                    vbatPathOverallStatus = { text: "به علت رسیدن به حداکثر جریان مجاز ورودی دستگاه وارد حالت کمکی از باطری شده.", colorClass: "status-bg-warning" };
                }
                else if (d.TREG_STAT == 1) {
                    vbatPathOverallStatus = { text: "به علت دمای بیش از حد IC دستگاه وارد حالت کمکی از باطری شده.", colorClass: "status-bg-warning" };
                }
            };
            setPathStyle(pathFromBat, { color: 'var(--warning-color)', isAnimated: true });
        }
        // 8. آبی (برگشت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.EN_OTG == 1 && d.VBAT_PRESENT_STAT == 1 && d.VBUS_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBUS_STAT_3_0 == 7 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.CHG_STAT_2_0 == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: آبی در vbat");
            vbatPathOverallStatus = { text: "در حالت OTG", colorClass: "status-bg-info" };
            setPathStyle(pathFromBat, { color: 'var(--info-color)', isAnimated: true });
        }
        // 9. مشکی
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.EN_OTG == 0 && d.VBAT_PRESENT_STAT == 1 && d.VBUS_PRESENT_STAT == 1 && d.VBATOTG_LOW_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && d.TSHUT_STAT == 0 && d.OTG_OVP_STAT == 0 && d.OTG_UVP_STAT == 0 && d.VBUS_STAT_3_0 != 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && d.CHG_STAT_2_0 == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && d.SDRV_CTRL == 0) {
            console.log("VBAT Path: مشکی");
            vbatPathOverallStatus = { text: "عملیات شارژ توسط کاربر لغو شده.", colorClass: "status-bg-warning" };
            setPathStyle(pathFromBat, { color: '#333', isAnimated: false, isStatic: true });
        }
        // 10. سبز (رفت)
        else if (!(d.VBUS_OVP_STAT == 1 || d.VSYS_OVP_STAT == 1 || d.VBAT_OVP_STAT == 1 || d.IBUS_OCP_STAT == 1 || d.PG_STAT == 0 || d.TSHUT_STAT == 1 || d.OTG_OVP_STAT == 1 || d.OTG_UVP_STAT == 1 || (d.EN_OTG == 1 && (d.TS_COLD_STAT == 1 || d.TS_HOT_STAT == 1)) || d.EN_HIZ == 1 || d.SDRV_CTRL != 0 || d.VAC_OVP_STAT == 1 || d.VSYS_SHORT_STAT == 1) && d.VBUS_PRESENT_STAT == 1 && d.VBAT_PRESENT_STAT == 1 && d.EN_OTG == 0 && ((d.ACRB1_STAT == 0 && d.ACRB2_STAT == 0) || (d.EN_ACDRV1 == 1 || d.EN_ACDRV2 == 1)) && (d.CHG_STAT_2_0 != 0 && d.CHG_STAT_2_0 != 7) && d.CHG_TMR_STAT == 0 && d.TRICHG_TMR_STAT == 0 && d.PRECHG_TMR_STAT == 0 && d.TS_COLD_STAT == 0 && d.TS_HOT_STAT == 0 && d.VBATOTG_LOW_STAT == 0 && d.VBAT_OVP_STAT == 0 && d.IBAT_OCP_STAT == 0 && (d.STOP_WD_CHG == 0 || d.WD_STAT == 0) && d.SDRV_CTRL == 0 && d.VINDPM_STAT == 0 && d.IINDPM_STAT == 0 && d.IBAT_REG_STAT == 0 && d.TREG_STAT == 0 && (d.TS_WARM_STAT == 0 || (d.JEITA_VSET_2 != 0 && d.JEITA_ISETH_1 != 0)) && (d.TS_COOL_STAT == 0 || (d.JEITA_ISETC_1 != 0))) {
            console.log("VBAT Path: سبز");
            vbatPathOverallStatus = { text: "درحال شارژ باطری.", colorClass: "status-bg-success" };
            setPathStyle(pathToBat, { color: 'var(--success-color)', isAnimated: true });
        }
        else {
            console.log("bad working now.")
            vbatPathOverallStatus = { text: "bad working now.", colorClass: "status-bg-danger" };
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

    const loadingOverlay = document.getElementById('loading-overlay');
    let isFirstLoad = true;

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

            if (isFirstLoad && loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.style.display = 'none', 500);
                isFirstLoad = false;
            }

            updateUI(currentPageData);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (isFirstLoad && loadingOverlay) loadingOverlay.textContent = 'خطا در اتصال';
        }
    }

    // ===================================================================================
    // بخش ۲: مدیریت وب‌سوکت، هشدارها و وضعیت اتصال
    // ===================================================================================

    // --- تنظیمات و متغیرها ---
    const statusIndicator = document.getElementById('status-indicator');
    // آدرس وب‌سوکت (به طور خودکار به هاست فعلی متصل می‌شود)
    let gateway = `ws://${window.location.hostname}/ws`;
    let websocket;

    // --- تابع بروزرسانی وضعیت اتصال (رنگ و متن نشانگر) ---
    function updateStatusIndicator(status) {
        if (!statusIndicator) return;
        statusIndicator.className = 'status-indicator'; // ریست کردن کلاس‌ها
        statusIndicator.classList.add(status);

        const textMap = {
            connecting: 'در حال اتصال...',
            connected: 'متصل',
            disconnected: 'قطع'
        };
        statusIndicator.textContent = textMap[status];
    }

    // --- تابع نمایش پیام شناور (Toast) ---
    function showToast(message, type = 'interrupt') {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.className = "show"; // نمایش دادن
            toast.classList.add(type); // افزودن نوع (رنگ)
            toast.innerHTML = message;

            // مخفی کردن بعد از 8 ثانیه
            setTimeout(() => {
                toast.className = toast.className.replace("show", "");
            }, 8000);
        }
    }

    // --- راه‌اندازی و مدیریت WebSocket ---
    function initWebSocket() {
        console.log('Trying to open a WebSocket connection...');
        updateStatusIndicator('connecting');
        websocket = new WebSocket(gateway);

        // وقتی اتصال برقرار شد
        websocket.onopen = () => {
            console.log('Connection opened');
            updateStatusIndicator('connected');
        };

        // وقتی اتصال قطع شد (تلاش مجدد بعد از 2 ثانیه)
        websocket.onclose = () => {
            console.log('Connection closed');
            updateStatusIndicator('disconnected');
            setTimeout(initWebSocket, 2000);
        };

        // وقتی پیامی از سرور دریافت شد
        websocket.onmessage = (event) => {
            console.log('Message from server: ', event.data);
            try {
                // تلاش برای پارس کردن JSON (مخصوص پروژه فعلی شما)
                const data = JSON.parse(event.data);

                // === منطق نمایش پیام بر اساس داده‌های پروژه ===
                // اگر پروژه جدید فرمت متفاوتی دارد، این قسمت را تغییر دهید
                if (data.events && Array.isArray(data.events)) {
                    let fullMessage = "";
                    data.events.forEach(eventCode => {
                        const explanation = interruptExplanations[eventCode];
                        if (explanation) {
                            fullMessage += `<strong>${explanation.title}</strong><br>${explanation.description}<br><br>`;
                        } else {
                            fullMessage += `<strong>وقفه ناشناخته:</strong> ${eventCode}<br><br>`;
                        }
                    });
                    showToast(fullMessage.trim(), 'interrupt');
                    checkUnseenCount();
                }
                // =============================================

            } catch (e) {
                // اگر پیام JSON نبود یا خطا داشت، متن خام را نمایش بده
                console.error("Failed to parse WebSocket message/Logic error:", e);
                showToast(event.data, 'interrupt');
            }
        };
    }

    async function checkUnseenCount() {
        const historyNavButton = document.getElementById('history-nav-button');
        if (!historyNavButton) return;

        const badge = historyNavButton.querySelector('.notification-badge');
        try {
            const response = await fetch('/api/unseen_count');
            if (response.ok) {
                const data = await response.json();
                if (data.unseen_count > 0) {
                    badge.textContent = data.unseen_count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Could not fetch unseen count:", error);
        }
    }

    // ===================================================================================
    // بخش ۶: راه‌اندازی اصلی
    // ===================================================================================

    function initMobileMenu() {
        const menuToggle = document.getElementById('menu-toggle-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        if (menuToggle && sidebar && overlay) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    initWebSocket();
    initMobileMenu();
    fetchPageData();
    checkUnseenCount();
    setInterval(() => { fetchPageData(); checkUnseenCount(); }, 5000);
});
