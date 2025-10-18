@echo off
echo ========================================
echo Aplicando migracion CASCADE DELETE
echo ========================================
echo.

REM Verificar si existe Supabase CLI
where supabase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Supabase CLI no esta instalado
    echo Instala con: npm install -g supabase
    pause
    exit /b 1
)

echo Conectando a Supabase...
cd /d E:\dev-projects\laralis

REM Aplicar la migracion
echo Ejecutando migracion 29_complete_cascade_delete.sql...
supabase db push --db-url "%DATABASE_URL%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo EXITO: Migracion aplicada correctamente!
    echo ========================================
    echo.
    echo Cambios aplicados:
    echo - CASCADE DELETE en todas las relaciones de usuario
    echo - Tablas verificadas: verification_codes, category_types, etc.
    echo - Cuando se borre un usuario, se borraran TODOS sus datos
) else (
    echo.
    echo ERROR: No se pudo aplicar la migracion
    echo Por favor, ejecutala manualmente en Supabase SQL Editor
)

pause