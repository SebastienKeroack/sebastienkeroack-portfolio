<!DOCTYPE html>
<link rel="stylesheet" href="/assets/styles/main.css">
<link rel="stylesheet" href="/assets/styles/components/contact-form-submit.css">

<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && IN_PRODUCTION) {
    header("Location: /en/contact");
    exit();
}

use SebastienKeroack\Forms\ContactForm;

$form = new ContactForm();
$form->submit();

echo '<main>';
echo $form->toHTML();
echo '</main>';
?>
