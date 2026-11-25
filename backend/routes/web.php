
<?php

use App\Http\Controllers\Api\AlmacenController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ModeloEstadoController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\ModeloConfiguracionController;
use App\Http\Controllers\Api\CalculoMedidasController;
use App\Http\Controllers\Api\CotizacionController;

// ==========================================
// SISTEMA WEB CORPORACIÓN ORTEGA
// RUTAS WEB Y API
// ==========================================

// ==========================================
// PÁGINA DE INICIO DE SESIÓN
// ==========================================

Route::get('/acceso', function () {

    $html = <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1">

    <title>Acceso - Corporación Ortega</title>

    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f1f5f9;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
        }

        .panel {
            background: #ffffff;
            padding: 32px;
            border-radius: 12px;
            width: 340px;
            max-width: 85vw;
            box-shadow: 0 5px 20px #0002;
        }

        h2 {
            text-align: center;
            color: #1e293b;
        }

        label {
            display: block;
            margin-top: 16px;
        }

        input {
            box-sizing: border-box;
            width: 100%;
            padding: 11px;
            margin-top: 6px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
        }

        button {
            width: 100%;
            margin-top: 22px;
            padding: 12px;
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }

        button:disabled {
            opacity: 0.6;
        }

        #mensaje {
            margin-top: 16px;
            font-size: 14px;
        }

        a {
            color: #2563eb;
        }
    </style>
</head>

<body>
    <div class="panel">

        <h2>Corporación Ortega</h2>

        <p>Inicio de sesión del sistema</p>

        <form id="loginForm">

            <label for="correo">
                Correo electrónico
            </label>

            <input
                id="correo"
                type="email"
                autocomplete="username"
                required
            >

            <label for="password">
                Contraseña
            </label>

            <input
                id="password"
                type="password"
                autocomplete="current-password"
                required
            >

            <button id="boton" type="submit">
                Iniciar sesión
            </button>

        </form>

        <div id="mensaje" role="status"></div>

        <p>
            <a href="http://127.0.0.1:5173/">
                Abrir sistema React (5173)
            </a>
        </p>

        <p>
            <a href="http://127.0.0.1:5174/">
                Abrir sistema React (5174)
            </a>
        </p>

    </div>

    <script>
        const formulario = document.getElementById(
            "loginForm"
        );

        const mensaje = document.getElementById(
            "mensaje"
        );

        const boton = document.getElementById(
            "boton"
        );

        formulario.addEventListener(
            "submit",
            async function (evento) {

                evento.preventDefault();

                boton.disabled = true;
                mensaje.textContent = "";

                try {

                    const csrfRespuesta = await fetch(
                        "/api/auth/csrf",
                        {
                            credentials: "same-origin",
                            headers: {
                                Accept: "application/json"
                            }
                        }
                    );

                    if (!csrfRespuesta.ok) {
                        throw new Error(
                            "No se pudo obtener el token CSRF."
                        );
                    }

                    const csrf = await csrfRespuesta.json();

                    const respuesta = await fetch(
                        "/api/auth/login",
                        {
                            method: "POST",
                            credentials: "same-origin",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                                "X-CSRF-TOKEN": csrf.csrf_token
                            },
                            body: JSON.stringify({
                                correo:
                                    document.getElementById(
                                        "correo"
                                    ).value,

                                password:
                                    document.getElementById(
                                        "password"
                                    ).value
                            })
                        }
                    );

                    const datos = await respuesta.json();

                    if (!respuesta.ok) {
                        throw new Error(
                            datos.mensaje ||
                            datos.message ||
                            "No se pudo iniciar sesión."
                        );
                    }

                    mensaje.style.color = "green";

                    mensaje.textContent =
                        "Sesión iniciada correctamente. " +
                        "Abre React utilizando uno " +
                        "de los enlaces inferiores.";

                    document.getElementById(
                        "password"
                    ).value = "";

                } catch (error) {

                    mensaje.style.color = "red";
                    mensaje.textContent = error.message;

                } finally {

                    boton.disabled = false;

                }
            }
        );
    </script>

</body>
</html>
HTML;

    return response($html)
        ->header(
            'Content-Type',
            'text/html; charset=UTF-8'
        );
});

// ==========================================
// AUTENTICACIÓN
// ==========================================

// Obtener token CSRF.

Route::get('/api/auth/csrf', function () {

    return response()->json([
        'ok' => true,
        'csrf_token' => csrf_token(),
    ]);

});

// Iniciar sesión.

Route::post(
    '/api/auth/login',
    [AuthController::class, 'login']
);

// Consultar sesión y cerrar sesión.

Route::middleware('auth:web')->group(function () {

    Route::get(
        '/api/auth/me',
        [AuthController::class, 'me']
    );

    Route::post(
        '/api/auth/logout',
        [AuthController::class, 'logout']
    );

});

// ==========================================
// CLIENTES
// ==========================================

Route::prefix('api/clientes')
    ->middleware('auth:web')
    ->group(function () {

        // Listar clientes.

        Route::get(
            '/',
            [ClienteController::class, 'index']
        );

        // Registrar cliente.

        Route::post(
            '/',
            [ClienteController::class, 'store']
        );

        // Consultar cliente.

        Route::get(
            '/{id}',
            [ClienteController::class, 'show']
        )->whereNumber('id');

        // Actualizar cliente.

        Route::put(
            '/{id}',
            [ClienteController::class, 'update']
        )->whereNumber('id');

        // Desactivar cliente.

        Route::delete(
            '/{id}',
            [ClienteController::class, 'destroy']
        )->whereNumber('id');

    });

// ==========================================
// MATERIALES
// ==========================================

Route::prefix('api/materiales')
    ->middleware('auth:web')
    ->group(function () {

        // Listar materiales.

        Route::get(
            '/',
            [MaterialController::class, 'index']
        );

        // Registrar material.

        Route::post(
            '/',
            [MaterialController::class, 'store']
        );

        // Consultar material.

        Route::get(
            '/{id}',
            [MaterialController::class, 'show']
        )->whereNumber('id');

        // Actualizar material.

        Route::put(
            '/{id}',
            [MaterialController::class, 'update']
        )->whereNumber('id');

        // Desactivar material.

        Route::delete(
            '/{id}',
            [MaterialController::class, 'destroy']
        )->whereNumber('id');

    });

// ==========================================
// MODELOS DE ESTRUCTURAS METÁLICAS
// ==========================================

Route::prefix('api/modelos')
    ->middleware('auth:web')
    ->group(function () {

        // ==================================
        // DESACTIVAR ESTRUCTURA METÁLICA
        // ==================================
        //
        // Elimina de manera lógica:
        // cambia estado a false.
        //
        // DELETE /api/modelos/3

        Route::delete(
            '/{idModeloProducto}',
            [
                ModeloEstadoController::class,
                'destroy',
            ]
        )->whereNumber('idModeloProducto');

        // ==================================
        // REACTIVAR ESTRUCTURA METÁLICA
        // ==================================
        //
        // PATCH /api/modelos/7/reactivar

        Route::patch(
            '/{idModeloProducto}/reactivar',
            [
                ModeloEstadoController::class,
                'reactivar',
            ]
        )->whereNumber('idModeloProducto');

        // ==================================
        // LISTAR MODELOS
        // ==================================

        Route::get('/', function () {

            $modelos = DB::table('modelo_producto')
                ->orderByDesc('idModeloProducto')
                ->get();

            return response()->json([
                'ok' => true,
                'modelos' => $modelos,
            ]);

        });

        // ==================================
        // VER DETALLE DE UNA ESTRUCTURA
        // ==================================
        //
        // Ejemplo:
        // GET /api/modelos/3/detalle

        Route::get(
            '/{idModeloProducto}/detalle',
            [
                ModeloConfiguracionController::class,
                'show',
            ]
        )->whereNumber('idModeloProducto');

        // ==================================
        // EDITAR ESTRUCTURA EXISTENTE
        // ==================================
        //
        // Ejemplo:
        // PUT /api/modelos/3
        //
        // Actualiza el mismo modelo.
        // La validación y protección de
        // cotizaciones se realiza en Laravel.

        Route::put(
            '/{idModeloProducto}',
            [
                ModeloConfiguracionController::class,
                'update',
            ]
        )->whereNumber('idModeloProducto');

        // ==================================
        // REGISTRAR MODELO
        // ==================================

        Route::post(
            '/',
            [
                ModeloConfiguracionController::class,
                'store',
            ]
        );

        // ==================================
        // CONFIGURAR MODELO CON MATERIALES,
        // PIEZAS Y REGLAS DE CÁLCULO
        // ==================================

        Route::post(
            '/configurar',
            [
                ModeloConfiguracionController::class,
                'store',
            ]
        );

        // ==================================
        // CALCULAR MEDIDAS AUTOMÁTICAS
        // ==================================

        Route::match(
            ['GET', 'POST'],
            '/{idModeloProducto}/calcular',
            [
                CalculoMedidasController::class,
                'calcular',
            ]
        )->whereNumber('idModeloProducto');

    });

// ==========================================
// ALMACÉN: EXISTENCIAS Y MOVIMIENTOS
// ==========================================

Route::prefix('api/almacen')
    ->middleware('auth:web')
    ->group(function () {

        // Consultar existencias y almacenes activos.

        Route::get(
            '/existencias',
            [
                AlmacenController::class,
                'existencias',
            ]
        );

        // Consultar movimientos de almacén.

        Route::get(
            '/movimientos',
            [
                AlmacenController::class,
                'movimientos',
            ]
        );

        // Registrar entradas y salidas.

        Route::post(
            '/movimientos',
            [
                AlmacenController::class,
                'registrarMovimiento',
            ]
        );

        // Configurar stock mínimo.

        Route::put(
            '/existencias/{id}/minimo',
            [
                AlmacenController::class,
                'actualizarMinimo',
            ]
        )->whereNumber('id');

    });

// ==========================================
// COTIZACIONES
// ==========================================

Route::prefix('api/cotizaciones')
    ->middleware('auth:web')
    ->group(function () {

        // Listar cotizaciones.

        Route::get(
            '/',
            [CotizacionController::class, 'index']
        );

        // Registrar cotización.

        Route::post(
            '/',
            [CotizacionController::class, 'store']
        );

        // Consultar cotización.

        Route::get(
            '/{id}',
            [CotizacionController::class, 'show']
        )->whereNumber('id');

    });

// ==========================================
// PROVEEDORES
// ==========================================

Route::prefix('api/proveedores')
    ->middleware('auth:web')
    ->group(function () {

        // Listar proveedores.

        Route::get(
            '/',
            [
                \App\Http\Controllers\Api\ProveedorController::class,
                'index',
            ]
        );

        // Registrar proveedor.

        Route::post(
            '/',
            [
                \App\Http\Controllers\Api\ProveedorController::class,
                'store',
            ]
        );

        // Consultar proveedor.

        Route::get(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorController::class,
                'show',
            ]
        )->whereNumber('id');

        // Actualizar proveedor.

        Route::put(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorController::class,
                'update',
            ]
        )->whereNumber('id');

        // Desactivar proveedor.

        Route::delete(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorController::class,
                'destroy',
            ]
        )->whereNumber('id');

    });

// ==========================================
// PRECIOS DE MATERIALES POR PROVEEDOR
// ==========================================

Route::prefix('api/proveedor-materiales')
    ->middleware('auth:web')
    ->group(function () {

        // Listar precios de materiales.

        Route::get(
            '/',
            [
                \App\Http\Controllers\Api\ProveedorMaterialController::class,
                'index',
            ]
        );

        // Registrar precio de material.

        Route::post(
            '/',
            [
                \App\Http\Controllers\Api\ProveedorMaterialController::class,
                'store',
            ]
        );

        // Consultar precio registrado.

        Route::get(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorMaterialController::class,
                'show',
            ]
        )->whereNumber('id');

        // Actualizar precio.

        Route::put(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorMaterialController::class,
                'update',
            ]
        )->whereNumber('id');

        // Eliminar relación o precio.

        Route::delete(
            '/{id}',
            [
                \App\Http\Controllers\Api\ProveedorMaterialController::class,
                'destroy',
            ]
        )->whereNumber('id');

    });

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// CORPORACIÓN ORTEGA
// ==========================================

// ==========================================
// SOLICITAR CÓDIGO DE RECUPERACIÓN
// ==========================================

Route::post(
    '/api/auth/recuperacion/solicitar',
    [
        AuthController::class,
        'solicitarRecuperacion',
    ]
)->middleware('throttle:3,1');

// ==========================================
// VERIFICAR CÓDIGO DE RECUPERACIÓN
// ==========================================

Route::post(
    '/api/auth/recuperacion/verificar',
    [
        AuthController::class,
        'verificarCodigo',
    ]
)->middleware('throttle:5,1');

// ==========================================
// RESTABLECER CONTRASEÑA
// ==========================================

Route::post(
    '/api/auth/recuperacion/restablecer',
    [
        AuthController::class,
        'restablecerContrasena',
    ]
)->middleware('throttle:5,1');

// ==========================================
// CAMBIAR CONTRASEÑA DESDE EL PERFIL
// CORPORACIÓN ORTEGA
// ==========================================

Route::post(
    '/api/auth/cambiar-contrasena',
    [
        \App\Http\Controllers\Api\CambiarContrasenaController::class,
        'actualizar',
    ]
)->middleware([
    'auth:web',
    'throttle:5,1',
]);
