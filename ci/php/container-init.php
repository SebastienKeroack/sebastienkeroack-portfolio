<?php

declare(strict_types=1);

$phpRoot = dirname(__DIR__);
set_include_path($phpRoot . PATH_SEPARATOR . get_include_path());

require_once __DIR__ . '/init.php';

use SKPortfolio\App;

function containerRequestLang(): string {
  $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
  $path = parse_url($requestUri, PHP_URL_PATH);
  if (!is_string($path)) {
    return 'en';
  }

  $segments = explode('/', trim($path, '/'));
  $langCode = strtolower($segments[0] ?? 'en');
  return in_array($langCode, ['en', 'fr'], true) ? $langCode : 'en';
}

$app = new App(containerRequestLang());
$app->setLanguage($app->langCode, $phpRoot . '/language');
