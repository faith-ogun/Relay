import { useEffect, useRef } from 'react';
import type React from 'react';
import type { SkillNode } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Knowledge-graph node dragging: pointer capture + rAF-batched position
 * updates. Owns the drag refs and the graph container ref. The persisted
 * skillNodes array stays in the parent; this hook only mutates it via
 * setSkillNodes during a drag.
 */
export function useSkillGraph(
  skillNodes: SkillNode[],
  setSkillNodes: React.Dispatch<React.SetStateAction<SkillNode[]>>,
) {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);

  const beginNodeDrag = (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => {
    const root = graphRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const node = skillNodes.find((item) => item.id === nodeId);
    if (!node) return;
    const nodeX = rect.left + (node.x / 100) * rect.width;
    const nodeY = rect.top + (node.y / 100) * rect.height;
    dragRef.current = { id: nodeId, offsetX: event.clientX - nodeX, offsetY: event.clientY - nodeY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    const flushDrag = () => {
      dragFrameRef.current = null;
      const drag = dragRef.current;
      const root = graphRef.current;
      const pending = pendingPointerRef.current;
      if (!drag || !root || !pending) return;
      const rect = root.getBoundingClientRect();
      const x = ((pending.x - rect.left - drag.offsetX) / rect.width) * 100;
      const y = ((pending.y - rect.top - drag.offsetY) / rect.height) * 100;
      setSkillNodes((prev) =>
        prev.map((node) => (node.id === drag.id ? { ...node, x: clamp(x, 8, 92), y: clamp(y, 12, 88) } : node))
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const root = graphRef.current;
      if (!drag || !root) return;
      pendingPointerRef.current = { x: event.clientX, y: event.clientY };
      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(flushDrag);
      }
    };
    const onPointerUp = () => {
      dragRef.current = null;
      pendingPointerRef.current = null;
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, [setSkillNodes]);

  return { graphRef, beginNodeDrag };
}
