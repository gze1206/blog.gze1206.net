import { describe, expect, it } from 'vitest';
import * as interactiveCanvas from './interactive-canvas';

describe('shouldEnableInteractiveCanvas', () => {
  const desktop = {
    isMobile: false,
    isReducedMotion: false,
    supportsWebGL: true,
    hardwareConcurrency: 8,
    deviceMemory: 8,
  };

  it('지원되는 데스크톱에서만 캔버스를 허용한다', () => {
    expect('shouldEnableInteractiveCanvas' in interactiveCanvas).toBe(true);
    if (!('shouldEnableInteractiveCanvas' in interactiveCanvas)) return;

    expect(interactiveCanvas.shouldEnableInteractiveCanvas(desktop)).toBe(true);
  });

  it.each([
    ['움직임 감소 설정', { ...desktop, isReducedMotion: true }],
    ['모바일 화면', { ...desktop, isMobile: true }],
    ['WebGL 미지원', { ...desktop, supportsWebGL: false }],
    ['낮은 CPU 코어 수', { ...desktop, hardwareConcurrency: 4 }],
    ['낮은 기기 메모리', { ...desktop, deviceMemory: 4 }],
  ])('%s에서는 정적 폴백을 사용한다', (_name, environment) => {
    expect('shouldEnableInteractiveCanvas' in interactiveCanvas).toBe(true);
    if (!('shouldEnableInteractiveCanvas' in interactiveCanvas)) return;

    expect(interactiveCanvas.shouldEnableInteractiveCanvas(environment)).toBe(false);
  });
});

describe('getCanvasTheme', () => {
  it('문서 테마에 맞는 명암을 반환한다', () => {
    expect('getCanvasTheme' in interactiveCanvas).toBe(true);
    if (!('getCanvasTheme' in interactiveCanvas)) return;

    expect(interactiveCanvas.getCanvasTheme('light')).toEqual({
      clear: '#fcfcfd',
      line: '#bfdbfe',
      point: '#1d4ed8',
    });
    expect(interactiveCanvas.getCanvasTheme('dark')).toEqual({
      clear: '#0d111a',
      line: '#334155',
      point: '#93c5fd',
    });
  });
});
