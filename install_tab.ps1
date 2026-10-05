# Fast One-Click USB Build & Install Script for Aurra Testing App
param (
    [string]$DeviceSerial = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$adbPath = "C:\Users\ragun\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    $adbPath = "adb"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " AURRA TESTING APP -> USB TABLET DEPLOYER " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Connected Devices
Write-Host "`n[1/4] Checking connected USB devices..." -ForegroundColor Yellow
$devicesOutput = & $adbPath devices
Write-Host $devicesOutput

# 2. Build Web Assets for Android
Write-Host "`n[2/4] Building Vite Web Assets for Android WebView..." -ForegroundColor Yellow
& npm.cmd run build:android

# 3. Compile Android Debug APK
Write-Host "`n[3/4] Compiling Android APK with Gradle..." -ForegroundColor Yellow
Set-Location "$ScriptDir\android"
& cmd.exe /c gradlew.bat assembleDebug
Set-Location $ScriptDir

$apkPath = "$ScriptDir\android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
    Write-Error "APK not found at $apkPath"
    exit 1
}

# Copy to root convenience location
Copy-Item -Force $apkPath "$ScriptDir\testing_app.apk"

# 4. Install & Launch on Tablet
Write-Host "`n[4/4] Installing & Launching APK on Tablet..." -ForegroundColor Yellow
if ($DeviceSerial) {
    & $adbPath -s $DeviceSerial install -r $apkPath
    & $adbPath -s $DeviceSerial shell am start -n com.robomiracle.testingapp/com.robomiracle.aurra1.MainActivity
} else {
    & $adbPath install -r $apkPath
    & $adbPath shell am start -n com.robomiracle.testingapp/com.robomiracle.aurra1.MainActivity
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host " DEPLOYMENT COMPLETE! APP LIVE ON TABLET  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
