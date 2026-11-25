<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ModeloConfiguracionController extends Controller
{
    /**
     * Reglas compartidas para registrar y editar.
     */
    private function reglas(bool $edicion = false): array
    {
        $reglas = [
            'nombre' => [
                'required',
                'string',
                'max:50',
            ],
            'descripcion' => [
                'nullable',
                'string',
            ],
            'precioBase' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'materiales' => [
                'required',
                'array',
                'min:1',
            ],
            'materiales.*.idMaterial' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('material', 'idMaterial')
                    ->where('estado', true),
            ],
            'materiales.*.porcentajeMerma' => [
                'required',
                'numeric',
                'between:0,100',
            ],
            'materiales.*.componentes' => [
                'required',
                'array',
                'min:1',
            ],
            'materiales.*.componentes.*.nombre' => [
                'required',
                'string',
                'max:150',
            ],
            'materiales.*.componentes.*.cantidadPiezas' => [
                'required',
                'integer',
                'min:1',
            ],
            'materiales.*.componentes.*.tipoCalculo' => [
                'required',
                Rule::in([
                    'FIJO',
                    'ANCHO',
                    'ALTO',
                    'PROFUNDIDAD',
                    'AREA',
                    'VOLUMEN',
                    'UNIDAD',
                ]),
            ],
            'materiales.*.componentes.*.factorCalculo' => [
                'required',
                'numeric',
                'gt:0',
            ],
            'materiales.*.componentes.*.ajusteMetros' => [
                'required',
                'numeric',
            ],
            'materiales.*.componentes.*.medidaFijaMetros' => [
                'nullable',
                'numeric',
                'gt:0',
            ],
        ];

        if ($edicion) {
            $reglas['materiales.*.idModeloMaterial'] = [
                'nullable',
                'integer',
                'min:1',
            ];

            $reglas[
                'materiales.*.componentes.*.idModeloComponente'
            ] = [
                'nullable',
                'integer',
                'min:1',
            ];
        }

        return $reglas;
    }

    /**
     * Verificar las unidades y reglas de cálculo.
     */
    private function validarConfiguracion(
        array $materiales
    ): void {
        $unidadesPorTipo = [
            'FIJO' => 'm',
            'ANCHO' => 'm',
            'ALTO' => 'm',
            'PROFUNDIDAD' => 'm',
            'AREA' => 'm2',
            'VOLUMEN' => 'm3',
            'UNIDAD' => 'und',
        ];

        foreach ($materiales as $i => $material) {
            $registro = DB::table('material')
                ->where(
                    'idMaterial',
                    $material['idMaterial']
                )
                ->where('estado', true)
                ->first();

            if (!$registro) {
                throw ValidationException::withMessages([
                    "materiales.$i.idMaterial" =>
                        'El material no está disponible.',
                ]);
            }

            foreach (
                $material['componentes'] as $j => $componente
            ) {
                $tipo = $componente['tipoCalculo'];
                $unidadEsperada = $unidadesPorTipo[$tipo];

                if (
                    $registro->unidadMedida !==
                    $unidadEsperada
                ) {
                    throw ValidationException::withMessages([
                        "materiales.$i.componentes.$j.tipoCalculo" =>
                            "El cálculo $tipo requiere materiales " .
                            "expresados en $unidadEsperada.",
                    ]);
                }

                if (
                    $tipo === 'FIJO' &&
                    empty($componente['medidaFijaMetros'])
                ) {
                    throw ValidationException::withMessages([
                        "materiales.$i.componentes.$j.medidaFijaMetros" =>
                            'La regla FIJO necesita una medida fija.',
                    ]);
                }

                if (
                    in_array(
                        $tipo,
                        ['AREA', 'VOLUMEN', 'UNIDAD'],
                        true
                    ) &&
                    (float) $componente['ajusteMetros'] !== 0.0
                ) {
                    throw ValidationException::withMessages([
                        "materiales.$i.componentes.$j.ajusteMetros" =>
                            'El ajuste en metros solo se aplica ' .
                            'a cálculos lineales.',
                    ]);
                }
            }
        }
    }

    /**
     * Registrar nueva estructura.
     */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate(
            $this->reglas()
        );

        $this->validarConfiguracion(
            $datos['materiales']
        );

        $idModelo = DB::transaction(function () use ($datos) {
            $idModelo = DB::table('modelo_producto')
                ->insertGetId([
                    'nombre' => trim($datos['nombre']),
                    'descripcion' =>
                        $datos['descripcion'] ?? null,
                    'imagen' => null,
                    'precioBase' =>
                        $datos['precioBase'] ?? 0,
                    'estado' => true,
                ], 'idModeloProducto');

            foreach ($datos['materiales'] as $material) {
                $idModeloMaterial = DB::table(
                    'modelo_material'
                )->insertGetId([
                    'idModeloProducto' => $idModelo,
                    'idMaterial' =>
                        $material['idMaterial'],
                    'porcentajeMerma' =>
                        $material['porcentajeMerma'],
                    'estado' => true,
                ], 'idModeloMaterial');

                foreach (
                    $material['componentes'] as $componente
                ) {
                    DB::table('modelo_componente')
                        ->insert([
                            'idModeloMaterial' =>
                                $idModeloMaterial,
                            'nombre' =>
                                trim($componente['nombre']),
                            'cantidadPiezas' =>
                                $componente['cantidadPiezas'],
                            'tipoCalculo' =>
                                $componente['tipoCalculo'],
                            'factorCalculo' =>
                                $componente['factorCalculo'],
                            'ajusteMetros' =>
                                $componente['ajusteMetros'],
                            'medidaFijaMetros' =>
                                $componente['tipoCalculo'] === 'FIJO'
                                    ? $componente['medidaFijaMetros']
                                    : null,
                            'estado' => true,
                        ]);
                }
            }

            return $idModelo;
        });

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Estructura metálica registrada correctamente.',
            'idModeloProducto' => $idModelo,
        ], 201);
    }

    /**
     * Consultar detalle completo.
     * No modifica registros.
     */
    public function show(
        int $idModeloProducto
    ): JsonResponse {
        $modelo = DB::table('modelo_producto')
            ->where(
                'idModeloProducto',
                $idModeloProducto
            )
            ->first();

        if (!$modelo) {
            return response()->json([
                'ok' => false,
                'mensaje' =>
                    'La estructura solicitada no existe.',
            ], 404);
        }

        $materiales = DB::table('modelo_material as mm')
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
            ->select([
                'mm.idModeloMaterial',
                'mm.idMaterial',
                'mm.porcentajeMerma',
                'mm.estado',
                'm.codigo',
                'm.nombre',
                'm.descripcion',
                'm.unidadMedida',
            ])
            ->orderBy('mm.idModeloMaterial')
            ->get();

        $ids = $materiales
            ->pluck('idModeloMaterial')
            ->all();

        $componentes = collect();

        if (count($ids) > 0) {
            $componentes = DB::table('modelo_componente')
                ->whereIn('idModeloMaterial', $ids)
                ->select([
                    'idModeloComponente',
                    'idModeloMaterial',
                    'nombre',
                    'cantidadPiezas',
                    'tipoCalculo',
                    'factorCalculo',
                    'ajusteMetros',
                    'medidaFijaMetros',
                    'estado',
                ])
                ->orderBy('idModeloMaterial')
                ->orderBy('idModeloComponente')
                ->get();
        }

        $agrupados = $componentes
            ->groupBy('idModeloMaterial');

        $detalleMateriales = $materiales
            ->map(function ($material) use ($agrupados) {
                return [
                    'idModeloMaterial' =>
                        $material->idModeloMaterial,
                    'idMaterial' =>
                        $material->idMaterial,
                    'codigo' =>
                        $material->codigo,
                    'nombre' =>
                        $material->nombre,
                    'descripcion' =>
                        $material->descripcion,
                    'unidadMedida' =>
                        $material->unidadMedida,
                    'porcentajeMerma' =>
                        $material->porcentajeMerma,
                    'estado' =>
                        $material->estado,
                    'componentes' =>
                        $agrupados->get(
                            $material->idModeloMaterial,
                            collect()
                        )->values()->all(),
                ];
            })
            ->values();

        $tieneCotizaciones = DB::table(
            'detalle_cotizacion'
        )
            ->where(
                'idModeloProducto',
                $idModeloProducto
            )
            ->exists();

        return response()->json([
            'ok' => true,
            'modelo' => [
                'idModeloProducto' =>
                    $modelo->idModeloProducto,
                'nombre' =>
                    $modelo->nombre,
                'descripcion' =>
                    $modelo->descripcion,
                'precioBase' =>
                    $modelo->precioBase,
                'estado' =>
                    $modelo->estado,
                'tieneCotizaciones' =>
                    $tieneCotizaciones,
                'materiales' =>
                    $detalleMateriales,
            ],
        ]);
    }

    /**
     * Actualizar estructura existente.
     *
     * Protecciones:
     * - No cambia el ID del modelo.
     * - Bloquea modelos usados en cotizaciones.
     * - Conserva IDs de materiales y piezas.
     * - Desactiva registros retirados de la configuración.
     * - Ejecuta todo dentro de una transacción.
     */
    public function update(
        Request $request,
        int $idModeloProducto
    ): JsonResponse {
        $datos = $request->validate(
            $this->reglas(true)
        );

        $this->validarConfiguracion(
            $datos['materiales']
        );

        DB::transaction(function () use (
            $datos,
            $idModeloProducto
        ) {
            $modelo = DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->lockForUpdate()
                ->first();

            if (!$modelo) {
                throw ValidationException::withMessages([
                    'modelo' =>
                        'La estructura no existe.',
                ]);
            }

            if (!$modelo->estado) {
                throw ValidationException::withMessages([
                    'modelo' =>
                        'No se puede editar una estructura inactiva.',
                ]);
            }

            $tieneCotizaciones = DB::table(
                'detalle_cotizacion'
            )
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->exists();

            if ($tieneCotizaciones) {
                throw ValidationException::withMessages([
                    'modelo' =>
                        'Esta estructura está vinculada a una ' .
                        'cotización. Su edición está protegida.',
                ]);
            }

            /*
             * Identificar la configuración actual
             * antes de actualizarla.
             */
            $materialesActuales = DB::table(
                'modelo_material'
            )
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->lockForUpdate()
                ->get()
                ->keyBy('idModeloMaterial');

            $idsMaterialesActuales = $materialesActuales
                ->keys()
                ->all();

            $componentesActuales = collect();

            if (count($idsMaterialesActuales) > 0) {
                $componentesActuales = DB::table(
                    'modelo_componente'
                )
                    ->whereIn(
                        'idModeloMaterial',
                        $idsMaterialesActuales
                    )
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('idModeloComponente');
            }

            /*
             * Verificar todos los IDs enviados ANTES
             * de modificar cualquier registro.
             */
            $idsMaterialesRecibidos = [];
            $idsComponentesRecibidos = [];

            foreach ($datos['materiales'] as $i => $material) {
                $idMM = $material[
                    'idModeloMaterial'
                ] ?? null;

                if ($idMM !== null) {
                    if (
                        !$materialesActuales->has($idMM) ||
                        !$materialesActuales[$idMM]->estado
                    ) {
                        throw ValidationException::withMessages([
                            "materiales.$i.idModeloMaterial" =>
                                'El material asociado no pertenece ' .
                                'a esta estructura o está inactivo.',
                        ]);
                    }

                    if (
                        (int) $materialesActuales[$idMM]
                            ->idMaterial !==
                        (int) $material['idMaterial']
                    ) {
                        throw ValidationException::withMessages([
                            "materiales.$i.idMaterial" =>
                                'No se puede cambiar el material ' .
                                'de una relación existente. ' .
                                'Retira la relación y agrega otra.',
                        ]);
                    }

                    if (in_array(
                        (int) $idMM,
                        $idsMaterialesRecibidos,
                        true
                    )) {
                        throw ValidationException::withMessages([
                            "materiales.$i.idModeloMaterial" =>
                                'La misma relación de material ' .
                                'no puede repetirse.',
                        ]);
                    }

                    $idsMaterialesRecibidos[] =
                        (int) $idMM;
                }

                foreach (
                    $material['componentes'] as $j => $componente
                ) {
                    $idMC = $componente[
                        'idModeloComponente'
                    ] ?? null;

                    if ($idMC === null) {
                        continue;
                    }

                    if (
                        $idMM === null ||
                        !$componentesActuales->has($idMC) ||
                        !$componentesActuales[$idMC]->estado ||
                        (int) $componentesActuales[$idMC]
                            ->idModeloMaterial !== (int) $idMM
                    ) {
                        throw ValidationException::withMessages([
                            "materiales.$i.componentes.$j.idModeloComponente" =>
                                'La pieza no pertenece al material ' .
                                'indicado o está inactiva.',
                        ]);
                    }

                    if (in_array(
                        (int) $idMC,
                        $idsComponentesRecibidos,
                        true
                    )) {
                        throw ValidationException::withMessages([
                            "materiales.$i.componentes.$j.idModeloComponente" =>
                                'La misma pieza no puede repetirse.',
                        ]);
                    }

                    $idsComponentesRecibidos[] =
                        (int) $idMC;
                }
            }

            /*
             * Actualizar datos generales.
             */
            DB::table('modelo_producto')
                ->where(
                    'idModeloProducto',
                    $idModeloProducto
                )
                ->update([
                    'nombre' => trim($datos['nombre']),
                    'descripcion' =>
                        $datos['descripcion'] ?? null,
                    'precioBase' =>
                        $datos['precioBase'] ?? 0,
                ]);

            /*
             * Actualizar o insertar materiales
             * y componentes.
             */
            foreach ($datos['materiales'] as $material) {
                $idMM = $material[
                    'idModeloMaterial'
                ] ?? null;

                if ($idMM !== null) {
                    DB::table('modelo_material')
                        ->where(
                            'idModeloMaterial',
                            $idMM
                        )
                        ->update([
                            'porcentajeMerma' =>
                                $material['porcentajeMerma'],
                        ]);
                } else {
                    $idMM = DB::table(
                        'modelo_material'
                    )->insertGetId([
                        'idModeloProducto' =>
                            $idModeloProducto,
                        'idMaterial' =>
                            $material['idMaterial'],
                        'porcentajeMerma' =>
                            $material['porcentajeMerma'],
                        'estado' => true,
                    ], 'idModeloMaterial');
                }

                $idsMaterialesRecibidos[] =
                    (int) $idMM;

                foreach (
                    $material['componentes'] as $componente
                ) {
                    $valores = [
                        'nombre' =>
                            trim($componente['nombre']),
                        'cantidadPiezas' =>
                            $componente['cantidadPiezas'],
                        'tipoCalculo' =>
                            $componente['tipoCalculo'],
                        'factorCalculo' =>
                            $componente['factorCalculo'],
                        'ajusteMetros' =>
                            $componente['ajusteMetros'],
                        'medidaFijaMetros' =>
                            $componente['tipoCalculo'] === 'FIJO'
                                ? $componente['medidaFijaMetros']
                                : null,
                    ];

                    $idMC = $componente[
                        'idModeloComponente'
                    ] ?? null;

                    if ($idMC !== null) {
                        DB::table('modelo_componente')
                            ->where(
                                'idModeloComponente',
                                $idMC
                            )
                            ->update($valores);
                    } else {
                        $idMC = DB::table(
                            'modelo_componente'
                        )->insertGetId(
                            [
                                'idModeloMaterial' =>
                                    $idMM,
                                ...$valores,
                                'estado' => true,
                            ],
                            'idModeloComponente'
                        );
                    }

                    $idsComponentesRecibidos[] =
                        (int) $idMC;
                }
            }

            /*
             * Desactivar piezas retiradas del
             * formulario, sin borrarlas físicamente.
             */
            if ($componentesActuales->isNotEmpty()) {
                DB::table('modelo_componente')
                    ->whereIn(
                        'idModeloComponente',
                        $componentesActuales
                            ->keys()
                            ->all()
                    )
                    ->whereNotIn(
                        'idModeloComponente',
                        array_unique(
                            $idsComponentesRecibidos
                        )
                    )
                    ->update([
                        'estado' => false,
                    ]);
            }

            /*
             * Desactivar relaciones de materiales
             * retiradas del formulario.
             */
            if ($materialesActuales->isNotEmpty()) {
                DB::table('modelo_material')
                    ->whereIn(
                        'idModeloMaterial',
                        $idsMaterialesActuales
                    )
                    ->whereNotIn(
                        'idModeloMaterial',
                        array_unique(
                            $idsMaterialesRecibidos
                        )
                    )
                    ->update([
                        'estado' => false,
                    ]);
            }
        });

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Estructura metálica actualizada correctamente.',
            'idModeloProducto' =>
                $idModeloProducto,
        ]);
    }
}
