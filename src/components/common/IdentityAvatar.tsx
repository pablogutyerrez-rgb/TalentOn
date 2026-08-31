import React, { useEffect, useState } from 'react';
import { getIdentityInitials, normalizeAvatarUrl, sanitizeDisplayName } from '../../utils/identity';

interface IdentityAvatarProps {
  src?: string | null;
  name?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export const IdentityAvatar: React.FC<IdentityAvatarProps> = ({
  src,
  name,
  alt,
  className = 'h-9 w-9 rounded-full',
  fallbackClassName = 'bg-sky-50 text-sky-800',
}) => {
  const normalizedSrc = normalizeAvatarUrl(src);
  const displayName = sanitizeDisplayName(name);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [normalizedSrc]);

  if (normalizedSrc && !failed) {
    return (
      <img
        src={normalizedSrc}
        alt={alt ?? displayName}
        className={`${className} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={alt ?? displayName}
      title={displayName}
      className={`${className} ${fallbackClassName} inline-flex shrink-0 items-center justify-center overflow-hidden font-bold uppercase`}
    >
      {getIdentityInitials(displayName)}
    </span>
  );
};
