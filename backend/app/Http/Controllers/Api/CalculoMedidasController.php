<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CalculadoraModeloService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class CalculoMedidasController extends Controller
{
    public function calcular(
        Request $request,
        int $idModeloProducto,
        CalculadoraModeloService $calculadora
    ): JsonResponse {
        $datos = $request->validate([
            'ancho' => ['required', 'numeric', 'gt:0'],
            'alto' => ['required', 'numeric', 'gt:0'],
            'profundidad' => ['sometimes', 'numeric', 'gte:0'],
        ]);

        try {
            $resultado = $calculadora->calcularModelo(
                $idModeloProducto,
                (float) $datos['ancho'],
                (float) $datos['alto'],
                (float) ($datos['profundidad'] ?? 0)
            );
        } catch (InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'mensaje' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'ok' => true,
            'mensaje' => 'Medidas calculadas correctamente.',
            'resultado' => $resultado,
        ]);
    }
}
