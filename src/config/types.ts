/**
 * Configuration types for cc-hud
 */

export type SeparatorStyle = 'angled' | 'thin' | 'rounded' | 'flame' | 'slant' | 'backslant';

export type ColorMode = 'background' | 'text';

export interface SegmentColors {
  fg: string;
  bg: string;
}

export interface ThemeConfig {
  powerline: boolean;
  separatorStyle: SeparatorStyle;
  colorMode: ColorMode;  // 'background' = filled bg (default), 'text' = colored text only
}

// Usage segment
export interface UsageSegmentDisplay {
  icon: boolean;
  cost: boolean;
  tokens: boolean;
  period: 'today';  // Only 'today' in MVP
}

export interface UsageSegmentConfig {
  type: 'usage';
  display: UsageSegmentDisplay;
  colors: SegmentColors;
}

// Pace segment
export interface PaceSegmentDisplay {
  icon: boolean;
  period: 'hourly';  // Only 'hourly' in MVP
  halfLifeMinutes: number;  // EWMA half-life in minutes (default: 5)
}

export interface PaceSegmentConfig {
  type: 'pace';
  display: PaceSegmentDisplay;
  colors: SegmentColors;
}

// Directory segment
export type PathDisplayMode = 'name' | 'full' | 'project' | 'parent';

export interface DirectorySegmentDisplay {
  icon: boolean;
  pathMode: PathDisplayMode;  // 'name' = dir name only, 'full' = ~/path, 'project' = project/path, 'parent' = parent-dir/project/path
  rootWarning: boolean;  // Show warning when not in git project root
}

export interface DirectorySegmentConfig {
  type: 'directory';
  display: DirectorySegmentDisplay;
  colors: SegmentColors;
}

// Git segment
export interface GitSegmentDisplay {
  icon: boolean;
  branch: boolean;
  status: boolean;
  ahead: boolean;
  behind: boolean;
}

export interface GitSegmentConfig {
  type: 'git';
  display: GitSegmentDisplay;
  colors: SegmentColors;
}

// Thoughts segment
export interface ThoughtsSegmentDisplay {
  icon: boolean;
  quotes: boolean;  // Show quote marks around thoughts
}

export interface ThoughtsSegmentConfig {
  type: 'thoughts';
  display: ThoughtsSegmentDisplay;
  colors: SegmentColors;
  customThoughts?: string[];  // Optional custom thought pool
  useApiQuotes?: boolean;  // Enable zenquotes.io API for inspirational quotes (default: false)
}

// PR segment
export interface PrSegmentDisplay {
  icon: boolean;    // Show PR icon
  number: boolean;  // Show PR number
}

export interface PrSegmentConfig {
  type: 'pr';
  display: PrSegmentDisplay;
  colors: SegmentColors;
}

// Time segment
export type TimeFormat = '12h' | '24h';

export interface TimeSegmentDisplay {
  icon: boolean;
  format: TimeFormat;
  seconds: boolean;  // Show seconds
}

export interface TimeSegmentConfig {
  type: 'time';
  display: TimeSegmentDisplay;
  colors: SegmentColors;
}

// Union type for all segment configs
export type SegmentConfig =
  | UsageSegmentConfig
  | PaceSegmentConfig
  | DirectorySegmentConfig
  | GitSegmentConfig
  | ThoughtsSegmentConfig
  | PrSegmentConfig
  | TimeSegmentConfig;

// Main config
export interface Config {
  segments: SegmentConfig[];
  theme: ThemeConfig;
}

// Input from Claude Code (via stdin)
export interface ClaudeCodeInput {
  cwd?: string;
  git?: {
    branch?: string;
    isDirty?: boolean;
    ahead?: number;
    behind?: number;
  };
  session?: {
    id?: string;
    model?: string;
  };
}
