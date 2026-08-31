export const sanitizeDisplayName = (value?: string | null, fallback = 'Usuario'): string => {
  const cleaned = (value || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F\uFFFD]/g, '')
    .replace(/\^+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
};

export const getIdentityInitials = (value?: string | null, fallback = 'U'): string => {
  const name = sanitizeDisplayName(value, '');
  if (!name) return fallback;

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toLocaleUpperCase('es-PE') || fallback;
};

export const normalizeAvatarUrl = (value?: string | null): string => {
  const url = (value || '').trim();
  if (!url) return '';

  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(url) ? url : '';
};
