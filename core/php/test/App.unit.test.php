<?php

namespace SKPortfolio\Test;

use SKPortfolio\App;
use SKPortfolio\Log;

pest()->group('App');

describe('App::__construct', function () {
  afterEach(function () {
    unset($_ENV['LANG']);
  });

  it('should initialize the application with default settings', function () {
    $app = new App();
    expect($app)->toHaveProperty('langCode');
    expect($app->langCode)->toBe('en');
  });

  it(
    'should initialize the application with default settings set to "en"',
    function () {
      $_ENV['LANG'] = 'en';
      $app = new App();
      expect($app)->toHaveProperty('langCode');
      expect($app->langCode)->toBe('en');
    },
  );

  it(
    'should initialize the application with default settings set to "fr"',
    function () {
      $_ENV['LANG'] = 'fr';
      $app = new App();
      expect($app)->toHaveProperty('langCode');
      expect($app->langCode)->toBe('fr');
    },
  );

  it(
    'should initialize the application with a lowercase language code',
    function () {
      $app = new App('EN');
      expect($app->langCode)->toBe('en');
    },
  );

  it(
    'should initialize the application with language code set to "fr"',
    function () {
      $app = new App('fr');
      expect($app->langCode)->toBe('fr');
    },
  );
});

describe('App::loadEnvironmentVariables', function () {
  beforeEach(function () {
    $this->_ENV = $_ENV;
  });

  afterEach(function () {
    $_ENV = $this->_ENV;
  });

  it('should load environment variables with default directory', function () {
    $app = new App();
    expect($app->loadEnvironmentVariables())->toBeTrue();
  });

  it('should load and expose expected environment variables ', function () {
    $app = new App();
    expect($_ENV)->not->toHaveKey('RECAPTCHA_SECRET_KEY');
    expect($_ENV)->not->toHaveKey('SMTP_PASSWORD');
    expect($_ENV)->not->toHaveKey('PHPMAILER_LANG_DIR');
    expect($app->loadEnvironmentVariables())->toBeTrue();
    expect($_ENV)->toHaveKey('RECAPTCHA_SECRET_KEY');
    expect($_ENV)->toHaveKey('SMTP_PASSWORD');
    expect($_ENV)->toHaveKey('PHPMAILER_LANG_DIR');
  });

  it('should return false for non-existent .env file', function () {
    $app = new App();
    expect(
      $app->loadEnvironmentVariables('/non/existent/directory'),
    )->toBeFalse();
  });
});
