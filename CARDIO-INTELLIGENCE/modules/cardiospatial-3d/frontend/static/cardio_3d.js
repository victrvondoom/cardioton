/**
 * CARDIOSPATIAL-3D: Realistic Anatomical Human Heart & Multi-Vessel Coronary Visualizer
 * Real human pathophysiology rendering:
 * - Dynamic intra-luminal Thrombus / Plaque Blood Clot Mesh nodes
 * - True physiological blood flow stoppage / clotting physics downstream of occlusion
 * - Myocardial Ischemia & Infarction tissue discoloration (Cyan/Purple/Blackish Necrosis)
 * - Arrhythmic cardiac impulse during critical ischemic events (>85% Risk)
 */

class CardioVisualizer3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // 3D Hierarchies
        this.rootGroup = new THREE.Group();
        this.heartGroup = new THREE.Group();
        this.vesselGroup = new THREE.Group();
        this.clotGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();
        this.loadedAnatomicalMesh = null;

        this.vessels = {
            LAD: null,
            LCX: null,
            RCA: null,
            LMCA: null,
            AORTA: null,
            PULMONARY: null
        };
        this.vesselMaterials = {};
        this.clotMeshes = {};
        this.clotLabels = {};
        this.particleSystems = {};
        this.selectedVessel = null;

        // Animation and State
        this.clock = new THREE.Clock();
        this.bpm = 76;
        this.isBeating = true;
        this.showFlow = true;
        this.showMyocardium = true;
        this.showLabels = true;
        this.showClots = true;
        this.myocardiumOpacity = 0.92;

        // Current Vessel Probabilities
        this.riskProbabilities = {
            LAD: 0.15,
            LCX: 0.10,
            RCA: 0.10,
            CAD: 0.20
        };

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 700;
        const height = this.container.clientHeight || 580;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x070b14);
        this.scene.fog = new THREE.FogExp2(0x070b14, 0.035);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
        this.camera.position.set(0, 1.2, 9.2);

        // 3. Renderer with PBR Tone Mapping
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 20;
        this.controls.minDistance = 3.2;
        this.controls.target.set(0, 0, 0);

        // 5. Lighting Setup
        this.setupLighting();

        // 6. Build Root Hierarchy
        this.rootGroup.add(this.heartGroup);
        this.rootGroup.add(this.vesselGroup);
        this.rootGroup.add(this.clotGroup);
        this.rootGroup.add(this.labelGroup);
        this.scene.add(this.rootGroup);

        // 7. Load Realistic Anatomical 3D Model
        this.loadRealisticHeartModel();

        // 8. Build Coronary Vasculature & Blood Clots
        this.buildCoronaryTree();

        // 9. Floating 3D Anatomical Labels & Clot Warnings
        this.buildAnatomicalLabels();

        // 10. Environment / Grid
        this.setupEnvironment();

        // 11. Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));

        // 12. Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLighting() {
        // Natural balanced clinical illumination
        const ambient = new THREE.AmbientLight(0xffffff, 1.15);
        this.scene.add(ambient);

        // Key light (Surgical examination overhead light)
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
        keyLight.position.set(6, 10, 8);
        keyLight.castShadow = true;
        this.scene.add(keyLight);

        // Fill light (Natural soft white fill)
        const fillLight = new THREE.DirectionalLight(0xfff8f5, 1.2);
        fillLight.position.set(-8, 3, -4);
        this.scene.add(fillLight);

        // Rim light (Soft tissue warmth, natural organic backlighting)
        const rimLight = new THREE.PointLight(0xffedd5, 1.2, 18);
        rimLight.position.set(0, -4, -4);
        this.scene.add(rimLight);

        // Critical Ischemic Alarm Light
        this.alarmLight = new THREE.PointLight(0xef4444, 0.0, 12);
        this.alarmLight.position.set(0, 0, 2);
        this.scene.add(this.alarmLight);
    }

    setupEnvironment() {
        const grid = new THREE.GridHelper(22, 22, 0x38bdf8, 0x1e293b);
        grid.position.y = -3.4;
        grid.material.opacity = 0.22;
        grid.material.transparent = true;
        this.scene.add(grid);

        const ringGeom = new THREE.RingGeometry(2.2, 2.25, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -3.38;
        this.scene.add(ring);
    }

    loadRealisticHeartModel() {
        if (typeof THREE.GLTFLoader !== 'undefined') {
            const loader = new THREE.GLTFLoader();
            const modelUrl = '/static/models/cardiospatial_3d__static_models__heart.glb';

            loader.load(
                modelUrl,
                (gltf) => {
                    console.log("Realistic anatomical cardiospatial_3d__static_models__heart.glb loaded successfully!");
                    const mesh = gltf.scene;

                    const box = new THREE.Box3().setFromObject(mesh);
                    const size = box.getSize(new THREE.Vector3());
                    const maxAxis = Math.max(size.x, size.y, size.z);
                    const scaleFactor = 3.6 / maxAxis;

                    mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
                    mesh.position.set(0, -0.1, 0);

                    mesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;

                            if (child.material) {
                                // Preserve original authentic model colors and textures
                                if (child.material.color) {
                                    child.userData.originalColor = child.material.color.clone();
                                }
                                child.material.roughness = 0.42;
                                child.material.metalness = 0.08;
                                child.material.clearcoat = 0.25;
                                child.material.clearcoatRoughness = 0.2;
                                child.material.transparent = true;
                                child.material.opacity = this.myocardiumOpacity;
                            }
                        }
                    });

                    this.loadedAnatomicalMesh = mesh;
                    this.heartGroup.add(mesh);
                },
                (xhr) => {
                    console.log(`Loading 3D Heart: ${(xhr.loaded / (xhr.total || 15897440) * 100).toFixed(0)}%`);
                },
                (error) => {
                    console.warn("GLTFLoader error, fallback to procedural anatomical myocardium:", error);
                    this.buildProceduralAnatomicalHeart();
                }
            );
        } else {
            this.buildProceduralAnatomicalHeart();
        }
    }

    buildProceduralAnatomicalHeart() {
        const heartGeom = new THREE.SphereGeometry(1.65, 48, 48);
        const pos = heartGeom.attributes.position;

        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);

            if (y < 0) {
                const taper = 1.0 + (y / 1.65) * 0.62;
                x *= taper;
                z *= taper;
                x -= (y / 1.65) * 0.52;
                z += (y / 1.65) * 0.32;
            } else {
                x *= 1.15;
                z *= 0.96;
            }

            if (z > 0.4 && x > -0.7 && x < 0.2 && y < 0.6) {
                z *= 0.91;
            }

            if (x > 0.3 && z > 0.2 && y > -0.8 && y < 0.4) {
                x *= 1.12;
                z *= 1.08;
            }

            pos.setXYZ(i, x, y, z);
        }
        heartGeom.computeVertexNormals();

        const heartMat = new THREE.MeshPhysicalMaterial({
            color: 0xa81d36, // Natural living cardiac myocardium tone
            emissive: 0x3b0712,
            emissiveIntensity: 0.2,
            roughness: 0.38,
            metalness: 0.08,
            clearcoat: 0.4,
            clearcoatRoughness: 0.25,
            transmission: 0.05,
            opacity: this.myocardiumOpacity,
            transparent: true
        });

        const mesh = new THREE.Mesh(heartGeom, heartMat);
        mesh.name = "Myocardium";
        this.loadedAnatomicalMesh = mesh;
        this.heartGroup.add(mesh);

        // Ascending Aorta
        const aortaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, 0.9, 0.25),
            new THREE.Vector3(-0.08, 1.85, 0.3),
            new THREE.Vector3(0.35, 2.55, 0.05),
            new THREE.Vector3(0.25, 2.75, -0.65),
            new THREE.Vector3(-0.25, 2.45, -1.05),
            new THREE.Vector3(-0.35, 0.85, -1.15)
        ]);
        const aortaGeom = new THREE.TubeGeometry(aortaCurve, 48, 0.44, 18, false);
        const aortaMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.3, metalness: 0.2 });
        const aorta = new THREE.Mesh(aortaGeom, aortaMat);
        aorta.name = "Aorta";
        this.vessels.AORTA = aorta;
        this.heartGroup.add(aorta);

        // Pulmonary Trunk
        const pulmCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.3, 0.75, 0.65),
            new THREE.Vector3(0.12, 1.6, 0.55),
            new THREE.Vector3(-0.45, 2.05, 0.15),
            new THREE.Vector3(-1.0, 2.15, -0.4)
        ]);
        const pulmGeom = new THREE.TubeGeometry(pulmCurve, 36, 0.38, 16, false);
        const pulmMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.15 });
        const pulmonary = new THREE.Mesh(pulmGeom, pulmMat);
        pulmonary.name = "Pulmonary Trunk";
        this.vessels.PULMONARY = pulmonary;
        this.heartGroup.add(pulmonary);
    }

    buildCoronaryTree() {
        // -----------------------------------------------------------------
        // 1. LMCA (Left Main)
        // -----------------------------------------------------------------
        const lmcaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, 1.05, 0.35),
            new THREE.Vector3(-0.48, 1.0, 0.52),
            new THREE.Vector3(-0.75, 0.9, 0.62)
        ]);
        const lmcaGeom = new THREE.TubeGeometry(lmcaCurve, 16, 0.11, 12, false);
        const lmcaMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.3 });
        this.vessels.LMCA = new THREE.Mesh(lmcaGeom, lmcaMat);
        this.vessels.LMCA.name = "Left Main Coronary Artery (LMCA)";
        this.vesselGroup.add(this.vessels.LMCA);

        // -----------------------------------------------------------------
        // 2. LAD (Left Anterior Descending)
        // -----------------------------------------------------------------
        const ladCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.75, 0.9, 0.62),
            new THREE.Vector3(-0.68, 0.45, 1.02),
            new THREE.Vector3(-0.58, -0.1, 1.32), // Lesion site (Point index 0.4)
            new THREE.Vector3(-0.46, -0.7, 1.42),
            new THREE.Vector3(-0.36, -1.3, 1.25),
            new THREE.Vector3(-0.42, -1.8, 0.88),
            new THREE.Vector3(-0.48, -2.1, 0.45)
        ]);
        this.createCoronaryVessel('LAD', ladCurve, 0.095, "Left Anterior Descending Artery (LAD)");

        const d1Curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.68, 0.45, 1.02),
            new THREE.Vector3(-1.05, 0.15, 1.15),
            new THREE.Vector3(-1.35, -0.35, 0.95)
        ]);
        const d1Geom = new THREE.TubeGeometry(d1Curve, 20, 0.052, 10, false);
        const d1Mesh = new THREE.Mesh(d1Geom, this.vesselMaterials['LAD']);
        this.vessels.LAD.add(d1Mesh);

        // Create LAD Thrombus / Plaque Clot Mesh
        this.createBloodClotMesh('LAD', ladCurve.getPoint(0.42), "LAD Mid-Segment Occlusion");

        // -----------------------------------------------------------------
        // 3. LCX (Left Circumflex)
        // -----------------------------------------------------------------
        const lcxCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.75, 0.9, 0.62),
            new THREE.Vector3(-1.2, 0.8, 0.42),
            new THREE.Vector3(-1.62, 0.58, -0.02), // Lesion site (Point index 0.38)
            new THREE.Vector3(-1.72, 0.25, -0.6),
            new THREE.Vector3(-1.5, -0.22, -1.02),
            new THREE.Vector3(-1.12, -0.85, -1.2),
            new THREE.Vector3(-0.68, -1.35, -1.05)
        ]);
        this.createCoronaryVessel('LCX', lcxCurve, 0.088, "Left Circumflex Artery (LCX)");

        const om1Curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.62, 0.58, -0.02),
            new THREE.Vector3(-1.68, 0.05, 0.22),
            new THREE.Vector3(-1.45, -0.65, 0.42)
        ]);
        const om1Geom = new THREE.TubeGeometry(om1Curve, 20, 0.048, 10, false);
        const om1Mesh = new THREE.Mesh(om1Geom, this.vesselMaterials['LCX']);
        this.vessels.LCX.add(om1Mesh);

        // Create LCX Thrombus / Plaque Clot Mesh
        this.createBloodClotMesh('LCX', lcxCurve.getPoint(0.38), "LCX Proximal Occlusion");

        // -----------------------------------------------------------------
        // 4. RCA (Right Coronary Artery)
        // -----------------------------------------------------------------
        const rcaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.12, 0.95, 0.48),
            new THREE.Vector3(0.7, 0.82, 0.58),
            new THREE.Vector3(1.25, 0.52, 0.48),
            new THREE.Vector3(1.58, 0.02, 0.26), // Lesion site (Point index 0.48)
            new THREE.Vector3(1.52, -0.65, -0.12),
            new THREE.Vector3(1.2, -1.15, -0.58),
            new THREE.Vector3(0.55, -1.55, -0.95),
            new THREE.Vector3(0.05, -1.85, -0.75)
        ]);
        this.createCoronaryVessel('RCA', rcaCurve, 0.092, "Right Coronary Artery (RCA)");

        const amCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1.58, 0.02, 0.26),
            new THREE.Vector3(1.72, -0.52, 0.52),
            new THREE.Vector3(1.45, -1.05, 0.72)
        ]);
        const amGeom = new THREE.TubeGeometry(amCurve, 20, 0.048, 10, false);
        const amMesh = new THREE.Mesh(amGeom, this.vesselMaterials['RCA']);
        this.vessels.RCA.add(amMesh);

        // Create RCA Thrombus / Plaque Clot Mesh
        this.createBloodClotMesh('RCA', rcaCurve.getPoint(0.48), "RCA Mid-Segment Occlusion");

        // -----------------------------------------------------------------
        // Initialize Blood Flow Particle Physics
        // -----------------------------------------------------------------
        this.createFlowParticles('LAD', ladCurve, 0.42);
        this.createFlowParticles('LCX', lcxCurve, 0.38);
        this.createFlowParticles('RCA', rcaCurve, 0.48);
    }

    createCoronaryVessel(key, curve, radius, label) {
        const tubeGeom = new THREE.TubeGeometry(curve, 72, radius, 18, false);

        const mat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x059669,
            emissiveIntensity: 0.65,
            roughness: 0.22,
            metalness: 0.25
        });

        const mesh = new THREE.Mesh(tubeGeom, mat);
        mesh.name = label;
        mesh.userData = { vesselKey: key, curve: curve, label: label };

        this.vesselMaterials[key] = mat;
        this.vessels[key] = mesh;
        this.vesselGroup.add(mesh);
    }

    createBloodClotMesh(key, position, label) {
        // Create realistic intra-luminal thrombus / atherosclerotic plaque bulge
        const clotGeom = new THREE.SphereGeometry(0.18, 20, 20);
        // Irregular thrombus deformation
        const pos = clotGeom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i) * (1.0 + Math.random() * 0.25);
            let y = pos.getY(i) * (0.8 + Math.random() * 0.2);
            let z = pos.getZ(i) * (1.0 + Math.random() * 0.25);
            pos.setXYZ(i, x, y, z);
        }
        clotGeom.computeVertexNormals();

        // Dark Maroon/Blackish Thrombus Material with Glowing Red Hazard Ring
        const clotMat = new THREE.MeshStandardMaterial({
            color: 0x450a0a, // Dark clotted blood
            emissive: 0x991b1b,
            emissiveIntensity: 0.8,
            roughness: 0.6,
            metalness: 0.3,
            transparent: true,
            opacity: 0.0 // Hidden by default until risk increases
        });

        const clotMesh = new THREE.Mesh(clotGeom, clotMat);
        clotMesh.position.copy(position);
        clotMesh.name = label;
        clotMesh.visible = false;
        clotMesh.userData = { vesselKey: key, isClot: true };

        // Outer pulsing hazard ring
        const ringGeom = new THREE.TorusGeometry(0.24, 0.025, 12, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.0 });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        clotMesh.add(ringMesh);

        this.clotMeshes[key] = {
            mesh: clotMesh,
            ring: ringMesh,
            mat: clotMat,
            ringMat: ringMat
        };
        this.clotGroup.add(clotMesh);
    }

    createFlowParticles(key, curve, clotIndexOffset) {
        const count = 55;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const offsets = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            offsets[i] = i / count;
            const pt = curve.getPoint(offsets[i]);
            positions[i * 3] = pt.x;
            positions[i * 3 + 1] = pt.y;
            positions[i * 3 + 2] = pt.z;

            // Default bright red oxygenated blood particle
            colors[i * 3] = 0.2;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 1.0;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.09,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geom, mat);
        this.particleSystems[key] = {
            points: points,
            curve: curve,
            offsets: offsets,
            count: count,
            clotOffset: clotIndexOffset
        };
        this.vesselGroup.add(points);
    }

    buildAnatomicalLabels() {
        const labelDefs = [
            { text: "LAD", pos: new THREE.Vector3(-0.6, 0.2, 1.45), color: "#38BDF8", key: "LAD" },
            { text: "LCX", pos: new THREE.Vector3(-1.7, 0.4, 0.2), color: "#A855F7", key: "LCX" },
            { text: "RCA", pos: new THREE.Vector3(1.6, 0.3, 0.5), color: "#F97316", key: "RCA" },
            { text: "Aorta", pos: new THREE.Vector3(0.3, 2.6, 0.3), color: "#F43F5E", key: "AORTA" }
        ];

        labelDefs.forEach(def => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(8, 8, 112, 48, 14);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.text, 64, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.copy(def.pos);
            sprite.scale.set(0.75, 0.38, 1.0);
            sprite.userData = { vesselKey: def.key };

            this.labelGroup.add(sprite);
        });

        // Critical Clot Warning Callout Sprites
        ['LAD', 'LCX', 'RCA'].forEach(key => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 70;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = "rgba(153, 27, 27, 0.92)";
            ctx.strokeStyle = "#EF4444";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(6, 6, 244, 58, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`🚨 ${key} BLOOD CLOT DETECTED`, 128, 35);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.0 });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(1.4, 0.42, 1.0);
            sprite.visible = false;

            this.clotLabels[key] = { sprite: sprite, spriteMat: spriteMat };
            this.clotGroup.add(sprite);
        });
    }

    updateRiskColors(predictions) {
        if (!predictions || !predictions.vessels) return;

        this.riskProbabilities = {
            LAD: predictions.vessels.LAD.probability,
            LCX: predictions.vessels.LCX.probability,
            RCA: predictions.vessels.RCA.probability,
            CAD: predictions.overall_cad.probability
        };

        const cadProb = this.riskProbabilities.CAD;

        // 1. Vessel Color Interpolation & Clot Visibilities
        ['LAD', 'LCX', 'RCA'].forEach(key => {
            const prob = this.riskProbabilities[key];
            const mat = this.vesselMaterials[key];
            const clotData = this.clotMeshes[key];
            const clotLbl = this.clotLabels[key];

            if (!mat) return;

            const col = new THREE.Color();
            const emissive = new THREE.Color();

            if (prob < 0.30) {
                // Low Risk (<30%) -> Emerald Green
                col.setHex(0x10b981);
                emissive.setHex(0x059669);
                mat.emissiveIntensity = 0.55;

                // Hide Blood Clot
                if (clotData) {
                    clotData.mesh.visible = false;
                    clotData.mat.opacity = 0.0;
                    clotData.ringMat.opacity = 0.0;
                }
                if (clotLbl) {
                    clotLbl.sprite.visible = false;
                    clotLbl.spriteMat.opacity = 0.0;
                }
            } else if (prob < 0.50) {
                // Intermediate Risk (30% - 49%) -> Yellow / Amber
                col.setHex(0xf59e0b);
                emissive.setHex(0xd97706);
                mat.emissiveIntensity = 0.85;

                // Show Partial Plaque Clot
                if (clotData) {
                    clotData.mesh.visible = true;
                    clotData.mat.opacity = 0.65;
                    clotData.ringMat.opacity = 0.45;
                }
                if (clotLbl) {
                    clotLbl.sprite.visible = false;
                    clotLbl.spriteMat.opacity = 0.0;
                }
            } else {
                // Predicted Stenosis Threshold (>=50%) -> Red
                col.setHex(0xef4444);
                emissive.setHex(0xb91c1c);
                mat.emissiveIntensity = 1.45;

                // Show Full Occlusion Blood Clot & Hazard Ring
                if (clotData) {
                    clotData.mesh.visible = true;
                    clotData.mat.opacity = 0.95;
                    clotData.ringMat.opacity = 0.9;
                }
                if (clotLbl) {
                    clotLbl.sprite.visible = this.showLabels;
                    clotLbl.spriteMat.opacity = 0.95;

                    // Position label right above clot site
                    const clotPos = clotData.mesh.position.clone();
                    clotPos.y += 0.45;
                    clotLbl.sprite.position.copy(clotPos);
                }
            }

            mat.color.copy(col);
            mat.emissive.copy(emissive);
        });

        // 2. Preserve Authentic Human Heart Anatomy Colors & Textures
        if (this.loadedAnatomicalMesh) {
            this.loadedAnatomicalMesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Restore natural authentic human heart tissue color and texture
                    if (child.userData.originalColor) {
                        child.material.color.copy(child.userData.originalColor);
                    }
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                        child.material.emissiveIntensity = 0.0;
                    }
                }
            });
        }

        // 3. Alarm Flash Light for Critical Conditions (>80%)
        if (this.alarmLight) {
            this.alarmLight.intensity = cadProb > 0.80 ? 1.5 : 0.0;
        }
    }

    setCameraPreset(viewName) {
        if (!this.camera || !this.controls) return;

        let targetPos = new THREE.Vector3(0, 1.2, 9.2);
        let targetLook = new THREE.Vector3(0, 0, 0);

        switch (viewName) {
            case 'anterior': // LAD Focus
                targetPos.set(0, 0.3, 7.2);
                targetLook.set(-0.4, -0.5, 0.8);
                break;
            case 'lateral': // LCX Focus
                targetPos.set(-7.2, 0.4, 1.6);
                targetLook.set(-1.0, 0.0, -0.4);
                break;
            case 'inferior': // RCA Focus
                targetPos.set(6.2, -2.2, 3.4);
                targetLook.set(0.6, -0.8, 0.0);
                break;
            case 'overview':
            default:
                targetPos.set(0, 1.2, 9.2);
                targetLook.set(0, 0, 0);
                break;
        }

        gsap.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 1.1,
            ease: "power2.inOut"
        });
        gsap.to(this.controls.target, {
            x: targetLook.x,
            y: targetLook.y,
            z: targetLook.z,
            duration: 1.1,
            ease: "power2.inOut",
            onUpdate: () => this.controls.update()
        });
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onPointerDown(event) {
        this.onPointerMove(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const interactables = [
            this.vessels.LAD, this.vessels.LCX, this.vessels.RCA,
            this.vessels.LMCA, ...this.labelGroup.children
        ].filter(Boolean);

        const intersects = this.raycaster.intersectObjects(interactables, true);

        if (intersects.length > 0) {
            let hit = intersects[0].object;
            while (hit.parent && !hit.userData.vesselKey && hit !== this.scene && hit !== this.rootGroup) {
                hit = hit.parent;
            }

            const vesselKey = hit.userData?.vesselKey;
            if (vesselKey && ['LAD', 'LCX', 'RCA'].includes(vesselKey)) {
                this.selectVessel(vesselKey);
                if (window.onVesselSelected) {
                    window.onVesselSelected(vesselKey);
                }
            }
        }
    }

    selectVessel(key) {
        this.selectedVessel = key;

        ['LAD', 'LCX', 'RCA'].forEach(k => {
            const vMesh = this.vessels[k];
            if (vMesh) {
                if (k === key) {
                    vMesh.scale.set(1.22, 1.22, 1.22);
                } else {
                    vMesh.scale.set(1.0, 1.0, 1.0);
                }
            }
        });

        if (key === 'LAD') this.setCameraPreset('anterior');
        else if (key === 'LCX') this.setCameraPreset('lateral');
        else if (key === 'RCA') this.setCameraPreset('inferior');
    }

    toggleBloodFlow(enable) {
        this.showFlow = enable;
        Object.values(this.particleSystems).forEach(ps => {
            ps.points.visible = enable;
        });
    }

    toggleLabels(enable) {
        this.showLabels = enable;
        this.labelGroup.visible = enable;
    }

    setMyocardiumOpacity(val) {
        this.myocardiumOpacity = parseFloat(val);
        if (this.loadedAnatomicalMesh) {
            this.loadedAnatomicalMesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = this.myocardiumOpacity;
                }
            });
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // 1. Cardiac Cycle Impulse (Arrhythmia during critical ischemia >85%)
        if (this.isBeating && this.heartGroup) {
            const cadProb = this.riskProbabilities.CAD;

            if (cadProb > 0.85) {
                // Arrhythmic Ventricular Fibrillation / Tachycardia Pulse
                const arrhFreq = (140 / 60) * Math.PI * 2;
                const flutter = Math.sin(time * arrhFreq) * 0.06 + Math.sin(time * 25.0) * 0.018;
                this.heartGroup.scale.set(1.0 - flutter, 1.0 - flutter, 1.0 - flutter);
            } else {
                // Regular Rhythm
                const beatFreq = (this.bpm / 60) * Math.PI * 2;
                const heartRateCycle = Math.sin(time * beatFreq);
                const systolicContraction = Math.pow(Math.max(0, heartRateCycle), 3.0) * 0.048;
                const currentScale = 1.0 - systolicContraction;
                this.heartGroup.scale.set(currentScale, currentScale, currentScale);
            }
        }

        // 2. Real Human Pathophysiology: Downstream Blood Stoppage & Clot Physics
        if (this.showFlow) {
            ['LAD', 'LCX', 'RCA'].forEach(key => {
                const ps = this.particleSystems[key];
                if (!ps) return;

                const prob = this.riskProbabilities[key] || 0.1;
                const clotOffset = ps.clotOffset;

                const positions = ps.points.geometry.attributes.position.array;
                const colors = ps.points.geometry.attributes.color.array;

                for (let i = 0; i < ps.count; i++) {
                    let offset = ps.offsets[i];

                    if (prob >= 0.50) {
                        // PREDICTED STENOSIS (>=50%):
                        // Upstream of clot: Blood moves slowly towards clot site.
                        // Downstream of clot: Throttled / Ischemic deoxygenated flow
                        if (offset < clotOffset) {
                            offset = (offset + 0.12 * delta) % clotOffset;
                            colors[i * 3] = 0.95;
                            colors[i * 3 + 1] = 0.15;
                            colors[i * 3 + 2] = 0.2;
                        } else {
                            colors[i * 3] = 0.15;
                            colors[i * 3 + 1] = 0.15;
                            colors[i * 3 + 2] = 0.35;
                        }
                    } else if (prob >= 0.30) {
                        // Intermediate Risk (30% - 49%): Flow slows down smoothly
                        const speed = 0.35 * (1.0 - prob * 0.65);
                        offset = (offset + speed * delta) % 1.0;
                        // Amber / Yellow blood particles
                        colors[i * 3] = 0.95;
                        colors[i * 3 + 1] = 0.65;
                        colors[i * 3 + 2] = 0.1;
                    } else {
                        // Low Risk (<30%): Fast, smooth laminar blood flow
                        offset = (offset + 0.42 * delta) % 1.0;
                        // Bright blue-cyan holographic oxygenated flow
                        colors[i * 3] = 0.2;
                        colors[i * 3 + 1] = 0.85;
                        colors[i * 3 + 2] = 1.0;
                    }

                    ps.offsets[i] = offset;
                    const pt = ps.curve.getPoint(offset);
                    positions[i * 3] = pt.x;
                    positions[i * 3 + 1] = pt.y;
                    positions[i * 3 + 2] = pt.z;
                }

                ps.points.geometry.attributes.position.needsUpdate = true;
                ps.points.geometry.attributes.color.needsUpdate = true;
            });
        }

        // 3. Clot Ring Pulsation & Alarm Light Flashing
        ['LAD', 'LCX', 'RCA'].forEach(key => {
            const prob = this.riskProbabilities[key];
            const clotData = this.clotMeshes[key];

            if (prob > 0.65 && clotData && clotData.ring) {
                const pulse = 1.0 + 0.4 * Math.sin(time * 8.0);
                clotData.ring.scale.set(pulse, pulse, pulse);
            }
        });

        if (this.alarmLight && this.alarmLight.intensity > 0) {
            this.alarmLight.intensity = 1.0 + 0.8 * Math.sin(time * 10.0);
        }

        // 4. Smooth Idle Rotation
        if (!this.controls.state || this.controls.state === -1) {
            this.rootGroup.rotation.y += 0.0012;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}
