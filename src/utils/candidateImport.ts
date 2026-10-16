export interface CandidateImportRow {
  line: number;
  dni: string;
  fullName: string;
  phone: string;
  email: string;
  source: string;
}

export const CANDIDATE_IMPORT_TEMPLATE = 'dni,nombre,celular,correo,fuente\r\n12345678,María Pérez,987654321,maria@ejemplo.com,Base externa\r\n';

function parseRecords(input: string, delimiter: string): { line: number; values: string[] }[] {
  const records: { line: number; values: string[] }[] = [];
  let values: string[] = [], value = '', quoted = false, line = 1, recordLine = 1;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (!quoted && value.trim()) throw new Error(`CSV inválido en la línea ${line}.`);
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(value.trim()); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      values.push(value.trim()); value = '';
      if (values.some(Boolean)) records.push({ line: recordLine, values });
      values = [];
      if (char === '\r' && text[i + 1] === '\n') i++;
      line++; recordLine = line;
    } else {
      value += char;
      if (char === '\n') line++;
    }
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  values.push(value.trim());
  if (values.some(Boolean)) records.push({ line: recordLine, values });
  return records;
}

export function parseCandidateCsv(text: string): CandidateImportRow[] {
  if (text.length > 1024 * 1024) throw new Error('El archivo CSV no puede superar 1 MB.');
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
  const delimiter = (header.match(/;/g)?.length || 0) > (header.match(/,/g)?.length || 0) ? ';' : ',';
  const records = parseRecords(text, delimiter);
  if (records.length < 2) throw new Error('El CSV debe incluir cabecera y al menos un postulante.');
  const columns = records[0].values.map(value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const column = (...names: string[]) => columns.findIndex(value => names.includes(value));
  const indexes = {
    dni: column('dni', 'documento', 'numero de documento'),
    fullName: column('nombre', 'nombre completo', 'nombres y apellidos'),
    phone: column('celular', 'telefono', 'whatsapp'),
    email: column('correo', 'email', 'correo electronico'),
    source: column('fuente', 'origen'),
  };
  if (indexes.dni < 0 || indexes.fullName < 0) throw new Error('Faltan las columnas obligatorias dni y nombre. Descarga la plantilla.');
  if (records.length > 201) throw new Error('Importa hasta 200 postulantes por archivo.');
  const seen = new Set<string>();
  return records.slice(1).map(({ line, values }) => {
    if (values.length !== columns.length) throw new Error(`Línea ${line}: número de columnas incorrecto.`);
    const dni = values[indexes.dni].replace(/\s/g, '');
    const fullName = values[indexes.fullName].replace(/\s+/g, ' ').trim();
    const phone = indexes.phone < 0 ? '' : values[indexes.phone].replace(/\s/g, '');
    const email = indexes.email < 0 ? '' : values[indexes.email].trim().toLowerCase();
    const source = indexes.source < 0 ? '' : values[indexes.source].trim();
    if (!/^\d{8}$/.test(dni)) throw new Error(`Línea ${line}: el DNI debe tener 8 dígitos.`);
    if (fullName.length < 5 || !fullName.includes(' ')) throw new Error(`Línea ${line}: ingresa nombres y apellidos.`);
    if (phone && !/^9\d{8}$/.test(phone)) throw new Error(`Línea ${line}: el celular debe tener 9 dígitos y empezar por 9.`);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Línea ${line}: correo electrónico inválido.`);
    if (seen.has(dni)) throw new Error(`Línea ${line}: el DNI ${dni} está repetido en el archivo.`);
    seen.add(dni);
    return { line, dni, fullName, phone, email, source: source || 'Importación CSV' };
  });
}
