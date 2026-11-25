<?php

namespace App\Services;

use InvalidArgumentException;

class CalculadoraMedidasService
{
    public function calcular(
        string $tipoCalculo,
        float $ancho,
        float $alto,
        float $profundidad,
        int $cantidadPiezas,
        float $factorCalculo = 1,
        float $ajusteMetros = 0,
        ?float $medidaFijaMetros = null
    ): array {
        if (
            $ancho < 0 ||
            $alto < 0 ||
            $profundidad < 0 ||
            $cantidadPiezas < 1 ||
            $factorCalculo < 0
        ) {
            throw new InvalidArgumentException(
                'Las medidas, cantidades o factores no son válidos.'
            );
        }

        $tipoCalculo = strtoupper($tipoCalculo);

        $unidad = match ($tipoCalculo) {
            'AREA' => 'm2',
            'VOLUMEN' => 'm3',
            'UNIDAD' => 'und',
            default => 'm',
        };

        $medidaBase = match ($tipoCalculo) {
            'FIJO' => $medidaFijaMetros
                ?? throw new InvalidArgumentException(
                    'La medida fija es obligatoria.'
                ),

            'ANCHO' => $ancho,
            'ALTO' => $alto,
            'PROFUNDIDAD' => $profundidad,
            'AREA' => $ancho * $alto,
            'VOLUMEN' => $ancho * $alto * $profundidad,
            'UNIDAD' => 1,

            default => throw new InvalidArgumentException(
                'Tipo de cálculo no permitido.'
            ),
        };

        // Regla provisional: el ajuste se aplica
        // solamente a medidas lineales.
        $esLineal = in_array(
            $tipoCalculo,
            ['FIJO', 'ANCHO', 'ALTO', 'PROFUNDIDAD'],
            true
        );

        $medidaPorPieza = $medidaBase * $factorCalculo;

        if ($esLineal) {
            $medidaPorPieza += $ajusteMetros;
        }

        if ($medidaPorPieza < 0) {
            throw new InvalidArgumentException(
                'El cálculo produce una medida negativa.'
            );
        }

        $total = $medidaPorPieza * $cantidadPiezas;

        return [
            'tipoCalculo' => $tipoCalculo,
            'cantidadPiezas' => $cantidadPiezas,
            'medidaPorPieza' => round($medidaPorPieza, 4),
            'medidaTotal' => round($total, 4),
            'unidad' => $unidad,
        ];
    }
}
