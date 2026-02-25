export function toSafeFilename(input: string): string {
    const replacement = "-",
        lowercase = true,
        maxLength = 255;

    let name = input
        .normalize("NFKD") // split accents from letters
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-zA-Z0-9._-]+/g, replacement) // replace unsafe chars
        .replace(new RegExp(`${replacement}{2,}`, "g"), replacement)
        .replace(new RegExp(`^${replacement}|${replacement}$`, "g"), "");

    if (lowercase) {
        name = name.toLowerCase();
    }

    if (name.length > maxLength) {
        const extMatch = name.match(/(\.[^.]+)$/);
        const ext = extMatch?.[1] ?? "";
        const base = name.slice(0, maxLength - ext.length);
        name = base.replace(new RegExp(`${replacement}$`), "") + ext;
    }

    return name || "file";
}
