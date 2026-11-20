/* ==========================================================================
   AERIVA AI — ANIMATION ENGINE
   GSAP + ScrollTrigger + Lenis + Vanilla Tilt + Count-Up + Confetti
   Graceful fallback if any CDN fails.
   ========================================================================== */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // FEATURE DETECTION
    // -----------------------------------------------------------------------
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const hasGSAP = typeof gsap !== 'undefined';
    const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
    const hasLenis = typeof Lenis !== 'undefined';

    if (prefersReducedMotion) {
        document.documentElement.classList.add('reduced-motion');
        console.log('[AERIVA Anim] Reduced motion preferred — animations disabled');
        return; // Skip all animations
    }

    // -----------------------------------------------------------------------
    // REGISTER GSAP PLUGINS
    // -----------------------------------------------------------------------
    if (hasGSAP && hasScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    // -----------------------------------------------------------------------
    // 1. SMOOTH SCROLL (Lenis)
    // -----------------------------------------------------------------------
    let lenis = null;
    function initSmoothScroll() {
        if (!hasLenis) return;
        try {
            lenis = new Lenis({
                duration: 1.1,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                orientation: 'vertical',
                smoothWheel: true,
                touchMultiplier: 1.5,
            });

            function raf(time) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);

            // Sync with GSAP ScrollTrigger
            if (hasGSAP && hasScrollTrigger) {
                lenis.on('scroll', ScrollTrigger.update);
                gsap.ticker.add((time) => lenis.raf(time * 1000));
                gsap.ticker.lagSmoothing(0);
            }

            document.documentElement.classList.add('lenis', 'lenis-smooth');
        } catch (e) {
            console.warn('[AERIVA Anim] Lenis init failed:', e);
        }
    }

    // -----------------------------------------------------------------------
    // 2. PAGE INTRO ANIMATION
    // -----------------------------------------------------------------------
    let introPlayed = false;
    function playPageIntro() {
        if (introPlayed || sessionStorage.getItem('aeriva_intro_played')) return;
        introPlayed = true;
        sessionStorage.setItem('aeriva_intro_played', '1');

        const overlay = document.createElement('div');
        overlay.className = 'aeriva-intro-overlay';
        overlay.innerHTML = '<div class="intro-brand-mark">AERIVA AI</div>';
        document.body.appendChild(overlay);

        const brand = overlay.querySelector('.intro-brand-mark');

        if (hasGSAP) {
            const tl = gsap.timeline({
                onComplete: () => {
                    overlay.classList.add('done');
                    setTimeout(() => overlay.remove(), 400);
                    revealMainContent();
                }
            });

            tl.to(brand, {
                opacity: 1,
                y: 0,
                rotateX: 0,
                duration: 0.5,
                ease: 'power3.out',
                delay: 0.1
            })
            .to(brand, {
                scale: 1.05,
                duration: 0.2,
                ease: 'power2.inOut',
                yoyo: true,
                repeat: 1
            })
            .to(overlay, {
                opacity: 0,
                duration: 0.3,
                ease: 'power2.in'
            });
        } else {
            // CSS-only fallback
            setTimeout(() => brand.classList.add('reveal'), 100);
            setTimeout(() => {
                overlay.classList.add('done');
                setTimeout(() => overlay.remove(), 400);
                revealMainContent();
            }, 1200);
        }

        // Allow skip on click/tap
        overlay.addEventListener('click', () => {
            overlay.classList.add('done');
            setTimeout(() => overlay.remove(), 300);
            revealMainContent();
        }, { once: true });
    }

    function revealMainContent() {
        // Trigger initial scroll reveals
        setTimeout(initScrollReveals, 100);
    }

    // -----------------------------------------------------------------------
    // 3. SCROLL-LINKED REVEALS
    // -----------------------------------------------------------------------
    function initScrollReveals() {
        const cards = document.querySelectorAll(
            '.vital-card, .schedule-card, .nutrition-card, .exercise-overview-row, ' +
            '.precaution-card, .next-day-card, .arena-data-card'
        );

        cards.forEach(card => {
            if (!card.classList.contains('scroll-reveal')) {
                card.classList.add('scroll-reveal');
            }
        });

        if (hasGSAP && hasScrollTrigger) {
            gsap.utils.toArray('.scroll-reveal').forEach((el, i) => {
                gsap.fromTo(el, {
                    opacity: 0,
                    y: 32,
                    rotateX: 12,
                }, {
                    opacity: 1,
                    y: 0,
                    rotateX: 0,
                    duration: 0.5,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 88%',
                        once: true,
                    },
                    delay: (i % 4) * 0.06
                });
            });
        } else {
            // IntersectionObserver fallback
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

            document.querySelectorAll('.scroll-reveal').forEach(el => obs.observe(el));
        }
    }

    // -----------------------------------------------------------------------
    // 4. CURSOR-AWARE CARD TILT
    // -----------------------------------------------------------------------
    function initCardTilt() {
        if (isTouchDevice) return; // Disabled on touch

        const tiltCards = document.querySelectorAll(
            '.vital-card, .schedule-card, .nutrition-card, .precaution-card, .next-day-card'
        );

        tiltCards.forEach(card => {
            card.classList.add('tilt-card');
            card.style.transformStyle = 'preserve-3d';

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;

                const tiltX = (y - 0.5) * -6; // max ±3deg
                const tiltY = (x - 0.5) * 6;

                // Shift shadow opposite to tilt
                const shadowX = 5 - tiltY * 0.6;
                const shadowY = 5 + tiltX * 0.6;

                card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                card.style.boxShadow = `${shadowX}px ${shadowY}px 0 var(--ink)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });
    }

    // -----------------------------------------------------------------------
    // 5. NUMBER COUNT-UP
    // -----------------------------------------------------------------------
    const countUpObservers = new Map();

    window.aerivaCountUp = function (element, targetValue, duration = 600, suffix = '') {
        if (!element || prefersReducedMotion) {
            if (element) element.textContent = targetValue + suffix;
            return;
        }

        const startValue = parseFloat(element.textContent) || 0;
        const target = parseFloat(targetValue);
        if (isNaN(target) || startValue === target) return;

        const startTime = performance.now();
        element.classList.add('count-up', 'animating');

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = startValue + (target - startValue) * eased;

            if (Number.isInteger(target)) {
                element.textContent = Math.round(current) + suffix;
            } else {
                element.textContent = current.toFixed(2) + suffix;
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                element.textContent = target + suffix;
                element.classList.remove('animating');
            }
        }
        requestAnimationFrame(step);
    };

    // -----------------------------------------------------------------------
    // 6. TAB SWITCH ANIMATION HOOK
    // -----------------------------------------------------------------------
    function initTabSwitchAnimation() {
        // Hook into existing switchDashboardTab by wrapping it
        const originalSwitch = window.switchDashboardTab;
        if (typeof originalSwitch !== 'function') return;

        window.switchDashboardTab = function (tab) {
            // Call original first
            originalSwitch(tab);

            // Add flip animation to the newly visible view
            const viewMap = {
                'routine': 'dashboardView1',
                'fitness': 'dashboardView2',
                'precautions': 'dashboardView3',
                'dashboard2': 'dashboardView2',
                'dashboard3': 'dashboardView3',
                '2': 'dashboardView2',
                '3': 'dashboardView3',
                'guidance': 'dashboardView3'
            };

            const viewId = viewMap[tab] || 'dashboardView1';
            const view = document.getElementById(viewId);

            if (view && !view.classList.contains('hidden')) {
                view.classList.remove('tab-flip-enter');
                // Force reflow
                void view.offsetWidth;
                view.classList.add('tab-flip-enter');

                // Hero wipe
                const hero = view.querySelector('.welcome-strip, .exercise-hero-strip, .precautions-hero-strip');
                if (hero) {
                    hero.classList.remove('wipe-active');
                    void hero.offsetWidth;
                    hero.classList.add('hero-wipe-transition', 'wipe-active');
                    setTimeout(() => hero.classList.remove('wipe-active'), 600);
                }

                // Re-trigger scroll reveals within this tab
                setTimeout(() => initScrollReveals(), 50);
            }
        };
    }

    // -----------------------------------------------------------------------
    // 7. 3D BUTTON PRESS
    // -----------------------------------------------------------------------
    function initButtonPress() {
        const buttons = document.querySelectorAll(
            '.corner-dash-btn, .hud-logout-btn, .action-btn, .volt-action-btn, ' +
            '#launchExerciseModeBtn, #popupCompleteBtn, .aeriva-action-btn'
        );
        buttons.forEach(btn => btn.classList.add('btn-3d'));
    }

    // -----------------------------------------------------------------------
    // 8. CONFETTI BURST
    // -----------------------------------------------------------------------
    window.aerivaConfetti = function () {
        if (prefersReducedMotion) return;

        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        const colors = ['#C6FF00', '#FF4D2E', '#2B3BFF', '#FFC400', '#00D1A0', '#FF7AC6'];
        const count = 60;

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.top = `${-10 - Math.random() * 20}%`;
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = `${6 + Math.random() * 8}px`;
            piece.style.height = `${6 + Math.random() * 8}px`;
            piece.style.animationDelay = `${Math.random() * 0.5}s`;
            piece.style.animationDuration = `${1.5 + Math.random() * 1}s`;
            container.appendChild(piece);
        }

        setTimeout(() => container.remove(), 3000);
    };

    // -----------------------------------------------------------------------
    // 9. HERO PARALLAX (mouse-driven)
    // -----------------------------------------------------------------------
    function initHeroParallax() {
        if (isTouchDevice) return;

        document.addEventListener('mousemove', (e) => {
            const mx = (e.clientX / window.innerWidth - 0.5) * 2;
            const my = (e.clientY / window.innerHeight - 0.5) * 2;

            // Move depth layers
            document.querySelectorAll('.depth-parallax-layer').forEach(layer => {
                const speed = parseFloat(layer.dataset.parallaxSpeed) || 1;
                const x = mx * 15 * speed;
                const y = my * 10 * speed;
                layer.style.transform = `translate(${x}px, ${y}px)`;
            });

            // Tilt auth card
            const authCard = document.querySelector('.auth-card');
            if (authCard && !authCard.closest('.hidden')) {
                const tiltX = my * -2;
                const tiltY = mx * 2;
                authCard.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            }
        });
    }

    // -----------------------------------------------------------------------
    // 10. TRAINER VIDEO PLAYER
    // -----------------------------------------------------------------------
    let trainerVideoManifest = null;
    let currentVideoMode = 'canvas'; // 'canvas' | 'video'

    async function loadVideoManifest() {
        try {
            const resp = await fetch('/static/videos/manifest.json');
            if (resp.ok) {
                trainerVideoManifest = await resp.json();
            }
        } catch (e) {
            console.warn('[AERIVA Anim] Could not load video manifest:', e);
        }
    }

    window.aerivaGetVideoInfo = function (exerciseKey) {
        if (!trainerVideoManifest) return null;
        const k = (exerciseKey || '').toLowerCase().replace(/[-\s]/g, '_');
        return trainerVideoManifest.exercises[k] || null;
    };

    window.aerivaGetVideoMode = function () {
        return currentVideoMode;
    };

    window.aerivaSetVideoMode = function (mode) {
        currentVideoMode = mode;
        const event = new CustomEvent('aeriva-video-mode-change', { detail: { mode } });
        document.dispatchEvent(event);
    };

    // Check if a video file actually exists
    window.aerivaVideoExists = async function (url) {
        try {
            const resp = await fetch(url, { method: 'HEAD' });
            return resp.ok;
        } catch {
            return false;
        }
    };

    // -----------------------------------------------------------------------
    // INIT
    // -----------------------------------------------------------------------
    function init() {
        console.log('[AERIVA Anim] Initializing animation engine...');
        console.log(`  GSAP: ${hasGSAP ? '✓' : '✗'}, ScrollTrigger: ${hasScrollTrigger ? '✓' : '✗'}, Lenis: ${hasLenis ? '✓' : '✗'}`);

        initSmoothScroll();
        playPageIntro();
        initCardTilt();
        initButtonPress();
        initHeroParallax();
        initTabSwitchAnimation();
        loadVideoManifest();

        // Deferred scroll reveals after content loads
        if (document.readyState === 'complete') {
            setTimeout(initScrollReveals, 300);
        } else {
            window.addEventListener('load', () => setTimeout(initScrollReveals, 300));
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
