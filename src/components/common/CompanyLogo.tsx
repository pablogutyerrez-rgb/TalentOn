const companyLogos: Record<string, string> = {
  'techcenter': '/company-techcenter.png',
  'tech-center': '/company-techcenter.png',
  'konectados': '/company-konectados.png',
  'conectados': '/company-konectados.png',
  'talent-up': '/company-talent-up.png',
  'talentup': '/company-talent-up.png',
};

export function companyLogoSource(companyId?: string, companyName?: string): string | undefined {
  for (const candidate of [companyId, companyName]) {
    const normalized = candidate?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (normalized && companyLogos[normalized]) return companyLogos[normalized];
  }
  return undefined;
}

export function CompanyLogo({ companyId, companyName, className = '' }: { companyId?: string; companyName?: string; className?: string }) {
  const source = companyLogoSource(companyId, companyName);
  if (!source) return null;
  return <img src={source} alt={`Logo de ${companyName || companyId}`} className={`h-16 w-44 shrink-0 rounded-lg object-cover object-center ${source === '/company-konectados.png' ? 'bg-[#102438]' : 'bg-white'} ${className}`} />;
}
