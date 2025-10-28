/**
 * Configuration validation
 */

import type { Config, SeparatorStyle } from './types';

const VALID_SEPARATOR_STYLES: SeparatorStyle[] = [
  'angled',
  'thin',
  'rounded',
  'flame',
  'slant',
  'backslant',
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

function validateSegmentColors(colors: any, segmentType: string): void {
  if (!colors) {
    throw new Error(`Segment '${segmentType}' must have colors`);
  }

  if (!colors.fg || !colors.bg) {
    throw new Error(
      `Segment '${segmentType}' must have both fg and bg colors`
    );
  }

  if (!isValidHexColor(colors.fg)) {
    throw new Error(
      `Segment '${segmentType}' has invalid fg color: ${colors.fg}. Must be #RRGGBB format.`
    );
  }

  if (!isValidHexColor(colors.bg)) {
    throw new Error(
      `Segment '${segmentType}' has invalid bg color: ${colors.bg}. Must be #RRGGBB format.`
    );
  }
}

function validateUsageSegment(segment: any): void {
  if (!segment.display) {
    throw new Error("Usage segment must have 'display' config");
  }

  const { display } = segment;

  if (typeof display.icon !== 'boolean') {
    throw new Error("Usage segment display.icon must be boolean");
  }

  if (typeof display.cost !== 'boolean') {
    throw new Error("Usage segment display.cost must be boolean");
  }

  if (typeof display.tokens !== 'boolean') {
    throw new Error("Usage segment display.tokens must be boolean");
  }

  if (display.period !== 'today') {
    throw new Error(
      "Usage segment display.period must be 'today' (only value supported in MVP)"
    );
  }

  validateSegmentColors(segment.colors, 'usage');
}

function validateDirectorySegment(segment: any): void {
  if (!segment.display) {
    throw new Error("Directory segment must have 'display' config");
  }

  const { display } = segment;

  if (typeof display.icon !== 'boolean') {
    throw new Error("Directory segment display.icon must be boolean");
  }

  if (!display.pathMode) {
    throw new Error("Directory segment display.pathMode is required");
  }

  if (!['name', 'full', 'project'].includes(display.pathMode)) {
    throw new Error(
      `Directory segment display.pathMode must be 'name', 'full', or 'project'. Got: ${display.pathMode}`
    );
  }

  validateSegmentColors(segment.colors, 'directory');
}

function validateGitSegment(segment: any): void {
  if (!segment.display) {
    throw new Error("Git segment must have 'display' config");
  }

  const { display } = segment;

  if (typeof display.icon !== 'boolean') {
    throw new Error("Git segment display.icon must be boolean");
  }

  if (typeof display.branch !== 'boolean') {
    throw new Error("Git segment display.branch must be boolean");
  }

  if (typeof display.status !== 'boolean') {
    throw new Error("Git segment display.status must be boolean");
  }

  if (typeof display.ahead !== 'boolean') {
    throw new Error("Git segment display.ahead must be boolean");
  }

  if (typeof display.behind !== 'boolean') {
    throw new Error("Git segment display.behind must be boolean");
  }

  validateSegmentColors(segment.colors, 'git');
}

function validateThoughtsSegment(segment: any): void {
  if (!segment.display) {
    throw new Error("Thoughts segment must have 'display' config");
  }

  const { display } = segment;

  if (typeof display.icon !== 'boolean') {
    throw new Error("Thoughts segment display.icon must be boolean");
  }

  if (typeof display.quotes !== 'boolean') {
    throw new Error("Thoughts segment display.quotes must be boolean");
  }

  // Optional fields validation
  if (segment.customThoughts !== undefined) {
    if (!Array.isArray(segment.customThoughts)) {
      throw new Error("Thoughts segment customThoughts must be an array");
    }

    if (segment.customThoughts.length === 0) {
      throw new Error("Thoughts segment customThoughts must not be empty");
    }

    if (!segment.customThoughts.every((t: any) => typeof t === 'string')) {
      throw new Error("Thoughts segment customThoughts must be an array of strings");
    }
  }

  if (segment.useApiQuotes !== undefined && typeof segment.useApiQuotes !== 'boolean') {
    throw new Error("Thoughts segment useApiQuotes must be boolean");
  }

  validateSegmentColors(segment.colors, 'thoughts');
}

export function validateConfig(config: any): asserts config is Config {
  if (!config) {
    throw new Error('Config cannot be null or undefined');
  }

  // Validate segments array
  if (!config.segments || !Array.isArray(config.segments)) {
    throw new Error('Config must have a segments array');
  }

  if (config.segments.length === 0) {
    throw new Error('Config must have at least one segment');
  }

  // Validate each segment
  for (let i = 0; i < config.segments.length; i++) {
    const segment = config.segments[i];

    if (!segment.type) {
      throw new Error(`Segment at index ${i} must have a type`);
    }

    switch (segment.type) {
      case 'usage':
        validateUsageSegment(segment);
        break;
      case 'directory':
        validateDirectorySegment(segment);
        break;
      case 'git':
        validateGitSegment(segment);
        break;
      case 'thoughts':
        validateThoughtsSegment(segment);
        break;
      default:
        throw new Error(
          `Unknown segment type '${segment.type}' at index ${i}. Valid types: usage, directory, git, thoughts`
        );
    }
  }

  // Validate theme
  if (!config.theme) {
    throw new Error('Config must have a theme');
  }

  if (typeof config.theme.powerline !== 'boolean') {
    throw new Error('theme.powerline must be boolean');
  }

  if (!config.theme.separatorStyle) {
    throw new Error('theme.separatorStyle is required');
  }

  if (!VALID_SEPARATOR_STYLES.includes(config.theme.separatorStyle)) {
    throw new Error(
      `Invalid theme.separatorStyle: ${config.theme.separatorStyle}. Valid options: ${VALID_SEPARATOR_STYLES.join(', ')}`
    );
  }
}
