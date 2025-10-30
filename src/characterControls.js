import * as THREE from 'three';

export class CharacterControls {
    model;
    mixer;
    animationsMap = new Map();
    orbitControl;
    camera;
    footStep; // <-- Renamed this property

    toggleRun = true;
    currentAction;

    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuaternion = new THREE.Quaternion();
    baseOrientation = new THREE.Quaternion();
    cameraTarget = new THREE.Vector3();

    fadeDuration = 0.2;
    runVelocity = 10;
    walkVelocity = 4;

    // <-- FIX 1: Added 'footStep' as a parameter
    constructor(model, mixer, animationsMap, orbitControl, camera, currentAction, footStep, upAxis = 'Y', forwardOffsetRadians = 0) {
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;
        this.footStep = footStep; // <-- FIX 2: Assign the sound here

        this.animationsMap.forEach((value, key) => {
            if (key === currentAction) value.play();
        });

        this.orbitControl = orbitControl;
        this.camera = camera;
        this.upAxis = upAxis;
        this.modelForwardOffsetRadians = forwardOffsetRadians;
        this.rotateAngle = (this.upAxis === 'Z')
            ? new THREE.Vector3(0, 0, 1)
            : new THREE.Vector3(0, 1, 0);

        this.baseOrientation.copy(this.model.quaternion);
        this.updateCameraTarget(0, 0);

        // Add first-person mode flag
        this.isFirstPerson = false;
        // Removed 'this.foosteps = this.foosteps;'
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

        // <-- FIX 3: Re-added the audio logic block
        if (this.footStep) {
            const isMoving = this.currentAction === 'Walk' || this.currentAction === 'Run';
            
            if (isMoving && !this.footStep.isPlaying) {
                this.footStep.play();
            } else if (!isMoving && this.footStep.isPlaying) {
                this.footStep.stop();
            }
        }

        this.mixer.update(delta);

        // movement
        if (this.currentAction === 'Run' || this.currentAction === 'Walk') {

            const directionOffset = this.directionOffset(keysPressed);
            const velocity = this.currentAction === 'Run' ? this.runVelocity : this.walkVelocity;

            // ========== THIRD PERSON ==========
            if (!this.isFirstPerson) {

                const dx = this.camera.position.x - this.model.position.x;
                const dzOrDy = this.upAxis === 'Z'
                    ? (this.camera.position.y - this.model.position.y)
                    : (this.camera.position.z - this.model.position.z);
                const angleYCameraDirection = Math.atan2(dx, dzOrDy);

                const yawQuat = new THREE.Quaternion()
                    .setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset + this.modelForwardOffsetRadians);
                const targetQuat = new THREE.Quaternion().copy(yawQuat).multiply(this.baseOrientation);
                this.model.quaternion.rotateTowards(targetQuat, 0.2);

                // Move along camera forward direction
                this.camera.getWorldDirection(this.walkDirection);
                if (this.upAxis === 'Z') this.walkDirection.z = 0;
                else this.walkDirection.y = 0;
                this.walkDirection.normalize();
                this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

                const moveX = this.walkDirection.x * velocity * delta;
                const moveT = (this.upAxis === 'Z' ? this.walkDirection.y : this.walkDirection.z) * velocity * delta;
                this.model.position.x += moveX;
                if (this.upAxis === 'Z') this.model.position.y += moveT; else this.model.position.z += moveT;

                this.updateCameraTarget(moveX, moveT);
            }

            // ========== FIRST PERSON ==========
            else {
        _         // ... (rest of first-person logic is unchanged) ...
                const moveDir = new THREE.Vector3();
                this.camera.getWorldDirection(moveDir);

                if (this.upAxis === 'Z') moveDir.z = 0;
                else moveDir.y = 0;
                moveDir.normalize();

                const right = new THREE.Vector3();
                right.crossVectors(this.camera.up, moveDir).normalize();

                const finalDir = new THREE.Vector3();
                if (keysPressed['w']) finalDir.add(moveDir);
                if (keysPressed['s']) finalDir.sub(moveDir);
                if (keysPressed['a']) finalDir.add(right);
                if (keysPressed['d']) finalDir.sub(right);
                finalDir.normalize();

                this.model.position.addScaledVector(finalDir, velocity * delta);

                const euler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
                this.model.quaternion.setFromEuler(euler);
         }
        }
    }

    updateCameraTarget(moveX, moveT) {
// ... (this method is unchanged and correct) ...
        if (!this.isFirstPerson) {
            this.camera.position.x += moveX;
            if (this.upAxis === 'Z') this.camera.position.y += moveT;
            else this.camera.position.z += moveT;

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
    }

    setFirstPersonMode(isFirstPerson) {
        this.isFirstPerson = isFirstPerson;
    }

    directionOffset(keysPressed) {
        // ... (this method is unchanged and correct) ...
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