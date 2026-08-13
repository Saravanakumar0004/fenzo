# FENZO lead forms — how they work and what to do on the server

The **Contact** and **Get Quote** forms now post real enquiries to
`sales.fenzo@gmail.com` and keep a CSV backup on the server.

## Files involved

| File | What it does |
|---|---|
| `lead-config.php` | **The only file you should need to edit.** Recipient, from-address, toggles, spam tuning. |
| `send-lead.php` | Receives the form, filters junk, sends the email, writes the CSV. |
| `form-token.php` | Hands each visitor a short-lived signed token (part of the bot defence). |
| `js/fenzo-forms.js` | Front-end: fetches the token, validates, submits, shows the result. |
| `leads/` | CSV backups. Blocked from the web by `leads/.htaccess`. |

## Go-live checklist

1. Upload everything, keeping the folder structure. `leads/` must be
   **writable** (permission `755`, or `775` on some hosts).
2. In cPanel, create the mailbox **`noreply@fenzo.co.in`**.
3. Open `lead-config.php` and confirm `to` and `from_email` are correct.
   `from_email` must be a real address **on your own domain** — sending "From"
   a Gmail address makes Google mark the mail as spam or reject it outright.
4. Send yourself one test enquiry from the live site.
5. Check `leads/leads-YYYY-MM.csv`. The last column says `yes` if the email
   went out, `FAILED` if the server could not send it.

If the column says `FAILED`, PHP `mail()` is disabled or restricted on the
host — ask them to enable it, or switch to SMTP (PHPMailer). No lead is lost
in the meantime: everything is still written to the CSV.

## How junk is kept out

Nine layers, all invisible to a real customer — nothing to type, no puzzles:

1. **Honeypot fields** — three hidden inputs a person never sees. Bots fill
   them in; anything that does is dropped.
2. **Signed token** — the form only works if the browser first fetched a
   token from `form-token.php`. Scripts that blind-POST get nothing.
3. **Time trap** — the token is signed with a timestamp, so its age cannot be
   faked. Anything submitted in under 4 seconds is a bot.
4. **Token expiry** — tokens die after 2 hours, so one cannot be harvested and
   replayed forever.
5. **Same-origin check** — posts from another site are refused.
6. **Rate limiting** — 5 per hour and 15 per day from one IP address.
7. **Duplicate suppression** — the same enquiry sent twice within 15 minutes
   is accepted politely but only delivered once.
8. **Content rules** — spam keywords, link-stuffed messages, URLs in the name
   field, Cyrillic text, and mail-header injection attempts are all rejected.
9. **Field validation** — names, Indian mobile numbers and email addresses are
   checked both in the browser and again on the server.

Tamil, accented names and emoji are all accepted — the filters were tested
against those specifically so genuine customers are never turned away.

### Tuning

Everything above is adjustable in `lead-config.php`. If a real customer is
ever blocked, the reason is written to the server's PHP error log prefixed
with `[fenzo-lead] blocked:` — that tells you exactly which rule to relax.

### If you still get spam

Switch on Google reCAPTCHA v3 (invisible, no puzzles):

1. Get keys at <https://www.google.com/recaptcha/admin> (choose **v3**).
2. Put the **secret key** in `lead-config.php` → `recaptcha_secret`.
3. Put the **site key** in `js/fenzo-forms.js` → `RECAPTCHA_SITE_KEY`.
4. Add this to `contact.html` and `quote.html` before `</body>`:
   `<script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>`

## Not using PHP hosting?

If the site ever moves to Netlify/Vercel/GitHub Pages, PHP will not run. In
`js/fenzo-forms.js` set `ENDPOINT` to your form service's URL and `TOKEN_URL`
to `''`. The honeypots and browser-side validation keep working; the
server-side layers are replaced by whatever that service provides.
