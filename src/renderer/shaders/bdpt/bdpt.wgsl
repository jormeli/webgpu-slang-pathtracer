@group(0) @binding(0) var<uniform> uFrame : u32;
@group(0) @binding(1) var<uniform> inverseViewProjectionMatrix : mat4x4f;
@group(2) @binding(0) var tex: texture_storage_2d<bgra8unorm, write>;
@group(3) @binding(0) var<storage, read_write> imageBuffer: array<vec3f>;
@group(1) @binding(0) var<storage> triangles : array<Triangle>;
@group(1) @binding(1) var<storage> vertices : array<vec3f>;
@group(1) @binding(2) var<storage> materials : array<Material>;

const PI = 3.14159265359;
const MAX_CAMERA_PATH_LENGTH: u32 = 5;
const MAX_LIGHT_PATH_LENGTH: u32 = 4;

const VERTEX_TYPE_CAMERA: u32 = 0;
const VERTEX_TYPE_LIGHT: u32 = 1;
const VERTEX_TYPE_SURFACE: u32 = 2;

struct ConnectionResult {
    radiance: vec3<f32>,
    misWeight: f32,
}

/**
 * Intersection
 */

fn intersectTriangle(ray: Ray, triangle: Triangle, hit: ptr<function, Hit>) -> bool {
  let v1 = vertices[triangle.a];
  let v2 = vertices[triangle.b];
  let v3 = vertices[triangle.c];
  let edge1 = v2 - v1;
  let edge2 = v3 - v1;
  let h = cross(ray.direction, edge2);
  let a = dot(edge1, h);
  if (a > -0.00001 && a < 0.00001) {
    return false;
  }
  let f = 1.0 / a;
  let s = ray.origin - v1;
  let u = f * dot(s, h);
  if (u < 0.0 || u > 1.0) {
    return false;
  }
  let q = cross(s, edge1);
  let v = f * dot(ray.direction, q);
  if (v < 0.0 || u + v > 1.0) {
    return false;
  }
  let t = f * dot(edge2, q);
  if (t > 0.00001) {
    (*hit).t = t;
    (*hit).position = ray.origin + ray.direction * t;
    (*hit).valid = true;
    let normal1 = normalize(cross(edge1, edge2));
    let normal2 = normalize(cross(edge2, edge1));
    if (dot(normal1, ray.direction) < 0.0) {
      (*hit).normal = normal1;
    } else {
      (*hit).normal = normal2;
    }
    return true;
  }
  return false;
}

fn intersectScene(ray: Ray) -> Hit {
    var closest: Hit;
    closest.valid = false;
    for (var i = 0; i < i32(arrayLength(&triangles)); i = i + 1) {
        let tri = triangles[i];
        var hit : Hit;
        if (intersectTriangle(ray, tri, &hit)) {
            if (!closest.valid || hit.t < closest.t) {
                closest = hit;
                closest.materialIdx = tri.materialIdx;
            }
        }
    }
    return closest;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    // Initializations
    let pixelIndex = id.x + id.y * textureDimensions(tex).x;
    var rngState: u32 = uFrame * 1234567u + pixelIndex;

    let dimensions = textureDimensions(tex);
    let x = (f32(id.x) + 0.5) / f32(dimensions.x) - 0.5;
    let y = 1.0 - (f32(id.y) + 0.5) / f32(dimensions.y) - 0.5;

    // Generate and store the light subpath
    let lightSubpath = generateLightSubpath(&rngState);
    let cameraSubpath = generateCameraSubpath(x, y, &rngState);

    var color = connectBDPT(lightSubpath, cameraSubpath);
    if (uFrame > 0) {
        let prevColor = imageBuffer[pixelIndex] * f32(uFrame) / (f32(uFrame + 1));
        color = (color / f32(uFrame + 1)) + prevColor;
    }

    // Store results
    textureStore(tex, id.xy, vec4f(color, 1.0));
    imageBuffer[pixelIndex] = color;
}

struct PathVertex {
    position: vec3f,
    normal: vec3f,
    beta: vec3f,           // Path throughput or contribution
    pdfFwd: f32,
    pdfRev: f32,
    vType: u32,            // Camera, Light, Surface
    materialIdx: u32,
    isDelta: bool,
}

struct Path {
    vertices: array<PathVertex, MAX_LIGHT_PATH_LENGTH>,
    vertexCount: u32,
}

fn distanceSquared(a: vec3f, b: vec3f) -> f32 {
    let diff = a - b;
    return dot(diff, diff);
}

fn computeCameraRay(x: f32, y: f32, rngState: ptr<function, u32>) -> Ray {
    // Extract camera properties from the view matrix
    let invViewMatrix = inverseViewProjectionMatrix;

    let cameraPos = invViewMatrix[3].xyz;  // Extract camera position from the inverse view matrix
    let cameraRight = normalize(invViewMatrix[0].xyz); // Right vector from matrix basis
    let cameraUp = normalize(invViewMatrix[1].xyz);    // Up vector from matrix basis
    let cameraFwd = normalize(-invViewMatrix[2].xyz);  // Forward vector from matrix basis (negated Z-axis)

    // Field of view scale for perspective projection
    let fovScale = tan(radians(1));
    let dimensions = textureDimensions(tex);
    let aspectRatio = f32(dimensions.x) / f32(dimensions.y);
    // Add jitter to screen-space x, y for anti-aliasing
    let random1 = rngNextFloat(rngState);
    let random2 = rngNextFloat(rngState);
    let jitteredX = x + (random1 - 0.5) * 2.0 / f32(dimensions.x);
    let jitteredY = y + (random2 - 0.5) * 2.0 / f32(dimensions.y);

    // Calculate ray direction with jittered coordinates
    let pixelDir = normalize(
        fovScale * (jitteredX * cameraRight * aspectRatio + jitteredY * cameraUp + cameraFwd)
    );

    return Ray(cameraPos, pixelDir);
}

fn dotOrZero(a: vec3f, b: vec3f) -> f32 {
    let d = dot(a,b);
    return select(d, 0.0, d < 0.0);
}

fn checkOcclusion(vLight: PathVertex, vCamera: PathVertex) -> bool {
    let d = vCamera.position - vLight.position;
    let dist2 = dot(d, d);
    if (dist2 < 1e-8) {
        return false;
    }
    let dist = sqrt(dist2);
    let dir = normalize(d);
    
    let midRay = Ray(vLight.position, dir);
    let shadowHit = intersectScene(midRay);
    // If it hits something before the camera vertex, occluded
    return shadowHit.valid && shadowHit.t < dist - 1e-4;
}

fn connectVertices(
    vLight: PathVertex,
    vCamera: PathVertex
) -> vec3f {
    if (checkOcclusion(vLight, vCamera)) {
        return vec3f(0.0);
    }
    let dir = normalize(vCamera.position - vLight.position);
    let dist2 = distanceSquared(vLight.position, vCamera.position);

    // Evaluate BRDF at each side
    let matL = materials[vLight.materialIdx];
    let matC = materials[vCamera.materialIdx];

    let evalL = LambertianBSDFEvaluate(matL, -dir,  dir, vLight.normal);
    let evalC = LambertianBSDFEvaluate(matC,  dir, -dir, vCamera.normal);

    // Combine lambert factors:
    let f1 = evalL.weight * evalL.colorAbsorption;
    let f2 = evalC.weight * evalC.colorAbsorption;
    let cosLight = max(dot(vLight.normal,  dir), 0.0);
    let cosCamera = max(dot(vCamera.normal, -dir), 0.0);
    let geometry = cosLight * cosCamera / dist2;

    // Final connection radiance
    let radiance = vLight.beta * vCamera.beta * f1 * f2 * geometry;

    return radiance;
}

fn generateLightSubpath(rngState: ptr<function, u32>) -> Path {
    var subpath: Path;
    subpath.vertexCount = 0u;

    // Pick a random emissive triangle
    var allLights: array<u32, 16>;
    var lightCount: u32 = 0u;
    for (var i = 0; i < i32(arrayLength(&triangles)); i = i + 1) {
        let tri = triangles[i];
        if (materials[tri.materialIdx].emissionColor.x > 0.0) {
            allLights[lightCount] = u32(i);
            lightCount++;
        }
    }

    if (lightCount == 0u) {
        return subpath; // no emissive geometry
    }

    let lightIndex = allLights[u32(rngNextFloat(rngState) * f32(lightCount))];
    let lightTri = triangles[lightIndex];

    let matID = lightTri.materialIdx;
    let mat = materials[matID];

    // Sample point on the triangle
    let r1 = rngNextFloat(rngState);
    let r2 = rngNextFloat(rngState);
    let p0 = vertices[lightTri.a];
    let p1 = vertices[lightTri.b];
    let p2 = vertices[lightTri.c];
    let sampledPos = p0 + r1 * (p1 - p0) + r2 * (p2 - p0);
    var normal = normalize(cross(p1 - p0, p2 - p0));
    let area = 0.5 * length(cross(p1 - p0, p2 - p0));

    let pdfA = 1.0 / area;
    let pdfTri = 1.0 / f32(lightCount);
    let pdfSelect = pdfA * pdfTri;

    let sample = LambertianBSDFSample(mat, vec3f(0.0, 0.0, 1.0), normal, rngState);
    let dir = sample.outputDir;
    let pdfDirection = sample.pdfW;

    let beta0 = (mat.emissionColor * sample.weight * sample.cosTheta) / (pdfSelect * pdfDirection);

    // Create initial light vertex
    let lightVertex = PathVertex(
        sampledPos,
        normal,
        beta0,
        pdfSelect * pdfDirection,
        0.0,
        VERTEX_TYPE_LIGHT,
        matID,
        false
    );
    subpath.vertices[subpath.vertexCount] = lightVertex;
    subpath.vertexCount++;

    var ray = Ray(sampledPos, dir);
    var beta2 = beta0;
    var pdfF = 1.0;

    for (var depth = 1u; depth < MAX_LIGHT_PATH_LENGTH; depth = depth + 1u) {
        let hit = intersectScene(ray);
        if (!hit.valid) {
            break;
        }
        let matID2 = hit.materialIdx;
        let mat2 = materials[matID2];

        // Next direction from BSDF sampling
        let newDir = LambertianBSDFSample(mat2, ray.direction, hit.normal, rngState).outputDir;
        let eval = LambertianBSDFEvaluate(mat2, ray.direction, newDir, hit.normal);
        let pdfVal = eval.pdfW;

        // Update throughput
        pdfF = pdfVal;
        beta2 = beta2 * (eval.weight * eval.colorAbsorption * eval.cosTheta) / pdfVal;

        // Build new vertex
        let newVert = PathVertex(
            hit.position,
            hit.normal,
            beta2,
            pdfF,
            0.0,
            VERTEX_TYPE_SURFACE,
            matID2,
            false
        );
        subpath.vertices[subpath.vertexCount] = newVert;
        subpath.vertexCount++;

        ray = Ray(hit.position, newDir);
    }
    return subpath;
}

fn generateCameraSubpath(x: f32, y: f32, rngState: ptr<function, u32>) -> Path {
    var subpath: Path;
    subpath.vertexCount = 0u;

    var ray = computeCameraRay(x, y, rngState);
    var beta = vec3f(1.0, 1.0, 1.0);
    var pdfF = 1.0;

    let v0 = PathVertex(
        ray.origin,
        vec3f(0.0,0.0,1.0),
        beta,
        pdfF,
        0.0,
        VERTEX_TYPE_CAMERA,
        0u,
        false
    );
    subpath.vertices[subpath.vertexCount] = v0;
    subpath.vertexCount++;

    for (var depth = 0u; depth < MAX_CAMERA_PATH_LENGTH; depth = depth + 1u) {
        let hit = intersectScene(ray);
        if (!hit.valid) {
            break;
        }
        let matID = hit.materialIdx;
        let mat = materials[matID];

        // BSDF sample
        let newDir = LambertianBSDFSample(mat, ray.direction, hit.normal, rngState).outputDir;
        let eval  = LambertianBSDFEvaluate(mat, ray.direction, newDir, hit.normal);
        let pdfVal = eval.pdfW;
        beta = beta * (eval.weight * eval.colorAbsorption * eval.cosTheta) / pdfVal;
        pdfF = pdfVal;

        // Record new vertex
        let newVert = PathVertex(
            hit.position,
            hit.normal,
            beta,
            pdfF,
            0.0,
            VERTEX_TYPE_SURFACE,
            matID,
            false
        );
        subpath.vertices[subpath.vertexCount] = newVert;
        subpath.vertexCount++;

        ray = Ray(hit.position, newDir);
    }
    return subpath;
}

fn computePathPdfForward(path: Path, endIndex: u32) -> f32 {
    var pdfProd = 1.0;
    for (var i = 1u; i <= endIndex; i = i + 1u) {
        pdfProd = pdfProd * path.vertices[i].pdfFwd;
    }
    return pdfProd;
}

fn computeMISWeight(
    lightSubpath: Path, s: u32,
    cameraSubpath: Path, t: u32
) -> f32 {
    let pdfLight = computePathPdfForward(lightSubpath, s);
    let pdfCamera = computePathPdfForward(cameraSubpath, t);

    // Power heuristic
    let alpha = 2.0;
    let lTerm = pow(pdfLight, alpha);
    let cTerm = pow(pdfCamera, alpha);

    return lTerm / (lTerm + cTerm + 1e-12);
}

fn connectBDPT(lightSubpath: Path, cameraSubpath: Path) -> vec3f {
    var finalColor = vec3f(0.0, 0.0, 0.0);

    for (var s = 0u; s < lightSubpath.vertexCount; s = s + 1u) {
        for (var t = 0u; t < cameraSubpath.vertexCount; t = t + 1u) {
            let vLight = lightSubpath.vertices[s];
            let vCamera = cameraSubpath.vertices[t];

            if (s == 0 && t == 0) {
                // Evaluate BRDF at each side
                let dir = normalize(vCamera.position - vLight.position);
                let dist2 = distanceSquared(vLight.position, vCamera.position);
                let matL = materials[vLight.materialIdx];

                let evalL = LambertianBSDFEvaluate(matL, -dir,  dir, vLight.normal);

                let f1 = evalL.weight * evalL.colorAbsorption;
                let f2 = 1.0;
                let cosLight = max(dot(vLight.normal,  dir), 0.0);
                let cosCamera = max(dot(vCamera.normal, -dir), 0.0);
                let geometry = cosLight * cosCamera / dist2;

                // Final connection radiance
                finalColor += vLight.beta * vCamera.beta * f1 * f2 * geometry * computeMISWeight(lightSubpath, s, cameraSubpath, t);
            }

            let conn = connectVertices(vLight, vCamera);

            let w = computeMISWeight(lightSubpath, s, cameraSubpath, t);

            finalColor += conn * w;
        }
    }

    return clamp(finalColor, vec3f(0.0), vec3f(1.0));
}