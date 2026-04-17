/* ================================================================
   home.js  –  Strumify  (Fixed)
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── SCROLL HEADER ─────────────────────────────────────────── */
  let lastScroll = 0;
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    const cur = window.pageYOffset;
    if (cur > lastScroll && cur > 120) {
      header?.style.setProperty('transform', 'translateY(-100%)');
    } else {
      header?.style.setProperty('transform', 'translateY(0)');
    }
    lastScroll = cur;
  });

  /* ── INTERSECTION OBSERVER (scroll-in animation) ───────────── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('show-animate'); });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll(
    '.feature-card, .product-card, .hero-content, .stat-item, ' +
    '.promo-card, .branch-card, .course-card, .testimonial-card'
  ).forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    observer.observe(el);
  });

  /* ── COUNTER ANIMATION ─────────────────────────────────────── */
  const counters = document.querySelectorAll('[data-count]');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      let current  = 0;
      const step   = Math.ceil(target / 60);
      const timer  = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString('vi-VN') + suffix;
      }, 20);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => countObserver.observe(c));

  /* ── SMOOTH SCROLL ─────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('navLinks')?.classList.remove('active');
    });
  });

  /* ── TESTIMONIAL SLIDER ────────────────────────────────────── */
  const slides     = document.querySelectorAll('.testimonial-card');
  const dotsWrap   = document.getElementById('testimonialDots');
  let   curSlide   = 0;

  if (slides.length > 0 && dotsWrap) {
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'ts-dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', `Slide ${i + 1}`);
      d.addEventListener('click', () => goSlide(i));
      dotsWrap.appendChild(d);
    });

    function goSlide(n) {
      slides[curSlide].classList.remove('ts-active');
      dotsWrap.children[curSlide]?.classList.remove('active');
      curSlide = n;
      slides[curSlide].classList.add('ts-active');
      dotsWrap.children[curSlide]?.classList.add('active');
    }

    slides[0].classList.add('ts-active');
    setInterval(() => goSlide((curSlide + 1) % slides.length), 4500);
  }

  /* ── FAQ ACCORDION ─────────────────────────────────────────── */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(x => x.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

});