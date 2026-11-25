<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Closure;
use Illuminate\Cache\FileStore;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class AuthController extends Controller
{
    private const MAX_LOGIN = 3;
    private const MAX_CODIGOS = 5;
    private const MINUTOS_CODIGO = 10;

    // ==========================================
    // CLAVES DE SEGURIDAD
    // ==========================================

    private function correoNormalizado(string $correo): string
    {
        return mb_strtolower(trim($correo));
    }

    private function clave(string $tipo, string $correo): string
    {
        return 'ortega_' . $tipo . '_' . hash(
            'sha256',
            $this->correoNormalizado($correo)
        );
    }

    private function cache()
    {
        return Cache::store('file');
    }

    // ==========================================
    // CANDADO PARA SOLICITUDES SIMULTANEAS
    // ==========================================

    private function conCandado(
        string $correo,
        Closure $operacion
    ): array {
        $almacen = $this->cache()->getStore();

        if (!$almacen instanceof FileStore) {
            throw new RuntimeException(
                'Se requiere caché de archivos.'
            );
        }

        return $almacen
            ->lock($this->clave('candado', $correo), 15)
            ->block(5, $operacion);
    }

    private function buscarUsuario(string $correo): ?Usuario
    {
        return Usuario::query()
            ->whereRaw(
                'LOWER("correo") = ?',
                [$this->correoNormalizado($correo)]
            )
            ->first();
    }

    private function respuestaBloqueada(): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'bloqueado' => true,
            'intentosRestantes' => 0,
            'mensaje' =>
                'Cuenta bloqueada. Utiliza ' .
                '¿Olvidaste tu contraseña? ' .
                'para recuperar el acceso.',
        ], 423);
    }

    // ==========================================
    // INICIO DE SESION: 3 INTENTOS
    // ==========================================

    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'correo' => ['required', 'email', 'max:150'],
            'password' => ['required', 'string'],
        ]);

        $correo = $this->correoNormalizado($datos['correo']);
        $cache = $this->cache();

        try {
            $resultado = $this->conCandado(
                $correo,
                function () use ($correo, $datos, $cache): array {
                    if ($cache->get($this->clave('bloqueo', $correo))) {
                        return ['estado' => 423];
                    }

                    $usuario = $this->buscarUsuario($correo);

                    if (!$usuario || !$usuario->estado) {
                        return [
                            'estado' => 401,
                            'mensaje' => 'Correo o contraseña incorrectos.',
                        ];
                    }

                    $correcto = Auth::guard('web')->attempt([
                        'correo' => $usuario->correo,
                        'password' => $datos['password'],
                        'estado' => true,
                    ]);

                    if (!$correcto) {
                        $claveIntentos = $this->clave(
                            'intentos',
                            $correo
                        );

                        $intentos =
                            (int) $cache->get($claveIntentos, 0) + 1;

                        $cache->forever($claveIntentos, $intentos);

                        if ($intentos >= self::MAX_LOGIN) {
                            $cache->forever(
                                $this->clave('bloqueo', $correo),
                                true
                            );

                            return ['estado' => 423];
                        }

                        $restantes = self::MAX_LOGIN - $intentos;

                        return [
                            'estado' => 401,
                            'mensaje' =>
                                'Contraseña incorrecta. Intentos restantes: ' .
                                $restantes . '.',
                            'intentosRestantes' => $restantes,
                        ];
                    }

                    $cache->forget(
                        $this->clave('intentos', $correo)
                    );

                    return ['estado' => 200];
                }
            );
        } catch (LockTimeoutException $e) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Hay otra solicitud en proceso.',
            ], 429);
        }

        if ($resultado['estado'] === 423) {
            return $this->respuestaBloqueada();
        }

        if ($resultado['estado'] !== 200) {
            return response()->json([
                'ok' => false,
                'mensaje' => $resultado['mensaje'],
                'intentosRestantes' =>
                    $resultado['intentosRestantes'] ?? null,
            ], $resultado['estado']);
        }

        $request->session()->regenerate();

        $usuario = Auth::guard('web')->user();

        if (!$usuario instanceof Usuario) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'ok' => false,
                'mensaje' => 'No se pudo obtener el usuario.',
            ], 401);
        }

        $usuario->load('rol');

        return response()->json([
            'ok' => true,
            'mensaje' => 'Inicio de sesión correcto.',
            'usuario' => $this->datosUsuario($usuario),
        ]);
    }

    // ==========================================
    // CONSULTAR SESION
    // ==========================================

    public function me(Request $request): JsonResponse
    {
        $usuario = Auth::guard('web')->user();

        if (!$usuario instanceof Usuario) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'No autenticado.',
            ], 401);
        }

        if (!$usuario->estado) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'ok' => false,
                'mensaje' => 'Usuario inactivo.',
            ], 403);
        }

        if (
            $this->cache()->get(
                $this->clave('bloqueo', $usuario->correo)
            )
        ) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return $this->respuestaBloqueada();
        }

        $usuario->load('rol');

        return response()->json([
            'ok' => true,
            'usuario' => $this->datosUsuario($usuario),
        ]);
    }

    // ==========================================
    // CERRAR SESION
    // ==========================================

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'ok' => true,
            'mensaje' => 'Sesión cerrada correctamente.',
        ]);
    }

    // ==========================================
    // PASO 1: SOLICITAR CODIGO POR GMAIL
    // ==========================================

    public function solicitarRecuperacion(
        Request $request
    ): JsonResponse {
        $datos = $request->validate([
            'correo' => ['required', 'email', 'max:150'],
        ]);

        $correo = $this->correoNormalizado($datos['correo']);
        $cache = $this->cache();

        $mensajeGeneral =
            'Si el correo corresponde a una cuenta activa, ' .
            'recibirás un código de recuperación. Revisa spam.';

        $usuario = $this->buscarUsuario($correo);

        if (!$usuario || !$usuario->estado) {
            return response()->json([
                'ok' => true,
                'mensaje' => $mensajeGeneral,
            ]);
        }

        if ($cache->has($this->clave('envio', $correo))) {
            return response()->json([
                'ok' => true,
                'mensaje' => $mensajeGeneral,
            ]);
        }

        if (
            in_array(
                config('mail.default'),
                ['log', 'array'],
                true
            )
        ) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'El correo SMTP no está configurado.',
            ], 503);
        }

        $codigo = (string) random_int(100000, 999999);

        $venceEn = now()
            ->addMinutes(self::MINUTOS_CODIGO)
            ->timestamp;

        $cache->put(
            $this->clave('codigo', $correo),
            [
                'codigoHash' => Hash::make($codigo),
                'intentos' => 0,
                'verificado' => false,
                'venceEn' => $venceEn,
            ],
            now()->addMinutes(self::MINUTOS_CODIGO)
        );

        $cache->put(
            $this->clave('envio', $correo),
            true,
            now()->addSeconds(60)
        );

        try {
            Mail::raw(
                "CORPORACIÓN ORTEGA\n\n" .
                "Tu código de recuperación es:\n\n" .
                $codigo . "\n\n" .
                "El código vence en 10 minutos.\n" .
                "No lo compartas con nadie.\n" .
                "Si no solicitaste la recuperación, ignora este mensaje.",
                function ($mensaje) use ($usuario) {
                    $mensaje
                        ->to($usuario->correo)
                        ->subject(
                            'Código de recuperación - Corporación Ortega'
                        );
                }
            );
        } catch (Throwable $e) {
            $cache->forget($this->clave('codigo', $correo));
            $cache->forget($this->clave('envio', $correo));

            Log::error('Fallo al enviar código de recuperación', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'ok' => false,
                'mensaje' => 'No se pudo enviar el código por correo.',
            ], 503);
        }

        return response()->json([
            'ok' => true,
            'mensaje' => $mensajeGeneral,
        ]);
    }

    // ==========================================
    // COMPROBACION INTERNA DEL CODIGO
    // ==========================================

    private function comprobarCodigo(
        string $correo,
        string $codigo,
        bool $requiereVerificacionPrevia = false
    ): array {
        $cache = $this->cache();
        $claveCodigo = $this->clave('codigo', $correo);
        $registro = $cache->get($claveCodigo);

        if (
            !is_array($registro) ||
            !isset($registro['codigoHash'], $registro['venceEn'])
        ) {
            return [
                'ok' => false,
                'mensaje' => 'El código no existe o ha vencido.',
            ];
        }

        $venceEn = (int) $registro['venceEn'];

        if (now()->timestamp >= $venceEn) {
            $cache->forget($claveCodigo);

            return [
                'ok' => false,
                'mensaje' => 'El código ha vencido. Solicita otro.',
            ];
        }

        if (!Hash::check($codigo, $registro['codigoHash'])) {
            $intentos = (int) ($registro['intentos'] ?? 0) + 1;

            if ($intentos >= self::MAX_CODIGOS) {
                $cache->forget($claveCodigo);

                return [
                    'ok' => false,
                    'mensaje' =>
                        'Demasiados códigos incorrectos. Solicita otro.',
                ];
            }

            $registro['intentos'] = $intentos;

            $cache->put(
                $claveCodigo,
                $registro,
                now()->addSeconds(
                    max(1, $venceEn - now()->timestamp)
                )
            );

            return [
                'ok' => false,
                'mensaje' => 'Código incorrecto. Comprueba los números.',
            ];
        }

        if (
            $requiereVerificacionPrevia &&
            ($registro['verificado'] ?? false) !== true
        ) {
            return [
                'ok' => false,
                'mensaje' =>
                    'Primero debes verificar el código de recuperación.',
            ];
        }

        return [
            'ok' => true,
            'registro' => $registro,
            'venceEn' => $venceEn,
        ];
    }

    // ==========================================
    // PASO 2: VERIFICAR CODIGO
    // ESTA RUTA NO CAMBIA LA CONTRASEÑA
    // ==========================================

    public function verificarCodigo(
        Request $request
    ): JsonResponse {
        $datos = $request->validate([
            'correo' => ['required', 'email', 'max:150'],
            'codigo' => [
                'required',
                'string',
                'regex:/^[0-9]{6}$/',
            ],
        ]);

        $correo = $this->correoNormalizado($datos['correo']);

        try {
            $resultado = $this->conCandado(
                $correo,
                function () use ($correo, $datos): array {
                    $resultado = $this->comprobarCodigo(
                        $correo,
                        $datos['codigo']
                    );

                    if (!$resultado['ok']) {
                        return $resultado;
                    }

                    $registro = $resultado['registro'];
                    $registro['verificado'] = true;

                    $this->cache()->put(
                        $this->clave('codigo', $correo),
                        $registro,
                        now()->addSeconds(
                            max(
                                1,
                                $resultado['venceEn'] - now()->timestamp
                            )
                        )
                    );

                    return [
                        'ok' => true,
                        'mensaje' =>
                            'Código verificado correctamente. ' .
                            'Ya puedes establecer tu nueva contraseña.',
                    ];
                }
            );
        } catch (LockTimeoutException $e) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Hay otra solicitud en proceso.',
            ], 429);
        }

        return response()->json(
            $resultado,
            $resultado['ok'] ? 200 : 422
        );
    }

    // ==========================================
    // PASO 3: GUARDAR NUEVA CONTRASEÑA
    // EXIGE CODIGO VERIFICADO PREVIAMENTE
    // ==========================================

    public function restablecerContrasena(
        Request $request
    ): JsonResponse {
        $datos = $request->validate([
            'correo' => ['required', 'email', 'max:150'],
            'codigo' => [
                'required',
                'string',
                'regex:/^[0-9]{6}$/',
            ],
            'password' => [
                'required',
                'string',
                'min:12',
                'confirmed',
            ],
        ], [
            'codigo.regex' => 'El código debe tener 6 números.',
            'password.min' =>
                'La contraseña debe tener al menos 12 caracteres.',
            'password.confirmed' =>
                'Las contraseñas no coinciden.',
        ]);

        $correo = $this->correoNormalizado($datos['correo']);

        try {
            $resultado = $this->conCandado(
                $correo,
                function () use ($correo, $datos): array {
                    $verificacion = $this->comprobarCodigo(
                        $correo,
                        $datos['codigo'],
                        true
                    );

                    if (!$verificacion['ok']) {
                        return $verificacion;
                    }

                    $usuario = $this->buscarUsuario($correo);

                    if (!$usuario || !$usuario->estado) {
                        return [
                            'ok' => false,
                            'mensaje' =>
                                'No se pudo recuperar la cuenta.',
                        ];
                    }

                    DB::table('usuario')
                        ->where('idUsuario', $usuario->idUsuario)
                        ->update([
                            'contrasena' => Hash::make(
                                $datos['password']
                            ),
                        ]);

                    // Consumir el código y desbloquear.
                    $cache = $this->cache();

                    $cache->forget($this->clave('codigo', $correo));
                    $cache->forget($this->clave('intentos', $correo));
                    $cache->forget($this->clave('bloqueo', $correo));
                    $cache->forget($this->clave('envio', $correo));

                    return [
                        'ok' => true,
                        'mensaje' =>
                            'Contraseña cambiada correctamente. ' .
                            'Ya puedes iniciar sesión.',
                    ];
                }
            );
        } catch (LockTimeoutException $e) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Hay otra solicitud en proceso.',
            ], 429);
        }

        return response()->json(
            $resultado,
            $resultado['ok'] ? 200 : 422
        );
    }

    // ==========================================
    // DATOS DEL USUARIO
    // ==========================================

    private function datosUsuario(Usuario $usuario): array
    {
        return [
            'idUsuario' => $usuario->idUsuario,
            'nombres' => $usuario->nombres,
            'apellidos' => $usuario->apellidos,
            'correo' => $usuario->correo,
            'estado' => $usuario->estado,
            'rol' => $usuario->rol?->nombre,
        ];
    }
}
