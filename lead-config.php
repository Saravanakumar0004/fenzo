<?php
/**
 * FENZO — Lead form configuration
 * ---------------------------------------------------------------
 * Edit the values in this file only. send-lead.php needs no changes.
 */

return [

    /* ---------- Where leads are delivered ---------- */

    // Inbox that receives every enquiry. Add more addresses to CC them in.
    'to'          => 'sales.fenzo@gmail.com',
    'cc'          => [],                       // e.g. ['owner@fenzo.co.in']

    // The "From" address MUST be on your own domain or mail providers will
    // reject or spam-folder the message. Create this mailbox in cPanel first.
    'from_email'  => 'noreply@fenzo.co.in',
    'from_name'   => 'FENZO Website',

    /* ---------- Extras ---------- */

    // Append every lead to leads/leads-YYYY-MM.csv as a backup.
    'log_to_csv'  => true,

    // Send the enquirer an automatic "we got your message" confirmation.
    'auto_reply'  => true,

    /* ---------- Anti-spam tuning ---------- */

    // Secret used to sign the form token. Any long random string; changing it
    // invalidates tokens already handed out (harmless, just re-submit).
    'secret'      => '0b19efe044cd37c3a4c9c321d27ab64efe5a033ce8d93b72ee22a082e8dd8b77',

    // A human needs at least this many seconds to fill a form. Bots post instantly.
    'min_seconds' => 4,

    // Token lifetime. Stops someone harvesting one token and replaying it forever.
    'max_seconds' => 7200,                     // 2 hours

    // Per-IP submission caps.
    'max_per_hour' => 5,
    'max_per_day'  => 15,

    // Ignore a repeat of the exact same enquiry within this many seconds.
    'duplicate_window' => 900,                 // 15 minutes

    // Words that mark an obvious junk submission. Case-insensitive.
    'spam_words' => [
        'seo service', 'seo expert', 'backlink', 'guest post', 'link building',
        'casino', 'viagra', 'cialis', 'porn', 'crypto investment', 'bitcoin profit',
        'forex trading', 'loan offer', 'work from home', 'make money fast',
        'cheap rolex', 'essay writing', 'buy followers', 'rank your website',
        'increase your traffic', 'digital marketing agency', 'web design services',
    ],

    // Max links allowed in the message body. Real customers rarely paste any.
    'max_links'   => 1,

    /* ---------- Optional: Google reCAPTCHA v3 ---------- */
    // Leave the secret empty to keep reCAPTCHA switched off. To enable, get keys
    // at google.com/recaptcha, paste the secret here, and set the matching site
    // key in js/fenzo-forms.js (RECAPTCHA_SITE_KEY).
    'recaptcha_secret'    => '',
    'recaptcha_min_score' => 0.5,
];
