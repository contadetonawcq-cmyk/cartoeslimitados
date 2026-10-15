<?php
/**
 * Configuração central — FlevoPay + Facebook Pixel.
 * Use uma chave API nova, pois a chave anterior estava exposta no ZIP enviado.
 */

define('FLEVO_API_KEY', 'COLE_SUA_NOVA_CHAVE_API_AQUI');
define('FLEVO_API_BASE', 'https://app.flevopag.com/api/v1');

// Facebook Pixel
// Confirme se este é o ID do Pixel utilizado nas suas campanhas.
define('FB_PIXEL_ID', '1460908116098693');

// CORS: restrinja o domínio em produção, se o checkout chamar esta API de outro domínio.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
