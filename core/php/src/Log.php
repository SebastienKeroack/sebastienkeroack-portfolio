<?php

namespace SKPortfolio;

use Monolog\Level;
use Monolog\Logger;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\StreamHandler;

final class Log {
  private static ?Logger $logger = null;

  public static function debug(string $message): void {
    self::ensureInitialized();
    self::$logger->debug($message);
  }

  private static function initialize(): void {
    $formatter = new LineFormatter("[%datetime%] %message%\n", 'Y-m-d H:i:s');

    $streamHandler = new StreamHandler('php://stdout', Level::Debug);
    $streamHandler->setFormatter($formatter);

    $logger = new Logger('skportfolio');
    $logger->pushHandler($streamHandler);
    self::$logger = $logger;
  }

  private static function ensureInitialized(): void {
    if (!(self::$logger instanceof Logger)) {
      self::initialize();
    }
  }
}
