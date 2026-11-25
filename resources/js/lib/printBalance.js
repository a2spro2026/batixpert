import { openPrintPreview } from './printDocument';

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function printBalance({ title, subtitle, columns, rows, summary }) {
    const head = columns.map((column) => `<th>${esc(column)}</th>`).join('');
    const body = rows.length
        ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}">Aucune ligne</td></tr>`;
    const totals = summary.map((line) => `<div>${esc(line)}</div>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
        body{margin:0;color:#0f172a;font-family:"Segoe UI",Arial,sans-serif}
        .sheet{padding:18px 22px}
        h1{margin:0 0 4px;font-size:18px}
        p{margin:0 0 14px;color:#475569;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center}
        th{background:#1e3a5f;color:#fff}
        .sum{margin-top:12px;font-size:12px;font-weight:600}
    </style></head><body><div class="sheet">
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle)}</p>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        <div class="sum">${totals}</div>
    </div></body></html>`;

    openPrintPreview(html, { title, filename: title, orientation: 'landscape' });
}
