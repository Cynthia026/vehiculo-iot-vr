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

### Monitoreo (Práctica 4.2)
- Tarjeta con el **último movimiento** registrado en Amazon RDS (fecha y hora locales).
- Tabla con los **últimos 10 movimientos**, que se actualiza en tiempo real por WebSocket.
- Indicadores de estado de **WSS**, **AWS (API REST)** y **RDS (base de datos)**.

### Consola de botones 3D
- Frente a la excavadora hay una **consola física en 3D** con los mismos controles: cruz de Brazo y motores, cruz de Movimiento, tres botones de accesorios y un botón rojo **STOP**.
- Se usa con el mouse o con el dedo. Los botones se hunden y se iluminan al presionarlos, y la Luz y la Velocidad se quedan encendidas mientras estén activas.
- La consola también refleja lo que haces con los botones de la página, el teclado o las demos.
- Al arrastrar fuera de la consola, la cámara sigue rotando como siempre.

### Modo simulación
- Si AWS no responde, aparece el indicador **Modo simulación** y **todos los botones siguen funcionando**: mueven el gemelo 3D, pero no se envía nada al vehículo real.
- Monitoreo muestra un historial local con los últimos 10 movimientos simulados.
- Incluye tres demos locales: *Recorrido cuadrado*, *Excavación* y *Exhibición*.
- En cuanto AWS responde, la app cambia sola al control real.

### Gemelo digital 3D
- Escena espacial con plataforma iluminada y un modelo articulado de la excavadora: orugas, torreta giratoria, brazo hidráulico, faros y onda de sonido.
- El modelo **reacciona a los comandos** que se envían y a los eventos en vivo del WebSocket, incluidas las demos.
- Cámara orbital: arrastra el fondo para rotar y usa la rueda del mouse para hacer zoom. El botón **Centrar 3D** regresa la vista inicial.

### Modo VR (WebXR)
- Botón **Modo VR** para entrar a la sesión inmersiva desde el navegador de las gafas.
- **Dos paneles flotantes**: Control (izquierda) y Monitoreo (derecha).
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
| Comunicación | Fetch API (REST) y WebSocket seguro (WSS) |
| Backend | API en AWS con base de datos Amazon RDS (MySQL) |

Three.js se carga con un **import map** desde jsDelivr, así que el proyecto funciona en GitHub Pages o Vercel sin bundler.

---

## Estructura del proyecto

```
vehiculo-iot-vr/
├── index.html                 # Página principal (vistas Control y Monitoreo)
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
│   │   ├── vr-controls.js     # Sesión WebXR, mandos y paneles flotantes
│   │   └── joystick.js        # (Versión anterior, ya no se usa)
│   ├── data/
│   ├── Favicon_Iot_vehiculo.png
│   ├── Favicon_Iot_vehiculo.jpg
│   └── favicon.ico
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
