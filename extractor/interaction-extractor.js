/**
 * interaction-extractor.js
 * Extrai padrões de interação, animações, transições e comportamentos UX
 * de um site via Playwright. Complementa o dembrandt com dados de experiência.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
if (!url) {
  console.error('Uso: node interaction-extractor.js <url>');
  process.exit(1);
}

const outputDir = process.argv[3] || 'output';

async function extract(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const report = {
    url,
    extractedAt: new Date().toISOString(),
    transitions: [],
    animations: [],
    scrollBehavior: {},
    hoverStates: [],
    loadingPatterns: [],
    microInteractions: [],
    timingFunctions: [],
    pageStructure: {},
    motionPreferences: {},
  };

  console.log(`Navegando para ${url}...`);
  await page.goto(url.startsWith('http') ? url : `https://${url}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  await page.waitForTimeout(3000);

  // ─── 1. TRANSIÇÕES CSS ────────────────────────────────────────────────────
  console.log('Extraindo transições...');
  report.transitions = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const transition = style.transition;
      if (
        transition &&
        transition !== 'none' &&
        transition !== 'all 0s ease 0s'
      ) {
        const key = transition;
        if (!seen.has(key)) {
          seen.add(key);
          const tag = el.tagName.toLowerCase();
          const classes = Array.from(el.classList).slice(0, 3).join('.');
          results.push({
            element: classes ? `${tag}.${classes}` : tag,
            transition,
            property: style.transitionProperty,
            duration: style.transitionDuration,
            timingFunction: style.transitionTimingFunction,
            delay: style.transitionDelay,
          });
        }
      }
    });

    return results.slice(0, 40);
  });

  // ─── 2. ANIMAÇÕES CSS (@keyframes) ───────────────────────────────────────
  console.log('Extraindo animações...');
  report.animations = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // Animações ativas nos elementos
    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const animation = style.animation;
      if (animation && animation !== 'none 0s ease 0s 1 normal none running') {
        const key = style.animationName;
        if (key !== 'none' && !seen.has(key)) {
          seen.add(key);
          results.push({
            name: key,
            duration: style.animationDuration,
            timingFunction: style.animationTimingFunction,
            delay: style.animationDelay,
            iterationCount: style.animationIterationCount,
            direction: style.animationDirection,
            fillMode: style.animationFillMode,
          });
        }
      }
    });

    // @keyframes dos stylesheets
    const keyframes = [];
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          Array.from(sheet.cssRules || []).forEach((rule) => {
            if (rule instanceof CSSKeyframesRule) {
              const steps = [];
              Array.from(rule.cssRules).forEach((step) => {
                steps.push({
                  keyText: step.keyText,
                  properties: step.style.cssText,
                });
              });
              keyframes.push({ name: rule.name, steps });
            }
          });
        } catch (e) {}
      });
    } catch (e) {}

    return { active: results.slice(0, 20), keyframes: keyframes.slice(0, 15) };
  });

  // ─── 3. EASING / TIMING FUNCTIONS ÚNICAS ─────────────────────────────────
  console.log('Extraindo timing functions...');
  report.timingFunctions = await page.evaluate(() => {
    const seen = new Map();
    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      ['transitionTimingFunction', 'animationTimingFunction'].forEach(
        (prop) => {
          const val = style[prop];
          if (val && val !== 'ease' && !seen.has(val)) {
            seen.set(val, 0);
          }
          if (val) seen.set(val, (seen.get(val) || 0) + 1);
        }
      );
    });
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([fn, count]) => ({ function: fn, count }));
  });

  // ─── 4. SCROLL BEHAVIOR ──────────────────────────────────────────────────
  console.log('Analisando scroll behavior...');
  report.scrollBehavior = await page.evaluate(() => {
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const bodyStyle = window.getComputedStyle(document.body);

    const stickyElements = [];
    document.querySelectorAll('*').forEach((el) => {
      const pos = window.getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') {
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        stickyElements.push({
          element: classes ? `${tag}.${classes}` : tag,
          position: pos,
          top: window.getComputedStyle(el).top,
        });
      }
    });

    // Detectar scroll suave
    const hasSmoothScroll =
      htmlStyle.scrollBehavior === 'smooth' ||
      bodyStyle.scrollBehavior === 'smooth';

    // Detectar overflow
    const scrollableAreas = [];
    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el !== document.body &&
        el !== document.documentElement
      ) {
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        scrollableAreas.push({
          element: el.tagName.toLowerCase() + (classes ? `.${classes}` : ''),
          overflowY: style.overflowY,
        });
      }
    });

    return {
      smoothScroll: hasSmoothScroll,
      scrollBehavior: htmlStyle.scrollBehavior,
      stickyElements: stickyElements.slice(0, 10),
      scrollableAreas: scrollableAreas.slice(0, 8),
    };
  });

  // ─── 5. HOVER STATES (medir mudanças visuais) ─────────────────────────────
  console.log('Capturando hover states...');
  const interactiveSelectors = [
    'button:not([disabled])',
    'a[href]',
    'nav a',
    '[role="button"]',
  ];

  for (const selector of interactiveSelectors) {
    try {
      const elements = await page.$$(selector);
      const sample = elements.slice(0, 3);

      for (const el of sample) {
        const before = await el.evaluate((node) => {
          const s = window.getComputedStyle(node);
          return {
            bg: s.backgroundColor,
            color: s.color,
            transform: s.transform,
            boxShadow: s.boxShadow,
            opacity: s.opacity,
            border: s.border,
          };
        });

        await el.hover().catch(() => {});
        await page.waitForTimeout(300);

        const after = await el.evaluate((node) => {
          const s = window.getComputedStyle(node);
          return {
            bg: s.backgroundColor,
            color: s.color,
            transform: s.transform,
            boxShadow: s.boxShadow,
            opacity: s.opacity,
            border: s.border,
          };
        });

        const changes = {};
        Object.keys(before).forEach((k) => {
          if (before[k] !== after[k]) {
            changes[k] = { before: before[k], after: after[k] };
          }
        });

        if (Object.keys(changes).length > 0) {
          const tag = await el.evaluate((n) => {
            const t = n.tagName.toLowerCase();
            const c = Array.from(n.classList).slice(0, 2).join('.');
            return c ? `${t}.${c}` : t;
          });

          report.hoverStates.push({ element: tag, selector, changes });
          if (report.hoverStates.length >= 12) break;
        }
      }
      if (report.hoverStates.length >= 12) break;
    } catch (e) {}
  }

  // ─── 6. LOADING / SKELETON PATTERNS ──────────────────────────────────────
  console.log('Detectando loading patterns...');
  report.loadingPatterns = await page.evaluate(() => {
    const patterns = [];

    // Detectar skeleton screens
    const skeletonSelectors = [
      '[class*="skeleton"]',
      '[class*="loading"]',
      '[class*="shimmer"]',
      '[class*="placeholder"]',
      '[class*="pulse"]',
    ];

    skeletonSelectors.forEach((sel) => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        const el = els[0];
        const style = window.getComputedStyle(el);
        patterns.push({
          type: 'skeleton',
          selector: sel,
          count: els.length,
          animation: style.animation,
          background: style.background,
        });
      }
    });

    // Detectar spinners
    const spinnerSelectors = [
      '[class*="spinner"]',
      '[class*="loader"]',
      '[role="progressbar"]',
    ];
    spinnerSelectors.forEach((sel) => {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        patterns.push({ type: 'spinner', selector: sel, count: els.length });
      }
    });

    return patterns;
  });

  // ─── 7. MICRO-INTERAÇÕES ─────────────────────────────────────────────────
  console.log('Mapeando micro-interações...');
  report.microInteractions = await page.evaluate(() => {
    const patterns = [];

    // Focus rings customizados
    const focusStyles = [];
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          Array.from(sheet.cssRules || []).forEach((rule) => {
            if (
              rule.selectorText &&
              rule.selectorText.includes(':focus') &&
              rule.style.outline
            ) {
              focusStyles.push({
                selector: rule.selectorText,
                outline: rule.style.outline,
                boxShadow: rule.style.boxShadow,
              });
            }
          });
        } catch (e) {}
      });
    } catch (e) {}

    if (focusStyles.length > 0) {
      patterns.push({
        type: 'focus-ring',
        description: 'Custom focus styles detectados',
        samples: focusStyles.slice(0, 5),
      });
    }

    // Transforms em elementos interativos
    const transformEls = [];
    document.querySelectorAll('button, a, [role="button"]').forEach((el) => {
      const style = window.getComputedStyle(el);
      if (
        style.transition &&
        style.transition.includes('transform') &&
        style.transform !== 'none'
      ) {
        transformEls.push({
          element: el.tagName.toLowerCase(),
          transform: style.transform,
          transition: style.transition,
        });
      }
    });

    if (transformEls.length > 0) {
      patterns.push({
        type: 'transform-interaction',
        description: 'Elementos com transform em transição',
        samples: transformEls.slice(0, 5),
      });
    }

    // will-change (indica intenção de animação)
    const willChangeEls = [];
    document.querySelectorAll('*').forEach((el) => {
      const wc = window.getComputedStyle(el).willChange;
      if (wc && wc !== 'auto') {
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        willChangeEls.push({
          element:
            el.tagName.toLowerCase() + (classes ? `.${classes}` : ''),
          willChange: wc,
        });
      }
    });
    if (willChangeEls.length > 0) {
      patterns.push({
        type: 'will-change',
        description: 'Elementos com will-change (GPU-accelerated)',
        samples: willChangeEls.slice(0, 8),
      });
    }

    return patterns;
  });

  // ─── 8. ESTRUTURA DE PÁGINA E LAYOUT ─────────────────────────────────────
  console.log('Mapeando estrutura de página...');
  report.pageStructure = await page.evaluate(() => {
    const nav = document.querySelector('nav, header, [role="navigation"]');
    const hero = document.querySelector(
      'section:first-of-type, [class*="hero"], [class*="banner"]'
    );
    const footer = document.querySelector('footer, [role="contentinfo"]');

    return {
      hasNav: !!nav,
      navHeight: nav
        ? Math.round(nav.getBoundingClientRect().height) + 'px'
        : null,
      heroHeight: hero
        ? Math.round(hero.getBoundingClientRect().height) + 'px'
        : null,
      footerPresent: !!footer,
      totalHeight: document.documentElement.scrollHeight + 'px',
      viewportRatio: Math.round(
        document.documentElement.scrollHeight / window.innerHeight
      ),
      sections: document.querySelectorAll('section').length,
      hasBackToTop: !!document.querySelector(
        '[class*="back-to-top"], [class*="scroll-top"]'
      ),
    };
  });

  // ─── 9. PREFERS-REDUCED-MOTION ───────────────────────────────────────────
  report.motionPreferences = await page.evaluate(() => {
    let hasReducedMotion = false;
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          Array.from(sheet.cssRules || []).forEach((rule) => {
            if (
              rule instanceof CSSMediaRule &&
              rule.conditionText &&
              rule.conditionText.includes('prefers-reduced-motion')
            ) {
              hasReducedMotion = true;
            }
          });
        } catch (e) {}
      });
    } catch (e) {}

    return {
      respectsReducedMotion: hasReducedMotion,
      note: hasReducedMotion
        ? 'Site respeita prefers-reduced-motion ✅'
        : 'Site não implementa prefers-reduced-motion ⚠️',
    };
  });

  await browser.close();

  // Salvar JSON
  const hostname = new URL(url.startsWith('http') ? url : `https://${url}`)
    .hostname.replace('www.', '');
  const dir = path.join(outputDir, hostname);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'interactions.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`✅ Interações salvas em ${outPath}`);
  return outPath;
}

extract(url).catch((e) => {
  console.error('Erro na extração:', e.message);
  process.exit(0); // não quebra o workflow
});
