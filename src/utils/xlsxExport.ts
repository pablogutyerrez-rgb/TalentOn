import { strToU8, zipSync } from 'fflate';
import type { ExportCell, ExportSheet } from './candidateFormExport';

const xml = (value: unknown) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const columnName = (index: number): string => {
  let value = index + 1, result = '';
  while (value) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
};

function cell(value: ExportCell, column: number, row: number, header: boolean): string {
  if (value === undefined || value === null || value === '') return '';
  const address = `${columnName(column)}${row}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${address}" s="${header ? 1 : 2}" t="n"><v>${value}</v></c>`;
  const text = String(value);
  if (text.length > 32767) throw new Error('Una respuesta supera el límite de caracteres de Excel. No se generó un archivo incompleto.');
  // inlineStr evita que respuestas que comienzan con =, +, - o @ se ejecuten como fórmulas.
  return `<c r="${address}" s="${header ? 1 : 2}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
}

function sheetXml(sheet: ExportSheet): string {
  if (sheet.headers.length > 16384 || sheet.rows.length + 1 > 1048576) throw new Error('La exportación supera la capacidad de una hoja de Excel. No se generó un archivo incompleto.');
  const rows = [sheet.headers, ...sheet.rows];
  if (rows.some(row => row.length !== sheet.headers.length)) throw new Error('Una fila de la exportación está incompleta. No se generó el archivo.');
  const cols = sheet.headers.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(52, Math.max(15, header.length + 5))}" customWidth="1"/>`).join('');
  const data = rows.map((values, index) => {
    const lines = Math.max(1, ...values.map((value, column) => Math.ceil(String(value ?? '').length / Math.max(15, Math.min(52, sheet.headers[column].length + 5)))));
    const height = index === 0 ? 30 : Math.min(102, Math.max(17, lines * 17));
    return `<row r="${index + 1}" ht="${height}" customHeight="1">${values.map((value, column) => cell(value, column, index + 1, index === 0)).join('')}</row>`;
  }).join('');
  const range = `A1:${columnName(sheet.headers.length - 1)}${rows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${cols}</cols><sheetData>${data}</sheetData><autoFilter ref="${range}"/></worksheet>`;
}

export function createXlsx(sheets: ExportSheet[]): Uint8Array {
  if (!sheets.length || sheets.some(sheet => !sheet.headers.length)) throw new Error('No hay columnas para exportar.');
  const types = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const relations = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${types}</Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/><color rgb="FF0C1E35"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF143A56"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function downloadXlsx(sheets: ExportSheet[], filename: string): void {
  const bytes = createXlsx(sheets);
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
