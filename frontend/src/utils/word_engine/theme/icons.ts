// Unicode icons for Word documents
// These characters are widely supported in modern Word versions

export const ICONS = {
  // People & Roles
  USER: '👤',
  TEAM: '👥',
  WORKER: '👷',
  MANAGER: '👔',
  
  // Location & Places
  LOCATION: '📍',
  MAP: '🗺️',
  BUILDING: '🏢',
  HOME: '🏠',
  
  // Time & Planning
  CALENDAR: '📅',
  CLOCK: '🕐',
  TIMER: '⏱️',
  SCHEDULE: '📆',
  
  // Technical & Tools
  TOOL: '🔧',
  GEAR: '⚙️',
  WRENCH: '🔩',
  HAMMER: '🔨',
  ELECTRIC: '⚡',
  
  // Documents & Files
  DOCUMENT: '📄',
  FILE: '📁',
  CONTRACT: '📝',
  REPORT: '📊',
  
  // Communication
  PHONE: '📞',
  EMAIL: '✉️',
  MESSAGE: '💬',
  NOTIFICATION: '🔔',
  
  // Status & Actions
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  STAR: '⭐',
  
  // Quality & Safety
  SHIELD: '🛡️',
  QUALITY: '✔',
  SAFETY: '⚠️',
  CERTIFIED: '🏅',
  
  // Financial
  MONEY: '💰',
  COIN: '🪙',
  CREDIT_CARD: '💳',
  CHART: '📈',
  
  // Media
  PHOTO: '📷',
  CAMERA: '📸',
  VIDEO: '🎥',
  GALLERY: '🖼️',
  
  // Mobile & Tech
  PHONE_MOBILE: '📱',
  TABLET: '📲',
  LAPTOP: '💻',
  QR_CODE: '📲',
  
  // Transport & Logistics
  TRUCK: '🚚',
  DELIVERY: '📦',
  SHIPPING: '🚢',
  CAR: '🚗',
  
  // Nature & Environment
  TREE: '🌳',
  LEAF: '🍃',
  SUN: '☀️',
  RECYCLE: '♻️',
  
  // Numbers & Lists
  ONE: '①',
  TWO: '②',
  THREE: '③',
  FOUR: '④',
  FIVE: '⑤',
  SIX: '⑥',
  SEVEN: '⑦',
  EIGHT: '⑧',
  NINE: '⑨',
  TEN: '⑩',
  
  // Bullets
  BULLET: '•',
  ARROW_RIGHT: '▸',
  ARROW_LEFT: '◂',
  DIAMOND: '◆',
  SQUARE: '■',
};

// Icon utilities
export const getIcon = (key: keyof typeof ICONS): string => {
  return ICONS[key];
};

export const withIcon = (icon: string, text: string, spacing = ' '): string => {
  return `${icon}${spacing}${text}`;
};
