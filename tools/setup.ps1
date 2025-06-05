<#
.SYNOPSIS
Automates the setup process for the project on a Windows environment.

.DESCRIPTION
This script installs required dependencies, sets up environment variables, clones the repository,
and configures Apache virtual hosts for the project.

.NOTES
Run this script with administrator privileges to ensure all steps can be completed successfully.
#>

# Detect if the script is running in dry-run mode
$ErrorActionPreference = "Stop"

# XAMPP configuration
$xamppDir = "C:\xampp"
$xamppDownloadUrl = "https://www.apachefriends.org/xampp-files/8.2.12/xampp-windows-x64-8.2.12-0-VS16-installer.exe"
$publicHtmlDir = "$xamppDir\htdocs\public_html"

# Repository configuration
$repositoryUrl = "https://github.com/SebastienKeroack/sebastienkeroack-portfolio.git"
$repositoryDir = "$xamppDir\htdocs\sebastienkeroack"

# Composer configuration
$composerDownloadUrl = "https://getcomposer.org/Composer-Setup.exe"

# Virtual host configuration
$virtualDomainName = "sebastienkeroack.example.local"
$virtualHostConfigPath = "$xamppDir\apache\conf\extra\httpd-vhosts.conf"
$virtualHostConfigBlock = @"
<VirtualHost $virtualDomainName:80>
    ServerAdmin webmaster@$virtualDomainName
    ServerName $virtualDomainName
    ServerAlias www.$virtualDomainName
    DocumentRoot "$publicHtmlDir"

    php_value include_path ".;$xamppDir\php\PEAR;$repositoryDir\include"
    php_value auto_prepend_file "$repositoryDir\bootstrap\init.php"
</VirtualHost>
"@

# Hosts file configuration
$hostsFilePath = "C:\Windows\System32\drivers\etc\hosts"
$hostsConfigBlock = @"
127.0.0.1 $virtualDomainName
127.0.0.1 www.$virtualDomainName
"@

# Ensure the script is running with administrator privileges
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as an administrator."
    exit 1
}

function Confirm-Action {
    param (
        [string]$Message
    )

    $response = Read-Host "$Message [Y/N]:"
    return $response -match '^[Yy]$'
}

function Add-Configuration {
    param (
        [string]$FilePath,
        [string]$ConfigurationBlock
    )

    Write-Host "Preparing to modify file: $FilePath" -ForegroundColor Cyan
    Write-Host "Configuration block to be added:" -ForegroundColor Cyan
    Write-Host $ConfigurationBlock -ForegroundColor Green

    if (-not (Confirm-Action "Do you want to apply this change?")) {
        Write-Host "Skipping modification for $FilePath" -ForegroundColor Yellow
        return $false
    }

    Add-Content -Path $FilePath -Value $ConfigurationBlock
    Write-Host "Configuration appended to $FilePath" -ForegroundColor Green

    return $true
}

function Copy-File {
    param (
        [string]$SourcePath,
        [string]$TargetPath
    )

    Write-Host "Preparing to replace or copy file:" -ForegroundColor Cyan
    Write-Host "Source: $SourcePath" -ForegroundColor Cyan
    Write-Host "Target: $TargetPath" -ForegroundColor Cyan

    if (-not (Test-Path $SourcePath)) {
        Write-Error "Source file does not exist."
        exit 1
    }

    if (Test-Path $TargetPath) {
        Write-Host "Current contents of $TargetPath" -ForegroundColor Cyan
        Get-Content $TargetPath | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host "Target file does not exist. It will be created." -ForegroundColor Yellow
    }

    if (-not (Confirm-Action "Do you want to overwrite the target file?")) {
        Write-Host "Skipping replacement for $TargetPath" -ForegroundColor Yellow
        return $false
    }

    Copy-Item -Path $SourcePath -Destination $TargetPath -Force
    Write-Host "File copied to $TargetPath" -ForegroundColor Green

    return $true
}

# Step 1: Install XAMPP
Write-Host "Step 1: Installing XAMPP..."
if (-not (Test-Path $xamppDir)) {
    $xamppInstaller = "$env:TEMP\xampp-installer.exe"
    Invoke-WebRequest -Uri $xamppDownloadUrl -OutFile $xamppInstaller
    Start-Process -FilePath $xamppInstaller -ArgumentList "/S" -Wait
    Remove-Item $xamppInstaller
} else {
    Write-Host "`t XAMPP is already installed. Skipping..."
}

# Step 2: Clone the Repository
Write-Host "Step 2: Cloning the repository..."
if (-not (Test-Path $repositoryDir)) {
    git clone $repositoryUrl $repositoryDir
} else {
    Write-Host "Repository already cloned. Skipping..."
}

# Step 3: Create a Junction Link for public_html
Write-Host "Step 3: Creating a junction link for public_html..."
if (-not (Test-Path $publicHtmlDir)) {
    New-Item -ItemType Junction -Path "$publicHtmlDir" -Target "$repositoryDir\public_html"
} else {
    Write-Host "Junction link already exists. Skipping..."
}

# Step 4: Set Up Environment Variables
Write-Host "Step 4: Setting up environment variables..."
$envFile = Join-Path $repositoryDir ".env"
if (-not (Test-Path $envFile)) {
    if (Copy-File -SourcePath "$envFile.example" -TargetPath $envFile) {
        Write-Host "Environment file created. Please edit the .env file to match your local environment." -ForegroundColor Yellow
    }
} else {
    Write-Host ".env file already exists. Skipping..."
}

# Step 5: Install Composer
Write-Host "Step 5: Installing Composer..."
if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
    $composerInstaller = "$env:TEMP\Composer-Setup.exe"
    Invoke-WebRequest -Uri $composerDownloadUrl -OutFile $composerInstaller
    Start-Process -FilePath $composerInstaller -ArgumentList "/SILENT" -Wait
    Remove-Item $composerInstaller
} else {
    Write-Host "Composer is already installed. Skipping..."
}

# Step 6: Install PHP Dependencies
Write-Host "Step 6: Installing PHP dependencies..."
Set-Location $repositoryDir
composer update

# Step 7: Install Bun
Write-Host "Step 7: Installing Bun..."
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Invoke-Expression (Invoke-WebRequest -Uri "https://bun.sh/install.ps1").Content
} else {
    Write-Host "Bun is already installed. Skipping..."
}

# Step 8: Install JavaScript Dependencies
Write-Host "Step 8: Installing JavaScript dependencies..."
bun install

# Step 9: Configure Virtual Hosts
Write-Host "Step 9: Configuring virtual hosts..."
if (-not (Select-String -Path $virtualHostConfigPath -Pattern $virtualDomainName -Quiet)) {
    if (Add-Configuration -FilePath $virtualHostConfigPath -ConfigurationBlock $virtualHostConfigBlock) {
        Write-Host "Virtual host configuration added."
    }

    # Restart Apache to apply changes
    Write-Host "Restarting Apache..."
    & "$xamppDir\xampp-control.exe" --stop Apache
    Start-Sleep -Seconds 5
    & "$xamppDir\xampp-control.exe" --start Apache
    Write-Host "Apache restarted."
} else {
    Write-Host "Virtual host configuration already exists. Skipping..."
}

# Step 10: Update Hosts File
Write-Host "Step 10: Updating hosts file..."
if (-not (Select-String -Path $hostsFilePath -Pattern $virtualDomainName -Quiet)) {
    if (Add-Configuration -FilePath $hostsFilePath -ConfigurationBlock $hostsConfigBlock) {
        Write-Host "Hosts file updated."
    }
} else {
    Write-Host "Hosts file already contains the required entries. Skipping..."
}

Write-Host "Setup complete! Visit http://$virtualDomainName to verify the installation."
