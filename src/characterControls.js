import * as THREE from 'three';

export class CharacterControls {

    model;
    mixer;
    animationsMap = new Map(); // Walk, Run, Idle
    orbitControl;
    camera;

    toggleRun = true;
    currentAction;

    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuarternion = new THREE.Quaternion();
    baseOrientation = new THREE.Quaternion();
    cameraTarget = new THREE.Vector3();

    fadeDuration = 0.2;
    runVelocity = 10;
    walkVelocity = 4;

    constructor(model, mixer, animationsMap, orbitControl, camera, currentAction, upAxis = 'Y', forwardOffsetRadians = 0) {
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;

        this.animationsMap.forEach((value, key) => {
            if (key === currentAction) value.play();
        });

        this.orbitControl = orbitControl;
        this.camera = camera;
        this.upAxis = upAxis;
        this.modelForwardOffsetRadians = forwardOffsetRadians;
        // Ensure yaw rotation happens around the correct up axis and store base orientation
        this.rotateAngle = (this.upAxis === 'Z') ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        this.baseOrientation.copy(this.model.quaternion);
        this.updateCameraTarget(0, 0);
    }

    switchRunToggle() {
        this.toggleRun = !this.toggleRun;
    }

    update(delta, keysPressed) {
        const directionPressed = ['w', 'a', 's', 'd'].some(k => keysPressed[k] === true);

        let play = '';
        if (directionPressed && this.toggleRun) play = 'Run';
        else if (directionPressed) play = 'Walk';
        else play = 'Idle';

        if (this.currentAction !== play) {
            const toPlay = this.animationsMap.get(play);
            const current = this.animationsMap.get(this.currentAction);
            if (current && toPlay) {
                current.fadeOut(this.fadeDuration);
                toPlay.reset().fadeIn(this.fadeDuration).play();
            }
            this.currentAction = play;
        }

        this.mixer.update(delta);

        if (this.currentAction === 'Run' || this.currentAction === 'Walk') {
            const dx = this.camera.position.x - this.model.position.x;
            const dzOrDy = this.upAxis === 'Z' ?
                (this.camera.position.y - this.model.position.y) :
                (this.camera.position.z - this.model.position.z);
            const angleYCameraDirection = Math.atan2(dx, dzOrDy);

            const directionOffset = this.directionOffset(keysPressed);

            const yawQuat = new THREE.Quaternion().setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset + this.modelForwardOffsetRadians);
            const targetQuat = new THREE.Quaternion().copy(yawQuat).multiply(this.baseOrientation);
            this.model.quaternion.rotateTowards(targetQuat, 0.2);

            // Get camera forward projected onto ground plane (Z-up => XY plane)
            this.camera.getWorldDirection(this.walkDirection);
            if (this.upAxis === 'Z') {
                // Zero vertical component and renormalize
                this.walkDirection.z = 0;
            } else {
                this.walkDirection.y = 0;
            }
            this.walkDirection.normalize();
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

            const velocity = this.currentAction === 'Run' ? this.runVelocity : this.walkVelocity;

            const moveX = this.walkDirection.x * velocity * delta;
            const moveT = (this.upAxis === 'Z' ? this.walkDirection.y : this.walkDirection.z) * velocity * delta;
            this.model.position.x += moveX;
            if (this.upAxis === 'Z') this.model.position.y += moveT; else this.model.position.z += moveT;

            this.updateCameraTarget(moveX, moveT);
        }
    }

    updateCameraTarget(moveX, moveT) {
        this.camera.position.x += moveX;
        if (this.upAxis === 'Z') this.camera.position.y += moveT; else this.camera.position.z += moveT;

        this.cameraTarget.x = this.model.position.x;
        if (this.upAxis === 'Z') {
            this.cameraTarget.y = this.model.position.y;
            this.cameraTarget.z = this.model.position.z + 1.6;
        } else {
            this.cameraTarget.y = this.model.position.y + 1.6;
            this.cameraTarget.z = this.model.position.z;
        }
        this.orbitControl.target.copy(this.cameraTarget);
    }

    directionOffset(keysPressed) {
        let directionOffset = 0;

        if (keysPressed['w']) {
            if (keysPressed['a']) directionOffset = Math.PI / 4;
            else if (keysPressed['d']) directionOffset = -Math.PI / 4;
        } else if (keysPressed['s']) {
            if (keysPressed['a']) directionOffset = Math.PI / 4 + Math.PI / 2;
            else if (keysPressed['d']) directionOffset = -Math.PI / 4 - Math.PI / 2;
            else directionOffset = Math.PI;
        } else if (keysPressed['a']) directionOffset = Math.PI / 2;
        else if (keysPressed['d']) directionOffset = -Math.PI / 2;

        return directionOffset;
    }
}
