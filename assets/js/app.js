// assets/js/app.js
import { api } from './api.js?v=16';
import { wsManager } from './websocket.js?v=16';
import { ui, normalizar } from './ui.js?v=16';
import { CONFIG } from './config.js?v=16';

let catalogoComandos = [];
let idComandoDetener = null;
let vistaActual = 'control';
let comandoActivoActual = null; // Evita envíos duplicados mientras se mantiene presionado un botón

let reintentoTimer = null;
let primerFallo = true;

// --- MODO SIMULACIÓN ---
// Mientras AWS no responde, todos los botones siguen funcionando: mueven el gemelo 3D,
// registran un historial local en Monitoreo y ejecutan demos locales. No se envía nada al vehículo real.
let modoSimulacion = true;
const historialSim = [];
let demoSimTimers = [];

const DEMOS_SIM = [
    {
        id_demo: 'sim-recorrido',
        nombre: 'Recorrido cuadrado (simulación)',
        pasos: [
            ['AVANZAR', 1400], ['GIRAR_DERECHA', 1000],
            ['AVANZAR', 1400], ['GIRAR_DERECHA', 1000],
            ['AVANZAR', 1400], ['GIRAR_DERECHA', 1000],
            ['AVANZAR', 1400], ['GIRAR_DERECHA', 1000]
        ]
    },
    {
        id_demo: 'sim-excavacion',
        nombre: 'Excavación (simulación)',
        pasos: [
            ['LUZ', 400], ['BAJAR_BRAZO', 1100], ['MOTOR_IZQUIERDA', 1100],
            ['SUBIR_BRAZO', 1100], ['MOTOR_DERECHA', 1100], ['BAJAR_BRAZO', 700], ['LUZ', 400]
        ]
    },
    {
        id_demo: 'sim-exhibicion',
        nombre: 'Exhibición (simulación)',
        pasos: [
            ['SONIDO', 700], ['VELOCIDAD', 400], ['GIRAR_IZQUIERDA', 2400],
            ['AVANZAR', 1100], ['RETROCEDER', 1100], ['VELOCIDAD', 400], ['SONIDO', 700]
        ]
    }
];

// Mapa de respaldo por ID de comando en caso de que aún no esté en catálogo
const MAPA_COMANDOS_ID = {
    1: 'AVANZAR',
    2: 'RETROCEDER',
    3: 'GIRAR_IZQUIERDA',
    4: 'GIRAR_DERECHA',
    5: 'SUBIR_BRAZO',
    6: 'BAJAR_BRAZO',
    7: 'MOTOR_IZQUIERDA',
    8: 'MOTOR_DERECHA',
    9: 'VELOCIDAD',
    10: 'SONIDO',
    11: 'LUZ',
    12: 'Detener'
};

const MOVIMIENTOS = new Set([
    'AVANZAR', 'RETROCEDER', 'GIRAR_IZQUIERDA', 'GIRAR_DERECHA',
    'SUBIR_BRAZO', 'BAJAR_BRAZO', 'MOTOR_IZQUIERDA', 'MOTOR_DERECHA'
]);

// "GIRAR_IZQUIERDA" -> "Girar izquierda"
const etiquetaCmd = (n) => {
    const t = String(n || '').replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
};

async function inicializar() {
    try {
        // 1. Escenario 3D, consola de botones 3D y modo VR (opcional: si falla, el control sigue funcionando)
        let scene3d = null;
        let vrManager = null;
        let consola3d = null;
        try {
            const { Scene3DManager } = await import('./scene3d.js?v=16');
            const { VRManager } = await import('./vr-controls.js?v=16');
            const { Consola3D } = await import('./botones3d.js?v=16');
            scene3d = new Scene3DManager('three-canvas');

            const callbacksBotones = {
                // Movimiento: mientras se mantiene presionado; accesorios: un solo envío
                onPress: (normCmd, instantaneo = false) => {
                    if (instantaneo) accionAccesorio(normCmd);
                    else presionarBotonDireccion(normCmd);
                },
                onRelease: () => soltarBotonDireccion(),
                onStop: () => pararTodo()
            };

            consola3d = new Consola3D(scene3d, callbacksBotones);

            vrManager = new VRManager(scene3d, {
                onPressCommand: (normCmd, isInstant = false) => callbacksBotones.onPress(normCmd, isInstant),
                onReleaseCommand: callbacksBotones.onRelease,
                onStop: callbacksBotones.onStop,
                onStartDemo: (idDemo) => iniciarDemo(idDemo),
                onCancelDemo: () => cancelarDemo(),
                onFeedback: (msg, type, duration) => ui.showFeedback(msg, type, duration)
            });
        } catch (err3d) {
            console.error('Escenario 3D/VR no disponible:', err3d);
            document.getElementById('btn-vr')?.setAttribute('disabled', '');
            document.getElementById('btn-reset-cam')?.setAttribute('disabled', '');
        }

        ui.attach3DAndVR(scene3d, vrManager, consola3d);

        // Velocímetro (se actualiza ~10 veces por segundo con la velocidad real del gemelo 3D)
        if (scene3d) {
            let acumulado = 0;
            scene3d.registerVRUpdate((dt) => {
                acumulado += dt;
                if (acumulado < 0.1) return;
                acumulado = 0;
                const ms = scene3d.motionState;
                const kmh = scene3d.getVelocidadKmh();
                let estado = 'Detenido';
                if (ms.drive > 0) estado = kmh > 0.05 ? 'Avanzando' : 'Bloqueado (borde)';
                else if (ms.drive < 0) estado = kmh > 0.05 ? 'Retrocediendo' : 'Bloqueado (borde)';
                else if (ms.turn > 0) estado = 'Girando a la izquierda';
                else if (ms.turn < 0) estado = 'Girando a la derecha';
                ui.actualizarVelocimetro(kmh, scene3d.getVelocidadMaxKmh(), ms.highSpeed, estado);
            });
        }

        // 2. Mostrar la interfaz de inmediato en MODO SIMULACIÓN hasta que AWS responda
        activarSimulacion();
        configurarControles(scene3d);

        // 3. Conectar WSS y enlazar la escucha de mensajes
        wsManager.onMessage = procesarMensajeWSS;
        wsManager.connect();

        // 4. Verificar estado de Amazon RDS
        await verificarRDS();

        // 5. Cargar Catálogos para Control
        await cargarCatalogos();

    } catch (error) {
        console.error('Error en la inicialización:', error);
        ui.showFeedback('Error de conexión con el servidor AWS', 'danger');
    }
}

// Configura los eventos de botones direccionales, teclado, pestañas y demos
function configurarControles(scene3d) {
    // Botón centrar cámara 3D
    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
        ui.playSound('tap');
        scene3d?.resetCamera();
    });

    // Configurar botones direccionales (Movimiento + Brazo y motores)
    document.querySelectorAll('.dir-btn').forEach((btn) => {
        const cmdNorm = btn.dataset.cmd;

        btn.addEventListener('pointerdown', (e) => {
            if (btn.disabled) return;
            e.preventDefault();
            presionarBotonDireccion(cmdNorm);
        });

        const soltar = (e) => {
            if (btn.disabled) return;
            e.preventDefault();
            soltarBotonDireccion();
        };

        btn.addEventListener('pointerup', soltar);
        btn.addEventListener('pointerleave', soltar);
        btn.addEventListener('pointercancel', soltar);
    });

    // Soporte de teclado en escritorio (WASD / Flechas / Espacio = Detener)
    const mapaTeclas = {
        'KeyW': 'AVANZAR',
        'ArrowUp': 'AVANZAR',
        'KeyS': 'RETROCEDER',
        'ArrowDown': 'RETROCEDER',
        'KeyA': 'GIRAR_IZQUIERDA',
        'ArrowLeft': 'GIRAR_IZQUIERDA',
        'KeyD': 'GIRAR_DERECHA',
        'ArrowRight': 'GIRAR_DERECHA',
        'KeyR': 'SUBIR_BRAZO',
        'KeyF': 'BAJAR_BRAZO',
        'KeyQ': 'MOTOR_IZQUIERDA',
        'KeyE': 'MOTOR_DERECHA'
    };

    document.addEventListener('keydown', (e) => {
        if (e.repeat || vistaActual !== 'control') return;
        if (e.target.closest?.('select, input, textarea')) return;
        if (e.code === 'Space') {
            e.preventDefault();
            pararTodo();
            return;
        }
        const cmd = mapaTeclas[e.code];
        if (cmd) presionarBotonDireccion(cmd);
    });

    document.addEventListener('keyup', (e) => {
        if (vistaActual !== 'control') return;
        if (mapaTeclas[e.code]) {
            soltarBotonDireccion();
        }
    });

    // Botón Detener
    document.getElementById('btn-stop').addEventListener('click', () => pararTodo());

    document.getElementById('demo-select').addEventListener('change', () => {
        ui.playSound('tap');
    });

    document.getElementById('btn-demo-start').addEventListener('click', () => {
        iniciarDemo(document.getElementById('demo-select').value);
    });

    document.getElementById('btn-demo-cancel').addEventListener('click', () => cancelarDemo());

    // Pestañas SPA (Control / Monitoreo)
    document.getElementById('btn-tab-control').addEventListener('click', () => {
        vistaActual = 'control';
        ui.switchView('control');
    });

    document.getElementById('btn-tab-monitoreo').addEventListener('click', () => {
        vistaActual = 'monitoreo';
        ui.switchView('monitoreo');
        cargarDatosMonitoreo();
    });
}

// Paro inmediato (botón Detener, barra espaciadora, botón rojo 3D y grip en VR)
function pararTodo() {
    cancelarDemoSimulada(false);
    ui.limpiarResaltadoDemo();
    ui.playSound('stop');
    ui.vibrar(25);
    detenerVehiculo();
}

function presionarBotonDireccion(cmdNorm) {
    if (!cmdNorm || comandoActivoActual === cmdNorm) return;
    comandoActivoActual = cmdNorm;

    ui.playSound('joy');
    ui.vibrar(12);
    ui.setActiveDirectionalButton(cmdNorm);
    ejecutarPorNombreNormalizado(cmdNorm);
}

function soltarBotonDireccion() {
    if (!comandoActivoActual) return;
    comandoActivoActual = null;
    ui.setActiveDirectionalButton(null);
    detenerVehiculo();
}

// Accesorio (Velocidad, Sonido, Luz) desde la consola 3D o el modo VR
function accionAccesorio(normCmd) {
    ui.sonidoAccesorio(normCmd);
    ui.vibrar(12);
    ejecutarPorNombreNormalizado(normCmd);
}

function ejecutarPorNombreNormalizado(normCmd) {
    const comando = catalogoComandos.find(
        (c) => normalizar(c.nombre || c.comando || '') === normCmd
    );
    if (comando) {
        ejecutarComando(comando.id_comando, comando.nombre);
    } else {
        // Fallback por mapa de IDs conocido si el catálogo aún no responde
        const entry = Object.entries(MAPA_COMANDOS_ID).find(([, v]) => normalizar(v) === normCmd);
        if (entry) {
            ejecutarComando(Number(entry[0]), entry[1]);
        } else if (modoSimulacion) {
            ejecutarComando(null, normCmd);
        }
    }
}

// --- MODO SIMULACIÓN ---------------------------------------------------------

function activarSimulacion() {
    modoSimulacion = true;
    ui.setOffline(true);
    ui.renderComandosPlaceholder((id, nombre) => ejecutarPorNombreNormalizado(normalizar(nombre)));
    ui.renderDemos(DEMOS_SIM);
    ui.renderHistorial(historialSim);
}

function registrarSim(nombre) {
    const registro = { comando: nombre, fecha_hora: new Date().toISOString() };
    historialSim.unshift(registro);
    historialSim.length = Math.min(historialSim.length, 10);
    ui.renderUltimoEstado(registro);
    ui.renderHistorial(historialSim);
}

function simularComando(nombreComando) {
    const norm = normalizar(nombreComando);
    // Los movimientos ya se aplicaron al presionar; los accesorios se aplican aquí (una sola vez)
    if (!MOVIMIENTOS.has(norm)) ui.scene3d?.applyCommand(norm);
    registrarSim(etiquetaCmd(norm));
    ui.showFeedback(`Simulación: ${etiquetaCmd(norm)}`, 'info', 1500);
}

function iniciarDemoSimulada(idDemo) {
    cancelarDemoSimulada(false);
    const demo = DEMOS_SIM.find((d) => d.id_demo === idDemo);
    if (!demo) return;

    ui.showFeedback(`Simulación: ${demo.nombre}`, 'success', 2500);
    registrarSim(`Inicio DEMO: ${demo.nombre}`);

    let t = 0;
    demo.pasos.forEach(([cmd, ms]) => {
        demoSimTimers.push(setTimeout(() => {
            if (MOVIMIENTOS.has(cmd)) ui.playSound('joy');
            else ui.sonidoAccesorio(cmd);
            ui.resaltarMovimientoDemo(cmd);
            registrarSim(`${etiquetaCmd(cmd)} (DEMO)`);
        }, t));
        t += ms;
    });

    demoSimTimers.push(setTimeout(() => {
        demoSimTimers = [];
        ui.limpiarResaltadoDemo();
        ui.playSound('stop');
        registrarSim('Detener (DEMO)');
        ui.showFeedback('DEMO finalizada', 'info', 2000);
    }, t));
}

function cancelarDemoSimulada(avisar = true) {
    const habiaDemo = demoSimTimers.length > 0;
    demoSimTimers.forEach(clearTimeout);
    demoSimTimers = [];
    if (habiaDemo) {
        ui.limpiarResaltadoDemo();
        registrarSim('DEMO CANCELADA');
        if (avisar) ui.showFeedback('DEMO cancelada', 'warning', 2000);
    }
}

// --- DEMOS (reales o simuladas) ---------------------------------------------

async function iniciarDemo(idDemo) {
    if (!idDemo) {
        ui.playSound('cancel');
        ui.showFeedback('Selecciona una DEMO', 'warning', 1800);
        return;
    }
    ui.limpiarResaltadoDemo();
    ui.playSound('start');
    ui.vibrar(15);

    if (modoSimulacion) {
        iniciarDemoSimulada(idDemo);
        return;
    }
    try {
        ui.showFeedback('Iniciando DEMO...', 'success');
        await api.ejecutarDemo(idDemo);
    } catch {
        ui.limpiarResaltadoDemo();
        ui.showFeedback('No se pudo iniciar la DEMO', 'danger');
    }
}

async function cancelarDemo() {
    ui.limpiarResaltadoDemo();
    ui.playSound('cancel');
    ui.vibrar(15);

    if (modoSimulacion) {
        if (demoSimTimers.length) cancelarDemoSimulada(true);
        else ui.showFeedback('No hay una DEMO en curso', 'info', 1800);
        return;
    }
    try {
        ui.showFeedback('Cancelando DEMO...', 'warning');
        await api.cancelarDemo();
    } catch {
        ui.showFeedback('No se pudo cancelar la DEMO', 'danger');
    }
}

// Carga los catálogos de comandos y demos (reintenta cada 8 s si AWS no responde)
async function cargarCatalogos() {
    clearTimeout(reintentoTimer);
    ui.updateAwsStatus('Comprobando...');
    try {
        catalogoComandos = await api.obtenerComandos();
        const demos = await api.obtenerDemos();

        const cmdDetener = catalogoComandos.find((c) => normalizar(c.nombre) === 'DETENER');
        if (cmdDetener) idComandoDetener = cmdDetener.id_comando;

        // AWS respondió: se sale del modo simulación
        cancelarDemoSimulada(false);
        modoSimulacion = false;
        ui.renderComandos(catalogoComandos, ejecutarComando);
        ui.renderDemos(demos);
        ui.setOffline(false);

        if (!primerFallo) ui.showFeedback('Conectado con AWS · control real activo', 'success', 2500);
        primerFallo = true;

        // Si RDS no se pudo verificar al inicio (AWS aún no respondía), volver a consultarlo
        if (!document.getElementById('status-rds')?.classList.contains('bg-success')) {
            verificarRDS();
        }
    } catch (error) {
        console.error('Error cargando catálogos:', error);
        catalogoComandos = [];
        if (primerFallo) {
            ui.showFeedback('Sin conexión con AWS · Modo simulación activo', 'warning', 4000);
            primerFallo = false;
        }
        reintentoTimer = setTimeout(cargarCatalogos, 8000);
    }
}

// --- LÓGICA DE MONITOREO (REST + WSS) ---

async function cargarDatosMonitoreo() {
    if (modoSimulacion) {
        if (historialSim.length) ui.renderUltimoEstado(historialSim[0]);
        ui.renderHistorial(historialSim);
        return;
    }
    try {
        const [ultimoEstado, historial] = await Promise.all([
            api.obtenerUltimoEstado(),
            api.obtenerHistorial()
        ]);

        ui.renderUltimoEstado(ultimoEstado);
        ui.renderHistorial(historial);
    } catch (error) {
        console.error('Error al cargar datos de monitoreo:', error);
    }
}

async function procesarMensajeWSS(payload) {
    if (!payload) return;

    if (payload.tipo_evento === 'inicio_demo') {
        ui.showFeedback('Iniciando DEMO...', 'success', 2500);
        return;
    }

    if (payload.tipo_evento === 'movimiento_demo') {
        const cmdObj = catalogoComandos.find((c) => c.id_comando === payload.comando_en_ejecucion);
        const nombreBase = cmdObj
            ? cmdObj.nombre
            : (MAPA_COMANDOS_ID[payload.comando_en_ejecucion] || `Comando ID: ${payload.comando_en_ejecucion}`);

        const norm = normalizar(nombreBase);
        if (norm === 'DETENER' || norm === 'STOP') {
            ui.playSound('stop');
            ui.limpiarResaltadoDemo();
            ui.showFeedback(`Enviando: ${nombreBase}`, 'info', 2500);
        } else {
            ui.playSound('joy');
            ui.resaltarMovimientoDemo(nombreBase);
            ui.showFeedback(`Enviando: ${nombreBase}`, 'info', 4000);
        }

        ui.renderUltimoEstado({
            comando: `${nombreBase} (DEMO)`,
            fecha_actualizacion: new Date().toISOString()
        });
        return;
    }

    if (payload.tipo_evento === 'cancelacion_demo') {
        ui.limpiarResaltadoDemo();
        ui.showFeedback('DEMO cancelada', 'warning', 2500);
        ui.renderUltimoEstado({
            comando: 'DEMO CANCELADA',
            fecha_actualizacion: new Date().toISOString()
        });
        return;
    }

    if (payload.tipo_evento === 'estado_inicial' || payload.tipo_evento === 'movimiento_individual') {
        if (payload.datos) {
            if (payload.tipo_evento === 'movimiento_individual') {
                const d = payload.datos;
                ui.scene3d?.applyCommand(normalizar(d.comando || d.nombre_comando || d.nombre || d.movimiento || ''));
            }
            ui.renderUltimoEstado({
                ...payload.datos,
                fecha_actualizacion: payload.datos.fecha_actualizacion || payload.datos.fecha_hora || new Date().toISOString()
            });
        }

        if (vistaActual === 'monitoreo' && payload.tipo_evento === 'movimiento_individual') {
            setTimeout(async () => {
                try {
                    const historial = await api.obtenerHistorial();
                    ui.renderHistorial(historial);
                } catch (e) {
                    console.error('Error actualizando tabla tras WSS:', e);
                }
            }, 600);
        }
    }
}

// --- LÓGICA DE CONTROL Y SALUD ---

async function verificarRDS() {
    const rdsBadge = document.getElementById('status-rds');
    rdsBadge.innerHTML = `<i class="bi bi-arrow-repeat"></i> RDS: Consultando...`;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            if (data.rds === 'Disponible') {
                rdsBadge.className = 'badge bg-success status-badge';
                rdsBadge.innerHTML = `<i class="bi bi-database-check"></i> RDS: Disponible`;
                ui.vrManager?.syncState({ rds: 'Disponible' });
            } else {
                rdsBadge.className = 'badge bg-danger status-badge';
                rdsBadge.innerHTML = `<i class="bi bi-database-x"></i> RDS: No disponible`;
                ui.vrManager?.syncState({ rds: 'No disponible' });
            }
        } else {
            throw new Error('Respuesta no OK de /api/health');
        }
    } catch (error) {
        console.error('Error al consultar RDS:', error);
        rdsBadge.className = 'badge bg-secondary status-badge';
        rdsBadge.innerHTML = `<i class="bi bi-database-dash"></i> RDS: Sin verificar`;
        ui.vrManager?.syncState({ rds: 'Sin verificar' });
    }
}

async function ejecutarComando(idComando, nombreComando) {
    if (modoSimulacion) {
        simularComando(nombreComando);
        return;
    }
    try {
        ui.showFeedback(`Enviando: ${nombreComando}`);
        await api.ejecutarMovimiento(idComando);
    } catch {
        // El error ya lo maneja api.js
    }
}

async function detenerVehiculo() {
    comandoActivoActual = null;
    ui.setActiveDirectionalButton(null);
    ui.scene3d?.applyCommand('DETENER');

    if (modoSimulacion) {
        registrarSim('Detener');
        return;
    }

    const stopId = idComandoDetener || 12;
    ui.showFeedback('Enviando: Detener');
    try {
        await api.ejecutarMovimiento(stopId, false); // no cancelable: ningún movimiento posterior puede abortarlo
    } catch {
        // El error ya lo maneja api.js
    }
}

document.addEventListener('DOMContentLoaded', inicializar);
