import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/tokens';

const W = 320;
const H = 190;

/**
 * The simulated Uno: thirteen digital pins with an LED on each, the on-board
 * LED on 13, and a brightness that reflects the pin's real DUTY CYCLE rather
 * than a snapshot. That is what makes `analogWrite(9, 64)` look like a quarter
 * brightness instead of flickering, and it is the difference between a
 * simulator a learner trusts and one they do not.
 */
export const UnoBoard: React.FC<{ duty: number[]; running: boolean }> = ({ duty, running }) => (
  <View>
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={10} y={14} width={W - 20} height={H - 40} rx={12}
            fill="#12506b" stroke={colors.ink} strokeWidth={2.5} />
      <SvgText x={26} y={38} fontSize={11} fontWeight="700" fill="#bfe3f2">ARDUINO UNO</SvgText>

      {duty.map((d, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const cx = 40 + col * 40;
        const cy = 84 + row * 46;
        const lit = Math.max(0, Math.min(1, d));
        return (
          <G key={i}>
            <Circle cx={cx} cy={cy} r={11}
                    fill={colors.gold} fillOpacity={running ? lit : 0}
                    stroke={colors.ink} strokeWidth={2} />
            {/* A faint ring keeps an unlit pin legible on the dark board. */}
            <Circle cx={cx} cy={cy} r={11} fill="none" stroke="#7fb8cf" strokeWidth={1} opacity={0.5} />
            <SvgText x={cx} y={cy + 26} fontSize={10} fontWeight="700"
                     fill="#cfe8f3" textAnchor="middle">{i}</SvgText>
          </G>
        );
      })}
    </Svg>
  </View>
);

