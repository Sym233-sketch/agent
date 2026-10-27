'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'titanium', 'scene-navigation.js'), 'utf8');
const loaded = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('repeated extreme drags rotate exhibits through full turns without moving the camera', async () => {
  const { SceneNavigation, ROTATION_LIMITS: limits, cameraPose } = await loaded;
  const navigation = new SceneNavigation();
  const initialCamera = cameraPose(22);
  let reachedReverseSide = false;
  for (const sign of [1, -1]) {
    navigation.begin(1, 0, 0);
    for (let i = 1; i <= 1000; i++) {
      navigation.move(1, sign * i * 20000, sign * i * 12000);
      reachedReverseSide ||= Math.abs(navigation.yaw) > 2;
      assert.ok(Math.abs(navigation.yaw) <= Math.PI);
      assert.ok(Math.abs(navigation.pitch) <= limits.tilt);
      assert.deepEqual(cameraPose(22), initialCamera, 'drag cannot alter the camera');
    }
    assert.equal(navigation.end(1).suppressClick, true);
  }
  assert.equal(reachedReverseSide, true, 'the modules can turn freely rather than hitting a camera boundary');
});

test('a jump in pointer coordinates is capped rather than teleporting the collection', async () => {
  const { SceneNavigation } = await loaded;
  const navigation = new SceneNavigation();
  navigation.begin(7, 20, 20); navigation.move(7, 10000000, -10000000);
  assert.ok(Math.abs(navigation.yaw) < .30);
  assert.ok(Math.abs(navigation.pitch) < .12);
});

test('losing the mouse button ends the gesture, suppresses its click and permits a fresh drag', async () => {
  const { SceneNavigation } = await loaded;
  const navigation = new SceneNavigation();
  navigation.begin(4, 100, 100); navigation.move(4, 140, 120);
  const before = navigation.yaw;
  const result = navigation.move(4, 1500, 120, 0, 'mouse');
  assert.equal(result.ended.cancelled, true);
  assert.equal(result.ended.suppressClick, true);
  assert.equal(navigation.drag, null);
  assert.equal(navigation.yaw, before);
  assert.equal(navigation.begin(9, -1000, -1000), true);
  navigation.move(9, -1000, -1000);
  assert.equal(navigation.yaw, before);
});

test('cancellation and duplicate release are idempotent; another pointer cannot hijack the gesture', async () => {
  const { SceneNavigation } = await loaded;
  const navigation = new SceneNavigation();
  navigation.begin(1, 10, 10);
  assert.equal(navigation.begin(2, 500, 500), false);
  assert.equal(navigation.move(2, 800, 900), null);
  assert.equal(navigation.end(2), null);
  assert.equal(navigation.drag.pointerId, 1);
  assert.equal(navigation.cancel().suppressClick, true);
  assert.equal(navigation.end(1), null);
  assert.equal(navigation.cancel(), null);
  assert.equal(navigation.begin(3, 0, 0), true);
});

test('a regular click stays a click while dragging and cancellation suppress activation', async () => {
  const { SceneNavigation } = await loaded;
  const navigation = new SceneNavigation();
  navigation.begin(1, 10, 10); navigation.move(1, 12, 12);
  assert.equal(navigation.end(1).suppressClick, false);
  navigation.begin(1, 10, 10); navigation.move(1, 40, 10);
  assert.equal(navigation.end(1).suppressClick, true);
  navigation.begin(1, 10, 10);
  assert.equal(navigation.cancel().suppressClick, true);
});

test('mobile resizing limits tilt while camera distance remains safe and independent of rotation', async () => {
  const { SceneNavigation, ROTATION_LIMITS: limits, cameraPose } = await loaded;
  const navigation = new SceneNavigation();
  navigation.begin(1, 0, 0);
  for (let i = 1; i < 20; i++) navigation.move(1, i * 100, i * 100);
  navigation.setMobile(true);
  assert.ok(Math.abs(navigation.pitch) <= limits.mobileTilt);
  const pose = cameraPose(-200);
  assert.equal(pose.x, 0);
  assert.ok(pose.z >= limits.minDistance);
  assert.ok([pose.x, pose.y, pose.z].every(Number.isFinite));
  const missing = cameraPose(NaN);
  assert.ok([missing.x, missing.y, missing.z].every(Number.isFinite));
  navigation.cancel(); navigation.begin(2, 100, 100);
  assert.equal(navigation.move(2, 140, 150, 0, 'touch').moved, true);
  assert.equal(navigation.end(2).suppressClick, true);
});

test('invalid pointer data cannot poison subsequent module rotation', async () => {
  const { SceneNavigation } = await loaded;
  const navigation = new SceneNavigation();
  assert.equal(navigation.begin(1, NaN, 0), false);
  navigation.begin(1, 0, 0);
  assert.equal(navigation.move(1, Infinity, 0).ended.cancelled, true);
  navigation.reset();
  assert.equal(navigation.yaw, 0);
  assert.equal(navigation.pitch, 0);
  assert.equal(navigation.drag, null);
});

test('rotation crosses the full-turn seam along the short path without snapping backwards', async () => {
  const { wrapAngle, angleDelta } = await loaded;
  assert.ok(Math.abs(angleDelta(Math.PI - .01, -Math.PI + .01) - .02) < 1e-10);
  assert.ok(Math.abs(angleDelta(-Math.PI + .01, Math.PI - .01) + .02) < 1e-10);
  assert.ok(Math.abs(wrapAngle(Math.PI * 200 + .2) - .2) < 1e-10);
  assert.equal(wrapAngle(NaN), 0);
});
