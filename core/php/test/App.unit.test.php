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
