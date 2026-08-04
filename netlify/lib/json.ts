/**
 * Recovers the analysis object from a model response.
 *
 * Structured output should hand back bare JSON, but a stray sentence or a code
 * fence around it must not cost a completed research run — that work is slow
 * and paid for, so it is worth salvaging.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return parseEnclosedObject(trimmed);
  }
}

/**
 * Pulls out the first complete top-level `{...}` object, tracking string
 * literals so that a brace inside Slovak prose cannot end the object early.
 */
function parseEnclosedObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
