<?php
/**
 * Issues a short-lived, signed token to a form.
 *
 * The token is just "issued-at timestamp + HMAC of that timestamp". Because the
 * signature is made with a server-side secret, a bot cannot invent a timestamp
 * that looks older than it really is — which is what makes the "was this filled
 * in suspiciously fast?" check in send-lead.php trustworthy.
 *
 * It also means the form only works for clients that run JavaScript and make
 * this request first, which by itself stops most drive-by spam scripts.
 */

declare(strict_types=1);

$config = require __DIR__ . '/lead-config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$issued = time();
$signature = hash_hmac('sha256', (string) $issued, $config['secret']);

echo json_encode([
    'ts'    => $issued,
    'sig'   => $signature,
]);
