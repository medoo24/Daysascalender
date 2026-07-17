(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  const PAPER_SIZES = {
    A4: { portrait: [210, 297], landscape: [297, 210] },
    A3: { portrait: [297, 420], landscape: [420, 297] },
    Letter: { portrait: [215.9, 279.4], landscape: [279.4, 215.9] },
    Legal: { portrait: [215.9, 355.6], landscape: [355.6, 215.9] }
  };

  const MONTH_PALETTE = [
    "#fee2e2", "#ffedd5", "#fef3c7", "#ecfccb",
    "#dcfce7", "#ccfbf1", "#cffafe", "#dbeafe",
    "#e0e7ff", "#ede9fe", "#fae8ff", "#fce7f3"
  ];

  const defaultState = {
    startDate: todayISO(),
    totalDays: 70,
    daysPerRow: 7,
    rowsPerPageMode: "auto",
    rowsPerPage: 7,
    showWeekday: true,
    dateFormat: "d/m",
    weekdayFormat: "short",
    customTemplate: "{d}/{m}",
    calendarTitle: "70-Day Plan",
    calendarSubtitle: "",
    paperSize: "A4",
    orientation: "landscape",
    pageMargin: 10,
    cellGap: 2,
    autoFit: true,
    preferredPages: "auto",
    writingStyle: "blank",
    writingLines: 4,
    cellMinHeight: 35,
    titleSize: 24,
    dateSize: 18,
    weekdaySize: 11,
    yearSize: 14,
    borderWidth: 1,
    cornerRadius: 8,
    fontFamily: "system",
    dateAlignment: "left",
    boldYear: true,
    showPageNumber: true,
    activeColor: "#dbeafe",
    activeTextColor: "#172033",
    monthColorCoding: false,
    monthDisplay: "pageHeading",
    yearDisplay: "pageHeading",
    highlightWeekends: false,
    weekendColor: "#f8fafc",
    globalCellColor: "#ffffff",
    showDayIndex: false,
    dayIndexLabel: "Day",
    includeBlankCells: true,
    previewZoom: 70
  };

  let state = structuredClone(defaultState);
  let dayStyles = {};
  let selected = new Set();
  let lastSelectedIndex = null;
  let isDragging = false;
  let dragMode = "select";
  let renderTimer = null;

  const inputIds = [
    "startDate", "totalDays", "daysPerRow", "rowsPerPageMode", "rowsPerPage",
    "showWeekday", "dateFormat", "weekdayFormat", "customTemplate",
    "calendarTitle", "calendarSubtitle", "paperSize", "orientation",
    "pageMargin", "cellGap", "autoFit", "preferredPages", "writingStyle",
    "writingLines", "cellMinHeight", "titleSize", "dateSize", "weekdaySize",
    "yearSize", "borderWidth", "cornerRadius", "fontFamily", "dateAlignment",
    "boldYear", "showPageNumber", "activeColor", "activeTextColor",
    "monthColorCoding", "monthDisplay", "yearDisplay", "highlightWeekends",
    "weekendColor", "globalCellColor", "showDayIndex", "dayIndexLabel",
    "includeBlankCells", "previewZoom"
  ];

  const numericIds = new Set([
    "totalDays", "daysPerRow", "rowsPerPage", "pageMargin", "cellGap",
    "writingLines", "cellMinHeight", "titleSize", "dateSize", "weekdaySize",
    "yearSize", "borderWidth", "cornerRadius", "previewZoom"
  ]);

  const checkboxIds = new Set([
    "showWeekday", "autoFit", "boldYear", "showPageNumber", "monthColorCoding",
    "highlightWeekends", "showDayIndex", "includeBlankCells"
  ]);

  function todayISO() {
    const d = new Date();
    return toISODate(d);
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function addDays(date, count) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + count);
    return copy;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function uniqueBy(items, getKey) {
    const seen = new Set();
    return items.filter(item => {
      const key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getDates() {
    const start = parseLocalDate(state.startDate);
    return Array.from({ length: state.totalDays }, (_, index) => {
      const date = addDays(start, index);
      return {
        index,
        date,
        iso: toISODate(date),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      };
    });
  }

  function syncInputsFromState() {
    inputIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (checkboxIds.has(id)) {
        el.checked = Boolean(state[id]);
      } else {
        el.value = state[id];
      }
    });
    updateConditionalFields();
    updateRangeOutputs();
  }

  function syncStateFromInput(id) {
    const el = $(id);
    if (!el) return;

    if (checkboxIds.has(id)) {
      state[id] = el.checked;
    } else if (numericIds.has(id)) {
      const parsed = Number(el.value);
      state[id] = Number.isFinite(parsed) ? parsed : defaultState[id];
    } else {
      state[id] = el.value;
    }

    sanitizeState();
  }

  function sanitizeState() {
    state.totalDays = clamp(Math.round(state.totalDays || 1), 1, 1000);
    state.daysPerRow = clamp(Math.round(state.daysPerRow || 1), 1, 31);
    state.rowsPerPage = clamp(Math.round(state.rowsPerPage || 1), 1, 40);
    state.pageMargin = clamp(Number(state.pageMargin || 0), 3, 30);
    state.cellGap = clamp(Number(state.cellGap || 0), 0, 10);
    state.writingLines = clamp(Math.round(state.writingLines || 1), 1, 12);
    state.cellMinHeight = clamp(Number(state.cellMinHeight || 15), 15, 120);
    state.previewZoom = clamp(Number(state.previewZoom || 70), 35, 120);
  }

  function updateConditionalFields() {
    $("customRowsField").hidden = state.rowsPerPageMode !== "custom";
    $("customTemplateField").hidden = state.dateFormat !== "custom";

    const rule = $("massRule").value;
    ["DateRange", "Weekday", "Month", "EveryNth"].forEach(name => {
      $(`rule${name}`).hidden = rule !== name.charAt(0).toLowerCase() + name.slice(1);
    });
  }

  function updateRangeOutputs() {
    [
      ["titleSize", "px"],
      ["dateSize", "px"],
      ["weekdaySize", "px"],
      ["yearSize", "px"],
      ["borderWidth", "px"],
      ["cornerRadius", "px"],
      ["previewZoom", "%"]
    ].forEach(([id, unit]) => {
      const out = $(`${id}Out`);
      if (out) out.textContent = `${state[id]}${unit}`;
    });
  }

  function getPaperDimensions() {
    return PAPER_SIZES[state.paperSize][state.orientation];
  }

  function calculateLayout() {
    const [paperWidth, paperHeight] = getPaperDimensions();
    const usableWidth = paperWidth - state.pageMargin * 2;
    const usableHeight = paperHeight - state.pageMargin * 2;

    const totalRows = Math.ceil(state.totalDays / state.daysPerRow);
    let rowsPerPage;

    if (state.rowsPerPageMode === "custom") {
      rowsPerPage = state.rowsPerPage;
    } else {
      const headingReserve = 25;
      const legendReserve = ["legendOnly"].includes(state.monthDisplay) || ["legend", "both"].includes(state.yearDisplay) ? 10 : 2;
      const footerReserve = state.showPageNumber ? 7 : 3;
      const gridHeight = Math.max(25, usableHeight - headingReserve - legendReserve - footerReserve);
      const minRowHeight = state.autoFit ? Math.max(18, state.cellMinHeight * 0.76) : state.cellMinHeight;
      const maxRowsByHeight = Math.max(1, Math.floor((gridHeight + state.cellGap) / (minRowHeight + state.cellGap)));

      if (state.preferredPages !== "auto") {
        const targetPages = Math.max(1, Number(state.preferredPages));
        rowsPerPage = Math.ceil(totalRows / targetPages);
      } else {
        rowsPerPage = Math.min(totalRows, maxRowsByHeight);
      }
    }

    rowsPerPage = clamp(rowsPerPage, 1, Math.max(1, totalRows));
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const rowsOnFullPage = rowsPerPage;

    const headingReserve = 25;
    const legendReserve = ["legendOnly"].includes(state.monthDisplay) || ["legend", "both"].includes(state.yearDisplay) ? 10 : 2;
    const footerReserve = state.showPageNumber ? 7 : 3;
    const estimatedCellHeight = Math.max(
      14,
      (usableHeight - headingReserve - legendReserve - footerReserve - (rowsOnFullPage - 1) * state.cellGap) / rowsOnFullPage
    );

    const estimatedCellWidth = Math.max(
      12,
      (usableWidth - (state.daysPerRow - 1) * state.cellGap) / state.daysPerRow
    );

    let dateSize = state.dateSize;
    let weekdaySize = state.weekdaySize;
    let titleSize = state.titleSize;
    let yearSize = state.yearSize;

    if (state.autoFit) {
      const widthFactor = clamp(estimatedCellWidth / 34, 0.58, 1.2);
      const heightFactor = clamp(estimatedCellHeight / 35, 0.58, 1.2);
      const factor = Math.min(widthFactor, heightFactor);
      dateSize = Math.round(clamp(state.dateSize * factor, 9, state.dateSize));
      weekdaySize = Math.round(clamp(state.weekdaySize * factor, 7, state.weekdaySize));
      titleSize = Math.round(clamp(state.titleSize * clamp(usableWidth / 260, 0.72, 1.15), 14, state.titleSize));
      yearSize = Math.round(clamp(state.yearSize * clamp(usableWidth / 260, 0.72, 1.1), 9, state.yearSize));
    }

    return {
      paperWidth,
      paperHeight,
      usableWidth,
      usableHeight,
      totalRows,
      rowsPerPage,
      pageCount,
      estimatedCellHeight,
      estimatedCellWidth,
      dateSize,
      weekdaySize,
      titleSize,
      yearSize
    };
  }

  function applyRootVariables(layout) {
    root.style.setProperty("--paper-width", `${layout.paperWidth}mm`);
    root.style.setProperty("--paper-height", `${layout.paperHeight}mm`);
    root.style.setProperty("--page-margin", `${state.pageMargin}mm`);
    root.style.setProperty("--cell-gap", `${state.cellGap}mm`);
    root.style.setProperty("--cell-height", `${layout.estimatedCellHeight}mm`);
    root.style.setProperty("--days-per-row", state.daysPerRow);
    root.style.setProperty("--title-size", `${layout.titleSize}px`);
    root.style.setProperty("--date-size", `${layout.dateSize}px`);
    root.style.setProperty("--weekday-size", `${layout.weekdaySize}px`);
    root.style.setProperty("--year-size", `${layout.yearSize}px`);
    root.style.setProperty("--border-width", `${state.borderWidth}px`);
    root.style.setProperty("--corner-radius", `${state.cornerRadius}px`);
    root.style.setProperty("--date-alignment", state.dateAlignment);
    root.style.setProperty("--calendar-font", fontStack(state.fontFamily));
    root.style.setProperty("--preview-zoom", state.previewZoom / 100);
    root.style.setProperty("--print-page-size", `${state.paperSize} ${state.orientation}`);
    updatePrintPageStyle();
  }

  function updatePrintPageStyle() {
    let style = document.getElementById("dynamicPrintPageStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "dynamicPrintPageStyle";
      document.head.appendChild(style);
    }
    style.textContent = `@media print { @page { size: ${state.paperSize} ${state.orientation}; margin: 0; } }`;
  }

  function fontStack(value) {
    const stacks = {
      system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace',
      rounded: '"Arial Rounded MT Bold", "Trebuchet MS", ui-sans-serif, sans-serif'
    };
    return stacks[value] || stacks.system;
  }

  function formatDateLabel(date) {
    const d = date.getDate();
    const dd = String(d).padStart(2, "0");
    const m = date.getMonth() + 1;
    const mm = String(m).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    const yyyy = date.getFullYear();
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);

    if (state.dateFormat === "d/m") return `${d}/${m}`;
    if (state.dateFormat === "dd/mm") return `${dd}/${mm}`;
    if (state.dateFormat === "d") return `${d}`;
    if (state.dateFormat === "d-m") return `${d}-${m}`;

    return state.customTemplate
      .replaceAll("{d}", d)
      .replaceAll("{dd}", dd)
      .replaceAll("{m}", m)
      .replaceAll("{mm}", mm)
      .replaceAll("{yy}", yy)
      .replaceAll("{yyyy}", yyyy)
      .replaceAll("{weekday}", weekday)
      .replaceAll("{weekdayShort}", weekdayShort);
  }

  function formatWeekday(date) {
    return new Intl.DateTimeFormat(undefined, { weekday: state.weekdayFormat }).format(date);
  }

  function monthName(date, style = "long") {
    return new Intl.DateTimeFormat(undefined, { month: style }).format(date);
  }

  function yearSet(items) {
    return [...new Set(items.map(item => item.date.getFullYear()))];
  }

  function monthSet(items) {
    return uniqueBy(items, item => item.monthKey);
  }

  function periodText(items) {
    if (!items.length) return "";
    const months = monthSet(items);
    const years = yearSet(items);
    const monthText = months.map(item => `${monthName(item.date)} ${item.date.getFullYear()}`).join(" · ");
    const yearText = years.join(" / ");

    const showMonthHeading = state.monthDisplay === "pageHeading";
    const showYearHeading = ["pageHeading", "both"].includes(state.yearDisplay);

    if (showMonthHeading && showYearHeading) return monthText;
    if (showMonthHeading) return months.map(item => monthName(item.date)).join(" · ");
    if (showYearHeading) return yearText;
    return "";
  }

  function buildWritingArea(container) {
    container.className = `writing-area ${state.writingStyle}`;
    container.innerHTML = "";
    container.style.setProperty("--writing-line-step", `${100 / state.writingLines}%`);

    if (state.writingStyle === "checklist") {
      for (let i = 0; i < state.writingLines; i++) {
        const row = document.createElement("div");
        row.className = "checklist-row";
        row.innerHTML = '<span class="checklist-box"></span><span class="checklist-line"></span>';
        container.appendChild(row);
      }
    }
  }

  function styleForDay(item) {
    const custom = dayStyles[item.iso] || {};
    let fill = state.globalCellColor;
    let text = "#172033";

    if (state.highlightWeekends && [0, 6].includes(item.date.getDay())) {
      fill = state.weekendColor;
    }

    if (state.monthColorCoding) {
      fill = MONTH_PALETTE[item.date.getMonth() % MONTH_PALETTE.length];
    }

    if (custom.fill) fill = custom.fill;
    if (custom.text) text = custom.text;

    return { fill, text };
  }

  function createDayCell(item, pageItems) {
    const node = $("dayCellTemplate").content.firstElementChild.cloneNode(true);
    node.classList.add("selectable");
    node.dataset.index = item.index;
    node.dataset.iso = item.iso;

    if (selected.has(item.index)) node.classList.add("selected");

    node.querySelector(".weekday-label").textContent = state.showWeekday ? formatWeekday(item.date) : "";
    node.querySelector(".date-label").textContent = formatDateLabel(item.date);
    node.querySelector(".day-index").textContent = state.showDayIndex
      ? `${state.dayIndexLabel || "Day"} ${item.index + 1}`
      : "";

    const isFirstCalendarDay = item.index === 0;
    const prev = item.index > 0 ? addDays(item.date, -1) : null;
    const isFirstOfMonth = item.date.getDate() === 1 ||
      isFirstCalendarDay ||
      (prev && prev.getMonth() !== item.date.getMonth());

    const badge = node.querySelector(".month-badge");
    if (state.monthDisplay === "cellBadge" && isFirstOfMonth) {
      badge.textContent = monthName(item.date);
      badge.classList.add("visible");
    }

    buildWritingArea(node.querySelector(".writing-area"));

    const dayStyle = styleForDay(item);
    node.style.setProperty("--cell-fill", dayStyle.fill);
    node.style.setProperty("--cell-text", dayStyle.text);

    attachCellSelection(node, item.index);
    return node;
  }

  function createBlankCell() {
    const node = $("dayCellTemplate").content.firstElementChild.cloneNode(true);
    node.classList.add("blank-cell");
    node.setAttribute("aria-hidden", "true");
    node.querySelector(".weekday-label").textContent = "";
    node.querySelector(".date-label").textContent = "";
    node.querySelector(".day-index").textContent = "";
    buildWritingArea(node.querySelector(".writing-area"));
    node.style.setProperty("--cell-fill", state.globalCellColor);
    return node;
  }

  function attachCellSelection(node, index) {
    node.addEventListener("mousedown", event => {
      event.preventDefault();
      isDragging = true;
      dragMode = selected.has(index) ? "deselect" : "select";
      handleCellSelection(index, event.shiftKey, dragMode);
    });

    node.addEventListener("mouseenter", () => {
      if (!isDragging) return;
      handleCellSelection(index, false, dragMode);
    });

    node.addEventListener("click", event => {
      if (event.detail === 0) handleCellSelection(index, event.shiftKey, "toggle");
    });
  }

  function handleCellSelection(index, shiftKey, mode = "toggle") {
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) selected.add(i);
    } else {
      if (mode === "select") selected.add(index);
      else if (mode === "deselect") selected.delete(index);
      else if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      lastSelectedIndex = index;
    }
    updateSelectionUI();
    updateCellSelectionClasses();
  }

  function updateCellSelectionClasses() {
    document.querySelectorAll(".day-cell[data-index]").forEach(cell => {
      cell.classList.toggle("selected", selected.has(Number(cell.dataset.index)));
    });
  }

  function updateSelectionUI() {
    $("selectionCount").textContent = `${selected.size} day${selected.size === 1 ? "" : "s"} selected`;
  }

  function buildLegend(items) {
    const showLegend = state.monthDisplay === "legendOnly" ||
      ["legend", "both"].includes(state.yearDisplay) ||
      state.monthColorCoding;

    if (!showLegend) return null;

    const legend = document.createElement("div");
    legend.className = "month-legend";

    if (state.monthDisplay === "legendOnly" || state.monthColorCoding) {
      monthSet(items).forEach(item => {
        const legendItem = document.createElement("span");
        legendItem.className = "legend-item";
        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";
        swatch.style.background = MONTH_PALETTE[item.date.getMonth() % MONTH_PALETTE.length];

        const label = document.createElement("span");
        label.textContent = `${monthName(item.date)} ${item.date.getFullYear()}`;

        legendItem.append(swatch, label);
        legend.appendChild(legendItem);
      });
    }

    if (["legend", "both"].includes(state.yearDisplay)) {
      const year = document.createElement("span");
      year.className = `legend-year${state.boldYear ? " bold" : ""}`;
      year.textContent = yearSet(items).join(" / ");
      legend.appendChild(year);
    }

    return legend;
  }

  function render() {
    sanitizeState();
    const dates = getDates();
    const layout = calculateLayout();
    applyRootVariables(layout);
    updateMonthRule(dates);

    const preview = $("calendarPreview");
    preview.innerHTML = "";

    const rows = [];
    for (let i = 0; i < dates.length; i += state.daysPerRow) {
      rows.push(dates.slice(i, i + state.daysPerRow));
    }

    const pages = [];
    for (let i = 0; i < rows.length; i += layout.rowsPerPage) {
      pages.push(rows.slice(i, i + layout.rowsPerPage));
    }

    pages.forEach((pageRows, pageIndex) => {
      const pageItems = pageRows.flat();
      const shell = document.createElement("div");
      shell.className = "calendar-page-shell";

      const page = document.createElement("section");
      page.className = "calendar-page";

      const inner = document.createElement("div");
      inner.className = "page-inner";

      const heading = document.createElement("header");
      heading.className = "page-heading";

      const titleWrap = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = state.calendarTitle || "Calendar";
      titleWrap.appendChild(title);

      if (state.calendarSubtitle) {
        const subtitle = document.createElement("div");
        subtitle.className = "page-subtitle";
        subtitle.textContent = state.calendarSubtitle;
        titleWrap.appendChild(subtitle);
      }

      const period = document.createElement("div");
      period.className = "period-label";
      const text = periodText(pageItems);
      if (text) {
        const years = yearSet(pageItems);
        if (state.boldYear && years.length === 1 && text.includes(String(years[0]))) {
          const before = text.replace(String(years[0]), "");
          period.append(document.createTextNode(before));
          const yearSpan = document.createElement("span");
          yearSpan.className = "year bold";
          yearSpan.textContent = years[0];
          period.appendChild(yearSpan);
        } else {
          period.textContent = text;
        }
      }

      heading.append(titleWrap, period);

      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      grid.style.gridTemplateRows = `repeat(${pageRows.length}, minmax(0, 1fr))`;

      pageRows.forEach(row => row.forEach(item => grid.appendChild(createDayCell(item, pageItems))));

      if (state.includeBlankCells) {
        const finalRowLength = pageRows.at(-1)?.length || 0;
        if (pageIndex === pages.length - 1 && finalRowLength < state.daysPerRow) {
          for (let i = finalRowLength; i < state.daysPerRow; i++) {
            grid.appendChild(createBlankCell());
          }
        }
      }

      const legend = buildLegend(pageItems) || document.createElement("div");

      const footer = document.createElement("footer");
      footer.className = "page-footer";
      const range = document.createElement("span");
      range.textContent = pageItems.length
        ? `${formatDateLabel(pageItems[0].date)} – ${formatDateLabel(pageItems.at(-1).date)}`
        : "";
      const pageNumber = document.createElement("span");
      pageNumber.textContent = state.showPageNumber ? `Page ${pageIndex + 1} of ${pages.length}` : "";
      footer.append(range, pageNumber);

      inner.append(heading, grid, legend, footer);
      page.appendChild(inner);
      shell.appendChild(page);
      preview.appendChild(shell);
    });

    $("calendarStats").textContent = `${state.totalDays} days · ${layout.totalRows} rows · ${layout.pageCount} page${layout.pageCount === 1 ? "" : "s"}`;
    $("fitSummary").innerHTML = `
      <strong>Smart layout:</strong> ${layout.rowsPerPage} row${layout.rowsPerPage === 1 ? "" : "s"} per page,
      about ${layout.estimatedCellWidth.toFixed(1)} × ${layout.estimatedCellHeight.toFixed(1)} mm per day,
      ${layout.pageCount} printed page${layout.pageCount === 1 ? "" : "s"}.
    `;

    updateSelectionUI();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 70);
  }

  function updateMonthRule(dates = getDates()) {
    const select = $("monthRule");
    const previous = select.value;
    select.innerHTML = "";
    monthSet(dates).forEach(item => {
      const option = document.createElement("option");
      option.value = item.monthKey;
      option.textContent = `${monthName(item.date)} ${item.date.getFullYear()}`;
      select.appendChild(option);
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function getRuleMatches() {
    const dates = getDates();
    const rule = $("massRule").value;

    if (rule === "all") return dates.map(item => item.index);

    if (rule === "dateRange") {
      const start = $("rangeStart").value;
      const end = $("rangeEnd").value;
      if (!start || !end) return [];
      const lo = start <= end ? start : end;
      const hi = start <= end ? end : start;
      return dates.filter(item => item.iso >= lo && item.iso <= hi).map(item => item.index);
    }

    if (rule === "weekday") {
      const weekday = Number($("weekdayRule").value);
      return dates.filter(item => item.date.getDay() === weekday).map(item => item.index);
    }

    if (rule === "month") {
      const monthKey = $("monthRule").value;
      return dates.filter(item => item.monthKey === monthKey).map(item => item.index);
    }

    if (rule === "everyNth") {
      const every = Math.max(1, Number($("nthValue").value) || 1);
      const start = Math.max(1, Number($("nthStart").value) || 1);
      return dates.filter(item => item.index + 1 >= start && ((item.index + 1 - start) % every === 0)).map(item => item.index);
    }

    return [];
  }

  function selectMatches(matches, replace = true) {
    if (replace) selected.clear();
    matches.forEach(index => selected.add(index));
    lastSelectedIndex = matches.at(-1) ?? null;
    updateSelectionUI();
    updateCellSelectionClasses();
  }

  function colorIndexes(indexes, fill, text) {
    const dates = getDates();
    indexes.forEach(index => {
      const item = dates[index];
      if (!item) return;
      dayStyles[item.iso] = { fill, text };
    });
    render();
  }

  function clearColors(indexes) {
    const dates = getDates();
    indexes.forEach(index => {
      const item = dates[index];
      if (item) delete dayStyles[item.iso];
    });
    render();
  }

  function applyMonthPalette() {
    const dates = getDates();
    dates.forEach(item => {
      dayStyles[item.iso] = {
        fill: MONTH_PALETTE[item.date.getMonth() % MONTH_PALETTE.length],
        text: "#172033"
      };
    });
    render();
    toast("Month colors applied.");
  }

  function savePreset() {
    const payload = { state, dayStyles };
    localStorage.setItem("smartCalendarPreset", JSON.stringify(payload));
    toast("Preset saved in this browser.");
  }

  function loadPreset() {
    const raw = localStorage.getItem("smartCalendarPreset");
    if (!raw) {
      toast("No saved preset found.");
      return;
    }

    try {
      const payload = JSON.parse(raw);
      state = { ...structuredClone(defaultState), ...(payload.state || {}) };
      dayStyles = payload.dayStyles || {};
      selected.clear();
      syncInputsFromState();
      render();
      toast("Preset loaded.");
    } catch {
      toast("Could not load the saved preset.");
    }
  }

  function exportSettings() {
    const payload = {
      app: "Smart Calendar Builder",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
      dayStyles
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smart-calendar-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importSettings(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        state = { ...structuredClone(defaultState), ...(payload.state || {}) };
        dayStyles = payload.dayStyles || {};
        selected.clear();
        syncInputsFromState();
        render();
        toast("Settings imported.");
      } catch {
        toast("That file is not a valid calendar settings file.");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    const ok = window.confirm("Reset all settings, selections, and custom colors?");
    if (!ok) return;
    state = structuredClone(defaultState);
    dayStyles = {};
    selected.clear();
    lastSelectedIndex = null;
    syncInputsFromState();
    render();
    toast("Calendar reset.");
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("visible"), 2200);
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
        button.classList.add("active");
        $(`tab-${button.dataset.tab}`).classList.add("active");
      });
    });

    inputIds.forEach(id => {
      const el = $(id);
      if (!el) return;
      const eventName = el.matches('input[type="range"], input[type="number"], input[type="text"], input[type="date"], input[type="color"]')
        ? "input"
        : "change";

      el.addEventListener(eventName, () => {
        syncStateFromInput(id);
        updateConditionalFields();
        updateRangeOutputs();

        if (id === "startDate") {
          $("rangeStart").value = state.startDate;
          $("rangeEnd").value = toISODate(addDays(parseLocalDate(state.startDate), state.totalDays - 1));
          selected.clear();
          lastSelectedIndex = null;
        }

        if (id === "totalDays" || id === "daysPerRow") {
          selected = new Set([...selected].filter(index => index < state.totalDays));
        }

        scheduleRender();
      });

      if (eventName !== "change") {
        el.addEventListener("change", () => {
          syncStateFromInput(id);
          scheduleRender();
        });
      }
    });

    $("massRule").addEventListener("change", updateConditionalFields);

    $("colorSelectedBtn").addEventListener("click", () => {
      colorIndexes([...selected], state.activeColor, state.activeTextColor);
      toast(`${selected.size} selected day${selected.size === 1 ? "" : "s"} colored.`);
    });

    $("clearSelectedColorBtn").addEventListener("click", () => {
      clearColors([...selected]);
      toast("Custom colors cleared from selected days.");
    });

    $("clearSelectionBtn").addEventListener("click", () => {
      selected.clear();
      lastSelectedIndex = null;
      updateSelectionUI();
      updateCellSelectionClasses();
    });

    $("selectByRuleBtn").addEventListener("click", () => {
      const matches = getRuleMatches();
      selectMatches(matches, true);
      toast(`${matches.length} matching day${matches.length === 1 ? "" : "s"} selected.`);
    });

    $("colorByRuleBtn").addEventListener("click", () => {
      const matches = getRuleMatches();
      colorIndexes(matches, state.activeColor, state.activeTextColor);
      selectMatches(matches, true);
      toast(`${matches.length} matching day${matches.length === 1 ? "" : "s"} colored.`);
    });

    $("applyMonthColorsBtn").addEventListener("click", applyMonthPalette);
    $("savePresetBtn").addEventListener("click", savePreset);
    $("loadPresetBtn").addEventListener("click", loadPreset);
    $("exportBtn").addEventListener("click", exportSettings);
    $("importInput").addEventListener("change", event => importSettings(event.target.files[0]));
    $("resetBtn").addEventListener("click", resetAll);
    $("printBtn").addEventListener("click", () => window.print());

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    window.addEventListener("keydown", event => {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

      if (event.key === "Escape") {
        selected.clear();
        lastSelectedIndex = null;
        updateSelectionUI();
        updateCellSelectionClasses();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectMatches(getDates().map(item => item.index), true);
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        clearColors([...selected]);
      }
    });
  }

  function init() {
    syncInputsFromState();
    $("rangeStart").value = state.startDate;
    $("rangeEnd").value = toISODate(addDays(parseLocalDate(state.startDate), state.totalDays - 1));
    bindEvents();
    updateConditionalFields();
    render();
  }

  init();
})();
