// A local design preference for comparing name fonts in the preview.
(() => {
  const picker = document.querySelector('.font-preview');
  if (!picker) return;
  const options = [...picker.querySelectorAll('[data-font-option]')];
  const validFonts = new Set(options.map((button) => button.dataset.fontOption));
  let selected = 'source-sans-3';
  try {
    const saved = localStorage.getItem('name-font-preview');
    if (validFonts.has(saved)) selected = saved;
  } catch (_) { /* Font selection also works when browser storage is disabled. */ }
  function select(font) {
    if (!validFonts.has(font)) return;
    document.documentElement.dataset.nameFont = font;
    options.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.fontOption === font));
    });
  }
  select(selected);
  if (new URLSearchParams(location.search).get('fonts') !== '1') return;
  picker.hidden = false;
  options.forEach((button) => button.addEventListener('click', () => {
    select(button.dataset.fontOption);
    try { localStorage.setItem('name-font-preview', button.dataset.fontOption); } catch (_) {}
  }));
})();

// The site remains readable without JavaScript. Video providers load on demand.
document.querySelectorAll('.video-play').forEach((button) => {
  button.hidden = false;
  button.addEventListener('click', () => {
    const shell = button.closest('.video-shell');
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${shell.dataset.video}?autoplay=1&rel=0`;
    frame.title = shell.dataset.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    shell.replaceChildren(frame);
    frame.focus();
  });
});
const printButton = document.querySelector('.print-button');
if (printButton) {
  printButton.hidden = false;
  printButton.addEventListener('click', () => window.print());
}

// Curated project banners. No generation service or randomization is involved.
document.querySelectorAll('.project-banner').forEach((banner) => {
  const slides = [...banner.querySelectorAll('.banner-slide')];
  const track = banner.querySelector('.banner-slides');
  const controls = banner.querySelector('.banner-controls');
  const count = banner.querySelector('.banner-count');
  const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = slides.findIndex((slide) => !slide.hidden);
  let playing = true;
  let autoAdvance = true;
  let inView = true;
  let timer;
  let playbackAttempt = 0;
  let hoverExpanded = false;
  let expanded = false;
  let canExpand = false;

  controls.hidden = false;
  banner.classList.add('is-enhanced');

  function sync() {
    clearTimeout(timer);
    const attempt = ++playbackAttempt;
    const active = playing && inView && !document.hidden;
    track.setAttribute('aria-live', playing && autoAdvance ? 'off' : 'polite');
    banner.dataset.playback = active ? 'loading' : 'paused';
    count.textContent = `${index + 1} / ${slides.length}`;
    slides.forEach((slide, i) => {
      slide.hidden = i !== index;
      const video = slide.querySelector('video');
      const directLink = slide.querySelector('.banner-file');
      if (directLink) directLink.hidden = playing;
      if (!video) return;
      if (active && i === index) {
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.autoplay = true;
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        else if (video.error) video.load();
        video.play().then(() => {
          if (attempt === playbackAttempt) banner.dataset.playback = 'playing';
        }).catch((error) => {
          if (attempt !== playbackAttempt || error.name === 'AbortError') return;
          // When autoplay is unavailable, keep the still frame and expose the
          // direct movie link in the caption rather than adding an overlay.
          playing = false;
          autoAdvance = false;
          sync();
        });
      } else {
        video.autoplay = false;
        video.pause();
      }
    });
    scheduleAdvance();
    sizeFrame();
  }

  function scheduleAdvance() {
    clearTimeout(timer);
    if (playing && inView && !document.hidden && autoAdvance && !expanded && slides.length > 1) {
      timer = setTimeout(() => show(index + 1), Number(banner.dataset.interval));
    }
  }

  function sizeFrame() {
    const media = slides[index].querySelector('.banner-media');
    const video = media.querySelector('video');
    const poster = media.querySelector('img');
    const width = video?.videoWidth || poster.naturalWidth;
    const height = video?.videoHeight || poster.naturalHeight;
    const compactHeight = parseFloat(getComputedStyle(banner).getPropertyValue('--banner-compact-height'));
    const naturalHeight = width && height ? media.clientWidth * height / width : compactHeight;
    const compactFit = media.classList.contains('banner-media--wave') && window.innerWidth > 560 ? 'contain' : 'cover';
    canExpand = Boolean(video && width && compactFit === 'cover' && Math.abs(naturalHeight - compactHeight) > 2);
    media.classList.toggle('banner-media--wide', naturalHeight < compactHeight);
    banner.style.setProperty('--banner-expanded-height', `${Math.max(compactHeight, naturalHeight)}px`);
    if (!canExpand) hoverExpanded = false;
    setExpanded();
  }

  function setExpanded() {
    const previous = expanded;
    expanded = canExpand && hoverExpanded;
    banner.classList.toggle('is-expanded', expanded);
    if (previous !== expanded) scheduleAdvance();
  }

  // Keep the same video element and playback position while revealing its frame.
  slides.forEach((slide) => {
    const media = slide.querySelector('.banner-media');
    media.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || !hoverPointer.matches) return;
      hoverExpanded = true;
      sizeFrame();
    });
    media.querySelector('img').addEventListener('load', sizeFrame);
    media.querySelector('video')?.addEventListener('loadedmetadata', sizeFrame);
  });
  banner.addEventListener('pointerleave', () => {
    hoverExpanded = false;
    setExpanded();
  });
  // The revealed part of an expanded movie is visual context, not an
  // additional hover target. Leaving the original compact frame folds it back.
  banner.addEventListener('pointermove', (event) => {
    if (!expanded || event.pointerType !== 'mouse' || !hoverPointer.matches) return;
    const media = slides[index].querySelector('.banner-media');
    const bounds = media.getBoundingClientRect();
    const compactHeight = parseFloat(getComputedStyle(banner).getPropertyValue('--banner-compact-height'));
    const inCompactFrame = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.top + compactHeight;
    if (!inCompactFrame) {
      hoverExpanded = false;
      setExpanded();
    }
  });
  if ('ResizeObserver' in window) {
    let previousWidth = 0;
    new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === previousWidth) return;
      previousWidth = entry.contentRect.width;
      sizeFrame();
    }).observe(banner);
  }
  window.addEventListener('resize', sizeFrame);

  function show(next, manual = false) {
    const oldVideo = slides[index].querySelector('video');
    if (oldVideo) {
      oldVideo.pause();
      oldVideo.currentTime = 0;
    }
    index = (next + slides.length) % slides.length;
    // Keep the selected movie visible until the visitor chooses another one.
    if (manual) autoAdvance = false;
    sync();
  }

  slides.forEach((slide, i) => {
    slide.querySelector('video')?.addEventListener('error', () => {
      if (i === index && playing) { playing = false; sync(); }
    });
  });
  banner.querySelector('.banner-previous').addEventListener('click', () => show(index - 1, true));
  banner.querySelector('.banner-next').addEventListener('click', () => show(index + 1, true));
  // Keyboard users can follow the project link without it moving underneath them.
  banner.addEventListener('focusin', () => {
    if (autoAdvance) { autoAdvance = false; sync(); }
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { playing = false; sync(); }
  });
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { threshold: 0 }).observe(banner);
  }
  sync();
});
