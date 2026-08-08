import { useEffect, useRef } from 'react';
import {
  getCanvasTheme,
  shouldEnableInteractiveCanvas,
  type CanvasThemeName,
} from '@/lib/interactive-canvas';

const PARTICLE_COUNT = 26;
const MAX_PIXEL_RATIO = 1.5;

type CanvasController = {
  resize: () => void;
  render: () => void;
  dispose: () => void;
  setTheme: (theme: CanvasThemeName) => void;
  setPointer: (x: number, y: number) => void;
};

type ThreeModule = typeof import('three');

function getThemeName(): CanvasThemeName {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function supportsWebGL(): boolean {
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
}

function createCanvasController(THREE: ThreeModule, host: HTMLDivElement): CanvasController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const group = new THREE.Group();
  const points = new Float32Array(PARTICLE_COUNT * 3);
  const connections: number[] = [];
  const pointMaterial = new THREE.PointsMaterial({ size: 0.042, transparent: true, opacity: 0.82 });
  const lineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.28 });
  const pointGeometry = new THREE.BufferGeometry();

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    const angle = index * 2.399963229728653;
    const radius = 0.45 + (index % 7) * 0.17;
    points[offset] = Math.cos(angle) * radius;
    points[offset + 1] = Math.sin(angle) * radius;
    points[offset + 2] = ((index % 5) - 2) * 0.09;

    if (index > 0) {
      const previous = (index - 1) * 3;
      connections.push(
        points[previous],
        points[previous + 1],
        points[previous + 2],
        points[offset],
        points[offset + 1],
        points[offset + 2],
      );
    }
  }

  pointGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(connections, 3));
  group.add(
    new THREE.Points(pointGeometry, pointMaterial),
    new THREE.LineSegments(lineGeometry, lineMaterial),
  );
  scene.add(group);
  camera.position.z = 5.2;

  renderer.domElement.className = 'interactive-canvas__surface';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.replaceChildren(renderer.domElement);

  let pointerX = 0;
  let pointerY = 0;

  return {
    resize() {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
    },
    render() {
      group.rotation.y += (pointerX * 0.12 - group.rotation.y) * 0.015;
      group.rotation.x += (-pointerY * 0.08 - group.rotation.x) * 0.015;
      group.rotation.z += 0.0008;
      renderer.render(scene, camera);
    },
    dispose() {
      pointGeometry.dispose();
      lineGeometry.dispose();
      pointMaterial.dispose();
      lineMaterial.dispose();
      renderer.dispose();
      host.replaceChildren();
    },
    setTheme(themeName) {
      const theme = getCanvasTheme(themeName);
      renderer.setClearColor(theme.clear, 0);
      pointMaterial.color.set(theme.point);
      lineMaterial.color.set(theme.line);
    },
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
  };
}

/** 홈 소개에 얹는 순수 장식용 WebGL 레이어. 콘텐츠·탐색·포커스에는 관여하지 않는다. */
export default function InteractiveCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const environment = {
      isMobile: window.matchMedia('(max-width: 767px)').matches,
      isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      supportsWebGL: supportsWebGL(),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigatorWithMemory.deviceMemory,
    };

    if (!shouldEnableInteractiveCanvas(environment)) return;

    let active = true;
    let animationFrame = 0;
    let controller: CanvasController | undefined;

    const render = () => {
      controller?.render();
      animationFrame = window.requestAnimationFrame(render);
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      controller?.setPointer(
        (event.clientX - rect.left) / rect.width - 0.5,
        (event.clientY - rect.top) / rect.height - 0.5,
      );
    };
    const resizeObserver = new ResizeObserver(() => controller?.resize());
    resizeObserver.observe(host);

    void import('three')
      .then((THREE) => {
        if (!active) return;

        controller = createCanvasController(THREE, host);
        controller.setTheme(getThemeName());
        controller.resize();

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        render();
      })
      .catch(() => {
        host.replaceChildren();
      });

    const themeObserver = new MutationObserver(() => controller?.setTheme(getThemeName()));
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', onPointerMove);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      controller?.dispose();
    };
  }, []);

  return <div ref={hostRef} className="interactive-canvas" aria-hidden="true" />;
}
