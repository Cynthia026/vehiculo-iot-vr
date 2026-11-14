# Vehículo IoT · Control y Monitoreo 3D / VR

Aplicación web para **controlar y monitorear en tiempo real una excavadora IoT** conectada a un backend en AWS. Incluye un **gemelo digital 3D** del vehículo hecho con Three.js y un **modo de Realidad Virtual (WebXR)** para operar el vehículo desde gafas VR como Meta Quest.

> Desarrollado por **Cynthia Martínez García** · 2026

---

## Características

### Control (Práctica 4.1)
- **Botones de Movimiento** (lado derecho): Avanzar, Retroceder, Girar izquierda y Girar derecha.
- **Botones de Brazo y motores** (lado izquierdo): Subir brazo, Bajar brazo, Motor izquierda y Motor derecha.
- **Parada segura**: mientras mantienes presionado un botón, el vehículo se mueve. Al soltarlo se envía **DETENER** automáticamente.
- **Botón Detener** para paro inmediato. Esta orden no puede ser cancelada por un movimiento que se envíe después.
- **Accesorios** (arriba): Velocidad, Sonido y Luz. Se cargan desde el catálogo de comandos de la API.
- **Secuencias demo** (abajo): ejecutar y cancelar rutinas automáticas.
- **Botones con relieve 3D**: tienen sombra y canto inferior, y se hunden al presionarlos.
- **Atajos de teclado** en escritorio:

  | Tecla | Acción |
  |---|---|
  | `W` / `↑` | Avanzar |
  | `S` / `↓` | Retroceder |
  | `A` / `←` | Girar izquierda |
  | `D` / `→` | Girar derecha |
  | `R` / `F` | Subir / bajar brazo |
  | `Q` / `E` | Motor izquierda / derecha |
  | `Espacio` | Detener |

### Control con IA: voz, gestos y giroscopio
En el panel **Control con IA** (abajo a la izquierda) se activa cada modo con su botón. **Solo puede haber un método activo a la vez**: al elegir otro, el anterior se apaga (y si estaba cargando, se cancela). El botón **?** muestra la lista de comandos. Los tres modos usan la misma lógica segura que los botones: el vehículo se mueve mientras dura el comando y luego se envía DETENER.

**🎤 Voz** (reconocimiento de voz del navegador, español de México)
| Frase | Acción |
|---|---|
| "avanza", "sigue derecho", "avanza 3 segundos" | Avanzar (2 s por defecto, hasta 10 s) |
| "retrocede", "reversa" | Retroceder |
| "gira a la derecha / izquierda" | Girar |
| "sube el brazo", "baja la pala" | Brazo |
| "motor derecho / izquierdo" | Motores |
| "enciende / apaga la luz" | Luz (no la cambia si ya está como pediste) |
| "activa el turbo", "velocidad normal" | Velocidad |
| "toca el claxon" | Sonido |
| "inicia la demo de excavación", "cancela la demo" | Demos |
| **"alto"**, "detente", "para", "frena" | Detener al instante, aunque la frase no haya terminado |

Funciona en Chrome y Edge (escritorio y Android) y requiere internet. Firefox y el navegador de Meta Quest no lo soportan.

**✋ Gestos** (cámara + modelo de IA *MediaPipe Gesture Recognizer* de Google, que corre en el navegador)
| Gesto | Acción |
|---|---|
| ☝ Índice apuntando arriba / abajo | Avanzar / Retroceder |
| 👉 👈 Índice apuntando a un lado | Girar hacia ese lado |
| ✋ Palma abierta o ✊ puño | Detener |
| 👍 / 👎 | Subir / bajar brazo |
| ✌ Victoria | Luz |
| 🤟 "Te quiero" | Sonido |

Se muestra la imagen de la cámara con los puntos de la mano detectados. Si la mano sale de la imagen, el vehículo se detiene. La imagen de la cámara no sale del navegador.

**📱 Giroscopio** (desde el celular)
- Al activarlo se toma la posición actual como neutra (el botón **Recalibrar** la vuelve a tomar).
- Tiene dos modos, que se eligen dentro del panel:

  | Inclinación | 🚜 Conducir | 🦾 Brazo | ✨ Accesorios |
  |---|---|---|---|
  | Hacia adelante (alejar la parte de arriba) | Avanzar | Bajar brazo | Turbo (Velocidad) |
  | Hacia ti | Retroceder | Subir brazo | — |
  | A la izquierda | Girar izquierda | Motor izquierdo | Luz |
  | A la derecha | Girar derecha | Motor derecho | Sonido |

- En **Accesorios** cada inclinación activa el accesorio **una sola vez**; para activar otro hay que regresar al centro. Al entrar a este modo ya inclinado, no se activa nada hasta volver al centro.

- Hay que inclinar unos 14° para que reaccione. Al regresar a la posición neutra se detiene. Al cambiar de modo, el movimiento en curso se detiene.
- Un indicador muestra la inclinación en tiempo real. Funciona mejor con el celular en vertical. En iPhone pide permiso de movimiento.

> Cámara, micrófono y giroscopio solo funcionan con **HTTPS** (GitHub Pages) o en `localhost`. Al cambiar de pestaña o minimizar, se apagan solos y el vehículo se detiene.

### Asistente IA conversacional
El botón **Asistente IA** de la barra superior abre un chat donde le pides cosas con tus palabras. El asistente arma un plan de pasos, lo muestra y lo ejecuta, marcando cada paso en curso y los terminados. **Detener** (o "alto") cancela el plan en cualquier momento.

- **Sin configurar nada**, usa un intérprete local que entiende:
  - secuencias: "avanza 2 segundos, luego gira a la derecha y enciende la luz"
  - giros por ángulo: "gira 90 grados a la izquierda", "media vuelta", "da una vuelta completa"
  - figuras y maniobras: "haz un cuadrado", "un triángulo", "zigzag", "baila", "saluda", "excava"
  - repeticiones y pausas: "sube y baja el brazo 3 veces", "espera 2 segundos"
- **Con IA (Claude)** entiende cualquier forma de pedirlo y también conversa ("¿qué puedes hacer?"). En ⚙ se configura de una de dos formas:
  1. **Clave propia**: pega tu clave de API de Anthropic. Se guarda solo en ese navegador y se usa directamente desde ahí. Es ideal para pruebas personales; no la uses en computadoras compartidas.
  2. **Servidor proxy** (recomendado para compartir la página): publica `server/cloudflare-worker.js` en Cloudflare Workers con tu clave como secreto y pega su URL. Así nadie ve la clave. Las instrucciones están dentro del archivo.
- El modelo predeterminado es `claude-haiku-5-5` (rápido y económico) y se puede cambiar en ⚙.
- Todo plan pasa por una validación antes de ejecutarse: solo comandos conocidos, máximo 10 s por movimiento, 30 pasos y 90 s en total.
- Con el modo **Voz** activo, las frases complejas ("haz un cuadrado y luego toca el claxon") se envían automáticamente al asistente. El chat también tiene su propio botón de micrófono para dictar.

### App instalable (PWA)
- La página se puede **instalar como app** en el celular o la computadora, con su ícono, a pantalla completa y sin barra del navegador.
  - **Android / Chrome / Edge**: aparece el botón **Instalar app** en la barra superior (o en el menú ⋮ → *Instalar aplicación*).
  - **iPhone / iPad (Safari)**: Compartir → *Agregar a inicio*. El botón **Instalar app** muestra estas instrucciones.
- **Funciona sin conexión** en modo simulación después de la primera visita, gracias al service worker (`sw.js`), que guarda la app y las librerías.
- La app instalada tiene un atajo directo al **Asistente IA** (mantén presionado el ícono).

### Velocímetro
- En el panel de Movimiento se muestra la **velocidad actual del vehículo en km/h**, con una barra de nivel.
- Indica el modo (**Normal** o **Turbo**, que se activa con el botón Velocidad) y el estado: *Avanzando*, *Retrocediendo*, *Girando* o *Detenido*.
- Si el vehículo llega al borde de la plataforma, marca **Bloqueado (borde)** y la velocidad baja a 0.
- El panel VR también muestra la velocidad.

### Indicadores de conexión
- Estado de **WSS**, **AWS (API REST)** y **RDS (base de datos)** en la barra superior.
- La vista de Monitoreo está oculta en esta versión. Su código sigue en el proyecto por si se quiere volver a activar.

### Consola de botones 3D
- Frente a la excavadora hay una **consola física en 3D** con los mismos controles: cruz de Brazo y motores, cruz de Movimiento, tres botones de accesorios y un botón rojo **STOP**.
- Se usa con el mouse o con el dedo. Los botones se hunden y se iluminan al presionarlos, y la Luz y la Velocidad se quedan encendidas mientras estén activas.
- La consola también refleja lo que haces con los botones de la página, el teclado o las demos.
- Al arrastrar fuera de la consola, la cámara sigue rotando como siempre.
- La consola **se desplaza junto con el vehículo**, siempre delante de él, para que nunca se pierda de la pantalla.

### Modo simulación
- Si AWS no responde, aparece el indicador **Modo simulación** y **todos los botones siguen funcionando**: mueven el gemelo 3D, pero no se envía nada al vehículo real.
- Incluye tres demos locales: *Recorrido cuadrado*, *Excavación* y *Exhibición*.
- En cuanto AWS responde, la app cambia sola al control real.

### Gemelo digital 3D
- Escena espacial con plataforma iluminada y un modelo articulado de la excavadora: orugas, torreta giratoria, brazo hidráulico, faros y onda de sonido.
- El modelo **reacciona a los comandos** que se envían y a los eventos en vivo del WebSocket, incluidas las demos.
- **La cámara sigue al vehículo**: cada vez que avanza, retrocede o gira, la vista se recentra suavemente. Así la excavadora y la consola de controles 3D (que se desplaza junto con ella) nunca se salen de la pantalla.
- Con el vehículo quieto puedes rotar la cámara libremente arrastrando el fondo y hacer zoom con la rueda del mouse. El botón **Centrar 3D** regresa la vista inicial.

### Modo VR (WebXR)
- Botón **Modo VR** para entrar a la sesión inmersiva desde el navegador de las gafas.
- **Panel flotante de Control** con todos los botones y la velocidad actual.
- **Puntero láser** en ambos mandos. Mantén el **gatillo** sobre un botón de movimiento para mover el vehículo; al soltarlo se envía DETENER.
- El **botón lateral (grip)** de cualquier mando es el **paro de emergencia**.
- Al salir de VR el vehículo se detiene automáticamente.

### Robustez
- **Modo simulación**: la interfaz funciona de inmediato y reintenta conectar con AWS cada 8 s.
- **Reconexión automática del WebSocket**: cada 3 s los primeros 5 intentos y después cada 15 s.
- Si el navegador no soporta WebGL o el CDN de Three.js no responde, **los controles siguen funcionando** sin la parte 3D.
- Diseño adaptable: escritorio, laptop, tableta y celular en vertical u horizontal.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Interfaz | HTML5, CSS3, JavaScript (módulos ES, sin compilación) |
| Estilos | Bootstrap 5.3, Bootstrap Icons, fuente Outfit |
| 3D / VR | Three.js 0.170 (OrbitControls, WebXR, XRControllerModelFactory) |
| IA | Web Speech API (voz), MediaPipe Tasks Vision 0.10.21 · Gesture Recognizer (gestos) y API de Claude (asistente) |
| App instalable | Web App Manifest + Service Worker |
| Sensores | DeviceOrientation API (giroscopio) y getUserMedia (cámara) |
| Comunicación | Fetch API (REST) y WebSocket seguro (WSS) |
| Backend | API en AWS con base de datos Amazon RDS (MySQL) |

Three.js se carga con un **import map** desde jsDelivr, así que el proyecto funciona en GitHub Pages o Vercel sin bundler.

---

## Estructura del proyecto

```
vehiculo-iot-vr/
├── index.html                 # Página principal (vista de Control)
├── manifest.webmanifest       # Datos de la app instalable (nombre, íconos, colores)
├── sw.js                      # Service worker: caché y funcionamiento sin conexión
├── assets/
│   ├── css/
│   │   └── styles.css         # Estilos, distribución de paneles y diseño adaptable
│   ├── js/
│   │   ├── config.js          # URLs de la API / WebSocket e ID del vehículo
│   │   ├── api.js             # Cliente REST (comandos, demos, telemetría, historial)
│   │   ├── websocket.js       # Conexión WSS con reconexión automática
│   │   ├── app.js             # Orquestador: eventos, botones, teclado, WSS y 3D/VR
│   │   ├── ui.js              # Renderizado de la interfaz, sonidos y estados
│   │   ├── scene3d.js         # Escena Three.js y gemelo digital de la excavadora
│   │   ├── botones3d.js       # Consola de botones 3D dentro de la escena
│   │   ├── control-ia.js      # Control con IA: voz, gestos (MediaPipe) y giroscopio
│   │   ├── asistente-ia.js    # Asistente conversacional: intérprete local + API de Claude
│   │   ├── vr-controls.js     # Sesión WebXR, mandos y paneles flotantes
│   │   └── joystick.js        # (Versión anterior, ya no se usa)
│   ├── icons/                 # Íconos de la app instalable
│   ├── data/
│   ├── Favicon_Iot_vehiculo.png
│   ├── Favicon_Iot_vehiculo.jpg
│   └── favicon.ico
├── server/
│   └── cloudflare-worker.js   # Proxy opcional para usar la IA sin exponer la clave
├── docs/
└── src/
```

---

## Configuración

Edita `assets/js/config.js` para apuntar a tu backend:

```js
export const CONFIG = {
    API_BASE_URL: 'https://api-vehiculo-iot.duckdns.org',
    WS_BASE_URL: 'wss://api-vehiculo-iot.duckdns.org/api/demos/ws/1',
    VEHICULO_ID: 1,
    ORIGEN: 'API_POST'
};
```

### Endpoints que usa la aplicación

| Método | Endpoint | Uso |
|---|---|---|
| GET | `/api/health` | Estado de la base de datos RDS |
| GET | `/api/comandos/vehiculo/{id}` | Catálogo de comandos |
| GET | `/api/demos/vehiculo/{id}` | Catálogo de demos |
| POST | `/api/telemetria/movimiento?id_vehiculo=&id_comando=&origen=` | Enviar un comando |
| POST | `/api/demos/{id_demo}/ejecutar?id_vehiculo=` | Iniciar una demo |
| POST | `/api/demos/vehiculo/{id}/cancelar` | Cancelar la demo en curso |
| GET | `/api/telemetria/estado/{id}` | Último estado del vehículo |
| GET | `/api/telemetria/historial/{id}` | Historial de movimientos |

### Eventos WebSocket

| `tipo_evento` | Acción en la app |
|---|---|
| `estado_inicial` | Muestra el último estado en Monitoreo |
| `movimiento_individual` | Mueve el gemelo 3D y actualiza la tabla de historial |
| `inicio_demo` | Muestra el aviso de inicio |
| `movimiento_demo` | Resalta el botón activo y mueve el gemelo 3D |
| `cancelacion_demo` | Detiene el resaltado y el modelo |

---

## Cómo ejecutarlo

### En local (VS Code)
1. Abre la carpeta del proyecto en VS Code.
2. Instala la extensión **Live Server**.
3. Haz clic derecho en `index.html` y elige **Open with Live Server**.

> Abrir `index.html` con doble clic **no funciona**, porque los módulos de JavaScript necesitan un servidor.

### En GitHub Pages
1. En el repositorio entra a **Settings → Pages**.
2. En *Source* elige la rama `main` y la carpeta `/ (root)`.
3. La app quedará disponible en `https://cynthia026.github.io/vehiculo-iot-vr/`.

### En gafas VR (Meta Quest)
1. Publica la app con **HTTPS**, por ejemplo en GitHub Pages. WebXR no funciona sin HTTPS.
2. Abre la URL en el navegador de las gafas.
3. Pulsa **Modo VR** y acepta el permiso.

---

## Notas de seguridad

- La API no requiere autenticación, así que cualquiera con la URL puede enviar comandos al vehículo. Para un uso real se recomienda agregar autenticación (token o API key) en el backend.
- El texto que llega de la API se escapa antes de mostrarse en la página.

---

## Autora

**Cynthia Martínez García** — Control y Monitoreo IoT 3D / WebXR · 2026
