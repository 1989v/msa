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
