<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CotizacionController extends Controller
{
    // ==========================================
    // LISTAR COTIZACIONES
    // ==========================================

    public function index(): JsonResponse
    {
        $cotizaciones = DB::table('cotizacion as c')
            ->join(
                'cliente as cl',
                'cl.idCliente',
                '=',
                'c.idCliente'
            )
            ->leftJoin(
                'version_cotizacion as v',
                function ($join) {
                    $join->on(
                        'v.idCotizacion',
                        '=',
                        'c.idCotizacion'
                    )->where('v.numeroVersion', 1);
                }
            )
            ->select(
                'c.idCotizacion',
                'c.idCliente',
                'cl.razonSocial',
                'cl.numeroDocumento',
                'c.fechaCotizacion',
                'c.fechaVencimiento',
                'c.observacion',
                'c.estado',
                'v.idVersionCotizacion',
                'v.numeroVersion',
                'v.subTotal',
                'v.descuento',
                'v.igv',
                'v.montoTotal'
            )
            ->orderByDesc('c.idCotizacion')
            ->get();

        return response()->json([
            'ok' => true,
            'cotizaciones' => $cotizaciones,
        ]);
    }

    // ==========================================
    // REGISTRAR COTIZACIÓN
    // ==========================================

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'idCliente' => [
                'required',
                'integer',
                Rule::exists(
                    'cliente',
                    'idCliente'
                )->where('estado', true),
            ],

            'idModeloProducto' => [
                'required',
                'integer',
                Rule::exists(
                    'modelo_producto',
                    'idModeloProducto'
                )->where('estado', true),
            ],

            'fechaVencimiento' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:today',
            ],

            'ancho' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'alto' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'profundidad' => [
                'required',
                'numeric',
                'min:0',
            ],

            'cantidad' => [
                'required',
                'integer',
                'min:1',
            ],

            'precioUnitario' => [
                'required',
                'numeric',
                'gt:0',
                'decimal:0,2',
            ],

            'descuento' => [
                'required',
                'numeric',
                'min:0',
                'decimal:0,2',
            ],

            'igvPorcentaje' => [
                'required',
                Rule::in([0, 18]),
            ],

            'observacion' => [
                'nullable',
                'string',
                'max:100',
            ],

            'descripcion' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        // Realizar el cálculo monetario en céntimos.

        $precioCentimos = (int) round(
            (float) $datos['precioUnitario'] * 100
        );

        $cantidad = (int) $datos['cantidad'];

        $subtotalCentimos = $precioCentimos * $cantidad;

        $descuentoCentimos = (int) round(
            (float) $datos['descuento'] * 100
        );

        if ($descuentoCentimos > $subtotalCentimos) {
            throw ValidationException::withMessages([
                'descuento' =>
                    'El descuento no puede superar el subtotal.',
            ]);
        }

        $baseCentimos =
            $subtotalCentimos - $descuentoCentimos;

        $porcentaje = (int) $datos['igvPorcentaje'];

        $igvCentimos = (int) round(
            $baseCentimos * $porcentaje / 100
        );

        $totalCentimos =
            $baseCentimos + $igvCentimos;

        $subtotal = $subtotalCentimos / 100;
        $descuento = $descuentoCentimos / 100;
        $igv = $igvCentimos / 100;
        $total = $totalCentimos / 100;

        // Guardar todos los registros juntos.

        $resultado = DB::transaction(function () use (
            $datos,
            $subtotal,
            $descuento,
            $igv,
            $total
        ) {
            // 1. Crear cotización.

            $idCotizacion = DB::table('cotizacion')
                ->insertGetId([
                    'idCliente' => $datos['idCliente'],
                    'fechaVencimiento' =>
                        $datos['fechaVencimiento'],
                    'observacion' =>
                        $datos['observacion'] ?? null,
                    'estado' => true,
                ], 'idCotizacion');

            // 2. Crear primera versión.

            $idVersion = DB::table('version_cotizacion')
                ->insertGetId([
                    'idCotizacion' => $idCotizacion,
                    'numeroVersion' => 1,
                    'subTotal' => $subtotal,
                    'descuento' => $descuento,
                    'igv' => $igv,
                    'montoTotal' => $total,
                    'observacion' => null,
                    'estado' => 'BORRADOR',
                ], 'idVersionCotizacion');

            // 3. Crear detalle de la estructura.

$idDetalle = DB::table('detalle_cotizacion')
    ->insertGetId([
        'idVersionCotizacion' => $idVersion,
        'idModeloProducto' => $datos['idModeloProducto'],
        'idArticulo' => null,
        'ancho' => $datos['ancho'],
        'alto' => $datos['alto'],
        
'profundidad' => (float) $datos['profundidad'] > 0
    ? (float) $datos['profundidad']
    : null,

        'cantidad' => $datos['cantidad'],
        'precioUnitario' => $datos['precioUnitario'],
        'descripcion' => $datos['descripcion'] ?? null,
    ], 'idDetalleCotizacion');

            return [
                
                'idCotizacion' => $idCotizacion,
                'idVersionCotizacion' => $idVersion,
                'idDetalleCotizacion' => $idDetalle,
            ];
        });

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Cotización registrada correctamente.',
            'cotizacion' => [
                ...$resultado,
                'subTotal' => $subtotal,
                'descuento' => $descuento,
                'igv' => $igv,
                'montoTotal' => $total,
                'estado' => 'BORRADOR',
            ],
        ], 201);
    }

    // ==========================================
    // CONSULTAR COTIZACIÓN
    // ==========================================

    public function show(int $id): JsonResponse
    {
        $cotizacion = DB::table('cotizacion')
            ->where('idCotizacion', $id)
            ->first();

        if (!$cotizacion) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Cotización no encontrada.',
            ], 404);
        }

        $versiones = DB::table('version_cotizacion')
            ->where('idCotizacion', $id)
            ->orderBy('numeroVersion')
            ->get();

        $detalles = DB::table('detalle_cotizacion as d')
            ->join(
                'version_cotizacion as v',
                'v.idVersionCotizacion',
                '=',
                'd.idVersionCotizacion'
            )
            ->where('v.idCotizacion', $id)
            ->select('d.*')
            ->get();

        return response()->json([
            'ok' => true,
            'cotizacion' => $cotizacion,
            'versiones' => $versiones,
            'detalles' => $detalles,
        ]);
    }
}
