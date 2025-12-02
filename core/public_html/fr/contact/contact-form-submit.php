<!DOCTYPE html>
<link rel="stylesheet" href="/assets/styles/main.css">
<link rel="stylesheet" href="/assets/styles/components/contact-form-submit.css">

<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && IN_PRODUCTION) {
  header('Location: /fr/contact');
  exit();
}

use SKPortfolio\App;
use SKPortfolio\Forms\Contact;

$app = new App('fr');
$form = new Contact();
$form->submit();

echo '<main>';
echo $form->toHTML();
echo '</main>';


?>
