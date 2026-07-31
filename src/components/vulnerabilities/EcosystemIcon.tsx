/**
 * EcosystemIcon — renders a brand mark for the package ecosystem / language a
 * vulnerability belongs to (PyPI, npm, Go, Maven, ...). Falls back to a
 * generic shield when the ecosystem is unknown or the icon fails to load.
 */

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

/** Maps OSV ecosystem names to simple-icons slugs. */
const ECOSYSTEM_SLUGS: Record<string, string> = {
  pypi: 'pypi',
  npm: 'npm',
  go: 'go',
  golang: 'go',
  maven: 'apachemaven',
  'crates.io': 'rust',
  cargo: 'rust',
  rubygems: 'rubygems',
  nuget: 'nuget',
  packagist: 'packagist',
  composer: 'packagist',
  hex: 'elixir',
  pub: 'dart',
  'github actions': 'githubactions',
  debian: 'debian',
  ubuntu: 'ubuntu',
  alpine: 'alpinelinux',
  'rocky linux': 'rockylinux',
  'red hat': 'redhat',
  suse: 'suse',
  'opensuse': 'opensuse',
  android: 'android',
  linux: 'linux',
  bitnami: 'bitnami',
  conan: 'conan',
  cran: 'r',
  swifturl: 'swift',
  hackage: 'haskell',
  bioconductor: 'r',
};

/** Resolve the simple-icons slug for an ecosystem string, if we know one. */
export const ecosystemIconSlug = (ecosystem?: string): string | null => {
  if (!ecosystem) return null;
  // OSV suffixes distros like "Debian:11" / "Alpine:v3.18".
  const base = ecosystem.split(':')[0].trim().toLowerCase();
  return ECOSYSTEM_SLUGS[base] || null;
};

interface EcosystemIconProps {
  ecosystem?: string;
  /** Hex color (with or without leading #) used to tint the brand mark. */
  color: string;
  size?: number;
}

export const EcosystemIcon = ({ ecosystem, color, size = 20 }: EcosystemIconProps) => {
  const slug = ecosystemIconSlug(ecosystem);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slug]);

  if (!slug || failed) return <ShieldAlert size={size} />;

  const hex = color.replace('#', '');
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/${hex}`}
      alt={`${ecosystem} ecosystem`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
};

export default EcosystemIcon;
