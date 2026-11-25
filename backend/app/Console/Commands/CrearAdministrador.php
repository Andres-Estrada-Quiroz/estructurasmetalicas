<?php

namespace App\Console\Commands;

use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CrearAdministrador extends Command
{
    protected $signature = 'usuario:crear-admin';

    protected $description =
        'Crea el primer usuario administrador del sistema';

    public function handle(): int
    {
        $rol = Rol::where(
            'nombre',
            'ADMINISTRADOR'
        )->where('estado', true)->first();

        if (!$rol) {
            $this->error(
                'No existe un rol ADMINISTRADOR activo.'
            );

            return self::FAILURE;
        }

        $nombres = trim(
            $this->ask('Nombres del administrador') ?? ''
        );

        $apellidos = trim(
            $this->ask('Apellidos del administrador') ?? ''
        );

        $correo = mb_strtolower(trim(
            $this->ask('Correo electrónico') ?? ''
        ));

        if (
            $nombres === '' ||
            $apellidos === '' ||
            !filter_var($correo, FILTER_VALIDATE_EMAIL)
        ) {
            $this->error(
                'Los nombres, apellidos o correo no son válidos.'
            );

            return self::FAILURE;
        }

        if (Usuario::where('correo', $correo)->exists()) {
            $this->error(
                'Ya existe un usuario con ese correo.'
            );

            return self::FAILURE;
        }

        $contrasena = $this->secret(
            'Contraseña segura (mínimo 12 caracteres)'
        );

        $confirmacion = $this->secret(
            'Confirma la contraseña'
        );

        if (
            !is_string($contrasena) ||
            mb_strlen($contrasena) < 12 ||
            $contrasena !== $confirmacion
        ) {
            $this->error(
                'La contraseña debe tener al menos 12 caracteres y coincidir.'
            );

            return self::FAILURE;
        }

        try {
            $usuario = Usuario::create([
                'idRol' => $rol->idRol,
                'nombres' => $nombres,
                'apellidos' => $apellidos,
                'correo' => $correo,
                'contrasena' => Hash::make($contrasena),
                'estado' => true,
            ]);
        } catch (\Throwable $e) {
            $this->error(
                'No se pudo crear el usuario. Revisa las restricciones de la tabla usuario.'
            );

            return self::FAILURE;
        } finally {
            unset($contrasena, $confirmacion);
        }

        $this->info(
            'Administrador creado correctamente.'
        );

        $this->line(
            'ID del usuario: ' . $usuario->idUsuario
        );

        $this->line(
            'Correo: ' . $usuario->correo
        );

        return self::SUCCESS;
    }
}
