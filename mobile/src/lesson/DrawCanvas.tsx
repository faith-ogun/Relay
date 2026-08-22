import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../theme/tokens';

export interface DrawCanvasHandle {
  clear: () => void;
  undo: () => void;
  isEmpty: () => boolean;
}

interface Props {
  /** Fires whenever the stroke count changes, so the shell can enable Check. */
  onInkChange?: (hasInk: boolean) => void;
  height?: number;
}

/**
 * A freeform drawing surface for the draw_circuit / draw_fix steps.
 *
 * Strokes are SVG paths rather than a bitmap, so the drawing stays crisp, undo
 * is a pop rather than a repaint, and the whole thing can be captured as an
 * image for grading without a second rendering path.
 *
 * PanResponder is used directly rather than a gesture library: this needs raw
 * move events at full rate, and nothing here competes for the gesture.
 */
export const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(({ onInkChange, height = 300 }, ref) => {
  const [paths, setPaths] = useState<string[]>([]);
  const current = useRef<string>('');
  const [live, setLive] = useState<string>('');
  const size = useRef({ w: 0, h: 0 });

  const emit = (count: number) => onInkChange?.(count > 0);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLive(current.current);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        current.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLive(current.current);
      },
      onPanResponderRelease: () => {
        const done = current.current;
        current.current = '';
        setLive('');
        if (done.includes('L')) {
          // A tap with no movement is not a stroke; ignore it rather than
          // leaving invisible marks that make "has ink" lie.
          setPaths((p) => {
            const next = [...p, done];
            emit(next.length);
            return next;
          });
        }
      },
    }),
  ).current;

  useImperativeHandle(ref, () => ({
    clear: () => { setPaths([]); setLive(''); current.current = ''; emit(0); },
    undo: () => setPaths((p) => { const next = p.slice(0, -1); emit(next.length); return next; }),
    isEmpty: () => paths.length === 0,
  }), [paths.length]);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <View
      style={[s.canvas, { height }]}
      onLayout={onLayout}
      {...responder.panHandlers}
      accessibilityLabel="Drawing area"
      accessibilityHint="Draw your circuit with your finger"
    >
      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke={colors.ink} strokeWidth={3} fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {!!live && (
          <Path d={live} stroke={colors.ink} strokeWidth={3} fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
        )}
      </Svg>
    </View>
  );
});

DrawCanvas.displayName = 'DrawCanvas';

const s = StyleSheet.create({
  canvas: {
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
