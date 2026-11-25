
<?php

use Illuminate\Support\Facades\Route;

Route::get('/estado', function () {
    return response()->json([
        'ok' => true,
        'sistema' => 'Corporacion Ortega',
        'mensaje' => 'API funcionando correctamente',
    ]);
});
