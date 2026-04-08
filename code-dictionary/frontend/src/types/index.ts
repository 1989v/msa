export const CATEGORIES = [
  'BASICS',
  'DATA_STRUCTURE',
  'ALGORITHM',
  'DESIGN_PATTERN',
  'CONCURRENCY',
  'DISTRIBUTED_SYSTEM',
  'ARCHITECTURE',
  'INFRASTRUCTURE',
  'DATA',
  'SECURITY',
  'NETWORK',
  'TESTING',
  'LANGUAGE_FEATURE',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

export type Level = (typeof LEVELS)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  BASICS: 'Basics',
  DATA_STRUCTURE: 'Data Structure',
  ALGORITHM: 'Algorithm',
  DESIGN_PATTERN: 'Design Pattern',
  CONCURRENCY: 'Concurrency',
  DISTRIBUTED_SYSTEM: 'Distributed System',
  ARCHITECTURE: 'Architecture',
  INFRASTRUCTURE: 'Infrastructure',
  DATA: 'Data',
  SECURITY: 'Security',
  NETWORK: 'Network',
  TESTING: 'Testing',
  LANGUAGE_FEATURE: 'Language Feature',
};

export const LEVEL_LABELS: Record<Level, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  BASICS: '#4ecdc4',
  DATA_STRUCTURE: '#45b7d1',
  ALGORITHM: '#96ceb4',
  DESIGN_PATTERN: '#6c63ff',
  CONCURRENCY: '#ff6b6b',
  DISTRIBUTED_SYSTEM: '#ffd93d',
  ARCHITECTURE: '#a29bfe',
  INFRASTRUCTURE: '#fd79a8',
  DATA: '#00b894',
  SECURITY: '#e17055',
  NETWORK: '#0984e3',
  TESTING: '#00cec9',
  LANGUAGE_FEATURE: '#fdcb6e',
};
