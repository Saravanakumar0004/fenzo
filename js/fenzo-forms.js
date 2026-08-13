/* ==========================================================================
   FENZO — lead form submission
   --------------------------------------------------------------------------
   Handles the contact and quote forms: fetches the signed token, runs the
   client-side checks, posts to send-lead.php and reports the outcome.

   Any <form data-lead-form="Label"> on the site is picked up automatically.
   ========================================================================== */
(function () {
  'use strict';

  /* Where the form posts. Both files sit next to the HTML pages.
     If you ever move to a host without PHP, point ENDPOINT at your form
     service (e.g. https://api.web3forms.com/submit) and set TOKEN_URL to ''. */
  var ENDPOINT  = 'send-lead.php';
  var TOKEN_URL = 'form-token.php';

  /* Only needed if you switch reCAPTCHA on in lead-config.php. */
  var RECAPTCHA_SITE_KEY = '';

  /* ---------------------------------------------------------------- utils */

  function showAlert(form, message, type) {
    var box = form.querySelector('.lead-alert');
    if (!box) {
      box = document.createElement('div');
      box.className = 'lead-alert';
      box.setAttribute('role', 'status');
      form.insertBefore(box, form.firstChild);
    }
    var ok = type === 'success';
    box.style.cssText =
      'padding:14px 18px;margin-bottom:22px;border-radius:6px;font-size:14px;line-height:1.6;' +
      'background:' + (ok ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)') + ';' +
      'border:1px solid ' + (ok ? 'rgba(46,204,113,0.45)' : 'rgba(231,76,60,0.45)') + ';' +
      'color:' + (ok ? '#2ecc71' : '#e74c3c') + ';';
    box.textContent = message;
    if (typeof box.scrollIntoView === 'function') {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return box;
  }

  function clearAlert(form) {
    var box = form.querySelector('.lead-alert');
    if (box) box.remove();
  }

  /* The honeypot must be invisible to people but still filled in by bots, so
     it is moved off-screen rather than hidden with display:none — which the
     smarter scrapers know to skip. */
  function addHoneypots(form) {
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText =
      'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
    ['website', 'company_url', 'fax'].forEach(function (nameAttr) {
      var input = document.createElement('input');
      input.type = 'text';
      input.name = nameAttr;
      input.tabIndex = -1;
      input.autocomplete = 'off';
      wrap.appendChild(input);
    });
    form.appendChild(wrap);
  }

  function setHidden(form, name, value) {
    var field = form.querySelector('input[name="' + name + '"][type="hidden"]');
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.appendChild(field);
    }
    field.value = value;
  }

  /* ------------------------------------------------------------ the token */

  var tokenPromise = null;

  function fetchToken(force) {
    if (!TOKEN_URL) return Promise.resolve(null);
    if (tokenPromise && !force) return tokenPromise;

    tokenPromise = fetch(TOKEN_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('token ' + res.status);
        return res.json();
      })
      .catch(function () {
        tokenPromise = null;   // let the next attempt retry
        return null;
      });

    return tokenPromise;
  }

  function applyToken(form, token) {
    if (!token) return false;
    setHidden(form, 'form_ts', token.ts);
    setHidden(form, 'form_sig', token.sig);
    return true;
  }

  /* -------------------------------------------------- client-side checks */

  function validate(form) {
    var problems = [];

    var name = form.querySelector('[name="name"]');
    if (name && name.value.trim().length < 2) {
      problems.push('Please enter your name.');
    }

    var phone = form.querySelector('[name="phone"]');
    if (phone) {
      var digits = phone.value.replace(/\D+/g, '');
      if (digits.length < 10 || digits.length > 15) {
        problems.push('Please enter a valid phone number.');
      } else if (digits.length === 10 && !/^[6-9]/.test(digits)) {
        problems.push('Please enter a valid Indian mobile number.');
      }
    }

    var email = form.querySelector('[name="email"]');
    if (email && email.value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) {
      problems.push('Please enter a valid email address, or leave it blank.');
    }

    var message = form.querySelector('[name="message"]');
    if (message && message.required && message.value.trim().length < 5) {
      problems.push('Please tell us a little about your requirement.');
    }

    return problems;
  }

  function withRecaptcha(action) {
    if (!RECAPTCHA_SITE_KEY || typeof grecaptcha === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      grecaptcha.ready(function () {
        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action })
          .then(resolve)
          .catch(function () { resolve(null); });
      });
    });
  }

  /* ------------------------------------------------------------- wiring */

  function initForm(form) {
    var label = form.getAttribute('data-lead-form') || 'Website Enquiry';

    addHoneypots(form);
    setHidden(form, 'form_type', label);

    /* Grab a token up front, and refresh it if the page has been sitting
       open long enough for the old one to expire. */
    fetchToken(false).then(function (t) { applyToken(form, t); });

    var issuedAt = Date.now();
    form.addEventListener('focusin', function () {
      if (Date.now() - issuedAt > 45 * 60 * 1000) {
        issuedAt = Date.now();
        fetchToken(true).then(function (t) { applyToken(form, t); });
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var button = form.querySelector('[type="submit"]');
      if (button && button.disabled) return;      // already in flight

      clearAlert(form);

      var problems = validate(form);
      if (problems.length) {
        showAlert(form, problems.join(' '), 'error');
        return;
      }

      var original = button ? button.innerHTML : '';
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Sending…';
      }

      var restore = function () {
        if (button) {
          button.disabled = false;
          button.innerHTML = original;
        }
      };

      /* Make sure we hold a valid token, then send. */
      Promise.all([
        form.querySelector('input[name="form_sig"]') ? Promise.resolve(true)
                                                     : fetchToken(true).then(function (t) { return applyToken(form, t); }),
        withRecaptcha(label.replace(/\W+/g, '_'))
      ]).then(function (results) {
        var haveToken = results[0];
        var captcha   = results[1];

        if (TOKEN_URL && !haveToken) {
          throw new Error('no-token');
        }
        if (captcha) {
          setHidden(form, 'recaptcha_token', captcha);
        }

        return fetch(ENDPOINT, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
      }).then(function (res) {
        return res.json().catch(function () {
          // A PHP fatal error or an HTML error page rather than JSON.
          throw new Error('bad-response');
        });
      }).then(function (data) {
        if (data && data.success) {
          form.dispatchEvent(new CustomEvent('lead:success', {
            bubbles: true,
            detail: { message: data.message }
          }));
          showAlert(form, data.message || 'Thank you! We will be in touch shortly.', 'success');
          form.reset();
          // A used token cannot be reused for a second send.
          fetchToken(true).then(function (t) { applyToken(form, t); });
        } else {
          showAlert(form, (data && data.message) || 'Something went wrong. Please try again.', 'error');
        }
        restore();
      }).catch(function () {
        showAlert(
          form,
          'Sorry — we could not send your enquiry just now. Please call us on +91 9524566995 ' +
          'or message us on WhatsApp and we will help you right away.',
          'error'
        );
        restore();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, initForm);
  });
})();
