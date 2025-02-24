/**
 * @author alteredq / http://alteredqualia.com/
 * @author Lewy Blue https://github.com/looeee
 *
 * The model is expected to follow real world car proportions. You can try unusual car types
 * but your results may be unexpected. Scaled models are also not supported.
 *
 * Defaults are rough estimates for a real world scale car model
 *
 */

import {
	Box3,
	Group,
	Vector3,
	MathUtils,
  } from "three";

import * as THREE from 'three';
const _Math = THREE.MathUtils; // rename references to _Math as needed

// const _Math = THREE.MathUtils;

  
  var CarControls = (function () {
  
	// private variables
	var steeringWheelSpeed = 1.5;
	var maxSteeringRotation = 0.6;
  
	var acceleration = 0;
  
	var maxSpeedReverse, accelerationReverse, deceleration;
  
	var controlKeys = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, BRAKE: 32 };
  
	var wheelOrientation = 0;
	var carOrientation = 0;
  
	var root = null;
  
	var frontLeftWheelRoot = null;
	var frontRightWheelRoot = null;
  
	var frontLeftWheel = new Group();
	var frontRightWheel = new Group();
	var backLeftWheel = null;
	var backRightWheel = null;
  
	var steeringWheel = null;
  
	var wheelDiameter = 1;
	var length = 1;
  
	var loaded = false;
  
	var controls = {
	  brake: false,
	  moveForward: false,
	  moveBackward: false,
	  moveLeft: false,
	  moveRight: false
	};
  
	function CarControls(maxSpeed, acceleration, brakePower, turningRadius, keys) {
	  this.moveForward = false;
	  this.moveBackward = false;
	  this.moveLeft = false;
	  this.moveRight = false;
	  this.brake = false;
  
	  this.enabled = true;
	  this.elemNames = {
		flWheel: 'wheel_fl',
		frWheel: 'wheel_fr',
		rlWheel: 'wheel_rl',
		rrWheel: 'wheel_rr',
		steeringWheel: 'steering_wheel', // set to null to disable
	  };
  
	  // km/hr
	  this.maxSpeed = maxSpeed || 180;
	  maxSpeedReverse = -this.maxSpeed * 0.25;
  
	  // m/s
	  this.acceleration = acceleration || 10;
	  accelerationReverse = this.acceleration * 0.5;
  
	  // metres
	  this.turningRadius = turningRadius || 6;
  
	  // m/s
	  deceleration = this.acceleration * 2;
  
	  // multiplied with deceleration, so breaking deceleration = (acceleration * 2 * brakePower) m/s
	  this.brakePower = brakePower || 10;
  
	  // exposed so that a user can use this for various effect, e.g blur
	  this.speed = 0;
  
	  // keys used to control car - by default the arrow keys and space to brake
	  this.controlKeys = keys || {
		UP: 38, // ArrowUp
		DOWN: 40, // ArrowDown
		LEFT: 37, // ArrowLeft
		RIGHT: 39, // ArrowRight
		BRAKE: 32, // Space
	  };
  
	  // local axes of rotation - these are likely to vary between models
	  this.wheelRotationAxis = 'x';
	  this.wheelTurnAxis = 'z';
	  this.steeringWheelTurnAxis = 'y';
  
	  this.onKeyDown = this.onKeyDown.bind(this);
	  this.onKeyUp = this.onKeyUp.bind(this);
  
	  document.addEventListener('keydown', this.onKeyDown, false);
	  document.addEventListener('keyup', this.onKeyUp, false);
	}
  
	CarControls.prototype = {
	  constructor: CarControls,
  
	  onKeyDown: function (event) {
		switch (event.keyCode) {
		  case this.controlKeys.BRAKE:
			this.brake = true;
			this.moveForward = false;
			this.moveBackward = false;
			break;
		  case this.controlKeys.UP:
			this.moveForward = true;
			break;
		  case this.controlKeys.DOWN:
			this.moveBackward = true;
			break;
		  case this.controlKeys.LEFT:
			this.moveLeft = true;
			break;
		  case this.controlKeys.RIGHT:
			this.moveRight = true;
			break;
		}
	  },
  
	  onKeyUp: function (event) {
		switch (event.keyCode) {
		  case this.controlKeys.BRAKE:
			this.brake = false;
			break;
		  case this.controlKeys.UP:
			this.moveForward = false;
			break;
		  case this.controlKeys.DOWN:
			this.moveBackward = false;
			break;
		  case this.controlKeys.LEFT:
			this.moveLeft = false;
			break;
		  case this.controlKeys.RIGHT:
			this.moveRight = false;
			break;
		}
	  },
  
	  dispose: function () {
		document.removeEventListener('keydown', this.onKeyDown, false);
		document.removeEventListener('keyup', this.onKeyUp, false);
	  },
  
	  update: function (delta) {
		if (!loaded || !this.enabled) return;
  
		var brakingDeceleration = 1;
  
		if (this.brake) brakingDeceleration = this.brakePower;
  
		if (this.moveForward) {
		  this.speed = _Math.clamp(this.speed + delta * this.acceleration, maxSpeedReverse, this.maxSpeed);
		  acceleration = _Math.clamp(acceleration + delta, -1, 1);
		}
  
		if (this.moveBackward) {
		  this.speed = _Math.clamp(this.speed - delta * accelerationReverse, maxSpeedReverse, this.maxSpeed);
		  acceleration = _Math.clamp(acceleration - delta, -1, 1);
		}
  
		if (this.moveLeft) {
		  wheelOrientation = _Math.clamp(wheelOrientation + delta * steeringWheelSpeed, -maxSteeringRotation, maxSteeringRotation);
		}
  
		if (this.moveRight) {
		  wheelOrientation = _Math.clamp(wheelOrientation - delta * steeringWheelSpeed, -maxSteeringRotation, maxSteeringRotation);
		}
  
		// this.speed decay
		if (!(this.moveForward || this.moveBackward)) {
		  if (this.speed > 0) {
			var k = exponentialEaseOut(this.speed / this.maxSpeed);
  
			this.speed = _Math.clamp(this.speed - k * delta * deceleration * brakingDeceleration, 0, this.maxSpeed);
			acceleration = _Math.clamp(acceleration - k * delta, 0, 1);
		  } else {
			var k = exponentialEaseOut(this.speed / maxSpeedReverse);
  
			this.speed = _Math.clamp(this.speed + k * delta * accelerationReverse * brakingDeceleration, maxSpeedReverse, 0);
			acceleration = _Math.clamp(acceleration + k * delta, -1, 0);
		  }
		}
  
		// steering decay
		if (!(this.moveLeft || this.moveRight)) {
		  if (wheelOrientation > 0) {
			wheelOrientation = _Math.clamp(wheelOrientation - delta * steeringWheelSpeed, 0, maxSteeringRotation);
		  } else {
			wheelOrientation = _Math.clamp(wheelOrientation + delta * steeringWheelSpeed, -maxSteeringRotation, 0);
		  }
		}
  
		var forwardDelta = -this.speed * delta;
  
		carOrientation -= (forwardDelta * this.turningRadius * 0.02) * wheelOrientation;
  
		// movement of car
		root.position.x += Math.sin(carOrientation) * forwardDelta * length;
		root.position.z += Math.cos(carOrientation) * forwardDelta * length;
  
		// angle of car
		root.rotation.y = carOrientation;
  
		// wheels rolling
		var angularSpeedRatio = -2 / wheelDiameter;
  
		var wheelDelta = forwardDelta * angularSpeedRatio * length;
  
		frontLeftWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
		frontRightWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
		backLeftWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
		backRightWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
  
		// rotation while steering
		frontLeftWheelRoot.rotation[this.wheelTurnAxis] = wheelOrientation;
		frontRightWheelRoot.rotation[this.wheelTurnAxis] = wheelOrientation;
  
		steeringWheel.rotation[this.steeringWheelTurnAxis] = -wheelOrientation * 6;
	  },
  
	  setModel: function (model, elemNames) {
		if (elemNames) this.elemNames = elemNames;
  
		root = model;
  
		this.setupWheels();
		this.computeDimensions();
  
		loaded = true;
	  },
  
	  setupWheels: function () {
		frontLeftWheelRoot = root.getObjectByName(this.elemNames.flWheel);
		frontRightWheelRoot = root.getObjectByName(this.elemNames.frWheel);
		backLeftWheel = root.getObjectByName(this.elemNames.rlWheel);
		backRightWheel = root.getObjectByName(this.elemNames.rrWheel);
  
		if (this.elemNames.steeringWheel !== null) steeringWheel = root.getObjectByName(this.elemNames.steeringWheel);
  
		while (frontLeftWheelRoot.children.length > 0) frontLeftWheel.add(frontLeftWheelRoot.children[0]);
		while (frontRightWheelRoot.children.length > 0) frontRightWheel.add(frontRightWheelRoot.children[0]);
  
		frontLeftWheelRoot.add(frontLeftWheel);
		frontRightWheelRoot.add(frontRightWheel);
	  },
  
	  computeDimensions: function () {
		var bb = new Box3().setFromObject(frontLeftWheelRoot);
  
		var size = new Vector3();
		bb.getSize(size);
  
		wheelDiameter = Math.max(size.x, size.y, size.z);
  
		bb.setFromObject(root);
  
		size = bb.getSize(size);
		length = Math.max(size.x, size.y, size.z);
	  }
	};
  
	CarControls.prototype.getAcceleration = function () {
	  // Convert speed to m/s (assuming speed is in km/h)
	  const speedMS = this.speed * (1000 / 3600);
  
	  // Calculate forward/backward acceleration
	  const forwardAccel = acceleration * this.acceleration;
  
	  // Calculate lateral acceleration using centripetal formula
	  const lateralAccel = Math.abs(wheelOrientation) * (speedMS * speedMS) / this.turningRadius;
  
	  // 1. Add suspension dynamics (vertical acceleration)
	  const suspensionStiffness = 0.15;
	  const dampingFactor = 0.1;
	  const timeConstant = 0.1; // Smoothing factor
  
	  // Base vertical acceleration from bumps (simulated with speed-based noise)
	  const bumpIntensity = Math.min(0.3 * Math.abs(speedMS), 2.0);
	  const bump = Math.sin(Date.now() * 0.002) * bumpIntensity;
  
	  // 2. Weight transfer effects
	  const pitchAccel = -forwardAccel * 0.12; // Pitch during acceleration/braking
	  const rollAccel = lateralAccel * 0.18; // Roll during turning
  
	  // 3. Combine effects with smoothing
	  const verticalAccel = (bump + pitchAccel + rollAccel) * suspensionStiffness;
  
	  // Apply damping and store for next frame
	  this._lastVerticalAccel = this._lastVerticalAccel || 0;
	  const finalY = _Math.lerp(this._lastVerticalAccel, verticalAccel, timeConstant);
	  this._lastVerticalAccel = finalY * (1 - dampingFactor);
  
	  return {
		x: lateralAccel * Math.cos(carOrientation), // Lateral
		y: finalY, // Vertical
		z: forwardAccel // Longitudinal
	  };
	};
  
	function exponentialEaseOut(k) {
	  return k === 1 ? 1 : -Math.pow(2, -10 * k) + 1;
	}
  
	return CarControls;
  
  })();
  
  export { CarControls };