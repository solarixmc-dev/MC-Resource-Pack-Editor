import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Pack } from '../types';
import { arrayBufferToDataURL } from '../lib/zipUtils';

interface Item3DPreviewProps {
  item: { name: string; filenames: string[] };
  packs: Pack[];
  onClose: () => void;
  darkMode: boolean;
}

// Block items that should render as cubes
const BLOCK_ITEMS = [
  "Blue Wool", "Red Wool", "Oak Planks", "End Stone", "TNT"
];

export default function Item3DPreview({ item, packs, onClose, darkMode }: Item3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });
  const meshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(darkMode ? 0x1a1a1a : 0x87CEEB);

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 1.5;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create 3D item
    create3DItem(scene, item, packs);

    // Store references
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      if (scene && camera && renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (renderer) {
        renderer.dispose();
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
      if (scene) {
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
      meshRef.current = null;
    };
  }, [item, packs, darkMode]);

  const create3DItem = (scene: THREE.Scene, item: { name: string; filenames: string[] }, packs: Pack[]) => {
    // Find texture for the item
    let textureUrl: string | null = null;
    for (const pack of packs) {
      for (const [path, buffer] of pack.files.entries()) {
        const parts = path.split('/');
        const actualFilename = parts[parts.length - 1];
        if (item.filenames.includes(actualFilename)) {
          textureUrl = arrayBufferToDataURL(buffer, path);
          break;
        }
      }
      if (textureUrl) break;
    }

    const isBlock = BLOCK_ITEMS.includes(item.name);
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    if (textureUrl) {
      const texture = new THREE.TextureLoader().load(textureUrl);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });
    } else {
      material = new THREE.MeshBasicMaterial({ 
        color: 0x888888,
        transparent: true,
        side: THREE.DoubleSide
      });
    }

    if (isBlock) {
      // Render blocks as cubes
      geometry = new THREE.BoxGeometry(1, 1, 1);
    } else {
      // Render non-block items as flat planes (2D sprites)
      geometry = new THREE.PlaneGeometry(1, 1);
    }

    const mesh = new THREE.Mesh(geometry, material);
    
    // For non-block items, make them face the camera initially
    if (!isBlock) {
      mesh.rotation.y = Math.PI; // Face the camera
    }
    
    scene.add(mesh);

    // Store reference for rotation
    rotationRef.current = { x: 0, y: 0 };
    mesh.rotation.x = rotationRef.current.x;
    mesh.rotation.y = rotationRef.current.y;
    
    // Store mesh reference for rotation updates
    meshRef.current = mesh;
  };

  // Mouse event handlers for rotation
  const handleMouseDown = (event: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: event.clientX, y: event.clientY };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = event.clientX - previousMousePosition.current.x;
    const deltaY = event.clientY - previousMousePosition.current.y;

    rotationRef.current.y += deltaX * 0.01;
    rotationRef.current.x += deltaY * 0.01;

    if (meshRef.current) {
      meshRef.current.rotation.y = rotationRef.current.y;
      meshRef.current.rotation.x = rotationRef.current.x;
    }

    previousMousePosition.current = { x: event.clientX, y: event.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-200"} border`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? "border-dark-border" : "border-gray-200"}`}>
          <h2 className={`text-xl font-semibold ${darkMode ? "text-dark-text" : "text-gray-900"}`}>
            3D Preview: {item.name}
          </h2>
          <button
            onClick={onClose}
            className={`text-lg leading-none ${darkMode ? "text-dark-text-secondary hover:text-dark-text" : "text-slate-400 hover:text-slate-700"}`}
          >
            ✕
          </button>
        </div>

        {/* 3D Canvas */}
        <div 
          ref={containerRef}
          className="w-full h-[400px] cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? "border-dark-border" : "border-gray-200"}`}>
          <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>
            Click and drag to rotate the item
          </p>
        </div>
      </div>
    </div>
  );
}
