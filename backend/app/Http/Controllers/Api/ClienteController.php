<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClienteController extends Controller
{
    // ==========================================
    // LISTAR CLIENTES
    // ==========================================

    public function index(): JsonResponse
    {
        $clientes = DB::table('cliente')
            ->orderByDesc('idCliente')
            ->get();

        return response()->json([
            'ok' => true,
            'clientes' => $clientes,
        ]);
    }

    // ==========================================
    // REGISTRAR CLIENTE
    // ==========================================

    public function store(Request $request): JsonResponse
    {
        $this->limpiarEntrada($request);

        $datos = $this->validarCliente($request);

        $idCliente = DB::table('cliente')
            ->insertGetId([
                'idUsuario' => null,
                'tipoDocumento' => $datos['tipoDocumento'],
                'numeroDocumento' => $datos['numeroDocumento'],
                'razonSocial' => $datos['razonSocial'] ?? null,
                'telefono' => $datos['telefono'] ?? null,
                'direccion' => $datos['direccion'] ?? null,
                'estado' => true,
            ], 'idCliente');

        return response()->json([
            'ok' => true,
            'mensaje' => 'Cliente registrado correctamente.',
            'idCliente' => $idCliente,
        ], 201);
    }

    // ==========================================
    // CONSULTAR CLIENTE
    // ==========================================

    public function show(int $id): JsonResponse
    {
        $cliente = DB::table('cliente')
            ->where('idCliente', $id)
            ->first();

        if (!$cliente) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Cliente no encontrado.',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'cliente' => $cliente,
        ]);
    }

    // ==========================================
    // ACTUALIZAR CLIENTE
    // ==========================================

    public function update(
        Request $request,
        int $id
    ): JsonResponse {
        $existente = DB::table('cliente')
            ->where('idCliente', $id)
            ->first();

        if (!$existente) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Cliente no encontrado.',
            ], 404);
        }

        $this->limpiarEntrada($request);

        $datos = $this->validarCliente($request, $id);

        DB::table('cliente')
            ->where('idCliente', $id)
            ->update([
                'tipoDocumento' => $datos['tipoDocumento'],
                'numeroDocumento' => $datos['numeroDocumento'],
                'razonSocial' => $datos['razonSocial'] ?? null,
                'telefono' => $datos['telefono'] ?? null,
                'direccion' => $datos['direccion'] ?? null,
                'estado' => $datos['estado'],
            ]);

        return response()->json([
            'ok' => true,
            'mensaje' => 'Cliente actualizado correctamente.',
        ]);
    }

    // ==========================================
    // DESACTIVAR CLIENTE
    // ==========================================

    public function destroy(int $id): JsonResponse
    {
        $cliente = DB::table('cliente')
            ->where('idCliente', $id)
            ->first();

        if (!$cliente) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'Cliente no encontrado.',
            ], 404);
        }

        DB::table('cliente')
            ->where('idCliente', $id)
            ->update([
                'estado' => false,
            ]);

        return response()->json([
            'ok' => true,
            'mensaje' => 'Cliente desactivado correctamente.',
        ]);
    }

    // ==========================================
    // LIMPIAR DATOS INGRESADOS
    // ==========================================

    private function limpiarEntrada(Request $request): void
    {
        $campos = [
            'tipoDocumento',
            'numeroDocumento',
            'razonSocial',
            'telefono',
            'direccion',
        ];

        $limpios = [];

        foreach ($campos as $campo) {
            $valor = $request->input($campo);

            if (is_string($valor)) {
                $limpios[$campo] = trim($valor);
            }
        }

        $request->merge($limpios);
    }

    // ==========================================
    // VALIDACIONES DE CLIENTES
    // ==========================================

    private function validarCliente(
        Request $request,
        ?int $id = null
    ): array {

        // No permitir documentos duplicados
        // dentro del mismo tipo de documento.

        $reglaDocumento = Rule::unique(
            'cliente',
            'numeroDocumento'
        )->where(
            'tipoDocumento',
            $request->input('tipoDocumento')
        );

        // Permitir conservar el documento actual
        // cuando se edita el mismo cliente.

        if ($id !== null) {
            $reglaDocumento->ignore(
                $id,
                'idCliente'
            );
        }

        // Reglas según el tipo de documento

        $tipoDocumento = $request->input(
            'tipoDocumento'
        );

        $reglaFormato = match ($tipoDocumento) {
            'DNI' => 'regex:/^[0-9]{8}$/',

            'RUC' => 'regex:/^[0-9]{11}$/',

            'CE' => 'regex:/^[A-Za-z0-9-]{1,12}$/',

            'PASAPORTE' =>
                'regex:/^[A-Za-z0-9-]{1,12}$/',

            default => 'regex:/^[A-Za-z0-9-]{1,20}$/',
        };

        $reglas = [
            'tipoDocumento' => [
                'required',
                'string',
                'max:20',
                Rule::in([
                    'DNI',
                    'RUC',
                    'CE',
                    'PASAPORTE',
                ]),
            ],

            'numeroDocumento' => [
                'required',
                'string',
                'max:20',
                $reglaFormato,
                $reglaDocumento,
            ],

            'razonSocial' => [
                'nullable',
                'string',
                'max:100',
            ],

            'telefono' => [
                'nullable',
                'string',
                'max:9',
                'regex:/^[0-9]{1,9}$/',
            ],

            'direccion' => [
                'nullable',
                'string',
                'max:100',
            ],
        ];

        if ($id !== null) {
            $reglas['estado'] = [
                'required',
                'boolean',
            ];
        }

        // Mensajes de error en español

        $mensajes = [
            'tipoDocumento.required' =>
                'Selecciona un tipo de documento.',

            'tipoDocumento.in' =>
                'El tipo de documento no es válido.',

            'numeroDocumento.required' =>
                'Ingresa el número de documento.',

            'numeroDocumento.regex' => match ($tipoDocumento) {
                'DNI' =>
                    'El DNI debe tener exactamente 8 números.',

                'RUC' =>
                    'El RUC debe tener exactamente 11 números.',

                'CE' =>
                    'El carné de extranjería tiene un formato incorrecto.',

                'PASAPORTE' =>
                    'El pasaporte tiene un formato incorrecto.',

                default =>
                    'El documento tiene un formato incorrecto.',
            },

            'numeroDocumento.unique' =>
                'Ya existe un cliente con este tipo y número de documento.',

            'telefono.regex' =>
                'El teléfono debe contener solamente números, máximo 9 dígitos.',

            'telefono.max' =>
                'El teléfono no puede superar los 9 dígitos.',

            'razonSocial.max' =>
                'El nombre o razón social no puede superar 100 caracteres.',

            'direccion.max' =>
                'La dirección no puede superar 100 caracteres.',
        ];

        return $request->validate(
            $reglas,
            $mensajes
        );
    }
}
