# Smart Calendar Builder

A fully offline, browser-based generator for printable continuous-day calendars and planning grids.

## Run

Open `index.html` in a modern browser. No installation or web server is required.

## Core calendar controls

- Choose any start date.
- Generate from 1 to 1,000 consecutive days.
- Use from 1 to 31 logical days per row.
- Use automatic pagination or choose up to 40 rows per page.
- Print on A4, A3, Letter, or Legal paper in portrait or landscape orientation.
- Use `17/7`, `17/07`, `17`, `17-7`, or a custom date template.
- Show or hide weekday names, month names, years, page numbers, and sequential labels.
- Month headings group months by year correctly, such as `July · August · September 2026` or `December 2026 · January 2027`.

## Day and companion boxes

Every date can have 0–5 attached companion boxes for goals, tasks, habits, notes, or other planning fields.

- Place companion boxes beside or below the date box.
- Date and companion boxes are kept together as one unbreakable day group.
- When boxes are beside the date, the app dynamically limits days per row so no row exceeds 31 physical boxes.
  - Example: 1 date box + 5 companion boxes = 6 boxes per day, so the maximum becomes 5 days per row.
- Give boxes custom labels separated by commas or new lines.
- Give companion boxes their own fill, shape, border, writing mode, and number of writing items.

## Writing modes

Both date boxes and companion boxes can use:

- Completely blank space
- Ruled writing lines
- Dot grid
- Checkbox plus writing line
- Checkboxes only, with a user-selected checkbox count

## Styling

- Square, soft-corner, rounded, extra-rounded, raised-card, and custom-radius boxes
- Solid, dashed, dotted, double, or borderless outlines
- Adjustable font sizes, border widths, corner radius, spacing, page margins, and preview zoom
- System, serif, monospace, and rounded font families

## Colors

- Color individual selected days.
- Drag-select or Shift-click a date range.
- Mass-select and color by date range, weekday, month, every Nth day, or all days.
- Set global day-box fill and weekend fill.
- Choose exactly which weekdays count as weekends.
- Set a page/background color that colors empty paper and gaps without changing the box fills.
- Apply a month palette directly to every day.
- Use a separate action to write or erase month names.

## History and safety

- Undo button and `Ctrl+Z`
- Redo button and `Ctrl+Y` or `Ctrl+Shift+Z`
- Confirmation warnings before importing, loading presets, resetting, or overwriting custom fills with month colors
- Up to 80 undo snapshots

When typing inside a text or number input, the browser's normal text undo remains available. Click outside the input or use the Undo button to undo full calendar changes.

## Named presets

- Save multiple presets under unique user-defined names.
- Load or delete any saved preset.
- Replacing an existing name requires confirmation.
- Presets normally persist in browser storage; if storage is unavailable, they remain available for the current open session.
- Export and import the complete configuration as JSON.

## Save as PDF

1. Click **Print / Save PDF**.
2. Choose **Save as PDF** in the browser print dialog.
3. Enable **Background graphics** for accurate fills and month colors.
4. Keep the print scale at 100% unless the browser preview shows clipping.
