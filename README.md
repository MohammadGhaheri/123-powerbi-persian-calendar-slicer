# 123 Persian Calendar Slicer for Power BI

**123 Persian Calendar Slicer** is a Power BI Custom Visual for selecting a **Persian/Jalali date range** and applying the corresponding filter to a Power BI report.

Developed by **Mohammad Ghaheri**  
LinkedIn: <https://www.linkedin.com/in/mohammadghaheri/>

---

## Why this visual exists

The native Power BI date slicer works with Gregorian calendar date ranges. For Persian-speaking users and Iranian BI reports, this often creates an awkward user experience: the model may be technically correct, but report consumers still need to select dates in the Persian/Jalali calendar.

This visual solves that gap by showing a Persian/Jalali date picker while applying a standard Power BI filter behind the scenes.

---

## Current version

**Version:** `0.7.0.0`

---

## Main features

- Persian/Jalali date range selection.
- Popup-style Jalali DatePicker.
- Overlay mode opens the DatePicker from the top of the visual to reduce clipping and avoid needing extra blank space below the slicer.
- Inline mode for maximum compatibility.
- Between-style layout inspired by the native Power BI date range slicer.
- Supports Gregorian Date/DateTime columns.
- Supports Persian/Jalali date keys in `yyyymmdd` format.
- Supports Persian and English digits.
- Optional automatic filter application after date selection.
- Quick actions: Today, Current Jalali Month, Current Jalali Year.
- Optional filter summary/status text.
- Configurable Persian font family.
- Optional small footer branding.
- Footer attribution: `By Mohammad Ghaheri`, linked to the developer's LinkedIn profile.
- Open-source support notice when the module footer is hidden, linked to <https://csc1.ir/donate/>.

---

## Supported input fields

The visual supports two alternative date input roles. In most reports, use only one of them.

### 1. Gregorian Date

Use this when your model has a normal Power BI Date/DateTime column.

Example model column:

```text
Date[GregorianDate]
```

Behavior:

```text
User selects Jalali range
        ↓
Visual converts Jalali to Gregorian
        ↓
Visual applies Advanced Filter to the Gregorian Date column
```

This is the recommended mode when your data model has a proper Date table.

### 2. Persian Date Key (yyyymmdd)

Use this when your model stores dates only as Persian/Jalali keys.

Recommended format:

```text
yyyymmdd
```

Examples:

```text
14030101
14030631
14031229
```

Behavior:

```text
User selects Jalali range
        ↓
Visual converts selected dates to numeric yyyymmdd keys
        ↓
Visual applies range filter directly to the Persian Date Key field
```

This mode is useful when the dataset is already built around Jalali keys and does not contain a Gregorian date column.

---

## Manual date input formats

The visual accepts both Persian and English digits.

Supported examples:

```text
1403/01/01
۱۴۰۳/۰۱/۰۱
14030101
۱۴۰۳۰۱۰۱
```

---

## Format pane options

The visual exposes these options in the Power BI Format pane:

### Calendar settings

- **Display mode**
  - Inline below fields
  - Overlay on fields
  - Between style
  - Power BI modal dialog - experimental

- **Use Persian digits**
  - Shows visual dates with Persian digits when enabled.

- **Persian font**
  - Default
  - Segoe UI
  - Calibri
  - Tahoma
  - Arial
  - Vazirmatn
  - IRANSans
  - Yekan Bakh

- **Show internal header**
  - Shows/hides the internal title inside the visual.
  - Default is off so the report can use the standard Power BI visual title instead.

- **Show quick buttons**
  - Shows/hides quick action buttons.

- **Auto apply after date select**
  - Automatically applies the filter after selecting a date.

- **Show filter summary**
  - Shows/hides the text summary such as selected range and active filter field.

- **Show module name footer**
  - Shows/hides the small module footer.
  - When disabled, the visual shows a support notice with a donation link: <https://csc1.ir/donate/>.

---

## Recommended report setup

### Best-practice setup

Use a standard Date table with a real Gregorian Date column, plus Jalali helper columns if needed.

Example:

```text
Date
- GregorianDate      Date/DateTime
- JalaliYear         Whole number
- JalaliMonthNo      Whole number
- JalaliMonthName    Text
- JalaliDateKey      Whole number, yyyymmdd
- JalaliDateText     Text
```

Then bind `Date[GregorianDate]` to the visual's **Gregorian Date** field.

### Alternative setup

If your data model only has a Jalali key, bind the numeric `yyyymmdd` field to **Persian Date Key (yyyymmdd)**.

---

## Usage in Power BI Desktop

1. Import the `.pbiviz` file into Power BI Desktop.
2. Add the visual to the report page.
3. Drag one field into the visual:
   - `Gregorian Date`, or
   - `Persian Date Key (yyyymmdd)`
4. Select the start and end Jalali dates.
5. Click **اعمال فیلتر** or enable **Auto apply after date select**.

---

## Build from source

Install Node.js and Power BI Visuals Tools:

```bash
npm install -g powerbi-visuals-tools
```

Install dependencies and build:

```bash
npm install
npm run package
```

The generated `.pbiviz` file will be created under the `dist/` directory.

---

## Project structure

```text
123-persian-calendar-slicer/
├─ assets/
│  └─ icon.png
├─ src/
│  └─ visual.ts
├─ style/
│  └─ visual.less
├─ capabilities.json
├─ package.json
├─ pbiviz.json
├─ tsconfig.json
└─ README.md
```

---

## GitHub publishing notes

Suggested repository name:

```text
123-powerbi-persian-calendar-slicer
```

Suggested description:

```text
A Power BI Custom Visual for selecting Persian/Jalali date ranges and filtering Gregorian Date columns or Jalali yyyymmdd date keys.
```

Suggested topics:

```text
powerbi custom-visual persian-calendar jalali-calendar datepicker slicer business-intelligence
```

Suggested release asset:

```text
123PersianCalendarSlicer-0.7.0.0.pbiviz
```

---

## Developer

**Mohammad Ghaheri**  
Technology and product leader in BI, data platforms, smart mobility, and Power BI education.

LinkedIn: <https://www.linkedin.com/in/mohammadghaheri/>

---

## Version history


### v0.7.0.0

- Added **Calibri** to the Persian font selector.
- Kept **Overlay on fields** as the default display mode.
- Improved Overlay/Between popup positioning so the DatePicker opens from the top of the visual, reducing bottom clipping in Power BI Desktop and Report Server.
- Added max-height and internal scrolling to the popup DatePicker for small visual containers.
- Added a donation/support warning when **Show module name footer** is turned off.
- Donation/support notice links to <https://csc1.ir/donate/>.

### v0.6.0.0

- Added Format option to show/hide the filter summary/status text.
- Added Persian font selector in the Format pane.
- Added footer attribution: `By Mohammad Ghaheri` under `123 Persian Calendar Slicer`.
- Footer attribution links to Mohammad Ghaheri's LinkedIn profile.
- Expanded README for GitHub publishing.

### v0.5.0.0

- Added two alternative field roles:
  - Gregorian Date
  - Persian Date Key (`yyyymmdd`)
- Added support for filtering Jalali key-based models directly.
- Added support for compact Jalali date input such as `14030101`.
- Moved product name to a small footer.
- Made the internal visual header optional.
- Added Format pane settings for display mode and behavior.

### v0.4.0.0

- Fixed stylesheet bundling by importing `visual.less` from `visual.ts`.
- Improved popup/card DatePicker styling.
- Hardened hidden popup behavior.

### v0.3.0.0

- Added popup DatePicker behavior.
- Added display mode foundation.
- Added early Between-style layout.

### v0.2.0.0

- Added embedded Persian/Jalali DatePicker logic.
- Added Today and Current Month quick actions.

### v0.1.0.0

- Initial MVP with two Jalali text inputs and Advanced Filter application.

---

## License

MIT License. See `LICENSE`.
