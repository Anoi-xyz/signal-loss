# Signal Loss — The Locked Style

> A minimalist night-ocean world rendered in low-poly flat-shaded geometry, lit only by cold moonlight and warm buoy glow.

| role | hex | where it belongs |
|---|---|---|
| Deep Water | `0x0a1128` | ocean base depth |
| Mid Water | `0x1c2541` | wave crests / ambient reflection |
| Hull | `0x3a506b` | boat hull body and deck structure |
| Buoy Base | `0x2b3a4a` | buoy float body and anchor frame |
| Buoy Glow | `0xf4a261` | warm buoy lamp emissive glow |
| Lantern Glow | `0xffd166` | bow lantern warm emissive light |
| Moon Highlight | `0xe0fbfc` | cold moonlight, fog rim highlights |
| Sky/Fog Base | `0x0b132b` | atmosphere, horizon background |

## Fixed decisions
- Metres scale throughout. Boat length is 4.0 m. Buoy height is 1.2 m.
- Base at y = 0, centred on x and z, front faces +Z.
- Low-poly flat shading (`flatShading: true`) with explicit part colours.
- Material names follow contract (`metal`, `timber`, `fabric`).
