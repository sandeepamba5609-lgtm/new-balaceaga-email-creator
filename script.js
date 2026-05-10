'use strict';

// ─── GLOBALS ───────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
let quill = null;
let logoBase64 = null; // stores uploaded logo as base64 or URL
let selectedBannerIndex = 0;
const STORAGE_KEY = 'nb_emailer_draft_v2';
const DEFAULT_LOGO = 'logo.svg'; // Default New Balance logo shipped with the tool

const BANNER_IMAGES = [
  'https://images.unsplash.com/photo-1618365908648-e71bd5716cba?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1603481546238-487240415921?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1478147424682-16e0431b9c9f?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=600&auto=format&fit=crop'
];

// ─── INIT QUILL RICH TEXT EDITOR ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  const SizeStyle = Quill.import('attributors/style/size');
  SizeStyle.whitelist = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px'];
  Quill.register(SizeStyle, true);

  quill = new Quill('#rte-editor', {
    theme: 'snow',
    modules: {
      toolbar: '#rte-toolbar',
      history: { delay: 500, maxStack: 100, userOnly: true }
    },
    placeholder: 'Write your campaign copy here. Be bold. Be minimal. Make it count.',
    bounds: '#rte-editor'
  });

  // Populate Banner Picker
  const picker = $('banner-picker');
  BANNER_IMAGES.forEach((url, idx) => {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'banner-thumb' + (idx === selectedBannerIndex ? ' active' : '');
    img.onclick = () => {
      selectedBannerIndex = idx;
      document.querySelectorAll('.banner-thumb').forEach(el => el.classList.remove('active'));
      img.classList.add('active');
      updatePreview();
      saveDraft();
    };
    picker.appendChild(img);
  });

  // Live preview on content change
  quill.on('text-change', () => {
    updateBodyPreview();
    saveDraft();
  });

  loadDraft();
  updatePreview();

  // Load default logo as base64 if no draft logo exists
  if (!logoBase64) {
    fetch(DEFAULT_LOGO)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = (e) => {
          logoBase64 = e.target.result;
          applyLogoToUI();
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // Fallback: use path directly (preview only)
        logoBase64 = DEFAULT_LOGO;
        applyLogoToUI();
      });
  }

  // App Theme Toggle
  const appThemeBtn = $('app-theme-toggle');
  appThemeBtn.onclick = () => {
    document.body.classList.toggle('light-app');
    const isLight = document.body.classList.contains('light-app');
    appThemeBtn.textContent = isLight ? '🌙 Dark UI' : '☀️ Light UI';
    localStorage.setItem('nb_app_theme', isLight ? 'light' : 'dark');
  };
  if(localStorage.getItem('nb_app_theme') === 'light') appThemeBtn.click();
});

// ─── LOGO UPLOAD ───────────────────────────────────────────────────
function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Logo must be under 2MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    logoBase64 = e.target.result;
    applyLogoToUI();
    saveDraft();
    showToast('Logo Uploaded', 'success');
  };
  reader.readAsDataURL(file);
}

function applyLogoToUI() {
  if (!logoBase64) return;

  // App header
  $('header-logo-mark').style.display = 'none';
  const headerImg = $('header-logo-img');
  headerImg.src = logoBase64;
  headerImg.style.display = 'block';

  // Email preview header — hide text mark & wordmark, show logo
  $('preview-logo-mark').style.display = 'none';
  $('preview-wordmark').style.display = 'none';
  const previewImg = $('preview-logo-img');
  previewImg.src = logoBase64;
  previewImg.style.display = 'block';

  // Email preview footer
  $('preview-footer-mark').style.display = 'none';
  const footerImg = $('preview-footer-img');
  footerImg.src = logoBase64;
  footerImg.style.display = 'block';

  // Upload area — show thumbnail instead of placeholder
  $('logo-upload-preview').style.display = 'none';
  const previewInUpload = $('logo-preview-img');
  previewInUpload.src = logoBase64;
  previewInUpload.style.display = 'block';

  $('logo-actions').style.display = 'flex';
}

function removeLogo() {
  // Reset to default logo, not to empty
  logoBase64 = DEFAULT_LOGO;
  applyLogoToUI();
  $('logo-file-input').value = '';
  saveDraft();
  showToast('Reset to Default Logo', '');
}

// ─── LIVE PREVIEW UPDATER ─────────────────────────────────────────
function updatePreview() {
  updateHeroTitle();
  updateBodyPreview();
  updateCTAs();
}

const SEASON_LOGOS = {
  'SPRING': '🌸',
  'SUMMER': '☀️',
  'AUTUMN': '🍂',
  'WINTER': '❄️',
  'RESORT': '🌴',
  'PRE-FALL': '🍁'
};

function updateHeroTitle() {
  const nameVal = $('emailer-name').value.trim();
  const seasonVal = $('campaign-season').value;
  const heroEl  = $('preview-hero-title');
  const seasonEl = $('preview-season');

  const logo = SEASON_LOGOS[seasonVal] || '';
  seasonEl.textContent = seasonVal ? `${logo} ${seasonVal} COLLECTION` : '';

  if (nameVal) {
    const words = nameVal.toUpperCase().split(' ');
    const half  = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ');
    const line2 = words.slice(half).join(' ');
    heroEl.innerHTML = line2
      ? `${line1}<br/><span>${line2}</span>`
      : `<span>${line1}</span>`;
  } else {
    heroEl.innerHTML = 'THE<br/><span>CONSTRUCT</span>';
  }

  // Update email theme class
  const theme = $('email-theme').value;
  const contentWrap = document.querySelector('.email-content-wrap');
  if (theme === 'light') {
    contentWrap.classList.add('light-email');
  } else {
    contentWrap.classList.remove('light-email');
  }

  // Update banner background image
  const heroSection = document.querySelector('.email-hero');
  if (heroSection) {
    heroSection.style.backgroundImage = `url('${BANNER_IMAGES[selectedBannerIndex]}')`;
  }
}

function updateBodyPreview() {
  const bodyEl = $('preview-body');
  if (!quill) return;
  const html  = quill.getSemanticHTML ? quill.getSemanticHTML() : quill.root.innerHTML;
  const text  = quill.getText().trim();
  if (text.length > 0) {
    bodyEl.innerHTML = html;
  } else {
    bodyEl.innerHTML = '<span class="preview-placeholder">Your campaign copy will appear here. Start writing above.</span>';
  }
}

function updateCTAs() {
  const c1t = $('cta1-text').value.trim();
  const c1l = $('cta1-link').value.trim();
  const c2t = $('cta2-text').value.trim();
  const c2l = $('cta2-link').value.trim();
  const el1 = $('preview-cta1');
  const el2 = $('preview-cta2');

  if (c1t) {
    el1.textContent = c1t.toUpperCase();
    el1.className   = 'email-cta-btn primary';
    el1.href        = c1l || '#';
  } else {
    el1.textContent = '— Fill in CTA 01 button label —';
    el1.className   = 'email-cta-btn ghost';
    el1.href        = '#';
  }

  if (c2t) {
    el2.textContent     = c2t.toUpperCase() + ' →';
    el2.href            = c2l || '#';
    el2.style.display   = 'inline-block';
    el2.className       = 'email-cta-btn secondary';
  } else {
    el2.style.display = 'none';
  }
}

// Attach listeners
['campaign-season', 'emailer-name', 'subject-line', 'cta1-text', 'cta1-link', 'cta2-text', 'cta2-link'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', () => { updatePreview(); saveDraft(); });
});

// Subject char counter
$('subject-line').addEventListener('input', () => {
  const len = $('subject-line').value.length;
  const cnt = $('subject-count');
  cnt.textContent = `${len} / 60`;
  cnt.className = 'char-count' + (len > 60 ? ' over' : len > 45 ? ' warn' : '');
});

// ─── PREVIEW TOGGLE ───────────────────────────────────────────────
function setPreviewMode(mode) {
  const frame = $('email-preview');
  const dBtn  = $('btn-desktop');
  const mBtn  = $('btn-mobile');
  if (mode === 'mobile') {
    frame.classList.add('mobile');
    mBtn.classList.add('active');    dBtn.classList.remove('active');
    mBtn.setAttribute('aria-pressed','true'); dBtn.setAttribute('aria-pressed','false');
  } else {
    frame.classList.remove('mobile');
    dBtn.classList.add('active');    mBtn.classList.remove('active');
    dBtn.setAttribute('aria-pressed','true'); mBtn.setAttribute('aria-pressed','false');
  }
}

// ─── HTML EMAIL GENERATOR ─────────────────────────────────────────
function generateEmailHTML() {
  const name    = $('emailer-name').value.trim() || 'New Balaceaga Campaign';
  const season  = $('campaign-season').value || 'SUMMER';
  const subject = $('subject-line').value.trim() || 'New Balaceaga';
  const c1t     = $('cta1-text').value.trim();
  const c1l     = $('cta1-link').value.trim() || '#';
  const c2t     = $('cta2-text').value.trim();
  const c2l     = $('cta2-link').value.trim() || '#';

  // Rich text body HTML
  const bodyHTML = quill && quill.getText().trim().length > 0
    ? (quill.getSemanticHTML ? quill.getSemanticHTML() : quill.root.innerHTML)
    : '<span style="color:#A39E9A;font-style:italic;">No body copy provided.</span>';

  // Hero title split
  const heroWords = name.toUpperCase().split(' ');
  const half      = Math.ceil(heroWords.length / 2);
  const heroLine1 = heroWords.slice(0, half).join(' ');
  const heroLine2 = heroWords.slice(half).join(' ');

  // Bright theme colors
  const cBgMain   = '#F4F4F4';
  const cBgHeader = '#FFFFFF';
  const cTextHeader = '#000000';
  const cBgHero   = '#111111';
  const cTextHero = '#FFFFFF';
  const cOverlayStart = 'rgba(17,17,17,0.85)';
  const cOverlayMid   = 'rgba(255,0,85,0.4)';
  const cOverlayEnd   = 'rgba(17,17,17,0.95)';
  const cBgBody   = '#FFFFFF';
  const cBgCta    = '#F4F4F4';
  const cBgFooter = '#FFFFFF';
  const cTextFooter = '#888888';
  const cAccent   = '#FF0055'; // Extremely bright pink/red
  const cBorder   = '#E0E0E0';

  // Logo — use base64 for email embedding, fallback to text mark
  const isEmbeddable = logoBase64 && logoBase64.startsWith('data:');
  const logoHeaderHTML = isEmbeddable
    ? `<img src="${logoBase64}" alt="New Balaceaga" style="height:42px;max-width:180px;object-fit:contain;display:inline-block;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="width:30px;height:30px;background-color:${cAccent};text-align:center;vertical-align:middle;">
          <span style="font-family:'Arial Black',Arial,sans-serif;font-size:11px;font-weight:900;color:#ffffff;">NB</span>
        </td>
        <td style="padding-left:10px;">
          <span style="font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:${cTextHeader};">NEW BALACEAGA</span>
        </td>
      </tr></table>`;

  const logoFooterHTML = isEmbeddable
    ? `<img src="${logoBase64}" alt="New Balaceaga" style="height:30px;max-width:100px;object-fit:contain;display:inline-block;margin-bottom:8px;" />`
    : `<div style="width:24px;height:24px;background:${cAccent};display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px;">
        <span style="font-family:'Arial Black',Arial,sans-serif;font-size:10px;font-weight:900;color:#fff;">NB</span>
       </div>`;

  // CTA Buttons
  const cta1HTML = c1t ? `<tr><td align="left" style="padding:0 0 12px 0;">
    <a href="${c1l}" target="_blank" rel="noopener noreferrer"
      style="display:inline-block;padding:14px 36px;background-color:${cAccent};color:#FFFFFF;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:3px;">
      ${c1t.toUpperCase()}
    </a></td></tr>` : '';

  const cta2HTML = c2t ? `<tr><td align="left" style="padding:0;">
    <a href="${c2l}" target="_blank" rel="noopener noreferrer"
      style="display:inline-block;padding:13px 34px;background-color:transparent;color:#000000;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;border-radius:3px;border:1.5px solid #000000;">
      ${c2t.toUpperCase()}
    </a></td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${subject}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{margin:0!important;padding:0!important;background-color:${cBgMain}!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
    a{color:inherit;}
    @media only screen and (max-width:600px){
      .email-wrapper{width:100%!important;}
      .email-content{padding:24px 20px!important;}
      .hero-title{font-size:26px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${cBgMain};">
  <div style="display:none;font-size:1px;max-height:0;overflow:hidden;">${subject} — New Balaceaga ${season}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${cBgMain};padding:30px 0;">
    <tr><td align="center">
      <table class="email-wrapper" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid ${cBorder};">

        <!-- HEADER -->
        <tr><td style="background-color:${cBgHeader};padding:40px 40px 30px;text-align:center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="center">${logoHeaderHTML}</td>
          </tr></table>
        </td></tr>

        <!-- HERO -->
        <tr><td style="background-color:${cBgHero};background-image:url('${BANNER_IMAGES[selectedBannerIndex]}');background-size:cover;background-position:center;padding:60px 40px;text-align:center;">
          <!-- Fallback overlay gradient for text readability -->
          <div style="background:linear-gradient(135deg,${cOverlayStart} 0%,${cOverlayMid} 50%,${cOverlayEnd} 100%);padding:40px 20px;border-radius:8px;">
            <p style="font-family:'Arial Black',Arial,sans-serif;font-size:12px;letter-spacing:5px;text-transform:uppercase;color:#FFFFFF;margin-bottom:14px;margin-top:0;">${SEASON_LOGOS[season] || ''} ${season} COLLECTION</p>
            <h1 class="hero-title" style="font-family:'Arial Black',Arial,sans-serif;font-size:36px;font-weight:900;color:${cTextHero};text-transform:uppercase;line-height:1.1;margin:0;">
              ${heroLine1}${heroLine2 ? `<br/><span style="color:${cAccent};">${heroLine2}</span>` : ''}
            </h1>
          </div>
        </td></tr>

        <!-- BODY -->
        <tr><td class="email-content" style="background-color:${cBgBody};padding:40px 40px 32px;">
          <p style="font-family:'Arial Black',Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A89CB2;margin-bottom:16px;">The Narrative</p>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#3A2A44;">
            ${bodyHTML}
          </div>
        </td></tr>

        <!-- DIVIDER -->
        <tr><td style="background-color:${cBgBody};padding:0 40px;">
          <div style="height:1px;background:linear-gradient(90deg,${cAccent},transparent);"></div>
        </td></tr>

        <!-- CTAs -->
        <tr><td style="background-color:${cBgCta};padding:32px 40px;border-top:1px solid ${cBorder};">
          <table role="presentation" cellpadding="0" cellspacing="0">
            ${cta1HTML || `<tr><td style="font-family:Arial,sans-serif;font-size:12px;color:#A89CB2;font-style:italic;">No CTA configured.</td></tr>`}
            ${cta2HTML}
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:${cBgFooter};padding:24px 40px;text-align:center;border-top:1px solid ${cBorder};">
          ${logoFooterHTML}
          <p style="font-family:'Arial Black',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${cTextFooter};margin-bottom:10px;">NEW BALACEAGA &mdash; EST. 2026</p>
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#A89CB2;margin-bottom:8px;">
            <a href="#" style="color:${cTextFooter};text-decoration:underline;">Unsubscribe</a> &nbsp;&bull;&nbsp;
            <a href="#" style="color:${cTextFooter};text-decoration:underline;">Privacy Policy</a> &nbsp;&bull;&nbsp;
            <a href="#" style="color:${cTextFooter};text-decoration:underline;">View in Browser</a>
          </p>
          <p style="font-family:Arial,sans-serif;font-size:10px;color:#A89CB2;line-height:1.6;">
            &copy; 2026 New Balaceaga. All rights reserved.<br/>
            19, The House of New Balaceaga, New York, NY 10001
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── COPY HTML ────────────────────────────────────────────────────
async function copyHTML() {
  const html = generateEmailHTML();
  try {
    await navigator.clipboard.writeText(html);
    showToast('HTML Copied to Clipboard', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = html; ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('HTML Copied', 'success');
  }
}

// ─── DOWNLOAD HTML ────────────────────────────────────────────────
function downloadHTML() {
  const html = generateEmailHTML();
  const slug = ($('emailer-name').value.trim() || 'new-balaceaga-emailer')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${slug}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`Downloaded: ${slug}.html`, 'success');
}

// ─── RESET FORM ───────────────────────────────────────────────────
function resetForm() {
  ['campaign-season','emailer-name','subject-line','cta1-text','cta1-link','cta2-text','cta2-link']
    .forEach(id => { 
      if($(id).tagName === 'SELECT') $(id).value = 'SUMMER';
      else $(id).value = ''; 
    });
  $('subject-count').textContent = '0 / 60';
  $('subject-count').className = 'char-count';
  if (quill) quill.setContents([]);
  removeLogo();
  localStorage.removeItem(STORAGE_KEY);
  updatePreview();
  showToast('Form Reset', '');
}

// ─── TOAST ────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── AUTO-SAVE DRAFT ──────────────────────────────────────────────
function saveDraft() {
  try {
    const draft = {
      season:  $('campaign-season').value,
      name:    $('emailer-name').value,
      subject: $('subject-line').value,
      bodyDelta: quill ? JSON.stringify(quill.getContents()) : '',
      cta1t:  $('cta1-text').value,
      cta1l:  $('cta1-link').value,
      cta2t:  $('cta2-text').value,
      cta2l:  $('cta2-link').value,
      logo:   logoBase64 || '',
      banner: selectedBannerIndex
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch(e) { /* storage full — skip silently */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.season)  $('campaign-season').value = d.season;
    if (d.name)    $('emailer-name').value = d.name;
    if (d.subject) {
      $('subject-line').value = d.subject;
      const len = d.subject.length;
      $('subject-count').textContent = `${len} / 60`;
      $('subject-count').className = 'char-count' + (len > 60 ? ' over' : len > 45 ? ' warn' : '');
    }
    if (d.bodyDelta && quill) {
      try { quill.setContents(JSON.parse(d.bodyDelta)); } catch(e) {}
    }
    if (d.cta1t) $('cta1-text').value = d.cta1t;
    if (d.cta1l) $('cta1-link').value = d.cta1l;
    if (d.cta2t) $('cta2-text').value = d.cta2t;
    if (d.cta2l) $('cta2-link').value = d.cta2l;
    if (d.logo)  { logoBase64 = d.logo; applyLogoToUI(); }
    if (d.banner !== undefined) {
      selectedBannerIndex = d.banner;
      document.querySelectorAll('.banner-thumb').forEach((el, idx) => {
        if(idx === selectedBannerIndex) el.classList.add('active');
        else el.classList.remove('active');
      });
    }
    if (Object.values(d).some(v => v)) showToast('Draft Restored', 'success');
  } catch(e) { console.warn('Draft load failed:', e); }
}
