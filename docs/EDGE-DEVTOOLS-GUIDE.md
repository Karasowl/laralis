# 📱 Guía de Microsoft Edge DevTools en VSCode

## 🎯 Instalación Rápida

1. **Instalar la extensión**:
   - Abre panel de extensiones: `Ctrl+Shift+X`
   - Busca: **"Microsoft Edge Tools for VS Code"**
   - Instala la extensión oficial de Microsoft

2. **Requisitos**:
   - Microsoft Edge instalado (Windows ya lo tiene)
   - VSCode actualizado

## 🚀 Uso Básico

### Método 1: Comando Rápido
1. Levanta tu proyecto:
   ```bash
   cd web
   npm run dev
   ```

2. Abre Edge DevTools:
   - `Ctrl+Shift+P` → "Edge DevTools: Open Edge DevTools"
   - O presiona `F1` y busca "Edge DevTools"

### Método 2: Debug Panel (Recomendado)
1. Presiona `F5` o ve al panel de Debug
2. Selecciona: **"🚀 Full Stack + Edge DevTools"**
3. Automáticamente:
   - Levanta el servidor Next.js
   - Abre el preview con DevTools integrado

## 📱 Emulación de Dispositivos

Una vez abierto Edge DevTools, verás una barra de herramientas en la parte inferior con:

### 🔧 Controles de Dispositivo

1. **Selector de Dispositivos** (primer menú):
   - iPhone 12/13/14 Pro
   - iPad Air/Pro
   - Samsung Galaxy S20/S21
   - Google Pixel 5/6
   - Surface Pro/Duo
   - Responsive (ajustable)

2. **Tamaño Personalizado**:
   - Ingresa ancho x alto manualmente
   - Botón de rotación (horizontal/vertical)

3. **Simulación CSS** (icono de varita mágica):
   - Dark/Light mode
   - Print preview
   - High contrast
   - Reduced motion

4. **Simulación Visual** (icono de ojo):
   - Visión borrosa
   - Protanopia (daltonismo rojo-verde)
   - Deuteranopia
   - Tritanopia
   - Achromatopsia

## 🎨 Características Profesionales

### Live CSS Editing
- Edita CSS en tiempo real
- Los cambios se reflejan instantáneamente
- Soporte para SASS/SCSS

### Console Integrada
- Usa `console.log()` directamente
- Interactúa con el DOM
- Todo sin salir de VSCode

### Inspección de Elementos
- Click derecho → Inspect
- Ve y edita propiedades CSS
- Analiza el box model

### Network Panel
- Monitorea requests
- Analiza performance
- Debug de API calls

## ⚡ Atajos Útiles

| Acción | Atajo |
|--------|-------|
| Abrir DevTools | `Ctrl+Shift+P` → "Edge DevTools" |
| Toggle dispositivo | Click en selector de dispositivos |
| Rotar viewport | Click en botón de rotación |
| Refrescar | `F5` en el preview |
| Inspeccionar elemento | `Ctrl+Shift+C` |
| Console | `Ctrl+Shift+J` |

## 🔍 Tips Pro

1. **Multi-viewport**: Puedes abrir múltiples tabs con diferentes dispositivos
2. **Sincronización**: Los cambios en el código se reflejan automáticamente
3. **Debugging**: Puedes poner breakpoints directamente en VSCode
4. **Screenshots**: Usa el botón de cámara para capturas
5. **Touch simulation**: El preview simula eventos touch

## 🐛 Troubleshooting

### El preview no carga
```bash
# Asegúrate de que el servidor esté corriendo
cd web
npm run dev
```

### Edge DevTools no aparece
- Verifica que Microsoft Edge esté instalado
- Reinicia VSCode después de instalar la extensión

### Puerto ocupado
```bash
# Mata procesos de Node
npm run kill-node
# O usa un puerto diferente
npm run dev -- -p 3001
```

## 📊 Comparación con Alternativas

| Característica | Edge DevTools | Chrome DevTools | Live Preview |
|----------------|---------------|-----------------|--------------|
| Integrado en VSCode | ✅ | ❌ | ✅ |
| Emulación completa | ✅ | ✅ | ❌ |
| DevTools completos | ✅ | ✅ | ❌ |
| Live CSS editing | ✅ | ✅ | ❌ |
| Touch simulation | ✅ | ✅ | ❌ |
| Sin cambio de ventana | ✅ | ❌ | ✅ |

## 🎬 Workflow Recomendado

1. Abre VSCode
2. Presiona `F5` → Selecciona "🚀 Full Stack + Edge DevTools"
3. Espera a que cargue (unos segundos)
4. Selecciona el dispositivo que quieres emular
5. Desarrolla con hot reload activo
6. Usa DevTools para debugging sin salir de VSCode

---

**Última actualización**: 2025-08-29
**Extensión**: Microsoft Edge Tools for VS Code
**Compatible con**: Next.js, React, Vue, Angular, y cualquier app web