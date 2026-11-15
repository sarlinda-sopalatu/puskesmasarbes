/* ==========================================================================
   Puskesmas Arbes — Shell aplikasi, autentikasi, dan router
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const DB_KEY = 'puskesmas-arbes.db.v1';
  const SESSION_KEY = 'puskesmas-arbes.session.v1';

  const ACTIVE_QUEUE_STATUS = ['menunggu', 'dipanggil', 'dilayani'];
  const REPORT_TABS = ['ringkasan', 'kunjungan', 'poli', 'penyakit', 'obat', 'petugas'];
  const PHARMACY_TABS = ['resep', 'obat', 'stok', 'laporan'];

  const DEMO_ACCOUNTS = [
    { role: 'Administrator', username: 'admin', password: 'admin123' },
    { role: 'Petugas Pendaftaran', username: 'pendaftaran', password: '123456' },
    { role: 'Dokter', username: 'dokter', password: '123456' },
    { role: 'Perawat', username: 'perawat', password: '123456' },
    { role: 'Petugas Farmasi', username: 'farmasi', password: '123456' },
    { role: 'Petugas Kasir', username: 'kasir', password: '123456' }
  ];

  const AUTH_FEATURES = [
    { icon: 'users', title: 'Pendaftaran & antrean', text: 'Identitas pasien, NIK/BPJS, nomor antrean per poli.' },
    { icon: 'stethoscope', title: 'Rekam medis elektronik', text: 'Tanda vital, diagnosis ICD-10, tindakan, dan resep.' },
    { icon: 'pill', title: 'Farmasi & kasir', text: 'Stok obat, penyerahan resep, verifikasi BPJS, dan kuitansi.' },
    { icon: 'chart', title: 'Laporan terpadu', text: 'Kunjungan, penyakit, obat, kinerja petugas, dan ekspor CSV.' }
  ];

  const els = {};
  let clockTimer = null;
  let displayActive = false;
  let currentRoute = null;
  let intendedHash = '';

  /* ------------------------------------------------------------------------
     Utilitas dasar
     ------------------------------------------------------------------------ */
  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.skipLink = document.querySelector('.skip-link');
    els.authView = byId('authView');
    els.displayView = byId('displayView');
    els.appView = byId('appView');
    els.sidebar = byId('sidebar');
    els.sidebarNav = byId('sidebarNav');
    els.sidebarClinic = byId('sidebarClinic');
    els.sprintLabel = byId('sprintLabel');
    els.menuToggle = byId('menuToggle');
    els.topbarEyebrow = byId('topbarEyebrow');
    els.topbarTitle = byId('topbarTitle');
    els.topbarClock = byId('topbarClock');
    els.notifBtn = byId('notifBtn');
    els.notifBadge = byId('notifBadge');
    els.notifPanel = byId('notifPanel');
    els.userMenuBtn = byId('userMenuBtn');
    els.userMenu = byId('userMenu');
    els.topbarAvatar = byId('topbarAvatar');
    els.topbarUserName = byId('topbarUserName');
    els.topbarUserRole = byId('topbarUserRole');
    els.userMenuAvatar = byId('userMenuAvatar');
    els.userMenuName = byId('userMenuName');
    els.userMenuUsername = byId('userMenuUsername');
    els.logoutBtn = byId('logoutBtn');
    els.mainContent = byId('mainContent');
    els.footerYear = byId('footerYear');
  }

  function showView(view) {
    if (els.authView) els.authView.hidden = view !== 'auth';
    if (els.displayView) els.displayView.hidden = view !== 'display';
    if (els.appView) els.appView.hidden = view !== 'app';
    if (view !== 'app') closeSidebar();
  }

  function isAppVisible() {
    return Boolean(els.appView && !els.appView.hidden);
  }

  function navigate(hash) {
    if (!hash) return;
    if (location.hash === hash) handleRoute();
    else location.hash = hash;
  }

  function clinicName() {
    return store.clinic.nama || 'Puskesmas Arbes';
  }

  function roleMeta(role) {
    return NS.core.getRoleMeta(role);
  }

  function pageLabel(pageId) {
    const page = C.PAGES.find(function (item) { return item.id === pageId; });
    return page ? page.label : 'modul ini';
  }

  function canOpen(pageId) {
    const user = store.currentUser();
    if (!user) return false;
    if (!pageId) return true;
    return user.role === 'admin' || store.hasAccess(pageId);
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    const open = !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', open);
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', String(open));
  }

  function setInlineError(host, message) {
    if (!host) return;
    host.innerHTML = '<div class="auth-error">' + ui.icon('alert-circle') + '<span>' + ui.esc(message) + '</span></div>';
  }

  function clearInlineError(host) {
    if (host) host.innerHTML = '';
  }

  /* ------------------------------------------------------------------------
     Autentikasi — tampilan masuk & pemulihan password
     ------------------------------------------------------------------------ */
  function brandPanelMarkup() {
    const clinic = store.clinic;
    return '<section class="auth-brand-panel">' +
      '<div class="auth-brand">' +
        '<span class="brand-mark" aria-hidden="true">' + ui.brandMark() + '</span>' +
        '<div class="auth-brand-copy"><strong>Puskesmas Arbes</strong><small>Sistem Informasi Puskesmas</small></div>' +
      '</div>' +
      '<div class="auth-hero">' +
        '<span class="auth-hero-kicker">' + ui.icon('shield') + 'Satu sistem, seluruh layanan</span>' +
        '<h1>Pelayanan lebih cepat,<br>data lebih <span>terpadu</span>.</h1>' +
        '<p>' + ui.esc(clinic.motto || 'Melayani dengan hati, untuk masyarakat yang lebih sehat.') + '</p>' +
        '<div class="auth-feature-list">' +
          AUTH_FEATURES.map(function (feature) {
            return '<div class="auth-feature">' +
              '<span class="auth-feature-icon">' + ui.icon(feature.icon) + '</span>' +
              '<div><strong>' + ui.esc(feature.title) + '</strong><span>' + ui.esc(feature.text) + '</span></div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="auth-brand-footer">' +
        '<p>' + ui.esc(clinic.instansi || clinic.nama) + ' · ' + ui.esc(clinic.alamat || '') + '</p>' +
        '<span class="auth-brand-badge"><span class="status-dot"></span>' + ui.esc(C.SPRINT) + '</span>' +
      '</div>' +
    '</section>';
  }

  function demoAccountMarkup() {
    return '<div class="auth-demo">' +
      '<div class="auth-demo-head"><strong>Akun demonstrasi</strong><span>Klik untuk mengisi</span></div>' +
      '<div class="auth-demo-grid">' +
        DEMO_ACCOUNTS.map(function (account) {
          return '<button type="button" class="demo-account" data-demo-user="' + ui.attr(account.username) + '" data-demo-pass="' + ui.attr(account.password) + '">' +
            '<span class="demo-role">' + ui.esc(account.role) + '</span>' +
            '<code>' + ui.esc(account.username) + ' / ' + ui.esc(account.password) + '</code>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function loginFormMarkup() {
    return '<span class="auth-eyebrow">Portal petugas</span>' +
      '<h2>Masuk ke Puskesmas Arbes</h2>' +
      '<p>Gunakan akun puskesmas untuk mengakses layanan sesuai peran Anda.</p>' +
      '<form id="loginForm" class="auth-form" novalidate>' +
        '<div class="auth-error-host" id="loginError"></div>' +
        '<div class="auth-field">' +
          '<label for="loginUsername">Username</label>' +
          '<div class="auth-input-wrap">' + ui.icon('user') +
            '<input class="input" id="loginUsername" name="username" type="text" autocomplete="username" placeholder="Masukkan username" required>' +
          '</div>' +
        '</div>' +
        '<div class="auth-field">' +
          '<label for="loginPassword">Password</label>' +
          '<div class="auth-input-wrap">' + ui.icon('lock') +
            '<input class="input has-action" id="loginPassword" name="password" type="password" autocomplete="current-password" placeholder="Masukkan password" required>' +
            '<button type="button" class="auth-reveal" data-reveal="loginPassword" aria-label="Tampilkan password">' + ui.icon('eye') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="auth-row">' +
          '<span class="auth-check" style="cursor:default">' + ui.icon('shield') + 'Sesi tersimpan di perangkat ini</span>' +
          '<button type="button" class="auth-link" id="forgotPasswordBtn">Lupa password?</button>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-block auth-submit" id="loginSubmit">' + ui.icon('arrow-right') + 'Masuk ke aplikasi</button>' +
      '</form>' +
      demoAccountMarkup();
  }

  function resetFormMarkup() {
    return '<span class="auth-eyebrow">Pemulihan akun</span>' +
      '<h2>Pulihkan akses akun</h2>' +
      '<p>Verifikasi username dan nomor telepon terdaftar, lalu tentukan password baru.</p>' +
      '<form id="resetForm" class="auth-form" novalidate>' +
        '<div class="auth-error-host" id="resetError"></div>' +
        '<div class="auth-field">' +
          '<label for="resetUsername">Username</label>' +
          '<div class="auth-input-wrap">' + ui.icon('user') +
            '<input class="input" id="resetUsername" name="username" type="text" autocomplete="username" placeholder="Username akun Anda" required>' +
          '</div>' +
        '</div>' +
        '<div class="auth-field">' +
          '<label for="resetPhone">Nomor telepon terdaftar</label>' +
          '<div class="auth-input-wrap">' + ui.icon('phone') +
            '<input class="input" id="resetPhone" name="phone" type="tel" autocomplete="tel" placeholder="Contoh: 081234567890" required>' +
          '</div>' +
        '</div>' +
        '<div class="auth-field">' +
          '<label for="resetPassword">Password baru</label>' +
          '<div class="auth-input-wrap">' + ui.icon('key') +
            '<input class="input has-action" id="resetPassword" name="password" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter" required>' +
            '<button type="button" class="auth-reveal" data-reveal="resetPassword" aria-label="Tampilkan password">' + ui.icon('eye') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="auth-field">' +
          '<label for="resetConfirm">Konfirmasi password baru</label>' +
          '<div class="auth-input-wrap">' + ui.icon('lock') +
            '<input class="input" id="resetConfirm" name="confirm" type="password" autocomplete="new-password" placeholder="Ulangi password baru" required>' +
          '</div>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-block auth-submit" id="resetSubmit">' + ui.icon('key') + 'Reset password</button>' +
        '<button type="button" class="btn btn-ghost btn-block" id="backToLoginBtn">' + ui.icon('arrow-left') + 'Kembali ke halaman masuk</button>' +
      '</form>' +
      '<div class="auth-demo" style="margin-top:18px">' +
        '<div class="auth-demo-head"><strong>Butuh bantuan?</strong></div>' +
        '<p style="margin:0;color:var(--muted);font-size:0.68rem;line-height:1.55">Nomor telepon harus sama dengan data akun. Administrator juga dapat mereset password pengguna dari menu <strong>Pengguna &amp; Hak Akses</strong>.</p>' +
      '</div>';
  }

  function authFooterMarkup() {
    return '<div class="auth-footer">' + ui.icon('info') +
        '<span>Aplikasi demonstrasi dengan penyimpanan lokal di perangkat ini. Jangan gunakan data pasien sebenarnya.' +
        ' <a href="#/display" target="_blank" rel="noopener" class="auth-link">Buka display antrean</a></span>' +
      '</div>' +
      '<div class="auth-copyright">&copy; ' + new Date().getFullYear() + ' ' + ui.esc(clinicName()) + ' · ' + ui.esc(C.SPRINT) + ' · v' + ui.esc(C.APP_VERSION) + '</div>';
  }

  function renderAuth(mode) {
    if (!els.authView) return;
    const reset = mode === 'reset';
    const targetNotice = !reset && intendedHash && intendedHash !== '#/login' && intendedHash !== '#/lupa-password'
      ? '<div class="inline-alert inline-alert-info" style="margin-top:14px">' + ui.icon('lock') + '<span>Masuk untuk melanjutkan ke halaman yang Anda tuju.</span></div>'
      : '';
    showView('auth');
    document.title = (reset ? 'Pulihkan Akses' : 'Masuk') + ' · ' + clinicName();
    els.authView.innerHTML = '<div class="auth-shell">' +
      brandPanelMarkup() +
      '<section class="auth-panel">' +
        '<div class="auth-card">' +
          '<div class="auth-mobile-brand">' +
            '<span class="brand-mark" aria-hidden="true">' + ui.brandMark() + '</span>' +
            '<strong>Puskesmas Arbes</strong>' +
          '</div>' +
          targetNotice +
          (reset ? resetFormMarkup() : loginFormMarkup()) +
          authFooterMarkup() +
        '</div>' +
      '</section>' +
    '</div>';
    bindAuth(reset);
    const focusTarget = els.authView.querySelector(reset ? '#resetUsername' : '#loginUsername');
    if (focusTarget) {
      window.setTimeout(function () { focusTarget.focus(); }, 60);
    }
  }

  function bindAuth(reset) {
    els.authView.querySelectorAll('[data-reveal]').forEach(function (button) {
      button.addEventListener('click', function () {
        const input = byId(button.dataset.reveal);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.innerHTML = ui.icon(reveal ? 'eye-off' : 'eye');
        button.setAttribute('aria-label', reveal ? 'Sembunyikan password' : 'Tampilkan password');
      });
    });

    if (reset) {
      bindResetForm();
      const back = byId('backToLoginBtn');
      if (back) back.addEventListener('click', function () { navigate('#/login'); });
      return;
    }

    const form = byId('loginForm');
    const errorHost = byId('loginError');
    const usernameInput = byId('loginUsername');
    const passwordInput = byId('loginPassword');
    const submit = byId('loginSubmit');

    els.authView.querySelectorAll('[data-demo-user]').forEach(function (button) {
      button.addEventListener('click', function () {
        usernameInput.value = button.dataset.demoUser || '';
        passwordInput.value = button.dataset.demoPass || '';
        clearInlineError(errorHost);
        passwordInput.focus();
      });
    });

    const forgot = byId('forgotPasswordBtn');
    if (forgot) forgot.addEventListener('click', function () { navigate('#/lupa-password'); });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearInlineError(errorHost);
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username) {
        setInlineError(errorHost, 'Username wajib diisi.');
        usernameInput.focus();
        return;
      }
      if (!password) {
        setInlineError(errorHost, 'Password wajib diisi.');
        passwordInput.focus();
        return;
      }
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span>Memeriksa akun…';
      try {
        const result = store.login(username, password);
        if (!result.ok) {
          setInlineError(errorHost, result.message || 'Tidak dapat masuk. Periksa kembali data akun Anda.');
          submit.disabled = false;
          submit.innerHTML = original;
          passwordInput.focus();
          passwordInput.select();
          return;
        }
        const target = intendedHash && intendedHash !== '#/login' && intendedHash !== '#/lupa-password'
          ? intendedHash
          : '#/dashboard';
        intendedHash = '';
        ui.toast('Selamat datang, ' + result.user.name + '.', 'success', 'Berhasil masuk');
        if (location.hash === target) handleRoute();
        else location.hash = target;
      } catch (error) {
        setInlineError(errorHost, error.message || 'Terjadi kesalahan saat masuk.');
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });

    form.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.target === usernameInput && !passwordInput.value) {
        event.preventDefault();
        passwordInput.focus();
      }
    });
  }

  function bindResetForm() {
    const form = byId('resetForm');
    const errorHost = byId('resetError');
    const submit = byId('resetSubmit');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearInlineError(errorHost);
      const username = byId('resetUsername').value.trim();
      const phone = byId('resetPhone').value.trim();
      const password = byId('resetPassword').value;
      const confirm = byId('resetConfirm').value;

      if (!username) {
        setInlineError(errorHost, 'Username wajib diisi.');
        byId('resetUsername').focus();
        return;
      }
      if (!phone) {
        setInlineError(errorHost, 'Nomor telepon terdaftar wajib diisi.');
        byId('resetPhone').focus();
        return;
      }
      if (String(password).length < 6) {
        setInlineError(errorHost, 'Password baru minimal 6 karakter.');
        byId('resetPassword').focus();
        return;
      }
      if (password !== confirm) {
        setInlineError(errorHost, 'Konfirmasi password belum sama.');
        byId('resetConfirm').focus();
        return;
      }

      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span>Menyimpan password…';
      try {
        store.resetPasswordWithPhone(username, phone, password);
        ui.toast('Password berhasil direset. Silakan masuk dengan password baru.', 'success', 'Password diperbarui');
        submit.disabled = false;
        submit.innerHTML = original;
        if (location.hash === '#/login') handleRoute();
        else location.hash = '#/login';
      } catch (error) {
        setInlineError(errorHost, error.message || 'Password tidak dapat direset.');
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  }

  /* ------------------------------------------------------------------------
     Penyelesaian rute
     ------------------------------------------------------------------------ */
  function decodeSegment(value) {
    try { return decodeURIComponent(value); } catch (error) { return value; }
  }

  function routeBase(section, page, title, eyebrow, render) {
    return { section: section, page: page, title: title, eyebrow: eyebrow, render: render };
  }

  function callPage(name, method, args) {
    const page = NS.pages && NS.pages[name];
    if (!page) throw new Error('Modul ' + name + ' tidak tersedia.');
    if (method) {
      if (typeof page[method] !== 'function') throw new Error('Fungsi ' + method + ' pada modul ' + name + ' tidak tersedia.');
      return page[method].apply(page, args || []);
    }
    if (typeof page !== 'function') throw new Error('Modul ' + name + ' tidak dapat dijalankan.');
    return page.apply(null, args || []);
  }

  function resolveRoute() {
    let raw = location.hash || '';
    if (!raw || raw === '#') raw = '#/dashboard';
    const path = raw.replace(/^#\/?/, '').split('?')[0];
    const segments = path.split('/').filter(Boolean).map(decodeSegment);
    const section = segments[0] || 'dashboard';

    if (section === 'login' && segments.length === 1) {
      return { authPage: 'login', public: true, title: 'Masuk', eyebrow: 'Portal petugas' };
    }
    if ((section === 'lupa-password' || section === 'reset-password') && segments.length === 1) {
      return { authPage: 'reset', public: true, title: 'Pulihkan Akses', eyebrow: 'Keamanan akun' };
    }
    if (section === 'display' && segments.length === 1) {
      return { publicDisplay: true, title: 'Display Antrean', eyebrow: 'Ruang tunggu digital' };
    }

    if (section === 'dashboard' && segments.length === 1) {
      return routeBase('dashboard', 'dashboard', 'Dashboard', 'Ruang kerja', function (root) {
        callPage('dashboard', null, [root]);
      });
    }

    if (section === 'pasien') {
      if (segments.length === 1) {
        return routeBase('pasien', 'patients', 'Pendaftaran Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'render', [root]);
        });
      }
      if (segments[1] === 'baru' && segments.length === 2) {
        return routeBase('pasien', 'patients', 'Pasien Baru', 'Pendaftaran pasien', function (root) {
          callPage('patients', 'create', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pasien', 'patients', 'Detail Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'detail', [root, segments[1]]);
        });
      }
      if (segments.length === 3 && segments[2] === 'edit') {
        return routeBase('pasien', 'patients', 'Ubah Data Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'edit', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'antrean' && segments.length === 1) {
      return routeBase('antrean', 'queues', 'Antrean Pasien', 'Alur layanan', function (root) {
        callPage('queues', 'render', [root]);
      });
    }

    if (section === 'pemeriksaan') {
      if (segments.length === 1) {
        return routeBase('pemeriksaan', 'examinations', 'Pemeriksaan Dokter', 'Rekam medis elektronik', function (root) {
          callPage('exams', 'render', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pemeriksaan', 'examinations', 'Rekam Medis Pasien', 'Rekam medis elektronik', function (root) {
          callPage('exams', 'detail', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'farmasi') {
      const tab = segments[1] || 'resep';
      if (segments.length > 2 || !PHARMACY_TABS.includes(tab)) return null;
      const eyebrows = {
        resep: 'Resep elektronik',
        obat: 'Master obat',
        stok: 'Persediaan & mutasi',
        laporan: 'Laporan farmasi'
      };
      return routeBase('farmasi', 'pharmacy', 'Farmasi & Obat', eyebrows[tab], function (root) {
        callPage('pharmacy', 'render', [root, tab]);
      });
    }

    if (section === 'pembayaran') {
      if (segments.length === 1) {
        return routeBase('pembayaran', 'billing', 'Pembayaran & Tarif', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'render', [root, 'tagihan']);
        });
      }
      if (segments.length === 2 && segments[1] === 'transaksi') {
        return routeBase('pembayaran', 'billing', 'Riwayat Transaksi', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'render', [root, 'transaksi']);
        });
      }
      if (segments.length === 2 && segments[1] === 'tarif') {
        return routeBase('tarif', 'billing', 'Tarif Layanan', 'Kasir & administrasi', function (root) {
          callPage('billing', 'tariffs', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pembayaran', 'billing', 'Detail Tagihan', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'detail', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'tarif' && segments.length === 1) {
      return routeBase('tarif', 'billing', 'Tarif Layanan', 'Kasir & administrasi', function (root) {
        callPage('billing', 'tariffs', [root]);
      });
    }

    if (section === 'laporan') {
      const tab = segments[1] || '';
      if (segments.length > 2 || (tab && !REPORT_TABS.includes(tab))) return null;
      return routeBase('laporan', 'reports', 'Laporan & Analitik', 'Monitoring puskesmas', function (root) {
        callPage('reports', 'render', [root, tab]);
      });
    }

    if (section === 'pengguna') {
      if (segments.length === 1) {
        return routeBase('pengguna', 'users', 'Pengguna & Hak Akses', 'Administrasi sistem', function (root) {
          callPage('users', 'render', [root]);
        });
      }
      if (segments.length === 2 && segments[1] === 'akses') {
        return routeBase('pengguna', 'users', 'Matriks Hak Akses', 'Kontrol akses', function (root) {
          callPage('users', 'access', [root]);
        });
      }
      if (segments.length === 2 && segments[1] === 'audit') {
        return routeBase('pengguna', 'users', 'Jejak Audit', 'Administrasi sistem', function (root) {
          callPage('users', 'render', [root, 'audit']);
        });
      }
      return null;
    }

    if (section === 'pengaturan' && segments.length === 1) {
      return routeBase('pengaturan', 'settings', 'Pengaturan', 'Konfigurasi sistem', function (root) {
        callPage('users', 'settings', [root]);
      });
    }

    if (section === 'profil' && segments.length === 1) {
      return routeBase('profil', null, 'Profil & Keamanan', 'Akun saya', function (root) {
        callPage('users', 'profile', [root]);
      });
    }

    return null;
  }

  function applyRouteChrome(route) {
    if (!route) return;
    if (els.topbarEyebrow) els.topbarEyebrow.textContent = route.eyebrow || 'Puskesmas Arbes';
    if (els.topbarTitle) els.topbarTitle.textContent = route.title || 'Dashboard';
    document.title = (route.title ? route.title + ' · ' : '') + clinicName();
    markNav(route.page);
  }

  function showApp() {
    showView('app');
    if (document.body.classList.contains('modal-open')) ui.closeModal();
  }

  function handleRoute() {
    if (location.hash === '#mainContent') return;
    ui.closeAllDropdowns();
    closeSidebar();
    if (displayActive) teardownDisplay();
    ui.closeModal();

    const route = resolveRoute();
    const user = store.currentUser();

    if (!route) {
      if (!user) {
        intendedHash = location.hash || '#/dashboard';
        renderAuth('login');
        return;
      }
      showNotFound();
      return;
    }

    if (route.publicDisplay) {
      showDisplay();
      return;
    }

    if (route.authPage) {
      currentRoute = null;
      if (user) {
        navigate('#/dashboard');
        return;
      }
      renderAuth(route.authPage === 'reset' ? 'reset' : 'login');
      return;
    }

    if (!user) {
      intendedHash = location.hash || '#/dashboard';
      renderAuth('login');
      return;
    }

    currentRoute = route;
    if (route.page && !store.hasAccess(route.page)) {
      showAccessDenied(route, user);
      return;
    }

    showApp();
    refreshChrome();
    applyRouteChrome(route);
    try {
      els.mainContent.innerHTML = '';
      route.render(els.mainContent);
    } catch (error) {
      console.error('Puskesmas Arbes: gagal merender halaman', error);
      els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
        ui.emptyState('alert', 'Halaman tidak dapat dimuat', error.message || 'Terjadi kesalahan saat memuat halaman ini.', '<a href="#/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>') +
        '</div></div>';
      ui.showError(error);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function showAccessDenied(route, user) {
    showApp();
    refreshChrome();
    applyRouteChrome({ section: route.section, page: route.page, title: 'Akses Dibatasi', eyebrow: 'Kontrol akses' });
    const meta = roleMeta(user.role);
    els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
      ui.emptyState(
        'lock',
        'Akses modul tidak tersedia',
        'Peran ' + meta.label + ' belum memiliki akses ke ' + pageLabel(route.page) + '. Hubungi administrator untuk membuka modul ini pada matriks hak akses.',
        '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">' +
          '<a href="#/dashboard" class="btn btn-primary">' + ui.icon('dashboard') + 'Kembali ke Dashboard</a>' +
          '<a href="#/profil" class="btn btn-secondary">' + ui.icon('user') + 'Lihat Profil</a>' +
        '</div>'
      ) +
    '</div></div>';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function showNotFound() {
    currentRoute = { section: 'not-found', page: null, title: 'Halaman Tidak Ditemukan', eyebrow: '404' };
    showApp();
    refreshChrome();
    applyRouteChrome(currentRoute);
    els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
      ui.emptyState(
        'search',
        'Halaman tidak ditemukan',
        'Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautan, atau kembali ke dashboard.',
        '<a href="#/dashboard" class="btn btn-primary">' + ui.icon('dashboard') + 'Kembali ke Dashboard</a>'
      ) +
    '</div></div>';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  /* ------------------------------------------------------------------------
     Display antrean publik
     ------------------------------------------------------------------------ */
  function showDisplay() {
    if (!els.displayView) return;
    ui.closeAllDropdowns();
    closeSidebar();
    showView('display');
    document.title = 'Display Antrean · ' + clinicName();
    try {
      callPage('queues', 'display', [els.displayView]);
      displayActive = true;
    } catch (error) {
      console.error('Puskesmas Arbes: gagal menampilkan display antrean', error);
      els.displayView.innerHTML = '<div class="display-screen"><div class="display-idle" style="margin:auto"><span class="display-idle-icon">' + ui.icon('alert') + '</span><strong>Display tidak dapat dimuat</strong><p>' + ui.esc(error.message || 'Terjadi kesalahan.') + '</p></div></div>';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function teardownDisplay() {
    if (window.PK.cleanupDisplay) {
      try { window.PK.cleanupDisplay(); } catch (error) { /* abaikan */ }
      window.PK.cleanupDisplay = null;
    }
    displayActive = false;
    if (els.displayView) els.displayView.innerHTML = '';
  }

  /* ------------------------------------------------------------------------
     Kerangka aplikasi: navigasi, topbar, notifikasi
     ------------------------------------------------------------------------ */
  function navGroups() {
    return [
      {
        label: 'Ruang kerja',
        items: [
          { page: 'dashboard', href: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { page: 'patients', href: '#/pasien', label: 'Pendaftaran Pasien', icon: 'users' },
          { page: 'queues', href: '#/antrean', label: 'Antrean Pasien', icon: 'queue' },
          { page: 'examinations', href: '#/pemeriksaan', label: 'Pemeriksaan Dokter', icon: 'stethoscope' }
        ]
      },
      {
        label: 'Layanan & keuangan',
        items: [
          { page: 'pharmacy', href: '#/farmasi', label: 'Farmasi & Obat', icon: 'pill' },
          { page: 'billing', href: '#/pembayaran', label: 'Pembayaran & Tarif', icon: 'receipt' },
          { page: 'reports', href: '#/laporan', label: 'Laporan', icon: 'chart' }
        ]
      },
      {
        label: 'Administrasi',
        items: [
          { page: 'users', href: '#/pengguna', label: 'Pengguna & Hak Akses', icon: 'shield' },
          { page: 'settings', href: '#/pengaturan', label: 'Pengaturan', icon: 'settings' }
        ]
      }
    ];
  }

  function navCounts(user) {
    const counts = { queues: 0, examinations: 0, pharmacy: 0, billing: 0 };
    try {
      const data = store.load();
      const today = NS.core.dateKey();
      let active = data.queues.filter(function (queue) {
        return queue.tanggal === today && ACTIVE_QUEUE_STATUS.includes(queue.status);
      });
      if (user.role === 'dokter' && user.poli) {
        active = active.filter(function (queue) { return queue.poli === user.poli; });
      }
      counts.queues = active.length;
      if (store.can('exam.manage')) {
        counts.examinations = data.exams.filter(function (exam) {
          return exam.status === 'draft' && (user.role !== 'dokter' || !user.poli || exam.poli === user.poli);
        }).length;
      } else if (store.can('vitals.manage')) {
        counts.examinations = active.filter(function (queue) {
          const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
          return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
        }).length;
      }
      counts.pharmacy = store.pendingPrescriptions().length;
      counts.billing = data.bills.filter(function (bill) { return bill.status === 'belum'; }).length;
    } catch (error) {
      /* abaikan; navigasi tetap dapat digunakan */
    }
    return counts;
  }

  function renderNav(user) {
    if (!els.sidebarNav) return;
    const counts = navCounts(user);
    let html = '';
    navGroups().forEach(function (group) {
      const items = group.items.filter(function (item) { return canOpen(item.page); });
      if (!items.length) return;
      html += '<div class="nav-group-label">' + ui.esc(group.label) + '</div>';
      html += items.map(function (item) {
        const count = counts[item.page] || 0;
        return '<a href="' + ui.attr(item.href) + '" class="nav-link" data-nav-page="' + ui.attr(item.page) + '">' +
          ui.icon(item.icon) +
          '<span>' + ui.esc(item.label) + '</span>' +
          (count > 0 ? '<span class="nav-count">' + ui.esc(count > 99 ? '99+' : String(count)) + '</span>' : '') +
        '</a>';
      }).join('');
    });
    els.sidebarNav.innerHTML = html;
    if (currentRoute) markNav(currentRoute.page);
  }

  function markNav(pageId) {
    if (!els.sidebarNav) return;
    els.sidebarNav.querySelectorAll('.nav-link').forEach(function (link) {
      const active = Boolean(pageId) && link.dataset.navPage === pageId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderSidebarClinic() {
    if (!els.sidebarClinic) return;
    const clinic = store.clinic;
    const town = String(clinic.alamat || '').split(',')[0] || clinic.jamOperasional || 'Layanan kesehatan';
    els.sidebarClinic.innerHTML =
      '<div class="clinic-kicker"><span>Fasilitas kesehatan</span><span class="status-dot"></span></div>' +
      '<strong>' + ui.esc(clinic.instansi || clinic.nama) + '</strong>' +
      '<small>' + ui.icon('map-pin') + '<span>' + ui.esc(town) + '</span></small>';
  }

  function updateTopbarUser(user) {
    const meta = roleMeta(user.role);
    const initials = ui.initials(user.name);
    [els.topbarAvatar, els.userMenuAvatar].forEach(function (avatar) {
      if (!avatar) return;
      avatar.textContent = initials;
      avatar.style.setProperty('--avatar-tone', meta.color);
    });
    if (els.topbarUserName) {
      els.topbarUserName.textContent = user.name;
      els.topbarUserName.title = user.name;
    }
    if (els.topbarUserRole) els.topbarUserRole.textContent = meta.label;
    if (els.userMenuName) els.userMenuName.textContent = user.name;
    if (els.userMenuUsername) els.userMenuUsername.textContent = '@' + user.username;
    document.querySelectorAll('[data-admin-only]').forEach(function (element) {
      element.style.display = user.role === 'admin' ? '' : 'none';
    });
  }

  function queueScopeFor(user, active) {
    if (user.role === 'dokter' && user.poli) {
      return active.filter(function (queue) { return queue.poli === user.poli; });
    }
    return active;
  }

  function buildNotifications(user) {
    const items = [];
    try {
      const data = store.load();
      const today = NS.core.dateKey();
      const activeQueues = data.queues.filter(function (queue) {
        return queue.tanggal === today && ACTIVE_QUEUE_STATUS.includes(queue.status);
      });
      const waiting = activeQueues.filter(function (queue) { return queue.status === 'menunggu'; });
      const scoped = queueScopeFor(user, activeQueues);
      const pendingRx = store.pendingPrescriptions();
      const alerts = store.stockAlerts();
      const unpaid = data.bills.filter(function (bill) { return bill.status === 'belum'; });
      const bpjsPending = unpaid.filter(function (bill) { return bill.penjamin === 'BPJS'; });
      const lowStock = alerts.low.length + alerts.out.length;
      const expiry = alerts.expired.length + alerts.expiring.length;

      const push = function (item) {
        if (!item || !item.title) return;
        items.push(item);
      };
      const pharmacyLink = canOpen('pharmacy') ? '#/farmasi/resep' : canOpen('examinations') ? '#/pemeriksaan' : '#/dashboard';
      const stockLink = canOpen('pharmacy') ? '#/farmasi/obat' : '#/dashboard';
      const billingLink = canOpen('billing') ? '#/pembayaran' : '#/dashboard';
      const queueLink = canOpen('queues') ? '#/antrean' : '#/dashboard';
      const examLink = canOpen('examinations') ? '#/pemeriksaan' : '#/dashboard';

      if (user.role === 'dokter') {
        const waitingScoped = scoped.filter(function (queue) { return queue.status === 'menunggu'; });
        if (waitingScoped.length) {
          push({ tone: 'info', icon: 'queue', title: waitingScoped.length + ' pasien menunggu', text: 'Antrean aktif di ' + (user.poli ? NS.core.getPoli(user.poli).nama : 'semua poli') + '.', href: queueLink });
        }
        const drafts = data.exams.filter(function (exam) {
          return exam.status === 'draft' && (!user.poli || exam.poli === user.poli);
        });
        if (drafts.length) {
          push({ tone: 'warning', icon: 'clipboard', title: drafts.length + ' rekam medis draf', text: 'Selesaikan asesmen dan diagnosis pasien.', href: examLink });
        }
        if (pendingRx.length) {
          push({ tone: 'info', icon: 'pill', title: pendingRx.length + ' resep menunggu farmasi', text: 'Resep sudah dikirim untuk disiapkan.', href: pharmacyLink });
        }
      } else if (user.role === 'perawat') {
        const triage = scoped.filter(function (queue) {
          const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
          return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
        });
        if (triage.length) {
          push({ tone: 'warning', icon: 'activity', title: triage.length + ' pasien perlu asesmen awal', text: 'Tanda vital belum dicatat untuk pasien ini.', href: examLink });
        }
        const called = scoped.filter(function (queue) { return queue.status === 'dipanggil'; });
        if (called.length) {
          push({ tone: 'info', icon: 'megaphone', title: called.length + ' antrean dipanggil', text: called.map(function (queue) { return queue.kode; }).slice(0, 4).join(', '), href: queueLink });
        }
      } else if (user.role === 'farmasi') {
        if (pendingRx.length) {
          push({ tone: 'warning', icon: 'pill', title: pendingRx.length + ' resep menunggu', text: 'Siapkan obat dan serahkan kepada pasien.', href: '#/farmasi/resep' });
        }
        if (lowStock) {
          push({ tone: 'danger', icon: 'package', title: lowStock + ' obat perlu perhatian stok', text: alerts.out.length + ' habis, ' + alerts.low.length + ' menipis.', href: '#/farmasi/obat' });
        }
        if (expiry) {
          push({ tone: 'warning', icon: 'alert', title: expiry + ' batch obat bermasalah', text: alerts.expired.length + ' kedaluwarsa, ' + alerts.expiring.length + ' segera kedaluwarsa.', href: '#/farmasi/obat' });
        }
      } else if (user.role === 'kasir') {
        if (unpaid.length) {
          push({ tone: 'warning', icon: 'receipt', title: unpaid.length + ' tagihan belum dibayar', text: 'Total ' + ui.currency(unpaid.reduce(function (total, bill) { return total + (Number(bill.total) || 0); }, 0)) + ' menunggu penyelesaian.', href: '#/pembayaran' });
        }
        if (bpjsPending.length) {
          push({ tone: 'info', icon: 'shield', title: bpjsPending.length + ' verifikasi BPJS', text: 'Tagihan penjaminan belum diverifikasi.', href: '#/pembayaran' });
        }
        const paidToday = data.bills.filter(function (bill) {
          return bill.status === 'lunas' && bill.paidAt && NS.core.dateKey(new Date(bill.paidAt)) === today;
        });
        if (paidToday.length) {
          push({ tone: 'success', icon: 'check-circle', title: paidToday.length + ' transaksi lunas hari ini', text: 'Pendapatan ' + ui.currency(paidToday.reduce(function (total, bill) { return total + (Number(bill.total) || 0); }, 0)) + '.', href: '#/pembayaran/transaksi' });
        }
      } else if (user.role === 'pendaftaran') {
        if (waiting.length) {
          push({ tone: 'info', icon: 'queue', title: waiting.length + ' antrean menunggu', text: 'Panggil pasien sesuai urutan dan prioritas.', href: '#/antrean' });
        }
        const cancelled = data.queues.filter(function (queue) { return queue.tanggal === today && queue.status === 'batal'; });
        if (cancelled.length) {
          push({ tone: 'warning', icon: 'x', title: cancelled.length + ' antrean dibatalkan', text: 'Tinjau alasan pembatalan pada daftar antrean.', href: '#/antrean' });
        }
      } else {
        if (waiting.length) {
          push({ tone: 'info', icon: 'queue', title: waiting.length + ' pasien menunggu', text: activeQueues.length + ' antrean masih aktif hari ini.', href: '#/antrean' });
        }
        if (pendingRx.length) {
          push({ tone: 'warning', icon: 'pill', title: pendingRx.length + ' resep menunggu', text: 'Belum diserahkan oleh petugas farmasi.', href: pharmacyLink });
        }
        if (lowStock) {
          push({ tone: 'danger', icon: 'package', title: lowStock + ' obat perlu perhatian', text: alerts.out.length + ' habis, ' + alerts.low.length + ' menipis.', href: stockLink });
        }
        if (expiry) {
          push({ tone: 'warning', icon: 'alert', title: expiry + ' batch obat bermasalah', text: alerts.expired.length + ' kedaluwarsa, ' + alerts.expiring.length + ' segera kedaluwarsa.', href: stockLink });
        }
        if (unpaid.length) {
          push({ tone: 'info', icon: 'receipt', title: unpaid.length + ' tagihan belum dibayar', text: 'Termasuk ' + bpjsPending.length + ' tagihan BPJS.', href: billingLink });
        }
      }
    } catch (error) {
      console.warn('Puskesmas Arbes: notifikasi tidak dapat dimuat', error);
    }
    return items;
  }

  function renderNotifications(user) {
    if (!els.notifPanel || !els.notifBadge) return;
    const items = buildNotifications(user);
    els.notifBadge.hidden = items.length === 0;
    els.notifBadge.textContent = items.length > 9 ? '9+' : String(items.length);
    els.notifPanel.innerHTML = '<div class="notif-head"><strong>Notifikasi</strong><span>' + (items.length ? items.length + ' perlu perhatian' : 'Semua terkendali') + '</span></div>' +
      (items.length
        ? '<div class="notif-list">' + items.slice(0, 7).map(function (item) {
            return '<a class="notif-item" href="' + ui.attr(item.href) + '">' +
              '<span class="notif-icon' + (item.tone === 'warning' ? ' is-warning' : item.tone === 'danger' ? ' is-danger' : item.tone === 'info' ? ' is-info' : '') + '">' + ui.icon(item.icon) + '</span>' +
              '<span class="notif-copy"><strong>' + ui.esc(item.title) + '</strong><small>' + ui.esc(item.text) + '</small></span>' +
            '</a>';
          }).join('') + '</div>'
        : '<div class="notif-empty">' + ui.icon('check-circle') + 'Tidak ada tugas mendesak saat ini.</div>') +
      '<div class="notif-foot"><a href="#/dashboard" class="text-link">Buka dashboard ' + ui.icon('arrow-right') + '</a></div>';
  }

  function updateClock() {
    if (!els.topbarClock) return;
    const now = new Date();
    els.topbarClock.innerHTML = ui.fmtTime(now) + ' WIB<small>' + ui.esc(ui.fmtDate(now, 'medium')) + '</small>';
  }

  function refreshChrome() {
    if (!isAppVisible()) return;
    const user = store.currentUser();
    if (!user) return;
    renderSidebarClinic();
    renderNav(user);
    updateTopbarUser(user);
    renderNotifications(user);
    updateClock();
    if (els.footerYear) els.footerYear.textContent = new Date().getFullYear();
    if (els.sprintLabel) els.sprintLabel.textContent = C.SPRINT + ' · v' + C.APP_VERSION;
    if (currentRoute) applyRouteChrome(currentRoute);
  }

  function refresh() {
    if (!store.currentUser()) {
      handleRoute();
      return;
    }
    handleRoute();
  }

  /* ------------------------------------------------------------------------
     Aksi global & siklus hidup
     ------------------------------------------------------------------------ */
  function doLogout() {
    if (displayActive) teardownDisplay();
    store.logout();
    intendedHash = '';
    currentRoute = null;
    ui.closeAllDropdowns();
    closeSidebar();
    ui.closeModal();
    if (location.hash === '#/login') handleRoute();
    else location.hash = '#/login';
    ui.toast('Anda telah keluar dari sistem.', 'info', 'Sesi berakhir');
  }

  function logout(force) {
    if (force === true) {
      doLogout();
      return;
    }
    ui.confirm('Anda akan keluar dari sesi ini. Pastikan tidak ada pekerjaan yang belum disimpan.', {
      title: 'Keluar dari akun?',
      subtitle: 'Sesi Anda pada perangkat ini akan diakhiri.',
      okText: 'Ya, keluar',
      danger: false
    }).then(function (confirmed) {
      if (confirmed) doLogout();
    });
  }

  function bindEvents() {
    if (els.skipLink) {
      els.skipLink.addEventListener('click', function (event) {
        event.preventDefault();
        if (els.mainContent) els.mainContent.focus();
      });
    }

    if (els.menuToggle) {
      els.menuToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleSidebar();
      });
    }

    if (els.notifBtn) {
      els.notifBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        const opening = els.notifPanel.hidden;
        ui.closeAllDropdowns();
        if (!opening) return;
        const user = store.currentUser();
        if (user) renderNotifications(user);
        els.notifPanel.hidden = false;
        els.notifBtn.setAttribute('aria-expanded', 'true');
      });
    }

    if (els.userMenuBtn) {
      els.userMenuBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        const opening = els.userMenu.hidden;
        ui.closeAllDropdowns();
        if (!opening) return;
        els.userMenu.hidden = false;
        els.userMenuBtn.setAttribute('aria-expanded', 'true');
      });
    }

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', function () {
        ui.closeAllDropdowns();
        logout();
      });
    }

    if (els.notifPanel) {
      els.notifPanel.addEventListener('click', function (event) {
        if (event.target.closest('a')) ui.closeAllDropdowns();
      });
    }

    if (els.userMenu) {
      els.userMenu.addEventListener('click', function (event) {
        if (event.target.closest('a')) ui.closeAllDropdowns();
      });
    }

    if (els.sidebarNav) {
      els.sidebarNav.addEventListener('click', function (event) {
        if (event.target.closest('.nav-link')) closeSidebar();
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.dropdown-wrap')) ui.closeAllDropdowns();
      if (event.target.closest('[data-close-sidebar]')) closeSidebar();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        ui.closeAllDropdowns();
        closeSidebar();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080) closeSidebar();
    });

    window.addEventListener('hashchange', handleRoute);

    window.addEventListener('storage', function (event) {
      if (event.key === DB_KEY) {
        store.reload();
        if (isAppVisible()) refreshChrome();
      } else if (event.key === SESSION_KEY) {
        if (!displayActive) handleRoute();
      }
    });
  }

  function init() {
    cacheElements();
    if (!els.authView || !els.appView) return;
    if (els.footerYear) els.footerYear.textContent = new Date().getFullYear();
    if (els.sprintLabel) els.sprintLabel.textContent = C.SPRINT + ' · v' + C.APP_VERSION;
    bindEvents();

    store.subscribe(function () {
      if (isAppVisible()) refreshChrome();
    });

    updateClock();
    clockTimer = window.setInterval(updateClock, 15000);

    if (!location.hash || location.hash === '#' || location.hash === '#mainContent') {
      history.replaceState(null, '', '#/dashboard');
    }
    handleRoute();
  }

  NS.app = {
    refreshChrome: refreshChrome,
    refresh: refresh,
    logout: logout,
    navigate: navigate,
    get currentRoute() { return currentRoute; }
  };

  init();
})(window);
