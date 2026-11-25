<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ModeloEstadoController extends Controller
{
    // ==========================================
    // CORPORACIÓN ORTEGA
    // DESACTIVAR ESTRUCTURA METÁLICA
    // ==========================================

    public function destroy(
        int $idModeloProducto
    ): JsonResponse {

        return DB::transaction(function () use (
            $idModeloProducto
        ) {

            // Bloquear el modelo mientras se procesa.

            $modelo = DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->lockForUpdate()
                ->first();

            if (!$modelo) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'La estructura no existe.',
                ], 404);
            }

            if (!$modelo->estado) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'La estructura ya está desactivada.',
                ], 409);
            }

            // Proteger las cotizaciones históricas.

            $tieneCotizaciones = DB::table(
                'detalle_cotizacion'
            )
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->exists();

            if ($tieneCotizaciones) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'No se puede desactivar esta ' .
                        'estructura porque está vinculada ' .
                        'a una cotización.',
                ], 409);
            }

            // No eliminar materiales ni componentes.

            DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->update([
                    'estado' => false,
                ]);

            return response()->json([
                'ok' => true,
                'mensaje' =>
                    'Estructura desactivada correctamente.',
                'idModeloProducto' =>
                    $idModeloProducto,
                'estado' => false,
            ]);
        });
    }

    // ==========================================
    // REACTIVAR ESTRUCTURA METÁLICA
    // ==========================================

    public function reactivar(
        int $idModeloProducto
    ): JsonResponse {

        return DB::transaction(function () use (
            $idModeloProducto
        ) {

            // Buscar y bloquear la estructura.

            $modelo = DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->lockForUpdate()
                ->first();

            if (!$modelo) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'La estructura no existe.',
                ], 404);
            }

            // Evitar reactivaciones repetidas.

            if ($modelo->estado) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'La estructura ya está activa.',
                ], 409);
            }

            // Verificar que tenga al menos una pieza
            // activa asociada a un material activo.
            //
            // Así no reactivamos una estructura
            // que no pueda calcularse.

            $tieneComponentesDisponibles =
                DB::table('modelo_componente as mc')
                    ->join(
                        'modelo_material as mm',
                        'mm.idModeloMaterial',
                        '=',
                        'mc.idModeloMaterial'
                    )
                    ->join(
                        'material as m',
                        'm.idMaterial',
                        '=',
                        'mm.idMaterial'
                    )
                    ->where(
                        'mm.idModeloProducto',
                        $idModeloProducto
                    )
                    ->where('mm.estado', true)
                    ->where('mc.estado', true)
                    ->where('m.estado', true)
                    ->exists();

            if (!$tieneComponentesDisponibles) {
                return response()->json([
                    'ok' => false,
                    'mensaje' =>
                        'No se puede reactivar la estructura ' .
                        'porque no tiene piezas y materiales ' .
                        'activos disponibles.',
                ], 409);
            }

            // Reactivar solamente el modelo.
            // Se conservan su ID y sus relaciones.

            DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->update([
                    'estado' => true,
                ]);

            return response()->json([
                'ok' => true,
                'mensaje' =>
                    'Estructura reactivada correctamente.',
                'idModeloProducto' =>
                    $idModeloProducto,
                'estado' => true,
            ]);
        });
    }
}
