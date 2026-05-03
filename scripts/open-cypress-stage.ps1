$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot 'apps\dental\cypress.env.json'

function Test-IsPlaceholder {
  param([string] $Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }

  return $Value -match 'doctor@example\.com|set-this|your-|PEGA_AQUI|placeholder'
}

function ConvertFrom-SecureStringToPlainText {
  param([securestring] $SecureValue)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Set-Location $repoRoot

$values = [ordered]@{}

if (Test-Path $envFile) {
  try {
    $json = Get-Content -Raw -Path $envFile | ConvertFrom-Json
    foreach ($property in $json.PSObject.Properties) {
      $values[$property.Name] = $property.Value
    }
  } catch {
    Write-Host "El archivo local de Cypress existe pero no es JSON valido:" -ForegroundColor Yellow
    Write-Host "  $envFile" -ForegroundColor Yellow
    Write-Host "Lo voy a recrear con las credenciales que escribas ahora." -ForegroundColor Yellow
    $values = [ordered]@{}
  }
}

$email = $values['STAGE_TEST_EMAIL']
$password = $values['STAGE_TEST_PASSWORD']

if ((Test-IsPlaceholder $email) -or (Test-IsPlaceholder $password)) {
  Write-Host ""
  Write-Host "Configuracion de Cypress Stage" -ForegroundColor Cyan
  Write-Host "Esto se guarda en apps/dental/cypress.env.json, que esta ignorado por Git." -ForegroundColor DarkGray
  if ((-not (Test-IsPlaceholder $values['TEST_EMAIL'])) -or (-not (Test-IsPlaceholder $values['TEST_PASSWORD']))) {
    Write-Host "Importante: stage no reutiliza TEST_EMAIL/TEST_PASSWORD porque pueden apuntar a otra cuenta." -ForegroundColor Yellow
  }
  Write-Host ""

  if (Test-IsPlaceholder $email) {
    $email = Read-Host "Email de stage"
  }

  if (Test-IsPlaceholder $password) {
    $securePassword = Read-Host "Password de stage" -AsSecureString
    $password = ConvertFrom-SecureStringToPlainText $securePassword
  }

  $values['STAGE_TEST_EMAIL'] = $email
  $values['STAGE_TEST_PASSWORD'] = $password

  $envDir = Split-Path -Parent $envFile
  if (-not (Test-Path $envDir)) {
    New-Item -ItemType Directory -Path $envDir | Out-Null
  }

  [pscustomobject]$values |
    ConvertTo-Json -Depth 10 |
    Set-Content -Path $envFile -Encoding UTF8

  Write-Host ""
  Write-Host "Credenciales locales guardadas." -ForegroundColor Green
}

$env:CYPRESS_STAGE_TEST_EMAIL = [string] $email
$env:CYPRESS_STAGE_TEST_PASSWORD = [string] $password
$env:CYPRESS_TEST_EMAIL = ''
$env:CYPRESS_TEST_PASSWORD = ''

Write-Host ""
Write-Host "Abriendo Cypress contra stage..." -ForegroundColor Cyan
Write-Host "Target: https://laralis-monorepo-preview.vercel.app" -ForegroundColor DarkGray
Write-Host ""

npm --workspace @laralis/dental run test:e2e:stage:open
