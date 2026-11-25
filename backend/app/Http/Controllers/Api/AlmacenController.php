<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AlmacenController extends Controller
{
    // ==========================================
    // CORPORACIÓN ORTEGA
    // CONTROL DE ALMACÉN
    //
    // TABLAS EXISTENTES:
    // almacen
    // material
    // existencia
    // movimiento_almacen
    // ==========================================

    // ==========================================
    // CONSULTAR EXISTENCIAS
    // GET /api/almacen/existencias
    // ==========================================

    public function existencias(): JsonResponse
    {
        $almacenes = DB::table('almacen')
            ->where('estado', true)
            ->orderBy('nombre')
            ->get();

        $existencias = DB::table('existencia as e')
            ->join(
                'material as m',
                'm.idMaterial',
                '=',
                'e.idMaterial'
            )
            ->join(
                'almacen as a',
                'a.idAlmacen',
                '=',
                'e.idAlmacen'
            )
            ->select(
                'e.idExistencia',
                'e.idAlmacen',
                'a.nombre as almacen',
                'e.idMaterial',
                'm.codigo',
                'm.nombre as material',
                'm.descripcion',
                'm.unidadMedida',
                'm.estado as materialActivo',
                'e.stockActual',
                'e.stockReservado',
                'e.stockMinimo'
            )
            ->selectRaw(
                '(e."stockActual" - e."stockReservado") as "stockDisponible"'
            )
            ->orderBy('a.nombre')
            ->orderBy('m.nombre')
            ->get();

        return response()->json([
            'ok' => true,
            'almacenes' => $almacenes,
            'existencias' => $existencias,
        ]);
    }

    // ==========================================
    // CONSULTAR HISTORIAL
    // GET /api/almacen/movimientos
    // ==========================================

    public function movimientos(): JsonResponse
    {
        $movimientos = DB::table('movimiento_almacen as ma')
            ->join(
                'existencia as e',
                'e.idExistencia',
                '=',
                'ma.idExistencia'
            )
            ->join(
                'material as m',
                'm.idMaterial',
                '=',
                'e.idMaterial'
            )
            ->join(
                'almacen as a',
                'a.idAlmacen',
                '=',
                'e.idAlmacen'
            )
            ->select(
                'ma.idMovimientoAlmacen',
                'ma.idExistencia',
                'ma.idUsuario',
                'ma.tipoMovimiento',
                'ma.cantidad',
                'ma.fechaMovimiento',
                'ma.motivo',
                'ma.referencia',
                'e.idMaterial',
                'm.codigo',
                'm.nombre as material',
                'm.unidadMedida',
                'e.idAlmacen',
                'a.nombre as almacen'
            )
            ->orderByDesc('ma.idMovimientoAlmacen')
            ->limit(200)
            ->get();

        return response()->json([
            'ok' => true,
            'movimientos' => $movimientos,
        ]);
    }

    // ==========================================
    // REGISTRAR ENTRADA O SALIDA
    //
    // POST /api/almacen/movimientos
    //
    // SOLO ENTRADA Y SALIDA POR AHORA.
    // LOS AJUSTES SE IMPLEMENTARÁN
    // CON SUS PROPIAS VALIDACIONES.
    // ==========================================

    public function registrarMovimiento(
        Request $request
    ): JsonResponse {
        $datos = $request->validate([
            'idAlmacen' => [
                'required',
                'integer',
                Rule::exists(
                    'almacen',
                    'idAlmacen'
                )->where('estado', true),
            ],

            'idMaterial' => [
                'required',
                'integer',
                Rule::exists(
                    'material',
                    'idMaterial'
                )->where('estado', true),
            ],

            'tipoMovimiento' => [
                'required',
                Rule::in([
                    'ENTRADA',
                    'SALIDA',
                ]),
            ],

            'cantidad' => [
                'required',
                'numeric',
                'gt:0',
                'decimal:0,3',
            ],

            'motivo' => [
                'required',
                'string',
                'max:100',
            ],

            'referencia' => [
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        // Usar siempre el usuario autenticado.
        // Nunca recibir idUsuario desde React.

        $usuario = Auth::guard('web')->user();

        if (!$usuario || !$usuario->idUsuario) {
            return response()->json([
                'ok' => false,
                'mensaje' =>
                    'Debes iniciar sesión para realizar movimientos.',
            ], 401);
        }

        $idUsuario = (int) $usuario->idUsuario;

        $idAlmacen = (int) $datos['idAlmacen'];
        $idMaterial = (int) $datos['idMaterial'];

        $tipo = $datos['tipoMovimiento'];

        $cantidad = (string) $datos['cantidad'];

        // Validar la unidad del material.

        $material = DB::table('material')
            ->where('idMaterial', $idMaterial)
            ->where('estado', true)
            ->first();

        if (!$material) {
            return response()->json([
                'ok' => false,
                'mensaje' =>
                    'El material no existe o está inactivo.',
            ], 404);
        }

        // Las unidades deben ser cantidades enteras.
        // Metros y otras unidades métricas
        // pueden utilizar decimales.

        if (
            $material->unidadMedida === 'und' &&
            !preg_match('/^[0-9]+$/', $cantidad)
        ) {
            return response()->json([
                'ok' => false,
                'mensaje' =>
                    'Los materiales por unidades deben tener cantidades enteras.',
            ], 422);
        }

        return DB::transaction(
            function () use (
                $idAlmacen,
                $idMaterial,
                $idUsuario,
                $tipo,
                $cantidad,
                $datos
            ) {
                // ==================================
                // CREAR EXISTENCIA EN CERO
                // SI ES LA PRIMERA ENTRADA
                // ==================================

                if ($tipo === 'ENTRADA') {
                    DB::table('existencia')
                        ->insertOrIgnore([
                            'idAlmacen' => $idAlmacen,
                            'idMaterial' => $idMaterial,
                            'stockActual' => 0,
                            'stockReservado' => 0,
                            'stockMinimo' => 0,
                        ]);
                }

                // ==================================
                // BLOQUEAR EL REGISTRO
                // ==================================

                $existencia = DB::table('existencia')
                    ->where(
                        'idAlmacen',
                        $idAlmacen
                    )
                    ->where(
                        'idMaterial',
                        $idMaterial
                    )
                    ->lockForUpdate()
                    ->first();

                if (!$existencia) {
                    return response()->json([
                        'ok' => false,
                        'mensaje' =>
                            'No hay existencias registradas para ese material. Registra primero una entrada.',
                    ], 409);
                }

                // ==================================
                // MODIFICAR STOCK
                // ==================================

                if ($tipo === 'SALIDA') {
                    // La condición también se comprueba
                    // dentro del UPDATE para proteger
                    // las existencias reservadas.

                    $actualizados = DB::update(
                        'UPDATE existencia
                         SET "stockActual" = "stockActual" - ?
                         WHERE "idExistencia" = ?
                           AND ("stockActual" - "stockReservado") >= ?',
                        [
                            $cantidad,
                            $existencia->idExistencia,
                            $cantidad,
                        ]
                    );

                    if ($actualizados !== 1) {
                        return response()->json([
                            'ok' => false,
                            'mensaje' =>
                                'Stock insuficiente. No se pueden retirar materiales reservados.',
                        ], 409);
                    }
                } else {
                    DB::update(
                        'UPDATE existencia
                         SET "stockActual" = "stockActual" + ?
                         WHERE "idExistencia" = ?',
                        [
                            $cantidad,
                            $existencia->idExistencia,
                        ]
                    );
                }

                // ==================================
                // GUARDAR HISTORIAL
                // ==================================

                $idMovimiento = DB::table(
                    'movimiento_almacen'
                )->insertGetId([
                    'idExistencia' =>
                        $existencia->idExistencia,

                    'idUsuario' =>
                        $idUsuario,

                    'tipoMovimiento' =>
                        $tipo,

                    'cantidad' =>
                        $cantidad,

                    'motivo' =>
                        trim($datos['motivo']),

                    'referencia' =>
                        isset($datos['referencia'])
                            ? trim($datos['referencia'])
                            : null,
                ], 'idMovimientoAlmacen');

                // ==================================
                // CONSULTAR NUEVO SALDO
                // ==================================

                $saldo = DB::table('existencia')
                    ->where(
                        'idExistencia',
                        $existencia->idExistencia
                    )
                    ->first();

                return response()->json([
                    'ok' => true,

                    'mensaje' =>
                        $tipo === 'ENTRADA'
                            ? 'Entrada registrada correctamente.'
                            : 'Salida registrada correctamente.',

                    'idMovimientoAlmacen' =>
                        $idMovimiento,

                    'idExistencia' =>
                        $existencia->idExistencia,

                    'stockActual' =>
                        $saldo->stockActual,

                    'stockReservado' =>
                        $saldo->stockReservado,

                    'stockDisponible' =>
                        (float) $saldo->stockActual -
                        (float) $saldo->stockReservado,
                ], 201);
            }
        );
    }

    // ==========================================
    // ACTUALIZAR STOCK MÍNIMO
    //
    // PUT /api/almacen/existencias/{id}/minimo
    // ==========================================

    public function actualizarMinimo(
        Request $request,
        int $id
    ): JsonResponse {
        $datos = $request->validate([
            'stockMinimo' => [
                'required',
                'numeric',
                'min:0',
                'decimal:0,3',
            ],
        ]);

        $actualizados = DB::table('existencia')
            ->where(
                'idExistencia',
                $id
            )
            ->update([
                'stockMinimo' =>
                    $datos['stockMinimo'],
            ]);

        // UPDATE puede devolver 0 si el
        // valor ya era el mismo.
        $existe = DB::table('existencia')
            ->where(
                'idExistencia',
                $id
            )
            ->exists();

        if (!$existe) {
            return response()->json([
                'ok' => false,
                'mensaje' =>
                    'Registro de existencia no encontrado.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Stock mínimo actualizado correctamente.',
        ]);
    }
}
