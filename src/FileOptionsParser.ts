import * as Configuration from './Configuration';

const SUPPORTED_PER_FILE_OPTS = new Set<string>([
  'main',
  'out',
  'outExt',
  'sourceDir',
  'outputDir',
  'sourceMap',
  'sourceMapFileInline',
  'compress',
  'relativeUrls',
  'ieCompat',
  'autoprefixer',
  'javascriptEnabled',
  'math',
]);

const MULTI_OPTS = new Set<string>(['main']);

type NonStringPrimitive = true | false | undefined | null | number;
type Primitive = string | NonStringPrimitive;

export function parse(line: string, defaults: Configuration.EasyLessOptions): Configuration.EasyLessOptions {
  // Does line start with "//"?
  const commentMatch: RegExpExecArray | null = /^\s*\/\/\s*(.+)/.exec(line);
  if (!commentMatch) {
    return defaults;
  }

  const options: { [key: string]: unknown } = { ...defaults };
  const seenKeys = new Set<string>();
  for (const item of commentMatch[1].split(',')) {
    const [key, rawValue] = splitOption(item);

    // Guard.
    if (!SUPPORTED_PER_FILE_OPTS.has(key)) continue;
    if (rawValue === undefined || rawValue === '') continue;

    // Interpret value.
    const value = parsePrimitive(rawValue);

    if (seenKeys.has(key) && MULTI_OPTS.has(key)) {
      // Handle multiple values for same key.
      const existingValue = options[key];
      if (Array.isArray(existingValue)) {
        existingValue.push(value);
      } else {
        options[key] = [existingValue, value];
      }
    } else {
      // Single value, or key doesn't allow an array.
      options[key] = value;
      seenKeys.add(key);
    }
  }

  return options as Configuration.EasyLessOptions;
}

function splitOption(item: string): [string, string] {
  const parts = item.split(':', 2);
  const key = parts[0]?.trim();
  const value = parts[1]?.trim();
  return [key, value];
}

function parsePrimitive(rawValue: string): Primitive {
  if (rawValue.match(/^[0-9]+$/)) {
    return Number(rawValue);
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  if (rawValue === 'null') {
    return null;
  }

  if (rawValue === 'undefined') {
    return undefined;
  }

  if (isEnclosedInQuotes(rawValue)) {
    return unquoteString(rawValue);
  }

  return rawValue;
}

function unquoteString(rawValue: string): string {
  const quoteCharacter = rawValue[0];
  const innerValue = rawValue.slice(1, -1);

  return innerValue.replace(/\\(.)/g, (_match, escapedCharacter) => {
    if (escapedCharacter === quoteCharacter || escapedCharacter === '\\') {
      return escapedCharacter;
    }

    return escapedCharacter;
  });
}

const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';

function isEnclosedInQuotes(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 1 &&
    ((value.startsWith(DOUBLE_QUOTE) && value.endsWith(DOUBLE_QUOTE)) ||
      (value.startsWith(SINGLE_QUOTE) && value.endsWith(SINGLE_QUOTE)))
  );
}
