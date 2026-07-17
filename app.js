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

  const PRESET_STORAGE_KEY = "smartCalendarNamedPresetsV2";
  const HISTORY_LIMIT = 80;

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
    writingStyle: "blank",
    writingLines: 4,
    cellMinHeight: 35,
    companionBoxCount: 0,
    companionPosition: "beside",
    companionLabels: "Goal",
    showCompanionLabels: true,
    companionWritingStyle: "blank",
    companionItems: 4,
    companionBoxShape: "rounded",
    companionBorderStyle: "solid",
    companionFillColor: "#ffffff",
    titleSize: 24,
    dateSize: 18,
    weekdaySize: 11,
    yearSize: 14,
    dayBoxShape: "rounded",
    dayBorderStyle: "solid",
    borderWidth: 1,
    cornerRadius: 8,
    fontFamily: "system",
    dateAlignment: "left",
    boldYear: true,
    showPageNumber: true,
    activeColor: "#dbeafe",
    activeTextColor: "#172033",
    highlightWeekends: false,
    weekendColor: "#f8fafc",
    globalCellColor: "#ffffff",
    pageBackgroundColor: "#ffffff",
    monthDisplay: "pageHeading",
    yearDisplay: "pageHeading",
    weekendDays: [0, 6],
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
  let history = [];
  let redoHistory = [];
  let presetMemoryCache = {};
  const editStartSnapshots = new Map();

  const inputIds = [
    "startDate", "totalDays", "daysPerRow", "rowsPerPageMode", "rowsPerPage",
    "showWeekday", "dateFormat", "weekdayFormat", "customTemplate",
    "calendarTitle", "calendarSubtitle", "paperSize", "orientation",
    "pageMargin", "cellGap", "autoFit", "writingStyle", "writingLines",
    "cellMinHeight", "companionBoxCount", "companionPosition", "companionLabels",
    "showCompanionLabels", "companionWritingStyle", "companionItems",
    "companionBoxShape", "companionBorderStyle", "companionFillColor",
    "titleSize", "dateSize", "weekdaySize", "yearSize", "dayBoxShape",
    "dayBorderStyle", "borderWidth", "cornerRadius", "fontFamily",
    "dateAlignment", "boldYear", "showPageNumber", "activeColor",
    "activeTextColor", "highlightWeekends", "weekendColor", "globalCellColor",
    "pageBackgroundColor", "monthDisplay", "yearDisplay", "showDayIndex",
    "dayIndexLabel", "includeBlankCells", "previewZoom"
  ];

  const numericIds = new Set([
    "totalDays", "daysPerRow", "rowsPerPage", "pageMargin", "cellGap",
    "writingLines", "cellMinHeight", "companionBoxCount", "companionItems",
    "titleSize", "dateSize", "weekdaySize", "yearSize", "borderWidth",
    "cornerRadius", "previewZoom"
  ]);

  const checkboxIds = new Set([
    "showWeekday", "autoFit", "showCompanionLabels", "boldYear",
    "showPageNumber", "highlightWeekends", "showDayIndex", "includeBlankCells"
  ]);

  function todayISO() {
    return toISODate(new Date());
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(value) {
    const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : todayISO();
    const [y, m, d] = safeValue.split("-").map(Number);
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
    return items.filter((item) => {
      const key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function makeSnapshot() {
    return {
      state: structuredClone(state),
      dayStyles: structuredClone(dayStyles),
      selected: [...selected],
      lastSelectedIndex
    };
  }

  function snapshotSignature(snapshot) {
    return JSON.stringify(snapshot);
  }

  function pushHistorySnapshot(snapshot) {
    if (!snapshot) return;
    const previous = history.at(-1);
    if (!previous || snapshotSignature(previous) !== snapshotSignature(snapshot)) {
      history.push(snapshot);
      if (history.length > HISTORY_LIMIT) history.shift();
    }
    redoHistory = [];
    updateHistoryButtons();
  }

  function rememberSnapshot(snapshot) {
    if (!snapshot) return;
    if (snapshotSignature(snapshot) === snapshotSignature(makeSnapshot())) return;
    pushHistorySnapshot(snapshot);
  }

  function rememberBeforeChange() {
    pushHistorySnapshot(makeSnapshot());
  }

  function restoreSnapshot(snapshot) {
    state = { ...structuredClone(defaultState), ...(snapshot.state || {}) };
    state.weekendDays = Array.isArray(snapshot.state?.weekendDays)
      ? [...snapshot.state.weekendDays]
      : [...defaultState.weekendDays];
    dayStyles = structuredClone(snapshot.dayStyles || {});
    selected = new Set(snapshot.selected || []);
    lastSelectedIndex = snapshot.lastSelectedIndex ?? null;
    sanitizeState(false);
    syncInputsFromState();
    render();
  }

  function undo() {
    if (!history.length) return;
    redoHistory.push(makeSnapshot());
    restoreSnapshot(history.pop());
    updateHistoryButtons();
    toast("Undid the last change.");
  }

  function redo() {
    if (!redoHistory.length) return;
    history.push(makeSnapshot());
    restoreSnapshot(redoHistory.pop());
    updateHistoryButtons();
    toast("Redid the change.");
  }

  function updateHistoryButtons() {
    $("undoBtn").disabled = history.length === 0;
    $("redoBtn").disabled = redoHistory.length === 0;
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

  function maxDaysPerRow() {
    if (state.companionPosition !== "beside") return 31;
    return Math.max(1, Math.floor(31 / (1 + state.companionBoxCount)));
  }

  function sanitizeState(showWarning = false) {
    const requestedDays = Math.round(Number(state.daysPerRow) || 1);
    const requestedBoxes = Math.round(Number(state.companionBoxCount) || 0);

    state.totalDays = clamp(Math.round(Number(state.totalDays) || 1), 1, 1000);
    state.companionBoxCount = clamp(requestedBoxes, 0, 5);
    state.rowsPerPage = clamp(Math.round(Number(state.rowsPerPage) || 1), 1, 40);
    state.pageMargin = clamp(Number(state.pageMargin) || 0, 3, 30);
    state.cellGap = clamp(Number(state.cellGap) || 0, 0, 10);
    state.writingLines = clamp(Math.round(Number(state.writingLines) || 1), 1, 24);
    state.companionItems = clamp(Math.round(Number(state.companionItems) || 1), 1, 24);
    state.cellMinHeight = clamp(Number(state.cellMinHeight) || 15, 15, 150);
    state.previewZoom = clamp(Number(state.previewZoom) || 70, 35, 120);
    state.weekendDays = [...new Set((state.weekendDays || []).map(Number).filter((day) => day >= 0 && day <= 6))].sort();

    const dynamicMax = maxDaysPerRow();
    state.daysPerRow = clamp(requestedDays, 1, dynamicMax);

    if (showWarning && requestedBoxes > 5) {
      toast("A maximum of 5 companion boxes is allowed per day.");
    } else if (showWarning && requestedDays > dynamicMax) {
      toast(`Days per row was reduced to ${dynamicMax} so the row never exceeds 31 total boxes.`);
    }
  }

  function syncInputsFromState() {
    inputIds.forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (checkboxIds.has(id)) el.checked = Boolean(state[id]);
      else el.value = state[id];
    });

    document.querySelectorAll(".weekend-day-input").forEach((input) => {
      input.checked = state.weekendDays.includes(Number(input.value));
    });

    updateConditionalFields();
    updateRangeOutputs();
    updateDynamicLimits();
    updateMonthNameButton();
  }

  function syncStateFromInput(id, showWarning = false) {
    const el = $(id);
    if (!el) return;

    if (checkboxIds.has(id)) state[id] = el.checked;
    else if (numericIds.has(id)) {
      const parsed = Number(el.value);
      state[id] = Number.isFinite(parsed) ? parsed : defaultState[id];
    } else state[id] = el.value;

    sanitizeState(showWarning);
    updateDynamicLimits();

    if (numericIds.has(id) && Number(el.value) !== state[id]) el.value = state[id];
  }

  function updateDynamicLimits() {
    const max = maxDaysPerRow();
    $("daysPerRow").max = String(max);
    if ($("daysPerRow").value !== String(state.daysPerRow)) $("daysPerRow").value = String(state.daysPerRow);
    $("daysPerRowHelp").textContent = state.companionPosition === "beside" && state.companionBoxCount > 0
      ? `Maximum: ${max} days, because each day group uses ${state.companionBoxCount + 1} boxes (${max * (state.companionBoxCount + 1)} of 31 maximum).`
      : "Maximum: 31 days.";
  }

  function updateConditionalFields() {
    $("customRowsField").hidden = state.rowsPerPageMode !== "custom";
    $("customTemplateField").hidden = state.dateFormat !== "custom";

    const rule = $("massRule").value;
    ["DateRange", "Weekday", "Month", "EveryNth"].forEach((name) => {
      $("rule" + name).hidden = rule !== name.charAt(0).toLowerCase() + name.slice(1);
    });
  }

  function updateRangeOutputs() {
    [
      ["titleSize", "px"], ["dateSize", "px"], ["weekdaySize", "px"],
      ["yearSize", "px"], ["borderWidth", "px"], ["cornerRadius", "px"],
      ["previewZoom", "%"]
    ].forEach(([id, unit]) => {
      const out = $(id + "Out");
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
    const boxesPerGroup = 1 + state.companionBoxCount;
    const physicalBoxesPerRow = state.companionPosition === "beside"
      ? state.daysPerRow * boxesPerGroup
      : state.daysPerRow;

    const headingReserve = 25;
    const legendReserve = state.monthDisplay === "legendOnly" || ["legend", "both"].includes(state.yearDisplay) ? 10 : 2;
    const footerReserve = state.showPageNumber ? 7 : 3;
    const gridHeight = Math.max(25, usableHeight - headingReserve - legendReserve - footerReserve);
    const minimumGroupHeight = Math.max(
      state.autoFit ? 18 : state.cellMinHeight,
      state.companionPosition === "below" ? 13 * boxesPerGroup : 13
    );
    const maxRowsByHeight = Math.max(1, Math.floor((gridHeight + state.cellGap) / (minimumGroupHeight + state.cellGap)));

    let rowsPerPage = state.rowsPerPageMode === "custom"
      ? state.rowsPerPage
      : Math.min(totalRows, maxRowsByHeight);

    rowsPerPage = clamp(rowsPerPage, 1, Math.max(1, totalRows));
    const pageCount = Math.ceil(totalRows / rowsPerPage);

    const estimatedGroupHeight = Math.max(
      14,
      (gridHeight - (rowsPerPage - 1) * state.cellGap) / rowsPerPage
    );
    const estimatedGroupWidth = Math.max(
      12,
      (usableWidth - (state.daysPerRow - 1) * state.cellGap) / state.daysPerRow
    );
    const estimatedBoxWidth = state.companionPosition === "beside"
      ? (estimatedGroupWidth - state.companionBoxCount * state.cellGap * 0.65) / boxesPerGroup
      : estimatedGroupWidth;
    const estimatedBoxHeight = state.companionPosition === "below"
      ? (estimatedGroupHeight - state.companionBoxCount * state.cellGap * 0.65) / boxesPerGroup
      : estimatedGroupHeight;

    let dateSize = state.dateSize;
    let weekdaySize = state.weekdaySize;
    let titleSize = state.titleSize;
    let yearSize = state.yearSize;

    if (state.autoFit) {
      const widthFactor = clamp(estimatedBoxWidth / 34, 0.45, 1.2);
      const heightFactor = clamp(estimatedBoxHeight / 35, 0.45, 1.2);
      const factor = Math.min(widthFactor, heightFactor);
      dateSize = Math.round(clamp(state.dateSize * factor, 8, state.dateSize));
      weekdaySize = Math.round(clamp(state.weekdaySize * factor, 6, state.weekdaySize));
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
      boxesPerGroup,
      physicalBoxesPerRow,
      estimatedGroupHeight,
      estimatedGroupWidth,
      estimatedBoxHeight,
      estimatedBoxWidth,
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
    root.style.setProperty("--days-per-row", state.daysPerRow);
    root.style.setProperty("--group-box-count", layout.boxesPerGroup);
    root.style.setProperty("--title-size", `${layout.titleSize}px`);
    root.style.setProperty("--date-size", `${layout.dateSize}px`);
    root.style.setProperty("--weekday-size", `${layout.weekdaySize}px`);
    root.style.setProperty("--year-size", `${layout.yearSize}px`);
    root.style.setProperty("--border-width", `${state.borderWidth}px`);
    root.style.setProperty("--corner-radius", `${state.cornerRadius}px`);
    root.style.setProperty("--date-alignment", state.dateAlignment);
    root.style.setProperty("--calendar-font", fontStack(state.fontFamily));
    root.style.setProperty("--preview-zoom", state.previewZoom / 100);
    root.style.setProperty("--page-background", state.pageBackgroundColor);
    updatePrintPageStyle();
  }

  function updatePrintPageStyle() {
    let style = $("dynamicPrintPageStyle");
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
    return [...new Set(items.map((item) => item.date.getFullYear()))];
  }

  function monthSet(items) {
    return uniqueBy(items, (item) => item.monthKey);
  }

  function groupMonthsByYear(items) {
    const groups = [];
    monthSet(items).forEach((item) => {
      const year = item.date.getFullYear();
      let group = groups.find((entry) => entry.year === year);
      if (!group) {
        group = { year, months: [] };
        groups.push(group);
      }
      group.months.push(monthName(item.date));
    });
    return groups;
  }

  function buildPeriodLabel(container, items) {
    container.innerHTML = "";
    const showMonths = state.monthDisplay === "pageHeading";
    const showYears = ["pageHeading", "both"].includes(state.yearDisplay);
    if (!showMonths && !showYears) return;

    if (!showMonths) {
      yearSet(items).forEach((year, index) => {
        if (index) container.append(document.createTextNode(" · "));
        const yearSpan = document.createElement("span");
        yearSpan.className = `year${state.boldYear ? " bold" : ""}`;
        yearSpan.textContent = year;
        container.appendChild(yearSpan);
      });
      return;
    }

    const groups = groupMonthsByYear(items);
    groups.forEach((group, groupIndex) => {
      if (groupIndex) container.append(document.createTextNode(" · "));
      const groupSpan = document.createElement("span");
      groupSpan.className = "period-group";

      group.months.forEach((month, monthIndex) => {
        if (monthIndex) groupSpan.append(document.createTextNode(" · "));
        const monthSpan = document.createElement("span");
        monthSpan.className = "period-month";
        monthSpan.textContent = month;
        groupSpan.appendChild(monthSpan);
      });

      if (showYears) {
        groupSpan.append(document.createTextNode(" "));
        const yearSpan = document.createElement("span");
        yearSpan.className = `period-year year${state.boldYear ? " bold" : ""}`;
        yearSpan.textContent = group.year;
        groupSpan.appendChild(yearSpan);
      }

      container.appendChild(groupSpan);
    });
  }

  function shapeClass(shape) {
    return `shape-${shape || "rounded"}`;
  }

  function borderClass(style) {
    return `border-${style || "solid"}`;
  }

  function buildWritingArea(container, style, itemCount) {
    const safeCount = clamp(Math.round(Number(itemCount) || 1), 1, 24);
    container.className = `writing-area ${style}`;
    container.innerHTML = "";
    container.style.setProperty("--writing-line-step", `${100 / safeCount}%`);

    if (style === "checklist") {
      for (let i = 0; i < safeCount; i += 1) {
        const row = document.createElement("div");
        row.className = "checklist-row";
        row.innerHTML = '<span class="checklist-box"></span><span class="checklist-line"></span>';
        container.appendChild(row);
      }
    }

    if (style === "checksOnly") {
      const grid = document.createElement("div");
      grid.className = "checks-grid";
      grid.style.setProperty("--checks-columns", safeCount > 12 ? 4 : safeCount > 6 ? 3 : safeCount > 3 ? 2 : 1);
      for (let i = 0; i < safeCount; i += 1) {
        const box = document.createElement("span");
        box.className = "checklist-box";
        grid.appendChild(box);
      }
      container.appendChild(grid);
    }
  }

  function styleForDay(item) {
    const custom = dayStyles[item.iso] || {};
    let fill = state.globalCellColor;
    let text = "#172033";

    if (state.highlightWeekends && state.weekendDays.includes(item.date.getDay())) fill = state.weekendColor;
    if (custom.fill) fill = custom.fill;
    if (custom.text) text = custom.text;
    return { fill, text };
  }

  function companionLabels() {
    return String(state.companionLabels || "")
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function createCompanionBox(boxIndex, isBlank = false) {
    const node = $("companionBoxTemplate").content.firstElementChild.cloneNode(true);
    node.classList.add(shapeClass(state.companionBoxShape), borderClass(state.companionBorderStyle));
    node.style.setProperty("--cell-fill", state.companionFillColor);
    const labels = companionLabels();
    node.querySelector(".companion-label").textContent = !isBlank && state.showCompanionLabels
      ? labels[boxIndex] || `Box ${boxIndex + 1}`
      : "";
    buildWritingArea(node.querySelector(".writing-area"), state.companionWritingStyle, state.companionItems);
    return node;
  }

  function createDayGroup(item) {
    const group = document.createElement("div");
    group.className = `day-group ${state.companionPosition} selectable`;
    group.dataset.index = item.index;
    group.dataset.iso = item.iso;
    if (selected.has(item.index)) group.classList.add("selected");

    const day = $("dayCellTemplate").content.firstElementChild.cloneNode(true);
    day.classList.add(shapeClass(state.dayBoxShape), borderClass(state.dayBorderStyle));
    day.querySelector(".weekday-label").textContent = state.showWeekday ? formatWeekday(item.date) : "";
    day.querySelector(".date-label").textContent = formatDateLabel(item.date);
    day.querySelector(".day-index").textContent = state.showDayIndex
      ? `${state.dayIndexLabel || "Day"} ${item.index + 1}`
      : "";

    const isFirstCalendarDay = item.index === 0;
    const previousDate = item.index > 0 ? addDays(item.date, -1) : null;
    const isFirstOfMonth = item.date.getDate() === 1 || isFirstCalendarDay ||
      (previousDate && previousDate.getMonth() !== item.date.getMonth());
    const badge = day.querySelector(".month-badge");
    if (state.monthDisplay === "cellBadge" && isFirstOfMonth) {
      badge.textContent = monthName(item.date);
      badge.classList.add("visible");
    }

    buildWritingArea(day.querySelector(".writing-area"), state.writingStyle, state.writingLines);
    const dayStyle = styleForDay(item);
    day.style.setProperty("--cell-fill", dayStyle.fill);
    day.style.setProperty("--cell-text", dayStyle.text);
    group.appendChild(day);

    for (let boxIndex = 0; boxIndex < state.companionBoxCount; boxIndex += 1) {
      group.appendChild(createCompanionBox(boxIndex));
    }

    attachGroupSelection(group, item.index);
    return group;
  }

  function createBlankGroup() {
    const group = document.createElement("div");
    group.className = `day-group ${state.companionPosition} blank-group`;

    const day = $("dayCellTemplate").content.firstElementChild.cloneNode(true);
    day.classList.add(shapeClass(state.dayBoxShape), borderClass(state.dayBorderStyle));
    day.querySelector(".weekday-label").textContent = "";
    day.querySelector(".date-label").textContent = "";
    day.querySelector(".day-index").textContent = "";
    buildWritingArea(day.querySelector(".writing-area"), state.writingStyle, state.writingLines);
    day.style.setProperty("--cell-fill", state.globalCellColor);
    group.appendChild(day);

    for (let boxIndex = 0; boxIndex < state.companionBoxCount; boxIndex += 1) {
      group.appendChild(createCompanionBox(boxIndex, true));
    }
    return group;
  }

  function attachGroupSelection(group, index) {
    group.addEventListener("mousedown", (event) => {
      event.preventDefault();
      isDragging = true;
      dragMode = selected.has(index) ? "deselect" : "select";
      handleCellSelection(index, event.shiftKey, dragMode);
    });

    group.addEventListener("mouseenter", () => {
      if (isDragging) handleCellSelection(index, false, dragMode);
    });

    group.addEventListener("click", (event) => {
      if (event.detail === 0) handleCellSelection(index, event.shiftKey, "toggle");
    });
  }

  function handleCellSelection(index, shiftKey, mode = "toggle") {
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i += 1) selected.add(i);
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
    document.querySelectorAll(".day-group[data-index]").forEach((group) => {
      group.classList.toggle("selected", selected.has(Number(group.dataset.index)));
    });
  }

  function updateSelectionUI() {
    $("selectionCount").textContent = `${selected.size} day${selected.size === 1 ? "" : "s"} selected`;
  }

  function buildLegend(items) {
    const showLegend = state.monthDisplay === "legendOnly" || ["legend", "both"].includes(state.yearDisplay);
    if (!showLegend) return null;

    const legend = document.createElement("div");
    legend.className = "month-legend";

    if (state.monthDisplay === "legendOnly") {
      monthSet(items).forEach((item) => {
        const legendItem = document.createElement("span");
        legendItem.className = "legend-item";
        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";
        swatch.style.background = MONTH_PALETTE[item.date.getMonth() % MONTH_PALETTE.length];
        const label = document.createElement("span");
        label.textContent = monthName(item.date);
        legendItem.append(swatch, label);
        legend.appendChild(legendItem);
      });
    }

    if (["legend", "both"].includes(state.yearDisplay)) {
      const year = document.createElement("span");
      year.className = `legend-year${state.boldYear ? " bold" : ""}`;
      year.textContent = yearSet(items).join(" · ");
      legend.appendChild(year);
    }
    return legend;
  }

  function render() {
    sanitizeState(false);
    updateDynamicLimits();
    const dates = getDates();
    const layout = calculateLayout();
    applyRootVariables(layout);
    updateMonthRule(dates);
    updateMonthNameButton();

    const preview = $("calendarPreview");
    preview.innerHTML = "";

    const rows = [];
    for (let i = 0; i < dates.length; i += state.daysPerRow) rows.push(dates.slice(i, i + state.daysPerRow));

    const pages = [];
    for (let i = 0; i < rows.length; i += layout.rowsPerPage) pages.push(rows.slice(i, i + layout.rowsPerPage));

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
      buildPeriodLabel(period, pageItems);
      heading.append(titleWrap, period);

      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      grid.style.gridTemplateRows = `repeat(${pageRows.length}, minmax(0, 1fr))`;
      pageRows.forEach((row) => row.forEach((item) => grid.appendChild(createDayGroup(item))));

      if (state.includeBlankCells) {
        const finalRowLength = pageRows.at(-1)?.length || 0;
        if (pageIndex === pages.length - 1 && finalRowLength < state.daysPerRow) {
          for (let i = finalRowLength; i < state.daysPerRow; i += 1) grid.appendChild(createBlankGroup());
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

    $("calendarStats").textContent = `${state.totalDays} days · ${layout.totalRows} rows · ${layout.pageCount} page${layout.pageCount === 1 ? "" : "s"} · ${layout.physicalBoxesPerRow} boxes/row`;
    $("fitSummary").innerHTML = `
      <strong>Smart layout:</strong> ${layout.rowsPerPage} row${layout.rowsPerPage === 1 ? "" : "s"} per page,
      ${state.daysPerRow} day group${state.daysPerRow === 1 ? "" : "s"} per row,
      ${layout.physicalBoxesPerRow} physical box${layout.physicalBoxesPerRow === 1 ? "" : "es"} per row.
      Each individual box is approximately ${layout.estimatedBoxWidth.toFixed(1)} × ${layout.estimatedBoxHeight.toFixed(1)} mm.
    `;

    updateSelectionUI();
    updateHistoryButtons();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 70);
  }

  function updateMonthRule(dates = getDates()) {
    const select = $("monthRule");
    const previous = select.value;
    select.innerHTML = "";
    monthSet(dates).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.monthKey;
      option.textContent = `${monthName(item.date)} ${item.date.getFullYear()}`;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }

  function getRuleMatches() {
    const dates = getDates();
    const rule = $("massRule").value;
    if (rule === "all") return dates.map((item) => item.index);

    if (rule === "dateRange") {
      const start = $("rangeStart").value;
      const end = $("rangeEnd").value;
      if (!start || !end) return [];
      const lo = start <= end ? start : end;
      const hi = start <= end ? end : start;
      return dates.filter((item) => item.iso >= lo && item.iso <= hi).map((item) => item.index);
    }

    if (rule === "weekday") {
      const weekday = Number($("weekdayRule").value);
      return dates.filter((item) => item.date.getDay() === weekday).map((item) => item.index);
    }

    if (rule === "month") {
      const monthKey = $("monthRule").value;
      return dates.filter((item) => item.monthKey === monthKey).map((item) => item.index);
    }

    if (rule === "everyNth") {
      const every = Math.max(1, Number($("nthValue").value) || 1);
      const start = Math.max(1, Number($("nthStart").value) || 1);
      return dates
        .filter((item) => item.index + 1 >= start && ((item.index + 1 - start) % every === 0))
        .map((item) => item.index);
    }
    return [];
  }

  function selectMatches(matches, replace = true) {
    if (replace) selected.clear();
    matches.forEach((index) => selected.add(index));
    lastSelectedIndex = matches.at(-1) ?? null;
    updateSelectionUI();
    updateCellSelectionClasses();
  }

  function colorIndexes(indexes, fill, text) {
    const dates = getDates();
    indexes.forEach((index) => {
      const item = dates[index];
      if (!item) return;
      dayStyles[item.iso] = { fill, text };
    });
    render();
  }

  function clearColors(indexes) {
    const dates = getDates();
    indexes.forEach((index) => {
      const item = dates[index];
      if (item) delete dayStyles[item.iso];
    });
    render();
  }

  function applyMonthPalette() {
    if (Object.keys(dayStyles).length && !window.confirm("Apply month colors to every generated day? This will overwrite all existing custom day fills. You can undo it with Ctrl+Z.")) return;
    rememberBeforeChange();
    getDates().forEach((item) => {
      dayStyles[item.iso] = {
        ...(dayStyles[item.iso] || {}),
        fill: MONTH_PALETTE[item.date.getMonth() % MONTH_PALETTE.length]
      };
    });
    render();
    toast("Month colors applied to every day.");
  }

  function updateMonthNameButton() {
    const visible = state.monthDisplay !== "none";
    $("toggleMonthNamesBtn").textContent = visible ? "Erase month names" : "Write month names";
  }

  function toggleMonthNames() {
    rememberBeforeChange();
    state.monthDisplay = state.monthDisplay === "none" ? "cellBadge" : "none";
    $("monthDisplay").value = state.monthDisplay;
    render();
    toast(state.monthDisplay === "none" ? "Month names erased." : "Month names written on the first day of each month.");
  }

  function readPresets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "{}") || {};
      presetMemoryCache = structuredClone(parsed);
      return parsed;
    } catch {
      return structuredClone(presetMemoryCache);
    }
  }

  function writePresets(presets) {
    presetMemoryCache = structuredClone(presets);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      return true;
    } catch {
      toast("Browser storage is unavailable; presets will last for this open session only.");
      return false;
    }
  }

  function openPresetDialog(mode) {
    $("presetDialogTitle").textContent = mode === "save" ? "Save a named preset" : "Load a saved preset";
    $("presetName").closest("label").hidden = mode !== "save";
    $("confirmSavePresetBtn").hidden = mode !== "save";
    renderPresetList();
    $("presetDialog").showModal();
    if (mode === "save") setTimeout(() => $("presetName").focus(), 0);
  }

  function renderPresetList() {
    const presets = readPresets();
    const list = $("presetList");
    list.innerHTML = "";
    const entries = Object.entries(presets).sort((a, b) => (b[1].updatedAt || "").localeCompare(a[1].updatedAt || ""));

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "preset-empty";
      empty.textContent = "No named presets saved yet.";
      list.appendChild(empty);
      return;
    }

    entries.forEach(([name, preset]) => {
      const item = document.createElement("div");
      item.className = "preset-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = name;
      const details = document.createElement("small");
      const date = preset.updatedAt ? new Date(preset.updatedAt).toLocaleString() : "Unknown date";
      details.textContent = `${preset.state?.totalDays || "?"} days · updated ${date}`;
      info.append(title, details);

      const actions = document.createElement("div");
      actions.className = "preset-item-actions";
      const load = document.createElement("button");
      load.type = "button";
      load.className = "btn primary";
      load.textContent = "Load";
      load.addEventListener("click", () => loadNamedPreset(name));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn secondary";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteNamedPreset(name));
      actions.append(load, remove);
      item.append(info, actions);
      list.appendChild(item);
    });
  }

  function saveNamedPreset() {
    const name = $("presetName").value.trim();
    if (!name) {
      toast("Enter a unique preset name first.");
      $("presetName").focus();
      return;
    }

    const presets = readPresets();
    if (presets[name] && !window.confirm(`A preset named “${name}” already exists. Replace it?`)) return;
    presets[name] = {
      version: 2,
      updatedAt: new Date().toISOString(),
      state: structuredClone(state),
      dayStyles: structuredClone(dayStyles)
    };
    writePresets(presets);
    $("presetName").value = "";
    renderPresetList();
    toast(`Preset “${name}” saved.`);
  }

  function loadNamedPreset(name) {
    const presets = readPresets();
    const preset = presets[name];
    if (!preset) return;
    if (!window.confirm(`Load “${name}”? This replaces the current layout, formatting, and colors. The change can be undone with Ctrl+Z.`)) return;
    rememberBeforeChange();
    state = { ...structuredClone(defaultState), ...(preset.state || {}) };
    state.weekendDays = Array.isArray(preset.state?.weekendDays) ? [...preset.state.weekendDays] : [...defaultState.weekendDays];
    dayStyles = structuredClone(preset.dayStyles || {});
    selected.clear();
    lastSelectedIndex = null;
    sanitizeState(false);
    syncInputsFromState();
    render();
    $("presetDialog").close();
    toast(`Preset “${name}” loaded.`);
  }

  function deleteNamedPreset(name) {
    if (!window.confirm(`Delete the saved preset “${name}”?`)) return;
    const presets = readPresets();
    delete presets[name];
    writePresets(presets);
    renderPresetList();
    toast(`Preset “${name}” deleted.`);
  }

  function exportSettings() {
    const payload = {
      app: "Smart Calendar Builder",
      version: 2,
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
        if (!payload || typeof payload !== "object" || typeof payload.state !== "object") throw new Error("Invalid format");
        if (!window.confirm("Import these settings? This replaces the current layout, formatting, and colors. The change can be undone with Ctrl+Z.")) return;
        rememberBeforeChange();
        state = { ...structuredClone(defaultState), ...(payload.state || {}) };
        state.weekendDays = Array.isArray(payload.state?.weekendDays) ? [...payload.state.weekendDays] : [...defaultState.weekendDays];
        dayStyles = structuredClone(payload.dayStyles || {});
        selected.clear();
        lastSelectedIndex = null;
        sanitizeState(false);
        syncInputsFromState();
        render();
        toast("Settings imported.");
      } catch {
        toast("That file is not a valid calendar settings file.");
      } finally {
        $("importInput").value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!window.confirm("Reset all settings, companion boxes, selections, and custom colors? The reset can be undone with Ctrl+Z.")) return;
    rememberBeforeChange();
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
    toast.timer = setTimeout(() => el.classList.remove("visible"), 2600);
  }

  function updateDateRangeInputs() {
    $("rangeStart").value = state.startDate;
    $("rangeEnd").value = toISODate(addDays(parseLocalDate(state.startDate), state.totalDays - 1));
  }

  function isLiveInput(el) {
    return el.matches('input[type="range"], input[type="number"], input[type="text"], input[type="color"], textarea');
  }

  function startInputEdit(id) {
    if (!editStartSnapshots.has(id)) editStartSnapshots.set(id, makeSnapshot());
  }

  function finishInputEdit(id) {
    const snapshot = editStartSnapshots.get(id);
    editStartSnapshots.delete(id);
    rememberSnapshot(snapshot);
  }

  function processInputChange(id, showWarning = false) {
    syncStateFromInput(id, showWarning);
    updateConditionalFields();
    updateRangeOutputs();

    if (id === "startDate" || id === "totalDays") updateDateRangeInputs();
    if (["totalDays", "daysPerRow", "companionBoxCount", "companionPosition"].includes(id)) {
      selected = new Set([...selected].filter((index) => index < state.totalDays));
    }
    scheduleRender();
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
        button.classList.add("active");
        $("tab-" + button.dataset.tab).classList.add("active");
      });
    });

    inputIds.forEach((id) => {
      const el = $(id);
      if (!el) return;

      if (isLiveInput(el)) {
        el.addEventListener("focus", () => startInputEdit(id));
        el.addEventListener("pointerdown", () => startInputEdit(id));
        el.addEventListener("input", () => processInputChange(id, ["daysPerRow", "companionBoxCount"].includes(id)));
        el.addEventListener("change", () => finishInputEdit(id));
        el.addEventListener("blur", () => finishInputEdit(id));
      } else {
        el.addEventListener("change", () => {
          rememberBeforeChange();
          processInputChange(id, ["daysPerRow", "companionBoxCount", "companionPosition"].includes(id));
        });
      }
    });

    document.querySelectorAll(".weekend-day-input").forEach((input) => {
      input.addEventListener("change", () => {
        rememberBeforeChange();
        state.weekendDays = [...document.querySelectorAll(".weekend-day-input:checked")].map((item) => Number(item.value));
        sanitizeState(false);
        scheduleRender();
      });
    });

    $("massRule").addEventListener("change", updateConditionalFields);

    $("colorSelectedBtn").addEventListener("click", () => {
      if (!selected.size) return toast("Select at least one day first.");
      rememberBeforeChange();
      colorIndexes([...selected], state.activeColor, state.activeTextColor);
      toast(`${selected.size} selected day${selected.size === 1 ? "" : "s"} colored.`);
    });

    $("clearSelectedColorBtn").addEventListener("click", () => {
      if (!selected.size) return toast("Select at least one day first.");
      rememberBeforeChange();
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
      if (!matches.length) return toast("No days matched that rule.");
      rememberBeforeChange();
      colorIndexes(matches, state.activeColor, state.activeTextColor);
      selectMatches(matches, true);
      toast(`${matches.length} matching day${matches.length === 1 ? "" : "s"} colored.`);
    });

    $("applyMonthColorsBtn").addEventListener("click", applyMonthPalette);
    $("toggleMonthNamesBtn").addEventListener("click", toggleMonthNames);
    $("undoBtn").addEventListener("click", undo);
    $("redoBtn").addEventListener("click", redo);
    $("savePresetBtn").addEventListener("click", () => openPresetDialog("save"));
    $("loadPresetBtn").addEventListener("click", () => openPresetDialog("load"));
    $("confirmSavePresetBtn").addEventListener("click", saveNamedPreset);
    $("presetName").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveNamedPreset();
      }
    });
    $("exportBtn").addEventListener("click", exportSettings);
    $("importInput").addEventListener("change", (event) => importSettings(event.target.files[0]));
    $("resetBtn").addEventListener("click", resetAll);
    $("printBtn").addEventListener("click", () => window.print());

    window.addEventListener("mouseup", () => { isDragging = false; });

    window.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      const isFormField = ["INPUT", "SELECT", "TEXTAREA"].includes(tag);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !isFormField) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y" && !isFormField) {
        event.preventDefault();
        redo();
        return;
      }

      if (isFormField) return;
      if (event.key === "Escape") {
        selected.clear();
        lastSelectedIndex = null;
        updateSelectionUI();
        updateCellSelectionClasses();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectMatches(getDates().map((item) => item.index), true);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected.size) {
        rememberBeforeChange();
        clearColors([...selected]);
      }
    });
  }

  function init() {
    sanitizeState(false);
    syncInputsFromState();
    updateDateRangeInputs();
    bindEvents();
    updateConditionalFields();
    render();
  }

  init();
})();
