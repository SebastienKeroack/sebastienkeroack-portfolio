# Installation Guide for Windows

This guide provides step-by-step instructions to set up the project on a Windows environment. By following this guide, you will have a fully functional local development environment.

---

## Table of Contents

1. [Releases](#Releases)
2. [Installation](#Installation)
   - [Install XAMPP](#1-Install-XAMPP)
   - [Clone the Repository](#2-Clone-the-Repository)
   - [Set Up Environment Variables](#3-Set-Up-Environment-Variables)
   - [Install Composer](#4-Install-Composer)
   - [Install Bun](#5-Install-Bun)
   - [Configure Virtual Hosts](#6-Configure-Virtual-Hosts)
3. [Additional Notes](#Additional-Notes)
4. [Prerequisites](#Prerequisites)

---

## Releases

#### &nbsp;&nbsp;&nbsp;&nbsp;Tested on Windows 11

| Release | Branch / Tag                                                 | Bun   | Composer | XAMPP  |
| ------- | ------------------------------------------------------------ | ----- | -------- | ------ |
| Stable  | [main](https://github.com/SebastienKeroack/sebastienkeroack) | 1.2.8 | 2.8.8    | 8.2.12 |

- [Bun: A JavaScript runtime, package manager, test runner and bundler.](https://bun.sh/)
- [Composer: An application-level dependency manager for the PHP programming language.](https://getcomposer.org/)
- [XAMPP: A completely free, easy-to-install Apache distribution containing MariaDB, PHP and Perl.](https://www.apachefriends.org/)

---

## Installation

### 1. Install XAMPP:

1. **Download XAMPP**:

   - Visit the [XAMPP download page](https://www.apachefriends.org/download.html) and download the installer for your system.

2. **Install Required Components**:

   - During installation, ensure the following components are selected:
     - `Server -> Apache`
     - `Programming Languages -> PHP`

3. **Verify Installation**:

   - After installation, open the **XAMPP Control Panel** and start the **Apache** service.
   - Visit `http://localhost` in your browser to confirm that XAMPP is running correctly.

4. **Ensure Virtual Hosts Are Enabled**:

   - Open the `httpd.conf` file located in the `C:\xampp\apache\conf` directory.
   - Ensure the following line is uncommented to enable virtual hosts:
     ```properties
     Include conf/extra/httpd-vhosts.conf
     ```

---

### 2. Clone the Repository:

1. **Locate the `htdocs` Directory**:

   - Open **Windows PowerShell** and run the following command to locate the `htdocs` directory:
     ```powershell
     $phpDir = Split-Path (Get-Command php).Source
     $htdocsDir = Join-Path (Split-Path $phpDir -Parent) "htdocs"
     ```
   - _Note_: This step is optional if you already know the location of the `htdocs` directory.

2. **Clone the Repository**:

   - Navigate to the directory where you want to clone the repository:
     ```powershell
     git clone https://github.com/SebastienKeroack/sebastienkeroack.git .
     Set-Location sebastienkeroack
     ```

3. **Create a Junction Link**:

   - Create a junction link to the `public_html` directory within the `htdocs` directory:
     ```powershell
     cmd /c mklink /J "$htdocsDir\public_html" public_html
     ```
   - _Note_: This allows the `public_html` directory to be accessible from the `htdocs` directory without duplicating files.

---

### 3. Set Up Environment Variables:

1. **Locate the `.env.example` File**:

   - In the root of the repository, locate the `.env.example` file. This file contains example environment variable configurations.

2. **Create the `.env` File**:

   - Copy the `.env.example` file to a new file named `.env`. You can do this using **Windows PowerShell**:
     ```powershell
     Copy-Item -Path ".env.example" -Destination ".env"
     ```
   - _Note_: Alternatively, you can manually copy and rename the file using **File Explorer**.

3. **(Optional) Edit the `.env` File**:

   - Open the newly created `.env` file in a text editor.
   - Update the configuration values to match your local environment. For example:
     ```env
     # reCAPTCHA testing key for local environments
     RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
     ```

---

### 4. Install Composer:

1. **Download Composer**:

   - Visit the [Composer download page](https://getcomposer.org/download/) and download the `Composer-Setup.exe` installer.

2. **Run the Installer**:

   - Execute the `Composer-Setup.exe` file and follow the installation wizard. Ensure Composer is added to your system's PATH.

3. **Install Dependencies**:

   - Navigate to the repository directory and run:
     ```shell
     composer update
     ```
   - This will install all required PHP dependencies for the project.

---

### 5. Install Bun:

1. **Install Bun**:

   - Open **Windows PowerShell** in the repository directory and run the following command to install Bun at the user level:
     ```powershell
     irm https://bun.sh/install.ps1 | iex
     ```

2. **Install Repository Dependencies**:

   - Install the required packages for the repository by running:
     ```shell
     bun install
     ```

3. **(Optional) Install `bun-run-all`**:

   - If you need the `bun-run-all` package to run multiple scripts concurrently (e.g., `bun run lint` or `bun run fix`), install it globally:
     ```shell
     bun install -g @3c1u/bun-run-all
     ```

---

### 6. Configure Virtual Hosts:

1. **Locate the `httpd-vhosts.conf` File**:

   - Open the `httpd-vhosts.conf` file normally located in the following directory:
     ```
     C:\xampp\apache\conf\extra\httpd-vhosts.conf
     ```

2. **Edit the File**:

   - Open the file in a text editor and add the following configuration:

     ```properties
     <VirtualHost sebastienkeroack.example.local:80>
         ServerAdmin "webmaster@sebastienkeroack.example.local"
         ServerName "sebastienkeroack.example.local"
         ServerAlias "www.sebastienkeroack.example.local"
         DocumentRoot "C:\xampp\htdocs\public_html"

         php_value include_path ".;C:\xampp\php\PEAR;C:\path\to\repository\sebastienkeroack\include"
         php_value auto_prepend_file "sebastienkeroack/bootstrap/init.php"
     </VirtualHost>
     ```

   - **Update the `DocumentRoot` Path**:
     - Replace `C:\xampp\htdocs\public_html` with the correct path to your `public_html` directory if it differs.
   - **Update the `include_path` Path**:
     - Replace `C:\path\to\repository\sebastienkeroack\include` with the correct path to the `include` directory of the repository.

3. **Update the `hosts` File**:

   - Add the following entry to your `hosts` file to map the domain to your local machine:
     ```
     127.0.0.1 sebastienkeroack.example.local
     127.0.0.1 www.sebastienkeroack.example.local
     ```
   - The `hosts` file is located at:
     ```
     C:\Windows\System32\drivers\etc\hosts
     ```
   - Open the file in a text editor with administrator privileges to make changes.

4. **Restart Apache**:

   - Open the **XAMPP Control Panel** and restart the **Apache** service to apply the changes.

5. **Verify the Configuration**:

   - Open your browser and navigate to:
     ```
     http://sebastienkeroack.example.local
     ```
   - You should see the website served from the `public_html` directory.

---

## Additional Notes:

- **PowerShell Execution Policy**:

  If you encounter errors during the installation (e.g., script execution is blocked), update your PowerShell execution policy:

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

- **Administrator Privileges**:

  Some steps, such as editing the `hosts` file or installing software, may require administrator privileges.

- **Firewall Settings**:

  If you cannot access `http://localhost` or the virtual host, check your firewall settings to ensure Apache is allowed through.

---

## Prerequisites

- **Git**: Ensure Git is installed and added to your system's PATH before cloning the repository. [Download Git](https://git-scm.com/downloads)
- **PowerShell**: Use Windows PowerShell 5.1 or later. [Learn more about PowerShell](https://docs.microsoft.com/en-us/powershell/)
