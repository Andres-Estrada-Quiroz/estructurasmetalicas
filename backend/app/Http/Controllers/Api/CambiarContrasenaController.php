<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CambiarContrasenaController extends Controller
{
    public function actualizar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'password_actual' => [
                'required',
                'string',
            ],
            'password' => [
                'required',
                'string',
                'min:12',
                'confirmed',
            ],
        ], [
            'password_actual.required' =>
                'Ingresa tu contraseña actual.',

            'password.min' =>
                'La contraseña nueva debe tener al menos 12 caracteres.',

            'password.confirmed' =>
                'Las contraseñas nuevas no coinciden.',
        ]);

        $usuario = $request->user('web');

        if (
            !$usuario instanceof Usuario ||
            !$usuario->estado
        ) {
            return response()->json([
                'ok' => false,
                'mensaje' => 'La cuenta no está disponible.',
            ], 403);
        }

        // Verificar contraseña actual.
        if (!Hash::check(
            $datos['password_actual'],
            $usuario->getAuthPassword()
        )) {
            throw ValidationException::withMessages([
                'password_actual' =>
                    'La contraseña actual es incorrecta.',
            ]);
        }

        // No permitir reutilizar la misma contraseña.
        if (Hash::check(
            $datos['password'],
            $usuario->getAuthPassword()
        )) {
            throw ValidationException::withMessages([
                'password' =>
                    'La nueva contraseña debe ser distinta a la actual.',
            ]);
        }

        // Actualizar la columna existente en PostgreSQL.
        DB::table('usuario')
            ->where('idUsuario', $usuario->idUsuario)
            ->update([
                'contrasena' => Hash::make(
                    $datos['password']
                ),
            ]);

        // Mantener la sesión abierta y renovar su ID.
        $request->session()->regenerate();

        return response()->json([
            'ok' => true,
            'mensaje' =>
                'Contraseña actualizada correctamente.',
        ]);
    }
}
