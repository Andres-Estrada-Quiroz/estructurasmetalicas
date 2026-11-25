<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CalculadoraModeloService
{
    public function __construct(
        private CalculadoraMedidasService $calculadora
    ) {}

    public function calcularModelo(
        int $idModeloProducto,
        float $ancho,
        float $alto,
        float $profundidad = 0
    ): array {
        if (
            $idModeloProducto < 1 ||
            !is_finite($ancho) ||
            !is_finite($alto) ||
            !is_finite($profundidad) ||
            $ancho <= 0 ||
            $alto <= 0 ||
            $profundidad < 0
        ) {
            throw new InvalidArgumentException(
                'El modelo o las dimensiones no son válidos.'
            );
        }

        $modelo = DB::table('modelo_producto')
            ->where('idModeloProducto', $idModeloProducto)
            ->where('estado', true)
            ->first();

        if (!$modelo) {
            throw new InvalidArgumentException(
                'El modelo no existe o está inactivo.'
            );
        }

        $componentes = DB::table('modelo_componente as mc')
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
            ->where('mc.estado', true)
            ->where('mm.estado', true)
            ->where('m.estado', true)
            ->select(
                'mc.nombre as componente',
                'mc.cantidadPiezas',
                'mc.tipoCalculo',
                'mc.factorCalculo',
                'mc.ajusteMetros',
                'mc.medidaFijaMetros',
                'm.idMaterial',
                'm.nombre as material',
                'm.unidadMedida',
                'mm.porcentajeMerma'
            )
            ->orderBy('mc.idModeloComponente')
            ->get();

        if ($componentes->isEmpty()) {
            throw new InvalidArgumentException(
                'El modelo no tiene componentes activos.'
            );
        }

        $detalle = [];
        $totalesMateriales = [];

        foreach ($componentes as $componente) {
            $calculo = $this->calculadora->calcular(
                $componente->tipoCalculo,
                $ancho,
                $alto,
                $profundidad,
                (int) $componente->cantidadPiezas,
                (float) $componente->factorCalculo,
                (float) $componente->ajusteMetros,
                $componente->medidaFijaMetros === null
                    ? null
                    : (float) $componente->medidaFijaMetros
            );

            $detalle[] = [
                'material' => $componente->material,
                'componente' => $componente->componente,
                ...$calculo,
            ];

            $clave = $componente->idMaterial
                . ':' . $calculo['unidad'];

            if (!isset($totalesMateriales[$clave])) {
                $totalesMateriales[$clave] = [
                    'idMaterial' => $componente->idMaterial,
                    'material' => $componente->material,
                    'unidad' => $calculo['unidad'],
                    'unidadRegistrada' =>
                        $componente->unidadMedida,
                    'porcentajeMerma' =>
                        (float) $componente->porcentajeMerma,
                    'cantidadNeta' => 0,
                ];
            }

            $totalesMateriales[$clave]['cantidadNeta']
                += $calculo['medidaTotal'];
        }

        foreach ($totalesMateriales as &$material) {
            $neto = $material['cantidadNeta'];
            $merma = $material['porcentajeMerma'];

            $material['cantidadNeta'] = round($neto, 4);

            $material['cantidadConMerma'] = round(
                $neto * (1 + $merma / 100),
                4
            );
        }

        unset($material);

        return [
            'idModeloProducto' => $idModeloProducto,
            'modelo' => $modelo->nombre,
            'dimensiones' => [
                'ancho' => $ancho,
                'alto' => $alto,
                'profundidad' => $profundidad,
                'unidad' => 'm',
            ],
            'componentes' => $detalle,
            'materiales' => array_values($totalesMateriales),
        ];
    }
}
