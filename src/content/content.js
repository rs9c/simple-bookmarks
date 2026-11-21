const BOOKMARK_HEIGHT = 30;
const TIP_WIDTH = 18;
const ICON_SIZE = 22;
const FILLED_WIDTH = ICON_SIZE + 8;
const CORNER_RADIUS = 4;
const DRAG_THRESHOLD = 4;
const PULL_THRESHOLD = 0.6;
const PULL_SLACK = 16;
const TITLE_LIMIT = 30;
const TOOLTIP_DELAY = 220;

const host = document.createElement("div");
host.style.cssText = "position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
const shadow = host.attachShadow({ mode: "open" });
const strip = document.createElement("div");
strip.id = "strip";

const tooltip = document.createElement("div");
tooltip.className = "tooltip";
tooltip.hidden = true;

shadow.append(strip, tooltip);
document.documentElement.append(host);

const items = new Map();
const bookmarks = {};
let topRatio = 0.5;
let pullWidth = 0;
let drag = null;
let suppressClick = false;
let tooltipTimer = 0;
let pointerX = 0;
let pointerY = 0;

function distance(from, to) {
    return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

function shift(from, towards, length) {
    const span = distance(from, towards);
    if (!span) return from;
    return [from[0] + ((towards[0] - from[0]) * length) / span, from[1] + ((towards[1] - from[1]) * length) / span];
}

function shapePath(width) {
    const tip = clamp(FILLED_WIDTH - width, 0, TIP_WIDTH);
    const points = [
        [0, BOOKMARK_HEIGHT / 2],
        [tip, 0],
        [width, 0],
        [width, BOOKMARK_HEIGHT],
        [tip, BOOKMARK_HEIGHT],
    ];

    const corners = points.map((point, index) => {
        const previous = points[(index + points.length - 1) % points.length];
        const next = points[(index + 1) % points.length];
        const radius = Math.min(CORNER_RADIUS, distance(point, previous) / 2, distance(point, next) / 2);
        return { point, entry: shift(point, previous, radius), exit: shift(point, next, radius) };
    });

    return corners.map(({ point, entry, exit }, index) => `${index ? "L" : "M"}${entry[0]} ${entry[1]}Q${point[0]} ${point[1]} ${exit[0]} ${exit[1]}`).join("") + "Z";
}

function updateShape(element) {
    const width = element.getBoundingClientRect().width;
    element.querySelector(".shape").style.clipPath = `path("${shapePath(width)}")`;
}

const shapeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) updateShape(entry.target);
});

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function findNextItem(color) {
    for (let index = SB_COLORS.indexOf(color) + 1; index < SB_COLORS.length; index++) {
        const element = items.get(SB_COLORS[index].id);
        if (element) return element;
    }
    return null;
}

function createItem(color) {
    const element = document.createElement("div");
    element.className = "item";

    const body = document.createElement("div");
    body.className = "body";

    const shape = document.createElement("div");
    shape.className = "shape";
    shape.style.backgroundColor = color.hex;

    const icon = document.createElement("img");
    icon.className = "icon";
    icon.draggable = false;
    icon.hidden = true;

    const letter = document.createElement("span");
    letter.className = "letter";
    letter.hidden = true;

    icon.addEventListener("error", () => {
        icon.hidden = true;
        letter.hidden = !letter.textContent;
    });

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = browser.i18n.getMessage("clearBookmark");
    if (color.ink) label.style.color = color.ink;

    shape.append(icon, letter, label);
    body.append(shape);
    element.append(body);
    strip.insertBefore(element, findNextItem(color));

    if (!pullWidth) {
        const style = getComputedStyle(label);
        const leftGap = parseFloat(style.left);
        const rightGap = parseFloat(style.right);
        label.style.width = "max-content";
        label.style.right = "auto";
        pullWidth = Math.ceil(leftGap + label.getBoundingClientRect().width + rightGap + PULL_SLACK);
        label.style.width = "";
        label.style.right = "";
    }

    bindItemEvents(element, color);
    return element;
}

function applyBookmark(colorId, bookmark) {
    bookmarks[colorId] = bookmark ?? null;

    const element = items.get(colorId);
    if (!element) return;

    const icon = element.querySelector(".icon");
    const letter = element.querySelector(".letter");
    letter.textContent = firstLetter(bookmark?.title);

    if (bookmark?.icon) {
        icon.src = bookmark.icon;
        icon.hidden = false;
        letter.hidden = true;
    } else {
        icon.removeAttribute("src");
        icon.hidden = true;
        letter.hidden = !letter.textContent;
    }

    element.style.width = `${bookmark?.url ? FILLED_WIDTH : TIP_WIDTH}px`;
}

function addItem(color, animate) {
    const element = createItem(color);
    if (!animate) element.classList.add("instant");
    items.set(color.id, element);
    applyBookmark(color.id, bookmarks[color.id]);
    shapeObserver.observe(element);

    if (animate) {
        element.classList.add("collapsed");
        requestAnimationFrame(() => element.classList.remove("collapsed"));
    } else {
        requestAnimationFrame(() => element.classList.remove("instant"));
    }
}

function removeItem(colorId) {
    const element = items.get(colorId);
    if (!element) return;

    items.delete(colorId);
    shapeObserver.unobserve(element);
    element.classList.add("collapsed");
    setTimeout(() => element.remove(), 300);
}

function applyEnabled(enabled) {
    for (const color of SB_COLORS) {
        const element = items.get(color.id);
        if (enabled[color.id] && !element) addItem(color, true);
        else if (!enabled[color.id] && element) removeItem(color.id);
    }
}

function updateTop() {
    const available = Math.max(window.innerHeight - strip.offsetHeight, 0);
    strip.style.top = `${clamp(topRatio * available, 0, available)}px`;
}

function firstLetter(title) {
    return title ? ([...title.trim()][0] ?? "") : "";
}

function shortenTitle(title) {
    const characters = [...title.trim()];
    return characters.length > TITLE_LIMIT ? `${characters.slice(0, TITLE_LIMIT).join("")}…` : characters.join("");
}

function placeTooltip() {
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    tooltip.style.left = `${clamp(pointerX + 14, 8, window.innerWidth - width - 8)}px`;
    tooltip.style.top = `${clamp(pointerY + 18, 8, window.innerHeight - height - 8)}px`;
}

function showTooltip(colorId) {
    const title = bookmarks[colorId]?.title?.trim();
    if (!title) return;
    tooltip.textContent = shortenTitle(title);
    tooltip.hidden = false;
    placeTooltip();
}

function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltip.hidden = true;
}

function startDrag(event, element, color) {
    if (event.button !== 0) return;

    hideTooltip();
    suppressClick = false;
    drag = {
        colorId: color.id,
        element,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: element.getBoundingClientRect().width,
        startTop: strip.offsetTop,
        width: element.getBoundingClientRect().width,
        top: strip.offsetTop,
        mode: null,
    };
    element.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.mode) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) return;
        const canPull = bookmarks[drag.colorId]?.url && deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
        drag.mode = canPull ? "pull" : "move";
        strip.classList.add("dragging");
    }

    if (drag.mode === "pull") {
        drag.width = clamp(drag.startWidth - deltaX, drag.startWidth, pullWidth);
        drag.element.style.width = `${drag.width}px`;
        drag.element.querySelector(".label").style.opacity = (drag.width - drag.startWidth) / (pullWidth - drag.startWidth);
    } else {
        const available = Math.max(window.innerHeight - strip.offsetHeight, 0);
        drag.top = clamp(drag.startTop + deltaY, 0, available);
        strip.style.top = `${drag.top}px`;
    }
}

function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const { mode, element, colorId, startWidth, width, top } = drag;
    strip.classList.remove("dragging");
    suppressClick = Boolean(mode);

    if (mode === "pull") {
        element.querySelector(".label").style.opacity = "";
        if ((width - startWidth) / (pullWidth - startWidth) >= PULL_THRESHOLD) {
            element.style.width = `${TIP_WIDTH}px`;
            browser.storage.sync.remove(SB_KEYS.bookmark(colorId));
        } else {
            element.style.width = `${startWidth}px`;
        }
    } else if (mode === "move") {
        const available = Math.max(window.innerHeight - strip.offsetHeight, 0);
        topRatio = available ? clamp(top / available, 0, 1) : 0;
        browser.storage.sync.set({ [SB_KEYS.layout]: { ratio: topRatio } });
    }

    drag = null;
}

function cancelDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.mode === "pull") {
        drag.element.querySelector(".label").style.opacity = "";
        drag.element.style.width = `${drag.startWidth}px`;
    }

    strip.classList.remove("dragging");
    drag = null;
}

function findFaviconUrls() {
    const urls = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((link) => link.href).filter(Boolean);
    urls.push(new URL("/favicon.ico", location.href).href);
    return [...new Set(urls)];
}

async function saveBookmark(colorId) {
    const url = location.href;
    const title = document.title;
    await browser.storage.sync.set({ [SB_KEYS.bookmark(colorId)]: { url, title } });

    const icon = await browser.runtime.sendMessage({ type: "fetchIcon", urls: findFaviconUrls() }).catch(() => null);

    if (icon) {
        await browser.storage.sync.set({ [SB_KEYS.bookmark(colorId)]: { url, title, icon } });
    }
}

function openBookmark(colorId, newTab) {
    const bookmark = bookmarks[colorId];
    if (!bookmark?.url) return;
    browser.runtime.sendMessage({ type: "open", url: bookmark.url, newTab });
}

function bindItemEvents(element, color) {
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("pointerdown", (event) => startDrag(event, element, color));
    element.addEventListener("pointermove", moveDrag);
    element.addEventListener("pointerup", endDrag);
    element.addEventListener("pointercancel", cancelDrag);
    element.addEventListener("pointerenter", (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => showTooltip(color.id), TOOLTIP_DELAY);
    });
    element.addEventListener("pointerleave", hideTooltip);
    element.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        saveBookmark(color.id);
    });
    element.addEventListener("click", (event) => {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        openBookmark(color.id, event.ctrlKey || event.metaKey);
    });
    element.addEventListener("auxclick", (event) => {
        if (event.button === 1) openBookmark(color.id, true);
    });
}

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;

    if (changes[SB_KEYS.enabled]) applyEnabled(changes[SB_KEYS.enabled].newValue ?? {});

    if (changes[SB_KEYS.layout]) {
        topRatio = changes[SB_KEYS.layout].newValue?.ratio ?? 0.5;
        updateTop();
    }

    for (const color of SB_COLORS) {
        const change = changes[SB_KEYS.bookmark(color.id)];
        if (change) applyBookmark(color.id, change.newValue);
    }
});

window.addEventListener("resize", updateTop);
new ResizeObserver(updateTop).observe(strip);

strip.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!tooltip.hidden) placeTooltip();
});

async function init() {
    const css = await fetch(browser.runtime.getURL("content/content.css")).then((response) => response.text());
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];

    const keys = [SB_KEYS.enabled, SB_KEYS.layout, ...SB_COLORS.map((color) => SB_KEYS.bookmark(color.id))];
    const stored = await browser.storage.sync.get(keys);

    topRatio = stored[SB_KEYS.layout]?.ratio ?? 0.5;
    for (const color of SB_COLORS) {
        bookmarks[color.id] = stored[SB_KEYS.bookmark(color.id)] ?? null;
    }

    const enabled = stored[SB_KEYS.enabled] ?? {};
    for (const color of SB_COLORS) {
        if (enabled[color.id]) addItem(color, false);
    }

    updateTop();
    strip.classList.add("ready");
}

init();
