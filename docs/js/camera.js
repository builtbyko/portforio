import * as THREE from "../vendor/three.module.js";
import { CONFIG } from "./config.js";

function safeBounds(bounds) {
  if (bounds && !bounds.isEmpty()) return bounds;
  const half = CONFIG.model.defaultExtent * 0.5;
  return new THREE.Box3(new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 15, half));
}

export function createFixedCamera() {
  return new THREE.PerspectiveCamera(CONFIG.camera.desktopFov, 1, 0.1, 3000);
}

export function frameFixedCamera(camera, sourceBounds, viewport, sequence, descentFocus) {
  const bounds = safeBounds(sourceBounds);
  // 1 is the finished Phase 2 framing; earlier in the act the camera sits
  // further back and a little higher, and closes in as the city forms.
  const advance = sequence ? THREE.MathUtils.clamp(sequence.cameraT, 0, 1) : 1;
  // Act 2: swing round until the ground is edge-on, then pull back to take in
  // the whole stack once the layers have parted.
  const toSide = sequence ? THREE.MathUtils.clamp(sequence.sideT ?? 0, 0, 1) : 0;
  const parted = sequence ? THREE.MathUtils.clamp(sequence.strataT ?? 0, 0, 1) : 0;
  // Act 3: close on the opening, then go under and settle near the traced
  // line with the city left overhead.
  const opened = sequence ? THREE.MathUtils.clamp(sequence.crackT ?? 0, 0, 1) : 0;
  const below = sequence ? THREE.MathUtils.clamp(sequence.descentT ?? 0, 0, 1) : 0;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const aspect = Math.max(0.1, viewport.width / Math.max(1, viewport.height));
  const portrait = aspect < 0.82;

  camera.fov = portrait ? CONFIG.camera.mobileFov : CONFIG.camera.desktopFov;
  camera.aspect = aspect;

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * aspect);
  const footprint = Math.max(20, Math.hypot(size.x, size.z));
  const framedWidth = portrait
    ? Math.max(size.x, size.z) * CONFIG.camera.portraitCrop
    : footprint;
  const modelHeight = Math.max(8, size.y);
  const widthDistance = framedWidth / (2 * Math.tan(Math.max(0.1, horizontalFov) * 0.5));
  const heightDistance = (modelHeight + footprint * 0.34) / (2 * Math.tan(verticalFov * 0.5));
  const padding = portrait ? CONFIG.camera.portraitPadding : CONFIG.camera.desktopPadding;
  // Fog sets a hard ceiling on how far the camera can usefully retreat: past it
  // the model is more haze than city. Near-square viewports would otherwise
  // need a distance that frames the whole footprint but shows almost nothing,
  // so the fit is sacrificed and the city is allowed to run off-frame instead.
  const fogLimit = CONFIG.camera.fogVisibilityLimit / CONFIG.scene.fogDensity;
  const pullBack = THREE.MathUtils.lerp(CONFIG.sequence.startDistanceScale, 1, advance);
  // The ceiling is applied after the pull-back, so no point in the act can put
  // the camera somewhere the city cannot be seen from.
  const strataPull = THREE.MathUtils.lerp(1, CONFIG.camera.strataDistanceScale, parted);
  // Closing on the opening, then going under, both mean getting much nearer
  // than any framing of the whole model.
  // Close on the opening, then hold enough distance underneath that the city
  // still reads as a ceiling rather than leaving the frame entirely.
  // The eye has to end up between the underside of the city and the traced
  // line: too far back and the rising angle puts it above ground again, too
  // near and the line fills the frame as a flat band.
  const approach = THREE.MathUtils.lerp(1, 0.66, opened) * THREE.MathUtils.lerp(1, 0.54, below);
  const distance = Math.min(
    Math.max(widthDistance, heightDistance) * padding * pullBack * strataPull,
    fogLimit,
  ) * approach;

  // Once the layers part, the subject reaches below the ground, so the camera
  // looks down the stack rather than at the surface alone.
  // Stage 7 looks for the opening, which is in the surface, so the gaze comes
  // back up out of the stack before it goes under.
  const stackDrop = (CONFIG.strata.pastDrop * CONFIG.camera.strataTargetDrop)
    * parted
    * THREE.MathUtils.lerp(1, 0.12, opened);
  // Act 3 keeps dropping until the traced line is the subject and the surface
  // has become a ceiling.
  const underDrop = CONFIG.strata.pastDrop * CONFIG.descent.cameraDrop * below;
  const target = new THREE.Vector3(
    center.x,
    bounds.min.y + modelHeight * CONFIG.camera.targetHeightRatio - stackDrop - underDrop,
    center.z,
  );
  // Drift towards where a traced line actually runs as the descent goes on.
  if (descentFocus && below > 0) {
    target.x = THREE.MathUtils.lerp(target.x, descentFocus.x, below);
    target.z = THREE.MathUtils.lerp(target.z, descentFocus.z, below);
  }
  const heightLift = THREE.MathUtils.lerp(CONFIG.sequence.startHeightScale, 1, advance);
  const rawDirection = new THREE.Vector3(...CONFIG.camera.direction);
  rawDirection.y *= heightLift;
  // Rotating towards the side view is a lerp between two fixed directions, so
  // the path never reverses and never passes through the model.
  const sideDirection = new THREE.Vector3(...CONFIG.camera.sideDirection);
  const direction = rawDirection.normalize().lerp(sideDirection.normalize(), toSide).normalize();
  // Rise over the opening to look down into it, then settle just above the
  // traced line. The line is a flat ribbon with no thickness, so an eye level
  // with it sees nothing at all; the shot has to keep looking down on it.
  direction.y = THREE.MathUtils.lerp(direction.y, 0.74, opened);
  direction.y = THREE.MathUtils.lerp(direction.y, 0.3, below);
  direction.normalize();
  if (!portrait) {
    const forward = direction.clone().negate();
    const cameraRight = forward.cross(camera.up).normalize();
    target.addScaledVector(
      cameraRight,
      -footprint * CONFIG.camera.desktopHorizontalShift,
    );
  }
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.near = Math.max(0.1, distance / 1500);
  camera.far = Math.max(1500, distance + footprint * 5);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.userData.fixedTarget = target;
  return camera;
}
