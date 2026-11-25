<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProveedorController extends Controller
{
    // ==========================================
    // LISTAR PROVEEDORES
    // ==========================================

    public function index(): JsonResponse
    {
        $proveedores = DB::table('proveedor')
            ->orderBy('razonSocial')
            ->get();

        return response()->json([
            'ok' => true,
            'proveedores' => $proveedores,
        ]);
    }

    // ==========================================
    // REGISTRAR PROVEEDOR
    // ==========================================

    public function store(Request $request): JsonResponse
    {
        $this->limpiarEntrada($request);

        $datos = $this->validarProveedor($request);

        $id = DB::table('proveedor')->insertGetId([
            'ruc' => $datos['ruc'],
            'razonSocial' => $datos['razonSocial'],
            'contacto' => $datos['contacto'] ?? null,
            'telefono' => $datos['telefono'] ?? null,
            'correo' => $datos['correo'] ?? null,
            'direccion' => $datos['direccion'] ?? null,
            'estado' => true,
        ], 'idProveedor');

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Proveedor registrado correctamente.',
            'idProveedor' => $id,
        ], 201);
    }

    // ==========================================
    // CONSULTAR UN PROVEEDOR
    // ==========================================

    public function show(int $id): JsonResponse
    {
        $proveedor = DB::table('proveedor')
            ->where('idProveedor', $id)
            ->first();

        if (!$proveedor) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Proveedor no encontrado.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'proveedor' => $proveedor,
        ]);
    }

    // ==========================================
    // ACTUALIZAR PROVEEDOR
    // ==========================================

    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $existe = DB::table('proveedor')
            ->where('idProveedor', $id)
            ->exists();

        if (!$existe) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Proveedor no encontrado.',
            ], 404);
        }

        $this->limpiarEntrada($request);

        $datos = $this->validarProveedor(
            $request,
            $id
        );

        DB::table('proveedor')
            ->where('idProveedor', $id)
            ->update([
                'ruc' => $datos['ruc'],
                'razonSocial' => $datos['razonSocial'],
                'contacto' => $datos['contacto'] ?? null,
                'telefono' => $datos['telefono'] ?? null,
                'correo' => $datos['correo'] ?? null,
                'direccion' => $datos['direccion'] ?? null,
                'estado' => $datos['estado'],
            ]);

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Proveedor actualizado correctamente.',
        ]);
    }

    // ==========================================
    // DESACTIVAR PROVEEDOR
    // ==========================================

    public function destroy(int $id): JsonResponse
    {
        $existe = DB::table('proveedor')
            ->where('idProveedor', $id)
            ->exists();

        if (!$existe) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Proveedor no encontrado.',
            ], 404);
        }

        DB::transaction(function () use ($id) {
            DB::table('proveedor')
                ->where('idProveedor', $id)
                ->update([
                    'estado' => false,
                ]);

            DB::table('proveedor_material')
                ->where('idProveedor', $id)
                ->update([
                    'estado' => false,
                ]);
        });

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Proveedor desactivado correctamente.',
        ]);
    }

    // ==========================================
    // LIMPIAR DATOS DEL FORMULARIO
    // ==========================================

    private function limpiarEntrada(
        Request $request
    ): void {
        $campos = [
            'ruc',
            'razonSocial',
            'contacto',
            'telefono',
            'correo',
            'direccion',
        ];

        $limpios = [];

        foreach ($campos as $campo) {
            $valor = $request->input($campo);

            if (is_string($valor)) {
                $valor = trim($valor);

                $limpios[$campo] =
                    $valor === '' ? null : $valor;
            }
        }

        $request->merge($limpios);
    }

    // ==========================================
    // VALIDACIONES
    // ==========================================

    private function validarProveedor(
        Request $request,
        ?int $id = null
    ): array {
        // Validación de RUC único

        $rucUnico = Rule::unique(
            'proveedor',
            'ruc'
        );

        if ($id !== null) {
            $rucUnico->ignore(
                $id,
                'idProveedor'
            );
        }

        // Reglas de validación

        $reglas = [
            'ruc' => [
                'required',
                'string',
                'regex:/^[0-9]{11}$/',
                $rucUnico,
            ],

            'razonSocial' => [
                'required',
                'string',
                'max:100',
                function (
                    $atributo,
                    $valor,
                    $fallar
                ) {
                    if (trim($valor) === '') {
                        $fallar(
                            'La razón social es obligatoria.'
                        );
                    }
                },
            ],

            'contacto' => [
                'nullable',
                'string',
                'max:100',
            ],

            // TELÉFONO:
            // Opcional.
            // Solo números.
            // Exactamente 9 dígitos si se ingresa.

            'telefono' => [
                'nullable',
                'string',
                'size:9',
                'regex:/^[0-9]{9}$/',
            ],

            'correo' => [
                'nullable',
                'email',
                'max:100',
            ],

            'direccion' => [
                'nullable',
                'string',
                'max:150',
            ],
        ];

        // El estado se valida al actualizar

        if ($id !== null) {
            $reglas['estado'] = [
                'required',
                'boolean',
            ];
        }

        // ======================================
        // MENSAJES PERSONALIZADOS
        // ======================================

        return $request->validate($reglas, [
            'ruc.required' =>
                'Ingresa el RUC del proveedor.',

            'ruc.regex' =>
                'El RUC debe tener exactamente 11 números.',

            'ruc.unique' =>
                'Ya existe un proveedor con ese RUC.',

            'razonSocial.required' =>
                'Ingresa la razón social.',

            'razonSocial.max' =>
                'La razón social no puede superar los 100 caracteres.',

            'contacto.max' =>
                'El contacto no puede superar los 100 caracteres.',

            'telefono.size' =>
                'El teléfono debe tener exactamente 9 dígitos.',

            'telefono.regex' =>
                'El teléfono debe contener solo números y tener exactamente 9 dígitos.',

            'correo.email' =>
                'Ingresa un correo electrónico válido.',

            'correo.max' =>
                'El correo no puede superar los 100 caracteres.',

            'direccion.max' =>
                'La dirección no puede superar los 150 caracteres.',
        ]);
    }
}
