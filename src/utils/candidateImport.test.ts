import { describe, expect, it } from 'vitest';
import { parseCandidateCsv } from './candidateImport';

describe('importación de postulantes', () => {
  it('admite CSV con BOM, punto y coma y campos entre comillas', () => {
    expect(parseCandidateCsv('\uFEFFdni;nombre;celular;correo;fuente\r\n12345678;"Pérez, María";987654321;maria@ejemplo.com;Referidos\r\n')).toEqual([
      { line: 2, dni: '12345678', fullName: 'Pérez, María', phone: '987654321', email: 'maria@ejemplo.com', source: 'Referidos' },
    ]);
  });
  it('bloquea duplicados y líneas incompletas antes de guardar', () => {
    expect(() => parseCandidateCsv('dni,nombre\n12345678,Ana Pérez\n12345678,Luis Pérez')).toThrow('repetido');
    expect(() => parseCandidateCsv('dni,nombre\n12345678')).toThrow('columnas');
  });
});
