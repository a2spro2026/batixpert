const PAGE_WIDTH_PX = { portrait: 794, landscape: 1123 };
const PAGE_MM = { portrait: [210, 297], landscape: [297, 210] };
const MAX_CANVAS_PIXELS = 12_000_000;

function slugify(value) {
    return String(value || 'document')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'document';
}

function waitForFrame(iframe, html) {
    return new Promise((resolve) => {
        iframe.addEventListener('load', () => resolve(iframe), { once: true });
        iframe.srcdoc = html;
    });
}

function waitForAssets(doc) {
    const images = [...doc.images].filter((img) => !img.complete);
    const fonts = doc.fonts?.ready ?? Promise.resolve();
    return Promise.all([
        fonts,
        ...images.map((img) => new Promise((r) => { img.onload = r; img.onerror = r; })),
    ]);
}

/**
 * Picks slice heights that end on a table row or a top-level block,
 * so rows are not cut in half between two PDF pages.
 */
function computeSlices(root, totalHeight, pageHeightAt) {
    const top = root.getBoundingClientRect().top;
    const breaks = [...root.querySelectorAll('tr'), ...root.children]
        .map((el) => el.getBoundingClientRect().bottom - top)
        .filter((y) => y > 0 && y < totalHeight)
        .sort((a, b) => a - b);

    const slices = [];
    let y = 0;
    while (y < totalHeight - 1) {
        const pageHeight = pageHeightAt(slices.length);
        const limit = y + pageHeight;
        if (limit >= totalHeight) {
            slices.push([y, totalHeight]);
            break;
        }
        const candidates = breaks.filter((b) => b > y + pageHeight * 0.4 && b <= limit);
        const end = candidates.length ? candidates[candidates.length - 1] : limit;
        slices.push([y, end]);
        y = end;
    }
    return slices;
}

async function buildPdf(html, orientation, pageWidthPx) {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

    const width = pageWidthPx || PAGE_WIDTH_PX[orientation];
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
        position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: '1200px', border: '0',
    });
    document.body.appendChild(frame);

    try {
        await waitForFrame(frame, html);
        const doc = frame.contentDocument;
        await waitForAssets(doc);

        const sheet = doc.querySelector('.sheet');
        const root = sheet || doc.body;
        const marginMm = sheet ? 0 : 8;
        if (sheet) {
            Object.assign(sheet.style, { margin: '0', boxShadow: 'none' });
            doc.body.style.background = '#fff';
        }
        frame.style.height = `${doc.documentElement.scrollHeight + 20}px`;

        const rootWidth = root.scrollWidth;
        const rootHeight = root.scrollHeight;

        const [pageW, pageH] = PAGE_MM[orientation];
        const contentW = pageW - marginMm * 2;
        const pxPerMm = rootWidth / contentW;
        // A `.sheet` carries its own padding on the first page only.
        const topAt = (i) => (sheet && i > 0 ? 12 : marginMm);
        const bottomMm = sheet ? 10 : marginMm;
        const slices = computeSlices(root, rootHeight, (i) => (pageH - topAt(i) - bottomMm) * pxPerMm);

        const scale = rootWidth > 1000 ? 1.5 : 2;
        // Pages are captured in groups whose bitmap stays under mobile browsers' canvas area limit.
        const groups = [];
        slices.forEach((slice) => {
            const group = groups[groups.length - 1];
            const area = group ? (slice[1] - group.start) * rootWidth * scale * scale : Infinity;
            if (area <= MAX_CANVAS_PIXELS) {
                group.slices.push(slice);
            } else {
                groups.push({ start: slice[0], slices: [slice] });
            }
        });

        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
        let index = 0;
        for (const group of groups) {
            const groupEnd = group.slices[group.slices.length - 1][1];
            const canvas = await html2canvas(root, {
                scale,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: Math.max(width, rootWidth),
                x: 0,
                y: group.start,
                width: rootWidth,
                height: Math.ceil(groupEnd - group.start),
            });
            const ratio = canvas.width / rootWidth;

            for (const [start, end] of group.slices) {
                const piece = document.createElement('canvas');
                piece.width = canvas.width;
                piece.height = Math.max(1, Math.round((end - start) * ratio));
                const ctx = piece.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, piece.width, piece.height);
                ctx.drawImage(canvas, 0, Math.round((start - group.start) * ratio), canvas.width, piece.height, 0, 0, canvas.width, piece.height);

                if (index > 0) pdf.addPage('a4', orientation);
                pdf.addImage(piece.toDataURL('image/jpeg', 0.9), 'JPEG', marginMm, topAt(index), contentW, (end - start) / pxPerMm);
                pdf.setFontSize(7);
                pdf.setTextColor(148, 163, 184);
                pdf.text(`Page ${index + 1} / ${slices.length}`, pageW - 6, pageH - 4, { align: 'right' });
                piece.width = 0;
                index += 1;
            }
            canvas.width = 0;
        }

        return pdf;
    } finally {
        frame.remove();
    }
}

/**
 * Generates an A4 PDF from a print HTML document and downloads it.
 * With `share: true`, opens the native share sheet when available (mobile).
 */
export async function downloadPdf(html, options = {}) {
    const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
    const filename = `${slugify(options.filename || options.title)}.pdf`;
    const pdf = await buildPdf(html, orientation, options.width);

    if (options.share && typeof navigator.share === 'function') {
        const file = new File([pdf.output('blob')], filename, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: options.title || filename });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
    }
    pdf.save(filename);
}

const BTN_BASE = 'border:0;border-radius:8px;padding:8px 14px;font:700 12px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;';

/**
 * In-app print preview (works on mobile, unlike popup windows):
 * shows the document with « PDF », « Imprimer » and « Fermer » side by side.
 */
export function openPrintPreview(html, options = {}) {
    const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
    const title = options.title || 'Aperçu avant impression';
    const pageWidth = options.width || PAGE_WIDTH_PX[orientation];

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;background:#0f172a;text-transform:none;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;background:#0f172a;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.3);';

    const label = document.createElement('span');
    label.textContent = title;
    label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 13px "Segoe UI",Arial,sans-serif;';

    const makeBtn = (text, style) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = BTN_BASE + style;
        return b;
    };
    const pdfBtn = makeBtn('PDF', 'background:#dc2626;color:#fff;');
    const printBtn = makeBtn('Imprimer', 'background:#f97316;color:#fff;');
    const closeBtn = makeBtn('Fermer', 'background:#334155;color:#e2e8f0;');
    toolbar.append(label, pdfBtn, printBtn, closeBtn);

    const viewport = document.createElement('div');
    viewport.style.cssText = 'flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;background:#cbd5e1;';

    const holder = document.createElement('div');
    holder.style.cssText = 'margin:0 auto;overflow:hidden;';

    const iframe = document.createElement('iframe');
    iframe.title = title;
    iframe.style.cssText = `display:block;border:0;background:#fff;width:${pageWidth}px;height:1200px;transform-origin:0 0;`;

    holder.appendChild(iframe);
    viewport.appendChild(holder);
    overlay.append(toolbar, viewport);
    document.body.appendChild(overlay);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const layout = () => {
        const doc = iframe.contentDocument;
        if (!doc?.documentElement) return;
        const available = viewport.clientWidth;
        const scale = Math.min(1, available / pageWidth);
        const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0);
        iframe.style.height = `${height}px`;
        iframe.style.transform = scale < 1 ? `scale(${scale})` : '';
        holder.style.width = `${pageWidth * scale}px`;
        holder.style.height = `${height * scale}px`;
    };

    iframe.addEventListener('load', () => {
        layout();
        waitForAssets(iframe.contentDocument).then(layout);
    });
    iframe.srcdoc = html;
    window.addEventListener('resize', layout);

    const close = () => {
        window.removeEventListener('resize', layout);
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = previousOverflow;
        overlay.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    closeBtn.addEventListener('click', close);
    printBtn.addEventListener('click', () => {
        const win = iframe.contentWindow;
        if (!win) return;
        win.focus();
        win.print();
    });
    pdfBtn.addEventListener('click', async () => {
        if (pdfBtn.disabled) return;
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'PDF…';
        try {
            await downloadPdf(html, { ...options, orientation });
        } catch (err) {
            console.error(err);
            window.alert('Impossible de générer le PDF.');
        } finally {
            pdfBtn.disabled = false;
            pdfBtn.textContent = 'PDF';
        }
    });

    return close;
}
