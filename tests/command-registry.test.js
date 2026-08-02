import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOpenShop, mountEditorDom } from './os-harness.js';

describe('OpenShop typed command and tool registry', () => {
  beforeEach(() => {
    localStorage.clear();
    mountEditorDom();
  });

  it('represents all audited tools and mode controls with stable IDs', () => {
    const OS = loadOpenShop();
    const tools = OS.listRegisteredTools({ documentOpen: true });
    const registry = OS._getCommandRegistry();

    expect(tools).toHaveLength(60);
    expect(new Set(tools.map(tool => tool.id)).size).toBe(60);
    expect(tools.filter(tool => tool.id.startsWith('mode.'))).toHaveLength(2);
    expect(registry.has('tool.marquee.rect')).toBe(true);
    expect(registry.has('mode.quick-mask')).toBe(true);
    expect(registry.has('mode.screen')).toBe(true);
    expect(tools.every(tool => tool.kind === 'tool' && tool.auditStatus === 'VISUALLY_INSPECTED')).toBe(true);
    expect(tools.every(tool => tool.optionsContext && tool.sideEffect && tool.undoPolicy)).toBe(true);
  });

  it('reports blank-state enablement without changing the command IDs', () => {
    const OS = loadOpenShop();
    OS.session.application.ready = true;
    OS._blankWorkspace = true;
    OS._documentId = null;

    expect(OS.getCommandState('tool.marquee.rect')).toMatchObject({
      id: 'tool.marquee.rect',
      enabled: false,
      blocked: true,
      selected: false
    });
    expect(OS.getCommandState('mode.quick-mask')).toMatchObject({ enabled: false, blocked: true });
    expect(OS.getCommandState('mode.screen')).toMatchObject({ enabled: true, blocked: false });
    expect(OS.getCommandState('layer.add')).toMatchObject({ enabled: false, blocked: true });
  });

  it('cycles grouped tools through one selection path', () => {
    const OS = loadOpenShop();
    OS.state.tool = 'marquee-rect';
    OS.setTool = vi.fn(tool => { OS.state.tool = tool; });

    const next = OS.cycleToolGroup('Marquee');
    const previous = OS.cycleToolGroup('Marquee', { reverse: true });

    expect(next).toBe('tool.marquee.ellipse');
    expect(previous).toBe('tool.marquee.rect');
    expect(OS.setTool).toHaveBeenCalledWith('marquee-ellipse');
    expect(OS.setTool).toHaveBeenCalledWith('marquee-rect');
  });

  it('localizes labels while preserving command identity', () => {
    const OS = loadOpenShop();
    const english = OS.getCommandState('tool.type.horizontal', { documentOpen: true });
    OS._lang = 'pseudo';
    const pseudo = OS.getCommandState('tool.type.horizontal', { documentOpen: true });

    expect(english.id).toBe(pseudo.id);
    expect(pseudo.label).not.toBe(english.label);
    expect(pseudo.shortcut).toBe('T');
  });
});
