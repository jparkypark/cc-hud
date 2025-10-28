/**
 * Configuration types for cc-hud
 */

export type SeparatorStyle = 'angled' | 'thin' | 'rounded' | 'flame' | 'slant' | 'backslant';

export interface SegmentColors {
  fg: string;
  bg: string;
}

export interface ThemeConfig {
  powerline: boolean;
  separatorStyle: SeparatorStyle;
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

// Directory segment
export type PathDisplayMode = 'name' | 'full' | 'project';

export interface DirectorySegmentDisplay {
  icon: boolean;
  pathMode: PathDisplayMode;  // 'name' = dir name only, 'full' = ~/path, 'project' = project/path
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

// Union type for all segment configs
export type SegmentConfig =
  | UsageSegmentConfig
  | DirectorySegmentConfig
  | GitSegmentConfig;

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
