<?php

namespace SKPortfolio\Test;

use SKPortfolio\Lang;

pest()->group('Lang');

afterEach(function () {
  Lang::clear();
});

describe('Lang::loadLanguage', function () {
  beforeEach(function () {
    $this->langDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'language';
  });

  it('should not load nonexistent language file', function () {
    $langPath = $this->langDir . DIRECTORY_SEPARATOR . 'app.lang-en.php';
    $data = Lang::loadLanguage($langPath);
    expect($data)->toBeArray();
    expect($data)->toBeEmpty();
  });

  it('should load a valid language file', function () {
    $langPath = $this->langDir . DIRECTORY_SEPARATOR . 'app.lang-fr.php';
    $data = Lang::loadLanguage($langPath);
    expect($data)->toBeArray();
    expect($data)->toHaveKey('invalid_captcha');
  });

  it(
    'should be no missing or extra translations in language file',
    function () {
      $errors = '';
      $definedLang = Lang::getAll();
      $entriesIt = new \DirectoryIterator($this->langDir);

      foreach ($entriesIt as $entry) {
        if ($entry->isDot() || !$entry->isFile()) {
          continue;
        }

        $filename = $entry->getFilename();
        if (!$entry->isReadable()) {
          $errors .= "\nCannot read " . $filename;
          continue;
        }
        if (!($lang = Lang::getLangCode($filename))) {
          $errors .= "\nInvalid language file name: " . $filename;
          continue;
        }
        if (!($loadedLang = Lang::loadLanguage($entry->getPathname()))) {
          $errors .= "\nCannot parse language file: " . $filename;
          continue;
        }

        if (
          $values = array_diff(
            array_keys($definedLang),
            array_keys($loadedLang),
          )
        ) {
          $errors .=
            "\nMissing translations in $lang: " . implode(', ', $values);
        }
        if (
          $values = array_diff(
            array_keys($loadedLang),
            array_keys($definedLang),
          )
        ) {
          $errors .= "\nExtra translations in $lang: " . implode(', ', $values);
        }
      }

      expect($errors)->toBeEmpty($errors);
    },
  );
});

describe('Lang::getLangParts', function () {
  it('should parse valid language codes correctly', function () {
    expect(Lang::getLangParts('en'))->toBe([
      0 => 'en',
      'lang' => 'en',
      'script' => '',
      'country' => '',
    ]);
    expect(Lang::getLangParts('fr'))->toBe([
      0 => 'fr',
      'lang' => 'fr',
      'script' => '',
      'country' => '',
    ]);
    expect(Lang::getLangParts('en_US'))->toBe([
      0 => 'en_us',
      'lang' => 'en',
      'script' => '',
      'country' => '_us',
    ]);
    expect(Lang::getLangParts('fr_CA'))->toBe([
      0 => 'fr_ca',
      'lang' => 'fr',
      'script' => '',
      'country' => '_ca',
    ]);
    expect(Lang::getLangParts('sr_latn'))->toBe([
      0 => 'sr_latn',
      'lang' => 'sr',
      'script' => '_latn',
      'country' => '',
    ]);
    expect(Lang::getLangParts('zh_Hans'))->toBe([
      0 => 'zh_hans',
      'lang' => 'zh',
      'script' => '_hans',
      'country' => '',
    ]);
  });

  it('should return empty array for invalid language codes', function () {
    expect(Lang::getLangParts('english'))->toBe([]);
    expect(Lang::getLangParts('french'))->toBe([]);
    expect(Lang::getLangParts('enUS'))->toBe([]);
    expect(Lang::getLangParts('frCA'))->toBe([]);
    expect(Lang::getLangParts('en-US'))->toBe([]);
    expect(Lang::getLangParts('fr-CA'))->toBe([]);
  });
});

describe('Lang::getLangCode', function () {
  it('should extract language code from filename', function () {
    expect(Lang::getLangCode('app.lang-en.php'))->toBe('en');
    expect(Lang::getLangCode('app.lang-fr.php'))->toBe('fr');
    expect(Lang::getLangCode('app.lang-fr_ca.php'))->toBe('fr_ca');
    expect(Lang::getLangCode('lang-en.php'))->toBe('');
    expect(Lang::getLangCode('lang-en_us.php'))->toBe('');
    expect(Lang::getLangCode('app.lang-.php'))->toBe('');
  });
});

describe('Lang::getLangCodes', function () {
  it('should generate all language variants', function () {
    expect(Lang::getLangCodes('en_us'))->toBe(['en_us', 'en']);
    expect(Lang::getLangCodes('fr_ca'))->toBe(['fr_ca', 'fr']);
    expect(Lang::getLangCodes('sr_latn'))->toBe(['sr_latn', 'sr']);
    expect(Lang::getLangCodes('null'))->toBe([]);
    expect(Lang::getLangCodes(''))->toBe([]);
  });
});

describe('Lang::getAll', function () {
  it('should return translations with default language', function () {
    $data = Lang::getAll();
    expect($data)->toHaveKey('invalid_captcha');
    expect($data['invalid_captcha'])->toBe(
      'Please fill out the captcha form correctly.',
    );
  });

  it('should return translations in english', function () {
    Lang::initialize('en');
    $data = Lang::getAll();
    expect($data)->toHaveKey('invalid_captcha');
    expect($data['invalid_captcha'])->toBe(
      'Please fill out the captcha form correctly.',
    );
  });

  it('should return translations in french', function () {
    Lang::initialize('fr');
    $data = Lang::getAll();
    expect($data)->toHaveKey('invalid_captcha');
    expect($data['invalid_captcha'])->toBe(
      'S`il vous plaît, veuillez remplir correctement le formulaire captcha.',
    );
  });
});

describe('Lang::initialize', function () {
  it('should return false for non-existent language', function () {
    expect(Lang::initialize('zz'))->toBeFalse();
  });
});

describe('Lang::get', function () {
  it('should return the key if no translation is found', function () {
    Lang::initialize('en');
    expect(Lang::get('undefined'))->toBe('undefined');
    expect(Lang::get('null'))->toBe('null');
    expect(Lang::get(''))->toBe('');
  });

  it('should initialize with default language data', function () {
    expect(Lang::get('invalid_captcha'))->toBe(
      'Please fill out the captcha form correctly.',
    );
  });

  it('should return translations in english', function () {
    Lang::initialize('en');
    expect(Lang::get('invalid_captcha'))->toBe(
      'Please fill out the captcha form correctly.',
    );
  });

  it('should return translations in french', function () {
    Lang::initialize('fr');
    expect(Lang::get('invalid_captcha'))->toBe(
      'S`il vous plaît, veuillez remplir correctement le formulaire captcha.',
    );
  });
});
