/* ============================================================
   FENZO ALUMINIUM — Main JavaScript
   ============================================================ */
(function () {
  'use strict';

  /* ---- Preloader ---- */
  window.addEventListener('load', function () {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      setTimeout(() => preloader.classList.add('fade-out'), 400);
    }
  });

  /* ---- Navbar scroll behaviour ---- */
  const navbar = document.querySelector('.navbar-fenzo');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Mobile nav ---- */
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const mobileOverlay = document.querySelector('.mobile-nav-overlay');
  const mobileClose = document.querySelector('.mobile-nav-close');

  function openMobileNav() {
    hamburger && hamburger.classList.add('active');
    mobileNav && mobileNav.classList.add('open');
    mobileOverlay && mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    hamburger && hamburger.classList.remove('active');
    mobileNav && mobileNav.classList.remove('open');
    mobileOverlay && mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger && hamburger.addEventListener('click', openMobileNav);
  mobileClose && mobileClose.addEventListener('click', closeMobileNav);
  mobileOverlay && mobileOverlay.addEventListener('click', closeMobileNav);

  /* ---- Mobile accordion sub-menus ---- */
  document.querySelectorAll('.mobile-nav .has-sub > a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const parent = link.parentElement;
      const sub = parent.querySelector('ul');
      if (sub) {
        sub.style.display = sub.style.display === 'block' ? 'none' : 'block';
      }
    });
  });

  /* ---- Hero Slider ---- */
  const heroSlider = document.querySelector('.hero-bg-slider');
  const heroDots = document.querySelectorAll('.hero-dot');
  let currentSlide = 0;
  let slideCount = 0;
  let slideInterval;

  if (heroSlider) {
    const slides = heroSlider.querySelectorAll('.hero-bg-slide');
    slideCount = slides.length;

    function goToSlide(n) {
      slides[currentSlide].classList.remove('active');
      heroDots[currentSlide] && heroDots[currentSlide].classList.remove('active');
      currentSlide = (n + slideCount) % slideCount;
      slides[currentSlide].classList.add('active');
      heroDots[currentSlide] && heroDots[currentSlide].classList.add('active');
      heroSlider.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    function startSlider() {
      slideInterval = setInterval(() => goToSlide(currentSlide + 1), 6000);
    }

    slides[0] && slides[0].classList.add('active');
    heroDots[0] && heroDots[0].classList.add('active');
    startSlider();

    heroDots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        clearInterval(slideInterval);
        goToSlide(i);
        startSlider();
      });
    });
  }

  /* ---- Testimonial slider ---- */
  const testTrack = document.querySelector('.testimonial-track');
  const testPrev = document.querySelector('.testimonial-btn.prev');
  const testNext = document.querySelector('.testimonial-btn.next');
  let testCurrent = 0;
  let testItems = 0;

  if (testTrack) {
    testItems = testTrack.querySelectorAll('.testimonial-item').length;
    const visibleCount = window.innerWidth > 992 ? 2 : 1;

    function goTestimonial(dir) {
      const max = Math.ceil(testItems / visibleCount) - 1;
      testCurrent = Math.max(0, Math.min(testCurrent + dir, max));
      testTrack.style.transform = `translateX(-${testCurrent * (100 / visibleCount)}%)`;
    }

    testPrev && testPrev.addEventListener('click', () => goTestimonial(-1));
    testNext && testNext.addEventListener('click', () => goTestimonial(1));

    setInterval(() => goTestimonial(1), 5000);
  }

  /* ---- Gallery lightbox ---- */
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox && lightbox.querySelector('img');
  const lightboxClose = document.querySelector('.lightbox-close');
  const lightboxPrev = document.querySelector('.lightbox-prev');
  const lightboxNext = document.querySelector('.lightbox-next');
  let currentGalleryIndex = 0;
  const galleryImages = [];

  galleryItems.forEach((item, i) => {
    const img = item.querySelector('img');
    if (img) galleryImages.push(img.src);
    item.addEventListener('click', () => {
      currentGalleryIndex = i;
      openLightbox(i);
    });
  });

  function openLightbox(i) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = galleryImages[i];
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox && lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  lightboxClose && lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev && lightboxPrev.addEventListener('click', () => {
    currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
    openLightbox(currentGalleryIndex);
  });
  lightboxNext && lightboxNext.addEventListener('click', () => {
    currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length;
    openLightbox(currentGalleryIndex);
  });
  lightbox && lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev && lightboxPrev.click();
    if (e.key === 'ArrowRight') lightboxNext && lightboxNext.click();
  });

  /* ---- Portfolio filter ---- */
  const filterTabs = document.querySelectorAll('.filter-tab');
  const portfolioItems = document.querySelectorAll('.portfolio-filterable');

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;

      portfolioItems.forEach(item => {
        if (filter === 'all' || item.dataset.category === filter) {
          item.style.display = '';
          setTimeout(() => item.style.opacity = '1', 10);
        } else {
          item.style.opacity = '0';
          setTimeout(() => item.style.display = 'none', 300);
        }
      });
    });
  });

  /* ---- Scroll reveal ---- */
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger-children');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  /* ---- Counter animation ---- */
  function animateCounter(el, target, duration) {
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        if (!isNaN(target)) animateCounter(el, target, 2000);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

  /* ---- Contact / Quote Form AJAX ---- */
  document.querySelectorAll('.fenzo-ajax-form').forEach(form => {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        if (data.success) {
          showAlert(form, data.message || 'Thank you! We will contact you shortly.', 'success');
          form.reset();
        } else {
          showAlert(form, data.message || 'Something went wrong. Please try again.', 'error');
        }
      } catch {
        showAlert(form, 'Network error. Please try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  function showAlert(form, msg, type) {
    let alert = form.querySelector('.fenzo-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'fenzo-alert';
      form.prepend(alert);
    }
    alert.style.cssText = `
      padding: 14px 20px; margin-bottom: 20px; border-radius: 6px;
      font-size: 14px; font-weight: 500;
      background: ${type === 'success' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)'};
      border: 1px solid ${type === 'success' ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)'};
      color: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
    `;
    alert.textContent = msg;
    setTimeout(() => alert && alert.remove(), 6000);
  }

  /* ---- Smooth parallax on hero ---- */
  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const heroOverlay = heroSection.querySelector('.hero-overlay');
      if (heroOverlay && scrolled < window.innerHeight) {
        heroOverlay.style.background = `linear-gradient(
          135deg,
          rgba(0,0,0,${0.75 + scrolled * 0.0002}) 0%,
          rgba(0,0,0,${0.45 + scrolled * 0.0001}) 50%,
          rgba(0,0,0,${0.65 + scrolled * 0.0002}) 100%
        )`;
      }
    }, { passive: true });
  }

  /* ---- Active nav link based on current path ---- */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === currentPath || (href !== '/' && currentPath.startsWith(href)))) {
      link.classList.add('active');
    }
  });

  /* ---- Sticky quote button on scroll ---- */
  const stickyQuote = document.querySelector('.sticky-quote-btn');
  if (stickyQuote) {
    window.addEventListener('scroll', () => {
      stickyQuote.style.opacity = window.scrollY > 300 ? '1' : '0';
      stickyQuote.style.pointerEvents = window.scrollY > 300 ? 'auto' : 'none';
    }, { passive: true });
  }

  /* ---- Admin sidebar toggle (mobile) ---- */
  const adminToggle = document.querySelector('.admin-sidebar-toggle');
  const adminSidebar = document.querySelector('.admin-sidebar');
  if (adminToggle && adminSidebar) {
    adminToggle.addEventListener('click', () => {
      adminSidebar.classList.toggle('expanded');
    });
  }

  /* ---- Admin table row actions ---- */
  document.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        e.preventDefault();
      }
    });
  });

  /* ---- Image preview on admin upload ---- */
  document.querySelectorAll('.admin-file-input').forEach(input => {
    input.addEventListener('change', function () {
      const preview = document.getElementById(input.dataset.preview);
      if (preview && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
      }
    });
  });

  /* ---- Color swatch hover label ---- */
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.title = swatch.dataset.name || '';
  });

  console.log('%cFENZO Aluminium Windows & Doors', 'color:#c0c0c0;font-size:18px;font-family:serif;font-weight:700;');
  console.log('%cConnect with Nature', 'color:#888;font-size:13px;font-style:italic;');
})();
