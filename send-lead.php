<?php
/**
 * FENZO — lead form handler
 *
 * Receives the contact and quote forms, filters out junk, emails the enquiry to
 * sales, and appends it to a CSV backup. Always answers with JSON:
 *
 *     {"success": true|false, "message": "..."}
 *
 * Settings live in lead-config.php — you should not need to edit this file.
 */

declare(strict_types=1);

$config  = require __DIR__ . '/lead-config.php';
$dataDir = __DIR__ . '/leads';
$throtDir = $dataDir . '/.throttle';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/* --------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

function respond(bool $ok, string $message, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => $ok, 'message' => $message]);
    exit;
}

/** Junk is turned away with one vague line so spammers learn nothing. */
function reject(string $internalReason): never
{
    error_log('[fenzo-lead] blocked: ' . $internalReason);
    respond(false, 'We could not process this submission. Please call us on +91 9524566995 and we will help right away.', 422);
}

function clientIp(): string
{
    // Cloudflare / common reverse proxies put the real client first.
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', (string) $_SERVER[$key])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '0.0.0.0';
}

/** Collapse whitespace and strip control characters. */
function clean(string $value): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return trim($value);
}

/** Anything placed in a mail header must not be able to inject new headers. */
function headerSafe(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value) ?? '');
}

function ensureDir(string $path): void
{
    if (!is_dir($path)) {
        @mkdir($path, 0755, true);
    }
}

/* --------------------------------------------------------------------------
 * 0. Only accept a real POST from our own site
 * ----------------------------------------------------------------------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, 'Method not allowed.', 405);
}

// If the browser sent an Origin/Referer, it must be ours. (Some privacy modes
// omit it entirely, so a missing header is tolerated rather than blocked.)
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '');
if ($origin !== '' && !empty($_SERVER['HTTP_HOST'])) {
    // HTTP_HOST carries the port ("site.com:8080"); a parsed URL host never
    // does, so both sides must be normalised or they can never match.
    $bare = static fn(string $h): string
        => preg_replace('/^www\./', '', preg_replace('/:\d+$/', '', strtolower($h)) ?? '') ?? '';

    $originHost = $bare((string) parse_url($origin, PHP_URL_HOST));
    $siteHost   = $bare((string) $_SERVER['HTTP_HOST']);

    if ($originHost !== '' && $siteHost !== '' && $originHost !== $siteHost) {
        reject('cross-origin post from ' . $originHost);
    }
}

/* --------------------------------------------------------------------------
 * 1. Honeypot — hidden fields a human never sees, and never fills
 * ----------------------------------------------------------------------- */

foreach (['website', 'company_url', 'fax'] as $trap) {
    if (trim((string) ($_POST[$trap] ?? '')) !== '') {
        reject('honeypot "' . $trap . '" filled');
    }
}

/* --------------------------------------------------------------------------
 * 2. Signed timestamp — proves the form was really rendered, and how long ago
 * ----------------------------------------------------------------------- */

$ts  = (int) ($_POST['form_ts'] ?? 0);
$sig = (string) ($_POST['form_sig'] ?? '');

if ($ts <= 0 || $sig === '') {
    reject('missing form token');
}
if (!hash_equals(hash_hmac('sha256', (string) $ts, $config['secret']), $sig)) {
    reject('bad token signature');
}

$elapsed = time() - $ts;
if ($elapsed < $config['min_seconds']) {
    reject('submitted in ' . $elapsed . 's (too fast)');
}
if ($elapsed > $config['max_seconds']) {
    respond(false, 'This form was left open too long. Please refresh the page and send it again.', 422);
}

/* --------------------------------------------------------------------------
 * 3. Optional reCAPTCHA v3
 * ----------------------------------------------------------------------- */

if (!empty($config['recaptcha_secret'])) {
    $token = (string) ($_POST['recaptcha_token'] ?? '');
    if ($token === '') {
        reject('recaptcha token missing');
    }
    $verify = @file_get_contents(
        'https://www.google.com/recaptcha/api/siteverify',
        false,
        stream_context_create(['http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query([
                'secret'   => $config['recaptcha_secret'],
                'response' => $token,
                'remoteip' => clientIp(),
            ]),
            'timeout' => 8,
        ]])
    );
    $result = json_decode((string) $verify, true);
    if (!is_array($result) || empty($result['success']) || ($result['score'] ?? 0) < $config['recaptcha_min_score']) {
        reject('recaptcha score ' . ($result['score'] ?? 'n/a'));
    }
}

/* --------------------------------------------------------------------------
 * 4. Per-IP rate limiting
 * ----------------------------------------------------------------------- */

ensureDir($throtDir);

$ip       = clientIp();
$ipFile   = $throtDir . '/ip-' . sha1($ip) . '.json';
$now      = time();
$history  = [];

if (is_file($ipFile)) {
    $decoded = json_decode((string) @file_get_contents($ipFile), true);
    if (is_array($decoded)) {
        $history = array_filter($decoded, static fn($t) => is_int($t) && $t > $now - 86400);
    }
}

$lastHour = count(array_filter($history, static fn($t) => $t > $now - 3600));
if ($lastHour >= $config['max_per_hour'] || count($history) >= $config['max_per_day']) {
    respond(false, 'You have already sent us several enquiries. Please call +91 9524566995 so we can help you directly.', 429);
}

/* --------------------------------------------------------------------------
 * 5. Read and validate the actual enquiry
 * ----------------------------------------------------------------------- */

$name    = clean((string) ($_POST['name'] ?? ''));
$phone   = clean((string) ($_POST['phone'] ?? ''));
$email   = clean((string) ($_POST['email'] ?? ''));
$message = clean((string) ($_POST['message'] ?? ''));
$formType = clean((string) ($_POST['form_type'] ?? 'Website Enquiry'));

$errors = [];

if (mb_strlen($name) < 2 || mb_strlen($name) > 80) {
    $errors[] = 'Please enter your name.';
} elseif (!preg_match('/\p{L}/u', $name)) {
    $errors[] = 'Please enter a valid name.';
}

$digits = preg_replace('/\D+/', '', $phone) ?? '';
if (strlen($digits) < 10 || strlen($digits) > 15) {
    $errors[] = 'Please enter a valid phone number.';
} elseif (strlen($digits) === 10 && !preg_match('/^[6-9]/', $digits)) {
    // Indian mobile numbers always begin 6, 7, 8 or 9.
    $errors[] = 'Please enter a valid Indian mobile number.';
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address, or leave it blank.';
}

if ($errors) {
    respond(false, implode(' ', $errors), 422);
}

/* --------------------------------------------------------------------------
 * 6. Content heuristics — what junk looks like
 * ----------------------------------------------------------------------- */

$haystack = mb_strtolower($name . ' ' . $email . ' ' . $message . ' ' . implode(' ', array_map(
    static fn($v) => is_array($v) ? implode(' ', $v) : (string) $v,
    $_POST
)));

foreach ($config['spam_words'] as $word) {
    if (str_contains($haystack, mb_strtolower($word))) {
        reject('spam keyword "' . $word . '"');
    }
}

// A name is a name — never a URL.
if (preg_match('~https?://|www\.|\[url|<a\s~i', $name)) {
    reject('url in name field');
}

// Link-stuffed messages are advertising, not enquiries.
if (preg_match_all('~https?://|www\.~i', $message) > $config['max_links']) {
    reject('too many links in message');
}

// Mail-header injection attempts.
if (preg_match('~(content-type|bcc\s*:|cc\s*:|mime-version)~i', $name . ' ' . $email . ' ' . $phone)) {
    reject('header injection attempt');
}

// Our customers write in English or Tamil; Cyrillic is a reliable spam tell.
if (preg_match('/\p{Cyrillic}/u', $haystack)) {
    reject('cyrillic content');
}

/* --------------------------------------------------------------------------
 * 7. Duplicate suppression
 * ----------------------------------------------------------------------- */

$fingerprint = sha1($digits . '|' . mb_strtolower($name) . '|' . mb_strtolower($message));
$dupFile     = $throtDir . '/dup-' . $fingerprint;

if (is_file($dupFile) && (@filemtime($dupFile) ?: 0) > $now - $config['duplicate_window']) {
    respond(true, 'We already have your enquiry — our team will be in touch shortly.');
}
@touch($dupFile);

/* --------------------------------------------------------------------------
 * 8. Build the enquiry
 * ----------------------------------------------------------------------- */

$labels = [
    'name' => 'Name', 'phone' => 'Phone', 'email' => 'Email', 'company' => 'Company',
    'subject' => 'Subject', 'message' => 'Message', 'products' => 'Products of interest',
    'finish' => 'Preferred finish', 'project_type' => 'Project type', 'floors' => 'Floors',
    'area' => 'Approx. area (sq ft)', 'budget' => 'Budget range', 'timeline' => 'Timeline',
    'city' => 'City', 'state' => 'State', 'source' => 'How they heard about us',
];
$internal = ['form_ts', 'form_sig', 'form_type', 'website', 'company_url', 'fax', 'recaptcha_token'];

$fields = [];
foreach ($_POST as $key => $value) {
    if (in_array($key, $internal, true)) {
        continue;
    }
    $key = rtrim($key, '[]');
    $value = is_array($value)
        ? implode(', ', array_map(static fn($v) => clean((string) $v), $value))
        : clean((string) $value);
    if ($value === '') {
        continue;
    }
    $fields[$labels[$key] ?? ucwords(str_replace('_', ' ', $key))] = $value;
}

$rows = '';
foreach ($fields as $label => $value) {
    $rows .= '<tr>'
        . '<td style="padding:10px 14px;border-bottom:1px solid #eee;background:#fafafa;font-weight:600;color:#333;white-space:nowrap;vertical-align:top;">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</td>'
        . '<td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111;">'
        . nl2br(htmlspecialchars($value, ENT_QUOTES, 'UTF-8')) . '</td>'
        . '</tr>';
}

$received = date('d M Y, g:i a');
$subject  = headerSafe($formType . ' from ' . $name . ($fields['City'] ?? '' ? ' (' . $fields['City'] . ')' : ''));

$body = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;">'
    . '<h2 style="color:#111;margin:0 0 4px;">New ' . htmlspecialchars($formType, ENT_QUOTES, 'UTF-8') . '</h2>'
    . '<p style="color:#666;font-size:13px;margin:0 0 18px;">Received ' . $received . '</p>'
    . '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #eee;">'
    . $rows
    . '</table>'
    . '<p style="color:#888;font-size:12px;margin-top:18px;">Sent from the FENZO website · IP ' . htmlspecialchars($ip, ENT_QUOTES, 'UTF-8') . '</p>'
    . '</div>';

/* --------------------------------------------------------------------------
 * 9. Deliver
 * ----------------------------------------------------------------------- */

$fromEmail = headerSafe($config['from_email']);
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: ' . sprintf('"%s" <%s>', headerSafe($config['from_name']), $fromEmail),
    'X-Mailer: FENZO-Website',
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . sprintf('"%s" <%s>', headerSafe($name), headerSafe($email));
}
foreach ($config['cc'] as $ccAddress) {
    $headers[] = 'Cc: ' . headerSafe($ccAddress);
}

$sent = @mail(
    headerSafe($config['to']),
    $subject,
    $body,
    implode("\r\n", $headers),
    '-f' . $fromEmail
);

/* CSV backup — written even if mail delivery fails, so no lead is ever lost. */
if ($config['log_to_csv']) {
    ensureDir($dataDir);
    $csvPath = $dataDir . '/leads-' . date('Y-m') . '.csv';
    $isNew   = !is_file($csvPath);
    if ($handle = @fopen($csvPath, 'a')) {
        if ($isNew) {
            fwrite($handle, "\xEF\xBB\xBF"); // BOM so Excel opens UTF-8 correctly
            fputcsv($handle, ['Received', 'Form', 'Name', 'Phone', 'Email', 'City', 'Details', 'IP', 'Emailed']);
        }
        $details = [];
        foreach ($fields as $label => $value) {
            if (!in_array($label, ['Name', 'Phone', 'Email', 'City'], true)) {
                $details[] = $label . ': ' . $value;
            }
        }
        fputcsv($handle, [
            date('Y-m-d H:i:s'), $formType, $name, $phone, $email,
            $fields['City'] ?? '', implode(' | ', $details), $ip, $sent ? 'yes' : 'FAILED',
        ]);
        fclose($handle);
    }
}

/* Count this submission against the IP's allowance. */
$history[] = $now;
@file_put_contents($ipFile, json_encode(array_values($history)), LOCK_EX);

/* Tidy up throttle files now and then (roughly 1 request in 50). */
if (random_int(1, 50) === 1) {
    foreach ((array) glob($throtDir . '/*') as $old) {
        if (is_file($old) && (@filemtime($old) ?: 0) < $now - 86400) {
            @unlink($old);
        }
    }
}

/* Courtesy confirmation to the enquirer. */
if ($config['auto_reply'] && $email !== '' && $sent) {
    @mail(
        sprintf('"%s" <%s>', headerSafe($name), headerSafe($email)),
        'We have received your enquiry — FENZO Aluminium',
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#222;">'
        . '<p>Dear ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ',</p>'
        . '<p>Thank you for contacting <strong>FENZO Aluminium Windows &amp; Doors</strong>. '
        . 'We have received your enquiry and a member of our team will get back to you within 24 hours.</p>'
        . '<p>If it is urgent, please call us on <a href="tel:+919524566995">+91 95245 66995</a> '
        . 'or message us on <a href="https://wa.me/919524566995">WhatsApp</a>.</p>'
        . '<p style="margin-top:24px;">Warm regards,<br><strong>FENZO Aluminium Windows &amp; Doors</strong><br>'
        . '21, Bypass Road, Avaniyapuram, Madurai – 625012</p>'
        . '<p style="color:#888;font-size:12px;margin-top:20px;">This is an automated confirmation — please do not reply to this email.</p>'
        . '</div>',
        implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . sprintf('"%s" <%s>', headerSafe($config['from_name']), $fromEmail),
        ]),
        '-f' . $fromEmail
    );
}

if (!$sent) {
    // The lead is safe in the CSV, so don't alarm the customer — but make the
    // failure loud in the server log so it gets noticed.
    error_log('[fenzo-lead] mail() FAILED for ' . $name . ' <' . $phone . '> — saved to CSV only');
}

respond(true, 'Thank you! Your enquiry has been received — our team will contact you within 24 hours.');
