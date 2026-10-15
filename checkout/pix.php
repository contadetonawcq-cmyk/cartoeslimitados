<?php

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');

function pixReply($httpStatus, array $body)
{
    http_response_code($httpStatus);

    echo json_encode(
        $body,
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}

try {
    $configPath = __DIR__ . '/config.php';

    if (!is_file($configPath)) {
        pixReply(500, [
            'success' => false,
            'error' => 'config.php não encontrado na mesma pasta do pix.php',
        ]);
    }

    require_once $configPath;

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST, OPTIONS');

        pixReply(405, [
            'success' => false,
            'error' => 'Método não permitido',
        ]);
    }

    if (
        !defined('FLEVO_API_BASE')
        || !defined('FLEVO_API_KEY')
        || trim((string) FLEVO_API_BASE) === ''
        || trim((string) FLEVO_API_KEY) === ''
    ) {
        pixReply(500, [
            'success' => false,
            'error' => 'Configure FLEVO_API_BASE e FLEVO_API_KEY no config.php',
        ]);
    }

    if (!function_exists('curl_init')) {
        pixReply(500, [
            'success' => false,
            'error' => 'A extensão cURL não está disponível na hospedagem',
        ]);
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        pixReply(400, [
            'success' => false,
            'error' => 'JSON inválido',
        ]);
    }

    $amountCents = filter_var(
        $data['amount'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 100]]
    );

    if ($amountCents === false) {
        pixReply(400, [
            'success' => false,
            'error' => 'Informe o valor em centavos. O mínimo é R$ 1,00',
        ]);
    }

    foreach ([
        'payerName', 'name', 'email', 'phone',
        'document', 'cpf', 'productName',
    ] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) {
            pixReply(400, [
                'success' => false,
                'error' => 'Campo inválido: ' . $field,
            ]);
        }
    }

    $payerName = trim($data['payerName'] ?? $data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = preg_replace('/\D/', '', $data['phone'] ?? '');
    $document = preg_replace(
        '/\D/',
        '',
        $data['document'] ?? $data['cpf'] ?? ''
    );
    $productName = trim($data['productName'] ?? 'Apple Card - Envio');
    $utm = is_array($data['utm'] ?? null) ? $data['utm'] : [];

    // Exige os dados enviados no customer, sem inventar dados pessoais.
    if ($payerName === '') {
        pixReply(400, [
            'success' => false,
            'error' => 'Informe o nome do pagador',
        ]);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        pixReply(400, [
            'success' => false,
            'error' => 'Informe um e-mail válido',
        ]);
    }

    if (strlen($phone) < 10 || strlen($phone) > 13) {
        pixReply(400, [
            'success' => false,
            'error' => 'Informe um telefone com DDD',
        ]);
    }

    if (strlen($document) !== 11 && strlen($document) !== 14) {
        pixReply(400, [
            'success' => false,
            'error' => 'Informe o CPF ou CNPJ do pagador',
        ]);
    }

    if ($productName === '') {
        $productName = 'Apple Card - Envio';
    }

    $reference = 'APPLE-'
        . date('YmdHis')
        . '-'
        . bin2hex(random_bytes(4));

    $payload = [
        'amount' => $amountCents,
        'description' => $productName,
        'reference' => $reference,
        'source' => 'api_externa',
        'customer' => [
            'name' => $payerName,
            'email' => $email,
            'phone' => $phone,
            'document' => $document,
        ],
    ];

    $tracking = [];

    foreach ([
        'utm_source', 'utm_medium', 'utm_campaign',
        'utm_content', 'utm_term', 'src', 'sck',
    ] as $key) {
        if (
            isset($utm[$key])
            && is_scalar($utm[$key])
            && trim((string) $utm[$key]) !== ''
        ) {
            $tracking[$key] = (string) $utm[$key];
        }
    }

    if ($tracking) {
        $payload['tracking'] = $tracking;
    }

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

    if ($payloadJson === false) {
        pixReply(400, [
            'success' => false,
            'error' => 'Os dados enviados contêm caracteres inválidos',
        ]);
    }

    $ch = curl_init(
        rtrim((string) FLEVO_API_BASE, '/') . '/transaction'
    );

    if ($ch === false) {
        pixReply(500, [
            'success' => false,
            'error' => 'Não foi possível iniciar a conexão com o gateway',
        ]);
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . FLEVO_API_KEY,
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => $payloadJson,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);

    $responseBody = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    curl_close($ch);

    if ($responseBody === false) {
        error_log('PIX: falha cURL: ' . $curlError);

        pixReply(502, [
            'success' => false,
            'error' => 'Falha de conexão com o gateway. Consulte o log PHP antes de tentar novamente',
        ]);
    }

    if (trim($responseBody) === '') {
        pixReply(502, [
            'success' => false,
            'error' => 'O gateway retornou uma resposta vazia',
            'httpCode' => $httpCode,
        ]);
    }

    $result = json_decode($responseBody, true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($result)) {
        pixReply(502, [
            'success' => false,
            'error' => 'O gateway retornou uma resposta que não é JSON válido',
            'httpCode' => $httpCode,
        ]);
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        $errorMessage = $result['message']
            ?? $result['error']
            ?? $result['msg']
            ?? 'O gateway recusou a solicitação';

        if (!is_string($errorMessage)) {
            $errorMessage = 'O gateway recusou a solicitação';
        }

        pixReply(502, [
            'success' => false,
            'error' => $errorMessage,
            'httpCode' => $httpCode,
        ]);
    }

    $qrCode = $result['qr_code']
        ?? $result['pixCopyPaste']
        ?? $result['emv']
        ?? '';

    $qrBase64 = $result['qr_code_base64']
        ?? $result['qrCodeImage']
        ?? '';

    $transactionId = $result['transaction_id']
        ?? $result['id']
        ?? null;

    if (!is_string($qrCode) || trim($qrCode) === '') {
        pixReply(502, [
            'success' => false,
            'error' => 'O gateway não retornou o código PIX copia e cola nos campos esperados',
            'httpCode' => $httpCode,
        ]);
    }

    if (
        (!is_string($transactionId) && !is_int($transactionId))
        || trim((string) $transactionId) === ''
    ) {
        pixReply(502, [
            'success' => false,
            'error' => 'O gateway não retornou o identificador da transação nos campos esperados',
            'httpCode' => $httpCode,
        ]);
    }

    if (!is_string($qrBase64)) {
        $qrBase64 = '';
    }

    if (
        $qrBase64 !== ''
        && strpos($qrBase64, 'data:') !== 0
        && strpos($qrBase64, 'https://') !== 0
        && strpos($qrBase64, 'http://') !== 0
    ) {
        $qrBase64 = 'data:image/png;base64,' . $qrBase64;
    }

    if ($qrBase64 === '') {
        $qrBase64 = 'https://api.qrserver.com/v1/create-qr-code/'
            . '?size=300x300&data='
            . rawurlencode($qrCode);
    }

    pixReply(200, [
        'success' => true,
        'transactionId' => (string) $transactionId,
        'reference' => $reference,
        'qrCodeImage' => $qrBase64,
        'pixCopyPaste' => $qrCode,
        'amount' => $amountCents,
        'expires_at' => $result['expires_at'] ?? null,
    ]);

} catch (Throwable $e) {
    error_log('PIX: ' . (string) $e);

    pixReply(500, [
        'success' => false,
        'error' => 'Falha interna no PHP. Consulte o log de erros da hospedagem',
    ]);
}
