const colorsContainer = document.querySelector(".colors");
const enabled = {};
const bookmarks = {};

document.querySelector("h1").textContent = browser.i18n.getMessage("popupTitle");

function createColorSwatch(color) {
    const bookmark = bookmarks[color.id];
    const swatch = document.createElement("div");
    swatch.className = "color";
    swatch.style.backgroundColor = color.hex;
    if (bookmark?.url) swatch.classList.add("linked");

    if (enabled[color.id] && bookmark?.icon) {
        const icon = document.createElement("img");
        icon.className = "icon";
        icon.src = bookmark.icon;
        icon.addEventListener("error", () => icon.remove());
        swatch.append(icon);
    } else if (enabled[color.id] && bookmark?.title) {
        const letter = document.createElement("span");
        letter.className = "letter";
        letter.textContent = [...bookmark.title.trim()][0] ?? "";
        swatch.append(letter);
    }

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(enabled[color.id]);
    input.title = browser.i18n.getMessage(color.nameKey);
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => setColorEnabled(color.id, input.checked, swatch));

    swatch.append(input);

    swatch.addEventListener("mousedown", (event) => {
        if (event.button === 1) event.preventDefault();
    });
    swatch.addEventListener("click", (event) => openBookmark(color.id, event.ctrlKey || event.metaKey));
    swatch.addEventListener("auxclick", (event) => {
        if (event.button === 1) openBookmark(color.id, true);
    });

    return swatch;
}

function openBookmark(colorId, newTab) {
    const bookmark = bookmarks[colorId];
    if (!bookmark?.url) return;
    browser.runtime.sendMessage({ type: "open", url: bookmark.url, newTab });
}

async function setColorEnabled(colorId, isEnabled, swatch) {
    enabled[colorId] = isEnabled;

    if (!isEnabled) {
        delete bookmarks[colorId];
        swatch.classList.remove("linked");
        swatch.querySelector(".icon, .letter")?.remove();
        await browser.storage.sync.remove(SB_KEYS.bookmark(colorId));
    }

    await browser.storage.sync.set({ [SB_KEYS.enabled]: enabled });
}

async function init() {
    const bookmarkKeys = SB_COLORS.map((color) => SB_KEYS.bookmark(color.id));
    const stored = await browser.storage.sync.get([SB_KEYS.enabled, ...bookmarkKeys]);
    Object.assign(enabled, stored[SB_KEYS.enabled] ?? {});
    for (const color of SB_COLORS) {
        bookmarks[color.id] = stored[SB_KEYS.bookmark(color.id)] ?? null;
    }
    colorsContainer.append(...SB_COLORS.map(createColorSwatch));
}

init();
