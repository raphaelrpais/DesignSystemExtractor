/**
 * interaction-extractor.js
 * Extrai padrões de interação com modo furtivo (stealth) para contornar
 * proteções anti-bot em sites como Nubank, Stone, Mercado Pago etc.
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

chromium.use(StealthPlugin());

const url = process.argv[2];
if (!url) {
  console.error('Uso: node interaction-extractor.js <url> [outputDir]');
  process.exit(1);
}

const outputDir = process.argv[3] || 'output';

// Viewports e user agents variados para parecer humano
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function extract(targetUrl) {
  const viewport = randomItem(VIEWPORTS);
  const userAgent = randomItem(USER_AGENTS);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    viewport,
    userAgent,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  // Injetar scripts de evasão antes de cada página
  await context.addInitScript(() => {
    // Remover rastros de webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en'],
    });
    // Simular chrome real
    window.chrome = { runtime: {} };
    // Esconder headless
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  });

  const page = await context.newPage();

  const report = {
    url: targetUrl,
    extractedAt: new Date().toISOString(),
    transitions: [],
    animations: { active: [], keyframes: [] },
    timingFunctions: [],
    scrollBehavior: {},
    hoverStates: [],
    loadingPatterns: [],
    microInteractions: [],
    pageStructure: {},
    motionPreferences: {},
  };

  const fullUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
  console.log(`→ Navegando para ${fullUrl}...`);

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Comportamento humano: scroll suave gradual
    await sleep(2000 + Math.random() * 1500);
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = () => {
          window.scrollBy(0, 120);
          y += 120;
          if (y < document.body.scrollHeight * 0.6) {
            setTimeout(step, 80 + Math.random() * 60);
          } else {
            window.scrollTo(0, 0);
            resolve();
          }
        };
        step();
      });
    });

    await sleep(2000 + Math.random() * 1000);

    // ── 1. TRANSIÇÕES ─────────────────────────────────────────────────────
    console.log('  Extraindo transições...');
    report.transitions = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      document.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        const t = s.transition;
        if (t && t !== 'none' && t !== 'all 0s ease 0s' && !seen.has(t)) {
          seen.add(t);
          const tag = el.tagName.toLowerCase();
          const cls = Array.from(el.classList).slice(0, 3).join('.');
          results.push({
            element: cls ? `${tag}.${cls}` : tag,
            transition: t,
            property: s.transitionProperty,
            duration: s.transitionDuration,
            timingFunction: s.transitionTimingFunction,
            delay: s.transitionDelay,
          });
        }
      });
      return results.slice(0, 40);
    });

    // ── 2. ANIMAÇÕES ──────────────────────────────────────────────────────
    console.log('  Extraindo animações...');
    report.animations = await page.evaluate(() => {
      const active = [];
      const seen = new Set();
      document.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        const name = s.animationName;
        if (name && name !== 'none' && !seen.has(name)) {
          seen.add(name);
          active.push({
            name,
            duration: s.animationDuration,
            timingFunction: s.animationTimingFunction,
            delay: s.animationDelay,
            iterationCount: s.animationIterationCount,
            direction: s.animationDirection,
            fillMode: s.animationFillMode,
          });
        }
      });

      const keyframes = [];
      try {
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            Array.from(sheet.cssRules || []).forEach((rule) => {
              if (rule instanceof CSSKeyframesRule) {
                keyframes.push({
                  name: rule.name,
                  steps: Array.from(rule.cssRules).map((s) => ({
                    keyText: s.keyText,
                    properties: s.style.cssText,
                  })),
                });
              }
            });
          } catch (e) {}
        });
      } catch (e) {}

      return { active: active.slice(0, 20), keyframes: keyframes.slice(0, 15) };
    });

    // ── 3. TIMING FUNCTIONS ───────────────────────────────────────────────
    console.log('  Extraindo timing functions...');
    report.timingFunctions = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        ['transitionTimingFunction', 'animationTimingFunction'].forEach((p) => {
          const v = s[p];
          if (v) seen.set(v, (seen.get(v) || 0) + 1);
        });
      });
      return Array.from(seen.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([fn, count]) => ({ function: fn, count }));
    });

    // ── 4. SCROLL BEHAVIOR ────────────────────────────────────────────────
    console.log('  Analisando scroll...');
    report.scrollBehavior = await page.evaluate(() => {
      const hs = window.getComputedStyle(document.documentElement);
      const sticky = [];
      document.querySelectorAll('*').forEach((el) => {
        const pos = window.getComputedStyle(el).position;
        if (pos === 'sticky' || pos === 'fixed') {
          const cls = Array.from(el.classList).slice(0, 2).join('.');
          sticky.push({
            element: el.tagName.toLowerCase() + (cls ? `.${cls}` : ''),
            position: pos,
            top: window.getComputedStyle(el).top,
          });
        }
      });
      return {
        smoothScroll: hs.scrollBehavior === 'smooth',
        scrollBehavior: hs.scrollBehavior,
        stickyElements: sticky.slice(0, 10),
      };
    });

    // ── 5. HOVER STATES ───────────────────────────────────────────────────
    console.log('  Capturando hover states...');
    for (const selector of ['button', 'a[href]', '[role="button"]']) {
      try {
        const elements = await page.$$(selector);
        for (const el of elements.slice(0, 4)) {
          const before = await el.evaluate((n) => {
            const s = window.getComputedStyle(n);
            return { bg: s.backgroundColor, color: s.color, transform: s.transform, boxShadow: s.boxShadow };
          });
          await el.hover().catch(() => {});
          await sleep(350);
          const after = await el.evaluate((n) => {
            const s = window.getComputedStyle(n);
            return { bg: s.backgroundColor, color: s.color, transform: s.transform, boxShadow: s.boxShadow };
          });
          const changes = {};
          Object.keys(before).forEach((k) => {
            if (before[k] !== after[k]) changes[k] = { before: before[k], after: after[k] };
          });
          if (Object.keys(changes).length > 0) {
            const tag = await el.evaluate((n) => {
              const c = Array.from(n.classList).slice(0, 2).join('.');
              return n.tagName.toLowerCase() + (c ? `.${c}` : '');
            });
            report.hoverStates.push({ element: tag, selector, changes });
            if (report.hoverStates.length >= 12) break;
          }
        }
        if (report.hoverStates.length >= 12) break;
      } catch (e) {}
    }

    // ── 6. MICRO-INTERAÇÕES ───────────────────────────────────────────────
    console.log('  Mapeando micro-interações...');
    report.microInteractions = await page.evaluate(() => {
      const patterns = [];
      const focusStyles = [];
      try {
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            Array.from(sheet.cssRules || []).forEach((rule) => {
              if (rule.selectorText?.includes(':focus') && rule.style?.outline) {
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
      if (focusStyles.length)
        patterns.push({ type: 'focus-ring', description: 'Custom focus styles', samples: focusStyles.slice(0, 5) });

      const willChangeEls = [];
      document.querySelectorAll('*').forEach((el) => {
        const wc = window.getComputedStyle(el).willChange;
        if (wc && wc !== 'auto') {
          const c = Array.from(el.classList).slice(0, 2).join('.');
          willChangeEls.push({ element: el.tagName.toLowerCase() + (c ? `.${c}` : ''), willChange: wc });
        }
      });
      if (willChangeEls.length)
        patterns.push({ type: 'will-change', description: 'Elementos com GPU acceleration', samples: willChangeEls.slice(0, 8) });

      return patterns;
    });

    // ── 7. LOADING PATTERNS ───────────────────────────────────────────────
    console.log('  Detectando loading patterns...');
    report.loadingPatterns = await page.evaluate(() => {
      const results = [];
      ['skeleton', 'loading', 'shimmer', 'placeholder', 'pulse', 'spinner', 'loader'].forEach((kw) => {
        const els = document.querySelectorAll(`[class*="${kw}"]`);
        if (els.length > 0) {
          const s = window.getComputedStyle(els[0]);
          results.push({ type: kw, selector: `[class*="${kw}"]`, count: els.length, animation: s.animation });
        }
      });
      return results;
    });

    // ── 8. ESTRUTURA DE PÁGINA ────────────────────────────────────────────
    console.log('  Mapeando estrutura...');
    report.pageStructure = await page.evaluate(() => {
      const nav = document.querySelector('nav, header, [role="navigation"]');
      const hero = document.querySelector('[class*="hero"], [class*="banner"], section:first-of-type');
      return {
        navHeight: nav ? Math.round(nav.getBoundingClientRect().height) + 'px' : null,
        heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) + 'px' : null,
        totalHeight: document.documentElement.scrollHeight + 'px',
        viewportRatio: Math.round(document.documentElement.scrollHeight / window.innerHeight),
        sections: document.querySelectorAll('section').length,
        hasBackToTop: !!document.querySelector('[class*="back-to-top"], [class*="scroll-top"]'),
      };
    });

    // ── 9. PREFERS-REDUCED-MOTION ─────────────────────────────────────────
    report.motionPreferences = await page.evaluate(() => {
      let found = false;
      try {
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            Array.from(sheet.cssRules || []).forEach((rule) => {
              if (rule instanceof CSSMediaRule && rule.conditionText?.includes('prefers-reduced-motion')) found = true;
            });
          } catch (e) {}
        });
      } catch (e) {}
      return {
        respectsReducedMotion: found,
        note: found ? 'Site respeita prefers-reduced-motion ✅' : 'Site não implementa prefers-reduced-motion ⚠️',
      };
    });

  } catch (err) {
    console.warn(`  ⚠️ Erro durante extração: ${err.message}`);
    report.extractionError = err.message;
  }

  await browser.close();

  // Salvar
  const hostname = new URL(fullUrl).hostname.replace('www.', '');
  const dir = path.join(outputDir, hostname);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'interactions.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`  ✅ Interações salvas em ${outPath}`);
}

extract(url).catch((e) => {
  console.error('Erro fatal:', e.message);
  process.exit(0);
});
