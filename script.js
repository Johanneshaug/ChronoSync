let currentApptMin = 600; // start at 10:00 AM
let currentDuration = 60; // 1 hour
let HOUR_HEIGHT = 20; // baseline

const TOTAL_MINUTES = 24 * 60;

const sourceTzSelect = document.getElementById('source-tz');
const targetTzSelect = document.getElementById('target-tz');
const durationSelect = document.getElementById('meeting-duration');
const mainAppt = document.getElementById('main-appointment');
const targetReflection = document.getElementById('target-reflection');
const targetReflectionWrap = document.getElementById('target-reflection-wrap');
const sourceRangeTxt = document.getElementById('source-range');
const targetRangeTxt = document.getElementById('target-range');
const targetRangeWrapTxt = document.getElementById('target-range-wrap');
const sourceTimeDisplay = document.getElementById('source-current');
const targetTimeDisplay = document.getElementById('target-current');

// --- INITIALIZATION ---

function init() {
    populateTimezones();
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
    const endTotal = currentApptMin + currentDuration;
    const endH = Math.floor((endTotal % TOTAL_MINUTES) / 60);
    const endM = endTotal % 60;

    mainAppt.style.top = `${(currentApptMin / 60) * HOUR_HEIGHT}px`;
    mainAppt.style.height = `${(currentDuration / 60) * HOUR_HEIGHT}px`;
    sourceRangeTxt.textContent = `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`;

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
}

function formatTime(h, m) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// --- INTERACTION ---

function setupDragging() {
    let isDragging = false;
    let startY = 0;
    let startMinY = 0;

    mainAppt.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startMinY = currentApptMin;
        mainAppt.style.transition = 'transform 0.05s ease-out';
        targetReflection.style.transition = 'none';
        targetReflectionWrap.style.transition = 'none';
        document.body.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaY = e.clientY - startY;
        const deltaMin = (deltaY / (HOUR_HEIGHT || 1)) * 60;

        let newMin = Math.round((startMinY + deltaMin) / 15) * 15;

        // Robust boundaries
        const maxStartMin = TOTAL_MINUTES - currentDuration;
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
