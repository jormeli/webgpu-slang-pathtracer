struct Material {
    surfaceColor: vec3<f32>,
    emissionColor: vec3<f32>,
}

struct BSDFSample {
    outputDir: vec3<f32>,
    weight: f32,
    pdfW: f32,
    cosTheta: f32,
}

struct BSDFEvaluate {
    weight: f32,
    cosTheta: f32,
    colorAbsorption: vec3<f32>,
    pdfW: f32,
}

struct BSDFPDF {
    pdfWForward: f32,
    pdfWBackward: f32,
}

// Returns the BSDF weight, cosine of the input angle, color absorption, and optional PDF
fn LambertianBSDFEvaluate(
    material: Material,
    inputDir: vec3f,
    outputDir: vec3f,
    normal: vec3f
) -> BSDFEvaluate {
    let cosTheta = dot(outputDir, normal);

    if (cosTheta <= 0.0) {
        return BSDFEvaluate(0.0, 0.0, vec3f(0.0, 0.0, 0.0), 0.0);
    }

    let weight = 1.0 / PI; // Lambertian weight
    let colorAbsorption = material.surfaceColor;
    let pdfW = cosTheta / PI; // Probability density over the hemisphere

    return BSDFEvaluate(weight, cosTheta, colorAbsorption, pdfW);
}

// Computes the forward and backward PDFs
fn LambertianBSDFCalculatePDFW(
    inputDir: vec3<f32>,
    outputDir: vec3<f32>,
    normal: vec3<f32>
) -> BSDFPDF {
    let cosThetaForward = max(dot(outputDir, normal), 0.0);
    let cosThetaBackward = max(dot(inputDir, normal), 0.0);

    let pdfWForward = cosThetaForward / PI;
    let pdfWBackward = cosThetaBackward / PI;

    return BSDFPDF(pdfWForward, pdfWBackward);
}

// Samples the hemisphere based on cosine-weighted distribution
fn LambertianBSDFSample(
    material: Material,
    inputDir: vec3f,
    normal: vec3f,
    rngState: ptr<function, u32>
) -> BSDFSample {
    let outputDir = sampleCosineWeightedHemisphere(normal, rngState);
    let cosThetaInput = max(dot(inputDir, normal), 0.0);
    let cosThetaOutput = max(dot(outputDir, normal), 0.0);

    if (cosThetaOutput <= 0.0) {
        return BSDFSample(vec3f(0.0, 0.0, 0.0), 0.0, 0.0, 0.0);
    }

    let weight = 1.0 / PI; // Lambertian weight
    let pdfWForward = cosThetaOutput / PI;
    
    return BSDFSample(outputDir, weight, pdfWForward, cosThetaOutput);
}
