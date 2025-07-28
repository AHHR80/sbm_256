// صبر می‌کند تا تمام محتوای HTML صفحه بارگذاری شود و سپس کد را اجرا می‌کند
document.addEventListener('DOMContentLoaded', function() {

    // ===================================================================================
    // بخش ۱: توضیحات، پیکربندی و وابستگی‌های رجیسترها
    // ===================================================================================

    let globalRegisterState = {};

    const registerExplanations = {
        VSYSMIN_5_0: "(VSYSMIN_5_0): این یکی از مهم‌ترین تنظیمات حفاظتی است. این رجیستر حداقل ولتاژی را که سیستم (SYS) مجاز است به آن افت کند، تعیین می‌کند. حتی اگر باتری کاملاً خالی یا جدا شده باشد، چیپ تلاش می‌کند تا ولتاژ سیستم را بالاتر از این مقدار نگه دارد تا از خاموش شدن یا ریست شدن میکروکنترلر و سایر قطعات جلوگیری کند. مقدار آن باید متناسب با نیاز سیستم شما تنظیم شود.",
        CELL_1_0: "(CELL_1_0): این رجیستر به چیپ می‌گوید که باتری شما از چند سلول سری تشکیل شده است (از ۱ تا ۴ سلول). تنظیم صحیح این مقدار حیاتی است، زیرا مقادیر پیش‌فرض ولتاژ شارژ (VREG) و حداقل ولتاژ سیستم (VSYSMIN) بر اساس آن تعیین می‌شود. تغییر این مقدار، رجیسترهای مرتبط را به حالت پیش‌فرض بازنشانی می‌کند.",
        VOTG_10_0: "(VOTG_10_0): این رجیستر ولتاژ خروجی روی پین VBUS را زمانی که دستگاه در حالت On-The-Go (OTG) یا 'پاوربانک' قرار دارد، تنظیم می‌کند. شما می‌توانید ولتاژ خروجی را برای تغذیه دستگاه‌های دیگر در محدوده وسیعی (مثلاً ۵ تا ۱۲ ولت) تنظیم کنید.",
        IOTG_6_0: "(IOTG_6_0): این رجیستر حداکثر جریانی را که دستگاه در حالت OTG می‌تواند به خروجی بدهد، محدود می‌کند. این یک ویژگی حفاظتی برای جلوگیری از کشیدن جریان بیش از حد از باتری و آسیب به آن است.",
        EN_CHG: "(EN_CHG): این بیت، کلید اصلی فعال یا غیرفعال کردن کل فرآیند شارژ باتری است. اگر این بیت ۰ باشد، چیپ تحت هیچ شرایطی باتری را شارژ نخواهد کرد، حتی اگر منبع تغذیه متصل باشد.",
        VBUS_PRESENT_STAT: "(VBUS_PRESENT_STAT): یک نشانگر فقط-خواندنی که نشان می‌دهد آیا ولتاژ معتبری روی ورودی VBUS (ورودی اصلی آداپتور) وجود دارد یا خیر.",
        CHG_STAT_2_0: "(CHG_STAT_2_0): این رجیستر فقط-خواندنی، مرحله فعلی فرآیند شارژ را نشان می‌دهد (مثلاً: عدم شارژ، پیش‌شارژ، شارژ سریع با جریان ثابت، شارژ با ولتاژ ثابت، اتمام شارژ).",
        VBUS_STAT_3_0: "(VBUS_STAT_3_0): یک رجیستر فقط-خواندنی بسیار مهم که نوع منبع تغذیه متصل شده را بر اساس تشخیص پین‌های D+/D- نشان می‌دهد (مثلاً: پورت استاندارد USB، شارژر دیواری، شارژر سریع و...).",
        VBAT_PRESENT_STAT: "(VBAT_PRESENT_STAT): یک نشانگر فقط-خواندنی که نشان می‌دهد آیا باتری به درستی به سیستم متصل است و ولتاژ قابل قبولی دارد یا خیر.",
        VSYS_STAT: "(VSYS_STAT): یک نشانگر فقط-خواندنی که نشان می‌دهد آیا سیستم در حالت رگولاسیون حداقل ولتاژ (VSYSMIN) کار می‌کند (یعنی ولتاژ باتری کمتر از حد تنظیم شده است) یا خیر.",
        IBUS_ADC_15_0: "(IBUS_ADC_15_0): مقدار لحظه‌ای جریان ورودی از VBUS که توسط ADC داخلی اندازه‌گیری شده است.",
        IBAT_ADC_15_0: "(IBAT_ADC_15_0): مقدار لحظه‌ای جریان شارژ (مثبت) یا دشارژ (منفی) باتری که توسط ADC داخلی اندازه‌گیری شده است.",
        VBUS_ADC_15_0: "(VBUS_ADC_15_0): مقدار لحظه‌ای ولتاژ ورودی VBUS که توسط ADC داخلی اندازه‌گیری شده است.",
        VAC1_ADC_15_0: "(VAC1_ADC_15_0): مقدار لحظه‌ای ولتاژ ورودی VAC1 (قبل از ماسفت) که توسط ADC داخلی اندازه‌گیری شده است.",
        VAC2_ADC_15_0: "(VAC2_ADC_15_0): مقدار لحظه‌ای ولتاژ ورودی VAC2 (قبل از ماسفت) که توسط ADC داخلی اندازه‌گیری شده است.",
        VBAT_ADC_15_0: "(VBAT_ADC_15_0): مقدار لحظه‌ای ولتاژ باتری که توسط ADC داخلی اندازه‌گیری شده است.",
        VSYS_ADC_15_0: "(VSYS_ADC_15_0): مقدار لحظه‌ای ولتاژ سیستم (SYS) که توسط ADC داخلی اندازه‌گیری شده است.",
        TS_ADC_15_0: "(TS_ADC_15_0): مقدار ولتاژ روی پین ترمیستور (TS) به صورت درصدی از ولتاژ REGN که توسط ADC اندازه‌گیری شده است.",
        TDIE_ADC_15_0: "(TDIE_ADC_15_0): دمای داخلی خود چیپ که توسط سنسور دمای داخلی و ADC اندازه‌گیری شده است.",
        VREG_10_0: "(VREG_10_0): این رجیستر، ولتاژ نهایی را که باتری باید تا آن مقدار شارژ شود (Constant Voltage)، تنظیم می‌کند. این مقدار باید با دقت بسیار و بر اساس مشخصات شیمیایی باتری (مثلاً 4.2V برای هر سلول لیتیوم-یون) تنظیم شود. تنظیم مقدار بالاتر از حد مجاز می‌تواند خطرناک باشد.",
        ICHG_8_0: "(ICHG_8_0): این رجیستر، جریان شارژ در مرحله اصلی (Constant Current) را تعیین می‌کند. مقدار آن باید بر اساس ظرفیت و حداکثر جریان شارژ مجاز باتری (C-rate) تنظیم شود تا عمر باتری حفظ شود.",
        VINDPM_7_0: "(VINDPM_7_0): یک ویژگی هوشمند برای جلوگیری از افت ولتاژ آداپتور. اگر ولتاژ ورودی (VBUS) به دلیل بار زیاد به این آستانه برسد، چیپ به طور خودکار جریان شارژ را کاهش می‌دهد تا ولتاژ ورودی ثابت بماند و آداپتور دچار مشکل نشود.",
        IINDPM_8_0: "(IINDPM_8_0): حداکثر جریانی که چیپ مجاز است از منبع ورودی (آداپتور) بکشد را تعیین می‌کند. این مقدار معمولاً به صورت خودکار توسط چیپ تشخیص داده می‌شود، اما شما می‌توانید آن را به صورت دستی برای سازگاری با آداپتورهای خاص، محدود کنید.",
        EN_ICO: "(EN_ICO): با فعال کردن این گزینه، چیپ به صورت خودکار تلاش می‌کند تا حداکثر جریان قابل ارائه توسط یک آداپتور ناشناس را پیدا کند و IINDPM را بر اساس آن تنظیم کند. این ویژگی برای آداپتورهایی که استاندارد مشخصی ندارند بسیار مفید است.",
        FORCE_ICO: "(FORCE_ICO): یک دستور لحظه‌ای که الگوریتم ICO را مجبور به اجرا می‌کند، صرف‌نظر از اینکه قبلاً اجرا شده باشد یا نه.",
        EN_HIZ: "(EN_HIZ): با فعال کردن این گزینه، چیپ ارتباط خود را با ورودی VBUS قطع کرده و به یک حالت کم‌مصرف می‌رود. این حالت برای زمانی که می‌خواهید سیستم فقط از باتری تغذیه کند در حالی که آداپتور متصل است، مفید است.",
        SDRV_CTRL_1_0: "(SDRV_CTRL_1_0): این رجیستر حالت‌های مربوط به یک ماسفت خارجی (Ship FET) را کنترل می‌کند که می‌تواند باتری را به طور کامل از سیستم جدا کند. گزینه‌ها شامل حالت IDLE (عادی)، Shutdown (خاموشی کامل)، Ship Mode (حالت حمل با حداقل مصرف) و Reset (ریست کردن سخت‌افزاری سیستم) است.",
        EN_OTG: "(EN_OTG): این بیت حالت پاوربانک را فعال یا غیرفعال می‌کند.",
        EN_ACDRV1: "(EN_ACDRV1): اگر از قابلیت دو ورودی چیپ استفاده می‌کنید، این بیت ماسفت مربوط به ورودی ۱ را فعال یا غیرفعال می‌کند تا منبع تغذیه انتخاب شود.",
        EN_ACDRV2: "(EN_ACDRV2): اگر از قابلیت دو ورودی چیپ استفاده می‌کنید، این بیت ماسفت مربوط به ورودی ۲ را فعال یا غیرفعال می‌کند تا منبع تغذیه انتخاب شود.",
        DIS_ACDRV: "(DIS_ACDRV): یک دستور برای غیرفعال کردن فوری هر دو ورودی و قطع ارتباط با منابع تغذیه خارجی.",
        FORCE_VINDPM_DET: "(FORCE_VINDPM_DET): یک دستور لحظه‌ای که چیپ را مجبور می‌کند ولتاژ ورودی را در حالت بی‌باری مجدداً اندازه‌گیری کرده و آستانه VINDPM را به‌روز کند.",
        SFET_PRESENT: "(SFET_PRESENT): این بیت یک پیکربندی سخت‌افزاری است. شما باید به چیپ اطلاع دهید که آیا ماسفت خارجی Ship FET در مدار شما وجود دارد یا خیر تا منطق مربوط به آن به درستی کار کند.",
        EN_MPPT: "(EN_MPPT): با فعال کردن این گزینه، الگوریتم MPPT برای دریافت حداکثر انرژی از پنل خورشیدی فعال می‌شود.",
        ICO_ILIM_8_0: "(ICO_ILIM_8_0): یک رجیستر فقط-خواندنی که محدودیت جریان ورودی بهینه را پس از اجرای الگوریتم ICO نمایش می‌دهد.",
        AC1_PRESENT_STAT: "(AC1_PRESENT_STAT): نشانگر فقط-خواندنی که وضعیت اتصال منبع تغذیه به ورودی اول (VAC1) را نشان می‌دهد.",
        AC2_PRESENT_STAT: "(AC2_PRESENT_STAT): نشانگر فقط-خواندنی که وضعیت اتصال منبع تغذیه به ورودی دوم (VAC2) را نشان می‌دهد.",
        VBATOTG_LOW_STAT: "(VBATOTG_LOW_STAT): نشان می‌دهد که آیا ولتاژ باتری برای فعال کردن حالت OTG (پاوربانک) بیش از حد پایین است یا خیر.",
        ADC_EN: "(ADC_EN): کلید اصلی برای فعال یا غیرفعال کردن مبدل آنالوگ به دیجیتال (ADC). برای کاهش مصرف انرژی می‌توان آن را غیرفعال کرد.",
        VBUS_OVP_STAT: "(VBUS_OVP_STAT): وضعیت خطای ازدیاد ولتاژ در ورودی VBUS را نشان می‌دهد.",
        VBAT_OVP_STAT: "(VBAT_OVP_STAT): وضعیت خطای ازدیاد ولتاژ باتری را نشان می‌دهد.",
        IBUS_OCP_STAT: "(IBUS_OCP_STAT): وضعیت خطای جریان کشی بیش از حد از منبع ورودی را نشان می‌دهد.",
        IBAT_OCP_STAT: "(IBAT_OCP_STAT): وضعیت خطای جریان کشی بیش از حد از باتری (در حالت دشارژ) را نشان می‌دهد.",
        CONV_OCP_STAT: "(CONV_OCP_STAT): وضعیت خطای جریان کشی بیش از حد در مبدل داخلی چیپ را نشان می‌دهد.",
        VSYS_SHORT_STAT: "(VSYS_SHORT_STAT): وضعیت خطای اتصال کوتاه در خروجی سیستم (SYS) را نشان می‌دهد.",
        VSYS_OVP_STAT: "(VSYS_OVP_STAT): وضعیت خطای ازدیاد ولتاژ در خروجی سیستم (SYS) را نشان می‌دهد.",
        OTG_OVP_STAT: "(OTG_OVP_STAT): وضعیت خطای ازدیاد ولتاژ خروجی در حالت OTG را نشان می‌دهد.",
        OTG_UVP_STAT: "(OTG_UVP_STAT): وضعیت خطای افت ولتاژ خروجی در حالت OTG را نشان می‌دهد.",
        TSHUT_STAT: "(TSHUT_STAT): وضعیت خطای خاموشی حرارتی را نشان می‌دهد. این خطا زمانی رخ می‌دهد که دمای چیپ به حداکثر مقدار بحرانی خود برسد.",
        VBAT_LOWV_1_0: "(VBAT_LOWV_1_0): این رجیستر آستانه ولتاژی را تعیین می‌کند که در آن، فرآیند شارژ از مرحله 'پیش‌شارژ' (جریان کم) به 'شارژ سریع' (جریان اصلی) تغییر می‌کند. این مقدار به صورت درصدی از ولتاژ نهایی شارژ (VREG) تعریف می‌شود.",
        IPRECHG_5_0: "(IPRECHG_5_0): جریان شارژ را برای باتری‌هایی که ولتاژ بسیار پایینی دارند (عمیقاً دشارژ شده‌اند) تنظیم می‌کند. شارژ با جریان کم در این مرحله، از آسیب به سلول‌های باتری جلوگیری می‌کند.",
        ITERM_4_0: "(ITERM_4_0): وقتی جریان شارژ در مرحله ولتاژ-ثابت به این مقدار کاهش یابد، چیپ فرآیند شارژ را پایان یافته تلقی کرده و آن را متوقف می‌کند.",
        TRECHG_1_0: "(TRECHG_1_0): یک زمان فیلتر (deglitch) که از شروع ناخواسته یک سیکل شارژ جدید به دلیل نوسانات لحظه‌ای ولتاژ باتری جلوگیری می‌کند.",
        VRECHG_3_0: "(VRECHG_3_0): اگر پس از اتمام شارژ، ولتاژ باتری به دلیل مصرف داخلی یا بار، به اندازه‌ی این مقدار از ولتاژ نهایی (VREG) کمتر شود، یک سیکل شارژ جدید به صورت خودکار آغاز می‌شود.",
        VAC_OVP_1_0: "(VAC_OVP_1_0): آستانه ولتاژی را برای ورودی‌های VAC1/VAC2 (قبل از ماسفت‌ها) تعیین می‌کند که در صورت عبور از آن، ورودی برای حفاظت قطع می‌شود.",
        EN_IBAT: "(EN_IBAT): برای کاهش مصرف انرژی، مدار اندازه‌گیری جریان دشارژ باتری در حالت عادی خاموش است. برای خواندن جریان دشارژ از طریق ADC، باید این بیت را فعال کنید.",
        IBAT_REG_1_0: "(IBAT_REG_1_0): یک حد حفاظتی برای حداکثر جریان دشارژ باتری در حالت OTG. اگر جریان کشیده شده از باتری به این حد برسد، چیپ ولتاژ خروجی را کاهش می‌دهد تا از باتری محافظت کند.",
        EN_IINDPM: "(EN_IINDPM): این بیت مشخص می‌کند که آیا محدودیت جریان ورودی باید از طریق رجیستر داخلی (IINDPM) کنترل شود یا خیر.",
        EN_EXTILIM: "(EN_EXTILIM): این بیت مشخص می‌کند که آیا محدودیت جریان ورودی باید از طریق ولتاژ آنالوگ روی پین ILIM_HIZ کنترل شود یا خیر.",
        ICO_STAT_1_0: "(ICO_STAT_1_0): وضعیت فعلی الگوریتم بهینه‌ساز جریان ورودی (ICO) را نشان می‌دهد: غیرفعال، در حال اجرا، یا پایان یافته.",
        VAC1_OVP_STAT: "(VAC1_OVP_STAT): وضعیت خطای ازدیاد ولتاژ در ورودی VAC1 را نشان می‌دهد.",
        VAC2_OVP_STAT: "(VAC2_OVP_STAT): وضعیت خطای ازدیاد ولتاژ در ورودی VAC2 را نشان می‌دهد.",
        ADC_SAMPLE_1_0: "(ADC_SAMPLE_1_0): این گزینه، دقت و سرعت مبدل ADC را تنظیم می‌کند. رزولوشن بالاتر (مثلاً 15-bit) زمان تبدیل بیشتری نیاز دارد، در حالی که رزولوشن پایین‌تر (مثلاً 12-bit) سریع‌تر است.",
        STOP_WD_CHG: "(STOP_WD_CHG): تعیین می‌کند که آیا منقضی شدن تایمر Watchdog باید باعث توقف فرآیند شارژ شود یا خیر.",
        PRECHG_TMR: "(PRECHG_TMR): تایمر ایمنی برای مرحله پیش‌شارژ را تنظیم می‌کند.",
        TOPOFF_TMR_1_0: "(TOPOFF_TMR_1_0): یک تایمر اختیاری که پس از خاتمه شارژ، به مدت کوتاهی شارژ را با ولتاژ ثابت ادامه می‌دهد تا از شارژ کامل باتری اطمینان حاصل شود.",
        EN_TRICHG_TMR: "(EN_TRICHG_TMR): تایمر ایمنی برای مرحله شارژ قطره‌ای (Trickle Charge) را فعال یا غیرفعال می‌کند.",
        EN_PRECHG_TMR: "(EN_PRECHG_TMR): تایمر ایمنی برای مرحله پیش‌شارژ را فعال یا غیرفعال می‌کند.",
        EN_CHG_TMR: "(EN_CHG_TMR): تایمر ایمنی برای مرحله شارژ سریع را فعال یا غیرفعال می‌کند.",
        CHG_TMR_1_0: "(CHG_TMR_1_0): مدت زمان تایمر ایمنی برای مرحله شارژ سریع را انتخاب می‌کند.",
        TMR2X_EN: "(TMR2X_EN): باعث می‌شود تایمرهای ایمنی در شرایط خاص (مانند محدودیت حرارتی) با نصف سرعت کار کنند تا زمان بیشتری برای شارژ ایمن فراهم شود.",
        EN_AUTO_IBATDIS: "(EN_AUTO_IBATDIS): در صورت وقوع خطای ازدیاد ولتاژ باتری (BATOVP)، به طور خودکار یک جریان دشارژ کوچک برای کاهش ولتاژ اعمال می‌کند.",
        FORCE_IBATDIS: "(FORCE_IBATDIS): یک دستور لحظه‌ای برای اعمال اجباری جریان دشارژ روی باتری، صرف‌نظر از وضعیت خطا.",
        EN_TERM: "(EN_TERM): قابلیت خاتمه خودکار شارژ را فعال یا غیرفعال می‌کند. اگر غیرفعال باشد، شارژ تا زمان توقف دستی ادامه می‌یابد.",
        WATCHDOG_2_0: "(WATCHDOG_2_0): یک تایمر ایمنی که باید به طور متناوب توسط میکروکنترلر ریست شود. اگر ریست نشود، چیپ به تنظیمات پیش‌فرض بازمی‌گردد تا از هنگ کردن سیستم جلوگیری کند.",
        FORCE_INDET: "(FORCE_INDET): یک دستور لحظه‌ای که چیپ را مجبور می‌کند فرآیند تشخیص نوع آداپتور از طریق پین‌های D+/D- را مجدداً اجرا کند.",
        AUTO_INDET_EN: "(AUTO_INDET_EN): تشخیص خودکار نوع آداپتور هنگام اتصال را فعال یا غیرفعال می‌کند.",
        EN_12V: "(EN_12V): به چیپ اجازه می‌دهد تا از شارژرهای سریع (HVDCP) درخواست ولتاژ ۱۲ ولت کند.",
        EN_9V: "(EN_9V): به چیپ اجازه می‌دهد تا از شارژرهای سریع (HVDCP) درخواست ولتاژ ۹ ولت کند.",
        HVDCP_EN: "(HVDCP_EN): پروتکل ارتباط با شارژرهای سریع (High Voltage Dedicated Charging Port) را فعال می‌کند.",
        SDRV_DLY: "(SDRV_DLY): یک تأخیر زمانی برای اجرای دستورات مربوط به Ship FET (SDRV_CTRL) اضافه می‌کند.",
        PFM_OTG_DIS: "(PFM_OTG_DIS): حالت PFM (Pulse Frequency Modulation) را در مد OTG غیرفعال می‌کند. این کار بازدهی در بار کم را کاهش می‌دهد اما ممکن است نویز را کم کند.",
        PFM_FWD_DIS: "(PFM_FWD_DIS): حالت PFM را در مد شارژ (Forward) غیرفعال می‌کند.",
        WKUP_DLY: "(WKUP_DLY): مدت زمانی که پین QON باید پایین نگه داشته شود تا دستگاه از حالت Ship Mode خارج شود را تنظیم می‌کند.",
        DIS_LDO: "(DIS_LDO): حالت LDO ماسفت باتری در مرحله پیش‌شارژ را غیرفعال می‌کند.",
        DIS_OTG_OOA: "(DIS_OTG_OOA): حالت Out-of-Audio را برای جلوگیری از نویز صوتی در مد OTG غیرفعال می‌کند.",
        DIS_FWD_OOA: "(DIS_FWD_OOA): حالت Out-of-Audio را برای جلوگیری از نویز صوتی در مد شارژ غیرفعال می‌کند.",
        PWM_FREQ: "(PWM_FREQ): فرکانس سوئیچینگ اصلی مبدل را بین 1.5MHz (قطعات کوچکتر) و 750kHz (بازدهی بالاتر) انتخاب می‌کند.",
        DIS_STAT: "(DIS_STAT): عملکرد پین خروجی STAT را غیرفعال می‌کند.",
        DIS_VSYS_SHORT: "(DIS_VSYS_SHORT): حفاظت داخلی در برابر اتصال کوتاه شدن خروجی سیستم (SYS) را غیرفعال می‌کند.",
        DIS_VOTG_UVP: "(DIS_VOTG_UVP): حفاظت داخلی در برابر افت ولتاژ خروجی در حالت OTG را غیرفعال می‌کند.",
        EN_IBUS_OCP: "(EN_IBUS_OCP): حفاظت در برابر جریان کشی بیش از حد از منبع ورودی (IBUS OCP) را فعال می‌کند.",
        EN_BATOC: "(EN_BATOC): حفاظت در برابر جریان کشی بیش از حد از باتری (IBAT OCP) را فعال می‌کند.",
        VOC_PCT_2_0: "(VOC_PCT_2_0): در حالت MPPT، نقطه حداکثر توان را به صورت درصدی از ولتاژ مدار باز (Open-Circuit Voltage) پنل خورشیدی تنظیم می‌کند.",
        VOC_DLY_1_0: "(VOC_DLY_1_0): در حالت MPPT، مدت زمان تأخیر قبل از اندازه‌گیری ولتاژ مدار باز پنل را تنظیم می‌کند.",
        VOC_RATE_1_0: "(VOC_RATE_1_0): در حالت MPPT، فاصله زمانی بین هر بار اندازه‌گیری ولتاژ مدار باز پنل را تعیین می‌کند.",
        TREG_1_0: "(TREG_1_0): آستانه دمای داخلی چیپ را برای محدودیت حرارتی (Thermal Regulation) تنظیم می‌کند. اگر دما به این حد برسد، جریان شارژ کاهش می‌یابد.",
        TSHUT_1_0: "(TSHUT_1_0): آستانه دمای داخلی چیپ را برای خاموشی کامل (Thermal Shutdown) تنظیم می‌کند. این یک حفاظت حیاتی در برابر گرمای بیش از حد است.",
        VBUS_PD_EN: "(VBUS_PD_EN): یک مقاومت Pull-down داخلی را روی خط VBUS فعال می‌کند.",
        VAC1_PD_EN: "(VAC1_PD_EN): یک مقاومت Pull-down داخلی را روی خط VAC1 فعال می‌کند.",
        VAC2_PD_EN: "(VAC2_PD_EN): یک مقاومت Pull-down داخلی را روی خط VAC2 فعال می‌کند.",
        JEITA_VSET_2_0: "(JEITA_VSET_2_0): در محدوده دمای گرم، ولتاژ شارژ را طبق استاندارد JEITA کاهش می‌دهد تا از باتری محافظت کند.",
        JEITA_ISETH_1_0: "(JEITA_ISETH_1_0): در محدوده دمای گرم، جریان شارژ را طبق استاندارد JEITA کاهش می‌دهد.",
        JEITA_ISETC_1_0: "(JEITA_ISETC_1_0): در محدوده دمای سرد، جریان شارژ را طبق استاندارد JEITA کاهش می‌دهد.",
        TS_COOL_1_0: "(TS_COOL_1_0): آستانه دمایی بین حالت 'سرد' و 'خنک' را طبق پروفایل JEITA تنظیم می‌کند.",
        TS_WARM_1_0: "(TS_WARM_1_0): آستانه دمایی بین حالت 'عادی' و 'گرم' را طبق پروفایل JEITA تنظیم می‌کند.",
        BHOT_1_0: "(BHOT_1_0): آستانه دمای بالا را برای عملکرد ایمن در حالت OTG تنظیم می‌کند.",
        BCOLD: "(BCOLD): آستانه دمای پایین را برای عملکرد ایمن در حالت OTG تنظیم می‌کند.",
        TS_IGNORE: "(TS_IGNORE): مانیتورینگ دمای باتری از طریق پین TS را به طور کامل نادیده می‌گیرد (استفاده از این گزینه توصیه نمی‌شود).",
        ADC_RATE: "(ADC_RATE): نرخ تبدیل ADC را بین حالت 'پیوسته' و 'تک نمونه‌ای' (One-shot) انتخاب می‌کند.",
        ADC_AVG: "(ADC_AVG): قابلیت میانگین‌گیری از نتایج ADC را برای کاهش نویز و افزایش دقت فعال می‌کند.",
        ADC_AVG_INIT: "(ADC_AVG_INIT): تعیین می‌کند که فرآیند میانگین‌گیری با مقدار فعلی رجیستر شروع شود یا با یک تبدیل ADC جدید.",
        IBUS_ADC_DIS: "(IBUS_ADC_DIS): کانال ADC مربوط به جریان ورودی را غیرفعال می‌کند.",
        IBAT_ADC_DIS: "(IBAT_ADC_DIS): کانال ADC مربوط به جریان باتری را غیرفعال می‌کند.",
        VBUS_ADC_DIS: "(VBUS_ADC_DIS): کانال ADC مربوط به ولتاژ ورودی را غیرفعال می‌کند.",
        VBAT_ADC_DIS: "(VBAT_ADC_DIS): کانال ADC مربوط به ولتاژ باتری را غیرفعال می‌کند.",
        VSYS_ADC_DIS: "(VSYS_ADC_DIS): کانال ADC مربوط به ولتاژ سیستم را غیرفعال می‌کند.",
        TS_ADC_DIS: "(TS_ADC_DIS): کانال ADC مربوط به پین دما (TS) را غیرفعال می‌کند.",
        TDIE_ADC_DIS: "(TDIE_ADC_DIS): کانال ADC مربوط به دمای داخلی چیپ را غیرفعال می‌کند.",
        DP_ADC_DIS: "(DP_ADC_DIS): کانال ADC مربوط به پین D+ را غیرفعال می‌کند.",
        DM_ADC_DIS: "(DM_ADC_DIS): کانال ADC مربوط به پین D- را غیرفعال می‌کند.",
        VAC1_ADC_DIS: "(VAC1_ADC_DIS): کانال ADC مربوط به ورودی VAC1 را غیرفعال می‌کند.",
        VAC2_ADC_DIS: "(VAC2_ADC_DIS): کانال ADC مربوط به ورودی VAC2 را غیرفعال می‌کند.",
        DPLUS_DAC_2_0: "(DPLUS_DAC_2_0): یک ولتاژ یا وضعیت خاص را روی پین D+ قرار می‌دهد. برای شبیه‌سازی انواع شارژر یا تست استفاده می‌شود.",
        DMINUS_DAC_2_0: "(DMINUS_DAC_2_0): یک ولتاژ یا وضعیت خاص را روی پین D- قرار می‌دهد.",
        PN_2_0: "(PN_2_0): یک مقدار فقط-خواندنی که شماره قطعه (Part Number) را مشخص می‌کند.",
        DEV_REV_2_0: "(DEV_REV_2_0): یک مقدار فقط-خواندنی که نسخه بازبینی (Device Revision) سخت‌افزار چیپ را مشخص می‌کند.",
        IINDPM_STAT: "(IINDPM_STAT): نشان می‌دهد آیا چیپ در حال محدود کردن جریان ورودی است.",
        VINDPM_STAT: "(VINDPM_STAT): نشان می‌دهد آیا چیپ در حال محدود کردن ولتاژ ورودی است.",
        WD_STAT: "(WD_STAT): نشان می‌دهد آیا تایمر Watchdog منقضی شده و رجیسترها به حالت پیش‌فرض بازگشته‌اند.",
        PG_STAT: "(PG_STAT): نشان می‌دهد آیا منبع تغذیه ورودی 'خوب' و پایدار است.",
        BC1_2_DONE_STAT: "(BC1_2_DONE_STAT): نشان می‌دهد که فرآیند تشخیص نوع آداپتور BC1.2 به پایان رسیده است.",
        TREG_STAT: "(TREG_STAT): نشان می‌دهد آیا چیپ به دلیل دمای بالا، جریان شارژ را کاهش داده است.",
        DPDM_STAT: "(DPDM_STAT): نشان می‌دهد که فرآیند تشخیص D+/D- در حال انجام است یا خیر.",
        ACRB2_STAT: "(ACRB2_STAT): نشان می‌دهد آیا چیپ در هنگام راه‌اندازی، وجود ماسفت‌ها را روی ورودی ۲ تشخیص داده است.",
        ACRB1_STAT: "(ACRB1_STAT): نشان می‌دهد آیا چیپ در هنگام راه‌اندازی، وجود ماسفت‌ها را روی ورودی ۱ تشخیص داده است.",
        ADC_DONE_STAT: "(ADC_DONE_STAT): در حالت تک-نمونه‌ای، نشان می‌دهد که تبدیل ADC به پایان رسیده است.",
        CHG_TMR_STAT: "(CHG_TMR_STAT): نشان می‌دهد آیا تایمر ایمنی شارژ سریع منقضی شده است.",
        TRICHG_TMR_STAT: "(TRICHG_TMR_STAT): نشان می‌دهد آیا تایمر ایمنی شارژ قطره‌ای منقضی شده است.",
        PRECHG_TMR_STAT: "(PRECHG_TMR_STAT): نشان می‌دهد آیا تایمر ایمنی پیش‌شارژ منقضی شده است.",
        TS_COLD_STAT: "(TS_COLD_STAT): گزارش می‌دهد که دمای باتری در محدوده 'سرد' قرار دارد.",
        TS_COOL_STAT: "(TS_COOL_STAT): گزارش می‌دهد که دمای باتری در محدوده 'خنک' قرار دارد.",
        TS_WARM_STAT: "(TS_WARM_STAT): گزارش می‌دهد که دمای باتری در محدوده 'گرم' قرار دارد.",
        TS_HOT_STAT: "(TS_HOT_STAT): گزارش می‌دهد که دمای باتری در محدوده 'داغ' قرار دارد.",
        IBAT_REG_STAT: "(IBAT_REG_STAT): نشان می‌دهد آیا چیپ در حال محدود کردن جریان دشارژ باتری در حالت OTG است.",
        D_PLUS_ADC_15_0: "(D_PLUS_ADC_15_0): ولتاژ لحظه‌ای پین D+ را برای دیباگ کردن نمایش می‌دهد.",
        D_MINUS_ADC_15_0: "(D_MINUS_ADC_15_0): ولتاژ لحظه‌ای پین D- را برای دیباگ کردن نمایش می‌دهد."
    };

    const registerConfig = {
        VSYSMIN_5_0: { type: 'number', range: { min: 2500, max: 16000, step: 250 }, unit: 'mV' },
        CELL_1_0: { type: 'select', options: { '1': '1s', '2': '2s', '3': '3s', '4': '4s' } },
        VOTG_10_0: { type: 'number', range: { min: 2800, max: 22000, step: 10 }, unit: 'mV' },
        IOTG_6_0: { type: 'number', range: { min: 160, max: 3360, step: 40 }, unit: 'mA' },
        EN_CHG: { type: 'boolean', options: { '0': 'Disabled', '1': 'Enabled' } },
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
        ADC_SAMPLE_1_0: { type: 'select', options: { '0': '15-bit', '1': '14-bit', '2': '13-bit', '3': '12-bit' } },
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

    const registerDependencies = {
        'FORCE_ICO': { controller: 'EN_ICO', requiredValue: '1', message: 'برای اجرای این دستور، ابتدا باید EN_ICO فعال باشد.' },
        'SDRV_CTRL_1_0': { controller: 'SFET_PRESENT', requiredValue: '1', message: 'برای کنترل Ship FET، ابتدا باید SFET_PRESENT فعال باشد.' },
        'EN_BATOC': { controller: 'SFET_PRESENT', requiredValue: '1', message: 'برای فعال‌سازی حفاظت جریان باتری، ابتدا باید SFET_PRESENT فعال باشد.' },
        'EN_9V': { controller: 'HVDCP_EN', requiredValue: '1', message: 'برای درخواست ولتاژ 9V، ابتدا باید HVDCP_EN فعال باشد.' },
        'EN_12V': { controller: 'HVDCP_EN', requiredValue: '1', message: 'برای درخواست ولتاژ 12V، ابتدا باید HVDCP_EN فعال باشد.' },
        'ADC_RATE': { controller: 'ADC_EN', requiredValue: '1', message: 'برای تغییر تنظیمات ADC، ابتدا باید ADC_EN فعال باشد.' },
        'ADC_SAMPLE_1_0': { controller: 'ADC_EN', requiredValue: '1', message: 'برای تغییر تنظیمات ADC، ابتدا باید ADC_EN فعال باشد.' },
        'ADC_AVG': { controller: 'ADC_EN', requiredValue: '1', message: 'برای تغییر تنظیمات ADC، ابتدا باید ADC_EN فعال باشد.' },
        'ADC_AVG_INIT': { controller: 'ADC_EN', requiredValue: '1', message: 'برای تغییر تنظیمات ADC، ابتدا باید ADC_EN فعال باشد.' },
        'IBUS_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'IBAT_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'VBUS_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'VBAT_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'VSYS_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'TS_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'TDIE_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'DP_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'DM_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'VAC1_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'VAC2_ADC_DIS': { controller: 'ADC_EN', requiredValue: '1', message: 'برای کنترل کانال‌های ADC، ابتدا باید ADC_EN فعال باشد.' },
        'JEITA_VSET_2_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای استفاده از تنظیمات JEITA، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'JEITA_ISETH_1_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای استفاده از تنظیمات JEITA، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'JEITA_ISETC_1_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای استفاده از تنظیمات JEITA، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'TS_COOL_1_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای استفاده از تنظیمات JEITA، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'TS_WARM_1_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای استفاده از تنظیمات JEITA، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'BHOT_1_0': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای تنظیم دمای OTG، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'BCOLD': { controller: 'TS_IGNORE', requiredValue: '0', message: 'برای تنظیم دمای OTG، ابتدا باید TS_IGNORE غیرفعال باشد.' },
        'FORCE_VINDPM_DET': { controller: 'VSYS_STAT', requiredValue: '0', message: 'این دستور تنها زمانی مجاز است که ولتاژ باتری بالاتر از VSYSMIN باشد (VSYS_STAT=0).'},
        'EN_MPPT': { controller: 'VSYS_STAT', requiredValue: '0', message: 'MPPT تنها زمانی مجاز است که ولتاژ باتری بالاتر از VSYSMIN باشد (VSYS_STAT=0).'}
    };

    // ===================================================================================
    // بخش ۲: مدیریت وب‌سوکت، هشدارها و وضعیت اتصال
    // ===================================================================================

    const statusIndicator = document.getElementById('status-indicator');
    let gateway = `ws://${window.location.hostname}/ws`;
    let websocket;

    function updateStatusIndicator(status) {
        if (!statusIndicator) return;
        statusIndicator.className = 'status-indicator';
        statusIndicator.classList.add(status);
        const textMap = { connecting: 'در حال اتصال...', connected: 'متصل', disconnected: 'قطع' };
        statusIndicator.textContent = textMap[status];
    }

    function initWebSocket() {
        console.log('Trying to open a WebSocket connection...');
        updateStatusIndicator('connecting');
        websocket = new WebSocket(gateway);
        
        websocket.onopen = () => {
            console.log('Connection opened');
            updateStatusIndicator('connected');
        };
        
        websocket.onclose = () => {
            console.log('Connection closed');
            updateStatusIndicator('disconnected');
            setTimeout(initWebSocket, 2000);
        };
        
        websocket.onmessage = (event) => {
            console.log('Message from server: ', event.data);
            showToast(event.data, 'interrupt');
            checkUnseenCount(); // Update badge on new interrupt
            // If on history page, prepend the new event
            if (window.location.pathname.includes('history.html')) {
                const historyList = document.getElementById('history-list');
                if(historyList) {
                    const newItem = createHistoryItem({
                        timestamp: new Date().getTime(), // Approximate time
                        message: event.data,
                        seen: true // Assume seen as it's live
                    });
                    historyList.prepend(newItem);
                }
            }
        };
    }
    
    function showToast(message, type = 'interrupt') {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.className = "show";
            toast.classList.add(type);
            const title = { interrupt: 'وقفه', warning: 'هشدار', success: 'موفقیت' }[type];
            toast.innerHTML = `<strong>${title}:</strong> ${message}`;
            setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 5000);
        }
    }

    async function checkUnseenCount() {
        const historyNavButton = document.getElementById('history-nav-button');
        if (!historyNavButton) return;
        
        const badge = historyNavButton.querySelector('.notification-badge');
        try {
            const response = await fetch('/api/unseen_count');
            if(response.ok) {
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
    // بخش ۳: مدیریت UI (رابط کاربری) و بارگذاری داده‌ها
    // ===================================================================================

    // REFACTORED: This function now only adds tooltips, as labels are set in HTML.
    function initializeUI() {
        document.querySelectorAll('.data-card').forEach(card => {
            const regName = card.dataset.reg;
            const explanation = registerExplanations[regName];

            // Only proceed if there's an explanation for this register
            if (explanation) {
                const labelSpan = card.querySelector('.label');
                
                // Ensure we don't add a tooltip twice and that a label exists
                if (labelSpan && !labelSpan.parentElement.classList.contains('label-container')) {
                    const labelContainer = document.createElement('div');
                    labelContainer.className = 'label-container';
                    
                    const tooltipIcon = document.createElement('span');
                    tooltipIcon.className = 'tooltip-icon';
                    tooltipIcon.textContent = '?';
                    
                    const tooltipText = document.createElement('div');
                    tooltipText.className = 'tooltip-text';
                    tooltipText.textContent = explanation;
                    
                    // Clone the original label to keep its content
                    const existingLabel = labelSpan.cloneNode(true);
                    
                    // Build the new structure
                    labelContainer.appendChild(existingLabel);
                    labelContainer.appendChild(tooltipIcon);
                    labelContainer.appendChild(tooltipText);
                    
                    // Replace the old label span with the new structure
                    labelSpan.replaceWith(labelContainer);
                }
            }
        });
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

            if (isFirstLoad && loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.style.display = 'none', 500);
                isFirstLoad = false;
            }

            const dataContainer = document.getElementById('data-container');
            if (!dataContainer) return;

            const statusInterpreters = {
                CHG_STAT_2_0: v => ["Not Charging", "Trickle", "Pre-charge", "Fast Charge", "Taper", "Reserved", "Top-off", "Done"][v] || "Unknown",
                VBUS_STAT_3_0: v => ({0:"No Input",1:"SDP",2:"CDP",3:"DCP",4:"HVDCP",5:"Unknown",6:"Non-Standard",7:"OTG",8:"Not Qualified"})[v]||"Reserved",
                ICO_STAT_1_0: v => ["Disabled", "In Progress", "Done", "Reserved"][v] || "Unknown",
            };

            for (const key in pageData) {
                const element = document.getElementById(key);
                if (element) {
                    let rawValue = pageData[key];
                    const cardElement = element.closest('.data-card');
                    if (cardElement) cardElement.dataset.currentValue = rawValue;
                    if (rawValue === -1 || rawValue === -999.0) { element.textContent = "Error"; continue; }
                    let displayValue;
                    const config = registerConfig[key];
                    if (config) {
                        if (config.type === 'select' || config.type === 'boolean') {
                            displayValue = config.options[rawValue] || `خام: ${rawValue}`;
                        } else if (config.type === 'command') {
                            displayValue = "اجرا";
                        } else {
                            displayValue = `${rawValue}${config.unit || ''}`;
                        }
                    } else if (statusInterpreters[key]) {
                        displayValue = statusInterpreters[key](rawValue);
                    } else if (typeof rawValue === 'number' && !Number.isInteger(rawValue)) {
                        displayValue = rawValue.toFixed(2);
                    } else {
                        displayValue = rawValue;
                    }
                    element.textContent = displayValue;
                }
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (isFirstLoad && loadingOverlay) loadingOverlay.textContent = 'خطا در اتصال';
        }
    }

    // ===================================================================================
    // بخش ۴: منطق ویژه صفحه تاریخچه
    // ===================================================================================
    
    /**
     * Converts milliseconds to a human-readable uptime string (D, HH:MM:SS).
     * @param {number} milliseconds The timestamp from millis().
     * @returns {string} A formatted uptime string.
     */
    function formatUptime(milliseconds) {
        if (typeof milliseconds !== 'number' || milliseconds < 0) {
            return "زمان نامعتبر";
        }

        let totalSeconds = Math.floor(milliseconds / 1000);
        let days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        let hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;

        // Pad with leading zeros
        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');

        return `روز ${days}، ${hours}:${minutes}:${seconds}`;
    }

    function createHistoryItem(item) {
        const li = document.createElement('li');
        li.className = 'history-item';
        if (!item.seen) {
            li.classList.add('unseen');
        }

        const uptimeString = formatUptime(item.timestamp);

        li.innerHTML = `
            <div class="history-time">
                <span>زمان سپری شده</span>
                <span>${uptimeString}</span>
            </div>
            <div class="history-message">${item.message}</div>
        `;
        return li;
    }

    async function loadHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error('Failed to fetch history');
            const historyData = await response.json();

            historyList.innerHTML = '';
            // Reverse the array to show newest first
            historyData.reverse().forEach(item => {
                historyList.appendChild(createHistoryItem(item));
            });

            if (isFirstLoad && loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.style.display = 'none', 500);
                isFirstLoad = false;
            }
            
            // Mark all as seen after displaying them
            await fetch('/api/mark_history_seen', { method: 'POST' });

        } catch (error) {
            console.error('Error loading history:', error);
            historyList.innerHTML = '<li class="history-item">خطا در بارگذاری تاریخچه</li>';
            if (isFirstLoad && loadingOverlay) {
                loadingOverlay.textContent = 'خطا در بارگذاری';
            }
        }
    }

    // ===================================================================================
    // بخش ۵: مدیریت مودال و ارسال دستورات
    // ===================================================================================

    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSave = document.getElementById('modal-save');
    const modalCancel = document.getElementById('modal-cancel');
    let currentEditingReg = null;

    function setupModalEventListeners() {
        const dataContainer = document.getElementById('data-container');
        if (!dataContainer) return;

        dataContainer.addEventListener('click', (event) => {
            const card = event.target.closest('.data-card.writable');
            if (!card) return;
            currentEditingReg = card.dataset.reg;
            const config = registerConfig[currentEditingReg];
            if (!config) return;
            const dependency = registerDependencies[currentEditingReg];
            if (dependency) {
                const controllerValue = globalRegisterState[dependency.controller];
                if (controllerValue === undefined) {
                    showToast('وضعیت کنترل‌کننده هنوز بارگذاری نشده است.', 'warning');
                    return;
                }
                if (String(controllerValue) !== dependency.requiredValue) {
                    showToast(dependency.message, 'warning');
                    return;
                }
            }
            const rawValue = card.dataset.currentValue;
            
            // MODIFIED: Read the display name directly from the card's label
            const labelElement = card.querySelector('.label');
            const labelText = labelElement ? labelElement.textContent.trim() : currentEditingReg;
            
            modalTitle.textContent = `ویرایش ${labelText}`;
            modalBody.innerHTML = '';
            if (config.type === 'boolean') {
                modalBody.innerHTML = `<div class="modal-btn-group">
                    <button data-value="1" class="${rawValue == 1 ? 'active' : ''}">${config.options['1']}</button>
                    <button data-value="0" class="${rawValue == 0 ? 'active' : ''}">${config.options['0']}</button>
                </div>`;
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
                modalBody.innerHTML = `<p>با کلیک روی "ذخیره"، دستور <strong>${labelText}</strong> اجرا خواهد شد.</p>`;
            }
            modal.style.display = 'flex';
        });

        modalCancel.addEventListener('click', () => { modal.style.display = 'none'; });
        window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });
        modalSave.addEventListener('click', () => {
            const config = registerConfig[currentEditingReg];
            let newValue;
            if (config.type === 'command') newValue = 1;
            else if (config.type === 'boolean') newValue = modalBody.querySelector('button.active')?.dataset.value;
            else if (config.type === 'select') newValue = modalBody.querySelector('select').value;
            else if (config.type === 'number') newValue = modalBody.querySelector('input').value;
            if (newValue !== null) sendWriteRequest(currentEditingReg, newValue);
            modal.style.display = 'none';
        });
        modalBody.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' && event.target.parentElement.classList.contains('modal-btn-group')) {
                event.target.parentElement.querySelector('.active')?.classList.remove('active');
                event.target.classList.add('active');
            }
        });

        const resetButton = document.getElementById('reset-button');
        const confirmModal = document.getElementById('confirm-modal');
        if (resetButton && confirmModal) {
            const confirmYes = document.getElementById('confirm-yes');
            const confirmNo = document.getElementById('confirm-no');
            resetButton.addEventListener('click', () => confirmModal.style.display = 'flex');
            confirmNo.addEventListener('click', () => confirmModal.style.display = 'none');
            confirmYes.addEventListener('click', () => {
                sendWriteRequest('REG_RST', 1);
                confirmModal.style.display = 'none';
            });
            window.addEventListener('click', (event) => { if (event.target == confirmModal) confirmModal.style.display = 'none'; });
        }
    }

    async function sendWriteRequest(reg, val) {
        const card = document.querySelector(`.data-card[data-reg="${reg}"]`);
        if (card) card.classList.add('saving');
        
        // MODIFIED: Read the display name from the card's label for the toast message
        let displayName = reg;
        if (card) {
            const labelElement = card.querySelector('.label');
            if (labelElement) {
                displayName = labelElement.textContent.trim();
            }
        }

        try {
            const response = await fetch('/api/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `reg=${encodeURIComponent(reg)}&val=${encodeURIComponent(val)}`
            });
            if (response.ok) {
                showToast(`دستور ${displayName} با موفقیت ارسال شد.`, 'success');
                if(window.location.pathname.includes('history.html')) {
                    // No need to refetch data on history page after write
                } else {
                    setTimeout(fetchPageData, 500);
                }
            } else {
                const errorText = await response.text();
                showToast(`خطا در نوشتن: ${errorText}`, 'warning');
            }
        } catch (error) {
            console.error('Failed to send write request:', error);
            showToast('خطا در ارسال درخواست. اتصال را بررسی کنید.', 'warning');
        } finally {
            if (card) setTimeout(() => card.classList.remove('saving'), 500);
        }
    }
    
    // ===================================================================================
    // بخش ۶: راه‌اندازی اصلی
    // ===================================================================================

    initializeUI();
    initWebSocket();

    if (window.location.pathname.includes('history.html')) {
        loadHistory();
    } else {
        checkUnseenCount();
        const dataContainer = document.getElementById('data-container');
        if (dataContainer) {
            fetchPageData();
            setInterval(fetchPageData, 5000);
            setupModalEventListeners();
        }
    }
});
