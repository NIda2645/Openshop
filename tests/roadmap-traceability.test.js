import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testsDir, '..');
const auditDir = join(repoDir, 'windows-app-audit');

function parseCsv(text) {
  return text.trimEnd().split(/\r?\n/).map((line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else {
        cell += character;
      }
    }
    cells.push(cell);
    return cells;
  });
}

function readCsv(relativePath) {
  const rows = parseCsv(readFileSync(join(repoDir, relativePath), 'utf8'));
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function readTraceability() {
  return readCsv('windows-app-audit/traceability/roadmap-traceability.csv');
}

describe('PS-001 audit traceability', () => {
  it('records the traceability contract and its acceptance status', () => {
    const rows = readTraceability();
    const entry = rows.find((row) => row.record_type === 'roadmap-entry' && row.record_id === 'PS-001');

    expect(entry).toMatchObject({
      roadmap_entry: 'PS-001',
      priority: 'P0',
      status: 'VERIFIED'
    });
    expect(entry.audit_artifact).toContain('windows-app-audit/screens/screen-catalog.csv');
    expect(entry.audit_artifact).toContain('windows-app-audit/tools/tool-catalog.csv');
    expect(entry.audit_artifact).toContain('windows-app-audit/testing/state-coverage-matrix.csv');
  });

  it('links every observed screen to a screen specification and screenshot', () => {
    const traceRows = readTraceability();
    const screens = readCsv('windows-app-audit/screens/screen-catalog.csv');
    const screenSet = traceRows.find((row) => row.record_type === 'screen-catalog');

    expect(screenSet?.roadmap_entry).toBe('PS-001');
    expect(screens).toHaveLength(32);
    for (const screen of screens) {
      const specPath = join(auditDir, 'screens', 'screen-specs', `${screen.screen_id}.json`);
      const evidencePath = join(auditDir, screen.evidence);
      expect(existsSync(specPath), `${screen.screen_id} spec`).toBe(true);
      expect(existsSync(evidencePath), `${screen.screen_id} evidence`).toBe(true);
    }
  });

  it('keeps the complete visible tool inventory tied to its family and catalog row', () => {
    const traceRows = readTraceability();
    const toolSet = traceRows.find((row) => row.record_type === 'tool-catalog');
    const tools = readCsv('windows-app-audit/tools/tool-catalog.csv');
    const catalogIds = new Set(tools.map((tool) => tool.tool_id));
    const families = new Set(tools.map((tool) => tool.family));

    expect(toolSet?.roadmap_entry).toBe('PS-001');
    expect(tools).toHaveLength(60);
    expect(catalogIds.size).toBe(60);
    expect(families.size).toBeGreaterThanOrEqual(16);
    expect(tools.every((tool) => tool.family && tool.name && tool.evidence)).toBe(true);
  });

  it('preserves explicit labels for behavior the blank audit did not test', () => {
    const traceRows = readTraceability();
    const behaviorSet = traceRows.find((row) => row.record_type === 'behavior-catalog');
    const stateCoverage = readCsv('windows-app-audit/testing/state-coverage-matrix.csv');
    const outputCatalog = readCsv('windows-app-audit/tools/tool-output-catalog.csv');
    const validationRules = readCsv('windows-app-audit/behavior/validation-rules.csv');
    const untestedLabels = /^(UNTESTED|UNTESTED_[A-Z_]+|BLOCKED_BY_PREREQUISITE|UNTESTED_OR_BLOCKED_BY_PREREQUISITE)$/;

    expect(behaviorSet?.observation_status).toBe('UNTESTED_OR_BLOCKED_BY_PREREQUISITE');
    expect(stateCoverage.filter((row) => row.observed === 'no').every((row) => untestedLabels.test(row.status))).toBe(true);
    expect(outputCatalog.filter((row) => row.status !== 'VISUALLY_INSPECTED').every((row) => untestedLabels.test(row.status))).toBe(true);
    expect(validationRules.filter((row) => row.status !== 'CONFIRMED').every((row) => untestedLabels.test(row.status) || row.status === 'STRONG_INFERENCE')).toBe(true);
  });
});
