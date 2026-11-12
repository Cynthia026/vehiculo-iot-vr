// assets/js/app.js
import { api } from './api.js?v=13';
import { wsManager } from './websocket.js?v=13';
import { ui, normalizar } from './ui.js?v=13';
import { CONFIG } from './config.js?v=12';

let catalogoComandos = [];
let idComandoDetener = null;
let vistaActual = 'control';
let comandoActivoActual = null; // Evita envíos duplicados mientras se mantiene presionado un botón

let reintentoTimer = null;
let primerFallo = true;

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

async function inicializar() {
    try {
        // 1. Inicializar escenario 3D Three.js + WebXR (opcional: si falla, el control sigue funcionando)
        let scene3d = null;
        let vrManager = null;
        try {
            const { Scene3DManager } = await import('./scene3d.js?v=14');
            const { VRManager } = await import('./vr-controls.js?v=13');
            scene3d = new Scene3DManager('three-canvas');
            vrManager = new VRManager(scene3d, {
            onPressCommand: (normCmd, isInstant = false) => {
                if (isInstant) {
                    // Accesorios: un solo envío, sin parada al soltar
                    ejecutarPorNombreNormalizado(normCmd);
                } else {
                    // Movimiento: igual que los botones web, para que al soltar el gatillo se envíe DETENER
                    presionarBotonDireccion(normCmd);
                }
            },
            onReleaseCommand: () => {
                soltarBotonDireccion();
            },
            onStop: () => {
                ui.limpiarResaltadoDemo();
                ui.playSound('stop');
                detenerVehiculo();
            },
            onStartDemo: async (idDemo) => {
                try {
                    ui.playSound('start');
                    await api.ejecutarDemo(idDemo);
                } catch {
                    ui.showFeedback('No se pudo iniciar la DEMO', 'danger');
                }
            },
            onCancelDemo: async () => {
                try {
                    ui.playSound('cancel');
                    await api.cancelarDemo();
                } catch {
                    ui.showFeedback('No se pudo cancelar la DEMO', 'danger');
                }
            },
            onFeedback: (msg, type, duration) => ui.showFeedback(msg, type, duration)
            });
        } catch (err3d) {
            console.error('Escenario 3D/VR no disponible:', err3d);
            document.getElementById('btn-vr')?.setAttribute('disabled', '');
            document.getElementById('btn-reset-cam')?.setAttribute('disabled', '');
        }

        ui.attach3DAndVR(scene3d, vrManager);

        // 2. Mostrar interfaz de inmediato (modo offline hasta que AWS responda) y configurar controles
        ui.renderComandosPlaceholder();
        ui.setOffline(true);
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
            ui.playSound('stop');
            detenerVehiculo();
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
    document.getElementById('btn-stop').addEventListener('click', () => {
        ui.limpiarResaltadoDemo();
        ui.playSound('stop');
        ui.vibrar(25);
        detenerVehiculo();
    });

    document.getElementById('demo-select').addEventListener('change', () => {
        ui.playSound('tap');
    });

    document.getElementById('btn-demo-start').addEventListener('click', async () => {
        const select = document.getElementById('demo-select');
        if (!select.value) {
            ui.playSound('cancel');
            return;
        }
        try {
            ui.limpiarResaltadoDemo();
            ui.playSound('start');
            ui.vibrar(15);
            ui.showFeedback('Iniciando DEMO...', 'success');
            await api.ejecutarDemo(select.value);
        } catch {
            ui.limpiarResaltadoDemo();
            ui.showFeedback('No se pudo iniciar la DEMO', 'danger');
        }
    });

    document.getElementById('btn-demo-cancel').addEventListener('click', async () => {
        ui.limpiarResaltadoDemo();
        try {
            ui.playSound('cancel');
            ui.vibrar(15);
            ui.showFeedback('Cancelando DEMO...', 'warning');
            await api.cancelarDemo();
        } catch {
            ui.showFeedback('No se pudo cancelar la DEMO', 'danger');
        }
    });

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
        }
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

        ui.renderComandos(catalogoComandos, ejecutarComando);
        ui.renderDemos(demos);
        ui.setOffline(false);

        primerFallo = true;
        document.getElementById('action-feedback').classList.add('d-none');

        // Si RDS no se pudo verificar al inicio (AWS aún no respondía), volver a consultarlo
        if (!document.getElementById('status-rds')?.classList.contains('bg-success')) {
            verificarRDS();
        }
    } catch (error) {
        console.error('Error cargando catálogos:', error);
        if (primerFallo) {
            ui.showFeedback('Sin conexión con AWS. Reintentando...', 'danger');
            primerFallo = false;
        }
        reintentoTimer = setTimeout(cargarCatalogos, 8000);
    }
}

// --- LÓGICA DE MONITOREO (REST + WSS) ---

async function cargarDatosMonitoreo() {
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
    const stopId = idComandoDetener || 12;
    ui.showFeedback('Enviando: Detener');
    try {
        await api.ejecutarMovimiento(stopId, false); // no cancelable: ningún movimiento posterior puede abortarlo
    } catch {
        // El error ya lo maneja api.js
    }
}

document.addEventListener('DOMContentLoaded', inicializar);