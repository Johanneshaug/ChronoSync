let currentApptMin = 600; // start at 10:00 AM
let currentDuration = 60; // 1 hour
let HOUR_HEIGHT = 20; // baseline
let extraColumns = []; // { id, tz, selectEl, headerEl, nowLineEl, card1El, card2El }
let extraColCounter = 0;

const TOTAL_MINUTES = 24 * 60;

const sourceTzSelect = document.getElementById('source-tz');
const targetTzSelect = document.getElementById('target-tz');
const durationSelect = document.getElementById('meeting-duration');
const mainAppt = document.getElementById('main-appointment');
const targetReflection = document.getElementById('target-reflection');
const targetReflectionWrap = document.getElementById('target-reflection-wrap');
const mainApptWrap = document.getElementById('main-appointment-wrap');
const sourceRangeTxt = document.getElementById('source-range');
const sourceRangeWrapTxt = document.getElementById('source-range-wrap');
const targetRangeTxt = document.getElementById('target-range');
const targetRangeWrapTxt = document.getElementById('target-range-wrap');
const sourceTimeDisplay = document.getElementById('source-current');
const targetTimeDisplay = document.getElementById('target-current');

// --- INITIALIZATION ---

function init() {
    populateTimezones();

    makeCustomSelect('source-tz', true);
    makeCustomSelect('target-tz', true);
    makeCustomSelect('meeting-duration', false);

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select.open').forEach(c => c.classList.remove('open'));
    });

    generateGrid();
    refreshHeights();
    setupDragging();

    // Initial sync
    syncUI();
    startTimeUpdate();

    // Event Listeners
    [sourceTzSelect, targetTzSelect].forEach(sel => {
        sel.addEventListener('change', () => {
            syncUI();
        });
    });

    durationSelect.addEventListener('change', (e) => {
        currentDuration = parseInt(e.target.value);
        syncUI();
    });

    document.getElementById('jump-now').addEventListener('click', () => {
        const now = new Date();
        const t = getTimeInTz(now, sourceTzSelect.value);
        currentApptMin = Math.round(((t.h * 60) + t.m) / 15) * 15;
        syncUI();
    });

    document.getElementById('add-timezone').addEventListener('click', addExtraTimezone);

    window.addEventListener('resize', () => {
        refreshHeights();
        syncUI();
    });
}

function refreshHeights() {
    const slot = document.querySelector('.hour-slot');
    if (slot) {
        HOUR_HEIGHT = slot.getBoundingClientRect().height;
    }
}

function populateTimezones() {
    const timezones = Intl.supportedValuesOf('timeZone');
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    timezones.forEach(tz => {
        const name = tz.split('/').pop().replace(/_/g, ' ');
        const option1 = new Option(name, tz, tz === localTz, tz === localTz);
        sourceTzSelect.add(option1);

        const option2 = new Option(name, tz, tz === 'America/New_York', tz === 'America/New_York');
        targetTzSelect.add(option2);
    });
}

function makeCustomSelect(selectId, hasSearch) {
    const originalSelect = document.getElementById(selectId);

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const trigger = document.createElement('div');
    trigger.className = 'select-trigger';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'select-value';
    const selectedOpt = originalSelect.options[originalSelect.selectedIndex];
    valueSpan.textContent = selectedOpt ? selectedOpt.textContent : '';

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute('fill', 'currentColor');
    arrow.setAttribute('height', '16');
    arrow.setAttribute('width', '16');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.innerHTML = '<path d="M7 10l5 5 5-5z"/>';

    trigger.appendChild(valueSpan);
    trigger.appendChild(arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'select-dropdown';

    let searchInput = null;
    if (hasSearch) {
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'select-search';
        searchInput.placeholder = 'Search timezone...';
        dropdown.appendChild(searchInput);
    }

    const optionsList = document.createElement('ul');
    optionsList.className = 'select-options';

    function renderOptions(filter = '') {
        optionsList.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        Array.from(originalSelect.options).forEach(opt => {
            if (opt.textContent.toLowerCase().includes(lowerFilter)) {
                const li = document.createElement('li');
                li.className = 'select-option' + (opt.selected ? ' selected' : '');
                li.textContent = opt.textContent;
                li.dataset.value = opt.value;
                li.addEventListener('click', (e) => {
                    e.stopPropagation();
                    originalSelect.value = opt.value;
                    valueSpan.textContent = opt.textContent;
                    wrapper.classList.remove('open');
                    originalSelect.dispatchEvent(new Event('change'));

                    Array.from(optionsList.children).forEach(c => c.classList.remove('selected'));
                    li.classList.add('selected');
                });
                optionsList.appendChild(li);
            }
        });
    }

    renderOptions();
    dropdown.appendChild(optionsList);


    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    originalSelect.parentNode.insertBefore(wrapper, originalSelect.nextSibling);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');
        document.querySelectorAll('.custom-select.open').forEach(c => c.classList.remove('open'));
        if (!isOpen) {
            wrapper.classList.add('open');
            if (searchInput) {
                searchInput.value = '';
                renderOptions('');
                searchInput.focus();
            }

            setTimeout(() => {
                const selectedLi = optionsList.querySelector('.selected');
                if (selectedLi) {
                    optionsList.scrollTop = selectedLi.offsetTop - optionsList.offsetTop - 100;
                }
            }, 10);
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderOptions(e.target.value);
        });
        searchInput.addEventListener('click', e => e.stopPropagation());
    }
}


function generateGrid() {
    const markerCol = document.getElementById('marker-column');
    const sourceGrid = document.getElementById('source-grid');
    const targetGrid = document.getElementById('target-grid');

    markerCol.innerHTML = '';
    sourceGrid.innerHTML = '';
    targetGrid.innerHTML = '';

    for (let i = 0; i < 24; i++) {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.textContent = `${i.toString().padStart(2, '0')}:00`;
        markerCol.appendChild(marker);

        [sourceGrid, targetGrid].forEach(grid => {
            const slot = document.createElement('div');
            slot.className = 'hour-slot';
            grid.appendChild(slot);
        });
    }
}

// --- EXTRA TIMEZONE COLUMNS ---

function updateGridColumns() {
    const board = document.querySelector('.planner-board');
    const numCols = 2 + extraColumns.length; // source + extras
    const colDef = '60px ' + Array(numCols).fill('1fr').join(' ');
    board.style.gridTemplateColumns = colDef;
}

function addExtraTimezone() {
    extraColCounter++;
    const id = extraColCounter;
    const board = document.querySelector('.planner-board');
    const timezones = Intl.supportedValuesOf('timeZone');
    const defaultTz = timezones[Math.floor(Math.random() * timezones.length)];

    // --- Controls: add a new select in the controls bar ---
    const controls = document.querySelector('.controls');
    const addBtn = document.getElementById('add-timezone').parentElement;

    const ctrlGroup = document.createElement('div');
    ctrlGroup.className = 'control-group';
    ctrlGroup.dataset.extraId = id;

    // Label row with inline × remove button
    const lblRow = document.createElement('div');
    lblRow.style.display = 'flex';
    lblRow.style.alignItems = 'center';
    lblRow.style.justifyContent = 'space-between';
    lblRow.style.gap = '4px';

    const lbl = document.createElement('label');
    lbl.textContent = `Timezone ${2 + extraColumns.length}`;
    lbl.style.margin = '0';

    const removeCtrlBtn = document.createElement('button');
    removeCtrlBtn.textContent = '×';
    removeCtrlBtn.title = 'Remove this timezone';
    removeCtrlBtn.style.cssText = `
        background: none; border: none; color: var(--text-dim);
        cursor: pointer; font-size: 0.9rem; line-height: 1;
        padding: 0; opacity: 0.6; transition: opacity 0.2s;
    `;
    removeCtrlBtn.addEventListener('mouseover', () => removeCtrlBtn.style.opacity = '1');
    removeCtrlBtn.addEventListener('mouseout', () => removeCtrlBtn.style.opacity = '0.6');
    removeCtrlBtn.addEventListener('click', () => removeExtraTimezone(id));

    lblRow.appendChild(lbl);
    lblRow.appendChild(removeCtrlBtn);

    const sel = document.createElement('select');
    sel.id = `extra-tz-${id}`;
    timezones.forEach(tz => {
        const name = tz.split('/').pop().replace(/_/g, ' ');
        const opt = new Option(name, tz, tz === defaultTz, tz === defaultTz);
        sel.add(opt);
    });

    ctrlGroup.appendChild(lblRow);
    ctrlGroup.appendChild(sel);

    // Insert right after "Their Timezone" (before Duration group)
    const durationGroup = document.getElementById('meeting-duration').parentElement;
    controls.insertBefore(ctrlGroup, durationGroup);

    makeCustomSelect(`extra-tz-${id}`, true);
    sel.addEventListener('change', syncUI);

    // --- Board: Header ---
    const header = document.createElement('div');
    header.className = 'board-header column-header';
    header.dataset.extraId = id;
    header.style.position = 'relative';

    const tzName = document.createElement('div');
    tzName.className = 'tz-name';
    tzName.id = `extra-name-${id}`;
    tzName.textContent = defaultTz.split('/').pop().replace(/_/g, ' ');

    const timeTxt = document.createElement('div');
    timeTxt.className = 'current-time';
    timeTxt.id = `extra-current-${id}`;
    timeTxt.textContent = '00:00';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-col-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeExtraTimezone(id));

    header.appendChild(tzName);
    header.appendChild(timeTxt);
    header.appendChild(removeBtn);

    // Insert header after the last column header
    const headers = board.querySelectorAll('.board-header');
    headers[headers.length - 1].after(header);

    // --- Board: Timeline column ---
    const col = document.createElement('div');
    col.className = 'timeline-column';
    col.dataset.extraId = id;

    const grid = document.createElement('div');
    grid.className = 'grid-layer';
    for (let i = 0; i < 24; i++) {
        const slot = document.createElement('div');
        slot.className = 'hour-slot';
        grid.appendChild(slot);
    }

    const nowLine = document.createElement('div');
    nowLine.className = 'time-indicator';
    nowLine.id = `extra-now-${id}`;

    const card1 = document.createElement('div');
    card1.className = 'reflection-card';
    card1.id = `extra-card-${id}`;
    const card1Range = document.createElement('div');
    card1Range.className = 'time-range';
    card1Range.id = `extra-range-${id}`;
    card1.appendChild(document.createElement('div')).className = 'title';
    card1.appendChild(card1Range);

    const card2 = document.createElement('div');
    card2.className = 'reflection-card';
    card2.style.display = 'none';
    const card2Range = document.createElement('div');
    card2Range.className = 'time-range';
    card2Range.id = `extra-range-wrap-${id}`;
    card2.appendChild(document.createElement('div')).className = 'title';
    card2.appendChild(card2Range);

    col.appendChild(grid);
    col.appendChild(nowLine);
    col.appendChild(card1);
    col.appendChild(card2);

    // Insert timeline col after last timeline column
    const timelines = board.querySelectorAll('.timeline-column');
    timelines[timelines.length - 1].after(col);

    extraColumns.push({ id, selectEl: sel, headerEl: header, nowLineEl: nowLine, card1El: card1, card2El: card2 });
    updateGridColumns();
    syncUI();
}

function removeExtraTimezone(id) {
    const board = document.querySelector('.planner-board');
    const controls = document.querySelector('.controls');

    // Remove header and timeline from board
    board.querySelector(`.board-header[data-extra-id="${id}"]`)?.remove();
    board.querySelector(`.timeline-column[data-extra-id="${id}"]`)?.remove();

    // Remove control group
    controls.querySelector(`.control-group[data-extra-id="${id}"]`)?.remove();

    extraColumns = extraColumns.filter(c => c.id !== id);
    updateGridColumns();
    syncUI();
}

function syncExtraColumns() {
    const now = new Date();
    const sourceTz = sourceTzSelect.value;

    extraColumns.forEach(col => {
        const tz = col.selectEl.value;
        const time = getTimeInTz(now, tz);
        const nowMin = (time.h * 60) + time.m;

        // Header
        document.getElementById(`extra-name-${col.id}`).textContent = tz.split('/').pop().replace(/_/g, ' ');
        document.getElementById(`extra-current-${col.id}`).textContent =
            `${time.h.toString().padStart(2, '0')}:${time.m.toString().padStart(2, '0')}`;

        // Now line
        col.nowLineEl.style.top = `${(nowMin / 60) * HOUR_HEIGHT}px`;
        col.nowLineEl.style.display = apptOverlapsMinute(nowMin, apptMin, currentDuration) ? 'none' : '';

        // Appointment reflection
        const diff = getOffsetDiff(now, sourceTz, tz);
        let apptMin = currentApptMin + diff;
        let dayStatus = '';
        if (apptMin >= TOTAL_MINUTES) { dayStatus = ' (+1d)'; apptMin %= TOTAL_MINUTES; }
        else if (apptMin < 0) { dayStatus = ' (-1d)'; apptMin = (apptMin + TOTAL_MINUTES) % TOTAL_MINUTES; }

        const sH = Math.floor(apptMin / 60);
        const sM = apptMin % 60;
        const rangeTxt = document.getElementById(`extra-range-${col.id}`);
        const rangeWrapTxt = document.getElementById(`extra-range-wrap-${col.id}`);

        if (apptMin + currentDuration > TOTAL_MINUTES) {
            const d1 = TOTAL_MINUTES - apptMin;
            const d2 = currentDuration - d1;

            col.card1El.style.top = `${(apptMin / 60) * HOUR_HEIGHT}px`;
            col.card1El.style.height = `${(d1 / 60) * HOUR_HEIGHT}px`;
            rangeTxt.textContent = `${formatTime(sH, sM)} - 00:00`;

            col.card2El.style.display = 'flex';
            col.card2El.style.top = '0px';
            col.card2El.style.height = `${(d2 / 60) * HOUR_HEIGHT}px`;
            rangeWrapTxt.style.display = 'none'; // timespan only in lower part when split
            rangeWrapTxt.textContent = `00:00 - ${formatTime(Math.floor(d2 / 60), d2 % 60)}`;
        } else {
            col.card2El.style.display = 'none';
            rangeWrapTxt.style.display = '';
            const eTotal = apptMin + currentDuration;
            const eH = Math.floor((eTotal % TOTAL_MINUTES) / 60);
            const eM = eTotal % 60;

            col.card1El.style.top = `${(apptMin / 60) * HOUR_HEIGHT}px`;
            col.card1El.style.height = `${(currentDuration / 60) * HOUR_HEIGHT}px`;
            rangeTxt.textContent = `${formatTime(sH, sM)} - ${formatTime(eH, eM)}${dayStatus}`;
        }
    });
}

// --- CORE LOGIC ---

function getTimeInTz(date, tz) {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).formatToParts(date);
        const h = parseInt(parts.find(p => p.type === 'hour').value) || 0;
        const m = parseInt(parts.find(p => p.type === 'minute').value) || 0;
        const s = parseInt(parts.find(p => p.type === 'second').value) || 0;
        return { h, m, s };
    } catch (e) {
        return { h: 0, m: 0, s: 0 };
    }
}

function getOffsetDiff(date, tz1, tz2) {
    const fmt1 = new Intl.DateTimeFormat('en-US', { timeZone: tz1, timeZoneName: 'longOffset' });
    const fmt2 = new Intl.DateTimeFormat('en-US', { timeZone: tz2, timeZoneName: 'longOffset' });

    const off1 = parseOffset(fmt1.formatToParts(date).find(p => p.type === 'timeZoneName').value);
    const off2 = parseOffset(fmt2.formatToParts(date).find(p => p.type === 'timeZoneName').value);

    return off2 - off1;
}

function parseOffset(str) {
    if (str === 'GMT' || str === 'UTC') return 0;
    const match = str.match(/GMT([+-])(\d+):?(\d+)?/);
    if (!match) return 0;
    const [_, sign, h, m] = match;
    const mins = (parseInt(h) * 60) + (parseInt(m || 0));
    return sign === '+' ? mins : -mins;
}

function syncUI() {
    refreshHeights();
    const now = new Date();
    const sourceTz = sourceTzSelect.value;
    const targetTz = targetTzSelect.value;

    const diff = getOffsetDiff(now, sourceTz, targetTz);

    // Update Clocks
    const sTime = getTimeInTz(now, sourceTz);
    const tTime = getTimeInTz(now, targetTz);
    sourceTimeDisplay.textContent = `${sTime.h.toString().padStart(2, '0')}:${sTime.m.toString().padStart(2, '0')}`;
    targetTimeDisplay.textContent = `${tTime.h.toString().padStart(2, '0')}:${tTime.m.toString().padStart(2, '0')}`;

    // Update Now Lines
    const sNowMin = (sTime.h * 60) + sTime.m;
    const tNowMin = (tTime.h * 60) + tTime.m;
    document.getElementById('source-now-line').style.top = `${(sNowMin / 60) * HOUR_HEIGHT}px`;
    document.getElementById('target-now-line').style.top = `${(tNowMin / 60) * HOUR_HEIGHT}px`;

    // Update Source Appointment
    const startH = Math.floor(currentApptMin / 60);
    const startM = currentApptMin % 60;

    if (currentApptMin + currentDuration > TOTAL_MINUTES) {
        const d1 = TOTAL_MINUTES - currentApptMin;
        const d2 = currentDuration - d1;

        mainAppt.style.top = `${(currentApptMin / 60) * HOUR_HEIGHT}px`;
        mainAppt.style.height = `${(d1 / 60) * HOUR_HEIGHT}px`;
        sourceRangeTxt.textContent = `${formatTime(startH, startM)} - 00:00`;

        mainApptWrap.style.display = 'flex';
        mainApptWrap.style.top = `0px`;
        mainApptWrap.style.height = `${(d2 / 60) * HOUR_HEIGHT}px`;
        sourceRangeWrapTxt.style.display = 'none'; // timespan only in lower part when split

        const endH = Math.floor(d2 / 60);
        const endM = d2 % 60;
        sourceRangeWrapTxt.textContent = `00:00 - ${formatTime(endH, endM)}`;
    } else {
        mainApptWrap.style.display = 'none';
        sourceRangeWrapTxt.style.display = '';

        const endTotal = currentApptMin + currentDuration;
        const endH = Math.floor((endTotal % TOTAL_MINUTES) / 60);
        const endM = endTotal % 60;

        mainAppt.style.top = `${(currentApptMin / 60) * HOUR_HEIGHT}px`;
        mainAppt.style.height = `${(currentDuration / 60) * HOUR_HEIGHT}px`;
        let wrapLabel = (endTotal === TOTAL_MINUTES) ? '00:00' : formatTime(endH, endM);
        sourceRangeTxt.textContent = `${formatTime(startH, startM)} - ${wrapLabel}`;
    }

    // Update Target Reflection
    let targetApptMin = currentApptMin + diff;
    let baseDayStatus = "";
    if (targetApptMin >= TOTAL_MINUTES) {
        baseDayStatus = " (+1d)";
        targetApptMin %= TOTAL_MINUTES;
    } else if (targetApptMin < 0) {
        baseDayStatus = " (-1d)";
        targetApptMin = (targetApptMin + TOTAL_MINUTES) % TOTAL_MINUTES;
    }

    const tStartH = Math.floor(targetApptMin / 60);
    const tStartM = targetApptMin % 60;

    // Check if it wraps AROUND the day boundary
    if (targetApptMin + currentDuration > TOTAL_MINUTES) {
        // Wrap scenario
        const duration1 = TOTAL_MINUTES - targetApptMin;
        const duration2 = currentDuration - duration1;

        // Part 1 (Bottom of timeline)
        targetReflection.style.top = `${(targetApptMin / 60) * HOUR_HEIGHT}px`;
        targetReflection.style.height = `${(duration1 / 60) * HOUR_HEIGHT}px`;

        let p1EndDayStatus = baseDayStatus === "" ? " (+1d)" : (baseDayStatus === " (+1d)" ? " (+2d)" : "");
        targetRangeTxt.textContent = `${formatTime(tStartH, tStartM)} - 00:00${p1EndDayStatus}`;

        // Part 2 (Top of timeline)
        targetReflectionWrap.style.display = 'flex';
        targetReflectionWrap.style.top = `0px`;
        targetReflectionWrap.style.height = `${(duration2 / 60) * HOUR_HEIGHT}px`;
        targetRangeWrapTxt.style.display = 'none'; // timespan only in lower part when split

        let endMinRaw = currentApptMin + diff + currentDuration;
        let endDayStatus = "";
        if (endMinRaw > TOTAL_MINUTES * 2) endDayStatus = " (+2d)";
        else if (endMinRaw > TOTAL_MINUTES) endDayStatus = " (+1d)";
        else if (endMinRaw <= 0) endDayStatus = " (-1d)";

        const tEndH = Math.floor(duration2 / 60);
        const tEndM = duration2 % 60;
        targetRangeWrapTxt.textContent = `00:00 - ${formatTime(tEndH, tEndM)}${endDayStatus}`;

    } else {
        // Normal block
        targetReflectionWrap.style.display = 'none';
        targetRangeWrapTxt.style.display = '';

        const tEndTotal = targetApptMin + currentDuration;
        const tEndH = Math.floor((tEndTotal % TOTAL_MINUTES) / 60);
        const tEndM = tEndTotal % 60;

        let endDayStatus = baseDayStatus;
        if (tEndTotal === TOTAL_MINUTES && baseDayStatus === "") endDayStatus = " (+1d)";

        targetReflection.style.top = `${(targetApptMin / 60) * HOUR_HEIGHT}px`;
        targetReflection.style.height = `${(currentDuration / 60) * HOUR_HEIGHT}px`;
        targetRangeTxt.textContent = `${formatTime(tStartH, tStartM)} - ${formatTime(tEndH, tEndM)}${endDayStatus}`;
    }

    // Labels
    document.getElementById('source-name').textContent = sourceTz.split('/').pop().replace(/_/g, ' ');
    document.getElementById('target-name').textContent = targetTz.split('/').pop().replace(/_/g, ' ');

    // Hide now-lines when they touch the appointment box
    document.getElementById('source-now-line').style.display =
        apptOverlapsMinute(sNowMin, currentApptMin, currentDuration) ? 'none' : '';
    document.getElementById('target-now-line').style.display =
        apptOverlapsMinute(tNowMin, targetApptMin, currentDuration) ? 'none' : '';

    syncExtraColumns();
}

function formatTime(h, m) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Returns true if nowMin (0-1439) falls inside the appointment span
function apptOverlapsMinute(nowMin, apptStart, duration) {
    const apptEnd = apptStart + duration;
    if (apptEnd <= TOTAL_MINUTES) {
        // Normal (non-wrapping) block
        return nowMin >= apptStart && nowMin <= apptEnd;
    } else {
        // Block wraps past midnight
        const wrappedEnd = apptEnd % TOTAL_MINUTES;
        return nowMin >= apptStart || nowMin <= wrappedEnd;
    }
}

// --- INTERACTION ---

function setupDragging() {
    let isDragging = false;
    let startY = 0;
    let startMinY = 0;

    const handleDragStart = (e) => {
        isDragging = true;
        startY = e.clientY;
        startMinY = currentApptMin;
        mainAppt.style.transition = 'transform 0.05s ease-out';
        if (mainApptWrap) mainApptWrap.style.transition = 'transform 0.05s ease-out';
        targetReflection.style.transition = 'none';
        targetReflectionWrap.style.transition = 'none';
        document.body.style.cursor = 'grabbing';
    };

    mainAppt.addEventListener('mousedown', handleDragStart);
    if (mainApptWrap) mainApptWrap.addEventListener('mousedown', handleDragStart);

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaY = e.clientY - startY;
        const deltaMin = (deltaY / (HOUR_HEIGHT || 1)) * 60;

        let newMin = Math.round((startMinY + deltaMin) / 15) * 15;

        // Robust boundaries
        const maxStartMin = TOTAL_MINUTES - 15; // Allow scheduling up to 23:45
        if (newMin < 0) newMin = 0;
        if (newMin > maxStartMin) newMin = maxStartMin;

        if (newMin !== currentApptMin) {
            currentApptMin = newMin;
            syncUI();
        }
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        mainAppt.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        targetReflection.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        targetReflectionWrap.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        document.body.style.cursor = 'default';
    });
}

// --- CLOCK & NOW LINE ---

function startTimeUpdate() {
    setInterval(() => {
        syncUI();
    }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
