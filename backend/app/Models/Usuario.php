<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Usuario extends Authenticatable
{
    // Tabla existente en PostgreSQL
    protected $table = 'usuario';

    // Clave primaria personalizada
    protected $primaryKey = 'idUsuario';

    public $incrementing = true;

    protected $keyType = 'int';

    // Sin created_at ni updated_at
    public $timestamps = false;

    // Atributos permitidos
    protected $fillable = [
        'idRol',
        'nombres',
        'apellidos',
        'correo',
        'contrasena',
        'estado',
    ];

    // Atributos ocultos en respuestas JSON
    protected $hidden = [
        'contrasena',
    ];

    // Conversiones de tipos
    protected function casts(): array
    {
        return [
            'idRol' => 'integer',
            'contrasena' => 'hashed',
            'estado' => 'boolean',
        ];
    }

    // Campo utilizado para la autenticación
    public function getAuthPasswordName(): string
    {
        return 'contrasena';
    }

    // Relación: un usuario pertenece a un rol
    public function rol(): BelongsTo
    {
        return $this->belongsTo(
            Rol::class,
            'idRol',
            'idRol'
        );
    }
}
