<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MaterialController extends Controller
{
    // Listar materiales
    public function index(): JsonResponse
    {
        $materiales = DB::table('material')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'ok' => true,
            'materiales' => $materiales,
        ]);
    }

    // Registrar material
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'codigo' => [
                'required',
                'string',
                'max:50',
                Rule::unique('material', 'codigo'),
            ],
            'nombre' => [
                'required',
                'string',
                'max:100',
            ],
            'descripcion' => [
                'nullable',
                'string',
            ],
            'unidadMedida' => [
                'required',
                'string',
                'max:20',
            ],
            'estado' => [
                'sometimes',
                'boolean',
            ],
        ]);

        $id = DB::table('material')->insertGetId([
            'codigo' => trim($datos['codigo']),
            'nombre' => trim($datos['nombre']),
            'descripcion' => $datos['descripcion'] ?? null,
            'unidadMedida' => trim($datos['unidadMedida']),
            'estado' => $datos['estado'] ?? true,
        ], 'idMaterial');

        return response()->json([
            'ok' => true,
            'mensaje' => 'Material registrado correctamente.',
            'idMaterial' => $id,
        ], 201);
    }

    // Consultar un material
    public function show(int $id): JsonResponse
    {
        $material = DB::table('material')
            ->where('idMaterial', $id)
            ->first();

        if (!$material) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Material no encontrado.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'material' => $material,
        ]);
    }

    // Actualizar material
    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $actual = DB::table('material')
            ->where('idMaterial', $id)
            ->first();

        if (!$actual) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Material no encontrado.',
            ], 404);
        }

        $datos = $request->validate([
            'codigo' => [
                'required',
                'string',
                'max:50',
                Rule::unique('material', 'codigo')
                    ->ignore($id, 'idMaterial'),
            ],
            'nombre' => [
                'required',
                'string',
                'max:100',
            ],
            'descripcion' => [
                'nullable',
                'string',
            ],
            'unidadMedida' => [
                'required',
                'string',
                'max:20',
            ],
            'estado' => [
                'required',
                'boolean',
            ],
        ]);

        DB::table('material')
            ->where('idMaterial', $id)
            ->update($datos);

        return response()->json([
            'ok' => true,
            'mensaje' => 'Material actualizado correctamente.',
        ]);
    }

    // Desactivar material sin eliminarlo
    public function destroy(int $id): JsonResponse
    {
        $actualizados = DB::table('material')
            ->where('idMaterial', $id)
            ->update(['estado' => false]);

        if ($actualizados === 0) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Material no encontrado o ya inactivo.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'mensaje' => 'Material desactivado correctamente.',
        ]);
    }
}
