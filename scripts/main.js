import { rsvpService } from './rsvp.js';

const motion = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------------ menu (celular)
const menu = document.querySelector('.mobile-menu');
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.open = false; }));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });

// ------------------------------------------------------------------ confirmar presença
// O botão da seção abre o formulário no próprio lugar; qualquer link para #rsvp também o abre.
const rsvpOpen = document.querySelector('.rsvp-open');
const form = document.querySelector('#rsvp-form');
function openRsvp(focus) {
  if (!form.hidden) return;
  form.hidden = false;
  form.classList.add('is-open');
  rsvpOpen.setAttribute('aria-expanded', 'true');
  rsvpOpen.hidden = true;
  if (focus) form.elements.name.focus({ preventScroll: true });
}
rsvpOpen.addEventListener('click', () => openRsvp(true));
document.querySelectorAll('[data-open-rsvp]').forEach(a => a.addEventListener('click', () => openRsvp(false)));
if (location.hash === '#rsvp') openRsvp(false);

const submit = document.querySelector('#rsvp-submit');
const status = document.querySelector('#rsvp-status');
for (const input of form.querySelectorAll('input')) {
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true' && input.checkValidity()) input.removeAttribute('aria-invalid'); });
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  let firstInvalid = null;
  for (const input of form.querySelectorAll('input')) {
    const ok = input.checkValidity();
    input.toggleAttribute('aria-invalid', !ok);
    if (!ok) input.setAttribute('aria-invalid', 'true');
    if (!ok && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) { form.reportValidity(); firstInvalid.focus(); return; }
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.hidden = true;
  try {
    // A UI consome apenas { status, message }. Nada é enviado nem simulado aqui (ver rsvp.js).
    const result = await rsvpService.submit({ name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim() });
    status.textContent = result.message;
    status.dataset.state = result.status;
  } catch {
    status.textContent = 'Não foi possível continuar. Sua presença não foi confirmada. Tente novamente mais tarde.';
    status.dataset.state = 'error';
  } finally {
    status.hidden = false;
    submit.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

// ------------------------------------------------------------------ convite
const envelope = document.querySelector('.envelope');
const inviteBtn = document.querySelector('.invite-btn');
function toggleInvite() {
  const open = envelope.dataset.open !== 'true';
  envelope.dataset.open = String(open);
  inviteBtn.setAttribute('aria-expanded', String(open));
}
inviteBtn.addEventListener('click', toggleInvite);
envelope.querySelector('.env-hit').addEventListener('click', toggleInvite);

// ------------------------------------------------------------------ atalho fixo (celular)
const hero = document.querySelector('.hero');
const shortcut = document.querySelector('.mobile-rsvp');
const rsvpBlock = document.querySelector('#rsvp');
let heroIn = true, rsvpIn = false;
const setShortcut = () => shortcut.classList.toggle('is-visible', !heroIn && !rsvpIn);
new IntersectionObserver(([e]) => { heroIn = e.isIntersecting; setShortcut(); }).observe(hero);
new IntersectionObserver(([e]) => { rsvpIn = e.isIntersecting; setShortcut(); }).observe(rsvpBlock);

// ------------------------------------------------------------------ revelações únicas
// Acontecem uma vez; ao voltar à seção, o estado final permanece (nada a reassistir).
const reveal = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
}, { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('[data-reveal]').forEach(el => reveal.observe(el));

// ------------------------------------------------------------------ movimento ligado ao scroll
// O scroll da página é o nativo (nunca sequestrado). O que se move com ele — fotos, moldura do
// hero, casamento, envelope, final — segue a posição com uma inércia curta (amortecimento
// exponencial), em vez de andar aos degraus a cada passo da roda/dedo. Os alvos dependem só da
// posição atual: voltar a uma seção dá sempre o mesmo resultado. Parado e assentado, nada é
// desenhado. Com "reduzir movimento", nada roda e o CSS mostra a página estática.
const $ = s => document.querySelector(s);
const story = $('.story'), wedding = $('.wedding'), invite = $('.invite'), closing = $('.closing');
const clamp01 = v => Math.max(0, Math.min(1, v));
const layers = [...document.querySelectorAll('[data-parallax]')].map(el => ({ el, img: el.querySelector('img'), scale: 1.1, h: 0 }));
// medidas fixas lidas só no resize (a moldura pode estar transformada; offsetHeight não é afetado)
function updateScales() {
  for (const l of layers) { if (l.img) l.scale = parseFloat(getComputedStyle(l.img).getPropertyValue('--s')) || 1.1; l.h = l.el.offsetHeight; }
}
updateScales();

// canais suavizados: [elemento, variável, casas decimais, sufixo]
const channels = [
  [hero, '--hp', 4, ''], [story, '--sp', 4, ''], [wedding, '--wp', 4, ''], [envelope, '--ep', 4, ''],
  [closing, '--cin', 4, ''], [closing, '--cp', 4, ''],
  ...layers.map(l => [l.img, '--py', 1, 'px']),
].map(([el, name, dp, unit]) => ({ el, name, dp, unit, cur: null, target: 0, written: '' }));
const SMOOTH = 12;    // 1/s: ~80 ms — só arredonda; a suavidade principal vem da rolagem abaixo

function measure() {
  const vh = innerHeight;
  const rh = hero.getBoundingClientRect(), rs = story.getBoundingClientRect(), rw = wedding.getBoundingClientRect();
  const ri = invite.getBoundingClientRect(), rc = closing.getBoundingClientRect();
  const targets = [
    clamp01(-rh.top / rh.height),
    clamp01((vh - rs.top) / (vh + rs.height)),
    clamp01((vh - rw.top) / (vh * .78)),
    clamp01((vh - ri.top) / (vh * .7)),
    clamp01((vh - rc.top) / (vh * .6)),
    clamp01((vh - rc.top) / Math.max(1, rc.height)),
    ...layers.map(l => {
      const r = l.el.parentElement.getBoundingClientRect();
      const slack = l.h * (l.scale - 1) / 2;
      return Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2))) * slack * .9;
    }),
  ];
  targets.forEach((v, i) => { channels[i].target = v; });
}

let frame = 0, last = 0, active = true;
function tick(now) {
  frame = 0;
  if (motion.matches) return;
  const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
  measure();
  const k = 1 - Math.exp(-SMOOTH * dt);
  let moving = false;
  for (const c of channels) {
    if (!c.el) continue;
    if (c.cur === null) c.cur = c.target;                     // primeiro quadro: sem animação
    else c.cur += (c.target - c.cur) * k;
    const eps = c.unit ? .05 : .0004;
    if (Math.abs(c.target - c.cur) < eps) c.cur = c.target; else moving = true;
    const s = c.cur.toFixed(c.dp) + c.unit;
    if (s !== c.written) { c.el.style.setProperty(c.name, s); c.written = s; }
  }
  if (moving) frame = requestAnimationFrame(tick); else last = 0;
}
function request() { if (!frame && active && !motion.matches) frame = requestAnimationFrame(tick); }
addEventListener('scroll', request, { passive: true });
addEventListener('resize', () => { updateScales(); request(); }, { passive: true });
document.addEventListener('visibilitychange', () => { active = !document.hidden; last = 0; request(); });
motion.addEventListener('change', () => {
  for (const c of channels) { c.el && c.el.style.removeProperty(c.name); c.cur = null; c.written = ''; }
  request();
});
tick(performance.now());

// ------------------------------------------------------------------ rolagem suave (roda do mouse e trackpad)
// A pedido: a página desliza com inércia em vez de andar aos degraus. Só a roda/trackpad é
// interceptada; toque (celular), teclado, barra de rolagem e links continuam nativos e ficam
// sincronizados. Desligada com "reduzir movimento", com Ctrl/⌘ (zoom) e em rolagem horizontal.
const smooth = (() => {
  // Perfil de velocidade quase linear: acelera suave (ACC), cruza em velocidade constante (VMAX)
  // e freia com desaceleração constante (DEC) até parar exatamente no alvo.
  const VMAX = 1500, ACC = 2000, DEC = 1600;   // px/s, px/s², px/s²
  let target = scrollY, current = scrollY, v = 0, raf = 0, last = 0, expected = -1;
  const max = () => document.documentElement.scrollHeight - innerHeight;
  function frame(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
    const dist = target - current;
    const want = Math.sign(dist) * Math.min(VMAX, Math.sqrt(2 * DEC * Math.abs(dist)));
    const dv = want - v, lim = (Math.sign(dv) === Math.sign(v) ? ACC : DEC) * dt;
    v += Math.max(-lim, Math.min(lim, dv));
    current += v * dt;
    // nunca passa do alvo: chegou (ou cruzou) → para exatamente nele
    if (Math.sign(target - current) !== Math.sign(dist) || (Math.abs(target - current) < .5 && Math.abs(v) < 30)) { current = target; v = 0; }
    expected = current;
    scrollTo({ top: current, behavior: 'instant' });
    if (current !== target) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
  }
  function sync() { target = current = scrollY; v = 0; expected = -1; }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; } sync(); }
  addEventListener('wheel', e => {
    if (motion.matches || e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    stopGlide();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    if (!raf) { current = scrollY; target = scrollY; }
    target = Math.max(0, Math.min(max(), target + e.deltaY * unit));
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: false });
  // rolagem vinda de fora (barra, teclado, toque, links): assume a posição sem brigar
  addEventListener('scroll', () => { if (Math.abs(scrollY - expected) > 2) { if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; } sync(); } }, { passive: true });
  addEventListener('resize', () => { target = Math.min(target, max()); }, { passive: true });
  return { sync, stop };
})();

// ------------------------------------------------------------------ links internos: deslize próprio
// Troca o salto do navegador por um deslize com aceleração e freada (duração pela distância).
// Qualquer gesto do usuário (roda, toque, tecla) interrompe na hora. Não altera o scroll comum.
let glide = 0;
const stopGlide = () => { if (glide) { cancelAnimationFrame(glide); glide = 0; smooth.sync(); } };
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, stopGlide, { passive: true }));
function glideTo(y, done) {
  stopGlide();
  smooth.stop();
  const from = scrollY, dist = y - from;
  if (motion.matches || Math.abs(dist) < 2) { scrollTo({ top: y, behavior: 'instant' }); done && done(); return; }
  const dur = Math.min(1500, 650 + Math.abs(dist) * .22);
  const t0 = performance.now();
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    scrollTo({ top: from + dist * ease(p), behavior: 'instant' });
    if (p < 1) glide = requestAnimationFrame(step); else { glide = 0; smooth.sync(); done && done(); }
  };
  glide = requestAnimationFrame(step);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  const y = Math.max(0, target.getBoundingClientRect().top + scrollY);
  history.pushState(null, '', a.getAttribute('href'));
  glideTo(y, () => { if (target.tabIndex >= 0 || target.hasAttribute('tabindex')) target.focus({ preventScroll: true }); });
});
