import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import './landing-3d.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const draggableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    
    try {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030305, 0.02);
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const blueLight = new THREE.PointLight(0x00f3ff, 2, 50);
    blueLight.position.set(5, 5, 5);
    scene.add(blueLight);
    const purpleLight = new THREE.PointLight(0x7000ff, 2, 50);
    purpleLight.position.set(-5, -5, 5);
    scene.add(purpleLight);

    const group = new THREE.Group();
    scene.add(group);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.8, 0),
      new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 0.8, roughness: 0.1, metalness: 1 })
    );
    group.add(core);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7000ff, transparent: true, opacity: 0.8 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 16, 100), ringMat);
    group.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.05, 16, 100), ringMat);
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.02, 16, 100), new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 }));
    ring3.rotation.y = Math.PI / 2;
    group.add(ring3);

    const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 1), new THREE.MeshBasicMaterial({ color: 0x8b9bb4, wireframe: true, transparent: true, opacity: 0.15 }));
    group.add(cage);

    const pCount = 800;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 20;
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({ size: 0.04, color: 0x00f3ff, transparent: true, opacity: 0.4 }));
    scene.add(particles);

    const updatePosition = () => {
      if (window.innerWidth > 768) {
        group.position.set(3, 0, 0);
        group.scale.set(1, 1, 1);
      } else {
        group.position.set(0, 1, 0);
        group.scale.set(0.7, 0.7, 0.7);
      }
    };
    updatePosition();

    let mouseX = 0, mouseY = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
      core.scale.set(scale, scale, scale);
      core.rotation.y -= 0.02;
      core.rotation.z -= 0.01;
      ring1.rotation.x += 0.01;
      ring1.rotation.y += 0.005;
      ring2.rotation.y += 0.01;
      ring2.rotation.z += 0.005;
      ring3.rotation.z -= 0.01;
      ring3.rotation.x -= 0.005;
      cage.rotation.y += 0.002;
      cage.rotation.z -= 0.002;
      group.rotation.x += (mouseY * 0.2 - group.rotation.x) * 0.05;
      group.rotation.y += (mouseX * 0.2 - group.rotation.y) * 0.05;
      particles.rotation.y += 0.0005;
      renderer.render(scene, camera);
    };
    animate();

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      updatePosition();
    };
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    gsap.registerPlugin(Draggable, ScrollTrigger);
    if (draggableRef.current) {
      Draggable.create(draggableRef.current, { type: 'x,y', edgeResistance: 0.65, bounds: window, inertia: true });
    }
    gsap.utils.toArray('.section').forEach((section: any) => {
      gsap.from(section.children, { scrollTrigger: { trigger: section, start: 'top 80%' }, y: 50, opacity: 0, duration: 1, stagger: 0.2, ease: 'power3.out' });
    });
    ScrollTrigger.create({ trigger: '#pricing', start: 'top bottom', end: 'bottom top', onEnter: () => gsap.to(group.position, { x: 0, duration: 1 }), onLeaveBack: () => gsap.to(group.position, { x: 3, duration: 1 }) });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      ScrollTrigger.getAll().forEach(t => t.kill());
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
    } catch (error) {
      console.warn('WebGL not available, falling back to non-3D view:', error);
    }
  }, []);

  return (
    <div className="min-h-screen">
      <div id="webgl-canvas" ref={canvasContainerRef} />
      <div id="draggable-message" ref={draggableRef}>
        <div className="msg-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.897 10 4 10.897 4 12V20C4 21.103 4.897 22 6 22H18C19.103 22 20 21.103 20 20V12C20 10.897 19.103 10 18 10H17V7C17 4.243 14.757 2 12 2ZM12 4C13.654 4 15 5.346 15 7V10H9V7C9 5.346 10.346 4 12 4ZM12 17C10.897 17 10 16.103 10 15C10 13.897 10.897 13 12 13C13.103 13 14 13.897 14 15C14 16.103 13.103 17 12 17Z" /></svg></div>
      </div>

      <nav className="header">
        <div className="brand"><span className="brand-icon">🔒</span> LOCKBLIP</div>
        <div className="nav-menu">
          <a href="#features">Architecture</a>
          <a href="#pricing">Pricing</a>
          <a href="#team">Team</a>
        </div>
        <div className="auth-btn" onClick={() => setLocation('/login')}>Secure Login</div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <h1>Total <br /><span>Anonymity</span></h1>
          <p className="hero-sub">Military-grade encryption meets intuitive design. Lockblip ensures your data remains yours. No logs. No backdoors. Pure peer-to-peer security.</p>
          <button className="btn-download" onClick={() => setLocation('/login')}>Get Secured Now</button>
        </div>
      </section>

      <section className="section">
        <div className="clients-grid">
          <div className="client-logo">CYBERDYNE</div>
          <div className="client-logo">NETSEC</div>
          <div className="client-logo">OMEGA CORP</div>
          <div className="client-logo">VANGUARD</div>
          <div className="client-logo">PROTOCOLS.IO</div>
        </div>
      </section>

      <section id="features" className="section">
        <h2 className="section-title">Neural <span>Architecture</span></h2>
        <div className="feature-split">
          <div className="ai-image-container">
            <img src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1000&auto=format&fit=crop" alt="AI Architecture" />
          </div>
          <div className="feature-text-box">
            <h3 style={{ fontFamily: 'Rajdhani', fontSize: 30, marginBottom: 20 }}>AI Threat Detection</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Our proprietary AI scans packet headers for interference without decrypting the payload. This ensures that Man-in-the-Middle attacks are neutralized before they even begin.
            </p>
            <div style={{ display: 'flex', gap: 15 }}>
              <div style={{ background: 'rgba(0,243,255,0.1)', padding: 10, borderRadius: 5, color: 'var(--accent-primary)' }}>Auto-Patching</div>
              <div style={{ background: 'rgba(112,0,255,0.1)', padding: 10, borderRadius: 5, color: 'var(--accent-secondary)' }}>Quantum Safe</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="section">
        <h2 className="section-title">Security <span>Protocols</span></h2>
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3 style={{ color: '#fff' }}>GHOST</h3>
            <div className="price">$0<span>/mo</span></div>
            <ul className="features-list">
              <li>End-to-End Encryption</li>
              <li>Self-Destruct Messages</li>
              <li>1 Device</li>
            </ul>
            <div className="auth-btn" onClick={() => setLocation('/login')}>Activate</div>
          </div>
          <div className="pricing-card popular">
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', background: 'var(--accent-primary)', color: 'black', fontSize: 10, fontWeight: 'bold', padding: 5 }}>RECOMMENDED</div>
            <h3 style={{ color: 'var(--accent-primary)', marginTop: 10 }}>OPERATOR</h3>
            <div className="price">$12<span>/mo</span></div>
            <ul className="features-list">
              <li>Multi-Device Sync</li>
              <li>Onion Routing</li>
              <li>100GB Secure Vault</li>
              <li>Priority Support</li>
            </ul>
            <button className="btn-download" style={{ width: '100%', padding: 10 }} onClick={() => setLocation('/login')}>Subscribe</button>
          </div>
          <div className="pricing-card">
            <h3 style={{ color: '#fff' }}>SYNDICATE</h3>
            <div className="price">$49<span>/mo</span></div>
            <ul className="features-list">
              <li>Private Server Hosting</li>
              <li>Admin Audit Logs</li>
              <li>API Access</li>
              <li>White-label Solution</li>
            </ul>
            <div className="auth-btn" onClick={() => setLocation('/login')}>Contact Us</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Transmission <span>Logs</span></h2>
        <div className="reviews-grid">
          <div className="log-entry">
            <div className="log-meta">&gt;&gt; LOG_ID: 8842 // USER: ALEX_M</div>
            "Lockblip is the only platform where I feel genuinely invisible. The interface is stunning, but the security is real."
          </div>
          <div className="log-entry">
            <div className="log-meta">&gt;&gt; LOG_ID: 9921 // USER: CRYPTO_DEV</div>
            "Migrated our entire team to Lockblip. The P2P latency is non-existent. Best tool for sensitive comms."
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <div className="brand" style={{ fontSize: 20 }}>LOCKBLIP</div>
          <div className="footer-text">© 2025 Lockblip Security Inc. All rights reserved.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="footer-text">Design & Architecture</div>
          <div className="footer-credit">GENERATED BY MANYA PARIKH</div>
        </div>
      </footer>
    </div>
  );
}
