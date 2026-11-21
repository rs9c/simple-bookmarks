const SB_COLORS = [
    { id: "orangered", hex: "#FF3300", nameKey: "colorOrangeRed" },
    { id: "yellow", hex: "#FFC400", nameKey: "colorYellow", ink: "#3a3a3a" },
    { id: "green", hex: "#22C55E", nameKey: "colorGreen" },
    { id: "cyan", hex: "#22D3EE", nameKey: "colorCyan", ink: "#3a3a3a" },
    { id: "purple", hex: "#A855F7", nameKey: "colorPurple" },
    { id: "gray", hex: "#9CA3AF", nameKey: "colorGray", ink: "#3a3a3a" },
];

const SB_KEYS = {
    enabled: "sb_enabled",
    layout: "sb_layout",
    bookmark: (colorId) => `sb_bm_${colorId}`,
};
