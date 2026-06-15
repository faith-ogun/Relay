import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { assessDrawing } from '../../../services/quizEngineClient';
import type { SkillNode, XpEvent } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DRAW_EXERCISES = [
  { type: 'draw_circuit' as const, title: 'Draw a voltage divider', expected: ['resistor', 'resistor', 'power_source', 'ground'], hint: 'Two resistors in series between 5V and GND, with the output taken from the middle node.' },
  { type: 'draw_circuit' as const, title: 'Draw an LED circuit', expected: ['led', 'resistor', 'power_source', 'ground'], hint: 'An LED in series with a current-limiting resistor, connected to a power source.' },
  { type: 'circle_component' as const, title: 'Circle the LDR in this circuit', expected: ['ldr'], hint: 'The LDR (light-dependent resistor) looks like a resistor with arrows pointing at it.' },
  { type: 'draw_circuit' as const, title: 'Draw the Light-Activated Alarm circuit', expected: ['ldr', 'resistor', 'led', 'arduino', 'buzzer'], hint: 'Voltage divider (LDR + 10k resistor) feeding Arduino A0. LED/buzzer on a digital pin.' },
];

type DrawFeedback = { correct: boolean; feedback: string; components: string[]; confidence: number };

type UseDrawExerciseArgs = {
  dark: boolean;
  quizApiRoot: string;
  pushXpEvent: (type: XpEvent['type'], xpValue: number, detail?: string) => void;
  setSkillNodes: React.Dispatch<React.SetStateAction<SkillNode[]>>;
};

/**
 * Free-draw circuit exercise: canvas drawing mechanics + Gemini drawing
 * assessment. Owns all draw-specific state. Emits XP and mastery updates
 * through injected callbacks so the parent keeps owning persisted state.
 */
export function useDrawExercise({ dark, quizApiRoot, pushXpEvent, setSkillNodes }: UseDrawExerciseArgs) {
  const [currentDrawExercise, setCurrentDrawExercise] = useState(0);
  const [drawExerciseActive, setDrawExerciseActive] = useState(false);
  const [drawExerciseLoading, setDrawExerciseLoading] = useState(false);
  const [drawExerciseFeedback, setDrawExerciseFeedback] = useState<DrawFeedback | null>(null);
  const [drawPenColor, setDrawPenColor] = useState('#000000');
  const [drawIsEraser, setDrawIsEraser] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const initDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = dark ? '#1a1a2e' : '#ffffff';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    // Grid dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    for (let x = 20; x < canvas.offsetWidth; x += 20) {
      for (let y = 20; y < canvas.offsetHeight; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [dark]);

  const startDrawExercise = () => {
    setDrawExerciseActive(true);
    setDrawExerciseFeedback(null);
    setDrawExerciseLoading(false);
    setTimeout(initDrawCanvas, 100);
  };

  const clearDrawCanvas = () => {
    setDrawExerciseFeedback(null);
    initDrawCanvas();
  };

  const submitDrawing = async () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    setDrawExerciseLoading(true);
    setDrawExerciseFeedback(null);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const exercise = DRAW_EXERCISES[currentDrawExercise];
      const result = await assessDrawing(quizApiRoot, {
        image_base64: base64,
        expected_components: exercise.expected,
        exercise_type: exercise.type,
      });
      setDrawExerciseFeedback({
        correct: result.correct,
        feedback: result.feedback,
        components: result.identified_components,
        confidence: result.confidence,
      });
      pushXpEvent(result.correct ? 'quiz_correct' : 'quiz_incorrect', result.correct ? 15 : 3, 'drawing_exercise');
      // Update mastery
      setSkillNodes((prev) =>
        prev.map((node) =>
          node.id === 'logic'
            ? { ...node, mastery: clamp(node.mastery + (result.correct ? 5 : 1), 0, 100) }
            : node
        )
      );
    } catch (err) {
      setDrawExerciseFeedback({
        correct: false,
        feedback: err instanceof Error ? err.message : 'Failed to assess drawing.',
        components: [],
        confidence: 0,
      });
    } finally {
      setDrawExerciseLoading(false);
    }
  };

  // Canvas drawing handlers
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasPos(e);
  };

  const onDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPosRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.strokeStyle = drawIsEraser ? (dark ? '#1a1a2e' : '#ffffff') : drawPenColor;
    ctx.lineWidth = drawIsEraser ? 16 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();
    lastPosRef.current = pos;
  };

  const onDrawEnd = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  return {
    DRAW_EXERCISES,
    currentDrawExercise,
    setCurrentDrawExercise,
    drawExerciseActive,
    setDrawExerciseActive,
    drawExerciseLoading,
    drawExerciseFeedback,
    setDrawExerciseFeedback,
    drawPenColor,
    setDrawPenColor,
    drawIsEraser,
    setDrawIsEraser,
    drawCanvasRef,
    startDrawExercise,
    clearDrawCanvas,
    submitDrawing,
    onDrawStart,
    onDrawMove,
    onDrawEnd,
  };
}
