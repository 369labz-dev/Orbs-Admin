export function csvText(columns: string[], rows: unknown[][]): string {
    const cell = (value: unknown) => {
        let text = value == null ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(text))
            text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
    };
    return '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export const utc = (value: number | null | undefined) => value ? new Date(value).toISOString() : '';
export function downloadCsv(name: string, columns: string[], rows: unknown[][]) {
    const url = URL.createObjectURL(new Blob([csvText(columns, rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}
