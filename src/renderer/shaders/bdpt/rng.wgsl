@must_use
fn rngNextFloat(state: ptr<function, u32>) -> f32 {
    rngNextInt(state);
    return f32(*state) / f32(0xffffffffu);
}

fn rngNextInt(state: ptr<function, u32>) {
    // PCG random number generator
    // Based on https://www.shadertoy.com/view/XlGcRh

    let oldState = *state + 747796405u + 2891336453u;
    let word = ((oldState >> ((oldState >> 28u) + 4u)) ^ oldState) * 277803737u;
    *state = (word >> 22u) ^ word;
}

@must_use
fn randInRange(min: f32, max: f32, state: ptr<function, u32>) -> f32 {
    return min + rngNextFloat(state) * (max - min);
}

fn randomVec3InUnitSphere(state: ptr<function, u32>) -> vec3<f32> {
    let r = pow(rngNextFloat(state), 0.33333f);
    let theta = PI * rngNextFloat(state);
    let phi = 2f * PI * rngNextFloat(state);

    let x = r * sin(theta) * cos(phi);
    let y = r * sin(theta) * sin(phi);
    let z = r * cos(theta);

    return vec3(x, y, z);
}

fn randomUnitVec3(rngState: ptr<function, u32>) -> vec3f {
    return normalize(randomVec3InUnitSphere(rngState));
}

fn randomUnitVec3OnHemisphere(normal: vec3f, rngState: ptr<function, u32>) -> vec3f {
    let onUnitSphere = randomUnitVec3(rngState);
    return select(-onUnitSphere, onUnitSphere, dot(onUnitSphere, normal) > 0.0);
}

fn sampleCosineWeightedHemisphere(normal: vec3f, rng: ptr<function, u32>) -> vec3f {
    // Generate two random numbers in [0,1)
    let r1 = rngNextFloat(rng);
    let r2 = rngNextFloat(rng);

    // Convert to spherical coordinates:
    //  phi   in [0..2π)
    //  cosΘ  in [1..0], we usually sample z=√(1-r2)
    let phi     = 2.0 * PI * r1;
    let cosTheta = sqrt(1.0 - r2);
    let sinTheta = sqrt(r2);

    // Now build a direction in tangent space:
    let x = cos(phi) * sinTheta;
    let y = sin(phi) * sinTheta;
    let z = cosTheta;  // points "up" along local +Z

    // Then transform (x,y,z) so that z-axis aligns with 'normal'.
    // A quick way is to build an orthonormal basis (u,v,w) around normal:
    let w = normalize(normal);                 // w ~ normal
    let a = select(vec3f(0.0,1.0,0.0), vec3f(1.0,0.0,0.0), abs(w.y) > 0.9); 
    let vVec = normalize(cross(w, a));
    let uVec = cross(vVec, w);

    // local (x,y,z) -> world coords:
    let worldDir = x*uVec + y*vVec + z*w;
    return normalize(worldDir);
}
