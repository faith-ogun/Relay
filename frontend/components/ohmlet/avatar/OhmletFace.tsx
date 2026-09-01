import React, { useId } from 'react';
import type { FaceShape } from './avatarConfig';

// ── OhmletFace ──
//
// The head layer, drawn by us.
//
// react-nice-avatar ships exactly one head outline. Its `sex` prop is read only
// by `genConfig`, where it biases which hair and brow the randomiser picks; the
// renderer never looks at it. Keying "face shape" off that prop therefore
// changed nothing on screen, which is why Round and Tapered were identical.
//
// So we draw the head, the neck and the jaw shadow here, in the library's own
// 200x320 face viewBox and in the same box on screen. Every layer the library
// stacks on top (hair, hat, ear, brows, eyes, glasses, nose, mouth, shirt) is
// positioned against that same box, so it all keeps landing where it always did.

interface HeadGeometry {
  /** Cranium and jaw outline. */
  head: string;
  /** Neck and shoulder wedge the head sits on. */
  neck: string;
  /** Same wedge, run past the bottom edge so the shadow mask has no seam. */
  neckMask: string;
  /** The shadow the jaw casts down the neck. */
  shadow: { cx: number; cy: number; rx: number; ry: number };
}

// Both outlines keep the library's slight three-quarter tilt and its cranium
// height, so hair and hats still sit on the head. They differ where a face
// shape actually reads: cheek fullness, jaw width and the chin.
//
// Widths across the face, in viewBox units:
//        y=120   y=168   y=204   y=228   y=240   lowest point
// round    171     177     164     129      86       y=246
// tapered  185     162     137     111      87       y=255
//
// So: round is the wider, shorter face; tapered is the longer one, wide at the
// temples and narrowing from the cheekbone down.
//
// HARD CONSTRAINT on the tapered outline. Everything the library stacks on top
// (hair, ear, neck) is drawn to meet ITS head, and each of those paths carries a
// 4-unit black stroke. If our jaw sits more than about 4 units inside the
// library's jaw, the two strokes stop touching and the background shows through
// as a hairline crack down the cheek. Between y=166 and y=234 this outline
// therefore stays within 3 units of the library's, and the taper is spent on the
// chin and the length of the face instead, where nothing else is drawn. Widening
// past the library's edge is always safe; narrowing past it is not.
//
// Library jaw for reference (min/max x): y=192 34/183 · y=204 39/178 ·
// y=216 46/170 · y=228 57/159.
const GEOMETRY: Record<FaceShape, HeadGeometry> = {
  round: {
    head:
      'M170 72C182 92 188 120 188 148C192 172 190 190 184 206' +
      'C176 232 156 246 120 246C86 246 42 238 22 206' +
      'C12 188 12 156 14 128C18 76 38 26 74 20C118 13 160 32 170 72Z',
    neck: 'M156 319.5C142 300 131 266 130 246L60 224L32 319.5H156Z',
    neckMask: 'M156 331C142 311 131 266 130 246L60 224L32 331H156Z',
    shadow: { cx: 130, cy: 214, rx: 60, ry: 52 },
  },
  tapered: {
    head:
      'M176 64C184.3 76 186.8 85 190 96C193.2 107 195 118.3 195 130' +
      'C195 141.7 192 155.7 190 166C188 176.3 185.3 184.7 183 192' +
      'C180.7 199.3 178.8 204 176 210C173.2 216 170.7 222.3 166 228' +
      'C161.3 233.7 155 239.8 148 244C141 248.2 131 251.2 124 253' +
      'C117 254.8 112.3 255.3 106 255C99.7 254.7 92.7 253.8 86 251' +
      'C79.3 248.2 71.8 242.8 66 238C60.2 233.2 55 227.7 51 222' +
      'C47 216.3 44.8 210 42 204C39.2 198 36.5 192.3 34 186' +
      'C31.5 179.7 30.3 173.3 27 166C23.7 158.7 16.8 150 14 142' +
      'C11.2 134 9.3 129.3 10 118C10.7 106.7 12 88.3 18 74' +
      'C24 59.7 33.7 41.5 46 32C58.3 22.5 76.3 18.3 92 17' +
      'C107.7 15.7 126 16.2 140 24C154 31.8 167.7 52 176 64Z',
    // The neck matches the round one: it is the same neck, and the long-hair
    // strand falls against its right edge, so narrowing it only opens the same
    // hairline crack lower down.
    neck: 'M156 319.5C142 300 131 268 130 250L60 226L32 319.5H156Z',
    neckMask: 'M156 331C142 311 131 268 130 250L60 226L32 331H156Z',
    shadow: { cx: 122, cy: 222, rx: 56, ry: 48 },
  },
};

interface OhmletFaceProps {
  shape: FaceShape;
  color: string;
}

export const OhmletFace: React.FC<OhmletFaceProps> = ({ shape, color }) => {
  // Several avatars share a page, so the mask id has to be per instance. The
  // library hard-codes its ids, which makes every avatar after the first
  // reference the first one's mask.
  const maskId = `ohmlet-neck-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const geometry = GEOMETRY[shape];

  return (
    <svg
      viewBox="0 0 200 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      data-ohmlet-face={shape}
      style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '90%' }}
    >
      <path d={geometry.neck} fill={color} stroke="#000" strokeWidth={4} strokeLinejoin="round" />
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="200"
        height="331"
        style={{ maskType: 'alpha' }}
      >
        <path d={geometry.neckMask} fill="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <ellipse
          cx={geometry.shadow.cx}
          cy={geometry.shadow.cy}
          rx={geometry.shadow.rx}
          ry={geometry.shadow.ry}
          fill="#000"
        />
      </g>
      <path d={geometry.head} fill={color} stroke="#000" strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
};

export default OhmletFace;
