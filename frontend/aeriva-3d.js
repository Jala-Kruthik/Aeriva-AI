/* ==========================================================================
   AERIVA AI — 3D WEBGL ENGINE
   Three.js scenes for auth, dashboard vitals, and trainer depth.
   Single shared renderer. Graceful fallback to flat layout.
   ========================================================================== */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // CAPABILITY DETECTION
    // -----------------------------------------------------------------------
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function hasWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch {
            return false;
        }
    }

    function isLowEndDevice() {
        const mem = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        return mem <= 2 || cores <= 2;
    }

    const webglSupported = hasWebGL();
    const lowEnd = isLowEndDevice();
    let THREE = window.THREE;

    function checkReady() {
        if (!THREE) THREE = window.THREE;
        if (!THREE || !webglSupported || prefersReducedMotion) {
            console.log(`[AERIVA 3D] Disabled — THREE: ${!!THREE}, WebGL: ${webglSupported}, ReducedMotion: ${prefersReducedMotion}`);
            document.documentElement.classList.add('no-webgl');
            return false;
        }
        if (lowEnd) {
            console.log('[AERIVA 3D] Low-end device detected — simplified 3D');
            document.documentElement.classList.add('low-end-3d');
        }
        return true;
    }

    // -----------------------------------------------------------------------
    // SHARED RENDERER
    // -----------------------------------------------------------------------
    let sharedRenderer = null;
    const scenes = new Map(); // id -> { scene, camera, container, animate, cleanup }
    let animationFrameId = null;
    let isPageVisible = true;

    function getRenderer() {
        if (!sharedRenderer) {
            sharedRenderer = new THREE.WebGLRenderer({
                antialias: !lowEnd,
                alpha: true,
                powerPreference: lowEnd ? 'low-power' : 'default',
            });
            sharedRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            sharedRenderer.setClearColor(0x000000, 0);
            sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        return sharedRenderer;
    }

    // Page visibility — pause when hidden
    document.addEventListener('visibilitychange', () => {
        isPageVisible = !document.hidden;
    });

    // -----------------------------------------------------------------------
    // RENDER LOOP
    // -----------------------------------------------------------------------
    const clock = new THREE.Clock();

    function renderLoop() {
        animationFrameId = requestAnimationFrame(renderLoop);
        if (!isPageVisible) return;

        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();
        const renderer = getRenderer();

        scenes.forEach((sceneData, id) => {
            const { scene, camera, container, animate } = sceneData;
            if (!container || !container.isConnected) return;

            // Check if container is in viewport
            const rect = container.getBoundingClientRect();
            const inView = rect.bottom > 0 && rect.top < window.innerHeight &&
                           rect.right > 0 && rect.left < window.innerWidth;
            if (!inView) return;

            // Update size
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w === 0 || h === 0) return;

            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();

            // Run per-scene animation
            if (animate) animate(elapsed, delta);

            renderer.render(scene, camera);

            // Copy to the container's canvas
            let targetCanvas = container.querySelector('canvas');
            if (!targetCanvas) {
                targetCanvas = document.createElement('canvas');
                container.appendChild(targetCanvas);
            }
            targetCanvas.width = renderer.domElement.width;
            targetCanvas.height = renderer.domElement.height;
            targetCanvas.style.width = '100%';
            targetCanvas.style.height = '100%';
            const ctx = targetCanvas.getContext('2d');
            ctx.drawImage(renderer.domElement, 0, 0);
        });
    }

    function startRenderLoop() {
        if (!animationFrameId) {
            renderLoop();
        }
    }

    // -----------------------------------------------------------------------
    // PALETTE COLORS (matching design tokens)
    // -----------------------------------------------------------------------
    const COLORS = {
        ink: 0x0B0B0F,
        paper: 0xF4F1EA,
        volt: 0xC6FF00,
        flare: 0xFF4D2E,
        electric: 0x2B3BFF,
        sun: 0xFFC400,
        mint: 0x00D1A0,
        pink: 0xFF7AC6,
        white: 0xFFFFFF,
    };

    // -----------------------------------------------------------------------
    // HELPER: TOON MATERIAL
    // -----------------------------------------------------------------------
    function createToonMaterial(color) {
        return new THREE.MeshToonMaterial({
            color: color,
            side: THREE.FrontSide,
        });
    }

    // -----------------------------------------------------------------------
    // AUTH SCENE: Floating 3D objects behind "WIN YOUR DAY."
    // -----------------------------------------------------------------------
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function createAuthScene() {
        const container = document.querySelector('.stage-hero-content');
        if (!container) return;

        // Create scene container div
        const sceneDiv = document.createElement('div');
        sceneDiv.className = 'aeriva-3d-scene';
        sceneDiv.id = 'auth3dScene';
        container.style.position = 'relative';
        container.insertBefore(sceneDiv, container.firstChild);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 8);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(3, 5, 5);
        scene.add(dirLight);

        // Floating objects
        const objects = [];

        // Dumbbell (simplified: cylinder + 2 spheres)
        const dumbbellGroup = new THREE.Group();
        const barGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8);
        const bar = new THREE.Mesh(barGeom, createToonMaterial(COLORS.ink));
        bar.rotation.z = Math.PI / 2;
        dumbbellGroup.add(bar);

        const weightGeom = new THREE.SphereGeometry(0.22, 12, 8);
        const w1 = new THREE.Mesh(weightGeom, createToonMaterial(COLORS.flare));
        w1.position.x = -0.5;
        const w2 = new THREE.Mesh(weightGeom, createToonMaterial(COLORS.flare));
        w2.position.x = 0.5;
        dumbbellGroup.add(w1, w2);
        dumbbellGroup.position.set(-2, 1.5, 0);
        scene.add(dumbbellGroup);
        objects.push({ mesh: dumbbellGroup, basePos: dumbbellGroup.position.clone(), speed: 0.7, amplitude: 0.3 });

        // Water drop (sphere + cone)
        const dropGroup = new THREE.Group();
        const dropSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 12),
            createToonMaterial(COLORS.electric)
        );
        dropSphere.position.y = -0.1;
        const dropCone = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.3, 8),
            createToonMaterial(COLORS.electric)
        );
        dropCone.position.y = 0.25;
        dropGroup.add(dropSphere, dropCone);
        dropGroup.position.set(2.2, 0.5, -1);
        scene.add(dropGroup);
        objects.push({ mesh: dropGroup, basePos: dropGroup.position.clone(), speed: 0.9, amplitude: 0.4 });

        // Apple (sphere + small cylinder stem)
        const appleGroup = new THREE.Group();
        const appleSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 12),
            createToonMaterial(COLORS.mint)
        );
        const appleStem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6),
            createToonMaterial(COLORS.ink)
        );
        appleStem.position.y = 0.33;
        appleGroup.add(appleSphere, appleStem);
        appleGroup.position.set(-1.5, -1.2, 0.5);
        scene.add(appleGroup);
        objects.push({ mesh: appleGroup, basePos: appleGroup.position.clone(), speed: 1.1, amplitude: 0.25 });

        // Shield (flat octagon)
        const shieldShape = new THREE.Shape();
        const shieldPts = 6;
        for (let i = 0; i < shieldPts; i++) {
            const angle = (i / shieldPts) * Math.PI * 2 - Math.PI / 2;
            const r = 0.35;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r * 1.1;
            if (i === 0) shieldShape.moveTo(x, y);
            else shieldShape.lineTo(x, y);
        }
        shieldShape.closePath();
        const shieldGeom = new THREE.ExtrudeGeometry(shieldShape, {
            depth: 0.08,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 2
        });
        const shield = new THREE.Mesh(shieldGeom, createToonMaterial(COLORS.sun));
        shield.position.set(1.8, -1.0, 0);
        scene.add(shield);
        objects.push({ mesh: shield, basePos: shield.position.clone(), speed: 0.6, amplitude: 0.35 });

        // Outline edges (ink stroke effect)
        objects.forEach(obj => {
            if (!lowEnd) {
                const edges = new THREE.EdgesGeometry(obj.mesh.children?.[0]?.geometry || obj.mesh.geometry, 20);
                const lineMat = new THREE.LineBasicMaterial({ color: COLORS.ink, linewidth: 1 });
                const wireframe = new THREE.LineSegments(edges, lineMat);
                obj.mesh.add(wireframe);
            }
        });

        // Animation
        function animate(elapsed) {
            objects.forEach(obj => {
                const { mesh, basePos, speed, amplitude } = obj;
                mesh.position.y = basePos.y + Math.sin(elapsed * speed) * amplitude;
                mesh.rotation.y = elapsed * speed * 0.5;
                mesh.rotation.x = Math.sin(elapsed * speed * 0.3) * 0.15;

                // Mouse parallax
                mesh.position.x = basePos.x + mouseX * 0.3;
                mesh.position.z = basePos.z + mouseY * 0.2;
            });
        }

        scenes.set('auth', { scene, camera, container: sceneDiv, animate });
        startRenderLoop();
    }

    // -----------------------------------------------------------------------
    // HEALTH SCORE: 3D Rotating Torus Gauge
    // -----------------------------------------------------------------------
    function createHealthScoreScene() {
        const card = document.querySelector('#healthRadial')?.closest('.vital-card');
        if (!card) return;

        const sceneDiv = document.createElement('div');
        sceneDiv.className = 'aeriva-3d-scene';
        sceneDiv.style.zIndex = '0';
        card.style.position = 'relative';
        card.classList.add('vital-card-3d-wrap');
        card.insertBefore(sceneDiv, card.firstChild);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
        camera.position.set(0, 0, 3.5);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
        dirLight.position.set(2, 3, 3);
        scene.add(dirLight);

        // Torus ring (health gauge)
        const torusGeom = new THREE.TorusGeometry(0.9, 0.12, 16, 64);
        const torus = new THREE.Mesh(torusGeom, createToonMaterial(COLORS.flare));
        scene.add(torus);

        // Filled portion (volt arc)
        const filledGeom = new THREE.TorusGeometry(0.9, 0.14, 16, 64, Math.PI * 1.2);
        const filled = new THREE.Mesh(filledGeom, createToonMaterial(COLORS.volt));
        filled.rotation.z = Math.PI / 2;
        scene.add(filled);

        function animate(elapsed) {
            torus.rotation.x = Math.sin(elapsed * 0.4) * 0.15 + 0.2;
            torus.rotation.y = elapsed * 0.3;
            filled.rotation.x = torus.rotation.x;
            filled.rotation.y = torus.rotation.y;

            // Update fill arc based on health value
            const healthEl = document.getElementById('healthValue');
            if (healthEl) {
                const val = parseInt(healthEl.textContent) || 0;
                const arc = (val / 100) * Math.PI * 2;
                filled.geometry.dispose();
                filled.geometry = new THREE.TorusGeometry(0.9, 0.14, 16, 64, Math.max(0.1, arc));
            }
        }

        scenes.set('healthScore', { scene, camera, container: sceneDiv, animate });
    }

    // -----------------------------------------------------------------------
    // WATER: 3D Liquid Wave Fill
    // -----------------------------------------------------------------------
    function createWaterScene() {
        const waterCard = document.querySelector('#waterText')?.closest('.vital-card');
        if (!waterCard) return;

        const sceneDiv = document.createElement('div');
        sceneDiv.className = 'aeriva-3d-scene';
        sceneDiv.style.zIndex = '0';
        waterCard.style.position = 'relative';
        waterCard.classList.add('vital-card-3d-wrap');
        waterCard.insertBefore(sceneDiv, waterCard.firstChild);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
        camera.position.set(0, 0, 3);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        // Water wave plane
        const waveGeom = new THREE.PlaneGeometry(3, 2, 32, 16);
        const waveMat = new THREE.MeshPhongMaterial({
            color: COLORS.electric,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
        });
        const wave = new THREE.Mesh(waveGeom, waveMat);
        wave.rotation.x = -Math.PI / 6;
        wave.position.y = -0.5;
        scene.add(wave);

        function animate(elapsed) {
            const positions = wave.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                positions.setZ(i, Math.sin(x * 2 + elapsed * 2) * 0.08 + Math.cos(y * 3 + elapsed * 1.5) * 0.05);
            }
            positions.needsUpdate = true;

            // Adjust wave height based on water intake
            const waterEl = document.getElementById('waterText');
            if (waterEl) {
                const liters = parseFloat(waterEl.textContent) || 0;
                const fill = Math.min(liters / 2.5, 1); // 2.5L target
                wave.position.y = -1 + fill * 1.5;
            }
        }

        scenes.set('water', { scene, camera, container: sceneDiv, animate });
    }

    // -----------------------------------------------------------------------
    // INIT
    // -----------------------------------------------------------------------
    function init() {
        console.log('[AERIVA 3D] Initializing WebGL engine...');
        console.log(`  WebGL: ${webglSupported}, LowEnd: ${lowEnd}`);

        // Delay 3D init to not block first paint
        setTimeout(() => {
            if (!checkReady()) return;
            createAuthScene();

            if (!lowEnd) {
                createHealthScoreScene();
                createWaterScene();
            }

            startRenderLoop();
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        scenes.forEach(s => {
            if (s.cleanup) s.cleanup();
        });
        if (sharedRenderer) {
            sharedRenderer.dispose();
            sharedRenderer = null;
        }
    });

})();
