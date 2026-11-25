<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProveedorMaterialController extends Controller
{
    public function index(): JsonResponse
    {
        $precios = DB::table('proveedor_material as pm')
            ->join(
                'proveedor as p',
                'p.idProveedor',
                '=',
                'pm.idProveedor'
            )
            ->join(
                'material as m',
                'm.idMaterial',
                '=',
                'pm.idMaterial'
            )
            ->select(
                'pm.idProveedorMaterial',
                'pm.idProveedor',
                'pm.idMaterial',
                'p.razonSocial as proveedor',
                'p.ruc',
                'm.nombre as material',
                'm.codigo',
                'm.unidadMedida',
                'pm.precioReferencia',
                'pm.fechaActualizacion',
                'pm.estado'
            )
            ->orderBy('p.razonSocial')
            ->orderBy('m.nombre')
            ->get();

        return response()->json([
            'ok' => true,
            'precios' => $precios,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validarPrecio($request);

        $id = DB::table('proveedor_material')
            ->insertGetId([
                'idProveedor' => $datos['idProveedor'],
                'idMaterial' => $datos['idMaterial'],
                'precioReferencia' =>
                    $datos['precioReferencia'],
                'fechaActualizacion' => now(),
                'estado' => true,
            ], 'idProveedorMaterial');

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Precio de referencia registrado correctamente.',
            'idProveedorMaterial' => $id,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $precio = DB::table('proveedor_material')
            ->where('idProveedorMaterial', $id)
            ->first();

        if (!$precio) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Precio no encontrado.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'precio' => $precio,
        ]);
    }

    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $existe = DB::table('proveedor_material')
            ->where('idProveedorMaterial', $id)
            ->exists();

        if (!$existe) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Precio no encontrado.',
            ], 404);
        }

        $datos = $this->validarPrecio($request, $id);

        DB::table('proveedor_material')
            ->where('idProveedorMaterial', $id)
            ->update([
                'idProveedor' => $datos['idProveedor'],
                'idMaterial' => $datos['idMaterial'],
                'precioReferencia' =>
                    $datos['precioReferencia'],
                'fechaActualizacion' => now(),
                'estado' => $datos['estado'],
            ]);

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Precio actualizado correctamente.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $existe = DB::table('proveedor_material')
            ->where('idProveedorMaterial', $id)
            ->exists();

        if (!$existe) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Precio no encontrado.',
            ], 404);
        }

        DB::table('proveedor_material')
            ->where('idProveedorMaterial', $id)
            ->update([
                'estado' => false,
            ]);

        return response()->json([
            'ok' => true,
            'mensaje' => 'Precio desactivado correctamente.',
        ]);
    }

    private function validarPrecio(
        Request $request,
        ?int $id = null
    ): array {
        $reglaUnica = Rule::unique(
            'proveedor_material',
            'idMaterial'
        )->where(
            'idProveedor',
            $request->input('idProveedor')
        );

        if ($id !== null) {
            $reglaUnica->ignore(
                $id,
                'idProveedorMaterial'
            );
        }

        $reglas = [
            'idProveedor' => [
                'required',
                'integer',
                Rule::exists(
                    'proveedor',
                    'idProveedor'
                )->where('estado', true),
            ],

            'idMaterial' => [
                'required',
                'integer',
                Rule::exists(
                    'material',
                    'idMaterial'
                )->where('estado', true),
                $reglaUnica,
            ],

            'precioReferencia' => [
                'required',
                'numeric',
                'min:0',
                'decimal:0,2',
            ],
        ];

        if ($id !== null) {
            $reglas['estado'] = [
                'required',
                'boolean',
            ];
        }

        return $request->validate($reglas, [
            'idProveedor.exists' =>
                'Selecciona un proveedor activo.',

            'idMaterial.exists' =>
                'Selecciona un material activo.',

            'idMaterial.unique' =>
                'Ese proveedor ya tiene un precio para ese material.',

            'precioReferencia.required' =>
                'Ingresa el precio de referencia.',

            'precioReferencia.min' =>
                'El precio no puede ser negativo.',
        ]);
    }
}
