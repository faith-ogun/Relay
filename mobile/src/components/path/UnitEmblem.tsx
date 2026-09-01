import React from 'react';
import { Image, View } from 'react-native';
import { makeStyles } from '../../theme/theme';

/**
 * The painted emblem on a unit banner.
 *
 * One per unit, keyed by the curriculum's own unit id. Deliberately NOT the
 * mascot twelve times: these stack in a single scrolling column, and twelve
 * variations of one character would make the unit's identity come from its
 * background colour alone. The subject is what tells "Capacitors, RC & Timing"
 * apart from "Transistors & Switching", so the subject is what is drawn.
 *
 * `require` calls have to be static, so this is a literal map rather than a
 * path built from the id. mobile/scripts/check-unit-art.mjs fails the build if
 * the curriculum ever carries a unit this map does not, which is the failure
 * that would otherwise ship as a silently missing picture.
 */
const UNIT_ART: Record<string, number> = {
  foundations: require('../../../assets/units/foundations.png'),
  breadboard: require('../../../assets/units/breadboard.png'),
  sensors: require('../../../assets/units/sensors.png'),
  arduino: require('../../../assets/units/arduino.png'),
  'inputs-outputs': require('../../../assets/units/inputs-outputs.png'),
  'capacitors-rc': require('../../../assets/units/capacitors-rc.png'),
  transistors: require('../../../assets/units/transistors.png'),
  'op-amps': require('../../../assets/units/op-amps.png'),
  'filters-oscillators': require('../../../assets/units/filters-oscillators.png'),
  'power-supplies': require('../../../assets/units/power-supplies.png'),
  'digital-logic': require('../../../assets/units/digital-logic.png'),
  'comms-motors-robotics': require('../../../assets/units/comms-motors-robotics.png'),
};

export const UNIT_ART_IDS = Object.keys(UNIT_ART);
/**
 * 64, not 88, and the difference was measured rather than guessed.
 *
 * The banner's text column is about 218pt on a 375pt screen. At 88 it dropped to
 * 194, and the long unit titles ("Filters, Oscillators & Signals",
 * "Op-Amps & Signal Conditioning") wrapped to THREE lines at the old 28pt, which
 * made neighbouring banners wildly different heights down the scroll. At 64 with
 * a 22pt title every unit fits in two lines at most.
 */
export const EMBLEM = 64;

export const UnitEmblem: React.FC<{ unitId: string; dimmed?: boolean }> = ({ unitId, dimmed }) => {
  const s = useS();
  const art = UNIT_ART[unitId];
  // A unit with no art renders nothing rather than a placeholder box. The check
  // script is what makes sure this branch is unreachable in a shipped build.
  if (!art) return null;
  return (
    <View style={s.slot} pointerEvents="none">
      <Image
        source={art}
        style={[s.img, dimmed && s.dim]}
        resizeMode="contain"
        // Decorative: the unit's title is right beside it and already read out.
        accessible={false}
      />
    </View>
  );
};

const useS = makeStyles((colors) => ({
  slot: { width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' },
  img: { width: EMBLEM, height: EMBLEM },
  // A locked unit's emblem recedes rather than disappears, so the path still
  // shows what is coming without competing with the unit that is open.
  dim: { opacity: 0.4 },
}));
