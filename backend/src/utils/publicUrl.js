const PRODUCTION_FRONTEND_URL = 'https://gem.proquelec.sn';

function isLocalUrl(url) {
  return /\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

export function getPublicFrontendUrl() {
  const configuredUrl = String(process.env.FRONTEND_URL || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!configuredUrl || (isProduction && isLocalUrl(configuredUrl))) {
    return PRODUCTION_FRONTEND_URL;
  }

  try {
    const parsed = new URL(configuredUrl);
    if (isProduction) {
      parsed.protocol = 'https:';
      if (parsed.hostname === 'www.gem.proquelec.sn') {
        parsed.hostname = 'gem.proquelec.sn';
      }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return isProduction ? PRODUCTION_FRONTEND_URL : 'http://localhost:5173';
  }
}

export function buildPublicUrl(path = '') {
  const normalizedPath = String(path || '');
  return `${getPublicFrontendUrl()}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}
