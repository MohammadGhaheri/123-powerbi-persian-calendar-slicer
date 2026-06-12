/* eslint-disable powerbi-visuals/no-inner-outer-html */
"use strict";

import "../style/visual.less";
import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

interface DateTarget {
    table: string;
    column: string;
}

interface DateSource {
    target: DateTarget;
    role: "date" | "jalaliDateKey";
    isNumericKey: boolean;
}

interface JalaliDate {
    jy: number;
    jm: number;
    jd: number;
}

type DisplayMode = "inline" | "overlay" | "between" | "modal";
type ActiveInput = "from" | "to";
type PersianFontFamily = "default" | "segoe" | "calibri" | "tahoma" | "arial" | "vazirmatn" | "iransans" | "yekan";

const MONTH_NAMES_FA = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

const WEEK_DAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function enumMember(value: string, displayName: string): powerbi.IEnumMember {
    return { value, displayName };
}

function displayModeLabel(value: DisplayMode): string {
    switch (value) {
        case "inline": return "Inline below fields";
        case "between": return "Between style";
        case "modal": return "Power BI modal dialog - experimental";
        case "overlay":
        default: return "Overlay on fields";
    }
}

function fontFamilyLabel(value: PersianFontFamily): string {
    switch (value) {
        case "segoe": return "Segoe UI";
        case "calibri": return "Calibri";
        case "tahoma": return "Tahoma";
        case "arial": return "Arial";
        case "vazirmatn": return "Vazirmatn";
        case "iransans": return "IRANSans";
        case "yekan": return "Yekan Bakh";
        case "default":
        default: return "Default";
    }
}

function fontFamilyCss(value: PersianFontFamily): string {
    switch (value) {
        case "segoe": return '"Segoe UI", Tahoma, Arial, sans-serif';
        case "calibri": return 'Calibri, "Segoe UI", Tahoma, Arial, sans-serif';
        case "tahoma": return 'Tahoma, "Segoe UI", Arial, sans-serif';
        case "arial": return 'Arial, "Segoe UI", Tahoma, sans-serif';
        case "vazirmatn": return 'Vazirmatn, "Vazir", "Segoe UI", Tahoma, Arial, sans-serif';
        case "iransans": return 'IRANSans, "Iran Sans", "Segoe UI", Tahoma, Arial, sans-serif';
        case "yekan": return '"Yekan Bakh", "B Yekan", "Segoe UI", Tahoma, Arial, sans-serif';
        case "default":
        default: return '"Segoe UI", Tahoma, Arial, sans-serif';
    }
}

const LINKEDIN_URL = "https://www.linkedin.com/in/mohammadghaheri/";
const DONATE_URL = "https://csc1.ir/donate/";
const DONATE_NOTE = "⚠ If you hide the module footer, please consider supporting open-source development: https://csc1.ir/donate/";

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private card: HTMLDivElement;
    private header: HTMLDivElement;
    private title: HTMLDivElement;
    private body: HTMLDivElement;
    private fromInput: HTMLInputElement;
    private toInput: HTMLInputElement;
    private fromPickerButton: HTMLButtonElement;
    private toPickerButton: HTMLButtonElement;
    private applyButton: HTMLButtonElement;
    private clearButton: HTMLButtonElement;
    private todayButton: HTMLButtonElement;
    private currentMonthButton: HTMLButtonElement;
    private currentYearButton: HTMLButtonElement;
    private status: HTMLDivElement;
    private footer: HTMLDivElement;
    private picker: HTMLDivElement;
    private dateSource: DateSource | null = null;
    private dataRange: { min: JalaliDate; max: JalaliDate } | null = null;
    private usePersianDigits = true;
    private showQuickButtons = true;
    private showHeader = false;
    private showBranding = true;
    private showStatus = true;
    private autoApplyOnSelect = false;
    private displayMode: DisplayMode = "overlay";
    private persianFontFamily: PersianFontFamily = "default";
    private activeInput: ActiveInput | null = null;
    private pickerMonth: JalaliDate = gregorianToJalali(new Date());
    private reportTitle = "";

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.root = document.createElement("div");
        this.root.className = "pc-root";
        options.element.appendChild(this.root);
        this.renderShell();
    }

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews?.[0];
        this.readSettings(dataView);
        this.dateSource = this.getDateSource(dataView);
        this.dataRange = getJalaliDataRange(this.getActiveCategory(dataView), this.dateSource?.role || null);
        this.applyLayoutSettings();
        this.updateDataRangeStatus();
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        switch (options.objectName) {
            case "calendar":
                return [{
                    objectName: "calendar",
                    properties: {
                        displayMode: this.displayMode,
                        usePersianDigits: this.usePersianDigits,
                        showHeader: this.showHeader,
                        showQuickButtons: this.showQuickButtons,
                        autoApplyOnSelect: this.autoApplyOnSelect,
                        showStatus: this.showStatus,
                        showBranding: this.showBranding,
                        persianFontFamily: this.persianFontFamily
                    },
                    selector: null
                }];
            default:
                return [];
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return {
            cards: [
                {
                    uid: "calendarCard",
                    displayName: "Calendar",
                    groups: [
                        {
                            uid: "calendarSettingsGroup",
                            displayName: "Calendar settings",
                            slices: [
                                {
                                    uid: "calendarDisplayMode",
                                    displayName: "Display mode",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.Dropdown,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "displayMode" },
                                            value: enumMember(this.displayMode, displayModeLabel(this.displayMode)),
                                            items: [
                                                enumMember("inline", "Inline below fields"),
                                                enumMember("overlay", "Overlay on fields"),
                                                enumMember("between", "Between style"),
                                                enumMember("modal", "Power BI modal dialog - experimental")
                                            ]
                                        } as any
                                    } as any
                                },
                                {
                                    uid: "calendarUsePersianDigits",
                                    displayName: "Use Persian digits",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "usePersianDigits" },
                                            value: this.usePersianDigits
                                        }
                                    }
                                },
                                {
                                    uid: "calendarPersianFontFamily",
                                    displayName: "Persian font",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.Dropdown,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "persianFontFamily" },
                                            value: enumMember(this.persianFontFamily, fontFamilyLabel(this.persianFontFamily)),
                                            items: [
                                                enumMember("default", "Default"),
                                                                        enumMember("segoe", "Segoe UI"),
                                                enumMember("calibri", "Calibri"),
                                                enumMember("tahoma", "Tahoma"),
                                                enumMember("arial", "Arial"),
                                                enumMember("vazirmatn", "Vazirmatn"),
                                                enumMember("iransans", "IRANSans"),
                                                enumMember("yekan", "Yekan Bakh")
                                            ]
                                        } as any
                                    } as any
                                },
                                {
                                    uid: "calendarShowInternalHeader",
                                    displayName: "Show internal header",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "showHeader" },
                                            value: this.showHeader
                                        }
                                    }
                                },
                                {
                                    uid: "calendarShowQuickButtons",
                                    displayName: "Show quick buttons",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "showQuickButtons" },
                                            value: this.showQuickButtons
                                        }
                                    }
                                },
                                {
                                    uid: "calendarAutoApply",
                                    displayName: "Auto apply after date select",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "autoApplyOnSelect" },
                                            value: this.autoApplyOnSelect
                                        }
                                    }
                                },
                                {
                                    uid: "calendarShowStatus",
                                    displayName: "Show filter summary",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "showStatus" },
                                            value: this.showStatus
                                        }
                                    }
                                },
                                {
                                    uid: "calendarShowBranding",
                                    displayName: "Show module name footer",
                                    description: "⚠ If you hide the module footer, please consider supporting open-source development: https://csc1.ir/donate/",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "showBranding" },
                                            value: this.showBranding
                                        }
                                    }
                                },
                                {
                                    uid: "calendarDonateInfo",
                                    displayName: "⚠ Support open-source development",
                                    description: "If you hide the module footer, please consider supporting open-source development.",
                                    control: {
                                        type: powerbi.visuals.FormattingComponent.TextInput,
                                        properties: {
                                            descriptor: { objectName: "calendar", propertyName: "donateInfo" },
                                            value: DONATE_NOTE,
                                            placeholder: "https://csc1.ir/donate/"
                                        } as any
                                    } as any
                                }
                            ]
                        }
                    ],
                    revertToDefaultDescriptors: [
                        { objectName: "calendar", propertyName: "displayMode" },
                        { objectName: "calendar", propertyName: "usePersianDigits" },
                        { objectName: "calendar", propertyName: "showHeader" },
                        { objectName: "calendar", propertyName: "showQuickButtons" },
                        { objectName: "calendar", propertyName: "autoApplyOnSelect" },
                        { objectName: "calendar", propertyName: "showStatus" },
                        { objectName: "calendar", propertyName: "showBranding" },
                        { objectName: "calendar", propertyName: "persianFontFamily" }
                    ]
                }
            ]
        };
    }

    private renderShell(): void {
        this.root.innerHTML = `
            <div class="pc-card pc-mode-overlay" dir="rtl">
                <div class="pc-header">
                    <div class="pc-title"></div>
                    <div class="pc-subtitle">انتخاب بازه تاریخ شمسی</div>
                </div>

                <div class="pc-body">
                    <div class="pc-fields">
                        <label class="pc-field">
                            <span>از تاریخ</span>
                            <div class="pc-input-wrap">
                                <input class="pc-input" data-role="from" placeholder="1403/01/01 یا 14030101" />
                                <button class="pc-calendar-button" data-picker="from" title="انتخاب تاریخ" aria-label="انتخاب تاریخ از">📅</button>
                            </div>
                        </label>
                        <label class="pc-field">
                            <span>تا تاریخ</span>
                            <div class="pc-input-wrap">
                                <input class="pc-input" data-role="to" placeholder="1403/01/31 یا 14030131" />
                                <button class="pc-calendar-button" data-picker="to" title="انتخاب تاریخ" aria-label="انتخاب تاریخ تا">📅</button>
                            </div>
                        </label>
                    </div>

                    <div class="pc-between-track" aria-hidden="true">
                        <span class="pc-between-handle pc-between-handle-start"></span>
                        <span class="pc-between-line"></span>
                        <span class="pc-between-handle pc-between-handle-end"></span>
                    </div>

                    <div class="pc-actions">
                        <button class="pc-button pc-primary" data-action="apply">اعمال فیلتر</button>
                        <button class="pc-button" data-action="clear">پاک کردن</button>
                    </div>

                    <div class="pc-quick-actions">
                        <button class="pc-chip" data-action="today">امروز</button>
                        <button class="pc-chip" data-action="current-month">ماه جاری</button>
                        <button class="pc-chip" data-action="current-year">سال جاری</button>
                    </div>

                    <div class="pc-status"></div>
                    <div class="pc-footer" role="link" tabindex="0" title="Mohammad Ghaheri on LinkedIn">
                        <div class="pc-footer-product">123 Persian Calendar Slicer</div>
                        <div class="pc-footer-author">By Mohammad Ghaheri</div>
                    </div>
                </div>
                <div class="pc-datepicker" hidden></div>
            </div>
        `;

        this.card = this.root.querySelector(".pc-card") as HTMLDivElement;
        this.header = this.root.querySelector(".pc-header") as HTMLDivElement;
        this.title = this.root.querySelector(".pc-title") as HTMLDivElement;
        this.body = this.root.querySelector(".pc-body") as HTMLDivElement;
        this.fromInput = this.root.querySelector("[data-role='from']") as HTMLInputElement;
        this.toInput = this.root.querySelector("[data-role='to']") as HTMLInputElement;
        this.fromPickerButton = this.root.querySelector("[data-picker='from']") as HTMLButtonElement;
        this.toPickerButton = this.root.querySelector("[data-picker='to']") as HTMLButtonElement;
        this.applyButton = this.root.querySelector("[data-action='apply']") as HTMLButtonElement;
        this.clearButton = this.root.querySelector("[data-action='clear']") as HTMLButtonElement;
        this.todayButton = this.root.querySelector("[data-action='today']") as HTMLButtonElement;
        this.currentMonthButton = this.root.querySelector("[data-action='current-month']") as HTMLButtonElement;
        this.currentYearButton = this.root.querySelector("[data-action='current-year']") as HTMLButtonElement;
        this.status = this.root.querySelector(".pc-status") as HTMLDivElement;
        this.footer = this.root.querySelector(".pc-footer") as HTMLDivElement;
        this.picker = this.root.querySelector(".pc-datepicker") as HTMLDivElement;

        this.applyButton.addEventListener("click", () => this.applyRangeFilter());
        this.clearButton.addEventListener("click", () => this.clearFilter());
        this.todayButton.addEventListener("click", () => this.setToday(true));
        this.currentMonthButton.addEventListener("click", () => this.setCurrentJalaliMonth(true));
        this.currentYearButton.addEventListener("click", () => this.setCurrentJalaliYear(true));

        this.fromPickerButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openPicker("from");
        });
        this.toPickerButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openPicker("to");
        });

        [this.fromInput, this.toInput].forEach((input) => {
            input.addEventListener("focus", () => this.openPicker(input === this.fromInput ? "from" : "to"));
            input.addEventListener("click", (event) => {
                event.stopPropagation();
                this.openPicker(input === this.fromInput ? "from" : "to");
            });
            input.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.key === "Enter") {
                    this.applyRangeFilter();
                }
                if (event.key === "Escape") {
                    this.closePicker();
                }
            });
            input.addEventListener("blur", () => {
                const parsed = parseJalaliDate(input.value);
                if (parsed) {
                    input.value = formatJalali(parsed, this.usePersianDigits);
                }
            });
        });

        this.picker.addEventListener("click", (event) => event.stopPropagation());
        document.addEventListener("click", () => this.closePicker());

        this.footer.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openLinkedIn();
        });
        this.footer.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.openLinkedIn();
            }
        });

    }

    private readSettings(dataView?: DataView): void {
        const objects = dataView?.metadata?.objects as any;
        this.reportTitle = String(objects?.title?.text || "");
        this.usePersianDigits = objects?.calendar?.usePersianDigits !== undefined
            ? Boolean(objects.calendar.usePersianDigits)
            : true;
        this.showQuickButtons = objects?.calendar?.showQuickButtons !== undefined
            ? Boolean(objects.calendar.showQuickButtons)
            : true;
        this.showHeader = objects?.calendar?.showHeader !== undefined
            ? Boolean(objects.calendar.showHeader)
            : false;
        this.showBranding = objects?.calendar?.showBranding !== undefined
            ? Boolean(objects.calendar.showBranding)
            : true;
        this.showStatus = objects?.calendar?.showStatus !== undefined
            ? Boolean(objects.calendar.showStatus)
            : true;
        this.autoApplyOnSelect = objects?.calendar?.autoApplyOnSelect !== undefined
            ? Boolean(objects.calendar.autoApplyOnSelect)
            : false;
        const displayMode = String(objects?.calendar?.displayMode || "overlay") as DisplayMode;
        this.displayMode = ["inline", "overlay", "between", "modal"].indexOf(displayMode) >= 0 ? displayMode : "overlay";
        const fontFamily = String(objects?.calendar?.persianFontFamily || "default") as PersianFontFamily;
        this.persianFontFamily = ["default", "segoe", "calibri", "tahoma", "arial", "vazirmatn", "iransans", "yekan"].indexOf(fontFamily) >= 0 ? fontFamily : "default";
    }

    private applyLayoutSettings(): void {
        this.header.style.display = this.showHeader ? "block" : "none";
        this.title.textContent = this.reportTitle || "انتخاب بازه تاریخ شمسی";
        this.todayButton.style.display = this.showQuickButtons ? "inline-flex" : "none";
        this.currentMonthButton.style.display = this.showQuickButtons ? "inline-flex" : "none";
        this.currentYearButton.style.display = this.showQuickButtons ? "inline-flex" : "none";
        this.footer.style.display = this.showBranding ? "block" : "none";
        this.status.style.display = this.showStatus ? "block" : "none";
        this.root.style.fontFamily = fontFamilyCss(this.persianFontFamily);
        ["pc-mode-inline", "pc-mode-overlay", "pc-mode-between", "pc-mode-modal"].forEach((cls) => this.card.classList.remove(cls));
        this.card.classList.add(`pc-mode-${this.displayMode}`);
    }

    private getActiveCategory(dataView?: DataView): DataViewCategoryColumn | undefined {
        const categories = dataView?.categorical?.categories || [];
        return categories.find((category) => Boolean((category.source as any)?.roles?.date))
            || categories.find((category) => Boolean((category.source as any)?.roles?.jalaliDateKey))
            || categories[0];
    }

    private getDateSource(dataView?: DataView): DateSource | null {
        const category = this.getActiveCategory(dataView);
        const queryName = category?.source?.queryName;
        if (!queryName || queryName.indexOf(".") < 0) {
            this.setStatus("یک ستون Gregorian Date یا Persian Date Key (yyyymmdd) به ویژوال اضافه کنید.", "warn");
            return null;
        }

        const firstDot = queryName.indexOf(".");
        const roles = (category?.source as any)?.roles || {};
        const role: "date" | "jalaliDateKey" = roles.jalaliDateKey ? "jalaliDateKey" : "date";
        const valueType = category?.source?.type;
        const isNumericKey = role === "jalaliDateKey" && Boolean(valueType?.numeric || valueType?.integer);
        return {
            target: {
                table: queryName.substring(0, firstDot),
                column: queryName.substring(firstDot + 1)
            },
            role,
            isNumericKey
        };
    }

    private updateDataRangeStatus(): void {
        if (!this.dateSource) {
            return;
        }
        const label = `${this.dateSource.target.table}.${this.dateSource.target.column}`;
        const sourceLabel = this.dateSource.role === "jalaliDateKey" ? "کلید شمسی yyyymmdd" : "تاریخ میلادی";
        if (!this.dataRange) {
            this.setStatus(`فیلتر روی ${sourceLabel} ${label} اعمال می‌شود.`, "info");
            return;
        }

        this.setStatus(
            `فیلتر روی ${sourceLabel}: ${label} | بازه داده: ${formatJalali(this.dataRange.min, this.usePersianDigits)} تا ${formatJalali(this.dataRange.max, this.usePersianDigits)}`,
            "info"
        );
    }

    private openPicker(inputName: ActiveInput): void {
        this.activeInput = inputName;
        const input = inputName === "from" ? this.fromInput : this.toInput;
        const parsed = parseJalaliDate(input.value);
        const todayJ = gregorianToJalali(new Date());
        this.pickerMonth = parsed || { jy: todayJ.jy, jm: todayJ.jm, jd: 1 };
        this.pickerMonth.jd = 1;
        this.renderPicker();
        this.positionPicker(input);
        this.picker.hidden = false;
    }

    private closePicker(): void {
        this.picker.hidden = true;
        this.activeInput = null;
    }

    private positionPicker(input: HTMLInputElement): void {
        const cardRect = this.card.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const horizontalPadding = cardRect.width < 260 ? 8 : 16;
        const pickerWidth = Math.min(292, Math.max(204, Math.floor(cardRect.width - horizontalPadding)));
        const maxHeight = Math.max(160, Math.floor(cardRect.height - 12));
        this.picker.style.width = `${pickerWidth}px`;
        this.picker.style.maxHeight = `${maxHeight}px`;
        this.picker.style.overflowY = "auto";
        this.picker.style.overflowX = "hidden";
        this.picker.classList.toggle("pc-picker-compact", pickerWidth < 272);
        this.picker.classList.toggle("pc-picker-tiny", pickerWidth < 232);

        if (this.displayMode === "inline") {
            const left = Math.max(4, Math.min(cardRect.width - pickerWidth - 4, inputRect.right - cardRect.left - pickerWidth));
            const top = inputRect.bottom - cardRect.top + 8;
            this.picker.style.left = `${left}px`;
            this.picker.style.top = `${top}px`;
            return;
        }

        // Overlay, modal fallback, and between mode: open inside the visual canvas.
        // Power BI/Report Server clips custom visuals, so the popup must remain inside the visual frame.
        const left = Math.max(4, Math.round((cardRect.width - pickerWidth) / 2));
        const top = 6;
        this.picker.style.left = `${left}px`;
        this.picker.style.top = `${top}px`;
    }

    private renderPicker(): void {
        const todayJ = gregorianToJalali(new Date());
        const selected = this.activeInput === "from" ? parseJalaliDate(this.fromInput.value) : parseJalaliDate(this.toInput.value);
        const days = this.getCalendarCells(this.pickerMonth.jy, this.pickerMonth.jm);
        const monthTitle = `${MONTH_NAMES_FA[this.pickerMonth.jm - 1]} ${this.usePersianDigits ? toPersianDigits(String(this.pickerMonth.jy)) : this.pickerMonth.jy}`;

        this.picker.innerHTML = `
            <div class="pc-picker-head">
                <button class="pc-picker-nav" data-picker-action="next" title="ماه بعد">‹</button>
                <div class="pc-picker-title">${monthTitle}</div>
                <button class="pc-picker-nav" data-picker-action="prev" title="ماه قبل">›</button>
            </div>
            <div class="pc-weekdays">
                ${WEEK_DAYS_FA.map((d) => `<span>${d}</span>`).join("")}
            </div>
            <div class="pc-days">
                ${days.map((day) => {
                    if (!day) return `<span class="pc-day pc-empty"></span>`;
                    const isToday = day.jy === todayJ.jy && day.jm === todayJ.jm && day.jd === todayJ.jd;
                    const isSelected = selected && day.jy === selected.jy && day.jm === selected.jm && day.jd === selected.jd;
                    const label = this.usePersianDigits ? toPersianDigits(String(day.jd)) : String(day.jd);
                    const cls = ["pc-day", isToday ? "pc-today" : "", isSelected ? "pc-selected" : ""].filter(Boolean).join(" ");
                    return `<button class="${cls}" data-jy="${day.jy}" data-jm="${day.jm}" data-jd="${day.jd}">${label}</button>`;
                }).join("")}
            </div>
            <div class="pc-picker-footer">
                <button class="pc-picker-link" data-picker-action="select-today">امروز</button>
                <button class="pc-picker-link" data-picker-action="close">بستن</button>
            </div>
        `;

        this.picker.querySelectorAll("[data-picker-action]").forEach((el) => {
            el.addEventListener("click", (event) => {
                const action = (event.currentTarget as HTMLElement).getAttribute("data-picker-action");
                this.handlePickerAction(action || "");
            });
        });

        this.picker.querySelectorAll(".pc-day[data-jy]").forEach((el) => {
            el.addEventListener("click", (event) => {
                const target = event.currentTarget as HTMLElement;
                const day: JalaliDate = {
                    jy: Number(target.getAttribute("data-jy")),
                    jm: Number(target.getAttribute("data-jm")),
                    jd: Number(target.getAttribute("data-jd"))
                };
                this.selectDay(day);
            });
        });
    }

    private getCalendarCells(jy: number, jm: number): Array<JalaliDate | null> {
        const firstG = jalaliToGregorian({ jy, jm, jd: 1 });
        const firstDate = new Date(firstG.gy, firstG.gm - 1, firstG.gd);
        const firstOffset = (firstDate.getDay() + 1) % 7; // Saturday-first grid
        const totalDays = jalaliMonthLength(jy, jm);
        const cells: Array<JalaliDate | null> = [];
        for (let i = 0; i < firstOffset; i += 1) cells.push(null);
        for (let jd = 1; jd <= totalDays; jd += 1) cells.push({ jy, jm, jd });
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }

    private handlePickerAction(action: string): void {
        if (action === "prev") {
            this.pickerMonth = addJalaliMonths(this.pickerMonth, -1);
            this.renderPicker();
            return;
        }
        if (action === "next") {
            this.pickerMonth = addJalaliMonths(this.pickerMonth, 1);
            this.renderPicker();
            return;
        }
        if (action === "select-today") {
            this.selectDay(gregorianToJalali(new Date()));
            return;
        }
        if (action === "close") {
            this.closePicker();
        }
    }

    private selectDay(day: JalaliDate): void {
        const input = this.activeInput === "to" ? this.toInput : this.fromInput;
        input.value = formatJalali(day, this.usePersianDigits);
        this.closePicker();
        if (this.autoApplyOnSelect && parseJalaliDate(this.fromInput.value) && parseJalaliDate(this.toInput.value)) {
            this.applyRangeFilter();
        }
    }

    private applyRangeFilter(): void {
        if (!this.dateSource) {
            this.setStatus("ابتدا ستون Gregorian Date یا Persian Date Key (yyyymmdd) را به ویژوال اضافه کنید.", "error");
            return;
        }

        const fromJ = parseJalaliDate(this.fromInput.value);
        const toJ = parseJalaliDate(this.toInput.value);

        if (!fromJ || !toJ) {
            this.setStatus("فرمت تاریخ باید شبیه ۱۴۰۳/۰۱/۰۱ یا 14030101 باشد.", "error");
            return;
        }

        const fromKey = jalaliToKey(fromJ);
        const toKey = jalaliToKey(toJ);
        if (fromKey > toKey) {
            this.setStatus("تاریخ شروع نباید بعد از تاریخ پایان باشد.", "error");
            return;
        }

        const target = {
            table: this.dateSource.target.table,
            column: this.dateSource.target.column
        };

        let filter: any;
        if (this.dateSource.role === "jalaliDateKey") {
            filter = {
                $schema: "https://powerbi.com/product/schema#advanced",
                target,
                logicalOperator: "And",
                conditions: [
                    {
                        operator: "GreaterThanOrEqual",
                        value: this.dateSource.isNumericKey ? fromKey : String(fromKey)
                    },
                    {
                        operator: "LessThanOrEqual",
                        value: this.dateSource.isNumericKey ? toKey : String(toKey)
                    }
                ]
            };
        } else {
            const fromG = jalaliToGregorian(fromJ);
            const toG = jalaliToGregorian(toJ);
            const fromDate = new Date(Date.UTC(fromG.gy, fromG.gm - 1, fromG.gd, 0, 0, 0, 0));
            const toDate = new Date(Date.UTC(toG.gy, toG.gm - 1, toG.gd, 23, 59, 59, 999));
            filter = {
                $schema: "https://powerbi.com/product/schema#advanced",
                target,
                logicalOperator: "And",
                conditions: [
                    {
                        operator: "GreaterThanOrEqual",
                        value: fromDate.toISOString()
                    },
                    {
                        operator: "LessThanOrEqual",
                        value: toDate.toISOString()
                    }
                ]
            };
        }

        this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
        this.fromInput.value = formatJalali(fromJ, this.usePersianDigits);
        this.toInput.value = formatJalali(toJ, this.usePersianDigits);
        const filterType = this.dateSource.role === "jalaliDateKey" ? "کلید شمسی" : "تاریخ میلادی";
        this.setStatus(`فیلتر ${filterType} اعمال شد: ${this.fromInput.value} تا ${this.toInput.value}`, "success");
    }

    private clearFilter(): void {
        this.host.applyJsonFilter(null, "general", "filter", powerbi.FilterAction.remove);
        this.fromInput.value = "";
        this.toInput.value = "";
        this.closePicker();
        this.setStatus("فیلتر تاریخ پاک شد.", "success");
    }

    private setToday(apply = false): void {
        const today = new Date();
        const j = gregorianToJalali(today);
        const value = formatJalali(j, this.usePersianDigits);
        this.fromInput.value = value;
        this.toInput.value = value;
        if (apply) this.applyRangeFilter();
    }

    private setCurrentJalaliMonth(apply = false): void {
        const today = new Date();
        const j = gregorianToJalali(today);
        const start: JalaliDate = { jy: j.jy, jm: j.jm, jd: 1 };
        const end: JalaliDate = { jy: j.jy, jm: j.jm, jd: jalaliMonthLength(j.jy, j.jm) };
        this.fromInput.value = formatJalali(start, this.usePersianDigits);
        this.toInput.value = formatJalali(end, this.usePersianDigits);
        if (apply) this.applyRangeFilter();
    }

    private setCurrentJalaliYear(apply = false): void {
        const today = new Date();
        const j = gregorianToJalali(today);
        const start: JalaliDate = { jy: j.jy, jm: 1, jd: 1 };
        const end: JalaliDate = { jy: j.jy, jm: 12, jd: jalaliMonthLength(j.jy, 12) };
        this.fromInput.value = formatJalali(start, this.usePersianDigits);
        this.toInput.value = formatJalali(end, this.usePersianDigits);
        if (apply) this.applyRangeFilter();
    }

    private openDonatePage(): void {
        this.launchUrl(DONATE_URL);
    }

    private openLinkedIn(): void {
        this.launchUrl(LINKEDIN_URL);
    }

    private launchUrl(url: string): void {
        try {
            const launcher = (this.host as any).launchUrl;
            if (typeof launcher === "function") {
                launcher.call(this.host, url);
                return;
            }
            window.open(url, "_blank", "noopener,noreferrer");
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    }

    private setStatus(message: string, type: "info" | "success" | "warn" | "error"): void {
        this.status.textContent = message;
        this.status.className = `pc-status pc-${type}`;
        this.status.style.display = this.showStatus ? "block" : "none";
    }
}

function getJalaliDataRange(category?: DataViewCategoryColumn, role?: "date" | "jalaliDateKey" | null): { min: JalaliDate; max: JalaliDate } | null {
    const values = category?.values;
    if (!values || values.length === 0 || !role) {
        return null;
    }
    let minKey: number | null = null;
    let maxKey: number | null = null;
    values.forEach((value) => {
        if (value === null || value === undefined) return;
        let j: JalaliDate | null = null;
        if (role === "jalaliDateKey") {
            j = parseJalaliDate(String(value));
        } else {
            const d = new Date(value as any);
            if (!isNaN(d.getTime())) j = gregorianToJalali(d);
        }
        if (!j) return;
        const key = jalaliToKey(j);
        if (minKey === null || key < minKey) minKey = key;
        if (maxKey === null || key > maxKey) maxKey = key;
    });
    return minKey !== null && maxKey !== null ? { min: keyToJalali(minKey), max: keyToJalali(maxKey) } : null;
}

function normalizeDigits(value: string): string {
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    return value
        .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
        .replace(/-/g, "/")
        .replace(/\./g, "/")
        .trim();
}

function parseJalaliDate(value: string): JalaliDate | null {
    const normalized = normalizeDigits(value);
    let match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
        match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
    }
    if (!match) return null;
    const jy = Number(match[1]);
    const jm = Number(match[2]);
    const jd = Number(match[3]);
    if (jm < 1 || jm > 12) return null;
    if (jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
    return { jy, jm, jd };
}

function keyToJalali(key: number): JalaliDate {
    const s = String(Math.round(key)).padStart(8, "0");
    const parsed = parseJalaliDate(s);
    return parsed || { jy: 1300, jm: 1, jd: 1 };
}

function jalaliToKey(j: JalaliDate): number {
    return Number(`${j.jy}${String(j.jm).padStart(2, "0")}${String(j.jd).padStart(2, "0")}`);
}

function formatJalali(j: JalaliDate, usePersianDigits: boolean): string {
    const raw = `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
    return usePersianDigits ? toPersianDigits(raw) : raw;
}

function toPersianDigits(value: string): string {
    const digits = "۰۱۲۳۴۵۶۷۸۹";
    return value.replace(/\d/g, (d) => digits[Number(d)]);
}

function addJalaliMonths(j: JalaliDate, count: number): JalaliDate {
    let jy = j.jy;
    let jm = j.jm + count;
    while (jm < 1) {
        jm += 12;
        jy -= 1;
    }
    while (jm > 12) {
        jm -= 12;
        jy += 1;
    }
    return { jy, jm, jd: 1 };
}

function jalaliMonthLength(jy: number, jm: number): number {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isJalaliLeapYear(jy) ? 30 : 29;
}

function isJalaliLeapYear(jy: number): boolean {
    return jalCal(jy).leap === 0;
}

function div(a: number, b: number): number {
    return ~~(a / b);
}

function mod(a: number, b: number): number {
    return a - ~~(a / b) * b;
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jm = 0;
    let jump = 0;

    if (jy < jp || jy >= breaks[bl - 1]) {
        throw new Error("Invalid Jalali year");
    }

    for (let i = 1; i < bl; i += 1) {
        jm = breaks[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
    }

    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) {
        leapJ += 1;
    }

    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;

    if (jump - n < 6) {
        n = n - jump + div(jump + 4, 33) * 33;
    }
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;

    return { leap, gy, march };
}

function jalaliToGregorian(j: JalaliDate): { gy: number; gm: number; gd: number } {
    const r = jalCal(j.jy);
    const gy = r.gy;
    const march = r.march;
    const jdn1f = gregorianToJdn(gy, 3, march);
    const jdNo = j.jd + (j.jm <= 7 ? (j.jm - 1) * 31 : (j.jm - 7) * 30 + 186) - 1;
    return jdnToGregorian(jdn1f + jdNo);
}

function gregorianToJalali(date: Date): JalaliDate {
    const gy = date.getFullYear();
    const gm = date.getMonth() + 1;
    const gd = date.getDate();
    const jdn = gregorianToJdn(gy, gm, gd);
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = gregorianToJdn(gy, 3, r.march);
    let k = jdn - jdn1f;

    if (k >= 0) {
        if (k <= 185) {
            return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
        }
        k -= 186;
    } else {
        jy -= 1;
        k += 179;
        if (r.leap === 1) k += 1;
    }

    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function gregorianToJdn(gy: number, gm: number, gd: number): number {
    const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
        + div(153 * mod(gm + 9, 12) + 2, 5)
        + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
}
