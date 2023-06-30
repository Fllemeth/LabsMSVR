'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let sphere;
let userPoint;
let angle;
let camera,
  video,
  texture,
  textureE,
  track,
  surfaceE;

function deg2rad(angle) {
  return angle * Math.PI / 180;
}


// Constructor
function StereoCamera(
  Convergence,
  EyeSeparation,
  AspectRatio,
  FOV,
  NearClippingDistance,
  FarClippingDistance
) {
  this.mConvergence = Convergence;
  this.mEyeSeparation = EyeSeparation;
  this.mAspectRatio = AspectRatio;
  this.mFOV = FOV;
  this.mNearClippingDistance = NearClippingDistance;
  this.mFarClippingDistance = FarClippingDistance;

  this.mProjectionMatrix = null;
  this.mModelViewMatrix = null;

  this.ApplyLeftFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-b * this.mNearClippingDistance) / this.mConvergence;
    right = (c * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to right
    this.mModelViewMatrix = m4.translation(
      this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.ApplyRightFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-c * this.mNearClippingDistance) / this.mConvergence;
    right = (b * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to left
    this.mModelViewMatrix = m4.translation(
      -this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.updateEFNC = function() {
    let c = document.getElementsByClassName("c");
    let e = 70.0;
    e = document.getElementById("e").value;
    c[0].innerHTML = e;
    this.mEyeSeparation = e;
    let f = 0.8;
    f = document.getElementById("f").value;
    c[1].innerHTML = f;
    this.mFOV = f;
    let n = 5.0;
    n = document.getElementById("n").value - 0.0;
    c[2].innerHTML = n;
    this.mNearClippingDistance = n
    let con = 2000.0;
    con = document.getElementById("c").value;
    c[3].innerHTML = con;
    this.mConvergence = con
  }
}

function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iVertexTextureBuffer = gl.createBuffer();
  this.count = 0;
  this.textureCount = 0;

  this.BufferData = function(vertices) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  }
  this.TextureBufferData = function(vertices) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.textureCount = vertices.length / 2;
  }

  this.Draw = function() {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertexTexture, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertexTexture);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
  this.DrawSphere = function() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
}


// Constructor
function ShaderProgram(name, program) {

  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  this.iAttribVertexTexture = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.iTMU = -1;
  this.iUserPoint = -1;
  this.iAngle = 0;
  this.iTranslateSphere = -1;

  this.Use = function() {
    gl.useProgram(this.prog);
  }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  //start = true
  if (start) {
    gl.clearColor(0., 0., 0., 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();
    let modelViewW = m4.identity();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.0);
    let translateToPointZero = m4.translation(0, 0, -10);
    let translateToPointZeroO = m4.translation(-0.5, -0.5, -10);
    let scaleToFit = m4.scaling(4, 4, 1);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum0W = m4.multiply(rotateToPointZero, modelViewW);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
    let matAccum1W = m4.multiply(translateToPointZeroO, matAccum0W);
    let matAccumW = m4.multiply(scaleToFit, matAccum1W);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumW);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

    gl.uniform1i(shProgram.iTMU, 0);
    gl.enable(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, textureE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      video
    );

    gl.uniform2fv(shProgram.iUserPoint, [userPoint.x, userPoint.y]);
    gl.uniform1f(shProgram.iAngle, angle);
    gl.uniform1f(shProgram.iB, -1);

    gl.uniform3fv(shProgram.iTranslateSphere, [-0., -0., -0.])
    camera.updateEFNC();
    surfaceE.Draw();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    camera.ApplyLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, camera.mProjectionMatrix);
    gl.colorMask(false, true, true, false);
    surface.Draw();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    camera.ApplyRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, camera.mProjectionMatrix);
    gl.colorMask(true, false, false, false);
    surface.Draw();
    gl.colorMask(true, true, true, true);
    // let translate = corSphere(map(userPoint.x, 0, 1, 0, Math.PI * 2), map(userPoint.y, 0, 1, 0, Math.PI / 2))
    let vec3 = getVector(alpha, beta, gamma);
    gl.uniform3fv(shProgram.iTranslateSphere, [vec3[0], vec3[1], vec3[2]])
    gl.uniform1f(shProgram.iB, 1);
    sphere.DrawSphere();
    if (audioPanner) {
      audioPanner.setPosition(vec3[0], vec3[1], vec3[2]);
    }
  }
}

function drawW() {
  draw()
  window.requestAnimationFrame(drawW);
}

function CreateSurfaceData() {
  let vertexList = [];
  let uMax = Math.PI * 2
  let vMax = Math.PI / 2
  let uStep = uMax * 0.005;
  let vStep = vMax * 0.005;
  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {

      let vert = corSphere(u, v)
      let avert = corSphere(u + uStep, v)
      let bvert = corSphere(u, v + vStep)
      let cvert = corSphere(u + uStep, v + vStep)

      vertexList.push(vert.x, vert.y, vert.z)
      vertexList.push(avert.x, avert.y, avert.z)
      vertexList.push(bvert.x, bvert.y, bvert.z)

      vertexList.push(avert.x, avert.y, avert.z)
      vertexList.push(cvert.x, cvert.y, cvert.z)
      vertexList.push(bvert.x, bvert.y, bvert.z)
    }
  }

  return vertexList;
}
function map(val, f1, t1, f2, t2) {
  let m;
  m = (val - f1) * (t2 - f2) / (t1 - f1) + f2
  return Math.min(Math.max(m, f2), t2);
}
function CreateSurfaceTextureData() {
  let vertexTextureList = [];
  let uMax = Math.PI * 2
  let vMax = Math.PI / 2
  let uStep = uMax * 0.005;
  let vStep = vMax * 0.005;
  let uStepMap = map(uStep, 0, uMax, 0, 1)
  let vStepMap = map(vStep, 0, vMax, 0, 1)
  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {
      let u1 = map(u, 0, uMax, 0, 1);
      let v1 = map(v, 0, vMax, 0, 1);
      vertexTextureList.push(u1, v1);
      vertexTextureList.push(u1 + uStepMap, v1);
      vertexTextureList.push(u1, v1 + vStepMap);
      vertexTextureList.push(u1 + uStepMap, v1);
      vertexTextureList.push(u1 + uStepMap, v1 + vStepMap);
      vertexTextureList.push(u1, v1 + vStepMap);
    }
  }

  return vertexTextureList;
}

const R = 1;
const n = 6;
const a = 0.24;
function corSphere(u, v) {
  let x = (R * Math.cos(v) - a * (1 - Math.sin(v)) * Math.abs(Math.cos(n * u))) * Math.cos(u);
  let y = (R * Math.cos(v) - a * (1 - Math.sin(v)) * Math.abs(Math.cos(n * u))) * Math.sin(u);
  let z = R * Math.sin(v);
  return {
    x: x,
    y: y,
    z: z
  };
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribVertexTexture = gl.getAttribLocation(prog, "vertexTexture");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
  shProgram.iTMU = gl.getUniformLocation(prog, 'TMU');
  shProgram.iUserPoint = gl.getUniformLocation(prog, 'userPoint');
  shProgram.iAngle = gl.getUniformLocation(prog, 'rotate');
  shProgram.iTranslateSphere = gl.getUniformLocation(prog, 'translateSphere');
  shProgram.iB = gl.getUniformLocation(prog, 'b');

  LoadTexture()
  surface = new Model('Surface');
  surface.BufferData(CreateSurfaceData());
  surface.TextureBufferData(CreateSurfaceTextureData());
  sphere = new Model('Sphere');
  sphere.BufferData(CreateSphereSurface())
  surfaceE = new Model('Surface E')
  surfaceE.BufferData([0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0]);
  surfaceE.TextureBufferData([1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]);

  gl.enable(gl.DEPTH_TEST);
}

function CreateSphereSurface(r = 0.05) {
  let vertexList = [];
  let lon = -Math.PI;
  let lat = -Math.PI * 0.5;
  while (lon < Math.PI) {
    while (lat < Math.PI * 0.5) {
      let v1 = sphereSurfaceDate(r, lon, lat);
      let v2 = sphereSurfaceDate(r, lon + 0.5, lat);
      let v3 = sphereSurfaceDate(r, lon, lat + 0.5);
      let v4 = sphereSurfaceDate(r, lon + 0.5, lat + 0.5);
      vertexList.push(v1.x, v1.y, v1.z);
      vertexList.push(v2.x, v2.y, v2.z);
      vertexList.push(v3.x, v3.y, v3.z);
      vertexList.push(v2.x, v2.y, v2.z);
      vertexList.push(v4.x, v4.y, v4.z);
      vertexList.push(v3.x, v3.y, v3.z);
      lat += 0.5;
    }
    lat = -Math.PI * 0.5
    lon += 0.5;
  }
  return vertexList;
}

function sphereSurfaceDate(r, u, v) {
  let x = r * Math.sin(u) * Math.cos(v);
  let y = r * Math.sin(u) * Math.sin(v);
  let z = r * Math.cos(u);
  return { x: x, y: y, z: z };
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  camera = new StereoCamera(
    2000,
    70.0,
    1,
    0.8,
    5,
    100
  );
  startAudio();
  readGyroscope();
  let canvas;
  userPoint = { x: 0.5, y: 0.5 }
  angle = 0.0;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    window.vid = video;
    getWebcam();
    textureE = CreateWebCamTexture();
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();  // initialize the WebGL graphics context
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  drawW();
}

function LoadTexture() {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const image = new Image();
  image.crossOrigin = 'anonymus';

  image.src = "https://raw.githubusercontent.com/Fllemeth/LabsVGGI/CGV/512x512_Dissolve_Noise_Texture.png";
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    draw()
  }
}

function getWebcam() {
  navigator.getUserMedia({ video: true, audio: false }, function(stream) {
    video.srcObject = stream;
    track = stream.getTracks()[0];
  }, function(e) {
    console.error('Rejected!', e);
  });
}

function CreateWebCamTexture() {
  let webCamTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, webCamTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return webCamTexture;
}

let sensor;
let deltaRotationMatrix;
let x, y, z, alpha = 0, beta = 0, gamma = 0;
const EPSILON = 0.0001;
let timeStamp = 0;
function readGyroscope() {
  timeStamp = Date.now();
  sensor = new Gyroscope({ frequency: 30 });
  sensor.addEventListener('reading', e => {
    x = sensor.x
    y = sensor.y
    z = sensor.z
    composeRotationMatrix()
  });
  sensor.start();
}
const MS2S = 1.0 / 1000.0;
let start = false;
function composeRotationMatrix() {
  let debug = document.getElementById("message2")
  if (x != null && y != null && z != null) {
    let dT = (Date.now() - timeStamp) * MS2S
    alpha += x * dT
    beta += y * dT
    gamma += z * dT
    let rotVec = [alpha, beta, gamma];
    if (Math.abs(alpha) < Math.PI * 0.25 && Math.abs(beta) < Math.PI * 0.25 && Math.abs(gamma) < Math.PI * 0.25) {
      deltaRotationMatrix = getRotationMatrixFromVector(rotVec)
    }
    else {
      alpha -= x * dT
      beta -= y * dT
      gamma -= z * dT
    }
    timeStamp = Date.now();
    start = true
  }
  else {
    debug.innerHTML = "null1"
  }
}

function getRotationMatrixFromVector(rotationVector) {
  const q1 = rotationVector[0];
  const q2 = rotationVector[1];
  const q3 = rotationVector[2];
  let q0;

  if (rotationVector.length >= 4) {
    q0 = rotationVector[3];
  } else {
    q0 = 1 - q1 * q1 - q2 * q2 - q3 * q3;
    q0 = q0 > 0 ? Math.sqrt(q0) : 0;
  }
  const sq_q1 = 2 * q1 * q1;
  const sq_q2 = 2 * q2 * q2;
  const sq_q3 = 2 * q3 * q3;
  const q1_q2 = 2 * q1 * q2;
  const q3_q0 = 2 * q3 * q0;
  const q1_q3 = 2 * q1 * q3;
  const q2_q0 = 2 * q2 * q0;
  const q2_q3 = 2 * q2 * q3;
  const q1_q0 = 2 * q1 * q0;

  let R = [];
  R.push(1 - sq_q2 - sq_q3);
  R.push(q1_q2 - q3_q0);
  R.push(q1_q3 + q2_q0);
  R.push(0.0);
  R.push(q1_q2 + q3_q0);
  R.push(1 - sq_q1 - sq_q3);
  R.push(q2_q3 - q1_q0);
  R.push(0.0);
  R.push(q1_q3 - q2_q0);
  R.push(q2_q3 + q1_q0);
  R.push(1 - sq_q1 - sq_q2);
  R.push(0.0);
  R.push(0.0);
  R.push(0.0);
  R.push(0.0);
  R.push(1.0);
  return R;
}

let audioElement = null;
let audioContext;
let audioSource;
let audioPanner;
let audioFilter;

function initializeAudio() {
  audioElement = document.getElementById('audio');

  audioElement.addEventListener('play', handlePlay);

  audioElement.addEventListener('pause', handlePause);
}

function handlePlay() {
  console.log('play');
  if (!audioContext) {
    audioContext = new AudioContext();
    audioSource = audioContext.createMediaElementSource(audioElement);
    audioPanner = audioContext.createPanner();
    audioFilter = audioContext.createBiquadFilter();

    // Connect audio nodes
    audioSource.connect(audioPanner);
    audioPanner.connect(audioFilter);
    audioFilter.connect(audioContext.destination);

    // Set filter parameters
    audioFilter.type = 'highpass';
    audioFilter.Q.value = 1;
    audioFilter.frequency.value = 1055;
    audioFilter.gain.value = 15;

    audioContext.resume();
  }
}

function handlePause() {
  console.log('pause');
  audioContext.resume();
}

function toggleFilter() {
  let filterCheckbox = document.getElementById('filterCheckbox');
  if (filterCheckbox.checked) {
    // Connect filter when checkbox is checked
    audioPanner.disconnect();
    audioPanner.connect(audioFilter);
    audioFilter.connect(audioContext.destination);
  } else {
    // Disconnect filter when checkbox is unchecked
    audioPanner.disconnect();
    audioPanner.connect(audioContext.destination);
  }
}

function startAudio() {
  initializeAudio();

  let filterCheckbox = document.getElementById('filterCheckbox');
  filterCheckbox.addEventListener('change', toggleFilter);

  audioElement.play();
}

function getVector(alpha, beta, gamma) {
  const alphaRad = alpha;
  const betaRad = beta;
  const gammaRad = gamma;

  // Define the initial vector along the x-axis
  let v = [0, 0, 1];

  // Rotation around the z-axis (gamma)
  const rotZ = [
    [Math.cos(gammaRad), -Math.sin(gammaRad), 0],
    [Math.sin(gammaRad), Math.cos(gammaRad), 0],
    [0, 0, 1]
  ];
  v = matXvec(rotZ, v);

  // Rotation around the y-axis (beta)
  const rotY = [
    [Math.cos(betaRad), 0, Math.sin(betaRad)],
    [0, 1, 0],
    [-Math.sin(betaRad), 0, Math.cos(betaRad)]
  ];
  v = matXvec(rotY, v);

  // Rotation around the x-axis (alpha)
  const rotX = [
    [1, 0, 0],
    [0, Math.cos(alphaRad), -Math.sin(alphaRad)],
    [0, Math.sin(alphaRad), Math.cos(alphaRad)]
  ];
  v = matXvec(rotX, v);

  return v;
}

function matXvec(m, v) {
  const dst = [];
  for (let i = 0; i < m.length; i++) {
    let sum = 0;
    for (let j = 0; j < v.length; j++) {
      sum += m[i][j] * v[j];
    }
    dst.push(sum);
  }
  return dst;
}