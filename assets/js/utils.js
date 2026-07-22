/**
 * ==========================================================
 * SAPA V2
 * Utility Functions
 * ==========================================================
 */

export function fmtRp(n) {
    return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function fmtWaktu(waktu) {
    const d = new Date(waktu);

    if (isNaN(d.getTime())) {
        return String(waktu);
    }

    return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function escapeHtml(str) {

    if (!str) return "";

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}

export function sanitizeJsonString(raw) {

    let result = "";
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < raw.length; i++) {

        const ch = raw[i];

        if (escapeNext) {
            result += ch;
            escapeNext = false;
            continue;
        }

        if (ch === "\\" && inString) {
            result += ch;
            escapeNext = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
        }

        if (inString && ch === "\n") {
            result += "\\n";
            continue;
        }

        if (inString && ch === "\r") {
            continue;
        }

        if (inString && ch === "\t") {
            result += "\\t";
            continue;
        }

        result += ch;

    }

    return result;

}

export function parseJsonSafe(raw) {

    if (typeof raw !== "string") {
        throw new Error("AI tidak mengembalikan teks JSON.");
    }

    let clean = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .replace(/\u200B/g, "")
        .trim();

    const kandidat = [
        clean,
        sanitizeJsonString(clean)
    ];

    const arrMatch = clean.match(/(\[[\s\S]*\])/);

    if (arrMatch) {
        kandidat.push(arrMatch[1]);
        kandidat.push(sanitizeJsonString(arrMatch[1]));
    }

    const objMatch = clean.match(/(\{[\s\S]*\})/);

    if (objMatch) {
        kandidat.push(objMatch[1]);
        kandidat.push(sanitizeJsonString(objMatch[1]));
    }

    for (const teks of kandidat) {
        try {
            return JSON.parse(teks);
        } catch (_) {}
    }

    console.error(clean);

    throw new Error("Format jawaban AI tidak sesuai.");

}

export function markdownRingan(text) {

    if (text == null) return "";

    const escaped = escapeHtml(String(text))
        .replace(/\r/g, "")
        .replace(/\u200B/g, "");

    const lines = escaped.split("\n");

    let html = "";
    let listType = null;

    const closeList = () => {

        if (listType) {
            html += `</${listType}>`;
            listType = null;
        }

    };

    for (let line of lines) {

        line = line.trim();

        if (!line) {
            closeList();
            continue;
        }

        line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        line = line.replace(/\*(.+?)\*/g, "<em>$1</em>");
        line = line.replace(/^#{1,6}\s*/, "");

        const bullet = line.match(/^[-*•]\s+(.+)/);
        const number = line.match(/^\d+[.)]\s+(.+)/);

        if (bullet) {

            if (listType !== "ul") {
                closeList();
                html += "<ul>";
                listType = "ul";
            }

            html += `<li>${bullet[1]}</li>`;
            continue;

        }

        if (number) {

            if (listType !== "ol") {
                closeList();
                html += "<ol>";
                listType = "ol";
            }

            html += `<li>${number[1]}</li>`;
            continue;

        }

        closeList();

        html += `<p>${line}</p>`;

    }

    closeList();

    return html;

}

export function markdownIklan(text) {

    if (!text) return "";

    const escaped = escapeHtml(text);

    const lines = escaped.split("\n");

    let html = "";

    let listTag = null;

    const headings = [
        "CONTOH IKLAN",
        "TARGET PEMBELI",
        "LANGKAH MEMULAI IKLAN",
        "TIPS TAMBAHAN"
    ];

    const close = () => {

        if (listTag) {
            html += `</${listTag}>`;
            listTag = null;
        }

    };

    lines.forEach(raw => {

        let line = raw.trim();

        line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        line = line.replace(/^#{1,6}\s*/, "");

        if (headings.some(h => line.toUpperCase().startsWith(h))) {

            close();

            html += `<p><strong>${line}</strong></p>`;

            return;

        }

        const bullet = line.match(/^[-*•]\s+(.+)/);

        const number = line.match(/^\d+[.)]\s+(.+)/);

        if (bullet) {

            if (listTag !== "ul") {

                close();

                html += "<ul>";

                listTag = "ul";

            }

            html += `<li>${bullet[1]}</li>`;

            return;

        }

        if (number) {

            if (listTag !== "ul") {

                close();

                html += "<ul>";

                listTag = "ul";

            }

            html += `<li>${number[1]}</li>`;

            return;

        }

        close();

        if (line) {
            html += `<p>${line}</p>`;
        }

    });

    close();

    return html;

}