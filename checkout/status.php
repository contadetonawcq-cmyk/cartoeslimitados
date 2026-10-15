<?php
/**
 * GET /api/status.php?id=TRANSACTION_ID
 * Consulta status da transação na FlevoPay
 * Retorna: status (APPROVED | PENDING | ...)
 */
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

$id        = trim($_GET['id'] ?? '');
$reference = trim($_GET['reference'] ?? '');

if ($id === '' && $reference === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Informe id ou reference']);
    exit;
}

function flevo_query($query) {
    $url = FLEVO_API_BASE . '/query?' . $query;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'X-API-Key: ' . FLEVO_API_KEY,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return [$code, $body, $err];
}

$result = null;

// 1) Tenta por ID interno
if ($id !== '') {
    list($code, $body, $err) = flevo_query('action=get_transaction&id=' . urlencode($id));
    if (!$err && $code >= 200 && $code < 300) {
        $decoded = json_decode($body, true);
        if ($decoded && !empty($decoded['status'])) {
            $result = $decoded;
        }
    }
}

// 2) Fallback por reference (external_id)
if (!$result && $reference !== '') {
    list($code, $body, $err) = flevo_query('action=list_transactions&external_id=' . urlencode($reference));
    if (!$err && $code >= 200 && $code < 300) {
        $decoded = json_decode($body, true);
        if (is_array($decoded) && count($decoded) > 0) {
            $result = $decoded[0];
        } elseif (is_array($decoded) && !empty($decoded['status'])) {
            $result = $decoded;
        }
    }
}

if (!$result) {
    echo json_encode([
        'success' => true,
        'status'  => 'PENDING',
        'raw'     => null,
    ]);
    exit;
}

$rawStatus = strtolower((string) ($result['status'] ?? $result['payment_status'] ?? 'pending'));

$map = [
    'approved'  => 'APPROVED',
    'paid'      => 'APPROVED',
    'completed' => 'APPROVED',
    'confirmed' => 'APPROVED',
    'pending'   => 'PENDING',
    'waiting'   => 'PENDING',
    'created'   => 'PENDING',
    'expired'   => 'EXPIRED',
    'canceled'  => 'CANCELED',
    'cancelled' => 'CANCELED',
    'failed'    => 'FAILED',
    'refused'   => 'FAILED',
];

$status = $map[$rawStatus] ?? strtoupper($rawStatus);

echo json_encode([
    'success' => true,
    'status'  => $status,
    'amount'  => $result['amount'] ?? null,
    'id'      => $result['id'] ?? $result['transaction_id'] ?? $id,
], JSON_UNESCAPED_UNICODE);