import main from './bdpt.wgsl?raw';
import geometry from './geometry.wgsl?raw';
import rng from './rng.wgsl?raw';
import material from './material.wgsl?raw';

export default `
${geometry}
${rng}
${material}
${main}
`;