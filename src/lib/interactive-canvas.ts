export type CanvasThemeName = 'light' | 'dark';

export interface InteractiveCanvasEnvironment {
  readonly isMobile: boolean;
  readonly isReducedMotion: boolean;
  readonly supportsWebGL: boolean;
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
}

export interface CanvasTheme {
  readonly clear: string;
  readonly line: string;
  readonly point: string;
}

const LOW_END_HARDWARE_CONCURRENCY = 4;
const LOW_END_DEVICE_MEMORY_GB = 4;

export function shouldEnableInteractiveCanvas(environment: InteractiveCanvasEnvironment): boolean {
  if (
    environment.isMobile ||
    environment.isReducedMotion ||
    !environment.supportsWebGL ||
    (environment.hardwareConcurrency !== undefined &&
      environment.hardwareConcurrency <= LOW_END_HARDWARE_CONCURRENCY) ||
    (environment.deviceMemory !== undefined && environment.deviceMemory <= LOW_END_DEVICE_MEMORY_GB)
  ) {
    return false;
  }

  return true;
}

export function getCanvasTheme(theme: CanvasThemeName): CanvasTheme {
  if (theme === 'dark') {
    return { clear: '#0d111a', line: '#334155', point: '#93c5fd' };
  }

  return { clear: '#fcfcfd', line: '#bfdbfe', point: '#1d4ed8' };
}
