/**
 * combine-reports.js
 * Combina o output do dembrandt (design tokens) com o interaction-extractor
 * em um único relatório Markdown por site.
 */

const fs = require('fs');
const path = require('path');

const siteDir = process.argv[2];
if (!siteDir) {
  console.error('Uso: node combine-reports.js <diretório-do-site>');
  process.exit(1);
}

// Carregar JSONs
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Encontrar o JSON do dembrandt (nome tem timestamp)
function findDembrandtJSON(dir) {
  try {
    const files = fs.readdirSync(dir);
    const file = files.find(
      (f) => f.endsWith('.json') && f !== 'interactions.json'
    );
    return file ? path.join(dir, file) : null;
  } catch (e) {
    return null;
  }
}

const dembrandtPath = findDembrandtJSON(siteDir);
const interactionsPath = path.join(siteDir, 'interactions.json');

const design = loadJSON(dembrandtPath);
const interactions = loadJSON(interactionsPath);

if (!design && !interactions) {
  console.error('Nenhum JSON encontrado em', siteDir);
  process.exit(1);
}

const siteName = path.basename(siteDir);
const md = [];

// ─── HEADER ─────────────────────────────────────────────────────────────────
md.push(`# Design System — ${siteName}`);
md.push(`> Relatório combinado: tokens visuais (dembrandt) + padrões de interação (Playwright)  `);
md.push(`> Extraído em: ${(design || interactions)?.extractedAt?.slice(0, 10) || 'N/A'}  `);
md.push(`> URL: ${(design || interactions)?.url || siteName}\n`);
md.push('---\n');

// ─── SEÇÃO 1: CORES ──────────────────────────────────────────────────────────
if (design?.colors) {
  md.push('## 🎨 Cores\n');

  if (design.colors.semantic) {
    md.push('### Cores Semânticas\n');
    md.push('| Papel | Valor |');
    md.push('|-------|-------|');
    Object.entries(design.colors.semantic).forEach(([k, v]) => {
      md.push(`| \`${k}\` | \`${v}\` |`);
    });
    md.push('');
  }

  const highConfidence = design.colors.palette?.filter(
    (c) => c.confidence === 'high'
  );
  if (highConfidence?.length) {
    md.push('### Paleta Principal\n');
    md.push('| Hex | Ocorrências | Fontes |');
    md.push('|-----|-------------|--------|');
    highConfidence.slice(0, 8).forEach((c) => {
      const sources = c.sources?.slice(0, 2).join(', ') || '—';
      md.push(`| \`${c.normalized}\` | ${c.count} | ${sources} |`);
    });
    md.push('');
  }

  const cssVars = design.colors.cssVariables;
  if (cssVars && Object.keys(cssVars).length > 0) {
    md.push('### CSS Variables (seleção)\n');
    md.push('```css');
    Object.entries(cssVars)
      .slice(0, 12)
      .forEach(([k, v]) => {
        md.push(`${k}: ${v.value};`);
      });
    md.push('```\n');
  }
}

// ─── SEÇÃO 2: TIPOGRAFIA ──────────────────────────────────────────────────────
if (design?.typography?.styles?.length) {
  md.push('## 🔤 Tipografia\n');

  const firstStyle = design.typography.styles[0];
  md.push(
    `**Família principal:** \`${firstStyle.family}\` — fallback: \`${firstStyle.fallbacks}\`\n`
  );

  md.push('| Contexto | Tamanho | Peso | Line Height | Letter Spacing |');
  md.push('|----------|---------|------|-------------|----------------|');

  const seen = new Set();
  design.typography.styles.forEach((s) => {
    const key = `${s.context}-${s.size}-${s.weight}`;
    if (seen.has(key)) return;
    seen.add(key);
    md.push(
      `| ${s.context} | ${s.size} | ${s.weight} | ${s.lineHeight || '—'} | ${s.spacing || '—'} |`
    );
  });
  md.push('');
}

// ─── SEÇÃO 3: ESPAÇAMENTO ────────────────────────────────────────────────────
if (design?.spacing) {
  md.push('## 📐 Espaçamento\n');
  md.push(`**Base unit:** \`${design.spacing.scaleType || 'N/A'}\`\n`);

  if (design.spacing.commonValues?.length) {
    md.push('| Valor | Rem | Ocorrências |');
    md.push('|-------|-----|-------------|');
    design.spacing.commonValues.slice(0, 15).forEach((s) => {
      md.push(`| \`${s.px}\` | \`${s.rem}\` | ${s.count} |`);
    });
    md.push('');
  }
}

// ─── SEÇÃO 4: BORDER RADIUS ──────────────────────────────────────────────────
if (design?.borderRadius?.values?.length) {
  md.push('## 🔲 Border Radius\n');
  md.push('| Valor | Contagem | Elementos | Confiança |');
  md.push('|-------|----------|-----------|-----------|');
  design.borderRadius.values
    .filter((b) => b.confidence !== 'low')
    .forEach((b) => {
      const elems = b.elements?.slice(0, 3).join(', ') || '—';
      md.push(`| \`${b.value}\` | ${b.count} | ${elems} | ${b.confidence} |`);
    });
  md.push('');
}

// ─── SEÇÃO 5: SOMBRAS ────────────────────────────────────────────────────────
if (design?.shadows?.length) {
  md.push('## 🌑 Sombras\n');
  md.push('```css');
  design.shadows.forEach((s) => {
    md.push(`/* confiança: ${s.confidence}, count: ${s.count} */`);
    md.push(`box-shadow: ${s.shadow};`);
    md.push('');
  });
  md.push('```\n');
}

// ─── SEÇÃO 6: COMPONENTES ────────────────────────────────────────────────────
if (design?.components) {
  md.push('## 🧩 Componentes\n');

  if (design.components.buttons?.length) {
    md.push('### Botões\n');
    design.components.buttons
      .filter((b) => b.confidence !== 'low')
      .slice(0, 5)
      .forEach((btn, i) => {
        const s = btn.states.default;
        if (!s) return;
        md.push(`**Variante ${i + 1}**`);
        md.push('```css');
        md.push(`background-color: ${s.backgroundColor};`);
        md.push(`color:            ${s.color};`);
        md.push(`padding:          ${s.padding};`);
        md.push(`border-radius:    ${s.borderRadius};`);
        md.push(`border:           ${s.border};`);
        md.push(`font-size:        ${btn.fontSize};`);
        md.push(`font-weight:      ${btn.fontWeight};`);
        md.push('```\n');
      });
  }

  if (design.components.links?.length) {
    md.push('### Links\n');
    md.push('| Cor | Decoração | Peso |');
    md.push('|-----|-----------|------|');
    design.components.links.slice(0, 6).forEach((l) => {
      md.push(`| \`${l.color}\` | ${l.textDecoration} | ${l.fontWeight} |`);
    });
    md.push('');
  }
}

// ─── SEÇÃO 7: TRANSIÇÕES ─────────────────────────────────────────────────────
if (interactions?.transitions?.length) {
  md.push('---\n');
  md.push('## ⚡ Transições CSS\n');
  md.push('| Elemento | Propriedade | Duração | Easing | Delay |');
  md.push('|----------|-------------|---------|--------|-------|');
  interactions.transitions.slice(0, 15).forEach((t) => {
    md.push(
      `| \`${t.element}\` | ${t.property} | ${t.duration} | ${t.timingFunction} | ${t.delay} |`
    );
  });
  md.push('');
}

// ─── SEÇÃO 8: ANIMAÇÕES ──────────────────────────────────────────────────────
if (interactions?.animations) {
  const { active, keyframes } = interactions.animations;

  if (active?.length) {
    md.push('## 🎬 Animações Ativas\n');
    md.push('| Nome | Duração | Easing | Iteração | Fill Mode |');
    md.push('|------|---------|--------|----------|-----------|');
    active.forEach((a) => {
      md.push(
        `| \`${a.name}\` | ${a.duration} | ${a.timingFunction} | ${a.iterationCount} | ${a.fillMode} |`
      );
    });
    md.push('');
  }

  if (keyframes?.length) {
    md.push('### @keyframes Detectados\n');
    keyframes.slice(0, 8).forEach((kf) => {
      md.push(`**\`@keyframes ${kf.name}\`**`);
      md.push('```css');
      kf.steps?.forEach((step) => {
        md.push(`  ${step.keyText} { ${step.properties} }`);
      });
      md.push('```\n');
    });
  }
}

// ─── SEÇÃO 9: EASING / TIMING FUNCTIONS ──────────────────────────────────────
if (interactions?.timingFunctions?.length) {
  md.push('## 📈 Timing Functions\n');
  md.push('| Função | Ocorrências |');
  md.push('|--------|-------------|');
  interactions.timingFunctions.forEach((t) => {
    md.push(`| \`${t.function}\` | ${t.count} |`);
  });
  md.push('');
}

// ─── SEÇÃO 10: HOVER STATES ───────────────────────────────────────────────────
if (interactions?.hoverStates?.length) {
  md.push('## 🖱️ Hover States\n');
  interactions.hoverStates.slice(0, 10).forEach((h) => {
    md.push(`**\`${h.element}\`**\n`);
    md.push('| Propriedade | Antes | Depois |');
    md.push('|-------------|-------|--------|');
    Object.entries(h.changes).forEach(([prop, val]) => {
      md.push(`| ${prop} | \`${val.before}\` | \`${val.after}\` |`);
    });
    md.push('');
  });
}

// ─── SEÇÃO 11: SCROLL BEHAVIOR ───────────────────────────────────────────────
if (interactions?.scrollBehavior) {
  const sb = interactions.scrollBehavior;
  md.push('## 🖱️ Scroll Behavior\n');
  md.push(`- **Smooth scroll:** ${sb.smoothScroll ? '✅ Sim' : '❌ Não'}`);
  md.push(`- **scroll-behavior:** \`${sb.scrollBehavior || 'auto'}\``);
  md.push(`- **Elementos sticky/fixed:** ${sb.stickyElements?.length || 0}`);

  if (sb.stickyElements?.length) {
    md.push('\n| Elemento | Position | Top |');
    md.push('|----------|----------|-----|');
    sb.stickyElements.forEach((el) => {
      md.push(`| \`${el.element}\` | ${el.position} | ${el.top} |`);
    });
  }
  md.push('');
}

// ─── SEÇÃO 12: MICRO-INTERAÇÕES ──────────────────────────────────────────────
if (interactions?.microInteractions?.length) {
  md.push('## ✨ Micro-interações\n');
  interactions.microInteractions.forEach((m) => {
    md.push(`### ${m.type}\n`);
    md.push(`${m.description}\n`);
    if (m.samples?.length) {
      md.push('```json');
      md.push(JSON.stringify(m.samples.slice(0, 3), null, 2));
      md.push('```\n');
    }
  });
}

// ─── SEÇÃO 13: LOADING PATTERNS ──────────────────────────────────────────────
if (interactions?.loadingPatterns?.length) {
  md.push('## ⏳ Loading Patterns\n');
  interactions.loadingPatterns.forEach((p) => {
    md.push(
      `- **${p.type}** — selector: \`${p.selector}\`, count: ${p.count}`
    );
    if (p.animation) md.push(`  - animation: \`${p.animation}\``);
  });
  md.push('');
}

// ─── SEÇÃO 14: ESTRUTURA DE PÁGINA ───────────────────────────────────────────
if (interactions?.pageStructure) {
  const ps = interactions.pageStructure;
  md.push('## 🏗️ Estrutura de Página\n');
  md.push(`| Métrica | Valor |`);
  md.push(`|---------|-------|`);
  md.push(`| Altura total | ${ps.totalHeight} |`);
  md.push(`| Altura nav | ${ps.navHeight || '—'} |`);
  md.push(`| Altura hero | ${ps.heroHeight || '—'} |`);
  md.push(`| Número de sections | ${ps.sections} |`);
  md.push(`| Scroll depth (x viewport) | ${ps.viewportRatio}x |`);
  md.push(`| Back-to-top | ${ps.hasBackToTop ? '✅' : '❌'} |`);
  md.push('');
}

// ─── SEÇÃO 15: ACESSIBILIDADE DE MOVIMENTO ────────────────────────────────────
if (interactions?.motionPreferences) {
  md.push('## ♿ Acessibilidade de Movimento\n');
  md.push(interactions.motionPreferences.note);
  md.push('');
}

// ─── SEÇÃO 16: FRAMEWORKS ────────────────────────────────────────────────────
if (design?.frameworks?.length) {
  md.push('---\n');
  md.push('## 🔧 Frameworks Detectados\n');
  design.frameworks.forEach((f) => {
    md.push(`- **${f.name}** — confiança: ${f.confidence} (${f.evidence})`);
  });
  md.push('');
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────
md.push('---\n');
md.push('> Gerado por: dembrandt (tokens) + interaction-extractor (comportamento)');

// Salvar com nome do domínio — ex: design-system-Stripe.md
const domainRaw = path.basename(siteDir); // ex: stripe.com
const domainLabel = domainRaw
  .replace(/\.(com|com\.br|br|io|co).*$/, '') // remove TLD
  .replace(/^www\./, '')                        // remove www
  .replace(/^./, (c) => c.toUpperCase());        // capitaliza primeira letra

const outPath = path.join(siteDir, `design-system-${domainLabel}.md`);
fs.writeFileSync(outPath, md.join('\n'));
console.log(`✅ Relatório salvo em ${outPath}`);
