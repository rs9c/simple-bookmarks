importScripts("shared.js");

browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
        browser.storage.sync.set({ [SB_KEYS.enabled]: { orangered: true } });
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "fetchIcon") {
        fetchIcon(message.urls).then(sendResponse);
        return true;
    }

    if (message.type === "open") {
        if (message.newTab) {
            browser.tabs.create({ url: message.url });
        } else if (sender.tab) {
            browser.tabs.update(sender.tab.id, { url: message.url });
        } else {
            browser.tabs
                .query({ active: true, currentWindow: true })
                .then(([tab]) => browser.tabs.update(tab.id, { url: message.url }));
        }
    }
});

const ICON_SIZE = 48;
const MAX_ICON_LENGTH = 6000;

async function fetchIcon(urls) {
    for (const url of urls) {
        const icon = await loadIcon(url);
        if (icon) return icon;
    }
    return null;
}

async function loadIcon(url) {
    try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return null;

        const blob = await response.blob();
        if (!blob.size || blob.type.startsWith("text/")) return null;

        const dataUrl = (await rasterize(blob)) ?? (await toDataUrl(blob));
        return dataUrl.length <= MAX_ICON_LENGTH ? dataUrl : null;
    } catch {
        return null;
    }
}

async function rasterize(blob) {
    try {
        const bitmap = await createImageBitmap(blob);
        if (!bitmap.width || !bitmap.height) return null;

        const scale = Math.min(1, ICON_SIZE / bitmap.width, ICON_SIZE / bitmap.height);
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;

        const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, (ICON_SIZE - width) / 2, (ICON_SIZE - height) / 2, width, height);

        return await toDataUrl(await canvas.convertToBlob({ type: "image/png" }));
    } catch {
        return null;
    }
}

function toDataUrl(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}
